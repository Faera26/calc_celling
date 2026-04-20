import fs from 'fs';
import https from 'https';

const SUPABASE_HOST = 'YOUR_SUPABASE_HOST';
const ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const units = JSON.parse(fs.readFileSync('c:/Users/ILYA/Desktop/Приложение/units.json', 'utf-8'));

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SUPABASE_HOST,
      path: path,
      method: method,
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    };
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function makeRequestWithRetry(method, path, body, retries = 3) {
   for (let i=0; i<retries; i++) {
       try {
           const res = await makeRequest(method, path, body);
           if (res.status >= 200 && res.status < 300) return true;
           await sleep(500);
       } catch (e) {
           await sleep(1000);
       }
   }
   return false;
}

async function updateTable(table) {
  console.log(`Updating ${table}...`);
  let updated = 0;
  
  const batchSize = 10;
  for (let i = 0; i < units.length; i += batchSize) {
    const batch = units.slice(i, i + batchSize);
    await Promise.all(batch.map(async ({name, unit}) => {
       const urlSafeName = encodeURIComponent(name);
       const path = `/rest/v1/${table}?name=eq.${urlSafeName}`;
       const ok = await makeRequestWithRetry('PATCH', path, { unit });
       if (ok) updated++;
    }));
    process.stdout.write(`\r  Progress ${table}: ${updated}/${units.length}`);
    await sleep(200); // Wait a bit between batches
  }
  console.log(`\nFinished ${table}.`);
}

async function main() {
  await updateTable('tovary');
  await updateTable('uslugi');
  await updateTable('uzly');
  console.log('All done!');
}

main();
