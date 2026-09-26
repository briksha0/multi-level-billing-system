const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminBilling.jsx', 'utf8');

content = content.replace(
  'Create bills for Super Stores and automatically transfer stock',
  'Create bills for any user and automatically transfer stock'
);

fs.writeFileSync('src/pages/admin/AdminBilling.jsx', content);
console.log('Fixed UI text');
