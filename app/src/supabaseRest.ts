import { supabase, supabaseAnonKey, supabaseUrl } from './supabaseClient';

type RestFilters = Record<string, string | number | boolean | null | undefined>;

interface RestSelectOptions {
  select: string;
  filters?: RestFilters;
  order?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

interface RestInsertOptions {
  select?: string;
  returning?: 'minimal' | 'representation';
}

interface RestMutationOptions {
  filters?: RestFilters;
  select?: string;
  returning?: 'minimal' | 'representation';
}

// Приложение теперь собирается как статический Next.js export.
// У такого режима нет локального Vite proxy, поэтому REST идёт напрямую в Supabase.
const restBaseUrl = `${supabaseUrl}/rest/v1`;
const projectRef = (() => {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
})();
const authStorageKey = projectRef ? `sb-${projectRef}-auth-token` : '';

function readAccessTokenFromStorage() {
  if (typeof window === 'undefined' || !authStorageKey) return null;

  try {
    const rawValue = window.localStorage.getItem(authStorageKey);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as { access_token?: unknown };
    return typeof parsed.access_token === 'string' && parsed.access_token
      ? parsed.access_token
      : null;
  } catch {
    return null;
  }
}

async function resolveAccessToken() {
  // После холодной загрузки Supabase иногда восстанавливает сессию чуть позже,
  // чем страница успевает запросить данные через REST. Берём токен напрямую
  // из localStorage, чтобы экран смет не зависал в вечной загрузке.
  const storedToken = readAccessTokenFromStorage();
  if (storedToken) return storedToken;

  try {
    const session = await Promise.race([
      supabase.auth.getSession().then(({ data }) => data.session),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);

    return session?.access_token || supabaseAnonKey;
  } catch {
    return supabaseAnonKey;
  }
}

async function buildRestHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const token = await resolveAccessToken();

  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...extra,
  };
}

function appendFilters(params: URLSearchParams, filters?: RestFilters) {
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.append(key, `eq.${String(value)}`);
  });
}

function appendSearch(params: URLSearchParams, search?: string) {
  if (!search) return;

  const pattern = `*${search}*`;
  params.append(
    'or',
    `(id.ilike.${pattern},name.ilike.${pattern},category.ilike.${pattern},subcategory.ilike.${pattern})`
  );
}

function buildRestUrl(table: string, options: RestSelectOptions) {
  const params = new URLSearchParams();
  params.set('select', options.select);
  if (options.order) params.set('order', options.order);
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));
  if (typeof options.offset === 'number') params.set('offset', String(options.offset));
  appendFilters(params, options.filters);
  appendSearch(params, options.search);

  return `${restBaseUrl}/${table}?${params.toString()}`;
}

function buildMutationUrl(table: string, options: RestMutationOptions = {}) {
  const params = new URLSearchParams();
  if (options.select) params.set('select', options.select);
  appendFilters(params, options.filters);

  return `${restBaseUrl}/${table}${params.toString() ? `?${params.toString()}` : ''}`;
}

const CACHE_TTL = 30000;
const REQUEST_TIMEOUT_MS = 15000;
const restCache = new Map<string, { data: unknown; timestamp: number }>();

function getCached<T>(key: string): T | null {
  const cached = restCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown) {
  restCache.set(key, { data, timestamp: Date.now() });
}

function countCacheKey(url: string) {
  return `count:${url}`;
}

function readCountFromResponse(response: Response): number | null {
  const contentRange = response.headers.get('content-range') || '';
  const total = Number(contentRange.split('/').pop() || '');

  return Number.isFinite(total) ? total : null;
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function restSelect<T>(table: string, options: RestSelectOptions): Promise<T[]> {
  const url = buildRestUrl(table, options);
  const cached = getCached<T[]>(url);
  if (cached) return cached;

  const response = await fetchWithTimeout(url, {
    headers: await buildRestHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table}: ${response.status} ${response.statusText}${text ? ` · ${text}` : ''}`);
  }

  const data = await response.json() as T[];
  setCache(url, data);
  return data;
}

export async function restInsert<T>(table: string, rows: unknown | unknown[], options: RestInsertOptions = {}): Promise<T[]> {
  restCache.clear();
  const params = new URLSearchParams();
  if (options.select) params.set('select', options.select);

  const url = `${restBaseUrl}/${table}${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    cache: 'no-store',
    headers: await buildRestHeaders({
      'Content-Type': 'application/json',
      Prefer: options.returning === 'minimal' ? 'return=minimal' : 'return=representation',
    }),
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table}: ${response.status} ${response.statusText}${text ? ` · ${text}` : ''}`);
  }

  if (response.status === 204) return [];
  const data = await response.json();
  return (Array.isArray(data) ? data : [data]) as T[];
}

export async function restUpdate<T>(table: string, patch: unknown, options: RestMutationOptions = {}): Promise<T[]> {
  restCache.clear();
  const response = await fetchWithTimeout(buildMutationUrl(table, options), {
    method: 'PATCH',
    cache: 'no-store',
    headers: await buildRestHeaders({
      'Content-Type': 'application/json',
      Prefer: options.returning === 'minimal' ? 'return=minimal' : 'return=representation',
    }),
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table}: ${response.status} ${response.statusText}${text ? ` · ${text}` : ''}`);
  }

  if (response.status === 204) return [];
  const data = await response.json();
  return (Array.isArray(data) ? data : [data]) as T[];
}

export async function restDelete<T>(table: string, options: RestMutationOptions = {}): Promise<T[]> {
  restCache.clear();
  const response = await fetchWithTimeout(buildMutationUrl(table, options), {
    method: 'DELETE',
    cache: 'no-store',
    headers: await buildRestHeaders({
      Prefer: options.returning === 'minimal' ? 'return=minimal' : 'return=representation',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table}: ${response.status} ${response.statusText}${text ? ` · ${text}` : ''}`);
  }

  if (response.status === 204) return [];
  const data = await response.json();
  return (Array.isArray(data) ? data : [data]) as T[];
}

export async function restCount(table: string, filters?: RestFilters): Promise<number> {
  const params = new URLSearchParams();
  params.set('select', 'id');
  appendFilters(params, filters);

  const url = `${restBaseUrl}/${table}?${params.toString()}`;
  const cacheKey = countCacheKey(url);
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  const headers = await buildRestHeaders({ Prefer: 'count=exact' });

  try {
    // HEAD is faster, but some environments reject it because of CORS or proxy rules.
    // We try it first and then transparently fall back to GET.
    const headResponse = await fetchWithTimeout(url, {
      method: 'HEAD',
      cache: 'no-store',
      headers,
    });

    if (headResponse.ok) {
      const result = readCountFromResponse(headResponse);
      if (result !== null) {
        setCache(cacheKey, result);
        return result;
      }
    }
  } catch {
    // Ignore and continue with GET fallback below.
  }

  const getResponse = await fetchWithTimeout(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      ...headers,
      Range: '0-0',
      'Range-Unit': 'items',
    },
  });

  if (!getResponse.ok) {
    throw new Error(`${table}: ${getResponse.status} ${getResponse.statusText}`);
  }

  const rangedCount = readCountFromResponse(getResponse);
  if (rangedCount !== null) {
    setCache(cacheKey, rangedCount);
    return rangedCount;
  }

  const rows = await getResponse.json() as unknown[];
  const fallbackCount = Array.isArray(rows) ? rows.length : 0;
  setCache(cacheKey, fallbackCount);
  return fallbackCount;
}
