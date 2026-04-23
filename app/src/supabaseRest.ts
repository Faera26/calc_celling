import { supabase } from './supabaseClient';

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

const CACHE_TTL = 30000;
const restCache = new Map<string, { data: unknown; timestamp: number }>();

type EqCapable<T> = {
  eq: (column: string, value: RestScalar) => T;
};

type OrCapable<T> = {
  or: (filters: string) => T;
};

type OrderCapable<T> = {
  order: (column: string, options?: { ascending?: boolean }) => T;
};

function hasFilterValue(value: RestScalar | null | undefined) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeError(table: string, error: { message: string; details?: string | null; hint?: string | null }) {
  const parts = [`${table}: ${error.message}`];
  if (error.details) parts.push(error.details);
  if (error.hint) parts.push(error.hint);
  return parts.join(' · ');
}

function applyFilters<T extends EqCapable<T>>(query: T, filters?: RestFilters): T {
  let nextQuery = query;

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (!hasFilterValue(value)) return;
    nextQuery = nextQuery.eq(key, value as RestScalar);
  });

  return nextQuery;
}

function applySearch<T extends OrCapable<T>>(query: T, search?: string): T {
  if (!search) return query;

  const pattern = `*${search}*`;
  return query.or(
    `id.ilike.${pattern},name.ilike.${pattern},category.ilike.${pattern},subcategory.ilike.${pattern}`
  );
}

function applyOrder<T extends OrderCapable<T>>(query: T, order?: string): T {
  if (!order) return query;

  let nextQuery = query;
  order
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const [column, direction = 'asc'] = segment.split('.');
      nextQuery = nextQuery.order(column, { ascending: direction !== 'desc' });
    });

  return nextQuery;
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

function countCacheKey(table: string, filters?: RestFilters) {
  return buildCacheKey(table, 'count', filters || {});
}

export async function restSelect<T>(table: string, options: RestSelectOptions): Promise<T[]> {
  const cacheKey = buildCacheKey(table, 'select', options);
  const cached = getCached<T[]>(cacheKey);
  if (cached) return cached;

  let query = supabase.from(table).select(options.select);
  query = applyFilters(query, options.filters);
  query = applySearch(query, options.search);
  query = applyOrder(query, options.order);

  if (typeof options.limit === 'number' && typeof options.offset === 'number') {
    query = query.range(options.offset, options.offset + options.limit - 1);
  } else if (typeof options.limit === 'number') {
    query = query.limit(options.limit);
  } else if (typeof options.offset === 'number') {
    query = query.range(options.offset, options.offset + 999);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(normalizeError(table, error));
  }

  const rows = (data || []) as T[];
  setCache(cacheKey, rows);
  return rows;
}

export async function restInsert<T>(table: string, rows: RestRow | RestRow[], options: RestInsertOptions = {}): Promise<T[]> {
  restCache.clear();

  let query = supabase.from(table).insert(rows);

  if (options.select) {
    const { data, error } = await query.select(options.select);
    if (error) throw new Error(normalizeError(table, error));
    return (Array.isArray(data) ? data : [data]) as T[];
  }

  if (options.returning === 'representation') {
    const { data, error } = await query.select();
    if (error) throw new Error(normalizeError(table, error));
    return (Array.isArray(data) ? data : [data]) as T[];
  }

  const { error } = await query;
  if (error) throw new Error(normalizeError(table, error));
  return [];
}

export async function restUpdate<T>(table: string, patch: RestRow, options: RestMutationOptions = {}): Promise<T[]> {
  restCache.clear();

  let query = supabase.from(table).update(patch);
  query = applyFilters(query, options.filters);

  if (options.select) {
    const { data, error } = await query.select(options.select);
    if (error) throw new Error(normalizeError(table, error));
    return (Array.isArray(data) ? data : [data]) as T[];
  }

  if (options.returning === 'representation') {
    const { data, error } = await query.select();
    if (error) throw new Error(normalizeError(table, error));
    return (Array.isArray(data) ? data : [data]) as T[];
  }

  const { error } = await query;
  if (error) throw new Error(normalizeError(table, error));
  return [];
}

export async function restDelete<T>(table: string, options: RestMutationOptions = {}): Promise<T[]> {
  restCache.clear();

  let query = supabase.from(table).delete();
  query = applyFilters(query, options.filters);

  if (options.select) {
    const { data, error } = await query.select(options.select);
    if (error) throw new Error(normalizeError(table, error));
    return (Array.isArray(data) ? data : [data]) as T[];
  }

  if (options.returning === 'representation') {
    const { data, error } = await query.select();
    if (error) throw new Error(normalizeError(table, error));
    return (Array.isArray(data) ? data : [data]) as T[];
  }

  const { error } = await query;
  if (error) throw new Error(normalizeError(table, error));
  return [];
}

export async function restCount(table: string, filters?: RestFilters): Promise<number> {
  const cacheKey = countCacheKey(table, filters);
  const cached = getCached<number>(cacheKey);
  if (cached !== null) return cached;

  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  query = applyFilters(query, filters);

  const { count, error } = await query;
  if (error) {
    throw new Error(normalizeError(table, error));
  }

  const resolvedCount = count || 0;
  setCache(cacheKey, resolvedCount);
  return resolvedCount;
}
