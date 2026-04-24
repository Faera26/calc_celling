import { readStoredAccessToken, supabase, supabaseAnonKey, supabaseUrl } from './supabaseClient';

type RestScalar = string | number | boolean;
type RestFilters = Record<string, RestScalar | null | undefined>;
type RestRow = Record<string, unknown>;

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

interface ProxyPayload {
  action: 'select' | 'insert' | 'update' | 'delete' | 'count';
  table: string;
  select?: string;
  filters?: RestFilters;
  order?: string;
  limit?: number;
  offset?: number;
  search?: string;
  rows?: RestRow | RestRow[];
  patch?: RestRow;
  returning?: 'minimal' | 'representation';
}

interface RestRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD';
  query?: URLSearchParams;
  body?: RestRow | RestRow[];
  prefer?: string[];
  retryOnUnauthorized?: boolean;
}

const CACHE_TTL = 30000;
const SESSION_LOOKUP_TIMEOUT_MS = 1500;
const DIRECT_FETCH_TIMEOUT_MS = 4000;
const PROXY_FETCH_TIMEOUT_MS = 10000;
const restCache = new Map<string, { data: unknown; timestamp: number }>();

function hasFilterValue(value: RestScalar | null | undefined) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeError(table: string, error: { message: string; details?: string | null; hint?: string | null }) {
  const parts = [`${table}: ${error.message}`];
  if (error.details) parts.push(error.details);
  if (error.hint) parts.push(error.hint);
  return parts.join(' · ');
}

function normalizeHttpError(table: string, response: Response, message: string, details?: string) {
  return normalizeError(table, {
    message: `${response.status} ${response.statusText}${message ? `: ${message}` : ''}`,
    details: details || null,
  });
}

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

function buildCacheKey(table: string, action: string, payload: unknown) {
  return `${table}:${action}:${JSON.stringify(payload)}`;
}

function countCacheKey(table: string, filters?: RestFilters, search?: string) {
  return buildCacheKey(table, 'count', {
    filters: filters || {},
    search: search || '',
  });
}

function addFilters(query: URLSearchParams, filters?: RestFilters) {
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (!hasFilterValue(value)) return;
    query.set(key, `eq.${value as RestScalar}`);
  });
}

function addSearch(query: URLSearchParams, search?: string) {
  if (!search) return;

  const pattern = `*${search}*`;
  query.set('name', `ilike.${pattern}`);
}

function addRange(query: URLSearchParams, limit?: number, offset?: number) {
  if (typeof limit === 'number') query.set('limit', String(limit));
  if (typeof offset === 'number') query.set('offset', String(offset));
}

function buildRestUrl(table: string, query: URLSearchParams) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  query.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function shouldUseProxy() {
  if (typeof window === 'undefined') return false;

  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

async function readFreshAccessToken() {
  try {
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), SESSION_LOOKUP_TIMEOUT_MS);
      }),
    ]);

    if (!sessionResult) return '';
    const accessToken = sessionResult.data.session?.access_token;
    return typeof accessToken === 'string' ? accessToken : '';
  } catch {
    return '';
  }
}

async function resolveAccessToken(preferFresh: boolean) {
  if (preferFresh) {
    const freshAccessToken = await readFreshAccessToken();
    if (freshAccessToken) return freshAccessToken;
  }

  const storedAccessToken = readStoredAccessToken();
  if (storedAccessToken) return storedAccessToken;

  if (!preferFresh) {
    const freshAccessToken = await readFreshAccessToken();
    if (freshAccessToken) return freshAccessToken;
  }

  return '';
}

async function parseErrorBody(response: Response) {
  let payload: unknown = null;

  try {
    payload = await response.clone().json();
  } catch {
    try {
      payload = await response.text();
    } catch {
      payload = null;
    }
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as { message?: string; error?: string; details?: string; hint?: string };
    return {
      message: objectPayload.message || objectPayload.error || '',
      details: objectPayload.details || '',
      hint: objectPayload.hint || '',
    };
  }

  if (typeof payload === 'string') {
    return { message: payload, details: '', hint: '' };
  }

  return { message: '', details: '', hint: '' };
}

async function requestViaProxy<T>(payload: ProxyPayload): Promise<T[]> {
  const accessToken = readStoredAccessToken() || await readFreshAccessToken();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROXY_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('/api/rest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'x-supabase-access-token': accessToken } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await parseErrorBody(response);
      throw new Error(normalizeHttpError(payload.table, response, errorBody.message, [errorBody.details, errorBody.hint].filter(Boolean).join(' · ')));
    }

    const json = await response.json() as { data?: T[] | T; count?: number };

    if (payload.action === 'count') {
      return [Number(json.count || 0) as T];
    }

    const resolvedData = json.data;
    if (!resolvedData) return [];
    return (Array.isArray(resolvedData) ? resolvedData : [resolvedData]) as T[];
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(normalizeError(payload.table, { message: 'прокси-запрос к Vercel был прерван по таймауту' }));
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function performDirectRequest(
  table: string,
  options: RestRequestOptions,
  preferFreshToken = false,
  attempt = 0
): Promise<Response> {
  const query = options.query || new URLSearchParams();
  const accessToken = await resolveAccessToken(preferFreshToken);
  const headers = new Headers({
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken || supabaseAnonKey}`,
  });

  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.prefer && options.prefer.length > 0) headers.set('Prefer', options.prefer.join(','));

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), DIRECT_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(buildRestUrl(table, query), {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    window.clearTimeout(timer);

    if (response.status === 401 && options.retryOnUnauthorized !== false && !preferFreshToken) {
      return performDirectRequest(table, options, true, attempt + 1);
    }

    return response;
  } catch (error) {
    window.clearTimeout(timer);

    if (error instanceof DOMException && error.name === 'AbortError' && attempt < 1) {
      return performDirectRequest(table, options, preferFreshToken, attempt + 1);
    }

    throw error;
  }
}

async function requestDirectJson<T>(table: string, options: RestRequestOptions): Promise<T[]> {
  let response: Response;

  try {
    response = await performDirectRequest(table, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(normalizeError(table, { message: 'браузер прервал зависший запрос к Supabase' }));
    }
    throw error;
  }

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    throw new Error(normalizeHttpError(table, response, errorBody.message, [errorBody.details, errorBody.hint].filter(Boolean).join(' · ')));
  }

  const text = await response.text();
  if (!text.trim()) return [];

  const parsed = JSON.parse(text) as T[] | T;
  return (Array.isArray(parsed) ? parsed : [parsed]) as T[];
}

export async function restSelect<T>(table: string, options: RestSelectOptions): Promise<T[]> {
  const cacheKey = buildCacheKey(table, 'select', options);
  const cached = getCached<T[]>(cacheKey);
  if (cached) return cached;

  let rows: T[];

  if (shouldUseProxy()) {
    rows = await requestViaProxy<T>({
      action: 'select',
      table,
      select: options.select,
      filters: options.filters,
      order: options.order,
      limit: options.limit,
      offset: options.offset,
      search: options.search,
    });
  } else {
    const query = new URLSearchParams();
    query.set('select', options.select);
    addFilters(query, options.filters);
    addSearch(query, options.search);
    if (options.order) query.set('order', options.order);
    addRange(query, options.limit, options.offset);
    rows = await requestDirectJson<T>(table, { query });
  }

  setCache(cacheKey, rows);
  return rows;
}

export async function restInsert<T>(table: string, rows: RestRow | RestRow[], options: RestInsertOptions = {}): Promise<T[]> {
  restCache.clear();

  if (shouldUseProxy()) {
    return requestViaProxy<T>({
      action: 'insert',
      table,
      rows,
      select: options.select,
      returning: options.returning,
    });
  }

  const query = new URLSearchParams();
  const prefer: string[] = [];

  if (options.select) {
    query.set('select', options.select);
    prefer.push('return=representation');
  } else if (options.returning === 'representation') {
    prefer.push('return=representation');
  } else {
    prefer.push('return=minimal');
  }

  return requestDirectJson<T>(table, {
    method: 'POST',
    query,
    body: rows,
    prefer,
  });
}

export async function restUpdate<T>(table: string, patch: RestRow, options: RestMutationOptions = {}): Promise<T[]> {
  restCache.clear();

  if (shouldUseProxy()) {
    return requestViaProxy<T>({
      action: 'update',
      table,
      patch,
      filters: options.filters,
      select: options.select,
      returning: options.returning,
    });
  }

  const query = new URLSearchParams();
  const prefer: string[] = [];

  addFilters(query, options.filters);

  if (options.select) {
    query.set('select', options.select);
    prefer.push('return=representation');
  } else if (options.returning === 'representation') {
    prefer.push('return=representation');
  } else {
    prefer.push('return=minimal');
  }

  return requestDirectJson<T>(table, {
    method: 'PATCH',
    query,
    body: patch,
    prefer,
  });
}

export async function restDelete<T>(table: string, options: RestMutationOptions = {}): Promise<T[]> {
  restCache.clear();

  if (shouldUseProxy()) {
    return requestViaProxy<T>({
      action: 'delete',
      table,
      filters: options.filters,
      select: options.select,
      returning: options.returning,
    });
  }

  const query = new URLSearchParams();
  const prefer: string[] = [];

  addFilters(query, options.filters);

  if (options.select) {
    query.set('select', options.select);
    prefer.push('return=representation');
  } else if (options.returning === 'representation') {
    prefer.push('return=representation');
  } else {
    prefer.push('return=minimal');
  }

  return requestDirectJson<T>(table, {
    method: 'DELETE',
    query,
    prefer,
  });
}

export async function restCount(table: string, filters?: RestFilters, search?: string): Promise<number> {
  const cacheKey = countCacheKey(table, filters, search);
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  let safeCount = 0;

  if (shouldUseProxy()) {
    const [countValue] = await requestViaProxy<number>({
      action: 'count',
      table,
      filters,
      search,
    });
    safeCount = Number(countValue || 0);
  } else {
    const query = new URLSearchParams();
    query.set('select', 'id');
    addFilters(query, filters);
    addSearch(query, search);

    let response: Response;

    try {
      response = await performDirectRequest(table, {
        method: 'HEAD',
        query,
        prefer: ['count=exact'],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(normalizeError(table, { message: 'браузер прервал зависший запрос к Supabase' }));
      }
      throw error;
    }

    if (!response.ok) {
      const errorBody = await parseErrorBody(response);
      throw new Error(normalizeHttpError(table, response, errorBody.message, [errorBody.details, errorBody.hint].filter(Boolean).join(' · ')));
    }

    const contentRange = response.headers.get('content-range') || '';
    const resolvedCount = Number(contentRange.split('/').pop() || 0);
    safeCount = Number.isFinite(resolvedCount) ? resolvedCount : 0;
  }

  setCache(cacheKey, safeCount);
  return safeCount;
}
