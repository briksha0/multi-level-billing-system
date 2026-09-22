import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { api } from '../../api.js'
import MetricCard from '../../components/MetricCard.jsx'
import { Building2, Users, Store, Package, Warehouse, TrendingUp, AlertTriangle, IndianRupee, ShoppingCart, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

export default function AdminDashboard() {
  const { data, getUserById } = useData()
  const [summary, setSummary] = useState(null)
  const [salesByLevel, setSalesByLevel] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [summaryData, levelData, lowStockData] = await Promise.all([
        api.getSummary(),
        api.getSalesByLevel().catch(() => []),
        api.getLowStock(1).catch(() => []),
      ])
      setSummary(summaryData)
      setSalesByLevel(levelData)
      setLowStock(lowStockData)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    }
    setLoading(false)
  }

  const ssCount = data.users.filter(u => u.role === 'SS').length
  const distCount = data.users.filter(u => u.role === 'DISTRIBUTOR').length
  const retailerCount = data.users.filter(u => u.role === 'RETAILER').length
  const recentBills = [...data.bills].sort((a, b) => b.id - a.id).slice(0, 5)

  // Category distribution from products
  const categoryData = data.categories.map(cat => {
    const count = data.products.filter(p => p.category_id === cat.id).length
    return { name: cat.name, value: count }
  }).filter(c => c.value > 0)

  const COLORS = ['#c47046', '#7ba8b8', '#10b981', '#a855f7']

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Building2} label="Total SS" value={summary?.ssCount ?? ssCount} iconColor="text-brand-500" iconBg="bg-brand-500/15" />
        <MetricCard icon={Users} label="Distributors" value={summary?.distCount ?? distCount} iconColor="text-accent-500" iconBg="bg-accent-500/15" />
        <MetricCard icon={Store} label="Retailers" value={summary?.retailCount ?? retailerCount} iconColor="text-emerald-500" iconBg="bg-emerald-500/15" />
        <MetricCard icon={Package} label="Products" value={data.products.length} iconColor="text-purple-500" iconBg="bg-purple-500/15" />
        <MetricCard icon={Warehouse} label="Total Stock" value={(summary?.totalStock || 0).toLocaleString()} iconColor="text-brand-500" iconBg="bg-brand-500/15" />
        <MetricCard icon={TrendingUp} label="Today's Sales" value={`₹${(summary?.todaySales || 0).toLocaleString()}`} subValueColor="text-emerald-400" iconColor="text-accent-500" iconBg="bg-accent-500/15" />
        <MetricCard
  icon={IndianRupee}
  label="Pending Payments"
  value={`₹${(summary?.pendingPayments || 0).toLocaleString('en-IN')}`}
  subValueColor="text-red-400"
  iconColor="text-red-500"
  iconBg="bg-red-500/15"
/>
        <MetricCard icon={AlertTriangle} label="Low Stock Items" value={summary?.lowStock ?? lowStock.length} subValue={lowStock.length > 0 ? "Needs attention" : ""} subValueColor="text-amber-400" iconColor="text-amber-500" iconBg="bg-amber-500/15" />
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Sales by Level</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByLevel.length > 0 ? salesByLevel : [
                { name: 'Admin', sales: 0 }, { name: 'SS', sales: 0 },
                { name: 'Distributor', sales: 0 }, { name: 'Retailer', sales: 0 }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.08)" />
                <XAxis dataKey="level" stroke="#9a978f" fontSize={12} />
                <YAxis stroke="#9a978f" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#2a2a2f', border: '1px solid rgba(232,229,223,0.12)', borderRadius: '12px', color: '#e8e5df' }}
                  formatter={(value) => [`₹${value.toLocaleString()}`, 'Sales']}
                />
                <Bar dataKey="sales" fill="#c47046" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Products by Category</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#2a2a2f', border: '1px solid rgba(232,229,223,0.12)', borderRadius: '12px', color: '#e8e5df' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Recent Bills & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShoppingCart size={18} className="text-brand-500" />
            Recent Bills
          </h3>
          <div className="space-y-3">
            {recentBills.length === 0 ? (
              <p className="text-dark-muted text-sm">No bills yet</p>
            ) : recentBills.map(bill => {
              const buyer = bill.buyerId ? getUserById(bill.buyerId) : null
              return (
                <div key={bill.id} className="flex items-center justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
                  <div>
                    <div className="font-medium text-white text-sm">{bill.bill_number || bill.billNumber}</div>
                    <div className="text-xs text-dark-muted">
                      {bill.bill_date || bill.billDate} · {buyer?.name || bill.customer_name || bill.customerName || 'Customer'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">₹{(bill.grand_total || bill.grandTotal || 0).toLocaleString()}</div>
                    <span className={`status-pill ${
                      (bill.payment_status || bill.paymentStatus) === 'PAID' ? 'bg-emerald-500/15 text-emerald-400' :
                      (bill.payment_status || bill.paymentStatus) === 'PARTIAL' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>
                      {bill.payment_status || bill.paymentStatus}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Low Stock Alerts
          </h3>
          {lowStock.length === 0 ? (
            <p className="text-dark-muted text-sm">No low stock items</p>
          ) : (
            <div className="space-y-3">
              {lowStock.slice(0, 5).map(item => (
                <div key={item.product_id || item.id} className="flex items-center justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
                  <div>
                    <div className="font-medium text-white text-sm">{item.name}</div>
                    <div className="text-xs text-dark-muted">SKU: {item.sku} · Min: {item.min_stock || item.minStock}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-amber-400">{item.quantity}</div>
                    <div className="text-xs text-dark-muted">current</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
