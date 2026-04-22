import { createClient } from '@supabase/supabase-js';

function requirePublicEnv(value: string | undefined, envName: string) {
  if (!value) {
    throw new Error(`Не задана переменная окружения ${envName}. Добавь её в Vercel и в локальный .env.local.`);
  }

  return value;
}

// В браузерном коде Next.js доступны только переменные с префиксом NEXT_PUBLIC_*.
// Поэтому держим единый и предсказуемый источник конфигурации без скрытых fallback-веток.
export const supabaseUrl = requirePublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_URL'
);

export const supabaseAnonKey = requirePublicEnv(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
