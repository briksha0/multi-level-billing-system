// src/pages/admin/AdminProducts.jsx
import { useState } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../api.js'
import { Plus, Search, Package, Edit3 } from 'lucide-react'

export default function AdminProducts() {
  const { data, addProduct, updateProduct, refresh } = useData()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [newProduct, setNewProduct] = useState({
    id: null,
    name: '', sku: '', unit: 'PCS', itemsPerUnit: '',
    ssPrice: '', distributorPrice: '', retailPrice: '', mrp: '', minStock: 10,
    initialStock: '' 
  })

  const productsList = Array.isArray(data?.products) ? data.products : []
  const stockList = Array.isArray(data?.stock) ? data.stock : []

  const filteredProducts = productsList.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.sku) return
    
    const formattedData = {
      ...newProduct,
      categoryId: 1, // Default fallback category
      ssPrice: parseFloat(newProduct.ssPrice) || 0,
      distributorPrice: parseFloat(newProduct.distributorPrice) || 0,
      retailPrice: parseFloat(newProduct.retailPrice) || 0,
      mrp: parseFloat(newProduct.mrp) || 0,
      minStock: parseInt(newProduct.minStock, 10) || 10,
      initialStock: parseInt(newProduct.initialStock, 10) || 0,
    };

    try {
      if (newProduct.id && updateProduct) {
        await updateProduct(newProduct.id, formattedData);
        if (api && api.updateStock && user) {
          await api.updateStock(user.id, newProduct.id, formattedData.initialStock);
        }
      } else {
        await addProduct(formattedData);
      }

      if (refresh) await refresh();

      setNewProduct({
        id: null, name: '', sku: '', unit: 'PCS', itemsPerUnit: '',
        ssPrice: '', distributorPrice: '', retailPrice: '', mrp: '', minStock: 10, initialStock: ''
      })
      setShowModal(false)
    } catch (err) {
      alert(err.message || "Failed to save product");
    }
  }

  const handleEditClick = (p) => {
    const stockItem = stockList.find(s => (s.product_id || s.productId) === p.id);
    const stockQty = stockItem ? stockItem.quantity : 0;

    setNewProduct({
      id: p.id,
      name: p.name || '',
      sku: p.sku || '',
      unit: p.unit || 'PCS',
      itemsPerUnit: p.items_per_unit || '',
      ssPrice: p.ss_price ?? '',
      distributorPrice: p.distributor_price ?? '',
      retailPrice: p.retail_price ?? '',
      mrp: p.mrp ?? '',
      minStock: p.min_stock ?? 10,
      initialStock: stockQty
    });
    setShowModal(true);
  }

  const handleProductNameChange = (e) => {
    const selectedName = e.target.value;
    const match = productsList.find(p => p.name === selectedName);

    if (match) {
      const stockItem = stockList.find(s => (s.product_id || s.productId) === match.id);
      const currentStockQty = stockItem ? stockItem.quantity : 0;

      setNewProduct(prev => ({
        ...prev,
        id: match.id,
        name: selectedName,
        sku: match.sku || '',
        itemsPerUnit: match.items_per_unit || '',
        ssPrice: match.ss_price ?? '',
        distributorPrice: match.distributor_price ?? '',
        retailPrice: match.retail_price ?? '',
        mrp: match.mrp ?? '',
        minStock: match.min_stock ?? 10,
        initialStock: currentStockQty
      }));
    } else {
      setNewProduct(prev => ({ ...prev, id: null, name: selectedName, initialStock: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Product Management</h2>
          <p className="text-dark-muted text-sm">Manage your product catalog and inventory stock</p>
        </div>
        <button onClick={() => {
          setNewProduct({
            id: null, name: '', sku: '', unit: 'PCS', itemsPerUnit: '',
            ssPrice: '', distributorPrice: '', retailPrice: '', mrp: '', minStock: 10, initialStock: ''
          });
          setShowModal(true);
        }} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add Product
        </button>
      </div>
      
      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="input-field pl-10"
        />
      </div>
      
      {/* Products Table */}
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-dark-bg/50">
                <th className="table-header px-4 py-4">Product</th>
                <th className="table-header px-4 py-4">SKU</th>
                <th className="table-header px-4 py-4">Unit</th>
                <th className="table-header px-4 py-4">Pack Size</th>
                <th className="table-header px-4 py-4 text-right">SS Price</th>
                <th className="table-header px-4 py-4 text-right">Dist. Price</th>
                <th className="table-header px-4 py-4 text-right">Retail</th>
                <th className="table-header px-4 py-4 text-right">MRP</th>
                <th className="table-header px-4 py-4 text-center">Available Stock</th>
                <th className="table-header px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const stockItem = stockList.find(s => (s.product_id || s.productId) === p.id)
                const stockQty = stockItem ? stockItem.quantity : 0

                return (
                  <tr key={p.id} className="table-row hover:bg-white/[0.02]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-500/15 flex items-center justify-center text-brand-500">
                          <Package size={16} />
                        </div>
                        <div className="font-medium text-white">{p.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm text-dark-muted">{p.sku}</td>
                    <td className="px-4 py-4 text-dark-muted">{p.unit}</td>
                    <td className="px-4 py-4 text-dark-muted text-sm">{p.items_per_unit || '-'}</td>
                    
                    <td className="px-4 py-4 text-right text-white font-medium">₹{p.ss_price}</td>
                    <td className="px-4 py-4 text-right text-white font-medium">₹{p.distributor_price}</td>
                    <td className="px-4 py-4 text-right text-white font-medium">₹{p.retail_price}</td>
                    <td className="px-4 py-4 text-right text-emerald-400 font-medium">₹{p.mrp}</td>
                    
                    <td className="px-4 py-4 text-center">
                      <div className={`font-bold ${stockQty <= p.min_stock ? 'text-red-400' : 'text-brand-400'}`}>
                        {stockQty}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button 
                        onClick={() => handleEditClick(p)}
                        className="p-2 rounded-lg hover:bg-white/10 text-dark-muted hover:text-white transition-colors"
                        title="Edit Product"
                      >
                        <Edit3 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-dark-muted text-sm">No products found</div>
          )}
        </div>
      </div>
      
      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-6">
              {newProduct.id ? 'Edit Existing Product' : 'Add New Product'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Product Name *</label>
                <input 
                  type="text" 
                  list="product-suggestions"
                  value={newProduct.name} 
                  onChange={handleProductNameChange} 
                  className="input-field text-sm" 
                  placeholder="Search or type product name" 
                />
                <datalist id="product-suggestions">
                  {productsList.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Primary Unit</label>
                <select value={newProduct.unit} onChange={(e) => setNewProduct(p => ({ ...p, unit: e.target.value }))} className="input-field text-sm font-medium">
                  <option value="PCS">PCS</option>
                  <option value="BOX">BOX</option>
                  <option value="PACK">PACK</option>
                  <option value="KG">KG</option>
                  <option value="LTR">LTR</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Pack Size (Optional)</label>
                <input 
                  type="text" 
                  value={newProduct.itemsPerUnit} 
                  onChange={(e) => setNewProduct(p => ({ ...p, itemsPerUnit: e.target.value }))} 
                  className="input-field text-sm" 
                  placeholder="e.g. 12 PCS" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">SKU *</label>
                <input 
                  type="text" 
                  value={newProduct.sku} 
                  onChange={(e) => setNewProduct(p => ({ ...p, sku: e.target.value }))} 
                  className="input-field text-sm font-mono" 
                  placeholder="e.g., LD-750" 
                />
              </div>

              {/* Pricing Tiers Section */}
              <div className="md:col-span-2 mt-2 pt-4 border-t border-dark-border">
                <h4 className="text-sm font-bold text-white mb-4">Pricing Tiers</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">SS Price (₹)</label>
                    <input type="number" step="0.01" value={newProduct.ssPrice} onChange={(e) => setNewProduct(p => ({ ...p, ssPrice: e.target.value }))} className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Distributor (₹)</label>
                    <input type="number" step="0.01" value={newProduct.distributorPrice} onChange={(e) => setNewProduct(p => ({ ...p, distributorPrice: e.target.value }))} className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Retailer (₹)</label>
                    <input type="number" step="0.01" value={newProduct.retailPrice} onChange={(e) => setNewProduct(p => ({ ...p, retailPrice: e.target.value }))} className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">MRP (₹)</label>
                    <input type="number" step="0.01" value={newProduct.mrp} onChange={(e) => setNewProduct(p => ({ ...p, mrp: e.target.value }))} className="input-field text-sm" />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 md:col-span-2 pt-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Min Stock Alert</label>
                  <input type="number" value={newProduct.minStock} onChange={(e) => setNewProduct(p => ({ ...p, minStock: e.target.value }))} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">
                    {newProduct.id ? 'Update Stock Quantity' : 'Initial Stock'}
                  </label>
                  <input type="number" value={newProduct.initialStock} onChange={(e) => setNewProduct(p => ({ ...p, initialStock: e.target.value }))} className="input-field text-sm" placeholder="0" />
                </div>
              </div>

            </div>
            
            <div className="flex gap-3 mt-8 pt-4 border-t border-dark-border">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary py-2.5 text-sm font-semibold">Cancel</button>
              <button onClick={handleAddProduct} className="flex-1 btn-primary py-2.5 text-sm font-bold">
                {newProduct.id ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}