const fs = require('fs');
let content = fs.readFileSync('src/components/BillingReceipt.jsx', 'utf8');

const regex = /<tfoot>[\s\S]*?<\/tfoot>/;

const newTfoot = "              <tfoot>\n" +
"                <tr className=\"bg-slate-50/50 text-slate-800 border-t border-slate-200\">\n" +
"                  <td colSpan=\"7\" className=\"p-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500\">Subtotal</td>\n" +
"                  <td className=\"p-2.5 text-right font-medium text-slate-900\">₹{Number(selectedBill.subtotal || totalTaxable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>\n" +
"                </tr>\n" +
"                {Number(selectedBill.discount) > 0 && (\n" +
"                  <tr className=\"bg-slate-50/50 text-slate-800\">\n" +
"                    <td colSpan=\"7\" className=\"p-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-red-500\">Discount</td>\n" +
"                    <td className=\"p-2.5 text-right font-medium text-red-600\">-₹{Number(selectedBill.discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>\n" +
"                  </tr>\n" +
"                )}\n" +
"                <tr className=\"bg-slate-50/50 text-slate-800\">\n" +
"                  <td colSpan=\"7\" className=\"p-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500\">Total GST (18%)</td>\n" +
"                  <td className=\"p-2.5 text-right font-medium text-slate-900\">₹{Number(selectedBill.gst || (totalCgst + totalSgst)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>\n" +
"                </tr>\n" +
"                <tr className=\"bg-slate-100 text-slate-900 border-t border-slate-300\">\n" +
"                  <td colSpan=\"7\" className=\"p-2.5 text-right text-[12px] font-black uppercase tracking-wider\">Grand Total</td>\n" +
"                  <td className=\"p-2.5 text-right font-black text-lg text-slate-900\">₹{Number(selectedBill.grand_total || selectedBill.grandTotal || grandTotalAmount - Number(selectedBill.discount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>\n" +
"                </tr>\n" +
"              </tfoot>";

content = content.replace(regex, newTfoot);

content = content.replace(/,1/g, '₹');

fs.writeFileSync('src/components/BillingReceipt.jsx', content);
console.log('Fixed receipt formatting completely');
