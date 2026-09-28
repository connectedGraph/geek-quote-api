# 📦 Geek Quote API 便携绿色包 (Standalone Portable Bundle)

这是一个**完全零外部依赖**、开箱即用的轻量全栈理工梗文案服务包。

无需安装任何 Rust、Cargo、Node.js、npm、Python 或 SQLite 环境，解压即用！

---

## 包含内容

```text
portable/
├── geek-quote-api.exe      # 编译好的高性能原生可执行程序 (Rust + Axum)
├── geek_quotes.db          # 内置的 SQLite 数据库文件 (560 条纯正理科双语数据)
├── dist/                   # 极简暗色前端 Web 面板构建产物 (HTML, CSS, JS)
├── start.bat               # Windows 一键双击启动脚本 (自动开浏览器)
├── start.sh                # Linux / macOS 快捷启动脚本
└── README.md               # 本使用说明
```

---

## 使用方式

### 方式一：双击启动 (Windows)
直接双击运行 `start.bat` 即可：
- 自动启动后台 Rust 极速服务；
- 自动在默认浏览器中打开 Web 交互面板：`http://127.0.0.1:3000`。

### 方式二：命令行启动
```cmd
# Windows PowerShell 或 CMD
.\geek-quote-api.exe

# 或指定自定义端口运行
set PORT=8080
.\geek-quote-api.exe
```

---

## 核心 API 快速调用

服务启动后，提供标准的 RESTful 跨域 JSON 接口：

### 1. 随机获取一条文案
```bash
# 默认返回中英双语
curl http://127.0.0.1:3000/api/random

# 按学科分类筛选 (ai_ml | math_logic | physics_stem | cs_geek)
curl http://127.0.0.1:3000/api/random?category=ai_ml

# 终端 CLI 单行纯文本模式
curl "http://127.0.0.1:3000/api/random?format=text&lang=zh"
```

### 2. 获取分类与全局统计
```bash
# 获取所有学科分类元信息与各自分布
curl http://127.0.0.1:3000/api/categories

# 获取数据库与服务端指标
curl http://127.0.0.1:3000/api/stats
```
