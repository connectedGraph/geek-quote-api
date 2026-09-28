import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PENDING_FILE = path.resolve(__dirname, '../quotes_pending_translate.json');
const BILINGUAL_FILE = path.resolve(__dirname, '../../data/quotes_bilingual.json');

const API_BASE = 'http://localhost:8081/v1/chat/completions';
const API_KEY = 'sk-gemini-local';
const MODEL = 'gemini-flash-lite';

// 速率与批次控制: 20 RPM (每 3100ms 调度 1 次), 单批 6 条
const INTERVAL_MS = 3100;
const BATCH_SIZE = 6;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseXmlTranslations(xmlText) {
  const result = new Map();
  if (!xmlText) return result;

  const itemRegex = /<item\s+id="([^"]+)">([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const id = match[1].trim();
    const trans = match[2].trim();
    if (id && trans) {
      result.set(id, trans);
    }
  }
  return result;
}

async function callBatchApi(items, retries = 4) {
  const quotesXml = items.map(it => `<quote id="${it.id}">${it.content}</quote>`).join('\n');
  const prompt = `Translate the following English STEM, math, logic, AI, and geek quotes into witty, natural, authentic Chinese geek humor for university STEM students.
Output ONLY an XML block in this exact structure:
<translations>
${items.map(it => `  <item id="${it.id}">中文翻译</item>`).join('\n')}
</translations>

Quotes to translate:
${quotesXml}`;

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
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const map = parseXmlTranslations(content);

      if (map.size > 0) {
        return map;
      }
      throw new Error(`XML 解析未提取到有效 item 节点: ${content.slice(0, 150)}`);
    } catch (err) {
      console.warn(`[Batch API] 批次重试 (${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(2500 * attempt);
    }
  }
}

export async function runBatchTranslation() {
  console.log('[Batch Translator] 启动理科双语批量翻译引擎...');

  if (!fs.existsSync(PENDING_FILE)) {
    console.error('未找到待翻译文件:', PENDING_FILE);
    return;
  }

  const pendingItems = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
  console.log(`- 待处理候选总量: ${pendingItems.length} 条`);

  // 加载已有双语库
  let existingBilingual = [];
  const completedMap = new Map();
  if (fs.existsSync(BILINGUAL_FILE)) {
    existingBilingual = JSON.parse(fs.readFileSync(BILINGUAL_FILE, 'utf-8'));
    for (const item of existingBilingual) {
      if (item.content_zh && item.content_en) {
        completedMap.set(item.id, item);
      }
    }
  }
  console.log(`- 已有双语库总量: ${completedMap.size} 条`);

  const uncompleted = pendingItems.filter(item => !completedMap.has(item.id));
  console.log(`- 实际仍需翻译: ${uncompleted.length} 条`);

  if (uncompleted.length === 0) {
    console.log('[Batch Translator] 所有条目均已双语就绪！');
    return;
  }

  // 切割为批次
  const batches = [];
  for (let i = 0; i < uncompleted.length; i += BATCH_SIZE) {
    batches.push(uncompleted.slice(i, i + BATCH_SIZE));
  }
  console.log(`- 共划分为 ${batches.length} 个批次 (单批 ${BATCH_SIZE} 条)`);

  let nextDispatchTime = Date.now();
  async function waitForRateLimit() {
    const now = Date.now();
    if (now < nextDispatchTime) {
      const wait = nextDispatchTime - now;
      nextDispatchTime += INTERVAL_MS;
      await sleep(wait);
    } else {
      nextDispatchTime = now + INTERVAL_MS;
    }
  }

  let successCount = 0;
  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx];
    await waitForRateLimit();

    const progressStr = `[${bIdx + 1}/${batches.length}]`;
    console.log(`[Batch ${progressStr}] 正在翻译批次 (${batch.length} 条)...`);

    try {
      const transMap = await callBatchApi(batch);
      for (const item of batch) {
        const zh = transMap.get(item.id) || item.content; // 若单条漏标则降级
        const bilingualItem = {
          ...item,
          content_zh: zh,
          content_en: item.content
        };
        completedMap.set(item.id, bilingualItem);
        successCount++;
      }

      // 实时断点写入持久化文件
      const fullList = Array.from(completedMap.values());
      fs.writeFileSync(BILINGUAL_FILE, JSON.stringify(fullList, null, 2), 'utf-8');
      console.log(`[Batch ${progressStr}] 成功写入，当前双语库总量: ${fullList.length} 条`);
    } catch (err) {
      console.error(`[Batch ${progressStr}] 批次处理失败: ${err.message}，跳过此批后续继续`);
    }
  }

  console.log('\n===== [翻译任务全部完成] =====');
  console.log(`- 新增翻译成功: ${successCount} 条`);
  console.log(`- 双语库最新总量: ${completedMap.size} 条`);
  console.log(`- 输出文件: ${BILINGUAL_FILE}`);
  console.log('==============================\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBatchTranslation().catch(err => console.error('运行异常:', err));
}
