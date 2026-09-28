import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DIR = path.resolve(__dirname, '../raw_sources');
const OUTPUT_EXPANDED = path.resolve(__dirname, '../quotes_expanded_candidates.json');

// 分类打标规则关键词库
const CATEGORY_RULES = [
  {
    category: 'ai_ml',
    tags: ['AI', 'MachineLearning', 'NeuralNetwork'],
    keywords: [
      'artificial intelligence', 'machine learning', 'deep learning', 'neural net', 'gradient',
      'backpropagation', 'transformer', 'hallucinat', 'gpt', 'llm', 'overfit', 'underfit',
      'training data', 'epoch', 'reinforcement learning', 'weights', 'loss function',
      'robot', 'turing test', 'singularity', 'perceptron', 'generative ai', 'autonomous'
    ]
  },
  {
    category: 'math_logic',
    tags: ['Math', 'Logic', 'Theory'],
    keywords: [
      'mathematic', 'logician', 'logic', 'theorem', 'proof', 'axiom', 'godel', 'gödel',
      'infinity', 'calculus', 'algebra', 'topology', 'prime', 'fermat', 'euler', 'hilbert',
      'pythagor', 'fibonacci', 'matrix', 'derivative', 'integral', 'paradox', 'qed',
      'fractal', 'mandelbrot', 'probability', 'statistician', 'bayes', 'dimension', 'continuous',
      'riemann', 'hypotenuse', 'polynomial', 'discrete', 'induction', 'contradiction'
    ]
  },
  {
    category: 'physics_stem',
    tags: ['Physics', 'Quantum', 'STEM'],
    keywords: [
      'physics', 'physicist', 'quantum', 'schrodinger', 'schrödinger', 'heisenberg',
      'relativity', 'einstein', 'entropy', 'thermodynamic', 'speed of light', 'electron',
      'proton', 'neutron', 'gravity', 'black hole', 'fermion', 'boson', 'friction',
      'wavelength', 'photon', 'chemistry', 'chemist', 'molecule', 'atom', 'periodic table',
      'biology', 'biologist', 'genetics', 'dna', 'rna', 'evolution', 'astronomy'
    ]
  },
  {
    category: 'cs_geek',
    tags: ['ComputerScience', 'Programming', 'Hacker'],
    keywords: [
      'algorithm', 'programmer', 'programming', 'software', 'hardware', 'compiler', 'compile',
      'debug', 'bug', 'linux', 'unix', 'c++', 'python', 'rust', 'git', 'binary', 'byte',
      'bit', 'pointer', 'null', 'segfault', 'stack overflow', 'heap', 'recursion', 'cache',
      'complexity', 'o(n)', 'lisp', 'emacs', 'vim', 'database', 'sql', 'tcp', 'ip',
      'kernel', 'operating system', 'boolean', 'loop', 'code', 'syntax', 'function'
    ]
  }
];

function classifyText(text) {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        return { category: rule.category, tags: rule.tags };
      }
    }
  }
  return null;
}

function parseFortune(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n%\n')
    .map(s => s.trim())
    .filter(s => {
      // 长度在 25 到 320 字符之间，去掉太短碎片和太长的故事
      if (s.length < 25 || s.length > 320) return false;
      // 排除全是纯符号、ASCII艺术或代码宏定义碎片
      if (s.split('\n').some(line => line.startsWith('#define') || line.startsWith('/*'))) return false;
      if (s.includes('http://') || s.includes('https://')) return false;
      if (/^[\W\d_]+$/.test(s)) return false;
      return true;
    });
}

export function generateExpandedCandidates() {
  console.log('[Corpus Expansion] 开始从原始语料库抽取与清洗理科段子...');

  const candidates = [];
  const seenTexts = new Set();

  const addCandidate = (rawText, sourceName, forcedCategory = null) => {
    // 整理空白字符
    const cleanText = rawText
      .replace(/[\r\t]+/g, ' ')
      .replace(/\n\s*--\s*/g, ' — ') // 整理引用作者行
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanText.length < 20 || cleanText.length > 350) return;

    // 简单查重
    const norm = cleanText.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
    if (seenTexts.has(norm)) return;
    seenTexts.add(norm);

    let classification = classifyText(cleanText);
    if (!classification && forcedCategory) {
      const rule = CATEGORY_RULES.find(r => r.category === forcedCategory);
      classification = { category: forcedCategory, tags: rule ? rule.tags : ['STEM'] };
    }

    if (!classification) return; // 无法归类到理科体系的丢弃

    candidates.push({
      content: cleanText,
      category: classification.category,
      tags: classification.tags,
      language: /[\\u4e00-\\u9fa5]/.test(cleanText) ? 'zh' : 'en',
      source: sourceName
    });
  };

  // 1. 处理 fortune_science.txt
  const sciFile = path.join(RAW_DIR, 'fortune_science.txt');
  const sciEntries = parseFortune(sciFile);
  console.log(`[Source] fortune_science 候选行数: ${sciEntries.length}`);
  for (const item of sciEntries) {
    addCandidate(item, 'fortune_science', 'physics_stem');
  }

  // 2. 处理 fortune_computers.txt
  const compFile = path.join(RAW_DIR, 'fortune_computers.txt');
  const compEntries = parseFortune(compFile);
  console.log(`[Source] fortune_computers 候选行数: ${compEntries.length}`);
  for (const item of compEntries) {
    addCandidate(item, 'fortune_computers', 'cs_geek');
  }

  // 3. 处理 geek_jokes_raw.json
  const geekFile = path.join(RAW_DIR, 'geek_jokes_raw.json');
  if (fs.existsSync(geekFile)) {
    try {
      const geekEntries = JSON.parse(fs.readFileSync(geekFile, 'utf-8'));
      console.log(`[Source] geek_jokes_raw 条数: ${geekEntries.length}`);
      for (const item of geekEntries) {
        addCandidate(item, 'geek_joke_api', 'cs_geek');
      }
    } catch (e) {
      console.warn('读取 geek_jokes_raw 失败:', e.message);
    }
  }

  console.log(`[Corpus Expansion] 筛选归类完成，共获取高信噪比理工条目: ${candidates.length} 条`);

  const categoryStats = {};
  for (const c of candidates) {
    categoryStats[c.category] = (categoryStats[c.category] || 0) + 1;
  }
  console.log('[Corpus Expansion] 类别分布:', categoryStats);

  fs.writeFileSync(OUTPUT_EXPANDED, JSON.stringify(candidates, null, 2), 'utf-8');
  console.log(`[Corpus Expansion] 已保存至: ${OUTPUT_EXPANDED}`);
  return candidates;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateExpandedCandidates();
}
