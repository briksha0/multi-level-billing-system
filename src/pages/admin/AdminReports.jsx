// src/pages/admin/AdminReports.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { BarChart3, TrendingUp, DollarSign, FileText, Calendar } from 'lucide-react'
import { api } from '../../api.js'

export default function AdminReports() {
  const { data, getUserById } = useData()
  const [activeTab, setActiveTab] = useState('sales')
  const [timeFilter, setTimeFilter] = useState('all') // 'all' | 'year' | 'month' | 'week'
  
  const [users, setUsers] = useState([])
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch users and bills asynchronously using api helper for robust backend synchronization
  useEffect(() => {
    async function fetchAdminReportData() {
      try {
        setLoading(true)
        const usersRes = await api.getUsers().catch(() => [])
        const safeUsers = Array.isArray(usersRes) ? usersRes : (usersRes?.data || usersRes?.users || [])
        setUsers(safeUsers.length > 0 ? safeUsers : (Array.isArray(data?.users) ? data.users : []))

        const billsRes = await api.getBills('sales').catch(() => [])
        const safeBills = Array.isArray(billsRes) ? billsRes : (billsRes?.data || billsRes?.bills || [])
        setBills(safeBills.length > 0 ? safeBills : (Array.isArray(data?.bills) ? data.bills : []))
      } catch (err) {
        console.error('Failed to load admin reports data:', err)
        setUsers(Array.isArray(data?.users) ? data.users : [])
        setBills(Array.isArray(data?.bills) ? data.bills : [])
      } finally {
        setLoading(false)
      }
    }
    fetchAdminReportData()
  }, [data?.users, data?.bills])

  // Filter bills based on selected time range (All Time, Yearly, Monthly, Weekly)
  const now = new Date()
  const currentYear = now.getFullYear().toString()
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Calculate start of the current week (Sunday baseline)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const filteredBills = bills.filter(b => {
    const rawDateStr = b.billDate || b.created_at || ''
    if (!rawDateStr) return timeFilter === 'all'
    
    const billDate = new Date(rawDateStr)

    if (timeFilter === 'year') {
      return rawDateStr.startsWith(currentYear)
    }
    if (timeFilter === 'month') {
      return rawDateStr.startsWith(currentMonth)
    }
    if (timeFilter === 'week') {
      return billDate >= startOfWeek && billDate <= now
    }
    return true // 'all'
  })

  // Sales by Super Store (SS)
  const salesBySS = users.filter(u => (u.role || '').toUpperCase() === 'SS').map(ss => {
    const ssBills = filteredBills.filter(b => Number(b.buyerId || b.buyer_id) === Number(ss.id))
    const sales = ssBills.reduce((sum, b) => {
      const sub = Number(b.subtotal ?? b.sub_total ?? 0)
      const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
      const disc = Number(b.discount ?? 0)
      return sum + Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
    }, 0)
    return { name: ss.name ? (ss.name.split(' ')[1] || ss.name) : 'Super Store', sales }
  })

  // Sales by Distributor
  const salesByDist = users.filter(u => (u.role || '').toUpperCase() === 'DISTRIBUTOR').map(dist => {
    const distBills = filteredBills.filter(b => Number(b.buyerId || b.buyer_id) === Number(dist.id))
    const sales = distBills.reduce((sum, b) => {
      const sub = Number(b.subtotal ?? b.sub_total ?? 0)
      const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
      const disc = Number(b.discount ?? 0)
      return sum + Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
    }, 0)
    return { name: dist.name ? (dist.name.split(' ')[1] || dist.name) : 'Distributor', sales }
  }).sort((a, b) => b.sales - a.sales)

  // Product sales across filtered bills
  const productsList = Array.isArray(data?.products) ? data.products : []
  const productSales = productsList.map(p => {
    let qty = 0
    let revenue = 0

    filteredBills.forEach(b => {
      const items = b.items || []
      items.forEach(i => {
        if (Number(i.productId || i.product_id) === Number(p.id)) {
          const q = Number(i.quantity || 0)
          const rate = Number(i.rate || 0)
          qty += q
          revenue += Number(i.amount || (q * rate * 1.18))
        }
      })
    })

    return { name: p.name || 'Product', qty, revenue }
  }).filter(p => p.qty > 0).sort((a, b) => b.revenue - a.revenue)

  // Payment status distribution
  const paidCount = filteredBills.filter(b => (b.paymentStatus || b.payment_status || '').toUpperCase() === 'PAID').length
  const partialCount = filteredBills.filter(b => (b.paymentStatus || b.payment_status || '').toUpperCase() === 'PARTIAL').length
  const pendingCount = filteredBills.filter(b => {
    const status = (b.paymentStatus || b.payment_status || '').toUpperCase()
    return status === 'PENDING' || (!status && Number(b.dueAmount || b.due_amount || 0) > 0)
  }).length

  const paymentStatusData = [
    { name: 'Paid', value: paidCount, color: '#10b981' },
    { name: 'Partial', value: partialCount, color: '#f59e0b' },
    { name: 'Pending', value: pendingCount, color: '#ef4444' },
  ].filter(item => item.value > 0)

  // Outstanding by buyer
  const outstandingData = filteredBills
    .reduce((acc, bill) => {
      const sub = Number(bill.subtotal ?? bill.sub_total ?? 0)
      const gstAmt = Number(bill.gst ?? bill.tax ?? (sub * 0.18))
      const disc = Number(bill.discount ?? 0)
      const gTotal = Number(bill.grandTotal ?? bill.grand_total ?? bill.total ?? (sub + gstAmt - disc))
      const paid = Number(bill.paidAmount || bill.paid_amount || 0)
      const due = Number(bill.dueAmount || bill.due_amount || (gTotal - paid))

      if (due > 0) {
        const bId = bill.buyerId || bill.buyer_id
        const buyer = getUserById(bId) || users.find(u => Number(u.id) === Number(bId))
        const buyerName = buyer?.name || bill.buyerName || 'Partner Entity'
        
        const existing = acc.find(a => a.name === buyerName)
        if (existing) existing.due += due
        else acc.push({ name: buyerName, due })
      }
      return acc
    }, [])
    .sort((a, b) => b.due - a.due)

  // Monthly sales trend
  const monthlyData = {}
  filteredBills.forEach(b => {
    const rawDate = b.billDate || b.created_at || '2026-01-01'
    const month = rawDate.substring(0, 7)
    const sub = Number(b.subtotal ?? b.sub_total ?? 0)
    const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
    const disc = Number(b.discount ?? 0)
    const gTotal = Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))

    if (!monthlyData[month]) monthlyData[month] = 0
    monthlyData[month] += gTotal
  })
  const salesTrend = Object.entries(monthlyData).map(([month, total]) => ({ month, sales: total }))

  // Financial totals
  const totalRevenue = filteredBills.reduce((sum, b) => {
    const sub = Number(b.subtotal ?? b.sub_total ?? 0)
    const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
    const disc = Number(b.discount ?? 0)
    return sum + Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
  }, 0)

  const totalCollected = filteredBills.reduce((sum, b) => sum + Number(b.paidAmount || b.paid_amount || 0), 0)
  
  const totalOutstanding = filteredBills.reduce((sum, b) => {
    const sub = Number(b.subtotal ?? b.sub_total ?? 0)
    const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
    const disc = Number(b.discount ?? 0)
    const gTotal = Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
    const paid = Number(b.paidAmount || b.paid_amount || 0)
    const dueStored = Number(b.dueAmount || b.due_amount || (gTotal - paid))
    return sum + (dueStored > 0 ? dueStored : 0)
  }, 0)

  const tabs = [
    { id: 'sales', label: 'Sales Overview', icon: BarChart3 },
    { id: 'outstanding', label: 'Outstanding', icon: DollarSign },
    { id: 'products', label: 'Product Sales', icon: FileText },
    { id: 'trend', label: 'Sales Trend', icon: TrendingUp },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-dark-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mr-3"></div>
        Loading comprehensive business analytics...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Reports & Analytics</h2>
          <p className="text-dark-muted text-sm">Comprehensive business insights across all supply chain levels</p>
        </div>

        {/* Time Filter Selector */}
        <div className="flex items-center gap-1.5 bg-dark-card border border-dark-border p-1.5 rounded-2xl">
          <Calendar size={15} className="text-brand-400 ml-2" />
          <button 
            onClick={() => setTimeFilter('all')} 
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${timeFilter === 'all' ? 'bg-brand-500 text-white shadow' : 'text-dark-muted hover:text-white'}`}
          >
            All Time
          </button>
          <button 
            onClick={() => setTimeFilter('year')} 
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${timeFilter === 'year' ? 'bg-brand-500 text-white shadow' : 'text-dark-muted hover:text-white'}`}
          >
            This Year ({currentYear})
          </button>
          <button 
            onClick={() => setTimeFilter('month')} 
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${timeFilter === 'month' ? 'bg-brand-500 text-white shadow' : 'text-dark-muted hover:text-white'}`}
          >
            This Month
          </button>
          <button 
            onClick={() => setTimeFilter('week')} 
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${timeFilter === 'week' ? 'bg-brand-500 text-white shadow' : 'text-dark-muted hover:text-white'}`}
          >
            This Week
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/50 shadow-md'
                  : 'bg-dark-card border border-dark-border text-dark-muted hover:text-white'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-lg">
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2">Total Revenue</div>
          <div className="text-2xl font-black text-white">₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-lg">
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2">Total Collected</div>
          <div className="text-2xl font-black text-emerald-400">₹{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-lg">
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2">Total Outstanding</div>
          <div className="text-2xl font-black text-amber-400">₹{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-lg">
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2">Total Bills</div>
          <div className="text-2xl font-black text-white">{filteredBills.length} <span className="text-xs font-normal text-dark-muted">Invoices</span></div>
        </div>
      </div>
      
      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Sales by Super Store</h3>
            <div style={{ height: 300 }}>
              {salesBySS.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesBySS}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.06)" />
                    <XAxis dataKey="name" stroke="#9a978f" fontSize={11} tickLine={false} />
                    <YAxis stroke="#9a978f" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Sales']} />
                    <Bar dataKey="sales" fill="#c47046" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-dark-muted text-sm">No Super Store sales recorded for this period</div>
              )}
            </div>
          </div>
          
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Invoice Payment Status</h3>
            <div style={{ height: 300 }}>
              {paymentStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentStatusData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {paymentStatusData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-dark-muted text-sm">No payment status data available for this period</div>
              )}
            </div>
          </div>
          
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 lg:col-span-2 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Top Distributors by Purchase Volume</h3>
            <div style={{ height: 280 }}>
              {salesByDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByDist} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.06)" />
                    <XAxis type="number" stroke="#9a978f" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#9a978f" fontSize={11} width={110} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Purchases']} />
                    <Bar dataKey="sales" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-dark-muted text-sm">No distributor purchases recorded for this period</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'outstanding' && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">Outstanding Payments by Party</h3>
          {outstandingData.length === 0 ? (
            <div className="py-20 text-center text-dark-muted text-sm">No outstanding payments for this period</div>
          ) : (
            <div style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outstandingData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.06)" />
                  <XAxis type="number" stroke="#9a978f" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#9a978f" fontSize={11} width={130} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Due']} />
                  <Bar dataKey="due" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'products' && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">Top Selling Products by Revenue</h3>
          {productSales.length > 0 ? (
            <div style={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productSales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.06)" />
                  <XAxis dataKey="name" stroke="#9a978f" fontSize={11} tickLine={false} />
                  <YAxis stroke="#9a978f" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#c47046" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-20 text-center text-dark-muted text-sm">No product sales recorded for this period</div>
          )}
        </div>
      )}
      
      {activeTab === 'trend' && (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">Monthly Sales Trend</h3>
          {salesTrend.length > 0 ? (
            <div style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.06)" />
                  <XAxis dataKey="month" stroke="#9a978f" fontSize={11} tickLine={false} />
                  <YAxis stroke="#9a978f" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Sales']} />
                  <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-20 text-center text-dark-muted text-sm">No monthly trend data available for this period</div>
          )}
        </div>
      )}
    </div>
  )
}