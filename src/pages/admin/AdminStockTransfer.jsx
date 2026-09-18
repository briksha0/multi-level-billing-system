import { useState } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { api } from '../../api.js'
import { Send, Package, UserCheck, Layers } from 'lucide-react'

export default function AdminStockTransfer() {
  const { data, refresh } = useData()
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  // Filter only lower-tier users (SS, Distributor, Retailer) as recipients
  const recipients = data.users.filter(u => u.role !== 'ADMIN')

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!selectedUser || !selectedProduct || !quantity) {
      setMessage({ type: 'error', text: 'Please fill in all fields.' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      await api.transferStock(parseInt(selectedUser, 10), parseInt(selectedProduct, 10), parseInt(quantity, 10))
      setMessage({ type: 'success', text: 'Stock transferred successfully!' })
      
      // Reset form & refresh global stock/data state
      setSelectedUser('')
      setSelectedProduct('')
      setQuantity('')
      if (refresh) await refresh()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to transfer stock.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white">Stock Transfer</h2>
        <p className="text-dark-muted text-sm">Transfer items from your inventory to your network partners</p>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-lg">
        {message && (
          <div className={`p-4 rounded-xl mb-6 text-sm ${
            message.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleTransfer} className="space-y-5">
          <div>
            <label className="block text-sm text-dark-muted mb-2 flex items-center gap-2">
              <UserCheck size={16} className="text-brand-500" />
              Recipient User *
            </label>
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)} 
              className="input-field"
              required
            >
              <option value="">Select recipient (SS / Distributor / Retailer)</option>
              {recipients.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role}) 
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-dark-muted mb-2 flex items-center gap-2">
              <Package size={16} className="text-brand-500" />
              Product *
            </label>
            <select 
              value={selectedProduct} 
              onChange={(e) => setSelectedProduct(e.target.value)} 
              className="input-field"
              required
            >
              <option value="">Select product to transfer</option>
              {data.products.map(p => {
                const stockItem = data.stock?.find(s => (s.product_id || s.productId) === p.id)
                const available = stockItem ? stockItem.quantity : 0
                return (
                  <option key={p.id} value={p.id}>
                    {p.name}  — Available: {available}
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm text-dark-muted mb-2 flex items-center gap-2">
              <Layers size={16} className="text-brand-500" />
              Transfer Quantity *
            </label>
            <input 
              type="number" 
              min="1"
              value={quantity} 
              onChange={(e) => setQuantity(e.target.value)} 
              className="input-field" 
              placeholder="Enter quantity to transfer"
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-btn-primary btn-primary w-full flex items-center justify-center gap-2 py-3 mt-4"
          >
            <Send size={18} />
            {loading ? 'Processing Transfer...' : 'Transfer Stock'}
          </button>
        </form>
      </div>
    </div>
  )
}