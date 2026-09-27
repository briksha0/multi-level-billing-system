const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminBilling.jsx', 'utf8');

content = content.replace(
  '<tbody>\n                {salesBills.map((bill, index) => {',
  '<tbody>\n                {filteredBills.map((bill, index) => {'
);
content = content.replace(
  '{salesBills.length === 0 && (',
  '{filteredBills.length === 0 && ('
);

content = content.replace(
  '<th className="table-header px-6 py-4">Buyer Name</th>',
  '<th className="table-header px-6 py-4">Seller (Billed By)</th>\n                <th className="table-header px-6 py-4">Buyer (Billed To)</th>'
);

content = content.replace(
  "const buyerName = buyer?.name || bill.buyerName || bill.buyer_name || 'Partner / SS'",
  "const buyerName = buyer?.name || bill.buyerName || bill.buyer_name || 'Partner / SS'\n                  const seller = bill.sellerId ? getUserById(bill.sellerId) : null;\n                  const sellerName = seller?.name || bill.sellerName || bill.seller_name || 'Admin';"
);

content = content.replace(
  '<td className="px-6 py-4 text-white font-semibold">{buyerName}</td>',
  '<td className="px-6 py-4 text-amber-300 font-semibold">{sellerName}</td>\n                      <td className="px-6 py-4 text-white font-semibold">{buyerName}</td>'
);

fs.writeFileSync('src/pages/admin/AdminBilling.jsx', content);
console.log('AdminBilling.jsx updated successfully');
