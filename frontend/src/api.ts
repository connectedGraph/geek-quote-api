import type { ApiResponse, CategoryMeta, PaginatedResponse, Quote, StatsResponse } from './types.ts';

const API_BASE = '/api';

export async function fetchRandomQuote(
  category?: string,
  lang?: string,
  tag?: string
): Promise<{ quote: Quote | null; error?: string }> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (lang) params.append('lang', lang);
  if (tag) params.append('tag', tag);

  const query = params.toString() ? `?${params.toString()}` : '';
  try {
    const res = await fetch(`${API_BASE}/random${query}`);
    const json: ApiResponse<Quote> = await res.json();
    if (json.code === 200 && json.data) {
      return { quote: json.data };
    }
    return { quote: null, error: '未找到符合条件的文案' };
  } catch (err) {
    return { quote: null, error: String(err) };
  }
}

export async function fetchQuotes(
  search?: string,
  category?: string,
  lang?: string,
  page = 1,
  limit = 20
): Promise<PaginatedResponse<Quote>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) params.append('search', search);
  if (category) params.append('category', category);
  if (lang) params.append('lang', lang);

  const res = await fetch(`${API_BASE}/quotes?${params.toString()}`);
  const json: ApiResponse<PaginatedResponse<Quote>> = await res.json();
  return (
    json.data || {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    }
  );
}

export async function fetchCategories(): Promise<CategoryMeta[]> {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    const json: ApiResponse<CategoryMeta[]> = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function fetchStats(): Promise<StatsResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const json: ApiResponse<StatsResponse> = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}
