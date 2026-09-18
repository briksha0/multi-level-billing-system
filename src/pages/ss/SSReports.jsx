// src/pages/ss/SSReports.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { api } from '../../api.js'
import { BarChart3, TrendingUp, Users, DollarSign, AlertCircle } from 'lucide-react'

export default function SSReports() {
  const { user } = useAuth()
  const [distributors, setDistributors] = useState([])
  const [retailers, setRetailers] = useState([])
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch network hierarchy and bills asynchronously via API to prevent flatMap crashes and sync errors
  useEffect(() => {
    async function fetchReportData() {
      try {
        setLoading(true)
        const currentUserId = user?.id || 2
        
        // Fetch child distributors
        const dists = await api.getChildren(currentUserId, 'DISTRIBUTOR')
        const safeDists = Array.isArray(dists) ? dists : []
        setDistributors(safeDists)

        // Fetch child retailers under each distributor
        let allRetailers = []
        for (const d of safeDists) {
          const rets = await api.getChildren(d.id, 'RETAILER')
          if (Array.isArray(rets)) {
            allRetailers = [...allRetailers, ...rets]
          }
        }
        setRetailers(allRetailers)

        // Fetch sales bills
        const salesBills = await api.getBills('sales')
        setBills(Array.isArray(salesBills) ? salesBills : [])
      } catch (err) {
        console.error('Failed to fetch analytics reports:', err)
        setDistributors([])
        setRetailers([])
        setBills([])
      } finally {
        setLoading(false)
      }
    }
    fetchReportData()
  }, [user])

  // Compute sales by distributor
  const distSales = distributors.map(d => {
    const dBills = bills.filter(b => (b.buyerId === d.id || b.buyer_id === d.id))
    const sales = dBills.reduce((sum, b) => {
      const sub = Number(b.subtotal ?? b.sub_total ?? 0)
      const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
      const disc = Number(b.discount ?? 0)
      const total = Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
      return sum + total
    }, 0)
    return { name: d.name?.split(' ')[1] || d.name || 'Distributor', sales }
  })

  // Compute sales by retailer
  const retailerSales = retailers.map(r => {
    const rBills = bills.filter(b => (b.buyerId === r.id || b.buyer_id === r.id))
    const sales = rBills.reduce((sum, b) => {
      const sub = Number(b.subtotal ?? b.sub_total ?? 0)
      const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
      const disc = Number(b.discount ?? 0)
      const total = Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
      return sum + total
    }, 0)
    return { name: r.name?.split(' ')[1] || r.name || 'Retailer', sales }
  }).sort((a, b) => b.sales - a.sales).slice(0, 8)

  // Payment status distribution
  const paidCount = bills.filter(b => {
    const status = (b.paymentStatus || b.payment_status || '').toUpperCase()
    return status === 'PAID'
  }).length

  const partialCount = bills.filter(b => {
    const status = (b.paymentStatus || b.payment_status || '').toUpperCase()
    return status === 'PARTIAL'
  }).length

  const pendingCount = bills.filter(b => {
    const status = (b.paymentStatus || b.payment_status || '').toUpperCase()
    return status === 'PENDING' || (!status && Number(b.dueAmount || b.due_amount || 0) > 0)
  }).length

  const paymentData = [
    { name: 'Paid', value: paidCount, color: '#10b981' },
    { name: 'Partial', value: partialCount, color: '#f59e0b' },
    { name: 'Pending', value: pendingCount, color: '#ef4444' },
  ].filter(item => item.value > 0)

  // Financial calculations
  const totalRevenue = bills.reduce((sum, b) => {
    const sub = Number(b.subtotal ?? b.sub_total ?? 0)
    const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
    const disc = Number(b.discount ?? 0)
    return sum + Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
  }, 0)

  const totalCollected = bills.reduce((sum, b) => sum + Number(b.paidAmount || b.paid_amount || 0), 0)
  const totalOutstanding = bills.reduce((sum, b) => {
    const sub = Number(b.subtotal ?? b.sub_total ?? 0)
    const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
    const disc = Number(b.discount ?? 0)
    const gTotal = Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
    const paid = Number(b.paidAmount || b.paid_amount || 0)
    const dueStored = Number(b.dueAmount || b.due_amount || (gTotal - paid))
    return sum + (dueStored > 0 ? dueStored : 0)
  }, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-dark-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500 mr-3"></div>
        Loading analytical reports...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Reports & Analytics</h2>
        <p className="text-dark-muted text-sm">Comprehensive sales performance and payment breakdown for your network</p>
      </div>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-lg">
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2 flex items-center gap-1.5"><TrendingUp size={14} className="text-accent-500" />Total Revenue</div>
          <div className="text-2xl font-black text-white">₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-lg">
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2 flex items-center gap-1.5"><DollarSign size={14} className="text-emerald-400" />Collected Amount</div>
          <div className="text-2xl font-black text-emerald-400">₹{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-lg">
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2 flex items-center gap-1.5"><AlertCircle size={14} className="text-amber-400" />Outstanding Dues</div>
          <div className="text-2xl font-black text-amber-400">₹{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-lg">
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2 flex items-center gap-1.5"><Users size={14} className="text-blue-400" />Active Network</div>
          <div className="text-2xl font-black text-white">{distributors.length + retailers.length} <span className="text-xs font-normal text-dark-muted">Entities</span></div>
        </div>
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sales by Distributor Bar Chart */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">Sales Performance by Distributor</h3>
          <div style={{ height: 300 }}>
            {distSales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distSales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.06)" />
                  <XAxis dataKey="name" stroke="#9a978f" fontSize={11} tickLine={false} />
                  <YAxis stroke="#9a978f" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Sales']} />
                  <Bar dataKey="sales" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-dark-muted text-sm">No distributor sales recorded yet</div>
            )}
          </div>
        </div>
        
        {/* Payment Status Pie Chart */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">Invoice Payment Status Distribution</h3>
          <div style={{ height: 300 }}>
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {paymentData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-dark-muted text-sm">No billing payment statuses available</div>
            )}
          </div>
        </div>
        
        {/* Top Retailers Horizontal Bar Chart */}
        {retailerSales.length > 0 && (
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 lg:col-span-2 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Top Retailers by Purchase Volume</h3>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={retailerSales} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.06)" />
                  <XAxis type="number" stroke="#9a978f" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#9a978f" fontSize={11} width={110} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Purchases']} />
                  <Bar dataKey="sales" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}