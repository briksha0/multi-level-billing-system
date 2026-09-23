// src/pages/admin/AdminStock.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Warehouse, Plus, Package, AlertTriangle, TrendingDown, TrendingUp, ShieldAlert, Trash2, ShoppingCart } from 'lucide-react'

export default function AdminStock() {
  const { data, addOpeningStock, refresh } = useData()
  const { user } = useAuth()
  const [selectedUser, setSelectedUser] = useState(user?.id || 1)
  const [showAddStock, setShowAddStock] = useState(false)
  const [showDamageStock, setShowDamageStock] = useState(false)
  const [stockForm, setStockForm] = useState({ productId: 1, quantity: '' })
  
  // Multi-product damage form state
  const [damageItems, setDamageItems] = useState([])
  const [newDamageItem, setNewDamageItem] = useState({ productId: 1, quantity: 1 })
  const [damageReason, setDamageReason] = useState('Damaged Goods')

  const [userStockMap, setUserStockMap] = useState({})

  const usersList = Array.isArray(data?.users) ? data.users : []
  const productsList = Array.isArray(data?.products) ? data.products : []

  useEffect(() => {
    async function loadStock() {
      try {
        const response = await fetch(`/api/stock?userId=${selectedUser}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('mlb_token')}` }
        })
        const stockData = await response.json()
        const map = {}
        if (Array.isArray(stockData)) {
          stockData.forEach(s => {
            const pId = s.product_id || s.productId
            map[pId] = Number(s.quantity) || 0
          })
        }
        setUserStockMap(map)
      } catch (err) {
        console.error('Failed to load stock', err)
      }
    }
    loadStock()
  }, [selectedUser])

  const currentUser = usersList.find(u => u.id === selectedUser)
  const adminUser = usersList.find(u => u.role === 'ADMIN') || usersList[0]
  const manageableUsers = [adminUser, ...usersList.filter(u => u.role !== 'ADMIN')].filter((u, index, self) => u && self.findIndex(t => t.id === u.id) === index)

  const allProducts = productsList

  const lowStockItems = allProducts.filter(p => {
    const qty = userStockMap[p.id] || 0
    return qty <= (p.min_stock || p.minStock || 10)
  })

  const handleAddStock = async () => {
    const qty = parseInt(stockForm.quantity, 10)
    if (!isNaN(qty) && qty > 0) {
      await addOpeningStock(selectedUser, stockForm.productId, qty)
      if (refresh) await refresh()
      
      const response = await fetch(`/api/stock?userId=${selectedUser}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('mlb_token')}` }
      })
      const stockData = await response.json()
      const map = {}
      if (Array.isArray(stockData)) {
        stockData.forEach(s => {
          map[s.product_id || s.productId] = Number(s.quantity) || 0
        })
      }
      setUserStockMap(map)

      setStockForm({ productId: productsList[0]?.id || 1, quantity: '' })
      setShowAddStock(false)
    }
  }

  // Add item to multi-product damage list
  const addDamageItemToList = () => {
    const product = productsList.find(p => Number(p.id) === Number(newDamageItem.productId))
    const qty = parseInt(newDamageItem.quantity, 10)
    if (!product || isNaN(qty) || qty <= 0) return

    const exists = damageItems.find(i => Number(i.productId) === Number(newDamageItem.productId))
    if (exists) {
      setDamageItems(damageItems.map(i => Number(i.productId) === Number(newDamageItem.productId) ? { ...i, quantity: i.quantity + qty } : i))
    } else {
      setDamageItems([...damageItems, {
        productId: product.id,
        productName: product.name,
        quantity: qty
      }])
    }
    setNewDamageItem({ productId: productsList[0]?.id || 1, quantity: 1 })
  }

  const removeDamageItemFromList = (productId) => {
    setDamageItems(damageItems.filter(i => Number(i.productId) !== Number(productId)))
  }

  // Submit all damaged items to the backend adjust route sequentially or in batch
  const handleBatchDamageSubmit = async () => {
    if (damageItems.length === 0) return

    try {
      for (const item of damageItems) {
        const response = await fetch(`/api/stock/adjust`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('mlb_token')}`
          },
          body: JSON.stringify({
            userId: selectedUser,
            productId: item.productId,
            quantityChange: -item.quantity // Negative value deducts stock
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to update stock for product ID ${item.productId}`)
        }
      }

      if (refresh) await refresh()

      // Reload stock map
      const stockRes = await fetch(`/api/stock?userId=${selectedUser}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('mlb_token')}` }
      })
      const stockData = await stockRes.json()
      const map = {}
      if (Array.isArray(stockData)) {
        stockData.forEach(s => {
          map[s.product_id || s.productId] = Number(s.quantity) || 0
        })
      }
      setUserStockMap(map)

      setDamageItems([])
      setDamageReason('Damaged Goods')
      setShowDamageStock(false)
    } catch (err) {
      console.error('Error reporting multiple damages:', err)
      alert(err.message || 'Failed to adjust stock for damaged goods')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Stock Management</h2>
          <p className="text-dark-muted text-sm">View and manage available inventory across all levels</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(parseInt(e.target.value, 10))}
            className="input-field w-auto text-sm font-medium"
          >
            <option value="">Select User</option>
            {manageableUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
          <button onClick={() => setShowDamageStock(true)} className="btn-secondary flex items-center gap-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
            <ShieldAlert size={18} />
            Report Damage
          </button>
          <button onClick={() => setShowAddStock(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Add Stock
          </button>
        </div>
      </div>
      
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-400">Low Stock Alert - {currentUser?.name}</div>
            <div className="text-sm text-amber-200/80 mt-0.5">
              {lowStockItems.length} product(s) at or below minimum stock level
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-dark-border flex items-center gap-3 bg-dark-bg/30">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-400">
            <Warehouse size={20} />
          </div>
          <div>
            <div className="font-bold text-white">{currentUser?.name} - Inventory Stock</div>
            <div className="text-xs font-mono text-dark-muted uppercase tracking-wider">{currentUser?.role}</div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-dark-bg/50">
                <th className="table-header px-6 py-4">Product</th>
                <th className="table-header px-6 py-4">SKU</th>
                <th className="table-header px-6 py-4 text-center">Unit</th>
                <th className="table-header px-6 py-4 text-right">Current Stock</th>
                <th className="table-header px-6 py-4 text-right">Min Stock</th>
                <th className="table-header px-6 py-4 text-right">Value (₹)</th>
                <th className="table-header px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {allProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-dark-muted text-sm">
                    No products found in the catalog.
                  </td>
                </tr>
              ) : (
                allProducts.map(product => {
                  const qty = userStockMap[product.id] || 0
                  const minStock = product.min_stock || product.minStock || 10
                  const unitPrice = product.ss_price || product.purchase_price || 0
                  const value = qty * unitPrice
                  const isLow = qty <= minStock
                  return (
                    <tr key={product.id} className="table-row hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-brand-500/15 flex items-center justify-center text-brand-400">
                            <Package size={16} />
                          </div>
                          <span className="font-medium text-white">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-dark-muted">{product.sku}</td>
                      <td className="px-6 py-4 text-center text-dark-muted">{product.unit || 'PCS'}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold text-base ${isLow ? 'text-amber-400' : 'text-white'}`}>{qty}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-dark-muted font-medium">{minStock}</td>
                      <td className="px-6 py-4 text-right text-white font-medium">₹{value.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        {isLow ? (
                          <span className="status-pill bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 justify-center mx-auto w-20">
                            <TrendingDown size={12} /> Low
                          </span>
                        ) : (
                          <span className="status-pill bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 justify-center mx-auto w-20">
                            <TrendingUp size={12} /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add Stock Modal */}
      {showAddStock && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Add Opening Stock</h3>
            <p className="text-xs text-dark-muted mb-6">Updating inventory for: <span className="text-white font-semibold">{currentUser?.name}</span></p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Product</label>
                <select
                  value={stockForm.productId}
                  onChange={(e) => setStockForm(f => ({ ...f, productId: parseInt(e.target.value, 10) }))}
                  className="input-field text-sm font-medium"
                >
                  {productsList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Quantity to Add</label>
                <input
                  type="number"
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm(f => ({ ...f, quantity: e.target.value }))}
                  className="input-field text-sm font-medium"
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-8 pt-4 border-t border-dark-border">
              <button onClick={() => setShowAddStock(false)} className="flex-1 btn-secondary py-2.5 text-sm font-semibold">Cancel</button>
              <button onClick={handleAddStock} className="flex-1 btn-primary py-2.5 text-sm font-bold">Add Stock</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Multiple Damaged Goods Modal */}
      {showDamageStock && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert className="text-amber-500" size={22} />
              <h3 className="text-lg font-bold text-white">Report Multiple Damaged Products</h3>
            </div>
            <p className="text-xs text-dark-muted mb-6">Select and add multiple items to deduct from: <span className="text-white font-semibold">{currentUser?.name}</span></p>
            
            <div className="space-y-5">
              {/* Product Picker Box */}
              <div className="p-4 rounded-2xl bg-dark-bg/60 border border-dark-border space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2"><ShoppingCart size={16} className="text-amber-500" />Add Product to Damage List</div>
                <div className="flex gap-3 items-center">
                  <select
                    value={newDamageItem.productId}
                    onChange={(e) => setNewDamageItem(i => ({ ...i, productId: parseInt(e.target.value, 10) }))}
                    className="input-field flex-1 text-sm"
                  >
                    {productsList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Available: {userStockMap[p.id] || 0})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={newDamageItem.quantity}
                    onChange={(e) => setNewDamageItem(i => ({ ...i, quantity: e.target.value }))}
                    className="input-field w-24 text-sm text-center"
                    min="1"
                    placeholder="Qty"
                  />
                  <button onClick={addDamageItemToList} className="btn-primary px-5 py-2.5 text-sm font-semibold bg-amber-600 hover:bg-amber-500">Add</button>
                </div>
              </div>

              {/* Added Damage Items Table */}
              {damageItems.length > 0 && (
                <div className="rounded-2xl border border-dark-border overflow-hidden bg-dark-bg/40">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-dark-bg text-dark-muted text-[11px] uppercase font-bold tracking-wider border-b border-dark-border">
                        <th className="text-left px-4 py-3">Product Name</th>
                        <th className="text-right px-4 py-3">Damaged Qty</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border/50 text-slate-200">
                      {damageItems.map(item => (
                        <tr key={item.productId} className="hover:bg-white/[0.01]">
                          <td className="px-4 py-3 font-semibold text-white">{item.productName}</td>
                          <td className="px-4 py-3 text-right text-amber-400 font-bold">{item.quantity}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => removeDamageItemFromList(item.productId)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/15 transition"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Reason / Note</label>
                <input
                  type="text"
                  value={damageReason}
                  onChange={(e) => setDamageReason(e.target.value)}
                  className="input-field text-sm font-medium"
                  placeholder="e.g., Transit damage, expired batch"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-8 pt-4 border-t border-dark-border">
              <button onClick={() => setShowDamageStock(false)} className="flex-1 btn-secondary py-3 text-sm font-semibold">Cancel</button>
              <button onClick={handleBatchDamageSubmit} disabled={damageItems.length === 0} className="flex-1 btn-primary py-3 text-sm font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-50">Submit Damage Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}