mod db;
mod models;
mod routes;

use std::net::SocketAddr;
use std::path::Path;
use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use crate::db::Db;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志记录
    tracing_subscriber::fmt::init();

    let db_path = "data/geek_quotes.db";
    // 确保数据目录存在
    if let Some(parent) = Path::new(db_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    println!("[Rust Server] 正在连接 SQLite 数据库: {}", db_path);
    let db = Db::open(db_path)?;

    // 启动时自动同步种子数据
    let seeds = [
        "data/quotes_bilingual.json",
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

    // 配置跨域
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 静态文件服务目录：优先 frontend/dist，备用 public
    let static_dir = if Path::new("frontend/dist").exists() {
        "frontend/dist"
    } else {
        "public"
    };

    println!("[Rust Server] 静态资源挂载路径: {}", static_dir);

    // API 路由
    let app = Router::new()
        .route("/api/random", get(routes::get_random))
        .route("/api/quotes", get(routes::get_quotes))
        .route("/api/categories", get(routes::get_categories))
        .route("/api/stats", get(routes::get_stats))
        .route("/api/reload", post(routes::reload_database))
        .layer(cors)
        .with_state(db)
        .fallback_service(ServeDir::new(static_dir));

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .unwrap_or(3000);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("\n========================================================");
    println!("  Geek Quote API 服务已就绪 (Rust + SQLite + TypeScript)");
    println!("  - 本地监听:    http://127.0.0.1:{}", port);
    println!("  - 随机文案:    http://127.0.0.1:{}/api/random", port);
    println!("  - 分页检索:    http://127.0.0.1:{}/api/quotes", port);
    println!("  - 分类统计:    http://127.0.0.1:{}/api/categories", port);
    println!("  - 引擎统计:    http://127.0.0.1:{}/api/stats", port);
    println!("========================================================\n");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
