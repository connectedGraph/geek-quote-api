use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Quote {
    pub id: String,
    pub content_zh: String,
    pub content_en: String,
    pub category: String,
    pub tags: Vec<String>,
    pub source_zh: String,
    pub source_en: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryMeta {
    pub id: String,
    pub name_zh: String,
    pub name_en: String,
    pub icon: String,
    pub count: usize,
}

#[derive(Debug, Deserialize)]
pub struct RandomQuery {
    pub category: Option<String>,
    pub lang: Option<String>, // "zh", "en", "both"
    pub tag: Option<String>,
    pub format: Option<String>, // "json", "text"
}

#[derive(Debug, Deserialize)]
pub struct QuotesQuery {
    pub search: Option<String>,
    pub category: Option<String>,
    pub lang: Option<String>,
    pub page: Option<usize>,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub code: u16,
    pub data: T,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: usize,
    pub page: usize,
    pub limit: usize,
    pub total_pages: usize,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub total_quotes: usize,
    pub total_categories: usize,
    pub total_tags: usize,
    pub by_category: HashMap<String, usize>,
    pub by_language: HashMap<String, usize>,
    pub database_engine: String,
    pub server: String,
}
