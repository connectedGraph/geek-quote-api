import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDeduplication } from './scripts/deduplicate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'data/quotes.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);

// 内存中缓存数据
let quotesCache = [];

function loadQuotes() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      console.log('[Server] quotes.json 未找到，执行自动去重合并...');
      runDeduplication();
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    quotesCache = JSON.parse(raw);
    console.log(`[Server] 已成功加载 ${quotesCache.length} 条文案入内存缓存`);
  } catch (err) {
    console.error('[Server] 加载 quotes.json 失败:', err.message);
    quotesCache = [];
  }
}

// 类别中文映射与元信息
const CATEGORY_META = {
  math_logic: { name: '数理逻辑与纯数', nameEn: 'Math & Logic', icon: '∑' },
  ai_ml: { name: '机器学习与 AI 炼丹', nameEn: 'AI & Machine Learning', icon: '∇' },
  cs_geek: { name: '计算机体系与算法极客', nameEn: 'CS & Geek Culture', icon: '⌘' },
  physics_stem: { name: '理论物理与大学理科', nameEn: 'Physics & STEM Life', icon: '⚛' }
};

// MIME 类型字典
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(text);
}

// 静态文件服务
function serveStatic(req, res, pathname) {
  let cleanPath = pathname.replace(/^\/+/, '');
  if (cleanPath === '' || cleanPath === '/') {
    cleanPath = 'index.html';
  }

  const filePath = path.join(PUBLIC_DIR, cleanPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      return sendJson(res, 404, { error: 'File Not Found', path: pathname });
    }

    let actualFilePath = filePath;
    let actualSize = stats.size;
    if (stats.isDirectory()) {
      actualFilePath = path.join(filePath, 'index.html');
      try {
        const subStat = fs.statSync(actualFilePath);
        actualSize = subStat.size;
      } catch {
        return sendJson(res, 404, { error: 'Index File Not Found' });
      }
    }

    const ext = path.extname(actualFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': actualSize,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(actualFilePath);
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  // 处理 CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // API 路由
  if (pathname === '/api/random') {
    const category = searchParams.get('category');
    const lang = searchParams.get('lang');
    const tag = searchParams.get('tag');
    const format = (searchParams.get('format') || 'json').toLowerCase();

    let pool = quotesCache;
    if (category) {
      pool = pool.filter(q => q.category === category);
    }
    if (lang) {
      pool = pool.filter(q => q.language === lang);
    }
    if (tag) {
      pool = pool.filter(q => q.tags && q.tags.includes(tag.toLowerCase()));
    }

    if (pool.length === 0) {
      return sendJson(res, 404, {
        code: 404,
        message: '未找到符合条件的文案',
        filters: { category, lang, tag }
      });
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const quote = pool[randomIndex];

    if (format === 'text') {
      const textOutput = quote.content + (quote.source ? `\n—— ${quote.source}` : '');
      return sendText(res, 200, textOutput);
    }

    return sendJson(res, 200, {
      code: 200,
      data: quote,
      meta: {
        totalMatched: pool.length,
        categoryMeta: CATEGORY_META[quote.category] || null
      }
    });
  }

  if (pathname === '/api/quotes') {
    const category = searchParams.get('category');
    const lang = searchParams.get('lang');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    let results = quotesCache;
    if (category) {
      results = results.filter(q => q.category === category);
    }
    if (lang) {
      results = results.filter(q => q.language === lang);
    }
    if (search) {
      const term = search.toLowerCase();
      results = results.filter(q =>
        q.content.toLowerCase().includes(term) ||
        (q.source && q.source.toLowerCase().includes(term)) ||
        (q.tags && q.tags.some(t => t.toLowerCase().includes(term)))
      );
    }

    const total = results.length;
    const startIndex = (page - 1) * limit;
    const items = results.slice(startIndex, startIndex + limit);

    return sendJson(res, 200, {
      code: 200,
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  }

  if (pathname === '/api/categories') {
    const counts = {};
    for (const q of quotesCache) {
      counts[q.category] = (counts[q.category] || 0) + 1;
    }

    const categories = Object.keys(CATEGORY_META).map(key => ({
      id: key,
      ...CATEGORY_META[key],
      count: counts[key] || 0
    }));

    return sendJson(res, 200, {
      code: 200,
      data: categories
    });
  }

  if (pathname === '/api/stats') {
    const byCategory = {};
    const byLanguage = {};
    const allTags = new Set();

    for (const q of quotesCache) {
      byCategory[q.category] = (byCategory[q.category] || 0) + 1;
      byLanguage[q.language] = (byLanguage[q.language] || 0) + 1;
      if (Array.isArray(q.tags)) {
        q.tags.forEach(t => allTags.add(t));
      }
    }

    return sendJson(res, 200, {
      code: 200,
      data: {
        totalQuotes: quotesCache.length,
        totalCategories: Object.keys(byCategory).length,
        totalTags: allTags.size,
        byCategory,
        byLanguage,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }
    });
  }

  if (pathname === '/api/dedupe' && req.method === 'POST') {
    try {
      const result = runDeduplication();
      loadQuotes();
      return sendJson(res, 200, {
        code: 200,
        message: '去重合并完成并已热更新缓存',
        data: result
      });
    } catch (err) {
      return sendJson(res, 500, { code: 500, error: err.message });
    }
  }

  // 其他非 /api 路由转入静态资源服务
  serveStatic(req, res, pathname);
});

// 监听端口，具备端口占用自动递增机制
function startServer(port) {
  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`   Geek Quote API 服务已就绪 (原生轻量 Node.js 全栈)`);
    console.log(`   - 网页测试面板:   http://localhost:${port}`);
    console.log(`   - 随机文案接口:   http://localhost:${port}/api/random`);
    console.log(`   - 列表检索接口:   http://localhost:${port}/api/quotes`);
    console.log(`   - 分类统计接口:   http://localhost:${port}/api/categories`);
    console.log(`   - 统计信息接口:   http://localhost:${port}/api/stats`);
    console.log(`======================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] 端口 ${port} 已被占用，正在尝试端口 ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[Server] 启动失败:', err);
    }
  });
}

// 初始化启动
loadQuotes();
startServer(DEFAULT_PORT);
