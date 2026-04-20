import fs from 'fs';

const file1 = fs.readFileSync('c:/Users/ILYA/Desktop/Приложение/13_Каталог_HTML.html', 'utf-8');
const file2 = fs.readFileSync('c:/Users/ILYA/Desktop/Приложение/13_Каталог_HTML_2.html', 'utf-8');

function parseUnits(html, source) {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  
  let match;
  let count = 0;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowStr = match[1];
    const tds = [];
    let tdMatch;
    
    // Some lines have images before the name, need to handle that if needed, 
    // but typically it's <td class="left">...<img...> Name</td>
    // Let's strip HTML tags.
    while ((tdMatch = tdRegex.exec(rowStr)) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]*>/g, '').trim());
    }
    
    if (tds.length >= 3) {
      // Find the first non-empty TD that isn't a checkbox/number
      let nameIdx = 0;
      if (!tds[0] || tds[0].length < 3) nameIdx = 1; // skip checkbox or empty td
      
      const name = tds[nameIdx];
      const price = tds[nameIdx + 1];
      const unit = tds[nameIdx + 2];
      
      if (name && unit && unit.length < 10 && count < 20) {
        console.log(`[${source}] Name: ${name}, Unit: ${unit}`);
        count++;
      }
    }
  }
}

parseUnits(file1, 'File 1');
parseUnits(file2, 'File 2');
