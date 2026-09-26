const fs = require('fs');
let content = fs.readFileSync('src/components/BillingReceipt.jsx', 'utf8');

// Replace all occurrences of the weird character followed by ",1" with "₹"
content = content.replace(/\uFFFD,1/g, '₹');
content = content.replace(/,1/g, '₹');

fs.writeFileSync('src/components/BillingReceipt.jsx', content);
console.log('Fixed weird characters');
