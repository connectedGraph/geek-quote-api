import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_FILE = path.resolve(
  process.env.GEEK_QUOTES_FILE || path.join(__dirname, 'data', 'quotes_bilingual.json')
);
export const PUBLIC_DIR = path.join(__dirname, 'public');

export const CATEGORY_META = {
  math_logic: { name_zh: '数理逻辑与纯数', name_en: 'Math & Logic', icon: '∑' },
  ai_ml: { name_zh: '机器学习与 AI 炼丹', name_en: 'AI & Machine Learning', icon: '∇' },
  cs_geek: { name_zh: '计算机体系与算法极客', name_en: 'CS & Geek Culture', icon: '⌘' },
  physics_stem: { name_zh: '理论物理与大学理科', name_en: 'Physics & STEM Life', icon: '⚛' },
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

let quotesCache = [];
const startedAt = Date.now();

function normalizeQuote(item) {
  const language = item.language === 'zh' || item.language === 'en' ? item.language : '';
  const content = typeof item.content === 'string' ? item.content : '';
  const source = typeof item.source === 'string' ? item.source : '';

  return {
    id: String(item.id || ''),
    content_zh: String(item.content_zh || (language === 'zh' ? content : '')),
    content_en: String(item.content_en || (language === 'en' ? content : '')),
    category: String(item.category || 'general'),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    source_zh: String(item.source_zh || source),
    source_en: String(item.source_en || source),
  };
}

export function loadQuotes(dataFile = DATA_FILE) {
  const raw = fs.readFileSync(dataFile, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Quote data must be an array: ${dataFile}`);
  }

  quotesCache = parsed.map(normalizeQuote).filter((quote) => quote.id);
  return quotesCache.length;
}

function normalizeLanguage(value) {
  return ['zh', 'en', 'both'].includes(value) ? value : 'both';
}

function matchesLanguage(quote, language) {
  if (language === 'zh') return Boolean(quote.content_zh);
  if (language === 'en') return Boolean(quote.content_en);
  return Boolean(quote.content_zh && quote.content_en);
}

function parsePositiveInt(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function filterQuotes({ category, tag, lang = 'both', search } = {}) {
  const language = normalizeLanguage(lang);
  const term = search ? search.toLowerCase() : '';
  const normalizedTag = tag ? tag.toLowerCase() : '';

  return quotesCache.filter((quote) => {
    if (category && quote.category !== category) return false;
    if (!matchesLanguage(quote, language)) return false;
    if (normalizedTag && !quote.tags.some((item) => item.toLowerCase() === normalizedTag)) {
      return false;
    }
    if (term) {
      const haystack = [
        quote.content_zh,
        quote.content_en,
        quote.source_zh,
        quote.source_en,
        ...quote.tags,
      ]
        .join('\n')
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

function quoteAsText(quote, lang) {
  if (lang === 'zh') return `${quote.content_zh}\n—— ${quote.source_zh}`.trim();
  if (lang === 'en') return `${quote.content_en}\n—— ${quote.source_en}`.trim();
  return `${quote.content_zh}\n${quote.content_en}\n—— ${quote.source_zh} / ${quote.source_en}`.trim();
}

function setCommonHeaders(res, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, body) {
  setCommonHeaders(res, 'application/json; charset=utf-8');
  res.writeHead(statusCode);
  res.end(JSON.stringify(body, null, 2));
}

function sendText(res, statusCode, body) {
  setCommonHeaders(res, 'text/plain; charset=utf-8');
  res.writeHead(statusCode);
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { code: statusCode, message });
}

function safeStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const requested = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.resolve(PUBLIC_DIR, `.${requested}`);
  const relative = path.relative(PUBLIC_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendError(res, 405, 'Method Not Allowed');
  }

  const requestedPath = safeStaticPath(pathname);
  if (!requestedPath) return sendError(res, 403, 'Forbidden');

  let filePath = requestedPath;
  try {
    if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    const stat = fs.statSync(filePath);
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  } catch {
    sendError(res, 404, 'File Not Found');
  }
}

function getStats() {
  const byCategory = {};
  const byLanguage = { zh: 0, en: 0 };
  const allTags = new Set();

  for (const quote of quotesCache) {
    byCategory[quote.category] = (byCategory[quote.category] || 0) + 1;
    if (quote.content_zh) byLanguage.zh += 1;
    if (quote.content_en) byLanguage.en += 1;
    for (const tag of quote.tags) allTags.add(tag);
  }

  return {
    total_quotes: quotesCache.length,
    total_categories: Object.keys(byCategory).length,
    total_tags: allTags.size,
    by_category: byCategory,
    by_language: byLanguage,
    database_engine: 'JSON (in-memory)',
    server: 'Node.js (stdlib)',
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
  };
}

export function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(req.url || '/', 'http://localhost');
    } catch {
      return sendError(res, 400, 'Bad Request');
    }

    const { pathname, searchParams } = parsedUrl;

    if (pathname === '/health') {
      if (req.method !== 'GET') return sendError(res, 405, 'Method Not Allowed');
      return sendText(res, 200, 'OK');
    }

    if (pathname === '/api/random') {
      if (req.method !== 'GET') return sendError(res, 405, 'Method Not Allowed');
      const lang = normalizeLanguage(searchParams.get('lang'));
      const pool = filterQuotes({
        category: searchParams.get('category'),
        tag: searchParams.get('tag'),
        lang,
      });
      if (pool.length === 0) {
        return sendJson(res, 404, {
          code: 404,
          message: '未找到符合条件的文案',
          filters: {
            category: searchParams.get('category'),
            lang: searchParams.get('lang'),
            tag: searchParams.get('tag'),
          },
        });
      }

      const quote = pool[Math.floor(Math.random() * pool.length)];
      if ((searchParams.get('format') || 'json').toLowerCase() === 'text') {
        return sendText(res, 200, quoteAsText(quote, lang));
      }
      return sendJson(res, 200, {
        code: 200,
        data: quote,
        meta: {
          total_matched: pool.length,
          category_meta: CATEGORY_META[quote.category] || null,
        },
      });
    }

    if (pathname === '/api/quotes') {
      if (req.method !== 'GET') return sendError(res, 405, 'Method Not Allowed');
      const page = parsePositiveInt(searchParams.get('page'), 1);
      const limit = parsePositiveInt(searchParams.get('limit'), 20, 100);
      const results = filterQuotes({
        category: searchParams.get('category'),
        lang: searchParams.get('lang') || 'both',
        search: searchParams.get('search'),
      });
      const start = (page - 1) * limit;
      const total = results.length;
      return sendJson(res, 200, {
        code: 200,
        data: {
          items: results.slice(start, start + limit),
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      });
    }

    if (pathname === '/api/categories') {
      if (req.method !== 'GET') return sendError(res, 405, 'Method Not Allowed');
      const counts = Object.fromEntries(Object.keys(CATEGORY_META).map((key) => [key, 0]));
      for (const quote of quotesCache) counts[quote.category] = (counts[quote.category] || 0) + 1;
      const categories = Object.entries(CATEGORY_META).map(([id, meta]) => ({
        id,
        ...meta,
        count: counts[id] || 0,
      }));
      return sendJson(res, 200, { code: 200, data: categories });
    }

    if (pathname === '/api/stats') {
      if (req.method !== 'GET') return sendError(res, 405, 'Method Not Allowed');
      return sendJson(res, 200, {
        code: 200,
        data: { ...getStats(), timestamp: new Date().toISOString() },
      });
    }

    if (pathname === '/api/reload') {
      if (req.method !== 'POST') return sendError(res, 405, 'Method Not Allowed');
      try {
        const count = loadQuotes();
        return sendJson(res, 200, {
          code: 200,
          message: '数据已重新加载',
          data: { total_quotes: count },
        });
      } catch (error) {
        return sendJson(res, 500, { code: 500, error: error.message });
      }
    }

    if (pathname.startsWith('/api/')) return sendError(res, 404, 'API route not found');
    return serveStatic(req, res, pathname);
  });
}

export function startServer({ host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 3000) } = {}) {
  loadQuotes();
  const server = createServer();
  server.listen(port, host, () => {
    const actualPort = server.address().port;
    console.log(`Geek Quote API (Node.js) listening on http://${host}:${actualPort}`);
    console.log(`Loaded ${quotesCache.length} bilingual quotes from ${DATA_FILE}`);
  });
  return server;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    startServer();
  } catch (error) {
    console.error(`[Node Server] Failed to start: ${error.message}`);
    process.exitCode = 1;
  }
}
