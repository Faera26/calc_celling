const fs = require('fs');
const https = require('https');

const SUPABASE_HOST = 'rreqijywlhsodppwebjy.supabase.co';
const ANON_KEY = 'sb_publishable_aVVYUkx_p3xW3a--cm57oA_s-n5IsFU';
const MAX_ATTEMPTS = 6;
const REQUEST_TIMEOUT_MS = 30000;

function readCatalogFromHtml(path) {
  const html = fs.readFileSync(path, 'utf8');
  const match = html.match(/const CATALOG_DATA\s*=\s*(\{[\s\S]*?\});\s*\n/);
  if (!match) {
    throw new Error(`CATALOG_DATA not found in ${path}`);
  }
  return JSON.parse(match[1]);
}

function asText(value, fallback = '') {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function asNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function productRow(item, source) {
  return {
    id: asText(item.id),
    name: asText(item.name, 'Без названия'),
    category: asText(item.category, 'Без категории'),
    subcategory: asText(item.subcategory, 'Без подкатегории'),
    price: asNumber(item.price),
    unit: asText(item.unit),
    image: asText(item.image) || null,
    description: asText(item.description || item.comment) || null,
    source,
    raw: item
  };
}

function serviceRow(item, source) {
  return productRow(item, source);
}

function nodeRow(item) {
  return {
    id: asText(item.id),
    name: asText(item.name, 'Без названия'),
    category: asText(item.category, 'Без категории'),
    subcategory: asText(item.subcategory, 'Без подкатегории'),
    price: asNumber(item.price),
    unit: asText(item.unit),
    image: asText(item.image) || null,
    description: asText(item.description) || null,
    stats: item.stats || null,
    raw: item
  };
}

function betterRow(oldRow, newRow) {
  if (!oldRow) return newRow;
  return {
    ...oldRow,
    name: oldRow.name || newRow.name,
    category: oldRow.category === 'Без категории' ? newRow.category : oldRow.category,
    subcategory: oldRow.subcategory === 'Без подкатегории' ? newRow.subcategory : oldRow.subcategory,
    price: oldRow.price || newRow.price,
    unit: oldRow.unit || newRow.unit,
    image: oldRow.image || newRow.image,
    description: oldRow.description || newRow.description,
    source: oldRow.source.includes(newRow.source) ? oldRow.source : `${oldRow.source},${newRow.source}`,
    raw: oldRow.raw || newRow.raw
  };
}

function categoryId(entityType, category, subcategory) {
  const key = `${category}|${subcategory}`;
  const encoded = Buffer.from(key, 'utf8').toString('base64url').slice(0, 80);
  return `${entityType}:${encoded}`;
}

function buildNormalizedCatalog() {
  const html1 = readCatalogFromHtml('13_Каталог_HTML.html');
  const html2 = readCatalogFromHtml('13_Каталог_HTML_2.html');

  const tovary = new Map();
  const uslugi = new Map();
  const uzly = new Map();
  const komplektaciyaUzlov = [];

  for (const item of html1.products || []) {
    const row = productRow(item, 'html_1.products');
    if (row.id) tovary.set(row.id, betterRow(tovary.get(row.id), row));
  }

  for (const item of html2.products || []) {
    const row = productRow(item, 'html_2.products');
    if (row.id) tovary.set(row.id, betterRow(tovary.get(row.id), row));
  }

  for (const item of html2.services || []) {
    const row = serviceRow(item, 'html_2.services');
    if (row.id) uslugi.set(row.id, betterRow(uslugi.get(row.id), row));
  }

  for (const node of html2.nodes || []) {
    const uzel = nodeRow(node);
    if (!uzel.id) continue;
    uzly.set(uzel.id, uzel);

    (node.components || []).forEach((component, index) => {
      const isService = component.kind === 'Работа';
      const itemType = isService ? 'usluga' : 'tovar';
      const itemId = asText(component.id);
      const componentSource = isService ? 'node_component.service' : 'node_component.product';

      if (itemId && isService && !uslugi.has(itemId)) {
        uslugi.set(itemId, serviceRow(component, componentSource));
      }
      if (itemId && !isService && !tovary.has(itemId)) {
        tovary.set(itemId, productRow(component, componentSource));
      }

      komplektaciyaUzlov.push({
        id: `${uzel.id}:${index + 1}`,
        uzel_id: uzel.id,
        position_index: index + 1,
        item_type: itemType,
        item_id: itemId,
        item_name: asText(component.name, 'Без названия'),
        qty: asNumber(component.qty || 1),
        unit: asText(component.unit),
        price: asNumber(component.price),
        total: asNumber(component.total),
        category: asText(component.category) || null,
        subcategory: asText(component.subcategory) || null,
        image: asText(component.image) || null,
        comment: asText(component.comment) || null,
        raw: component
      });
    });
  }

  const kategoriiMap = new Map();
  function addCategories(entityType, rows) {
    for (const row of rows) {
      const category = row.category || 'Без категории';
      const subcategory = row.subcategory || 'Без подкатегории';
      const id = categoryId(entityType, category, subcategory);
      const current = kategoriiMap.get(id) || {
        id,
        entity_type: entityType,
        category,
        subcategory,
        items_count: 0
      };
      current.items_count += 1;
      kategoriiMap.set(id, current);
    }
  }

  const catalog = {
    tovary: [...tovary.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    uslugi: [...uslugi.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    uzly: [...uzly.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    komplektaciya_uzlov: komplektaciyaUzlov,
    kategorii: []
  };

  addCategories('tovar', catalog.tovary);
  addCategories('usluga', catalog.uslugi);
  addCategories('uzel', catalog.uzly);
  catalog.kategorii = [...kategoriiMap.values()].sort((a, b) =>
    `${a.entity_type}:${a.category}:${a.subcategory}`.localeCompare(`${b.entity_type}:${b.category}:${b.subcategory}`, 'ru')
  );

  return catalog;
}

function makeRequest(method, path, body, prefer = 'return=minimal') {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SUPABASE_HOST,
      path,
      method,
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: prefer
      }
    };

    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8')
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`)));
    if (postData) req.write(postData);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryable(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function requestWithRetry(method, path, body, prefer) {
  let last;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await makeRequest(method, path, body, prefer);
      if (!retryable(result.status) || attempt === MAX_ATTEMPTS) return result;
      last = new Error(`${result.status}: ${result.body.slice(0, 200)}`);
    } catch (error) {
      last = error;
      if (attempt === MAX_ATTEMPTS) throw error;
    }
    await sleep(Math.min(12000, attempt * attempt * 700));
  }
  throw last;
}

async function ensureTable(table) {
  const result = await requestWithRetry('GET', `/rest/v1/${table}?select=id&limit=1`, null, 'return=representation');
  if (result.status === 404 || result.body.includes('does not exist')) {
    throw new Error(`Table "${table}" not found. Run supabase_schema_human.sql in Supabase SQL Editor first.`);
  }
  if (result.status >= 400) {
    throw new Error(`Cannot read "${table}": ${result.status} ${result.body}`);
  }
}

async function clearTable(table) {
  const result = await requestWithRetry('DELETE', `/rest/v1/${table}?id=not.is.null`, null, 'return=minimal');
  if (result.status >= 400) {
    throw new Error(`Cannot clear "${table}": ${result.status} ${result.body}`);
  }
}

function slimForDatabase(row) {
  const { raw, ...rest } = row;
  return rest;
}

async function uploadTable(table, rows, batchSize = 10) {
  let uploaded = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(slimForDatabase);
    const result = await requestWithRetry(
      'POST',
      `/rest/v1/${table}?on_conflict=id`,
      batch,
      'resolution=merge-duplicates,return=minimal'
    );
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Upload failed for "${table}" at ${i}: ${result.status} ${result.body || result.statusText || ''}`);
    }
    uploaded += batch.length;
    process.stdout.write(`\r  ${table}: ${uploaded}/${rows.length}`);
    await sleep(250);
  }
  console.log('');
}

async function countTable(table) {
  const result = await requestWithRetry(
    'GET',
    `/rest/v1/${table}?select=id`,
    null,
    'count=exact'
  );
  const contentRange = result.headers['content-range'] || '';
  return Number(contentRange.split('/')[1]);
}

async function seed(catalog) {
  const tables = ['komplektaciya_uzlov', 'kategorii', 'tovary', 'uslugi', 'uzly'];
  for (const table of tables) await ensureTable(table);

  if (process.argv.includes('--reset')) {
    console.log('Clearing old normalized catalog...');
    await clearTable('komplektaciya_uzlov');
    await clearTable('kategorii');
    await clearTable('tovary');
    await clearTable('uslugi');
    await clearTable('uzly');
  } else {
    console.log('Upserting normalized catalog without clearing existing rows...');
  }

  console.log('Uploading normalized catalog...');
  await uploadTable('tovary', catalog.tovary, 10);
  await uploadTable('uslugi', catalog.uslugi, 10);
  await uploadTable('uzly', catalog.uzly, 10);
  await uploadTable('komplektaciya_uzlov', catalog.komplektaciya_uzlov, 10);
  await uploadTable('kategorii', catalog.kategorii, 10);

  console.log('\nSupabase counts:');
  for (const table of ['tovary', 'uslugi', 'uzly', 'komplektaciya_uzlov', 'kategorii']) {
    console.log(`  ${table}: ${await countTable(table)}`);
  }
}

async function main() {
  const catalog = buildNormalizedCatalog();
  fs.mkdirSync('app/src/data', { recursive: true });
  fs.writeFileSync('app/src/data/normalized_catalog.json', JSON.stringify(catalog, null, 2), 'utf8');

  console.log('Normalized catalog:');
  console.log(`  tovary: ${catalog.tovary.length}`);
  console.log(`  uslugi: ${catalog.uslugi.length}`);
  console.log(`  uzly: ${catalog.uzly.length}`);
  console.log(`  komplektaciya_uzlov: ${catalog.komplektaciya_uzlov.length}`);
  console.log(`  kategorii: ${catalog.kategorii.length}`);

  if (process.argv.includes('--dry-run')) return;
  await seed(catalog);
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exitCode = 1;
});
