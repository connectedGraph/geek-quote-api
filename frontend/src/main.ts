import './style.css';
import { fetchCategories, fetchQuotes, fetchRandomQuote, fetchStats } from './api.ts';
import type { CategoryMeta, DisplayMode, Quote } from './types.ts';

// 应用状态
let currentQuote: Quote | null = null;
let selectedCategory = '';
let displayMode: DisplayMode = 'both';
let allQuotesCache: Quote[] = [];
let categoriesCache: CategoryMeta[] = [];

// DOM 元素引用
const quoteCardEl = document.getElementById('quoteCard') as HTMLDivElement;
const quoteCategoryEl = document.getElementById('quoteCategory') as HTMLElement;
const quoteIdEl = document.getElementById('quoteId') as HTMLElement;
const quoteZhBlockEl = document.getElementById('quoteZhBlock') as HTMLDivElement;
const quoteEnBlockEl = document.getElementById('quoteEnBlock') as HTMLDivElement;
const textZhEl = document.getElementById('textZh') as HTMLElement;
const textEnEl = document.getElementById('textEn') as HTMLElement;
const sourceTextEl = document.getElementById('sourceText') as HTMLElement;
const quoteTagsEl = document.getElementById('quoteTags') as HTMLDivElement;
const feedbackMsgEl = document.getElementById('feedbackMsg') as HTMLDivElement;

const statTotalEl = document.getElementById('statTotal') as HTMLElement;
const statCatsEl = document.getElementById('statCats') as HTMLElement;
const tabCountEl = document.getElementById('tabCount') as HTMLElement;
const searchResultCountEl = document.getElementById('searchResultCount') as HTMLElement;
const quoteGridEl = document.getElementById('quoteGrid') as HTMLDivElement;
const searchInputEl = document.getElementById('searchInput') as HTMLInputElement;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupFilters();
  setupDisplayModeButtons();
  setupActions();
  setupApiPlayground();
  setupKeyboardShortcuts();

  await loadInitialData();
});

async function loadInitialData() {
  const [stats, categories] = await Promise.all([fetchStats(), fetchCategories()]);

  if (stats) {
    statTotalEl.textContent = String(stats.total_quotes);
    statCatsEl.textContent = String(stats.total_categories);
    tabCountEl.textContent = String(stats.total_quotes);
  }

  if (categories.length > 0) {
    categoriesCache = categories;
  }

  await loadRandomQuote();
  await loadAllQuotes();
}

// 标签页切换
function setupTabs() {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `tab-${tab.dataset.tab}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// 分类筛选
function setupFilters() {
  const catPills = document.querySelectorAll<HTMLButtonElement>('#categoryFilters .filter-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedCategory = pill.dataset.category || '';
      loadRandomQuote();
      updatePlaygroundUrl();
    });
  });
}

// 显示模式切换（中英对照 / 仅中文 / 仅英文）
function setupDisplayModeButtons() {
  const modePills = document.querySelectorAll<HTMLButtonElement>('#modeFilters .filter-pill');
  modePills.forEach(pill => {
    pill.addEventListener('click', () => {
      modePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      displayMode = (pill.dataset.mode as DisplayMode) || 'both';
      renderQuoteDisplay();
    });
  });
}

// 操作事件绑定
function setupActions() {
  document.getElementById('btnNextQuote')?.addEventListener('click', loadRandomQuote);

  document.getElementById('btnCopyBilingual')?.addEventListener('click', () => {
    if (!currentQuote) return;
    const text = `${currentQuote.content_zh}\n${currentQuote.content_en}\n—— ${currentQuote.source_zh || currentQuote.source_en}`;
    copyText(text, '已复制中英双语对照！');
  });

  document.getElementById('btnCopyZh')?.addEventListener('click', () => {
    if (!currentQuote) return;
    const text = `${currentQuote.content_zh}\n—— ${currentQuote.source_zh}`;
    copyText(text, '已复制中文文案！');
  });

  document.getElementById('btnCopyEn')?.addEventListener('click', () => {
    if (!currentQuote) return;
    const text = `${currentQuote.content_en}\n—— ${currentQuote.source_en}`;
    copyText(text, '已复制英文文案！');
  });

  document.getElementById('btnCopyCurl')?.addEventListener('click', () => {
    const origin = window.location.origin;
    const qs = selectedCategory ? `?category=${selectedCategory}` : '';
    const curl = `curl "${origin}/api/random${qs}"`;
    copyText(curl, '已复制 cURL 命令行！');
  });

  document.getElementById('btnCopyMarkdown')?.addEventListener('click', () => {
    if (!currentQuote) return;
    const md = `> ${currentQuote.content_zh}\n>\n> *${currentQuote.content_en}*\n>\n> —— ${currentQuote.source_zh || currentQuote.source_en} \`#${currentQuote.category}\``;
    copyText(md, '已复制 Markdown 引用格式！');
  });

  // 搜索相关
  searchInputEl?.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    renderFilteredGrid(target.value.trim());
  });

  document.getElementById('btnClearSearch')?.addEventListener('click', () => {
    searchInputEl.value = '';
    renderFilteredGrid('');
  });
}

// 全局快捷键
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.code === 'Space' || e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      loadRandomQuote();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      document.getElementById('btnCopyBilingual')?.click();
    }
  });
}

// 加载随机文案
async function loadRandomQuote() {
  quoteCardEl.style.opacity = '0.5';

  const { quote, error } = await fetchRandomQuote(selectedCategory);
  if (quote) {
    currentQuote = quote;
    renderQuoteDisplay();
  } else {
    textZhEl.textContent = error || '未能获取到文案';
    textEnEl.textContent = 'Please try changing category filter.';
  }

  quoteCardEl.style.opacity = '1';
}

// 渲染文案展示
function renderQuoteDisplay() {
  if (!currentQuote) return;

  textZhEl.textContent = currentQuote.content_zh || '（暂无中文）';
  textEnEl.textContent = currentQuote.content_en || '(No English translation yet)';

  quoteIdEl.textContent = `#${currentQuote.id}`;

  const matchedCat = categoriesCache.find(c => c.id === currentQuote?.category);
  quoteCategoryEl.textContent = matchedCat
    ? `${matchedCat.icon} ${matchedCat.name_zh}`
    : currentQuote.category;

  sourceTextEl.textContent = currentQuote.source_zh || currentQuote.source_en || '经典理科黑话';

  // 渲染显示模式
  if (displayMode === 'both') {
    quoteZhBlockEl.style.display = 'block';
    quoteEnBlockEl.style.display = 'block';
  } else if (displayMode === 'zh') {
    quoteZhBlockEl.style.display = 'block';
    quoteEnBlockEl.style.display = 'none';
  } else {
    quoteZhBlockEl.style.display = 'none';
    quoteEnBlockEl.style.display = 'block';
  }

  // 渲染标签
  quoteTagsEl.innerHTML = '';
  if (Array.isArray(currentQuote.tags)) {
    currentQuote.tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag-badge';
      span.textContent = `#${tag}`;
      quoteTagsEl.appendChild(span);
    });
  }
}

// 复制文字并显示反馈
function copyText(text: string, msg: string) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(msg);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(msg);
  });
}

function showToast(msg: string) {
  feedbackMsgEl.textContent = `✓ ${msg}`;
  setTimeout(() => {
    feedbackMsgEl.textContent = '';
  }, 2200);
}

// 获取全量数据以供检索
async function loadAllQuotes() {
  const result = await fetchQuotes(undefined, undefined, undefined, 1, 1000);
  allQuotesCache = result.items || [];
  renderFilteredGrid('');
}

// 渲染检索卡片网格
function renderFilteredGrid(term: string) {
  const norm = term.toLowerCase();
  const filtered = allQuotesCache.filter(q => {
    if (!norm) return true;
    return (
      q.content_zh.toLowerCase().includes(norm) ||
      q.content_en.toLowerCase().includes(norm) ||
      (q.source_zh && q.source_zh.toLowerCase().includes(norm)) ||
      (q.source_en && q.source_en.toLowerCase().includes(norm)) ||
      q.category.toLowerCase().includes(norm) ||
      (q.tags && q.tags.some(t => t.toLowerCase().includes(norm)))
    );
  });

  searchResultCountEl.textContent = String(filtered.length);
  quoteGridEl.innerHTML = '';

  filtered.forEach(q => {
    const card = document.createElement('div');
    card.className = 'grid-card';
    card.innerHTML = `
      <div>
        <div class="grid-zh">${escapeHtml(q.content_zh)}</div>
        <div class="grid-en">${escapeHtml(q.content_en)}</div>
      </div>
      <div class="grid-footer">
        <span>${escapeHtml(q.source_zh || q.source_en || q.category)}</span>
        <span class="category-tag">${escapeHtml(q.category)}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      currentQuote = q;
      renderQuoteDisplay();
      document.querySelector<HTMLButtonElement>('.tab-btn[data-tab="hero"]')?.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    quoteGridEl.appendChild(card);
  });
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// API Playground 交互
function setupApiPlayground() {
  const urlInput = document.getElementById('apiUrlInput') as HTMLInputElement;
  const responsePre = document.getElementById('apiResponse') as HTMLElement;
  const statusEl = document.getElementById('apiStatus') as HTMLElement;
  const btnSend = document.getElementById('btnSendRequest') as HTMLButtonElement;

  btnSend?.addEventListener('click', async () => {
    const path = urlInput.value.trim();
    statusEl.textContent = '请求中...';
    responsePre.textContent = '// 正在发起请求...';

    const t0 = performance.now();
    try {
      const res = await fetch(path);
      const elapsed = Math.round(performance.now() - t0);
      statusEl.textContent = `HTTP ${res.status} (${elapsed}ms)`;
      const json = await res.json();
      responsePre.textContent = JSON.stringify(json, null, 2);
    } catch (err) {
      statusEl.textContent = '请求异常';
      responsePre.textContent = String(err);
    }
  });
}

function updatePlaygroundUrl() {
  const qs = selectedCategory ? `?category=${selectedCategory}` : '';
  const urlInput = document.getElementById('apiUrlInput') as HTMLInputElement;
  if (urlInput) {
    urlInput.value = `/api/random${qs}`;
  }
}
