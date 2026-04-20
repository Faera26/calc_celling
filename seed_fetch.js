const https = require('https');
const fs = require('fs');

const SUPABASE_HOST = 'YOUR_SUPABASE_HOST';
const ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const catalogData = JSON.parse(fs.readFileSync('app/src/data/catalog.json', 'utf-8'));

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
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }
    };
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
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

async function main() {
  // Step 1: Check how many products already exist
  console.log('Checking existing products in Supabase...');
  try {
    const check = await makeRequest('GET', '/rest/v1/products?select=id&limit=1', null);
    console.log(`  Status: ${check.status}`);
    if (check.status === 200) {
      console.log('  Table "products" exists and is accessible!');
    } else {
      console.log('  Response:', check.body);
      if (check.body.includes('relation') && check.body.includes('does not exist')) {
        console.log('\n  TABLE DOES NOT EXIST! Please run init_db.sql in Supabase SQL Editor first.');
        process.exit(1);
      }
    }
  } catch (e) {
    console.error('  Connection error:', e.message);
    process.exit(1);
  }

  // Step 2: Upload products in small batches with delays
  const products = catalogData.products;
  console.log(`\nUploading ${products.length} products to Supabase...`);

  const BATCH_SIZE = 30;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory || null,
      price: p.price || 0,
      unit: p.unit || 'шт',
      image: p.image || null,
      description: p.description || null
    }));

    try {
      const result = await makeRequest('POST', '/rest/v1/products', batch);

      if (result.status >= 200 && result.status < 300) {
        successCount += batch.length;
        const pct = Math.round((i + batch.length) / products.length * 100);
        process.stdout.write(`\r  Progress: ${successCount}/${products.length} (${pct}%)`);
      } else {
        errorCount += batch.length;
        console.log(`\n  Error batch ${i}: ${result.status} - ${result.body.substring(0, 200)}`);
      }
    } catch (e) {
      errorCount += batch.length;
      console.log(`\n  Network error batch ${i}: ${e.message}`);
    }

    // Small delay between batches to avoid rate limiting
    await sleep(300);
  }

  console.log(`\n\nDone! Successfully uploaded: ${successCount}, Errors: ${errorCount}`);
}

main();
