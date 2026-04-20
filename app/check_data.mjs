import { createClient } from '@supabase/supabase-js';

const url = 'https://rreqijywlhsodppwebjy.supabase.co';
const key = 'sb_publishable_aVVYUkx_p3xW3a--cm57oA_s-n5IsFU';
const supabase = createClient(url, key);

async function checkData() {
  console.log("Checking data...");
  const { count: tovaryCount, error: err1 } = await supabase.from('tovary').select('*', { count: 'exact', head: true });
  console.log("Tovary:", tovaryCount, err1 ? err1.message : "");

  const { count: uslugiCount, error: err2 } = await supabase.from('uslugi').select('*', { count: 'exact', head: true });
  console.log("Uslugi:", uslugiCount, err2 ? err2.message : "");

  const { count: uzlyCount, error: err3 } = await supabase.from('uzly').select('*', { count: 'exact', head: true });
  console.log("Uzly:", uzlyCount, err3 ? err3.message : "");
}

checkData();
