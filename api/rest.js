const DEFAULT_SUPABASE_URL = 'https://rreqijywlhsodppwebjy.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_aVVYUkx_p3xW3a--cm57oA_s-n5IsFU';

const ALLOWED_TABLES = new Set([
  'profiles',
  'nastroiki_kompanii',
  'tovary',
  'uslugi',
  'uzly',
  'komplektaciya_uzlov',
  'kategorii',
  'smety',
  'smeta_komnaty',
  'smeta_pozicii',
]);

function hasFilterValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function addFilters(query, filters) {
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (!hasFilterValue(value)) return;
    query.set(key, `eq.${value}`);
  });
}

function addSearch(query, search) {
  if (!search) return;

  const pattern = `*${search}*`;
  query.set(
    'or',
    `id.ilike.${pattern},name.ilike.${pattern},category.ilike.${pattern},subcategory.ilike.${pattern}`
  );
}

function addRange(query, limit, offset) {
  if (typeof limit === 'number') query.set('limit', String(limit));
  if (typeof offset === 'number') query.set('offset', String(offset));
}

function buildRestUrl(table, query) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const url = new URL(`/rest/v1/${table}`, baseUrl);

  query.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  if (typeof req.body === 'string' && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return {};
}

async function parseErrorBody(response) {
  try {
    return await response.json();
  } catch {
    try {
      return { message: await response.text() };
    } catch {
      return { message: 'Unknown Supabase error' };
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload = await parseBody(req);
  const { action, table, select, filters, order, limit, offset, search, rows, patch, returning } = payload || {};

  if (!action || !table || !ALLOWED_TABLES.has(table)) {
    res.status(400).json({ error: 'Unsupported table or action' });
    return;
  }

  const query = new URLSearchParams();
  const prefer = [];

  if (action === 'select') {
    query.set('select', select || '*');
    addFilters(query, filters);
    addSearch(query, search);
    if (order) query.set('order', order);
    addRange(query, limit, offset);
  }

  if (action === 'count') {
    query.set('select', 'id');
    addFilters(query, filters);
    prefer.push('count=exact');
  }

  if (action === 'insert') {
    if (select) {
      query.set('select', select);
      prefer.push('return=representation');
    } else if (returning === 'representation') {
      prefer.push('return=representation');
    } else {
      prefer.push('return=minimal');
    }
  }

  if (action === 'update' || action === 'delete') {
    addFilters(query, filters);

    if (select) {
      query.set('select', select);
      prefer.push('return=representation');
    } else if (returning === 'representation') {
      prefer.push('return=representation');
    } else {
      prefer.push('return=minimal');
    }
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const accessToken = req.headers['x-supabase-access-token'];
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${typeof accessToken === 'string' && accessToken ? accessToken : anonKey}`,
    ...(prefer.length > 0 ? { Prefer: prefer.join(',') } : {}),
    ...((action === 'insert' || action === 'update') ? { 'Content-Type': 'application/json' } : {}),
  };

  const methodMap = {
    select: 'GET',
    count: 'HEAD',
    insert: 'POST',
    update: 'PATCH',
    delete: 'DELETE',
  };

  const response = await fetch(buildRestUrl(table, query), {
    method: methodMap[action],
    headers,
    body: action === 'insert'
      ? JSON.stringify(rows)
      : action === 'update'
        ? JSON.stringify(patch)
        : undefined,
  });

  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    res.status(response.status).json(errorBody);
    return;
  }

  if (action === 'count') {
    const contentRange = response.headers.get('content-range') || '';
    const count = Number(contentRange.split('/').pop() || 0);
    res.status(200).json({ count: Number.isFinite(count) ? count : 0 });
    return;
  }

  const text = await response.text();
  if (!text.trim()) {
    res.status(200).json({ data: [] });
    return;
  }

  res.status(200).json({ data: JSON.parse(text) });
};
