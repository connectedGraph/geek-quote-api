import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DIR = path.resolve(__dirname, '../data/raw_sources');
const OUTPUT_FILE = path.resolve(__dirname, '../data/quotes.json');

/**
 * 文本标准化：去除前后空白、统一空白字符、去除所有标点用于查重对比
 */
function normalizeForComparison(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\s\r\n\t\u3000]+/g, '') // 去除所有空白
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'，。！？、“”‘’：；（）《》【】]/g, ''); // 去除常见中英文标点
}

/**
 * 计算两个文本的字符 2-gram Jaccard 相似度与包含度（模糊查重）
 */
function calculateSimilarity(strA, strB) {
  if (strA === strB) return { jaccard: 1.0, containment: 1.0 };
  if (!strA || !strB) return { jaccard: 0.0, containment: 0.0 };
  
  const getGrams = (s) => {
    const grams = new Set();
    for (let i = 0; i < s.length - 1; i++) {
      grams.add(s.slice(i, i + 2));
    }
    return grams;
  };

  const gramsA = getGrams(strA);
  const gramsB = getGrams(strB);
  if (gramsA.size === 0 || gramsB.size === 0) return { jaccard: 0, containment: 0 };

  let intersection = 0;
  for (const g of gramsA) {
    if (gramsB.has(g)) intersection++;
  }
  const union = gramsA.size + gramsB.size - intersection;
  const minSize = Math.min(gramsA.size, gramsB.size);
  return {
    jaccard: union === 0 ? 0 : intersection / union,
    containment: minSize === 0 ? 0 : intersection / minSize
  };
}

export function runDeduplication() {
  console.log('[Deduplication] 开始扫描原始数据源目录:', RAW_DIR);
  
  if (!fs.existsSync(RAW_DIR)) {
    console.error('原始目录不存在:', RAW_DIR);
    return;
  }

  const rawFiles = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));
  console.log(`[Deduplication] 发现 ${rawFiles.length} 个原始数据源文件:`, rawFiles);

  const rawItems = [];
  for (const file of rawFiles) {
    const filePath = path.join(RAW_DIR, file);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(content)) {
        for (const item of content) {
          rawItems.push({ ...item, _source_file: file });
        }
      }
    } catch (err) {
      console.error(`读取文件 ${file} 失败:`, err.message);
    }
  }

  console.log(`[Deduplication] 共加载原始数据条目: ${rawItems.length} 条`);

  const seenExact = new Map(); // normalizedText -> item
  const deduplicated = [];
  const duplicatesFound = [];

  for (const item of rawItems) {
    const textToCompare = normalizeForComparison(
      (item.content || '') + (item.punchline ? item.punchline : '')
    );

    if (!textToCompare) continue;

    // 1. 精确查重
    if (seenExact.has(textToCompare)) {
      duplicatesFound.push({
        type: 'exact',
        original: seenExact.get(textToCompare).content,
        duplicate: item.content,
        source: item._source_file
      });
      continue;
    }

    // 2. 模糊查重 (Jaccard >= 0.85 或 包含度 >= 0.90 且长度比 >= 0.6)
    let isFuzzyDuplicate = false;
    for (const [existingNorm, existingItem] of seenExact.entries()) {
      const { jaccard, containment } = calculateSimilarity(textToCompare, existingNorm);
      const lenRatio = Math.min(textToCompare.length, existingNorm.length) / Math.max(textToCompare.length, existingNorm.length);
      
      if (jaccard >= 0.85 || (containment >= 0.90 && lenRatio >= 0.55)) {
        isFuzzyDuplicate = true;
        duplicatesFound.push({
          type: 'fuzzy',
          jaccard: jaccard.toFixed(2),
          containment: containment.toFixed(2),
          original: existingItem.content,
          duplicate: item.content,
          source: item._source_file
        });
        break;
      }
    }

    if (isFuzzyDuplicate) continue;

    // 生成唯一确定性 ID (内容 SHA256 前 10 位)
    const hash = crypto.createHash('sha256').update(textToCompare).digest('hex').slice(0, 10);
    const cleanItem = {
      id: `stem_${hash}`,
      content: item.content.trim(),
      ...(item.punchline ? { punchline: item.punchline.trim() } : {}),
      category: item.category || 'general',
      tags: Array.isArray(item.tags) ? item.tags : [],
      language: item.language || (/[\\u4e00-\\u9fa5]/.test(item.content) ? 'zh' : 'en'),
      source: item.source || item._source_file.replace('.json', '')
    };

    seenExact.set(textToCompare, cleanItem);
    deduplicated.push(cleanItem);
  }

  // 排序：按类别与语言排序
  deduplicated.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.language.localeCompare(b.language);
  });

  // 写入输出文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(deduplicated, null, 2), 'utf-8');

  // 统计结果
  const stats = {
    totalRaw: rawItems.length,
    totalDeduplicated: deduplicated.length,
    duplicatesRemoved: duplicatesFound.length,
    byCategory: {},
    byLanguage: {}
  };

  for (const item of deduplicated) {
    stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
    stats.byLanguage[item.language] = (stats.byLanguage[item.language] || 0) + 1;
  }

  console.log('\n===== [Deduplication 统计报告] =====');
  console.log(`- 原始数据总量: ${stats.totalRaw}`);
  console.log(`- 查重过滤条数: ${stats.duplicatesRemoved}`);
  console.log(`- 最终入库条数: ${stats.totalDeduplicated}`);
  console.log('- 类别分布:', JSON.stringify(stats.byCategory, null, 2));
  console.log('- 语言分布:', JSON.stringify(stats.byLanguage, null, 2));
  console.log(`- 输出文件已保存至: ${OUTPUT_FILE}`);
  console.log('====================================\n');

  return { stats, duplicatesFound };
}

// 直接以命令行运行时执行
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDeduplication();
}
