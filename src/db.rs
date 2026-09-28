use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use rusqlite::{params, Connection, Result};
use crate::models::{CategoryMeta, Quote, StatsResponse};

#[derive(Clone)]
pub struct Db {
    conn: Arc<Mutex<Connection>>,
}

impl Db {
    pub fn open(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        // 开启 WAL 模式以获得最佳并发与读写性能
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;"
        )?;

        // 初始化表结构
        conn.execute(
            "CREATE TABLE IF NOT EXISTS quotes (
                id TEXT PRIMARY KEY,
                content_zh TEXT NOT NULL,
                content_en TEXT NOT NULL,
                category TEXT NOT NULL,
                tags TEXT NOT NULL,
                source_zh TEXT,
                source_en TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_quotes_category ON quotes(category)",
            [],
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// 从 JSON 数据源同步并填充/更新 SQLite 数据库
    pub fn sync_from_json(&self, json_path: &str) -> Result<usize> {
        if !Path::new(json_path).exists() {
            eprintln!("[DB] JSON 种子文件不存在: {}", json_path);
            return Ok(0);
        }

        let raw = fs::read_to_string(json_path)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        let items: Vec<serde_json::Value> = serde_json::from_str(&raw)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        let mut count = 0;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO quotes (id, content_zh, content_en, category, tags, source_zh, source_en)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET
                    content_zh = excluded.content_zh,
                    content_en = excluded.content_en,
                    category = excluded.category,
                    tags = excluded.tags,
                    source_zh = excluded.source_zh,
                    source_en = excluded.source_en"
            )?;

            for item in items {
                let id = item.get("id").and_then(|v| v.as_str()).unwrap_or_default();
                if id.is_empty() {
                    continue;
                }

                // 兼容双语字段与单语字段
                let content_zh = item.get("content_zh")
                    .and_then(|v| v.as_str())
                    .or_else(|| {
                        if item.get("language").and_then(|v| v.as_str()) == Some("zh") {
                            item.get("content").and_then(|v| v.as_str())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_default();

                let content_en = item.get("content_en")
                    .and_then(|v| v.as_str())
                    .or_else(|| {
                        if item.get("language").and_then(|v| v.as_str()) == Some("en") {
                            item.get("content").and_then(|v| v.as_str())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_default();

                let category = item.get("category").and_then(|v| v.as_str()).unwrap_or("general");
                let tags_str = serde_json::to_string(&item.get("tags")).unwrap_or_else(|_| "[]".to_string());
                let source_zh = item.get("source_zh")
                    .and_then(|v| v.as_str())
                    .or_else(|| item.get("source").and_then(|v| v.as_str()))
                    .unwrap_or("");
                let source_en = item.get("source_en")
                    .and_then(|v| v.as_str())
                    .or_else(|| item.get("source").and_then(|v| v.as_str()))
                    .unwrap_or("");

                stmt.execute(params![
                    id,
                    content_zh,
                    content_en,
                    category,
                    tags_str,
                    source_zh,
                    source_en
                ])?;
                count += 1;
            }
        }

        tx.commit()?;
        println!("[DB] SQLite 数据库已成功同步 {} 条文案记录", count);
        Ok(count)
    }

    /// 随机获取一条文案
    pub fn get_random(&self, category: Option<&str>, tag: Option<&str>) -> Result<Option<Quote>> {
        let conn = self.conn.lock().unwrap();

        let mut query = "SELECT id, content_zh, content_en, category, tags, source_zh, source_en 
                         FROM quotes WHERE 1=1".to_string();
        let mut param_values: Vec<String> = Vec::new();

        if let Some(cat) = category {
            if !cat.is_empty() {
                query.push_str(" AND category = ?");
                param_values.push(cat.to_string());
            }
        }

        if let Some(t) = tag {
            if !t.is_empty() {
                query.push_str(" AND tags LIKE ?");
                param_values.push(format!("%\"{}\"%", t));
            }
        }

        query.push_str(" ORDER BY RANDOM() LIMIT 1");

        let mut stmt = conn.prepare(&query)?;
        let mut rows = stmt.query(rusqlite::params_from_iter(param_values.iter()))?;

        if let Some(row) = rows.next()? {
            let tags_raw: String = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_raw).unwrap_or_default();
            Ok(Some(Quote {
                id: row.get(0)?,
                content_zh: row.get(1)?,
                content_en: row.get(2)?,
                category: row.get(3)?,
                tags,
                source_zh: row.get(5)?,
                source_en: row.get(6)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// 分页与搜索查询
    pub fn query_quotes(
        &self,
        search: Option<&str>,
        category: Option<&str>,
        lang: Option<&str>,
        page: usize,
        limit: usize,
    ) -> Result<(Vec<Quote>, usize)> {
        let conn = self.conn.lock().unwrap();

        let mut where_clause = "WHERE 1=1".to_string();
        let mut param_values: Vec<String> = Vec::new();

        if let Some(cat) = category {
            if !cat.is_empty() {
                where_clause.push_str(" AND category = ?");
                param_values.push(cat.to_string());
            }
        }

        if let Some(l) = lang {
            if l == "zh" {
                where_clause.push_str(" AND content_zh != ''");
            } else if l == "en" {
                where_clause.push_str(" AND content_en != ''");
            }
        }

        if let Some(s) = search {
            if !s.is_empty() {
                where_clause.push_str(" AND (content_zh LIKE ? OR content_en LIKE ? OR source_zh LIKE ? OR tags LIKE ?)");
                let pattern = format!("%{}%", s);
                param_values.push(pattern.clone());
                param_values.push(pattern.clone());
                param_values.push(pattern.clone());
                param_values.push(pattern);
            }
        }

        // 查询总条数
        let count_sql = format!("SELECT COUNT(*) FROM quotes {}", where_clause);
        let mut count_stmt = conn.prepare(&count_sql)?;
        let total: usize = count_stmt.query_row(rusqlite::params_from_iter(param_values.iter()), |r| r.get(0))?;

        // 分页查询数据
        let offset = (page.saturating_sub(1)) * limit;
        let data_sql = format!(
            "SELECT id, content_zh, content_en, category, tags, source_zh, source_en 
             FROM quotes {} ORDER BY id ASC LIMIT ? OFFSET ?",
            where_clause
        );

        let mut query_params = param_values;
        query_params.push(limit.to_string());
        query_params.push(offset.to_string());

        let mut data_stmt = conn.prepare(&data_sql)?;
        let rows = data_stmt.query_map(rusqlite::params_from_iter(query_params.iter()), |row| {
            let tags_raw: String = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_raw).unwrap_or_default();
            Ok(Quote {
                id: row.get(0)?,
                content_zh: row.get(1)?,
                content_en: row.get(2)?,
                category: row.get(3)?,
                tags,
                source_zh: row.get(5)?,
                source_en: row.get(6)?,
            })
        })?;

        let mut items = Vec::new();
        for r in rows {
            items.push(r?);
        }

        Ok((items, total))
    }

    /// 获取分类列表元数据与统计数量
    pub fn get_categories(&self) -> Result<Vec<CategoryMeta>> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare("SELECT category, COUNT(*) FROM quotes GROUP BY category")?;
        let rows = stmt.query_map([], |row| {
            let cat: String = row.get(0)?;
            let cnt: usize = row.get(1)?;
            Ok((cat, cnt))
        })?;

        let mut count_map = HashMap::new();
        for r in rows {
            let (cat, cnt) = r?;
            count_map.insert(cat, cnt);
        }

        let predefined = vec![
            ("math_logic", "数理逻辑与纯数", "Math & Logic", "∑"),
            ("ai_ml", "机器学习与 AI 炼丹", "AI & Machine Learning", "∇"),
            ("cs_geek", "计算机体系与算法极客", "CS & Geek Culture", "⌘"),
            ("physics_stem", "理论物理与大学理科", "Physics & STEM Life", "⚛"),
        ];

        let mut list = Vec::new();
        for (id, zh, en, icon) in predefined {
            list.push(CategoryMeta {
                id: id.to_string(),
                name_zh: zh.to_string(),
                name_en: en.to_string(),
                icon: icon.to_string(),
                count: *count_map.get(id).unwrap_or(&0),
            });
        }

        Ok(list)
    }

    /// 获取全局统计信息
    pub fn get_stats(&self) -> Result<StatsResponse> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare("SELECT category, tags, content_zh, content_en FROM quotes")?;
        let rows = stmt.query_map([], |row| {
            let cat: String = row.get(0)?;
            let tags_raw: String = row.get(1)?;
            let zh: String = row.get(2)?;
            let en: String = row.get(3)?;
            Ok((cat, tags_raw, zh, en))
        })?;

        let mut by_category = HashMap::new();
        let mut by_language = HashMap::new();
        let mut all_tags = HashSet::new();
        let mut total = 0;

        for r in rows {
            let (cat, tags_raw, zh, en) = r?;
            total += 1;
            *by_category.entry(cat).or_insert(0) += 1;

            if !zh.is_empty() {
                *by_language.entry("zh".to_string()).or_insert(0) += 1;
            }
            if !en.is_empty() {
                *by_language.entry("en".to_string()).or_insert(0) += 1;
            }

            if let Ok(tags) = serde_json::from_str::<Vec<String>>(&tags_raw) {
                for t in tags {
                    all_tags.insert(t);
                }
            }
        }

        Ok(StatsResponse {
            total_quotes: total,
            total_categories: by_category.len(),
            total_tags: all_tags.len(),
            by_category,
            by_language,
            database_engine: "SQLite (rusqlite WAL)".to_string(),
            server: "Axum (Rust)".to_string(),
        })
    }
}
