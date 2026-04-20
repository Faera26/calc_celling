const { execSync } = require('child_process');
const fs = require('fs');

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_SECRET_KEY';

const catalogData = JSON.parse(fs.readFileSync('app/src/data/catalog.json', 'utf-8'));

function seedData() {
  console.log(`Starting to upload ${catalogData.products.length} products to Supabase via CURL...`);
  
  const batchSize = 100;
  for (let i = 0; i < catalogData.products.length; i += batchSize) {
    const batch = catalogData.products.slice(i, i + batchSize).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory || null,
      price: p.price || 0,
      unit: p.unit || 'шт',
      image: p.image || null,
      description: p.description || null
    }));

    fs.writeFileSync('temp_batch.json', JSON.stringify(batch));

    try {
      console.log(`Uploading batch ${i} to ${i + batchSize}...`);
      const result = execSync(`curl -s -X POST "${supabaseUrl}/rest/v1/products" ` +
        `-H "apikey: ${supabaseKey}" ` +
        `-H "Authorization: Bearer ${supabaseKey}" ` +
        `-H "Content-Type: application/json" ` +
        `-H "Prefer: resolution=merge-duplicates" ` +
        `-d @temp_batch.json`);
      
      const out = result.toString();
      if(out) console.log("Response:", out); // Normally empty on success
    } catch (e) {
      console.error(`Curl error on batch ${i}:`, e.message);
      if(e.stdout) console.log(e.stdout.toString());
      if(e.stderr) console.log(e.stderr.toString());
    }
  }
  
  if (fs.existsSync('temp_batch.json')) {
    fs.unlinkSync('temp_batch.json');
  }
  console.log('Finished uploading products!');
}

seedData();
