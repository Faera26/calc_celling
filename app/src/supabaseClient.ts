import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rreqijywlhsodppwebjy.supabase.co';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_aVVYUkx_p3xW3a--cm57oA_s-n5IsFU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
