const fs = require('fs');
const files = ['src/pages/ss/SSBilling.jsx', 'src/pages/distributor/DistributorBilling.jsx'];

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    'const discount = billForm.discount || 0\n  const grandTotal = subtotal - discount + gst',
    'const discountPercent = billForm.discount || 0\n  const discountAmount = (subtotal * discountPercent) / 100\n  const grandTotal = subtotal - discountAmount + gst'
  );

  content = content.replace(
    'discount: parseFloat(discount),',
    'discount: parseFloat(discountAmount.toFixed(2)),'
  );

  content = content.replace(
    '<span className="text-dark-muted">Discount</span>',
    '<span className="text-dark-muted">Discount (%)</span>'
  );

  content = content.replace(
    'discount: parseFloat(editForm.discount) || 0,',
    'discount: parseFloat(((editForm.items.reduce((sum, item) => sum + item.quantity * item.rate, 0) * (parseFloat(editForm.discount) || 0)) / 100).toFixed(2)),'
  );

  content = content.replace(
    'Discount (?)',
    'Discount (%)'
  );

  content = content.replace(
    'discount: Number(bill.discount || 0),',
    'discount: (Number(bill.discount || 0) / (items.reduce((s,i) => s + (Number(i.quantity||1)*Number(i.rate||0)), 0) || 1) * 100).toFixed(2),'
  );

  fs.writeFileSync(file, content);
}
console.log('Fixed SS and Distributor billing too');
