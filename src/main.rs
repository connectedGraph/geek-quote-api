mod db;
mod models;
mod routes;

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use crate::db::Db;

/// 智能探测并解析 SQLite 数据库物理路径
fn resolve_db_path() -> PathBuf {
    if let Ok(env_path) = std::env::var("GEEK_DB_PATH") {
        return PathBuf::from(env_path);
    }

    let candidates = [
        "data/geek_quotes.db",
        "geek_quotes.db",
    ];
    for cand in candidates {
        let p = PathBuf::from(cand);
        if p.exists() {
            return p;
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_candidates = [
                exe_dir.join("geek_quotes.db"),
                exe_dir.join("data/geek_quotes.db"),
            ];
            for cand in exe_candidates {
                if cand.exists() {
                    return cand;
                }
            }
        }
    }

    PathBuf::from("data/geek_quotes.db")
}

/// 智能探测并解析前端静态资源目录
fn resolve_static_dir() -> PathBuf {
    if let Ok(env_path) = std::env::var("GEEK_STATIC_DIR") {
        return PathBuf::from(env_path);
    }

    let candidates = [
        "frontend/dist",
        "dist",
        "public",
    ];
    for cand in candidates {
        let p = PathBuf::from(cand);
        if p.exists() {
            return p;
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let exe_candidates = [
                exe_dir.join("dist"),
                exe_dir.join("frontend/dist"),
                exe_dir.join("public"),
            ];
            for cand in exe_candidates {
                if cand.exists() {
                    return cand;
                }
            }
        }
    }

    PathBuf::from("frontend/dist")
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let db_path = resolve_db_path();
    if let Some(parent) = db_path.parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    let db_str = db_path.to_string_lossy().to_string();
    println!("[Rust Server] 正在连接 SQLite 数据库: {}", db_str);
    let db = Db::open(&db_str)?;

    // 检查是否已有数据；若为空则自动通过双语 JSON 种子初始化
    let current_stats = db.get_stats().ok();
    let current_count = current_stats.map(|s| s.total_quotes).unwrap_or(0);

    if current_count == 0 {
        println!("[Rust Server] 数据库为空，正在通过种子文件初始化...");
        let seeds = [
            "data/quotes_bilingual.json",
            "quotes_bilingual.json",
            "data/quotes.json",
        ];
        for seed in seeds {
            if Path::new(seed).exists() {
                match db.sync_from_json(seed) {
                    Ok(n) if n > 0 => {
                        println!("[Rust Server] 已从 {} 成功加载同步 {} 条记录", seed, n);
                        break;
                    }
                    _ => {}
                }
            }
        }
    } else {
        println!("[Rust Server] 数据库已就绪，已加载 {} 条双语条目 (极速秒开)", current_count);
    }

    // 配置跨域
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let static_dir = resolve_static_dir();
    let static_str = static_dir.to_string_lossy().to_string();
    println!("[Rust Server] 静态资源挂载路径: {}", static_str);

    // API 路由
    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/api/random", get(routes::get_random))
        .route("/api/quotes", get(routes::get_quotes))
        .route("/api/categories", get(routes::get_categories))
        .route("/api/stats", get(routes::get_stats))
        .route("/api/reload", post(routes::reload_database))
        .layer(cors)
        .with_state(db)
        .fallback_service(ServeDir::new(&static_dir));

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .unwrap_or(3000);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let ip: std::net::IpAddr = host.parse().unwrap_or_else(|_| {
        eprintln!("[Rust Server] 无法解析 HOST={}，回退到 127.0.0.1", host);
        "127.0.0.1".parse().expect("valid loopback address")
    });
    let addr = SocketAddr::from((ip, port));
    println!("\n========================================================");
    println!("  Geek Quote API 服务已就绪 (Rust + SQLite + TypeScript)");
    println!("  - 本地监听:    http://127.0.0.1:{}", port);
    println!("  - 随机文案:    http://127.0.0.1:{}/api/random", port);
    println!("  - 分页检索:    http://127.0.0.1:{}/api/quotes", port);
    println!("  - 分类统计:    http://127.0.0.1:{}/api/categories", port);
    println!("  - 引擎统计:    http://127.0.0.1:{}/api/stats", port);
    println!("  - 健康检查:    http://127.0.0.1:{}/health", port);
    println!("========================================================\n");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
