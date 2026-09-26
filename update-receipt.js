const fs = require('fs');
let content = fs.readFileSync('src/components/BillingReceipt.jsx', 'utf8');

// Replace the tfoot section to show Subtotal, Discount, and Grand Total
const oldTfoot = <tfoot\\>[\\s\\S]*?<\\/tfoot>;

const newTfoot = <tfoot>
                <tr className="bg-slate-50/50 text-slate-800 border-t border-slate-200">
                  <td colSpan="7" className="p-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Subtotal</td>
                  <td className="p-2.5 text-right font-medium text-slate-900">?{Number(selectedBill.subtotal || totalTaxable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                {Number(selectedBill.discount) > 0 && (
                  <tr className="bg-slate-50/50 text-slate-800">
                    <td colSpan="7" className="p-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-red-500">Discount</td>
                    <td className="p-2.5 text-right font-medium text-red-600">-?{Number(selectedBill.discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr className="bg-slate-50/50 text-slate-800">
                  <td colSpan="7" className="p-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Total GST</td>
                  <td className="p-2.5 text-right font-medium text-slate-900">?{Number(selectedBill.gst || (totalCgst + totalSgst)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr className="bg-slate-100 text-slate-900 border-t border-slate-300">
                  <td colSpan="7" className="p-2.5 text-right text-[12px] font-black uppercase tracking-wider">Grand Total</td>
                  <td className="p-2.5 text-right font-black text-lg text-slate-900">?{Number(selectedBill.grand_total || selectedBill.grandTotal || grandTotalAmount - Number(selectedBill.discount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>;

content = content.replace(new RegExp(oldTfoot, 'g'), newTfoot);

// Ensure the rupee symbol is correctly rendered instead of the weird character
content = content.replace(/,1/g, '?');

fs.writeFileSync('src/components/BillingReceipt.jsx', content);
console.log('Updated BillingReceipt.jsx');
