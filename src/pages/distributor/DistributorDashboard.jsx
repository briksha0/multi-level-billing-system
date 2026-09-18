// src/pages/distributor/DistributorDashboard.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import MetricCard from '../../components/MetricCard.jsx'
import { Store, Warehouse, TrendingUp, ShoppingCart, DollarSign, AlertTriangle, Package } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../../api.js'

export default function DistributorDashboard() {
  const { data, getChildren, getUserStock, getLowStockItems, getTodaySales, getPendingPayments, getUserSalesBills } = useData()
  const { user } = useAuth()
  
  const userId = user?.id || 4
  const [retailers, setRetailers] = useState([])
  const [salesBills, setSalesBills] = useState([])

  // Safely fetch network retailers and bills with API fallback
  useEffect(() => {
    async function loadDistributorData() {
      try {
        const rets = await api.getChildren(userId, 'RETAILER').catch(() => [])
        setRetailers(Array.isArray(rets) ? rets : [])

        const bills = await api.getBills('sales').catch(() => [])
        setSalesBills(Array.isArray(bills) ? bills : [])
      } catch (err) {
        console.error('Failed to load distributor dashboard metrics:', err)
      }
    }
    loadDistributorData()
  }, [userId])

  const currentStock = getUserStock(userId) || {}
  const totalStockQty = Object.values(currentStock).reduce((s, q) => s + Number(q || 0), 0)
  const todaySales = typeof getTodaySales === 'function' ? getTodaySales(userId) : 0
  const pendingPayments = typeof getPendingPayments === 'function' ? getPendingPayments(userId) : 0
  const lowStockItems = Array.isArray(getLowStockItems(userId)) ? getLowStockItems(userId) : []
  
  // Safe array coercion for bills
  const rawBills = typeof getUserSalesBills === 'function' ? getUserSalesBills(userId) : salesBills
  const userSalesBills = Array.isArray(rawBills) ? rawBills : (Array.isArray(salesBills) ? salesBills : [])
  const recentBills = [...userSalesBills].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5)
  
  const retailerSales = retailers.map(r => {
    const rBills = userSalesBills.filter(b => (b.buyerId === r.id || b.buyer_id === r.id))
    const sales = rBills.reduce((s, b) => {
      const sub = Number(b.subtotal ?? b.sub_total ?? 0)
      const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
      const disc = Number(b.discount ?? 0)
      return s + Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
    }, 0)
    return { name: r.name ? (r.name.split(' ')[1] || r.name) : 'Retailer', sales }
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard icon={Store} label="Retailers" value={retailers.length} iconColor="text-emerald-500" iconBg="bg-emerald-500/15" />
        <MetricCard icon={Warehouse} label="Current Stock" value={totalStockQty.toLocaleString()} iconColor="text-brand-500" iconBg="bg-brand-500/15" />
        <MetricCard icon={TrendingUp} label="Today's Sales" value={`₹${Number(todaySales).toLocaleString()}`} iconColor="text-emerald-500" iconBg="bg-emerald-500/15" />
        <MetricCard icon={ShoppingCart} label="Total Bills" value={userSalesBills.length} iconColor="text-purple-500" iconBg="bg-purple-500/15" />
        <MetricCard icon={DollarSign} label="Pending Payments" value={`₹${Number(pendingPayments).toLocaleString()}`} subValueColor="text-red-400" iconColor="text-red-500" iconBg="bg-red-500/15" />
        <MetricCard icon={AlertTriangle} label="Low Stock Items" value={lowStockItems.length} subValueColor="text-amber-400" iconColor="text-amber-500" iconBg="bg-amber-500/15" />
        <MetricCard icon={Package} label="Products" value={Array.isArray(data?.products) ? data.products.length : 0} iconColor="text-brand-500" iconBg="bg-brand-500/15" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Sales to Retailers</h3>
          <div style={{ height: 300 }}>
            {retailerSales.length === 0 ? (
              <div className="h-full flex items-center justify-center text-dark-muted text-sm">No retailer sales data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={retailerSales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.08)" />
                  <XAxis dataKey="name" stroke="#9a978f" fontSize={12} />
                  <YAxis stroke="#9a978f" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#2a2a2f', border: '1px solid rgba(232,229,223,0.12)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Sales']} />
                  <Bar dataKey="sales" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Bills</h3>
          <div className="space-y-3">
            {recentBills.length === 0 ? (
              <p className="text-dark-muted text-sm py-12 text-center">No bills generated yet</p>
            ) : recentBills.map(bill => {
              const allUsers = Array.isArray(data?.users) ? data.users : []
              const buyer = allUsers.find(u => u.id === (bill.buyerId || bill.buyer_id))
              const billTotal = Number(bill.grandTotal ?? bill.grand_total ?? bill.total ?? 0)
              const pStatus = bill.paymentStatus || bill.payment_status || 'PENDING'
              
              return (
                <div key={bill.id} className="flex items-center justify-between p-3.5 rounded-xl bg-dark-bg border border-dark-border">
                  <div>
                    <div className="font-medium text-white text-sm">{bill.billNumber || bill.bill_number || `INV-${bill.id}`}</div>
                    <div className="text-xs text-dark-muted mt-0.5">{bill.billDate || bill.created_at || 'Recent'} · {buyer?.name || bill.buyerName || 'Partner Buyer'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">₹{billTotal.toLocaleString()}</div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1 ${pStatus === 'PAID' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : pStatus === 'PARTIAL' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                      {pStatus}
                    </span>
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