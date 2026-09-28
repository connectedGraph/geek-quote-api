let currentQuote = null;
let selectedCategory = '';
let selectedLang = '';
let allQuotesCache = [];

// DOM 元素引用
const quoteTextEl = document.getElementById('quoteText');
const quoteSourceEl = document.getElementById('quoteSource');
const quoteCategoryEl = document.getElementById('quoteCategory');
const quoteLangEl = document.getElementById('quoteLang');
const quoteIdEl = document.getElementById('quoteId');
const quoteTagsEl = document.getElementById('quoteTags');
const quoteCardEl = document.getElementById('quoteCard');
const feedbackMsgEl = document.getElementById('feedbackMsg');

const statTotalEl = document.getElementById('statTotal');
const statCatsEl = document.getElementById('statCats');
const tabCountEl = document.getElementById('tabCount');
const searchResultCountEl = document.getElementById('searchResultCount');
const quoteGridEl = document.getElementById('quoteGrid');
const searchInputEl = document.getElementById('searchInput');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupFilters();
  setupActions();
  setupApiPlayground();
  setupKeyboardShortcuts();

  fetchStats();
  fetchRandomQuote();
  fetchAllQuotes();
});

// 标签页切换
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
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

// 过滤器逻辑
function setupFilters() {
  const catPills = document.querySelectorAll('#categoryFilters .filter-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedCategory = pill.dataset.category;
      fetchRandomQuote();
      updatePlaygroundUrl();
    });
  });

  const langPills = document.querySelectorAll('#langFilters .filter-pill');
  langPills.forEach(pill => {
    pill.addEventListener('click', () => {
      langPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedLang = pill.dataset.lang;
      fetchRandomQuote();
      updatePlaygroundUrl();
    });
  });
}

// 操作按钮绑定
function setupActions() {
  document.getElementById('btnNextQuote').addEventListener('click', fetchRandomQuote);

  document.getElementById('btnCopyText').addEventListener('click', () => {
    if (!currentQuote) return;
    const text = `${currentQuote.content}\n—— ${currentQuote.source || '未知'}`;
    copyToClipboard(text, '已复制文案到剪贴板！');
  });

  document.getElementById('btnCopyCurl').addEventListener('click', () => {
    const origin = window.location.origin;
    let params = [];
    if (selectedCategory) params.push(`category=${selectedCategory}`);
    if (selectedLang) params.push(`lang=${selectedLang}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    const curl = `curl "${origin}/api/random${qs}"`;
    copyToClipboard(curl, '已复制 cURL 命令行！');
  });

  document.getElementById('btnCopyMarkdown').addEventListener('click', () => {
    if (!currentQuote) return;
    const md = `> ${currentQuote.content}\n>\n> —— *${currentQuote.source || '未知'}* \`#${currentQuote.category}\``;
    copyToClipboard(md, '已复制 Markdown 引用格式！');
  });

  // 搜索相关
  searchInputEl.addEventListener('input', (e) => {
    renderFilteredGrid(e.target.value.trim());
  });

  document.getElementById('btnClearSearch').addEventListener('click', () => {
    searchInputEl.value = '';
    renderFilteredGrid('');
  });
}

// 快捷键支持
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // 如果焦点在输入框中，不触发全局快捷键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space' || e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      fetchRandomQuote();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      document.getElementById('btnCopyText').click();
    }
  });
}

// 获取全局统计
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.code === 200) {
      statTotalEl.textContent = json.data.totalQuotes;
      statCatsEl.textContent = json.data.totalCategories;
      tabCountEl.textContent = json.data.totalQuotes;
    }
  } catch (err) {
    console.error('获取统计失败:', err);
  }
}

// 获取随机文案
async function fetchRandomQuote() {
  let url = '/api/random';
  const params = new URLSearchParams();
  if (selectedCategory) params.append('category', selectedCategory);
  if (selectedLang) params.append('lang', selectedLang);
  if (params.toString()) url += `?${params.toString()}`;

  quoteCardEl.style.opacity = '0.5';

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.code === 200 && json.data) {
      currentQuote = json.data;
      renderCurrentQuote(json.data, json.meta);
    } else {
      quoteTextEl.textContent = json.message || '没有找到匹配的文案';
      quoteSourceEl.textContent = '建议调整筛选条件';
      quoteCategoryEl.textContent = '无结果';
      quoteTagsEl.innerHTML = '';
    }
  } catch (err) {
    quoteTextEl.textContent = '获取文案失败，请检查服务连接';
    console.error(err);
  } finally {
    quoteCardEl.style.opacity = '1';
  }
}

// 渲染卡片展示
function renderCurrentQuote(quote, meta) {
  quoteTextEl.textContent = quote.content;
  quoteSourceEl.textContent = quote.source || '经典理科黑话';
  quoteIdEl.textContent = `#${quote.id}`;

  const catMeta = meta?.categoryMeta;
  quoteCategoryEl.textContent = catMeta ? `${catMeta.icon} ${catMeta.name}` : quote.category;
  quoteLangEl.textContent = quote.language === 'zh' ? '中 ZH' : 'EN';

  // 渲染标签
  quoteTagsEl.innerHTML = '';
  if (Array.isArray(quote.tags)) {
    quote.tags.forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag-badge';
      span.textContent = `#${tag}`;
      quoteTagsEl.appendChild(span);
    });
  }
}

// 剪贴板复制封装
function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(() => {
    showFeedback(msg);
  }).catch(() => {
    // 降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showFeedback(msg);
  });
}

function showFeedback(msg) {
  feedbackMsgEl.textContent = `✓ ${msg}`;
  setTimeout(() => {
    feedbackMsgEl.textContent = '';
  }, 2500);
}

// 获取全量数据以供浏览
async function fetchAllQuotes() {
  try {
    const res = await fetch('/api/quotes?limit=1000');
    const json = await res.json();
    if (json.code === 200) {
      allQuotesCache = json.data || [];
      renderFilteredGrid('');
    }
  } catch (err) {
    console.error('获取全量文案失败:', err);
  }
}

// 渲染检索网格
function renderFilteredGrid(term) {
  const normalizedTerm = term.toLowerCase();
  const filtered = allQuotesCache.filter(q => {
    if (!normalizedTerm) return true;
    return (
      q.content.toLowerCase().includes(normalizedTerm) ||
      (q.source && q.source.toLowerCase().includes(normalizedTerm)) ||
      q.category.toLowerCase().includes(normalizedTerm) ||
      (q.tags && q.tags.some(t => t.toLowerCase().includes(normalizedTerm)))
    );
  });

  searchResultCountEl.textContent = filtered.length;
  quoteGridEl.innerHTML = '';

  filtered.forEach(q => {
    const card = document.createElement('div');
    card.className = 'grid-card';
    card.innerHTML = `
      <div class="grid-card-content">${escapeHtml(q.content)}</div>
      <div class="grid-card-footer">
        <span>${escapeHtml(q.source || q.category)}</span>
        <span class="lang-tag">${q.language.toUpperCase()}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      // 点击卡片直接复制并在上方预览
      currentQuote = q;
      renderCurrentQuote(q, null);
      document.querySelector('.tab-btn[data-tab="hero"]').click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    quoteGridEl.appendChild(card);
  });
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// API Playground 调试
function setupApiPlayground() {
  const urlInput = document.getElementById('apiUrlInput');
  const responsePre = document.getElementById('apiResponse');
  const statusEl = document.getElementById('apiStatus');
  const btnSend = document.getElementById('btnSendRequest');

  btnSend.addEventListener('click', async () => {
    const path = urlInput.value.trim();
    statusEl.textContent = '请求中...';
    responsePre.textContent = '// 请求发送中...';

    const startTime = performance.now();
    try {
      const res = await fetch(path);
      const elapsed = Math.round(performance.now() - startTime);
      statusEl.textContent = `HTTP ${res.status} (${elapsed}ms)`;
      const json = await res.json();
      responsePre.textContent = JSON.stringify(json, null, 2);
    } catch (err) {
      statusEl.textContent = '请求失败';
      responsePre.textContent = String(err);
    }
  });
}

function updatePlaygroundUrl() {
  let params = [];
  if (selectedCategory) params.push(`category=${selectedCategory}`);
  if (selectedLang) params.push(`lang=${selectedLang}`);
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  const urlInput = document.getElementById('apiUrlInput');
  if (urlInput) {
    urlInput.value = `/api/random${qs}`;
  }
}
