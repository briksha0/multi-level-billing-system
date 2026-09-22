// src/components/receipts/BillingReceipt.jsx
import { Printer } from 'lucide-react'

export default function BillingReceipt({ selectedBill, currentBillItems, getUserById, getProductById, onClose }) {
  if (!selectedBill) return null

  const buyer = selectedBill.buyerId ? getUserById(selectedBill.buyerId) : null
  const buyerName = buyer?.name || selectedBill.buyerName || selectedBill.buyer_name || 'Retail / Partner Buyer'
  const formattedBillDate = selectedBill.billDate || selectedBill.created_at || selectedBill.date
    ? new Date(selectedBill.billDate || selectedBill.created_at || selectedBill.date).toLocaleDateString()
    : '-'

  let totalTaxable = 0
  let totalCgst = 0
  let totalSgst = 0
  let grandTotalAmount = 0

  const taxSummaryMap = {}
  currentBillItems.forEach(item => {
    const prod = getProductById(item.product_Id || item.productId)
    const hsn = prod?.hsn || item.hsn || '34029092'
    const taxableAmt = item.quantity * Number(item.rate || 0)
    const gstAmt = taxableAmt * 0.18
    const cgstAmt = gstAmt / 2
    const sgstAmt = gstAmt / 2
    const itemTotalWithGst = taxableAmt + gstAmt

    totalTaxable += taxableAmt
    totalCgst += cgstAmt
    totalSgst += sgstAmt
    grandTotalAmount += itemTotalWithGst

    if (!taxSummaryMap[hsn]) {
      taxSummaryMap[hsn] = { taxable: 0, cgst: 0, sgst: 0 }
    }
    taxSummaryMap[hsn].taxable += taxableAmt
    taxSummaryMap[hsn].cgst += cgstAmt
    taxSummaryMap[hsn].sgst += sgstAmt
  })

  const handlePrintInvoice = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 overflow-y-auto print:p-0 print:bg-white print:inset-auto">

      {/* Container forced precisely to A4 dimensions (210mm x 297mm) */}
      <div className="bg-white text-slate-900 rounded-2xl p-10 w-full max-w-[210mm] min-h-[200mm] shadow-2xl relative flex flex-col justify-between print:m-10 print:p-10 print:shadow-none print:w-[297mm] print:h-[430mm] print:max-w-none print:rounded-none">

        {/* Top Header Action Controls (Hidden on print) */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 print:hidden">
          <h3 className="text-xl font-bold text-slate-900 font-mono">Invoice #{selectedBill.billNumber || selectedBill.bill_number}</h3>
          <div className="flex items-center gap-3">
            <button
                onClick={handlePrintInvoice}
                className="bg-green-600 text-black-600 px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition"
              >
                <Printer size={16} />
                Print
              </button>
            <button onClick={onClose} className="bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition">
              Close
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="space-y-6 text-sm flex-1">

          {/* Company Details & Invoice Info Header */}
          <div className="flex justify-between items-start border-b border-slate-300 pb-5">
            <div className="flex items-start gap-4">
              <img src="https://www.aquauraessentials.com/assets/images/optimized/logo-header.jpg" alt="Aquaura Essentials Logo" className="w-16 h-auto object-contain mt-1" />
              <div>
                <h1 className="text-xl font-black tracking-wider text-slate-900">Aquaura Essentials LLP</h1>
                <p className="text-[11px] text-slate-500 mt-0.5">26, Muir Road, Allahabad, Prayagraj, Uttar Pradesh, 211002</p>
                <p className="text-[11px] text-slate-500">Phone: 8826768701 | Email: aquaura.essentials@gmail.com</p>
                <p className="text-[11px] font-semibold text-slate-700 mt-0.5">GSTIN: 09ACFFA3725P1Z0 | State Code: 09</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold uppercase rounded-md mb-1.5">Tax Invoice</span>
              <p className="text-xs text-slate-600"><strong>Invoice No.:</strong> {selectedBill.billNumber || selectedBill.bill_number}</p>
              <p className="text-xs text-slate-600"><strong>Date:</strong> {formattedBillDate}</p>
              <p className="text-xs text-slate-600"><strong>Place Of Supply:</strong> 09-Uttar Pradesh</p>
            </div>
          </div>

          {/* Buyer Details Block */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Billed To (Buyer):</h4>
            <div className="text-slate-900 font-bold text-sm">{buyerName}</div>
            <p className="text-xs text-slate-600 mt-0.5">Address: Registered Operating Distribution Network, Uttar Pradesh</p>
            <p className="text-xs text-slate-600">GSTIN: {buyer?.gstin || '09CUTPG2394C1ZC'} | State Code: 09-Uttar Pradesh</p>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[11px] uppercase font-bold tracking-wider border-b border-slate-200">
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Item Name</th>
                  <th className="p-2.5">HSN/SAC</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-center">Unit</th>
                  <th className="p-2.5 text-right">Price (₹)</th>
                  <th className="p-2.5 text-right">GST (18%)</th>
                  <th className="p-2.5 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700 text-xs">
                {currentBillItems.map((item, idx) => {
                  const prod = getProductById(item.product_Id || item.productId)
                  const productName = prod?.name || item.product_name || item.name || 'Product'
                  const taxableAmt = item.quantity * Number(item.rate || 0)
                  const gstAmt = taxableAmt * 0.18
                  const totalWithGst = taxableAmt + gstAmt

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-medium">{idx + 1}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{productName}</td>
                      <td className="p-2.5 text-slate-500 font-mono text-[11px]">{prod?.hsn || item.hsn || '34029092'}</td>
                      <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                      <td className="p-2.5 text-center text-slate-500">{prod?.unit || item.unit || 'Btl'}</td>
                      <td className="p-2.5 text-right">₹{Number(item.rate || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-right text-slate-600">₹{gstAmt.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-medium text-slate-900">₹{totalWithGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-slate-800">
                  <td colSpan="7" className="p-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Total Amount</td>
                  <td className="p-2.5 text-right font-bold text-slate-900">₹{grandTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>

        {/* Footer: Bank Details & Authorized Signatory */}
        <div className="grid grid-cols-2 gap-4 border-t border-slate-300 pt-5 items-end mt-auto">
          <div>
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bank Details</h5>
            <p className="text-[11px] text-slate-600"><strong>Bank:</strong> HDFC BANK, SARAIDHELA</p>
            <p className="text-[11px] text-slate-600"><strong>A/C No.:</strong> 50200101304925</p>
            <p className="text-[11px] text-slate-600"><strong>IFSC:</strong> HDFC0002679</p>
          </div>

          <div className="text-right">
            <p className="text-xs font-bold text-slate-900">For Aquaura Essentials LLP</p>
            <div className="h-10"></div>
            <p className="text-[11px] font-medium text-slate-600 border-t border-slate-300 pt-1 inline-block px-4">Authorized Signatory</p>
          </div>
        </div>

      </div>

      {/* Global CSS Print rules to enforce full A4 size page layout */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          
          .fixed {
            position: absolute !important;
            inset: 0 !important;
            background: white !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}