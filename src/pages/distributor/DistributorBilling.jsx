// src/pages/distributor/DistributorBilling.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { FileText, Plus, ShoppingCart, Trash2, Receipt } from 'lucide-react'
import { api } from '../../api.js'
import BillingReceipt from '../../components/BillingReceipt.jsx'

export default function DistributorBilling() {
  const { data, createBill, getUserById, getProductById } = useData()
  const { user } = useAuth()
  const userId = user?.id || 4

  const [showCreateBill, setShowCreateBill] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [currentBillItems, setCurrentBillItems] = useState([])
  const [salesBills, setSalesBills] = useState([])
  const [retailers, setRetailers] = useState([])

  const [billForm, setBillForm] = useState({ buyerId: '', items: [], discount: 0, paidAmount: 0, paymentMethod: 'Cash', billType: 'DIST_TO_RETAIL' })
  const [newItem, setNewItem] = useState({ productId: 1, quantity: 1 })

  // Fetch sales bills and retailers asynchronously
  useEffect(() => {
    async function fetchDistributorBillingData() {
      try {
        const bills = await api.getBills('sales').catch(() => [])
        setSalesBills(Array.isArray(bills) ? bills : [])

        let rets = await api.getChildren('me', 'RETAILER').catch(() => api.getChildren(userId, 'RETAILER'))
        let list = []
        if (Array.isArray(rets)) {
          list = rets
        } else if (rets && typeof rets === 'object') {
          list = rets.data || rets.retailers || rets.users || []
        }
        if (list.length === 0 && Array.isArray(data?.users)) {
          list = data.users.filter(u => u.role === 'RETAILER' && (u.parentId === userId || u.parent_id === userId))
        }
        setRetailers(list)
      } catch (err) {
        console.error('Failed to load distributor billing data:', err)
        setSalesBills([])
        const allUsers = Array.isArray(data?.users) ? data.users : []
        setRetailers(allUsers.filter(u => u.role === 'RETAILER'))
      }
    }
    fetchDistributorBillingData()
  }, [userId, data?.users])

  // Fetch bill items asynchronously when viewing a bill
  useEffect(() => {
    async function fetchItems() {
      if (!selectedBill) {
        setCurrentBillItems([])
        return
      }
      try {
        const billDetail = await api.getBill(selectedBill.id)
        setCurrentBillItems(Array.isArray(billDetail.items) ? billDetail.items : [])
      } catch (err) {
        console.error('Failed to fetch bill items:', err)
        setCurrentBillItems([])
      }
    }
    fetchItems()
  }, [selectedBill])

  const addItem = () => {
    const product = getProductById(newItem.productId)
    if (!product) return
    const rate = Number(product.salePrice || product.ss_price || 0)
    const exists = billForm.items.find(i => i.productId === newItem.productId)
    if (exists) {
      setBillForm(f => ({ ...f, items: f.items.map(i => i.productId === newItem.productId ? { ...i, quantity: i.quantity + parseInt(newItem.quantity, 10) } : i) }))
    } else {
      setBillForm(f => ({ 
        ...f, 
        items: [...f.items, { 
          productId: newItem.productId, 
          quantity: parseInt(newItem.quantity, 10), 
          rate: rate, 
          productName: product.name,
          hsn: product.hsn || '34029092',
          unit: product.unit || 'Btl'
        }] 
      }))
    }
    setNewItem({ productId: 1, quantity: 1 })
  }

  const removeItem = (productId) => setBillForm(f => ({ ...f, items: f.items.filter(i => i.productId !== productId) }))

  const subtotal = billForm.items.reduce((sum, item) => sum + item.quantity * item.rate, 0)
  const gst = subtotal * 0.18
  const grandTotal = subtotal + gst - (parseFloat(billForm.discount) || 0)
  const due = grandTotal - (parseFloat(billForm.paidAmount) || 0)

  const handleCreateBill = async () => {
    if (!billForm.buyerId || billForm.items.length === 0) return
    try {
      await createBill({
        sellerId: userId,
        buyerId: parseInt(billForm.buyerId, 10),
        billType: 'DIST_TO_RETAIL',
        discount: parseFloat(billForm.discount) || 0,
        paidAmount: parseFloat(billForm.paidAmount) || 0,
        paymentMethod: billForm.paymentMethod,
      }, billForm.items.map(i => ({ productId: i.productId, quantity: i.quantity, rate: i.rate })))
      
      const updatedBills = await api.getBills('sales')
      setSalesBills(Array.isArray(updatedBills) ? updatedBills : [])

      setBillForm({ buyerId: '', items: [], discount: 0, paidAmount: 0, paymentMethod: 'Cash', billType: 'DIST_TO_RETAIL' })
      setShowCreateBill(false)
    } catch (err) {
      alert(err.message || 'Failed to create bill')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Billing to Retailers</h2>
          <p className="text-dark-muted text-sm">Create bills and automatically transfer stock downstream</p>
        </div>
        <button onClick={() => setShowCreateBill(true)} className="btn-primary flex items-center gap-2"><Plus size={18} />Create Bill</button>
      </div>
      
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-dark-bg/60 border-b border-dark-border text-xs uppercase tracking-wider text-dark-muted">
              <th className="px-6 py-4 font-semibold">Bill No.</th>
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Retailer Name</th>
              <th className="px-6 py-4 font-semibold text-right">Subtotal</th>
              <th className="px-6 py-4 font-semibold text-right">GST (18%)</th>
              <th className="px-6 py-4 font-semibold text-right">Grand Total</th>
              <th className="px-6 py-4 font-semibold text-center">Status</th>
              <th className="px-6 py-4 font-semibold text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/50">
            {salesBills.map(bill => {
              const allUsers = Array.isArray(data?.users) ? data.users : []
              const buyer = getUserById(bill.buyerId || bill.buyer_id) || allUsers.find(u => u.id === (bill.buyerId || bill.buyer_id))
              const formattedDate = bill.billDate || bill.created_at || bill.date ? new Date(bill.billDate || bill.created_at || bill.date).toLocaleDateString() : '-'
              
              const billNum = bill.billNumber || bill.bill_number || `INV-${bill.id}`
              const buyerName = buyer?.name || bill.buyerName || bill.buyer_name || 'Retail Partner'
              const pStatus = bill.paymentStatus || bill.payment_status || 'PENDING'
              
              const sub = Number(bill.subtotal ?? bill.sub_total ?? 0)
              const calculatedGst = sub * 0.18
              const gstAmount = Number(bill.gst ?? bill.tax ?? calculatedGst)
              const discount = Number(bill.discount ?? 0)
              const gTotal = Number(bill.grandTotal ?? bill.grand_total ?? bill.total ?? (sub + gstAmount - discount))

              return (
                <tr key={bill.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-emerald-400 font-bold">{billNum}</td>
                  <td className="px-6 py-4 text-dark-muted text-sm font-medium">{formattedDate}</td>
                  <td className="px-6 py-4 text-white text-sm font-semibold">{buyerName}</td>
                  <td className="px-6 py-4 text-right text-dark-muted text-sm">₹{sub.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right text-dark-muted text-sm">₹{gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right text-white font-bold text-sm">₹{gTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${pStatus === 'PAID' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : pStatus === 'PARTIAL' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                      {pStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => setSelectedBill(bill)} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition">View Invoice</button>
                  </td>
                </tr>
              )
            })}
            {salesBills.length === 0 && <tr><td colSpan="8" className="text-center py-16 text-dark-muted text-sm">No bills generated yet. Click "Create Bill" to begin.</td></tr>}
          </tbody>
        </table>
      </div>
      
      {/* Create Bill Modal */}
      {showCreateBill && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-dark-border">
              <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400"><Receipt size={20} /></div>
                Bill to Retailer Network
              </h3>
              <button onClick={() => setShowCreateBill(false)} className="text-dark-muted hover:text-white text-sm font-semibold">✕</button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Select Retailer *</label>
                <select value={billForm.buyerId} onChange={(e) => setBillForm(f => ({ ...f, buyerId: e.target.value }))} className="input-field text-sm font-medium">
                  <option value="">-- Choose Retailer Account --</option>
                  {retailers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.username || 'Retailer'})</option>)}
                </select>
              </div>

              <div className="p-4 rounded-2xl bg-dark-bg/60 border border-dark-border space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2"><ShoppingCart size={16} className="text-emerald-500" />Add Inventory Items</div>
                <div className="flex gap-3 items-center">
                  <select value={newItem.productId} onChange={(e) => setNewItem(i => ({ ...i, productId: parseInt(e.target.value, 10) }))} className="input-field flex-1 text-sm">
                    {data.products.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.salePrice || p.ss_price} / {p.unit || 'Unit'}</option>)}
                  </select>
                  <input type="number" value={newItem.quantity} onChange={(e) => setNewItem(i => ({ ...i, quantity: e.target.value }))} className="input-field w-24 text-sm text-center" min="1" placeholder="Qty" />
                  <button onClick={addItem} className="btn-primary px-5 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500">Add</button>
                </div>
              </div>

              {billForm.items.length > 0 && (
                <div className="rounded-2xl border border-dark-border overflow-hidden bg-dark-bg/40">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-dark-bg text-dark-muted text-[11px] uppercase font-bold tracking-wider border-b border-dark-border">
                        <th className="text-left px-4 py-3">Product Name</th>
                        <th className="text-right px-4 py-3">Qty</th>
                        <th className="text-right px-4 py-3">Rate</th>
                        <th className="text-right px-4 py-3">Amount</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border/50 text-slate-200">
                      {billForm.items.map(item => (
                        <tr key={item.productId} className="hover:bg-white/[0.01]">
                          <td className="px-4 py-3 font-semibold text-white">{item.productName}</td>
                          <td className="px-4 py-3 text-right text-dark-muted font-medium">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-3 text-right text-dark-muted">₹{Number(item.rate || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-white font-bold">₹{(item.quantity * item.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => removeItem(item.productId)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/15 transition"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="p-5 rounded-2xl bg-dark-bg/60 border border-dark-border space-y-3">
                <div className="flex justify-between text-sm text-dark-muted"><span className="font-medium">Subtotal</span><span className="text-white font-semibold">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between text-sm text-dark-muted"><span className="font-medium">GST (18% on Subtotal)</span><span className="text-white font-semibold">₹{gst.toFixed(2)}</span></div>
                <div className="flex justify-between pt-3 border-t border-dark-border text-base font-bold"><span className="text-white">Grand Total</span><span className="text-emerald-400 text-xl font-black">₹{grandTotal.toFixed(2)}</span></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-dark-muted mb-1.5">Payment Mode</label>
                    <select value={billForm.paymentMethod} onChange={(e) => setBillForm(f => ({ ...f, paymentMethod: e.target.value }))} className="input-field text-sm">
                      <option>Cash</option>
                      <option>UPI</option>
                      <option>Bank Transfer</option>
                      <option>Credit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-dark-muted mb-1.5">Amount Paid (₹)</label>
                    <input type="number" value={billForm.paidAmount} onChange={(e) => setBillForm(f => ({ ...f, paidAmount: e.target.value }))} className="input-field text-sm" placeholder="0.00" />
                  </div>
                </div>
                {due > 0 && <div className="text-xs font-bold text-amber-400 pt-1">Balance Due to Collect: ₹{due.toFixed(2)}</div>}
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t border-dark-border">
              <button onClick={() => setShowCreateBill(false)} className="flex-1 btn-secondary py-3 font-semibold">Cancel</button>
              <button onClick={handleCreateBill} disabled={!billForm.buyerId || billForm.items.length === 0} className="flex-1 btn-primary py-3 font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">Generate & Issue Bill</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Professional A4 Billing Receipt Modal */}
      {selectedBill && (
        <BillingReceipt 
          selectedBill={selectedBill} 
          currentBillItems={currentBillItems} 
          getUserById={getUserById} 
          getProductById={getProductById} 
          onClose={() => setSelectedBill(null)} 
        />
      )}
    </div>
  )
}