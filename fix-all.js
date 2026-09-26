const fs = require('fs');
let content = fs.readFileSync('src/components/BillingReceipt.jsx', 'utf8');

// Fix 1: Add missing backticks to the style block
content = content.replace(/<style>\{[\s\n]*@media print/g, '<style>{\n        @media print');
content = content.replace(/[\s\n]*\}\s*\}<\/style>/g, '\n        }\n      }</style>');

// Fix 2: Clean up the corrupted rupee symbol in the table body and footer
content = content.replace(/\uFFFD,1/g, '₹');
content = content.replace(/,1/g, '₹');

// Also just in case the weird character is gone but ',1' remains:
content = content.replace(/,1\{/g, '₹{');
content = content.replace(/Price \(\?,1\)/g, 'Price (₹)');
content = content.replace(/Price \(\?,1\)/g, 'Price (₹)');
content = content.replace(/Amount \(\?,1\)/g, 'Amount (₹)');
content = content.replace(/Price \(\?\)/g, 'Price (₹)');
content = content.replace(/Amount \(\?\)/g, 'Amount (₹)');

fs.writeFileSync('src/components/BillingReceipt.jsx', content);
console.log('Fixed syntax and symbols');
