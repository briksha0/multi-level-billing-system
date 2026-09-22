// src/pages/ss/SSDashboard.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import MetricCard from '../../components/MetricCard.jsx'
import { Users, Store, Warehouse, TrendingUp, ShoppingCart, DollarSign, AlertTriangle, Package, IndianRupee } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../../api.js'

export default function SSDashboard() {
  const { data, getChildren, getUserStock, getLowStockItems, getTodaySales, getPendingPayments, getUserSalesBills } = useData()
  const { user } = useAuth()
  const ssId = user?.id || 2

  const [users, setUsers] = useState([])
  const [bills, setBills] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [lowStockList, setLowStockList] = useState([])
  const [todaySalesVal, setTodaySalesVal] = useState(0)
  const [pendingPaymentsVal, setPendingPaymentsVal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Fetch all metric dependencies asynchronously
  useEffect(() => {
    async function loadDashboardMetrics() {
      try {
        setLoading(true)
        const [usersRes, billsRes, stockRes, lowStockRes, salesVal, pendingVal] = await Promise.all([
          api.getUsers().catch(() => data?.users || []),
          getUserSalesBills(ssId).catch(() => data?.bills || []),
          getUserStock(ssId).catch(() => ({})),
          getLowStockItems(ssId).catch(() => []),
          getTodaySales(ssId).catch(() => 0),
          getPendingPayments(ssId).catch(() => 0),
        ])

        setUsers(Array.isArray(usersRes) ? usersRes : (usersRes?.data || usersRes?.users || data?.users || []))
        setBills(Array.isArray(billsRes) ? billsRes : (billsRes?.data || billsRes?.bills || data?.bills || []))
        setStockMap(stockRes || {})
        setLowStockList(Array.isArray(lowStockRes) ? lowStockRes : [])
        setTodaySalesVal(Number(salesVal) || 0)
        setPendingPaymentsVal(Number(pendingVal) || 0)
      } catch (err) {
        console.error('Failed to load SS dashboard metrics:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDashboardMetrics()
  }, [ssId, getUserStock, getLowStockItems, getTodaySales, getPendingPayments, getUserSalesBills, data?.users, data?.bills])

  // Hierarchy calculations
  const rawDistributors = typeof getChildren === 'function' ? getChildren(ssId, 'DISTRIBUTOR') : users.filter(u => u.role === 'DISTRIBUTOR' && Number(u.parent_id || u.parentId) === Number(ssId))
  const distributors = Array.isArray(rawDistributors) ? rawDistributors : []
  
  const retailers = distributors.flatMap(d => {
    const childRetailers = typeof getChildren === 'function' ? getChildren(d.id, 'RETAILER') : users.filter(u => u.role === 'RETAILER' && Number(u.parent_id || u.parentId) === Number(d.id))
    return Array.isArray(childRetailers) ? childRetailers : []
  })
  
  const totalStockQty = Object.values(stockMap).reduce((s, q) => s + Number(q || 0), 0)
  const safeBills = Array.isArray(bills) ? bills : []
  const recentBills = [...safeBills].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5)

  // Sales by Distributor chart data
  const distSalesData = distributors.map(d => {
    const sales = safeBills
      .filter(b => Number(b.buyerId || b.buyer_id) === Number(d.id))
      .reduce((s, b) => {
        const sub = Number(b.subtotal ?? b.sub_total ?? 0)
        const gstAmt = Number(b.gst ?? (sub * 0.18))
        const disc = Number(b.discount ?? 0)
        return s + Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
      }, 0)
    return { name: d.name ? (d.name.split(' ')[1] || d.name) : 'Distributor', sales }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-dark-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mr-3"></div>
        Loading Super Store dashboard analytics...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Distributors" value={distributors.length} iconColor="text-accent-500" iconBg="bg-accent-500/15" />
        <MetricCard icon={Store} label="Retailers" value={retailers.length} iconColor="text-emerald-500" iconBg="bg-emerald-500/15" />
        <MetricCard icon={Warehouse} label="Current Stock" value={totalStockQty.toLocaleString()} iconColor="text-brand-500" iconBg="bg-brand-500/15" />
        <MetricCard icon={TrendingUp} label="Today's Sales" value={`₹${todaySalesVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} iconColor="text-emerald-500" iconBg="bg-emerald-500/15" />
        <MetricCard icon={ShoppingCart} label="Total Bills" value={safeBills.length} iconColor="text-purple-500" iconBg="bg-purple-500/15" />
        <MetricCard icon={IndianRupee} label="Pending Payments" value={`₹${pendingPaymentsVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} subValueColor="text-red-400" iconColor="text-red-500" iconBg="bg-red-500/15" />
        <MetricCard icon={AlertTriangle} label="Low Stock Items" value={lowStockList.length} subValueColor="text-amber-400" iconColor="text-amber-500" iconBg="bg-amber-500/15" />
        <MetricCard icon={Package} label="Products" value={Array.isArray(data?.products) ? data.products.length : 0} iconColor="text-brand-500" iconBg="bg-brand-500/15" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Sales to Distributors</h3>
          <div style={{ height: 300 }}>
            {distSalesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distSalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.08)" />
                  <XAxis dataKey="name" stroke="#9a978f" fontSize={12} />
                  <YAxis stroke="#9a978f" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#2a2a2f', border: '1px solid rgba(232,229,223,0.12)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Sales']} />
                  <Bar dataKey="sales" fill="#7ba8b8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-dark-muted text-sm">No distributor sales recorded</div>
            )}
          </div>
        </div>
        
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Bills</h3>
          <div className="space-y-3">
            {recentBills.length === 0 ? (
              <p className="text-dark-muted text-sm">No bills yet</p>
            ) : recentBills.map(bill => {
              const buyerId = bill.buyerId || bill.buyer_id
              const buyer = users.find(u => Number(u.id) === Number(buyerId))
              const sub = Number(bill.subtotal ?? bill.sub_total ?? 0)
              const gstAmt = Number(bill.gst ?? (sub * 0.18))
              const disc = Number(bill.discount ?? 0)
              const gTotal = Number(bill.grandTotal ?? bill.grand_total ?? bill.total ?? (sub + gstAmt - disc))
              const status = (bill.paymentStatus || bill.payment_status || 'PENDING').toUpperCase()

              return (
                <div key={bill.id} className="flex items-center justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
                  <div>
                    <div className="font-medium text-white text-sm">{bill.billNumber || bill.bill_number}</div>
                    <div className="text-xs text-dark-muted">{bill.billDate || bill.created_at || ''} · {buyer?.name || 'Partner'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">₹{gTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      status === 'PAID' ? 'bg-emerald-500/15 text-emerald-400' :
                      status === 'PARTIAL' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'
                    }`}>{status}</span>
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