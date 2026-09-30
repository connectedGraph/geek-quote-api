# Geek Quote API

一个面向 STEM、数学逻辑、计算机和 AI/机器学习爱好者的中英双语极客文案 API。

项目提供同一份数据和同一套 HTTP API 的三种实现：

- Rust + Axum + SQLite：适合低资源部署和单文件服务。
- Node.js：只使用 Node.js 标准库，适合快速运行和二次开发。
- Python：只使用 Python 标准库，适合脚本、教学和轻量服务。

三种实现都读取 `data/quotes_bilingual.json`，不会因为运行时不同而出现数据或接口不一致。

## Features

- 560 条中英双语 STEM、CS、数学逻辑和 AI 文案
- 随机获取、分类过滤、标签过滤、全文搜索和分页
- JSON 与纯文本两种随机结果格式
- 内置静态 Web 面板
- SQLite 数据库仅由 Rust 实现按需生成；Node.js 和 Python 使用内存 JSON，不需要数据库服务
- MIT License

## Provenance and authorship

`pipeline/` is original project code written and maintained for this repository. It includes the corpus extraction, rule-based classification, exact and fuzzy deduplication, category balancing, bilingual translation prompts, XML batch parser, rate limiting, checkpointing and dataset merge steps. It is part of the project, not an upstream dependency.

The quote corpus is a curated combination of project-authored/editorially written seed entries and material collected from public upstream sources. The source labels preserved in the data include `fortune-mod/computers`, `fortune-mod/science`, `alkashef/data-science-quotes`, `kbroman/datasciquotes`, `TheJeffDeanFacts`, and other named sources. The original source label is retained in `source`, `source_zh` and `source_en` whenever available.

The bilingual fields are produced and reviewed through our translation pipeline; they should not be interpreted as a claim that the underlying third-party quotations are original to this project. See [pipeline/SOURCES.md](pipeline/SOURCES.md) for the current source inventory, authorship boundaries and contribution rules.

## Quickstart

### Rust

需要 Rust stable 和 Windows/Linux/macOS 的本地编译工具链。

```bash
cargo run --release
```

默认监听 `http://127.0.0.1:3000`。可以通过 `PORT`、`HOST`、`GEEK_DB_PATH` 和 `GEEK_STATIC_DIR` 调整运行参数。

### Node.js

需要 Node.js 18 或更高版本。服务本身没有第三方运行时依赖。

```bash
pnpm start
```

开发模式：

```bash
pnpm dev
```

### Python

需要 Python 3.9 或更高版本，不需要安装第三方包。

```bash
python python/server.py
```

也可以使用参数或环境变量修改监听地址：

```bash
python python/server.py --host 127.0.0.1 --port 3000
```

### Web frontend

前端源码在 `frontend/`，构建结果已经提交在 `frontend/dist/` 和 `public/` 中。重新构建时使用 pnpm：

```bash
cd frontend
pnpm install
pnpm build
```

## API

所有服务默认支持以下接口。

### `GET /health`

健康检查，成功时返回纯文本 `OK`。

### `GET /api/random`

随机获取一条文案。

查询参数：

- `category`：`math_logic`、`ai_ml`、`cs_geek` 或 `physics_stem`
- `tag`：精确匹配标签
- `lang`：`zh`、`en` 或 `both`，默认 `both`
- `format`：`json` 或 `text`，默认 `json`

示例：

```bash
curl "http://127.0.0.1:3000/api/random?category=ai_ml"
curl "http://127.0.0.1:3000/api/random?lang=zh&format=text"
```

### `GET /api/quotes`

搜索并分页返回文案。支持 `search`、`category`、`lang`、`page` 和 `limit`，其中 `limit` 最大为 100。

```bash
curl "http://127.0.0.1:3000/api/quotes?search=gradient&limit=5"
```

响应中的分页数据统一位于 `data` 下：

```json
{
  "code": 200,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "limit": 20,
    "total_pages": 0
  }
}
```

### `GET /api/categories`

返回四个分类及其当前条目数量。

### `GET /api/stats`

返回总数、分类分布、语言分布、标签数和当前实现信息。

### `POST /api/reload`

重新读取 `data/quotes_bilingual.json`。适合开发时替换数据文件后热加载。

## Repository layout

```text
.
├── data/
│   ├── quotes_bilingual.json   # canonical bilingual dataset
│   └── quotes.json              # raw single-language intermediate dataset
├── src/                         # Rust implementation
├── server.js                    # Node.js standard-library implementation
├── python/server.py             # Python standard-library implementation
├── frontend/                    # TypeScript + Vite frontend source
├── public/                      # static files served by Node and Python
├── pipeline/                    # source collection, deduplication and translation tools
├── examples/                    # direct SQLite access examples
├── portable/                    # optional Windows portable Rust package
└── tests/                       # Node.js and Python smoke/data tests
```

## Data pipeline

The data processing tools under `pipeline/` are maintained by this project. The checked-in JSON files are dataset snapshots generated from the raw sources; update the raw inputs and rerun the pipeline instead of editing generated output manually.

```bash
node pipeline/scripts/expand_corpus.js
node pipeline/scripts/build_expansion_pool.js
node pipeline/scripts/deduplicate.js
node pipeline/scripts/batch_translate_xml.js
```

Translation scripts expect an OpenAI-compatible local endpoint at `http://localhost:8081/v1/chat/completions`. They are optional and are not needed to run any API implementation.

See [pipeline/SOURCES.md](pipeline/SOURCES.md) before adding upstream material or redistributing a dataset snapshot.

## Tests

```bash
pnpm test
python -m unittest discover -s tests -p "test_*.py"
cargo check
```

`cargo test` additionally needs a working native linker on the host. On Windows this normally means installing the MSVC C++ build tools.

## Portable package

`portable/` contains an optional prebuilt Windows package with the Rust executable, SQLite database, static frontend and start scripts. It is a convenience artifact; the source implementations remain the canonical way to build the project for other platforms.

## Contributing

Issues and pull requests are welcome. New entries should include both `content_zh` and `content_en`, a stable category, useful tags and source attribution when available.

## License

MIT License. See [LICENSE](LICENSE).
