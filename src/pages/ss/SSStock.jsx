// src/pages/ss/SSStock.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Warehouse, Package, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'

export default function SSStock() {
  const { data, getUserStock, getLowStockItems } = useData()
  const { user } = useAuth()

  const [currentStock, setCurrentStock] = useState({})
  const [lowStockItems, setLowStockItems] = useState([])
  const targetUserId = user?.id || 2

  useEffect(() => {
    async function loadStockData() {
      try {
        const stockData = await getUserStock(targetUserId)
        setCurrentStock(stockData || {})

        const lowStockData = await getLowStockItems(targetUserId)
        setLowStockItems(Array.isArray(lowStockData) ? lowStockData : [])
      } catch (err) {
        console.error('Failed to load SS stock:', err)
      }
    }
    loadStockData()
  }, [user, getUserStock, getLowStockItems])

  const products = Array.isArray(data.products) ? data.products : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Stock Management</h2>
        <p className="text-dark-muted text-sm">View your current inventory levels</p>
      </div>
      
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-400">Low Stock Alert</div>
            <div className="text-sm text-amber-200/80 mt-1">{lowStockItems.length} product(s) below minimum stock level</div>
          </div>
        </div>
      )}
      
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-dark-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-500/15 flex items-center justify-center text-accent-500"><Warehouse size={20} /></div>
          <div>
            <div className="font-semibold text-white">Current Stock</div>
            <div className="text-xs text-dark-muted">Super Store Inventory</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-dark-bg/50">
                <th className="table-header px-6 py-4">Product</th>
                <th className="table-header px-6 py-4">SKU</th>
                <th className="table-header px-6 py-4 text-right">Current Stock</th>
                <th className="table-header px-6 py-4 text-right">Min Stock</th>
                <th className="table-header px-6 py-4 text-right">Value (₹)</th>
                <th className="table-header px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const qty = currentStock[product.id] || 0
                const price = product.ss_price || product.purchasePrice || 0
                const value = qty * price
                const minStock = product.min_stock !== undefined ? product.min_stock : (product.minStock || 10)
                const isLow = qty <= minStock
                return (
                  <tr key={product.id} className="table-row">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent-500/15 flex items-center justify-center text-accent-500"><Package size={16} /></div>
                        <span className="font-medium text-white">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-dark-muted">{product.sku}</td>
                    <td className="px-6 py-4 text-right"><span className={`font-bold text-lg ${isLow ? 'text-amber-400' : 'text-white'}`}>{qty}</span></td>
                    <td className="px-6 py-4 text-right text-dark-muted">{minStock}</td>
                    <td className="px-6 py-4 text-right text-white font-medium">₹{value.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      {isLow ? (
                        <span className="status-pill bg-amber-500/15 text-amber-400 flex items-center gap-1 justify-center"><TrendingDown size={12} /> Low</span>
                      ) : (
                        <span className="status-pill bg-emerald-500/15 text-emerald-400 flex items-center gap-1 justify-center"><TrendingUp size={12} /> OK</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {products.length === 0 && (
                <tr><td colSpan="6" className="text-center py-12 text-dark-muted">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}