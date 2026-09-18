import { useState, useEffect, useCallback } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Warehouse, Plus, Package, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'

export default function AdminStock() {
  const { data, addOpeningStock, refresh } = useData()
  const { user } = useAuth()
  const [selectedUser, setSelectedUser] = useState(user?.id || 1)
  const [showAddStock, setShowAddStock] = useState(false)
  const [stockForm, setStockForm] = useState({ productId: 1, quantity: 0 })
  const [userStockMap, setUserStockMap] = useState({})

  // Fetch stock whenever selected user changes
  useEffect(() => {
    async function loadStock() {
      try {
        const response = await fetch(`/api/stock?userId=${selectedUser}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('mlb_token')}` }
        })
        const stockData = await response.json()
        const map = {}
        if (Array.isArray(stockData)) {
          stockData.forEach(s => { map[s.product_id || s.productId] = s.quantity })
        }
        setUserStockMap(map)
      } catch (err) {
        console.error('Failed to load stock', err)
      }
    }
    loadStock()
  }, [selectedUser])

  const currentUser = data.users.find(u => u.id === selectedUser)
  const manageableUsers = [data.users.find(u => u.id === 1), ...data.users.filter(u => u.role !== 'ADMIN')].filter(Boolean)

  // Filter products to only show those with available stock greater than 0
  const availableProducts = data.products.filter(product => {
    const qty = userStockMap[product.id] || 0
    return qty > 0
  })

  const lowStockItems = availableProducts.filter(p => {
    const qty = userStockMap[p.id] || 0
    return qty <= (p.min_stock || p.minStock || 10)
  })

  const handleAddStock = async () => {
    if (stockForm.quantity > 0) {
      await addOpeningStock(selectedUser, stockForm.productId, parseInt(stockForm.quantity, 10))
      if (refresh) await refresh()
      
      const response = await fetch(`/api/stock?userId=${selectedUser}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('mlb_token')}` }
      })
      const stockData = await response.json()
      const map = {}
      if (Array.isArray(stockData)) {
        stockData.forEach(s => { map[s.product_id || s.productId] = s.quantity })
      }
      setUserStockMap(map)

      setStockForm({ productId: 1, quantity: 0 })
      setShowAddStock(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Stock Management</h2>
          <p className="text-dark-muted text-sm">View and manage available inventory across all levels</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(parseInt(e.target.value, 10))}
            className="input-field w-auto"
          >
            {manageableUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
          <button onClick={() => setShowAddStock(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Add Stock
          </button>
        </div>
      </div>
      
      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-400">Low Stock Alert - {currentUser?.name}</div>
            <div className="text-sm text-amber-200/80 mt-1">
              {lowStockItems.length} available product(s) below minimum stock level
            </div>
          </div>
        </div>
      )}
      
      {/* Stock Table */}
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-dark-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
            <Warehouse size={20} />
          </div>
          <div>
            <div className="font-semibold text-white">{currentUser?.name} - Available Stock</div>
            <div className="text-xs text-dark-muted">{currentUser?.role}</div>
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
              {availableProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-dark-muted">
                    No stock available for this user.
                  </td>
                </tr>
              ) : (
                availableProducts.map(product => {
                  const qty = userStockMap[product.id] || 0
                  const minStock = product.min_stock || product.minStock || 10
                  const purchasePrice = product.ss_price || product.purchasePrice || 0
                  const value = qty * purchasePrice
                  const isLow = qty <= minStock
                  return (
                    <tr key={product.id} className="table-row">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-brand-500/15 flex items-center justify-center text-brand-500">
                            <Package size={16} />
                          </div>
                          <span className="font-medium text-white">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-dark-muted">{product.sku}</td>
                      <td className="px-6 py-4 text-center text-dark-muted">{product.unit}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold text-lg ${isLow ? 'text-amber-400' : 'text-white'}`}>{qty}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-dark-muted">{minStock}</td>
                      <td className="px-6 py-4 text-right text-white font-medium">₹{value.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        {isLow ? (
                          <span className="status-pill bg-amber-500/15 text-amber-400 flex items-center gap-1 justify-center">
                            <TrendingDown size={12} /> Low
                          </span>
                        ) : (
                          <span className="status-pill bg-emerald-500/15 text-emerald-400 flex items-center gap-1 justify-center">
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-6">Add Opening Stock</h3>
            <p className="text-sm text-dark-muted mb-4">Adding stock for: <span className="text-white font-medium">{currentUser?.name}</span></p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-muted mb-2">Product</label>
                <select
                  value={stockForm.productId}
                  onChange={(e) => setStockForm(f => ({ ...f, productId: parseInt(e.target.value, 10) }))}
                  className="input-field"
                >
                  {data.products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-dark-muted mb-2">Quantity</label>
                <input
                  type="number"
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm(f => ({ ...f, quantity: e.target.value }))}
                  className="input-field"
                  min="0"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddStock(false)} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={handleAddStock} className="flex-1 btn-primary">Add Stock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}