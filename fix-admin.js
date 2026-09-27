// fix-admin.js
const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/AdminBilling.jsx', 'utf8');

// 1. Add filteredBills state variables right after billableUsers
const insertIndex = content.indexOf("const billableUsers = allUsers.filter(u => u.role !== 'ADMIN')");
if (insertIndex > -1) {
  const insertPos = content.indexOf('\n', insertIndex) + 1;
  
  const filterLogic = `
  const [selectedSellerFilter, setSelectedSellerFilter] = useState('ALL')
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState('ALL')
  const filteredBills = salesBills.filter(bill => {
    const sellerId = bill.sellerId || bill.seller_id
    const buyerId = bill.buyerId || bill.buyer_id
    if (selectedSellerFilter !== 'ALL' && Number(sellerId) !== Number(selectedSellerFilter)) return false
    if (selectedBuyerFilter !== 'ALL' && Number(buyerId) !== Number(selectedBuyerFilter)) return false
    return true
  })
`;
  
  content = content.slice(0, insertPos) + filterLogic + content.slice(insertPos);
}

// 2. Fix the missing UI filters above the "Bills List" section
const filterUI = `        {/* Filters Bar */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-dark-muted">Filter Network Bills:</div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted">Seller:</span>
            <select
              value={selectedSellerFilter}
              onChange={(e) => setSelectedSellerFilter(e.target.value)}
              className="input-field text-xs py-1.5 px-3"
            >
              <option value="ALL">All Sellers</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted">Buyer:</span>
            <select
              value={selectedBuyerFilter}
              onChange={(e) => setSelectedBuyerFilter(e.target.value)}
              className="input-field text-xs py-1.5 px-3"
            >
              <option value="ALL">All Buyers</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {(selectedSellerFilter !== 'ALL' || selectedBuyerFilter !== 'ALL') && (
            <button
              onClick={() => { setSelectedSellerFilter('ALL'); setSelectedBuyerFilter('ALL'); }}
              className="text-xs text-brand-400 hover:underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Bills List */}`;

content = content.replace('{/* Bills List */}', filterUI);

// 3. Fix the {salesBills.length} to {filteredBills.length}
content = content.replace('{salesBills.length} bills issued', '{filteredBills.length} bills issued');

// 4. Update salesBills.map to filteredBills.map
content = content.replace('salesBills.map(', 'filteredBills.map(');

fs.writeFileSync('src/pages/admin/AdminBilling.jsx', content);
console.log('AdminBilling.jsx fully restored and updated successfully!');