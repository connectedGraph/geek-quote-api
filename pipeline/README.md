# 🧬 数据流水线工程指南 (Data Pipeline & Mining Engineering)

本目录 (`pipeline/`) 包含 **Geek Quote API** 语料库的完整采集、清洗打标、智能去重及大语言模型批量双语互译流水线代码与原始源文件。

本目录中的处理脚本是本项目原创并由本项目维护的工程代码，不是从上游仓库复制的运行时依赖。上游语料、项目自写种子、人工整理内容和翻译生成内容之间的边界见 [SOURCES.md](SOURCES.md)。

---

## 目录结构

```text
pipeline/
├── README.md               # 本流水线工程架构与运行指南
├── raw_sources/            # 原始多源语料资产
│   ├── fortune_computers.txt   # Unix BSD 经典计算机与黑客历史语料 (~5,700 行)
│   ├── fortune_science.txt     # Unix BSD 科学、数理与物理学历史语料 (~3,000 行)
│   ├── geek_jokes_raw.json     # 社区精选 Geek 梗 API 原始数据 (607 条)
│   ├── ai_ml_seed.json         # 基础 AI/ML 学科种子
│   ├── math_logic_seed.json    # 基础数理逻辑学科种子
│   ├── physics_stem_seed.json  # 基础理论物理学科种子
│   ├── cs_geek_seed.json       # 基础算法与极客种子
│   └── modern_ai_math_seed.json# 现代 AI (Transformer/CUDA/LLM) 与高阶数学前沿精选
└── scripts/                # 自动化数据处理与 LLM 批量流水线
    ├── expand_corpus.js        # 语料抽取、过滤清洗与四大学科规则打标
    ├── build_expansion_pool.js # 语料池组装、SHA256+Jaccard 去重与学科配额平衡器
    ├── batch_translate_xml.js  # 本地 LLM XML 结构化批量双语互译引擎 (支持实时断点续传与 RPM 限流)
    └── deduplicate.js          # 文本归一化与精确/模糊查重工具
```

---

## 语料处理核心流程

### 1. 原始候选抽取与分类打标 (`expand_corpus.js`)
- 自动解析 Unix `%` 分隔符 datfile 与 JSON 数组；
- 过滤长度过短碎片（<20 字符）与无趣历史系统日志（>350 字符）；
- 通过分类特征词典将文本归类至四大核心领域：
  - `ai_ml` (深度学习、大模型、梯度下降、反向传播、CUDA)
  - `math_logic` (数理逻辑、微积分、拓扑学、数论、哥德尔不完备)
  - `physics_stem` (理论物理、量子叠加、热力学熵、实验科学)
  - `cs_geek` (算法复杂度、操作系统、指针、编译报错、Unix 哲学)

### 2. 去重与配额平衡 (`build_expansion_pool.js`)
- **精确指纹**：文本小写、移除标点与空白后计算 SHA-256 前 10 位；
- **模糊语义查重**：采用 2-gram Jaccard 相似度计算（阈值 $\ge 0.82$ 判定为变体冗余）；
- **配额平衡**：确保四大领域的语料均衡丰富。

### 3. XML 结构化批量翻译引擎 (`batch_translate_xml.js`)
针对本地 Web 会话或低限流（20 RPM）大模型环境进行极速吞吐优化：
- **批处理包装**：单次请求打包 6~8 条文本，提示模型返回结构化 XML：
  ```xml
  <translations>
    <item id="1">中文翻译</item>
    <item id="2">中文翻译</item>
  </translations>
  ```
- **天然免转义**：相比 JSON 模式下引号嵌套导致的语法报错，XML 节点正则解析鲁棒性达 100%；
- **限流发号器与断点持久化**：以 3,100ms 间隔调度保护单会话稳定性，每批次返回立即原子写入 `data/quotes_bilingual.json`。

---

## 扩充或二次开发运行

重新生成数据时，请优先修改 `raw_sources/` 或对应的处理规则；`data/quotes.json` 和 `data/quotes_bilingual.json` 是流水线产出的数据快照。对于外部上游内容，请在合并前保留来源、作者、许可证或使用条款信息。

若需要向本库增补新的数据源或重新执行全流程：

```bash
# 1. 抽取并清洗原始语料
node pipeline/scripts/expand_corpus.js

# 2. 组装语料池并去重
node pipeline/scripts/build_expansion_pool.js

# 3. 启动批量翻译引擎 (确保本地 LLM 服务运行在 localhost:8081)
node pipeline/scripts/batch_translate_xml.js
```
