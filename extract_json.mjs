import fs from 'fs';

function extractData(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const searchStr = 'const CATALOG_DATA = ';
  const startIndex = content.indexOf(searchStr);
  if (startIndex === -1) {
    console.error(`Could not find CATALOG_DATA in ${filePath}`);
    return null;
  }
  
  let jsonStr = content.substring(startIndex + searchStr.length);
  // The JSON object is assigned to the constant and ends with a semicolon.
  // The next line is usually "let cart =" or something similar.
  const match = jsonStr.match(/};\s*(let |const |var |function |document\.)/);
  if (match) {
    jsonStr = jsonStr.substring(0, match.index + 1);
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error(`Failed to parse JSON in ${filePath}:`, e.message);
    // Write out the first and last 100 chars to debug
    console.log("Starts with:", jsonStr.substring(0, 100));
    console.log("Ends with:", jsonStr.substring(jsonStr.length - 100));
    return null;
  }
}

const data1 = extractData('c:/Users/ILYA/Desktop/Приложение/13_Каталог_HTML.html');
const data2 = extractData('c:/Users/ILYA/Desktop/Приложение/13_Каталог_HTML_2.html');

const products = [...(data1?.products || []), ...(data2?.products || [])];
const nodes = [...(data1?.nodes || []), ...(data2?.nodes || [])];

const unitsMap = new Map();

for (const p of products) {
  if (p.unit) unitsMap.set(p.name.trim(), p.unit.trim());
}
for (const n of nodes) {
  if (n.unit) unitsMap.set(n.name.trim(), n.unit.trim());
  if (n.components) {
    for (const comp of n.components) {
       if (comp.unit) unitsMap.set(comp.name.trim(), comp.unit.trim());
    }
  }
}

console.log(`Found ${unitsMap.size} unique items with units.`);

let sql = '';
for (const [name, unit] of unitsMap.entries()) {
  if (unit) {
    const safeName = name.replace(/'/g, "''");
    sql += `UPDATE tovary SET unit = '${unit}' WHERE name = '${safeName}';\n`;
    sql += `UPDATE uslugi SET unit = '${unit}' WHERE name = '${safeName}';\n`;
    sql += `UPDATE uzly SET unit = '${unit}' WHERE name = '${safeName}';\n`;
  }
}

fs.writeFileSync('c:/Users/ILYA/Desktop/Приложение/update_units.sql', sql);
console.log('SQL generated.');
