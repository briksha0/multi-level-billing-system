const fs = require('fs');
let content = fs.readFileSync('src/components/BillingReceipt.jsx', 'utf8');

// The file contains corrupted unicode before the { in those 3 lines.
// We can just replace the entire lines 128, 129, 130 since we know what they are.

content = content.replace(
  /<td className="p-2\.5 text-right">.*?\{Number\(item\.rate \|\| 0\)\.toFixed\(2\)\}<\/td>/g,
  '<td className="p-2.5 text-right">₹{Number(item.rate || 0).toFixed(2)}</td>'
);

content = content.replace(
  /<td className="p-2\.5 text-right text-slate-600">.*?\{gstAmt\.toFixed\(2\)\}<\/td>/g,
  '<td className="p-2.5 text-right text-slate-600">₹{gstAmt.toFixed(2)}</td>'
);

content = content.replace(
  /<td className="p-2\.5 text-right font-medium text-slate-900">.*?\{totalWithGst\.toLocaleString\(undefined, \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\)\}<\/td>/g,
  '<td className="p-2.5 text-right font-medium text-slate-900">₹{totalWithGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>'
);

fs.writeFileSync('src/components/BillingReceipt.jsx', content);
console.log('Fixed line 128-130');
