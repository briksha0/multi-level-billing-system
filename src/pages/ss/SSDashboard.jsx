import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import MetricCard from '../../components/MetricCard.jsx'
import { Users, Store, Warehouse, TrendingUp, ShoppingCart, DollarSign, AlertTriangle, Package } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function SSDashboard() {
  const { data, getChildren, getUserStock, getLowStockItems, getTodaySales, getPendingPayments, getUserSalesBills } = useData()
  const { user } = useAuth()
  
  const rawDistributors = getChildren(user?.id || 2, 'DISTRIBUTOR')
  const distributors = Array.isArray(rawDistributors) ? rawDistributors : []
  const retailers = distributors.flatMap(d => {
    const childRetailers = getChildren(d.id, 'RETAILER')
    return Array.isArray(childRetailers) ? childRetailers : []
  })
  
  const currentStock = getUserStock(user?.id || 2)
  const totalStockQty = Object.values(currentStock).reduce((s, q) => s + q, 0)
  const todaySales = getTodaySales(user?.id || 2)
  const pendingPayments = getPendingPayments(user?.id || 2)
  const lowStockItems = getLowStockItems(user?.id || 2)
  
  const rawBills = getUserSalesBills(user?.id || 2)
  const safeBills = Array.isArray(rawBills) ? rawBills : []
  const recentBills = [...safeBills].sort((a, b) => b.id - a.id).slice(0, 5)
  
  const distSalesData = distributors.map(d => {
    const sales = (Array.isArray(data.bills) ? data.bills : []).filter(b => b.buyerId === d.id).reduce((s, b) => s + b.grandTotal, 0)
    return { name: d.name.split(' ')[1] || d.name, sales }
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Distributors" value={distributors.length} iconColor="text-accent-500" iconBg="bg-accent-500/15" />
        <MetricCard icon={Store} label="Retailers" value={retailers.length} iconColor="text-emerald-500" iconBg="bg-emerald-500/15" />
        <MetricCard icon={Warehouse} label="Current Stock" value={totalStockQty.toLocaleString()} iconColor="text-brand-500" iconBg="bg-brand-500/15" />
        <MetricCard icon={TrendingUp} label="Today's Sales" value={`₹${todaySales.toLocaleString()}`} iconColor="text-emerald-500" iconBg="bg-emerald-500/15" />
        <MetricCard icon={ShoppingCart} label="Total Bills" value={safeBills.length} iconColor="text-purple-500" iconBg="bg-purple-500/15" />
        <MetricCard icon={DollarSign} label="Pending Payments" value={`₹${pendingPayments.toLocaleString()}`} subValueColor="text-red-400" iconColor="text-red-500" iconBg="bg-red-500/15" />
        <MetricCard icon={AlertTriangle} label="Low Stock Items" value={lowStockItems.length} subValueColor="text-amber-400" iconColor="text-amber-500" iconBg="bg-amber-500/15" />
        <MetricCard icon={Package} label="Products" value={data.products.length} iconColor="text-brand-500" iconBg="bg-brand-500/15" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Sales to Distributors</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distSalesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.08)" />
                <XAxis dataKey="name" stroke="#9a978f" fontSize={12} />
                <YAxis stroke="#9a978f" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#2a2a2f', border: '1px solid rgba(232,229,223,0.12)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${v.toLocaleString()}`, 'Sales']} />
                <Bar dataKey="sales" fill="#7ba8b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Bills</h3>
          <div className="space-y-3">
            {recentBills.length === 0 ? (
              <p className="text-dark-muted text-sm">No bills yet</p>
            ) : recentBills.map(bill => {
              const buyer = data.users.find(u => u.id === bill.buyerId)
              return (
                <div key={bill.id} className="flex items-center justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
                  <div>
                    <div className="font-medium text-white text-sm">{bill.billNumber}</div>
                    <div className="text-xs text-dark-muted">{bill.billDate} · {buyer?.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">₹{bill.grandTotal.toLocaleString()}</div>
                    <span className={`status-pill text-xs ${
                      bill.paymentStatus === 'PAID' ? 'bg-emerald-500/15 text-emerald-400' :
                      bill.paymentStatus === 'PARTIAL' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>{bill.paymentStatus}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}