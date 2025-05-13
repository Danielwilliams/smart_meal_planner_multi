const fs = require('fs');
const file = './src/pages/ShoppingListPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace { and } around the ternary operator
content = content.replace(
  /\) : \(\s*\/\/ No AI data.*\s*{(aiShoppingData \? \(.*\s*.*\s*.*\s*.*\s*.*\s*\) : \(.*\s*.*\s*.*\s*.*\s*.*\s*.*\s*\))}(\s*\)\})/s,
  ') : (\n            // No AI data, just show regular shopping list\n            $1\n          )}'
);

fs.writeFileSync(file, content);
console.log('Fixed ternary syntax');
