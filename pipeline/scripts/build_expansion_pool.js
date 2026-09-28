import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXISTING_BILINGUAL = path.resolve(__dirname, '../../data/quotes_bilingual.json');
const EXPANDED_CANDIDATES = path.resolve(__dirname, '../quotes_expanded_candidates.json');
const MODERN_SEED = path.resolve(__dirname, '../raw_sources/modern_ai_math_seed.json');

const OUTPUT_ALL_POOL = path.resolve(__dirname, '../quotes_all_pool.json');
const OUTPUT_PENDING_TRANSLATE = path.resolve(__dirname, '../quotes_pending_translate.json');

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\s\r\n\t\u3000]+/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'，。！？、“”‘’：；（）《》【】]/g, '');
}

function calculateSimilarity(strA, strB) {
  if (strA === strB) return 1.0;
  if (!strA || !strB) return 0.0;
  const getGrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const gA = getGrams(strA);
  const gB = getGrams(strB);
  if (gA.size === 0 || gB.size === 0) return 0;
  let inter = 0;
  for (const g of gA) if (gB.has(g)) inter++;
  return inter / (gA.size + gB.size - inter);
}

export function buildExpansionPool() {
  console.log('[Pool Builder] 启动语料扩容组装...');

  // 1. 加载已有 108 条双语数据
  const existingBilingual = JSON.parse(fs.readFileSync(EXISTING_BILINGUAL, 'utf-8'));
  console.log(`- 已有双语基底数据: ${existingBilingual.length} 条`);

  const seenNorms = new Map(); // normText -> item
  for (const item of existingBilingual) {
    const norm = normalizeText(item.content_en || item.content);
    seenNorms.set(norm, item);
  }

  // 2. 加载现代 AI / 数学增强种子
  const modernSeeds = JSON.parse(fs.readFileSync(MODERN_SEED, 'utf-8'));
  console.log(`- 加载现代 AI / 数理前沿种子: ${modernSeeds.length} 条`);

  // 3. 加载从 fortune & geek jokes 清洗出的候选池
  const candidates = JSON.parse(fs.readFileSync(EXPANDED_CANDIDATES, 'utf-8'));
  console.log(`- 原始候选池总量: ${candidates.length} 条`);

  // 合并待选池
  const allCandidates = [...modernSeeds, ...candidates];

  const addedItems = [];

  // 按分类配额目标进行优先甄选
  // 目标总数 ~530 条:
  // 已有 108 (ai_ml: 29, cs_geek: 28, math_logic: 29, physics_stem: 22)
  // 计划新增: ai_ml: ~45, math_logic: ~75, physics_stem: ~100, cs_geek: ~200
  const categoryLimits = {
    ai_ml: 60,
    math_logic: 90,
    physics_stem: 110,
    cs_geek: 210
  };

  const currentAddedCategoryCounts = {
    ai_ml: 0,
    math_logic: 0,
    physics_stem: 0,
    cs_geek: 0
  };

  for (const cand of allCandidates) {
    const cat = cand.category || 'cs_geek';
    if ((currentAddedCategoryCounts[cat] || 0) >= (categoryLimits[cat] || 150)) {
      continue;
    }

    const norm = normalizeText(cand.content);
    if (norm.length < 15) continue;

    // 精确去重
    if (seenNorms.has(norm)) continue;

    // 模糊去重
    let isFuzzyDuplicate = false;
    for (const [existingNorm] of seenNorms.entries()) {
      if (Math.abs(norm.length - existingNorm.length) / Math.max(norm.length, existingNorm.length) < 0.4) {
        if (calculateSimilarity(norm, existingNorm) >= 0.82) {
          isFuzzyDuplicate = true;
          break;
        }
      }
    }
    if (isFuzzyDuplicate) continue;

    const hash = crypto.createHash('sha256').update(norm).digest('hex').slice(0, 10);
    const cleanItem = {
      id: `stem_${hash}`,
      content: cand.content.trim(),
      category: cat,
      tags: cand.tags || ['STEM'],
      language: cand.language || 'en',
      source: cand.source || 'expansion'
    };

    seenNorms.set(norm, cleanItem);
    addedItems.push(cleanItem);
    currentAddedCategoryCounts[cat] = (currentAddedCategoryCounts[cat] || 0) + 1;
  }

  console.log(`- 成功新增筛选出高品质理工条目: ${addedItems.length} 条`);
  console.log('- 新增类别分布:', currentAddedCategoryCounts);

  const totalPoolSize = existingBilingual.length + addedItems.length;
  console.log(`- 合计总库规模: ${totalPoolSize} 条！`);

  // 保存待翻译文件
  fs.writeFileSync(OUTPUT_PENDING_TRANSLATE, JSON.stringify(addedItems, null, 2), 'utf-8');
  console.log(`- 待批量翻译任务集已保存至: ${OUTPUT_PENDING_TRANSLATE}`);

  return { addedItems, totalPoolSize };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildExpansionPool();
}
