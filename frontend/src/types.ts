export interface Quote {
  id: string;
  content_zh: string;
  content_en: string;
  category: string;
  tags: string[];
  source_zh: string;
  source_en: string;
}

export interface CategoryMeta {
  id: string;
  name_zh: string;
  name_en: string;
  icon: string;
  count: number;
}

export interface StatsResponse {
  total_quotes: number;
  total_categories: number;
  total_tags: number;
  by_category: Record<string, number>;
  by_language: Record<string, number>;
  database_engine: string;
  server: string;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export type DisplayMode = 'both' | 'zh' | 'en';
