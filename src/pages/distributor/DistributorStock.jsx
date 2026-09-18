// src/pages/distributor/DistributorStock.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Package, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { api } from '../../api.js'

export default function DistributorStock() {
  const { data, getUserStock, getLowStockItems } = useData()
  const { user } = useAuth()
  const userId = user?.id || 4

  const [stockMap, setStockMap] = useState({})
  const [loading, setLoading] = useState(true)

  // Fetch stock asynchronously via API with context fallback
  useEffect(() => {
    async function fetchStockData() {
      try {
        setLoading(true)
        const res = await api.getStock(userId).catch(() => getUserStock(userId))
        
        let mapped = {}
        if (Array.isArray(res)) {
          // If response is an array of stock entries [{productId, quantity}, ...]
          res.forEach(item => {
            const pId = item.productId || item.product_id
            const qty = item.quantity || item.qty || 0
            if (pId) mapped[pId] = Number(qty)
          })
        } else if (res && typeof res === 'object') {
          mapped = res
        } else {
          mapped = getUserStock(userId) || {}
        }

        setStockMap(mapped)
      } catch (err) {
        console.error('Failed to fetch distributor stock:', err)
        setStockMap(getUserStock(userId) || {})
      } finally {
        setLoading(false)
      }
    }
    fetchStockData()
  }, [userId])

  const productsList = Array.isArray(data?.products) ? data.products : []
  const lowStockList = typeof getLowStockItems === 'function' ? getLowStockItems(userId) : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-dark-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500 mr-3"></div>
        Loading inventory stock data...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Stock Management</h2>
        <p className="text-dark-muted text-sm">View your current inventory levels and valuations</p>
      </div>
      
      {lowStockList.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-400 text-sm">Low Stock Warning</div>
            <div className="text-xs text-amber-200/80 mt-0.5">{lowStockList.length} product(s) have fallen below minimum threshold levels.</div>
          </div>
        </div>
      )}
      
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left border-collapse">
            <thead>
              <tr className="bg-dark-bg/60 border-b border-dark-border text-xs uppercase tracking-wider text-dark-muted">
                <th className="px-6 py-4 font-semibold">Product Name</th>
                <th className="px-6 py-4 font-semibold">SKU / Code</th>
                <th className="px-6 py-4 font-semibold text-right">Current Stock</th>
                <th className="px-6 py-4 font-semibold text-right">Min Stock</th>
                <th className="px-6 py-4 font-semibold text-right">Total Valuation</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/50">
              {productsList.map(product => {
                const qty = Number(stockMap[product.id] ?? stockMap[product.product_id] ?? 0)
                const minQty = Number(product.minStock || product.min_stock || 10)
                const isLow = qty <= minQty
                const unitPrice = Number(product.purchasePrice || product.purchase_price || product.salePrice || 0)
                const totalValue = qty * unitPrice

                return (
                  <tr key={product.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                          <Package size={16} />
                        </div>
                        <span className="font-semibold text-white text-sm">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-dark-muted">{product.sku || 'SKU-N/A'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-black text-base ${isLow ? 'text-amber-400' : 'text-white'}`}>{qty}</span>
                      <span className="text-xs text-dark-muted ml-1">{product.unit || 'Units'}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-dark-muted text-sm">{minQty}</td>
                    <td className="px-6 py-4 text-right text-white font-bold text-sm">
                      ₹{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <TrendingDown size={12} /> Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <TrendingUp size={12} /> Optimal
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {productsList.length === 0 && (
                <tr><td colSpan="6" className="text-center py-16 text-dark-muted text-sm">No products found in inventory.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}