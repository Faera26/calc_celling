const fs = require('fs');

const html = fs.readFileSync('13_Каталог_HTML.html', 'utf-8');

// Find the CATALOG_DATA object
const match = html.match(/const CATALOG_DATA = ({.*?});/s);
if (match && match[1]) {
  fs.mkdirSync('app/src/data', { recursive: true });
  fs.writeFileSync('app/src/data/catalog.json', match[1], 'utf-8');
  console.log('Successfully extracted CATALOG_DATA to app/src/data/catalog.json');
} else {
  console.log('Failed to find CATALOG_DATA in HTML');
}
