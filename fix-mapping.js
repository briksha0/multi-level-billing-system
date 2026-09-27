const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminBilling.jsx', 'utf8');

// The regex will match \{salesBills\.map\(\(bill, index\) => \{
content = content.replace(/\{salesBills\.map\(\(bill,\s*index\)\s*=>\s*\{/g, '{filteredBills.map((bill, index) => {');

fs.writeFileSync('src/pages/admin/AdminBilling.jsx', content);
console.log('Fixed salesBills mapping');
