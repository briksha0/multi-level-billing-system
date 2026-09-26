const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminBilling.jsx', 'utf8');

content = content.replace(
  'const discount = billForm.discount || 0\n  const grandTotal = subtotal - discount + gst',
  'const discountPercent = billForm.discount || 0\n  const discountAmount = (subtotal * discountPercent) / 100\n  const grandTotal = subtotal - discountAmount + gst'
);

content = content.replace(
  'discount: parseFloat(discount)',
  'discount: parseFloat(discountAmount.toFixed(2))'
);

content = content.replace(
  '<span className="text-dark-muted">Discount</span>',
  '<span className="text-dark-muted">Discount (%)</span>'
);

// Edit form
content = content.replace(
  'discount: parseFloat(editForm.discount) || 0',
  'discount: parseFloat(((calculateSubtotal() * (parseFloat(editForm.discount) || 0)) / 100).toFixed(2))'
);

content = content.replace(
  'Discount (?)',
  'Discount (%)'
);

// When loading edit form, we must convert absolute discount back to percent
// The code says: discount: Number(bill.discount || 0)
// To convert it to percent: 
// subtotal of bill = bill.subtotal or sum of items
// wait, we can just replace the initialization:
content = content.replace(
  'discount: Number(bill.discount || 0),',
  'discount: (Number(bill.discount || 0) / (items.reduce((s,i) => s + (Number(i.quantity||1)*Number(i.rate||0)), 0) || 1) * 100).toFixed(2),'
);

fs.writeFileSync('src/pages/admin/AdminBilling.jsx', content);
console.log('Done');
