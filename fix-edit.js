const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminBilling.jsx', 'utf8');

content = content.replace(
  'calculateSubtotal() * (parseFloat(editForm.discount) || 0)',
  'editForm.items.reduce((sum, item) => sum + item.quantity * item.rate, 0) * (parseFloat(editForm.discount) || 0)'
);

fs.writeFileSync('src/pages/admin/AdminBilling.jsx', content);
console.log('Fixed edit modal discount calculation');
