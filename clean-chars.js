const fs = require('fs');
let content = fs.readFileSync('src/components/BillingReceipt.jsx', 'utf8');

// Replace standard unicode replacement character or the exact corrupted byte
content = content.replace(/\uFFFD/g, '');
content = content.replace(//g, '');

fs.writeFileSync('src/components/BillingReceipt.jsx', content);
console.log('Cleaned up corrupted characters');
