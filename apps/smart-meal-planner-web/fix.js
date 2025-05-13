const fs = require('fs');
const file = './src/pages/ShoppingListPage.jsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/}\s*else\s+if/g, '} else if');
fs.writeFileSync(file, content);
