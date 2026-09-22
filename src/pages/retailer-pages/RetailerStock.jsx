import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { api } from '../../api.js'
import { Package, Warehouse } from 'lucide-react'

export default function RetailerStock() {
  const { user } = useAuth()
  const { data, getUserStock } = useData()
  const distributorId = Number(user?.parentId || user?.parent_id)
  const [stock, setStock] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDistributorStock() {
      if (!Number.isInteger(distributorId)) {
        setLoading(false)
        return
      }
      try {
        const response = await api.getStock(distributorId).catch(() => getUserStock(distributorId))
        const mapped = {}
        if (Array.isArray(response)) {
          response.forEach(item => {
            const productId = item.productId || item.product_id
            if (productId) mapped[productId] = Number(item.quantity || 0)
          })
        } else if (response && typeof response === 'object') {
          Object.assign(mapped, response)
        }
        setStock(mapped)
      } finally {
        setLoading(false)
      }
    }
    loadDistributorStock()
  }, [distributorId, getUserStock])

  const products = Array.isArray(data?.products) ? data.products : []
  const distributor = data?.users?.find(item => Number(item.id) === distributorId)

  if (loading) return <div className="py-24 text-center text-dark-muted">Loading distributor stock...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Distributor Stock</h2>
          <p className="text-dark-muted text-sm">Stock available from {distributor?.name || 'your assigned distributor'}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-dark-muted">
          <Warehouse size={18} className="text-brand-400" />
          Distributor ID: <span className="text-white">{Number.isInteger(distributorId) ? distributorId : 'N/A'}</span>
        </div>
      </div>
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left">
            <thead className="bg-dark-bg/60 text-xs uppercase tracking-wider text-dark-muted">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4 text-right">Available Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/50">
              {products.map(product => (
                <tr key={product.id}>
                  <td className="px-6 py-4 text-white font-medium"><Package size={16} className="inline mr-2 text-brand-400" />{product.name}</td>
                  <td className="px-6 py-4 text-dark-muted">{product.sku || 'SKU-N/A'}</td>
                  <td className="px-6 py-4 text-right text-white font-bold">{Number(stock[product.id] ?? stock[product.product_id] ?? 0)} {product.unit || 'Units'}</td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan="3" className="px-6 py-12 text-center text-dark-muted">No products found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
