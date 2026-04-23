'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://rreqijywlhsodppwebjy.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_aVVYUkx_p3xW3a--cm57oA_s-n5IsFU';
const projectRef = (() => {
  try {
    return new URL(DEFAULT_SUPABASE_URL).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
})();
const authStorageKey = projectRef ? `sb-${projectRef}-auth-token` : '';

let browserSupabaseClient: SupabaseClient | null = null;

function resolvePublicEnv(value: string | undefined, fallback: string, envName: string) {
  const resolved = value || fallback;

  // Для фронтенда эти значения всё равно публичные.
  // Поэтому на Vercel мы не даём сборке упасть, даже если публичные env
  // почему-то не были подхвачены в момент prerender/export.
  if (!value && typeof window === 'undefined') {
    console.warn(`[supabaseClient] ${envName} не задана, использую встроенный публичный fallback для build/runtime.`);
  }

  return resolved;
}

export const supabaseUrl = resolvePublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  DEFAULT_SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_URL'
);

export const supabaseAnonKey = resolvePublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_ANON_KEY,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
);

function createBrowserSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function getSupabaseClient() {
  if (!browserSupabaseClient) {
    browserSupabaseClient = createBrowserSupabaseClient();
  }

  return browserSupabaseClient;
}

export function readStoredAuthUser() {
  if (typeof window === 'undefined' || !authStorageKey) return null;

  try {
    const rawValue = window.localStorage.getItem(authStorageKey);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as {
      user?: { id?: unknown; email?: unknown };
    };

    const id = typeof parsed.user?.id === 'string' ? parsed.user.id : '';
    const email = typeof parsed.user?.email === 'string' ? parsed.user.email : '';
    if (!id || !email) return null;

    return { id, email };
  } catch {
    return null;
  }
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client as object, property, receiver);

    return typeof value === 'function' ? value.bind(client) : value;
  },
});
