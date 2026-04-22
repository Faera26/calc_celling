import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://rreqijywlhsodppwebjy.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_aVVYUkx_p3xW3a--cm57oA_s-n5IsFU';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
