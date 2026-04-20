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

const restBaseUrl = import.meta.env.DEV ? '/supabase-rest' : `${supabaseUrl}/rest/v1`;

async function buildRestHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || supabaseAnonKey;

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

export async function restSelect<T>(table: string, options: RestSelectOptions): Promise<T[]> {
  const response = await fetch(buildRestUrl(table, options), {
    headers: await buildRestHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table}: ${response.status} ${response.statusText}${text ? ` · ${text}` : ''}`);
  }

  return await response.json() as T[];
}

export async function restInsert<T>(table: string, rows: unknown | unknown[], options: RestInsertOptions = {}): Promise<T[]> {
  const params = new URLSearchParams();
  if (options.select) params.set('select', options.select);

  const url = `${restBaseUrl}/${table}${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url, {
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
  const response = await fetch(buildMutationUrl(table, options), {
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
  const response = await fetch(buildMutationUrl(table, options), {
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

  const response = await fetch(`${restBaseUrl}/${table}?${params.toString()}`, {
    method: 'HEAD',
    cache: 'no-store',
    headers: await buildRestHeaders({ Prefer: 'count=exact' }),
  });

  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${response.statusText}`);
  }

  const contentRange = response.headers.get('content-range') || '';
  const total = Number(contentRange.split('/').pop() || 0);
  return Number.isFinite(total) ? total : 0;
}
