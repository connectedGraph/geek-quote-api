import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.resolve(__dirname, '../../data/quotes.json');
const OUTPUT_FILE = path.resolve(__dirname, '../../data/quotes_bilingual.json');

const API_BASE = 'http://localhost:8081/v1/chat/completions';
const API_KEY = 'sk-gemini-local';
const MODEL = 'gemini-flash-lite';

// 速率配置：20 RPM (每 3100ms 调度一次), 并发设为 2 保护 web2api 单会话稳定性
const INTERVAL_MS = 3100;
const MAX_CONCURRENCY = 2;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractTranslation(text) {
  if (!text) return '';
  const match = text.match(/<translation>([\s\S]*?)<\/translation>/i);
  if (match) {
    return match[1].trim();
  }
  const tagStart = text.indexOf('<translation>');
  if (tagStart !== -1) {
    return text.substring(tagStart + 13).replace(/<\/?[^>]+(>|$)/g, '').trim();
  }
  return text.trim();
}

async function callTranslateApi(text, targetLang, retries = 5) {
  const isTargetEn = targetLang === 'en';
  const systemPrompt = isTargetEn
    ? 'You are a translation tool for STEM, math logic, AI, and geek quotes. Translate the given Chinese quote into witty, natural, authentic geek English. Output ONLY the translated text inside <translation>...</translation>. Absolutely nothing else.'
    : 'You are a translation tool for STEM, math logic, AI, and geek quotes. Translate the given English quote into witty, natural, authentic Chinese geek humor. Output ONLY the translated text inside <translation>...</translation>. Absolutely nothing else.';

  const userPrompt = isTargetEn
    ? `Translate this Chinese geek quote into witty English:\n${text}`
    : `Translate this English geek quote into witty, natural Chinese:\n${text}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content || '';
      const translated = extractTranslation(rawContent);

      if (translated) {
        return translated;
      }
      throw new Error(`未成功提取到 <translation> 标签: ${rawContent.slice(0, 100)}`);
    } catch (err) {
      console.warn(`[Translate] 重试第 ${attempt}/${retries} 次: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(2000 * attempt);
    }
  }
}

async function main() {
  console.log('[Translate] 启动双语翻译引擎...');
  console.log(`- 目标模型: ${MODEL}`);
  console.log(`- 速率限制: 20 RPM (每 ${INTERVAL_MS}ms 调度 1 次), 最大并发槽位: ${MAX_CONCURRENCY}`);

  if (!fs.existsSync(INPUT_FILE)) {
    console.error('输入文件不存在:', INPUT_FILE);
    process.exit(1);
  }

  const rawQuotes = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`- 原始数据总量: ${rawQuotes.length} 条`);

  // 加载已有双语进度
  const bilingualMap = new Map();
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      for (const item of existing) {
        if (item.content_zh && item.content_en) {
          bilingualMap.set(item.id, item);
        }
      }
      console.log(`- 发现已有断点进度: ${bilingualMap.size} 条已具备双语`);
    } catch (e) {
      console.warn('读取已有进度失败，将从头开始');
    }
  }

  const pending = rawQuotes.filter(q => !bilingualMap.has(q.id));
  console.log(`- 本次待翻译条目: ${pending.length} 条`);

  if (pending.length === 0) {
    console.log('[Translate] 所有条目均已具备中英双语！');
    return;
  }

  const saveProgress = () => {
    const allItems = rawQuotes.map(q => {
      const b = bilingualMap.get(q.id);
      if (b) return b;
      return {
        ...q,
        content_zh: q.language === 'zh' ? q.content : '',
        content_en: q.language === 'en' ? q.content : ''
      };
    });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allItems, null, 2), 'utf-8');
  };

  let nextDispatchTime = Date.now();
  async function waitForNextSlot() {
    const now = Date.now();
    if (now < nextDispatchTime) {
      const delay = nextDispatchTime - now;
      nextDispatchTime += INTERVAL_MS;
      await sleep(delay);
    } else {
      nextDispatchTime = now + INTERVAL_MS;
    }
  }

  let completed = 0;
  const total = pending.length;

  // 使用异步工作者池
  let queueIndex = 0;
  async function worker(workerId) {
    while (queueIndex < pending.length) {
      const itemIndex = queueIndex++;
      if (itemIndex >= pending.length) break;
      const item = pending[itemIndex];

      // 排队等待发号器许可（确保 20 RPM 限制）
      await waitForNextSlot();

      const isZh = item.language === 'zh';
      const targetLang = isZh ? 'en' : 'zh';
      console.log(`[Worker ${workerId} (${completed + 1}/${total})] 翻译 [${item.id}] (${item.category}) -> ${targetLang}`);

      try {
        const translated = await callTranslateApi(item.content, targetLang);
        const bilingualItem = {
          ...item,
          content_zh: isZh ? item.content : translated,
          content_en: isZh ? translated : item.content,
          source_zh: item.source || '',
          source_en: item.source || ''
        };
        bilingualMap.set(item.id, bilingualItem);
        completed++;
        saveProgress();
        console.log(`  ✓ [Worker ${workerId}] 完成 [${item.id}]: ${translated.slice(0, 35)}...`);
      } catch (err) {
        console.error(`  ✗ [Worker ${workerId}] 失败 [${item.id}]: ${err.message}`);
      }
    }
  }

  const workers = [];
  for (let i = 1; i <= MAX_CONCURRENCY; i++) {
    workers.push(worker(i));
  }

  await Promise.all(workers);
  saveProgress();

  console.log(`\n===== [Translate 全部完成] =====`);
  console.log(`- 成功双语化条目: ${bilingualMap.size} 条`);
  console.log(`- 输出保存至: ${OUTPUT_FILE}`);
  console.log(`================================\n`);
}

main().catch(err => {
  console.error('[Translate Fatal]:', err);
  process.exit(1);
});
