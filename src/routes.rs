use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use crate::db::Db;
use crate::models::{ApiResponse, PaginatedResponse, QuotesQuery, RandomQuery};

pub async fn get_random(
    State(db): State<Db>,
    Query(params): Query<RandomQuery>,
) -> Response {
    let category = params.category.as_deref();
    let tag = params.tag.as_deref();
    let lang = params.lang.as_deref().unwrap_or("both");
    let format = params.format.as_deref().unwrap_or("json");

    match db.get_random(category, tag) {
        Ok(Some(quote)) => {
            if format == "text" {
                let text = match lang {
                    "zh" => format!("{}\n—— {}", quote.content_zh, quote.source_zh),
                    "en" => format!("{}\n—— {}", quote.content_en, quote.source_en),
                    _ => format!(
                        "{}\n{}\n—— {} / {}",
                        quote.content_zh, quote.content_en, quote.source_zh, quote.source_en
                    ),
                };
                return (
                    StatusCode::OK,
                    [("Content-Type", "text/plain; charset=utf-8")],
                    text,
                )
                    .into_response();
            }

            Json(ApiResponse {
                code: 200,
                data: quote,
                meta: None,
            })
            .into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "code": 404,
                "message": "未找到匹配条件的文案"
            })),
        )
            .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "code": 500,
                "error": err.to_string()
            })),
        )
            .into_response(),
    }
}

pub async fn get_quotes(
    State(db): State<Db>,
    Query(params): Query<QuotesQuery>,
) -> Response {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).clamp(1, 100);
    let search = params.search.as_deref();
    let category = params.category.as_deref();
    let lang = params.lang.as_deref();

    match db.query_quotes(search, category, lang, page, limit) {
        Ok((items, total)) => {
            let total_pages = (total + limit - 1) / limit;
            Json(ApiResponse {
                code: 200,
                data: PaginatedResponse {
                    items,
                    total,
                    page,
                    limit,
                    total_pages,
                },
                meta: None,
            })
            .into_response()
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "code": 500,
                "error": err.to_string()
            })),
        )
            .into_response(),
    }
}

pub async fn get_categories(State(db): State<Db>) -> Response {
    match db.get_categories() {
        Ok(categories) => Json(ApiResponse {
            code: 200,
            data: categories,
            meta: None,
        })
        .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "code": 500,
                "error": err.to_string()
            })),
        )
            .into_response(),
    }
}

pub async fn get_stats(State(db): State<Db>) -> Response {
    match db.get_stats() {
        Ok(stats) => Json(ApiResponse {
            code: 200,
            data: stats,
            meta: None,
        })
        .into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "code": 500,
                "error": err.to_string()
            })),
        )
            .into_response(),
    }
}

pub async fn reload_database(State(db): State<Db>) -> Response {
    let candidates = [
        "data/quotes_bilingual.json",
        "data/quotes.json",
    ];

    let mut loaded = 0;
    for c in candidates {
        if std::path::Path::new(c).exists() {
            if let Ok(count) = db.sync_from_json(c) {
                if count > 0 {
                    loaded = count;
                    break;
                }
            }
        }
    }

    Json(serde_json::json!({
        "code": 200,
        "message": format!("数据库已从 JSON 种子源重载成功，导入 {} 条文案", loaded)
    }))
    .into_response()
}
