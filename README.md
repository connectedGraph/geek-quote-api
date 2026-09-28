<div align="center">

# 🌌 Geek Quote API
### 大学理科生 · 数理逻辑 · AI与机器学习 · 极客学术梗双语随机文案库

**A High-Performance, Elegant Bilingual Quote API & Web Platform for STEM, Math Logic, and AI Enthusiasts.**

[![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange?logo=rust)](https://www.rust-lang.org/)
[![Axum](https://img.shields.io/badge/Framework-Axum%200.7-blue)](https://github.com/tokio-rs/axum)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20WAL-003B57?logo=sqlite)](https://www.sqlite.org/)
[![TypeScript](https://img.shields.io/badge/Frontend-TypeScript%20%2B%20Vite-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/)

[English Documentation](#english-documentation) · [中文文档](#中文文档) · [API 接口说明](#restful-api-文档) · [在线面板](#快速启动)

</div>

---

<a name="中文文档"></a>
## 📖 项目简介 (Overview)

**Geek Quote API** 专为大学理科生、算法工程师、AI/机器学习调参师与学术极客打造。项目不仅收录经典拓扑学、哥德尔不完备定理、微分分析、统计学检验、深度学习炼丹以及 Jeff Dean Facts 等学术冷幽默，更通过大语言模型与人工精调，实现**纯正中英双语对照并行**。

底层基于 **Rust (Axum)** 构建高并发、纳秒级解析的后端，集成 **SQLite (WAL 模式)** 嵌入式数据库驱动，前端采用 **TypeScript + Vite** 极简科学暗色面板，开箱即用，适合作为博客随机器、CLI 终端问候语、GitHub Profile README 动态展示或日常科研放松工具。

---

## 🛠️ 技术架构 (Architecture)

```text
geek-quote-api/
├── Cargo.toml                  # Rust 依赖与工程配置
├── src/                        # Rust (Axum) 后端核心源码 (极简、高性能)
│   ├── main.rs                 # 智能路径探测、服务启动、路由挂载
│   ├── db.rs                   # SQLite WAL 模式数据库操作与高速并发读写
│   ├── models.rs               # 强类型数据模型与出入参结构
│   └── routes.rs               # RESTful API 路由处理函数
├── portable/                   # 📦 开箱即用便携绿色包 (零环境依赖)
│   ├── geek-quote-api.exe      # 预编译原生可执行程序
│   ├── geek_quotes.db          # 直接内置的 560 条全量双语 SQLite 数据库
│   ├── dist/                   # 编译就绪的前端 Web 交互面板
│   ├── start.bat               # Windows 一键双击运行脚本
│   └── README.md               # 便携包独立使用说明
├── frontend/                   # 现代化 TypeScript + Vite 前端工程
│   ├── src/                    # 前端源码 (类型安全、暗色科学极简美学)
│   └── dist/                   # 前端静态构建输出
├── data/                       # 生产运行时核心数据
│   ├── geek_quotes.db          # SQLite 嵌入式数据库 (WAL 模式)
│   └── quotes_bilingual.json   # 560+ 条高阶中英双语对照基准 JSON
├── pipeline/                   # 🧬 完整语料采集与大模型批量翻译流水线 (代码区)
│   ├── README.md               # 流水线架构与运行指南
│   ├── raw_sources/            # Unix fortune、开源 Geek 梗与前沿 AI 语料
│   └── scripts/                # 抽取打标、Jaccard 去重与 XML 批量翻译脚本
└── examples/                   # 💡 极简客户端与直接嵌入调用示例
    ├── sqlite_direct.py        # 零依赖 Python 直接读取 SQLite 示例
    └── sqlite_direct.js        # 零依赖 Node 原生 node:sqlite 直接调用示例
```

---

<a name="快速启动"></a>
## 🚀 快速启动 (Quickstart)

### 方式一：使用便携绿色包 (零依赖，解压即用，推荐)

若不想配置 Rust 或 Node.js 开发环境，可直接进入 `portable/` 目录：
- **Windows 用户**：直接双击 `portable/start.bat`，自动拉起服务并在浏览器打开 Web 面板；
- **命令行用户**：
  ```bash
  cd portable
  .\geek-quote-api.exe
  ```
  服务即刻在 `http://127.0.0.1:3000` 启动，直接加载同目录内置的 `geek_quotes.db`。

### 方式二：从源码编译并运行 Rust 全栈服务

```bash
# 1. 编译并运行 Rust 生产模式服务 (自动绑定内置 SQLite 与前端 dist)
cargo run --release
```

服务就绪后，在浏览器访问：
👉 **http://127.0.0.1:3000**

### 方式三：极简直接读取内置 SQLite 数据库 (零服务器模式)

如果你只想在自己的脚本中嵌入这 560 条理科梗，无需启动任何 HTTP 服务：

- **Python (内置 sqlite3)**:
  ```bash
  python examples/sqlite_direct.py
  ```
- **Node.js (内置 node:sqlite)**:
  ```bash
  node examples/sqlite_direct.js
  ```

---

<a name="快速启动"></a>
## 🚀 快速启动 (Quickstart)

### 方式一：直接运行 Rust 高性能后端 (含前端静态资源)

```bash
# 1. 构建前端静态资源 (已内置构建成果)
cd frontend
npm install
npm run build
cd ..

# 2. 启动 Rust 生产环境服务
cargo run --release
```

服务就绪后，在浏览器访问：
👉 **http://127.0.0.1:3000**

### 方式二：前端极速热重载开发模式

```bash
# 启动 Rust API 后端
cargo run

# 在另一个终端中启动前端 Vite 开发服务器
cd frontend
npm run dev
# 浏览器打开 http://localhost:5173
```

---

<a name="restful-api-文档"></a>
## 📡 RESTful API 接口规范

所有的 API 均支持跨域（CORS），并返回统一格式的 JSON 报文。

### 1. 随机获取文案 `GET /api/random`

从 SQLite 数据库中高效获取一条随机文案，支持多维度复合筛选。

*   **URL 参数**：
    *   `category` (可选)：`math_logic` | `ai_ml` | `cs_geek` | `physics_stem`
    *   `lang` (可选)：`both`（默认，返回双语） | `zh`（仅中文） | `en`（仅英文）
    *   `tag` (可选)：按标签过滤，如 `topology`, `goedel`, `rlhf`, `jeff_dean`
    *   `format` (可选)：`json`（默认） | `text`（终端 CLI 纯文本单行）

*   **cURL 示例**：
```bash
# 随机获取一条 AI/机器学习 梗 (JSON)
curl "http://127.0.0.1:3000/api/random?category=ai_ml"

# 终端快捷单行打印纯文本
curl "http://127.0.0.1:3000/api/random?category=math_logic&format=text&lang=zh"
```

*   **响应示例 (JSON)**：
```json
{
  "code": 200,
  "data": {
    "id": "stem_c89fdaa62d",
    "content_zh": "大模型并没有撒谎，它只是在一个 1000 亿维的连续语义流形上，以 0.99 的置信度自信地胡说八道。",
    "content_en": "The large model isn't lying; it's just confidently talking nonsense with 0.99 confidence on a 100-billion-dimensional continuous semantic manifold.",
    "category": "ai_ml",
    "tags": ["llm", "hallucination", "nlp"],
    "source_zh": "生成式AI反思",
    "source_en": "Reflections on Generative AI"
  }
}
```

---

### 2. 全文检索与分页 `GET /api/quotes`

*   **URL 参数**：
    *   `search`：检索关键词（对中英文内容、出处、标签均有效）
    *   `category`：学科分类
    *   `lang`：`zh` | `en`
    *   `page`：页码 (默认 1)
    *   `limit`：每页条数 (默认 20，最大 100)

```bash
curl "http://127.0.0.1:3000/api/quotes?search=Jeff%20Dean&limit=5"
```

---

### 3. 分类元信息与统计 `GET /api/categories`

获取学科分类的图标、中英文名称与实时条目分布统计。

```bash
curl "http://127.0.0.1:3000/api/categories"
```

---

### 4. 系统统计 `GET /api/stats`

获取数据库引擎、总条目数、总标签数及分类统计信息。

---

## 🔬 数据清洗与去重算法 (Deduplication Engine)

数据导入管道位于 `scripts/deduplicate.js`，采用**双层过滤机制**保障学术纯度：

1.  **精确指纹查重**：对标点、空格做归一化后计算 SHA-256 唯一指纹，剔除完全一致的文案；
2.  **模糊与包含度分析**：基于字符 2-gram 词元分析，结合 **Jaccard 相似度**（阀值 $\ge 0.85$）与 **包含度 (Containment)**（阀值 $\ge 0.90$），有效过滤翻译版本微调、人名后置或括号注释引起的冗余。

```bash
# 执行去重合并
node scripts/deduplicate.js
```

---

## 🤖 大模型双语流转流水线 (LLM Pipeline)

项目内置了针对本地/远端大模型接口的流转脚本 `scripts/translate_bilingual.js`：
*   **断点续传**：自动检测已有中英文对照条目，跳过已完成项；
*   **严格 XML 标签提取**：提示词强制约束大模型输出在 `<translation>...</translation>` 标签内，杜绝输出冗余客套话；
*   **速率保护**：内置 RPM 与并发限制槽位，保障平稳流转。

---

<a name="english-documentation"></a>
## 🌐 English Documentation

### Features
*   **Dual-Language Parallelism**: Every quote features both Chinese and English translations fine-tuned for authentic STEM wit and comedic timing.
*   **Rust & Axum Powered**: Blazing-fast response times (<1ms) with low memory footprint.
*   **SQLite with WAL Mode**: Embedded zero-configuration ACID database.
*   **TypeScript + Vite**: Interactive frontend featuring category filtering, live search, one-click copy, and interactive REST playground.
*   **Zero External DB Dependencies**: Single portable binary ready for deployment.

---

## 📄 开源许可证 (License)

本项目采用 [MIT License](LICENSE) 开源协议。
欢迎提交 Issue 与 Pull Request 补充更多有意思的数理逻辑与 AI 学术梗！
