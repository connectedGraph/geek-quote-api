/**
 * 零依赖 Node.js 脚本：利用 Node 原生内置 node:sqlite 直接读取 geek_quotes.db
 */
import { DatabaseSync } from 'node:sqlite';

export function getRandomQuote(dbPath = 'portable/geek_quotes.db', category = null) {
  const db = new DatabaseSync(dbPath);
  
  let stmt;
  if (category) {
    stmt = db.prepare('SELECT id, content_zh, content_en, category, tags FROM quotes WHERE category = ? ORDER BY RANDOM() LIMIT 1');
    const row = stmt.get(category);
    db.close();
    return row ? { ...row, tags: JSON.parse(row.tags) } : null;
  } else {
    stmt = db.prepare('SELECT id, content_zh, content_en, category, tags FROM quotes ORDER BY RANDOM() LIMIT 1');
    const row = stmt.get();
    db.close();
    return row ? { ...row, tags: JSON.parse(row.tags) } : null;
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname || process.argv[1].endsWith('sqlite_direct.js')) {
  const quote = getRandomQuote('portable/geek_quotes.db', 'math_logic');
  console.log('[数理逻辑 随机梗]');
  console.log('ZH:', quote.content_zh);
  console.log('EN:', quote.content_en);
}
