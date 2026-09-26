const fs = require('fs');
let content = fs.readFileSync('src/components/BillingReceipt.jsx', 'utf8');

content = content.replace(/Price \(.*?\)/g, 'Price (₹)');
content = content.replace(/Amount \(.*?\)/g, 'Amount (₹)');

fs.writeFileSync('src/components/BillingReceipt.jsx', content);
console.log('Fixed table headers');
