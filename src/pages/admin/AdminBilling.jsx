import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { FileText, Plus, ShoppingCart, Trash2, Receipt, Printer } from 'lucide-react'
import { api } from '../../api.js'
import BillingReceipt from '../../components/BillingReceipt.jsx'

export default function AdminBilling() {
  const { data, createBill, getUserById, getProductById } = useData()
  const { user } = useAuth()
  const [salesBills, setSalesBills] = useState([])
  const [showCreateBill, setShowCreateBill] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [currentBillItems, setCurrentBillItems] = useState([])
  
  const [billForm, setBillForm] = useState({
    buyerId: '',
    items: [],
    discount: 0,
    paidAmount: 0,
    paymentMethod: 'Bank Transfer',
  })
  const [newItem, setNewItem] = useState({ productId: 1, quantity: 1 })

  const ssUsers = data.users.filter(u => u.role === 'SS')

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

  const addItem = () => {
    const product = getProductById(newItem.productId)
    if (!product) return
    const rate = product.ss_price || product.salePrice || 0
    const exists = billForm.items.find(i => i.productId === newItem.productId)
    if (exists) {
      setBillForm(f => ({
        ...f,
        items: f.items.map(i => i.productId === newItem.productId
          ? { ...i, quantity: i.quantity + parseInt(newItem.quantity, 10) }
          : i
        )
      }))
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

  const removeItem = (productId) => {
    setBillForm(f => ({ ...f, items: f.items.filter(i => i.productId !== productId) }))
  }

  const calculateSubtotal = () => {
    return billForm.items.reduce((sum, item) => sum + item.quantity * item.rate, 0)
  }

  const calculateGST = () => {
    return billForm.items.reduce((sum, item) => {
      const product = getProductById(item.productId)
      const itemTotal = item.quantity * item.rate
      const gstRate = product?.gst || 18
      return sum + (itemTotal * gstRate) / 100
    }, 0)
  }

  const subtotal = calculateSubtotal()
  const gst = calculateGST()
  const discount = billForm.discount || 0
  const grandTotal = subtotal - discount + gst
  const due = grandTotal - (billForm.paidAmount || 0)

  const handleCreateBill = async () => {
    if (!billForm.buyerId || billForm.items.length === 0) return
    try {
      await createBill({
        sellerId: user?.id || 1,
        buyerId: parseInt(billForm.buyerId, 10),
        billType: 'ADMIN_TO_SS',
        discount: parseFloat(discount),
        paidAmount: parseFloat(billForm.paidAmount) || 0,
        paymentMethod: billForm.paymentMethod,
      }, billForm.items.map(i => ({ productId: i.productId, quantity: i.quantity, rate: i.rate })))
      
      const updatedBills = await api.getBills('sales')
      setSalesBills(Array.isArray(updatedBills) ? updatedBills : [])

      setBillForm({ buyerId: '', items: [], discount: 0, paidAmount: 0, paymentMethod: 'Bank Transfer' })
      setShowCreateBill(false)
    } catch (err) {
      alert(err.message || 'Failed to create bill')
    }
  }

  const handlePrintInvoice = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Billing - Admin to SS</h2>
          <p className="text-dark-muted text-sm">Create bills for Super Stores and automatically transfer stock</p>
        </div>
        <button onClick={() => setShowCreateBill(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Create Bill
        </button>
      </div>
      
      {/* Bills List */}
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-dark-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
            <FileText size={20} />
          </div>
          <div>
            <div className="font-semibold text-white">Sales Bills</div>
            <div className="text-xs text-dark-muted">{salesBills.length} bills issued</div>
          </div>
        </div>
        
        <table className="w-full">
          <thead>
            <tr className="bg-dark-bg/50">
              <th className="table-header px-6 py-4">Bill No.</th>
              <th className="table-header px-6 py-4">Billing Date</th>
              <th className="table-header px-6 py-4">Buyer Name</th>
              <th className="table-header px-6 py-4 text-right">Subtotal</th>
              <th className="table-header px-6 py-4 text-right">Paid</th>
              <th className="table-header px-6 py-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {salesBills.map(bill => {
              const buyer = bill.buyerId ? getUserById(bill.buyerId) : null
              const buyerName = buyer?.name || bill.buyerName || bill.buyer_name || 'Partner / SS'
              const formattedDate = bill.billDate || bill.created_at || bill.date ? new Date(bill.billDate || bill.created_at || bill.date).toLocaleDateString() : '-'
              return (
                <tr key={bill.id} className="table-row">
                  <td className="px-6 py-4 font-mono text-sm text-brand-400 font-medium">{bill.bill_number}</td>
                  <td className="px-6 py-4 text-dark-muted font-medium">{formattedDate}</td>
                  <td className="px-6 py-4 text-white font-semibold">{buyerName}</td>
                  <td className="px-6 py-4 text-right text-dark-muted">₹{Number(bill.subtotal || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-emerald-400 font-medium">₹{Number(bill.paid_amount || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => setSelectedBill(bill)} className="text-accent-400 hover:text-accent-300 text-sm font-medium">
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
            {salesBills.length === 0 && (
              <tr><td colSpan="6" className="text-center py-12 text-dark-muted">No bills created yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Create Bill Modal */}
      {showCreateBill && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Receipt size={20} className="text-brand-500" />
              Create New Bill
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-muted mb-2">Select Super Store *</label>
                <select
                  value={billForm.buyerId}
                  onChange={(e) => setBillForm(f => ({ ...f, buyerId: e.target.value }))}
                  className="input-field"
                >
                  <option value="">-- Select SS --</option>
                  {ssUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              
              {/* Add Items */}
              <div className="p-4 rounded-xl bg-dark-bg border border-dark-border">
                <div className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <ShoppingCart size={16} className="text-brand-500" />
                  Add Items
                </div>
                <div className="flex gap-2">
                  <select
                    value={newItem.productId}
                    onChange={(e) => setNewItem(i => ({ ...i, productId: parseInt(e.target.value, 10) }))}
                    className="input-field flex-1"
                  >
                    {data.products.map(p => <option key={p.id} value={p.id}>{p.name} - ₹{p.ss_price || p.salePrice}/{p.unit}</option>)}
                  </select>
                  <input
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem(i => ({ ...i, quantity: e.target.value }))}
                    className="input-field w-24"
                    min="1"
                    placeholder="Qty"
                  />
                  <button onClick={addItem} className="btn-primary px-4">Add</button>
                </div>
              </div>
              
              {/* Items Table */}
              {billForm.items.length > 0 && (
                <div className="rounded-xl border border-dark-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-dark-bg/50">
                        <th className="text-left px-4 py-3 text-dark-muted text-xs uppercase tracking-wide">Product</th>
                        <th className="text-right px-4 py-3 text-dark-muted text-xs uppercase tracking-wide">Qty</th>
                        <th className="text-right px-4 py-3 text-dark-muted text-xs uppercase tracking-wide">Rate</th>
                        <th className="text-right px-4 py-3 text-dark-muted text-xs uppercase tracking-wide">Amount</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {billForm.items.map(item => (
                        <tr key={item.productId} className="border-t border-dark-border">
                          <td className="px-4 py-3 text-white">{item.productName}</td>
                          <td className="px-4 py-3 text-right text-dark-muted">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-dark-muted">₹{item.rate}</td>
                          <td className="px-4 py-3 text-right text-white font-medium">₹{(item.quantity * item.rate).toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-300">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Totals */}
              <div className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-2">
                <div className="flex justify-between text-sm"><span className="text-dark-muted">Subtotal</span><span className="text-white">₹{subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm">
                  <span className="text-dark-muted">Discount</span>
                  <input type="number" value={billForm.discount} onChange={(e) => setBillForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))} className="w-28 bg-dark-card border border-dark-border rounded px-2 py-1 text-right text-white text-sm" />
                </div>
                <div className="flex justify-between text-sm"><span className="text-dark-muted">GST (18%)</span><span className="text-white">₹{gst.toFixed(2)}</span></div>
                <div className="flex justify-between pt-2 border-t border-dark-border font-semibold">
                  <span className="text-white">Grand Total</span><span className="text-brand-400 text-lg">₹{grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-3 pt-2">
                  <div className="flex-1">
                    <label className="text-xs text-dark-muted">Payment Method</label>
                    <select value={billForm.paymentMethod} onChange={(e) => setBillForm(f => ({ ...f, paymentMethod: e.target.value }))} className="input-field mt-1 text-sm">
                      <option>Cash</option>
                      <option>UPI</option>
                      <option>Bank Transfer</option>
                      <option>Credit</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-dark-muted">Paid Amount</label>
                    <input type="number" value={billForm.paidAmount} onChange={(e) => setBillForm(f => ({ ...f, paidAmount: e.target.value }))} className="input-field mt-1 text-sm" placeholder="0" />
                  </div>
                </div>
                {due > 0 && <div className="text-sm text-amber-400">Due: ₹{due.toFixed(2)}</div>}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateBill(false)} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={handleCreateBill} disabled={!billForm.buyerId || billForm.items.length === 0} className="flex-1 btn-primary disabled:opacity-50">Create Bill</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Render modular Billing Receipt A4 Modal */}
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