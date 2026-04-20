const https = require('https');
const fs = require('fs');

const SUPABASE_HOST = 'rreqijywlhsodppwebjy.supabase.co';
const ANON_KEY = 'sb_publishable_aVVYUkx_p3xW3a--cm57oA_s-n5IsFU';
const MAX_ATTEMPTS = 6;
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================
// Step 1: Parse the second HTML file to extract CATALOG_DATA
// ============================================================
console.log('=== Step 1: Parsing second HTML file ===');
const html = fs.readFileSync('13_Каталог_HTML_2.html', 'utf-8');

const match = html.match(/const CATALOG_DATA\s*=\s*(\{[\s\S]*?\});\s*\n/);
if (!match) {
  console.error('Could not find CATALOG_DATA in HTML!');
  process.exit(1);
}

let catalogData;
try {
  catalogData = JSON.parse(match[1]);
} catch (e) {
  // Try extracting with a bigger regex
  const match2 = html.match(/const CATALOG_DATA\s*=\s*(\{.*\});/s);
  if (!match2) {
    console.error('Could not parse CATALOG_DATA!');
    process.exit(1);
  }
  catalogData = JSON.parse(match2[1]);
}

const nodes = catalogData.nodes || [];
console.log(`  Found ${nodes.length} nodes`);

// ============================================================
// Step 2: Extract unique services from node components
// ============================================================
console.log('\n=== Step 2: Extracting services ===');
const servicesMap = new Map();

nodes.forEach(node => {
  if (!node.components) return;
  node.components.forEach(comp => {
    if (comp.kind === 'Работа' && comp.id && !servicesMap.has(comp.id)) {
      servicesMap.set(comp.id, {
        id: String(comp.id),
        name: comp.name,
        type: 'service',
        category: comp.category || 'Без категории',
        subcategory: comp.subcategory || 'Без подкатегории',
        price: comp.price || 0,
        unit: comp.unit || 'шт',
        image: comp.image || null,
        description: comp.comment || null
      });
    }
  });
});

const services = Array.from(servicesMap.values());
console.log(`  Found ${services.length} unique services`);

// Also extract products that may not be in the first catalog
const newProductsMap = new Map();
nodes.forEach(node => {
  if (!node.components) return;
  node.components.forEach(comp => {
    if (comp.kind === 'Товар' && comp.id && !newProductsMap.has(comp.id)) {
      newProductsMap.set(comp.id, {
        id: String(comp.id),
        name: comp.name,
        type: 'product',
        category: comp.category || 'Без категории',
        subcategory: comp.subcategory || 'Без подкатегории',
        price: comp.price || 0,
        unit: comp.unit || 'шт',
        image: comp.image || null,
        description: comp.comment || null
      });
    }
  });
});
const newProducts = Array.from(newProductsMap.values());
console.log(`  Found ${newProducts.length} unique products referenced in nodes`);

// ============================================================
// Helper: make HTTPS requests to Supabase
// ============================================================
function makeRequest(method, path, body, prefer = 'resolution=merge-duplicates,return=minimal') {
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
        'Prefer': prefer
      }
    };
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    if (postData) req.write(postData);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function requestWithRetry(method, path, body, prefer) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await makeRequest(method, path, body, prefer);
      if (!isRetryableStatus(result.status) || attempt === MAX_ATTEMPTS) {
        return result;
      }
      lastError = new Error(`${result.status} - ${result.body.substring(0, 150)}`);
    } catch (e) {
      lastError = e;
      if (attempt === MAX_ATTEMPTS) throw e;
    }

    const delay = Math.min(12000, 800 * attempt * attempt);
    await sleep(delay);
  }

  throw lastError;
}

async function deleteRows(tableName, filter) {
  const result = await requestWithRetry(
    'DELETE',
    `/rest/v1/${tableName}?${filter}`,
    null,
    'return=minimal'
  );

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Failed to clear ${tableName}: ${result.status} - ${result.body}`);
  }
}

async function countRows(tableName) {
  const result = await requestWithRetry(
    'GET',
    `/rest/v1/${tableName}?select=id`,
    null,
    'count=exact'
  );

  const range = result.headers?.['content-range'] || '';
  const count = Number(range.split('/')[1]);
  return Number.isFinite(count) ? count : null;
}

function componentKey(row) {
  return JSON.stringify({
    node_id: row.node_id == null ? null : String(row.node_id),
    item_id: row.item_id == null ? null : String(row.item_id),
    kind: row.kind || null,
    name: row.name || null,
    qty: Number(row.qty || 0),
    unit: row.unit || '',
    price: Number(row.price || 0),
    total: Number(row.total || 0),
    category: row.category || null,
    subcategory: row.subcategory || null,
    image: row.image || null,
    comment: row.comment || null
  });
}

async function fetchRows(tableName, select, pageSize = 100) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await requestWithRetry(
      'GET',
      `/rest/v1/${tableName}?select=${select}&order=id&limit=${pageSize}&offset=${offset}`,
      null,
      'return=representation'
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Failed to fetch ${tableName}: ${result.status} - ${result.body}`);
    }

    const page = JSON.parse(result.body || '[]');
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function dedupeNodeComponents() {
  console.log('  Checking node_components duplicates...');
  const rows = await fetchRows(
    'node_components',
    'id,node_id,item_id,kind,name,qty,unit,price,total'
  );

  const seen = new Set();
  const duplicateIds = [];

  for (const row of rows) {
    const key = componentKey(row);
    if (seen.has(key)) {
      duplicateIds.push(row.id);
    } else {
      seen.add(key);
    }
  }

  if (duplicateIds.length === 0) {
    console.log(`  No duplicates found (${rows.length} rows).`);
    return;
  }

  console.log(`  Removing ${duplicateIds.length} duplicate component rows...`);
  for (let i = 0; i < duplicateIds.length; i += 100) {
    const chunk = duplicateIds.slice(i, i + 100);
    await deleteRows('node_components', `id=in.(${chunk.join(',')})`);
  }
  console.log(`  Duplicates removed. Kept ${seen.size} unique rows.`);
}

async function uploadBatch(tableName, items, batchSize = 20) {
  let success = 0, errors = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    let done = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !done; attempt++) {
      try {
        if (attempt > 0) await sleep(Math.min(12000, 800 * attempt * attempt));
        const result = await makeRequest('POST', `/rest/v1/${tableName}`, batch);
        if (result.status >= 200 && result.status < 300) {
          success += batch.length;
          done = true;
        } else if (result.status === 409) {
          // duplicate - that's ok
          success += batch.length;
          done = true;
        } else {
          if (attempt === MAX_ATTEMPTS - 1) {
            errors += batch.length;
            console.log(`\n  Error at ${i}: ${result.status} - ${result.body.substring(0, 150)}`);
          }
        }
      } catch (e) {
        if (attempt === MAX_ATTEMPTS - 1) {
          errors += batch.length;
          console.log(`\n  Network error at ${i}: ${e.message}`);
        }
      }
    }
    const pct = Math.round((i + batch.length) / items.length * 100);
    process.stdout.write(`\r  Progress: ${success}/${items.length} (${pct}%)`);
    await sleep(800);
  }
  console.log(`\n  Done: ${success} uploaded, ${errors} errors`);
  return { success, errors };
}

// ============================================================
// Step 3: Upload everything
// ============================================================
async function main() {
  // 3a. Update existing products with type='product' and upload new products from nodes
  console.log('\n=== Step 3a: Uploading products referenced in nodes ===');
  await uploadBatch('products', newProducts);

  // 3b. Upload services
  console.log('\n=== Step 3b: Uploading services ===');
  await uploadBatch('products', services);

  // 3c. Update all existing products (from first HTML) to have type='product'
  console.log('\n=== Step 3c: Setting type for existing products ===');
  const updateResult = await makeRequest(
    'PATCH',
    '/rest/v1/products?type=is.null',
    { type: 'product' }
  );
  console.log(`  Update status: ${updateResult.status}`);

  // 3d. Upload nodes
  console.log('\n=== Step 3d: Uploading nodes ===');
  const nodeRows = nodes.map(n => ({
    id: String(n.id),
    name: n.name,
    category: n.category || 'Без категории',
    subcategory: n.subcategory || 'Без подкатегории',
    price: n.price || 0,
    unit: n.unit || '',
    image: n.image || null,
    description: n.description || null
  }));
  await uploadBatch('nodes', nodeRows);

  // 3e. Upload node components
  console.log('\n=== Step 3e: Uploading node components ===');
  const componentRows = [];
  nodes.forEach(node => {
    if (!node.components) return;
    node.components.forEach(comp => {
      componentRows.push({
        node_id: String(node.id),
        item_id: String(comp.id),
        kind: comp.kind,
        name: comp.name,
        qty: comp.qty || 0,
        unit: comp.unit || '',
        price: comp.price || 0,
        total: comp.total || 0,
        category: comp.category || null,
        subcategory: comp.subcategory || null,
        image: comp.image || null,
        comment: comp.comment || null
      });
    });
  });
  console.log(`  Total components to upload: ${componentRows.length}`);

  // node_components has a SERIAL id, so repeated interrupted runs would create duplicates.
  // Clear it first, then insert the full component list again.
  console.log('  Clearing old node_components...');
  await deleteRows('node_components', 'id=gt.0');

  let compSuccess = 0, compErrors = 0;
  const BATCH = 15;
  for (let i = 0; i < componentRows.length; i += BATCH) {
    const batch = componentRows.slice(i, i + BATCH);
    let done = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !done; attempt++) {
      try {
        if (attempt > 0) await sleep(Math.min(12000, 800 * attempt * attempt));
        const postData = JSON.stringify(batch);
        const result = await new Promise((resolve, reject) => {
          const options = {
            hostname: SUPABASE_HOST,
            path: '/rest/v1/node_components',
            method: 'POST',
            headers: {
              'apikey': ANON_KEY,
              'Authorization': `Bearer ${ANON_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
              'Content-Length': Buffer.byteLength(postData)
            }
          };
          const req = https.request(options, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
              const data = Buffer.concat(chunks).toString('utf8');
              resolve({ status: res.statusCode, body: data });
            });
          });
          req.on('error', reject);
          req.setTimeout(REQUEST_TIMEOUT_MS, () => {
            req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
          });
          req.write(postData);
          req.end();
        });

        if (result.status >= 200 && result.status < 300) {
          compSuccess += batch.length;
          done = true;
        } else {
          if (attempt === MAX_ATTEMPTS - 1) {
            compErrors += batch.length;
            console.log(`\n  Error at ${i}: ${result.status} - ${result.body.substring(0, 150)}`);
          }
        }
      } catch (e) {
        if (attempt === MAX_ATTEMPTS - 1) {
          compErrors += batch.length;
          console.log(`\n  Network error at ${i}: ${e.message}`);
        }
      }
    }
    const pct = Math.round((i + batch.length) / componentRows.length * 100);
    process.stdout.write(`\r  Progress: ${compSuccess}/${componentRows.length} (${pct}%)`);
    await sleep(800);
  }
  console.log(`\n  Done: ${compSuccess} uploaded, ${compErrors} errors`);
  await dedupeNodeComponents();

  // Summary
  console.log('\n========================================');
  console.log('SUMMARY:');
  console.log(`  Products (from nodes): ${newProducts.length}`);
  console.log(`  Services: ${services.length}`);
  console.log(`  Nodes: ${nodeRows.length}`);
  console.log(`  Node components: ${componentRows.length}`);
  console.log('\nSupabase counts:');
  for (const tableName of ['products', 'nodes', 'node_components']) {
    try {
      console.log(`  ${tableName}: ${await countRows(tableName)}`);
    } catch (e) {
      console.log(`  ${tableName}: count failed (${e.message})`);
    }
  }
  console.log('========================================');
}

if (process.argv.includes('--dedupe-only')) {
  dedupeNodeComponents()
    .then(async () => {
      console.log(`  node_components: ${await countRows('node_components')}`);
    })
    .catch(e => {
      console.error('Fatal error:', e);
      process.exitCode = 1;
    });
} else {
  main().catch(e => {
    console.error('Fatal error:', e);
    process.exitCode = 1;
  });
}
