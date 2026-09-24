// src/pages/admin/AdminBilling.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { FileText, Plus, ShoppingCart, Trash2, Receipt } from 'lucide-react'
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


  // Add items array and product list reference into editForm state
const [showEditModal, setShowEditModal] = useState(false)
const [editingBill, setEditingBill] = useState(null)
const [editForm, setEditForm] = useState({ discount: 0, paidAmount: 0, paymentMethod: 'Bank Transfer', items: [] })

// Handler to open the edit modal and fetch its items
const handleOpenEdit = async (bill) => {
  setEditingBill(bill)
  try {
    const billDetail = await api.getBill(bill.id)
    const items = Array.isArray(billDetail.items) ? billDetail.items : []
    
    setEditForm({
      discount: Number(bill.discount || 0),
      paidAmount: Number(bill.paidAmount ?? bill.paid_amount ?? 0),
      paymentMethod: bill.paymentMethod || bill.payment_method || 'Bank Transfer',
      items: items.map(i => ({
        productId: i.productId || i.product_id,
        productName: i.productName || i.product_name || 'Product',
        quantity: Number(i.quantity || 1),
        rate: Number(i.rate || 0),
        gst: Number(i.gst || 18)
      }))
    })
    setShowEditModal(true)
  } catch (err) {
    console.error('Failed to load bill items for editing:', err)
    alert('Failed to load bill items')
  }
}

// Handler to modify item quantity inside the edit modal
const handleEditItemQuantityChange = (productId, newQty) => {
  const qty = parseInt(newQty, 10)
  if (isNaN(qty) || qty < 0) return
  setEditForm(f => ({
    ...f,
    items: f.items.map(i => i.productId === productId ? { ...i, quantity: qty } : i)
  }))
}

// Handler to submit bill updates and stock adjustments
const handleUpdateBill = async () => {
  if (!editingBill) return
  try {
    await api.updateBill(editingBill.id, {
      discount: parseFloat(editForm.discount) || 0,
      paidAmount: parseFloat(editForm.paidAmount) || 0,
      paymentMethod: editForm.paymentMethod,
      items: editForm.items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        rate: i.rate,
        gst: i.gst
      }))
    })

    const updatedBills = await api.getBills('sales')
    setSalesBills(Array.isArray(updatedBills) ? updatedBills : [])
    setShowEditModal(false)
    setEditingBill(null)
  } catch (err) {
    alert(err.message || 'Failed to update bill')
  }
}

  // Handler to delete a bill
  const handleDeleteBill = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this bill? Stock adjustments will be reversed.')) return
    try {
      const res = await fetch(`/api/bills/${billId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mlb_token')}`
        }
      })

      if (!res.ok) throw new Error('Failed to delete bill')

      const updatedBills = await api.getBills('sales')
      setSalesBills(Array.isArray(updatedBills) ? updatedBills : [])
    } catch (err) {
      alert(err.message || 'Failed to delete bill')
    }
  }

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

  const calculateGST = (subtotalAmt) => {
    return subtotalAmt * 0.18
  }

  const subtotal = calculateSubtotal()
  const gst = calculateGST(subtotal)
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
        gst: parseFloat(gst.toFixed(2)),
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

  const handleTogglePaymentStatus = async (bill) => {
    const isCurrentlyPaid = (bill.payment_status || bill.paymentStatus) === 'PAID';
    const totalAmount = Number(bill.grand_total ?? bill.grandTotal ?? ((bill.subtotal || 0) + (bill.gst || 0)));
    
    try {
      await fetch(`/api/bills/${bill.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mlb_token')}`
        },
        body: JSON.stringify({ 
          amount: isCurrentlyPaid ? -Number(bill.paid_amount || totalAmount) : totalAmount, 
          method: bill.payment_method || 'Bank Transfer' 
        })
      });

      const updatedBills = await api.getBills('sales');
      setSalesBills(Array.isArray(updatedBills) ? updatedBills : []);
    } catch (err) {
      console.error('Failed to update payment status:', err);
      alert('Failed to update payment status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="https://www.aquauraessentials.com/assets/images/optimized/logo-header.jpg"
            alt="Aquaura Essentials logo"
            className="h-12 w-auto rounded-lg border border-dark-border bg-white/5 p-1 object-contain shadow-sm"
          />
          <div>
            <h2 className="text-2xl font-bold text-white">Billing - Admin to SS</h2>
            <p className="text-dark-muted text-sm">Create bills for Super Stores and automatically transfer stock</p>
          </div>
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

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-dark-bg/50">
                <th className="table-header px-6 py-4">#</th>
                <th className="table-header px-6 py-4">Billing Date</th>
                <th className="table-header px-6 py-4">Buyer Name</th>
                <th className="table-header px-6 py-4 text-right">Subtotal</th>
                <th className="table-header px-6 py-4 text-right">GST (18%)</th>
                <th className="table-header px-6 py-4 text-right">Amount (₹)</th>
                <th className="table-header px-6 py-4 text-right">Paid Amount</th>
                <th className="table-header px-6 py-4 text-right">Remaining Due</th>
                <th className="table-header px-6 py-4 text-center">Status</th>
                <th className="table-header px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesBills.map((bill, index) => {
                const buyer = bill.buyerId ? getUserById(bill.buyerId) : null
                const buyerName = buyer?.name || bill.buyerName || bill.buyer_name || 'Partner / SS'
                const formattedDate = bill.billDate || bill.created_at || bill.date ? new Date(bill.billDate || bill.created_at || bill.date).toLocaleDateString() : '-'
                
                const subtotalValue = Number(bill.subtotal || 0)
                const gstValue = Number(bill.gst || 0)
                const discountValue = Number(bill.discount || 0)
                const totalNetAmount = Number(bill.grand_total ?? bill.grandTotal ?? (subtotalValue - discountValue + gstValue))
                
                const paidAmount = Number(bill.paid_amount ?? bill.paidAmount ?? 0)
                const remainingAmount = Math.max(0, totalNetAmount - paidAmount)
                
                const paymentStatus = remainingAmount <= 0.01 ? 'PAID' : 'PENDING'
                const isPaid = paymentStatus === 'PAID';

                return (
                  <tr key={bill.id || index} className="table-row">
                    <td className="px-6 py-4 font-mono text-sm text-brand-400 font-medium">{index + 1}</td>
                    <td className="px-6 py-4 text-dark-muted font-medium">{formattedDate}</td>
                    <td className="px-6 py-4 text-white font-semibold">{buyerName}</td>
                    <td className="px-6 py-4 text-right text-dark-muted">₹{subtotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right text-dark-muted">₹{gstValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right text-white font-bold">₹{totalNetAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right text-emerald-400 font-medium">₹{paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-6 py-4 text-right text-amber-400 font-medium">₹{remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    
                    {/* Interactive Toggle Switch Cell */}
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePaymentStatus(bill)}
                        className={`relative inline-flex h-7 w-20 items-center rounded-full transition-colors focus:outline-none shadow-inner ${
                          isPaid ? 'bg-emerald-600' : 'bg-red-600'
                        }`}
                        title={`Click to mark as ${isPaid ? 'Pending' : 'Paid'}`}
                      >
                        <span className={`absolute text-[10px] font-bold uppercase tracking-wider text-white ${isPaid ? 'left-4' : 'right-2'}`}>
                          {isPaid ? 'paid' : 'unpaid'}
                        </span>
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                            isPaid ? 'translate-x-14' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>

                    {/* Actions Cell: View, Edit, Delete */}
                    <td className="px-6 py-4 text-center space-x-2">
                      <button onClick={() => setSelectedBill(bill)} className="text-accent-400 hover:text-accent-300 text-xs font-semibold">
                        View
                      </button>
                      <button onClick={() => handleOpenEdit(bill)} className="text-brand-400 hover:text-brand-300 text-xs font-semibold">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteBill(bill.id)} className="text-red-400 hover:text-red-300 text-xs font-semibold">
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
              {salesBills.length === 0 && (
                <tr><td colSpan="10" className="text-center py-12 text-dark-muted">No bills created yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
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

              {/* Totals with Visible GST Calculation */}
              <div className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-dark-muted">Subtotal</span>
                  <span className="text-white font-medium">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dark-muted">GST (18% on Subtotal)</span>
                  <span className="text-brand-300 font-medium">₹{gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-dark-muted">Discount</span>
                  <input 
                    type="number" 
                    value={billForm.discount} 
                    onChange={(e) => setBillForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))} 
                    className="w-28 bg-dark-card border border-dark-border rounded px-2 py-1 text-right text-white text-sm" 
                  />
                </div>
                <div className="flex justify-between pt-2.5 border-t border-dark-border font-semibold">
                  <span className="text-white text-base">Grand Total</span>
                  <span className="text-brand-400 text-lg">₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                {due > 0 && <div className="text-sm text-amber-400 pt-1">Due: ₹{due.toFixed(2)}</div>}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreateBill(false)} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={handleCreateBill} disabled={!billForm.buyerId || billForm.items.length === 0} className="flex-1 btn-primary disabled:opacity-50">Create Bill</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
    {showEditModal && editingBill && (
  <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div className="bg-dark-card border border-dark-border rounded-3xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
      <h3 className="text-xl font-bold text-white mb-2">Edit Bill #{editingBill.billNumber || editingBill.bill_number || editingBill.id}</h3>
      <p className="text-xs text-dark-muted mb-6">Modify product quantities, payment details, and discounts. Stock levels will adjust automatically.</p>
      
      <div className="space-y-5">
        {/* Editable Bill Items Table */}
        <div className="rounded-2xl border border-dark-border overflow-hidden bg-dark-bg/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-dark-bg text-dark-muted text-[11px] uppercase font-bold tracking-wider border-b border-dark-border">
                <th className="text-left px-4 py-3">Product Name</th>
                <th className="text-right px-4 py-3">Rate</th>
                <th className="text-right px-4 py-3">Quantity</th>
                <th className="text-right px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/50 text-slate-200">
              {editForm.items.map(item => (
                <tr key={item.productId} className="hover:bg-white/[0.01]">
                  <td className="px-4 py-3 font-semibold text-white">{item.productName}</td>
                  <td className="px-4 py-3 text-right text-dark-muted">₹{item.rate.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleEditItemQuantityChange(item.productId, e.target.value)}
                      className="w-20 bg-dark-card border border-dark-border rounded px-2 py-1 text-center text-white text-sm font-bold"
                      min="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-white font-bold">₹{(item.quantity * item.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Payment Method</label>
            <select
              value={editForm.paymentMethod}
              onChange={(e) => setEditForm(f => ({ ...f, paymentMethod: e.target.value }))}
              className="input-field text-sm font-medium"
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
              <option>Credit</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Paid Amount (₹)</label>
            <input
              type="number"
              value={editForm.paidAmount}
              onChange={(e) => setEditForm(f => ({ ...f, paidAmount: e.target.value }))}
              className="input-field text-sm font-medium"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Discount (₹)</label>
            <input
              type="number"
              value={editForm.discount}
              onChange={(e) => setEditForm(f => ({ ...f, discount: e.target.value }))}
              className="input-field text-sm font-medium"
              min="0"
            />
          </div>
        </div>
      </div>
      
      <div className="flex gap-3 mt-8 pt-4 border-t border-dark-border">
        <button onClick={() => setShowEditModal(false)} className="flex-1 btn-secondary py-3 text-sm font-semibold">Cancel</button>
        <button onClick={handleUpdateBill} className="flex-1 btn-primary py-3 text-sm font-bold">Save Changes & Recalculate Stock</button>
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