// src/pages/ss/SSBilling.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { FileText, Plus, ShoppingCart, Trash2, Receipt } from 'lucide-react'
import { api } from '../../api.js'
import BillingReceipt from '../../components/BillingReceipt.jsx'

export default function SSBilling() {
  const { data, createBill, getUserById, getProductById } = useData()
  const { user } = useAuth()
  const [showCreateBill, setShowCreateBill] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [currentBillItems, setCurrentBillItems] = useState([])
  const [salesBills, setSalesBills] = useState([])
  
  const [distributors, setDistributors] = useState([])
  const [retailers, setRetailers] = useState([])

  const [billForm, setBillForm] = useState({ buyerId: '', items: [], discount: 0, paidAmount: 0, paymentMethod: 'Bank Transfer', billType: 'SS_TO_DIST' })
  const [newItem, setNewItem] = useState({ productId: 1, quantity: 1 })

  // Fetch sales bills safely on load
  useEffect(() => {
    async function fetchBills() {
      try {
        const bills = await api.getBills('sales')
        setSalesBills(Array.isArray(bills) ? bills : [])
      } catch (err) {
        console.error('Failed to fetch sales bills:', err)
        setSalesBills([])
      }
    }
    fetchBills()
  }, [user])

  // Fetch network hierarchy (Distributors and Retailers) for the buyer dropdown
  useEffect(() => {
    async function fetchNetwork() {
      try {
        const currentUserId = user?.id || 2
        const dists = await api.getChildren(currentUserId, 'DISTRIBUTOR')
        const safeDists = Array.isArray(dists) ? dists : []
        setDistributors(safeDists)

        let allRetailers = []
        for (const d of safeDists) {
          const rets = await api.getChildren(d.id, 'RETAILER')
          if (Array.isArray(rets)) {
            allRetailers = [...allRetailers, ...rets]
          }
        }
        setRetailers(allRetailers)
      } catch (err) {
        console.error('Failed to fetch network hierarchy for billing:', err)
        setDistributors([])
        setRetailers([])
      }
    }
    fetchNetwork()
  }, [user])

  // Fetch bill items asynchronously when a bill is selected
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

  // Enhanced buyer options fallback combining fetched network state and context data users
  const getBuyerOptions = () => {
    const allUsers = Array.isArray(data.users) ? data.users : []
    if (billForm.billType === 'SS_TO_DIST') {
      if (distributors.length > 0) return distributors
      const dists = allUsers.filter(u => u.role === 'DISTRIBUTOR' && (u.parentId === user?.id || u.parent_id === (user?.id || 2)))
      return dists.length > 0 ? dists : allUsers.filter(u => u.role === 'DISTRIBUTOR')
    } else {
      if (retailers.length > 0) return retailers
      const rets = allUsers.filter(u => u.role === 'RETAILER')
      return rets
    }
  }

  const addItem = () => {
    const product = getProductById(newItem.productId)
    if (!product) return
    const rate = Number(product.ss_price || product.salePrice || 0)
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

  const subtotal = billForm.items.reduce((sum, item) => sum + item.quantity * Number(item.rate || 0), 0)
  const gst = subtotal * 0.18
  const grandTotal = subtotal + gst - (parseFloat(billForm.discount) || 0)
  const due = grandTotal - (parseFloat(billForm.paidAmount) || 0)

  const handleCreateBill = async () => {
    if (!billForm.buyerId || billForm.items.length === 0) return
    try {
      await createBill({
        sellerId: user?.id || 2,
        buyerId: parseInt(billForm.buyerId, 10),
        billType: billForm.billType,
        discount: parseFloat(billForm.discount) || 0,
        paidAmount: parseFloat(billForm.paidAmount) || 0,
        paymentMethod: billForm.paymentMethod,
      }, billForm.items.map(i => ({ productId: i.productId, quantity: i.quantity, rate: i.rate })))
      
      const updatedBills = await api.getBills('sales')
      setSalesBills(Array.isArray(updatedBills) ? updatedBills : [])

      setBillForm({ buyerId: '', items: [], discount: 0, paidAmount: 0, paymentMethod: 'Bank Transfer', billType: 'SS_TO_DIST' })
      setShowCreateBill(false)
    } catch (err) {
      alert(err.message || 'Failed to create bill')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-white">Billing</h2>
          <p className="text-dark-muted text-sm">Create bills for distributors and retailers</p>
        </div>
        <button onClick={() => setShowCreateBill(true)} className="btn-primary flex items-center gap-2"><Plus size={18} />Create Bill</button>
      </div>
      
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-500/15 flex items-center justify-center text-accent-500"><FileText size={20} /></div>
            <div>
              <div className="font-semibold text-white text-base">Sales Bills Management</div>
              <div className="text-xs text-dark-muted">{salesBills.length} total records found</div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-dark-bg/60 border-b border-dark-border text-xs uppercase tracking-wider text-dark-muted">
                <th className="px-6 py-4 font-semibold">Bill No.</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Buyer Name</th>
                {/* <th className="px-6 py-4 font-semibold text-right">Subtotal</th> */}
                {/* <th className="px-6 py-4 font-semibold text-right">GST (18%)</th> */}
                <th className="px-6 py-4 font-semibold text-right">Grand Total</th>
                {/* <th className="px-6 py-4 font-semibold text-center">Status</th> */}
                <th className="px-6 py-4 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/50">
              {salesBills.map(bill => {
                const buyer = getUserById(bill.buyerId || bill.buyer_id)
                const formattedDate = bill.billDate || bill.created_at || bill.date ? new Date(bill.billDate || bill.created_at || bill.date).toLocaleDateString() : '-'
                
                const billNum = bill.billNumber || bill.bill_number || `INV-${bill.id}`
                const buyerDisplayName = buyer?.name || bill.buyerName || bill.buyer_name || 'Partner Entity'
                const pStatus = bill.paymentStatus || bill.payment_status || 'PENDING'
                
                const billSubtotal = Number(bill.subtotal ?? bill.sub_total ?? 0)
                const billGst = Number(bill.gst ?? bill.tax ?? (billSubtotal * 0.18))
                const billDiscount = Number(bill.discount ?? 0)
                const totalAmount = Number(
                  bill.grandTotal ?? 
                  bill.grand_total ?? 
                  bill.total ?? 
                  (billSubtotal + billGst - billDiscount)
                )
                
                return (
                  <tr key={bill.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-accent-400 font-bold">{billNum}</td>
                    <td className="px-6 py-4 text-dark-muted text-sm font-medium">{formattedDate}</td>
                    <td className="px-6 py-4 text-white text-sm font-semibold">{buyerDisplayName}</td>
                    
                    <td className="px-6 py-4 text-right text-white font-bold text-sm">
                      ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => setSelectedBill(bill)} className="px-3 py-1.5 rounded-lg bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 text-xs font-semibold transition">View Invoice</button>
                    </td>
                  </tr>
                )
              })}
              {salesBills.length === 0 && <tr><td colSpan="8" className="text-center py-16 text-dark-muted text-sm">No bills generated yet. Click "Create Bill" to begin.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Create Bill Modal */}
      {showCreateBill && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-dark-border">
              <h3 className="text-xl font-bold text-white flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent-500/15 flex items-center justify-center text-accent-500"><Receipt size={20} /></div>
                Create New Outbound Bill
              </h3>
              <button onClick={() => setShowCreateBill(false)} className="text-dark-muted hover:text-white text-sm font-semibold">✕</button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Bill Type</label>
                  <select value={billForm.billType} onChange={(e) => setBillForm(f => ({ ...f, billType: e.target.value, buyerId: '' }))} className="input-field text-sm font-medium">
                    <option value="SS_TO_DIST">Bill to Distributor</option>
                    <option value="SS_TO_RETAIL">Bill to Retailer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Select Buyer *</label>
                  <select value={billForm.buyerId} onChange={(e) => setBillForm(f => ({ ...f, buyerId: e.target.value }))} className="input-field text-sm font-medium">
                    <option value="">-- Choose Partner Account --</option>
                    {getBuyerOptions().map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.username || u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="p-4 rounded-2xl bg-dark-bg/60 border border-dark-border space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2"><ShoppingCart size={16} className="text-accent-500" />Add Inventory Items</div>
                <div className="flex gap-3 items-center">
                  <select value={newItem.productId} onChange={(e) => setNewItem(i => ({ ...i, productId: parseInt(e.target.value, 10) }))} className="input-field flex-1 text-sm">
                    {data.products.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.ss_price || p.salePrice} / {p.unit || 'Unit'}</option>)}
                  </select>
                  <input type="number" value={newItem.quantity} onChange={(e) => setNewItem(i => ({ ...i, quantity: e.target.value }))} className="input-field w-24 text-sm text-center" min="1" placeholder="Qty" />
                  <button onClick={addItem} className="btn-primary px-5 py-2.5 text-sm font-semibold">Add</button>
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
                        <th className="text-right px-4 py-3">Total Amount</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border/50 text-slate-200">
                      {billForm.items.map(item => (
                        <tr key={item.productId} className="hover:bg-white/[0.01]">
                          <td className="px-4 py-3 font-semibold text-white">{item.productName}</td>
                          <td className="px-4 py-3 text-right text-dark-muted font-medium">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-3 text-right text-dark-muted">₹{Number(item.rate || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-white font-bold">₹{(item.quantity * Number(item.rate || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
                <div className="flex justify-between pt-3 border-t border-dark-border text-base font-bold"><span className="text-white">Grand Total</span><span className="text-accent-400 text-xl font-black">₹{grandTotal.toFixed(2)}</span></div>
                
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
              <button onClick={handleCreateBill} disabled={!billForm.buyerId || billForm.items.length === 0} className="flex-1 btn-primary py-3 font-bold disabled:opacity-50">Generate & Issue Bill</button>
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