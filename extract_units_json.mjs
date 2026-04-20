import fs from 'fs';

function extractData(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const searchStr = 'const CATALOG_DATA = ';
  const startIndex = content.indexOf(searchStr);
  if (startIndex === -1) return null;
  
  let jsonStr = content.substring(startIndex + searchStr.length);
  const match = jsonStr.match(/};\s*(let |const |var |function |document\.)/);
  if (match) {
    jsonStr = jsonStr.substring(0, match.index + 1);
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
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

const result = Array.from(unitsMap.entries()).map(([name, unit]) => ({ name, unit }));
fs.writeFileSync('c:/Users/ILYA/Desktop/Приложение/units.json', JSON.stringify(result, null, 2));
console.log(`Saved ${result.length} units to units.json`);
