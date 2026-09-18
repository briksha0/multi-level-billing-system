// src/pages/distributor/DistributorReports.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../../api.js'
import { TrendingUp, DollarSign, AlertCircle, Users } from 'lucide-react'

export default function DistributorReports() {
  const { data } = useData()
  const { user } = useAuth()
  const userId = user?.id || 4

  const [retailers, setRetailers] = useState([])
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  // Asynchronously fetch retailers and sales bills to match backend API pattern
  useEffect(() => {
    async function fetchDistributorReports() {
      try {
        setLoading(true)
        
        // Fetch retailers network
        let rets = await api.getChildren('me', 'RETAILER').catch(() => api.getChildren(userId, 'RETAILER'))
        let list = []
        if (Array.isArray(rets)) {
          list = rets
        } else if (rets && typeof rets === 'object') {
          list = rets.data || rets.retailers || rets.users || []
        }
        if (list.length === 0 && Array.isArray(data?.users)) {
          list = data.users.filter(u => u.role === 'RETAILER' && (u.parentId === userId || u.parent_id === userId))
        }
        setRetailers(list)

        // Fetch sales bills
        const salesBills = await api.getBills('sales').catch(() => [])
        setBills(Array.isArray(salesBills) ? salesBills : [])
      } catch (err) {
        console.error('Failed to load distributor reports:', err)
        setRetailers([])
        setBills([])
      } finally {
        setLoading(false)
      }
    }
    fetchDistributorReports()
  }, [userId, data?.users])

  // Filter bills created by this distributor seller
  const mySalesBills = bills.filter(b => Number(b.sellerId || b.seller_id) === Number(userId))

  // Map sales per retailer accurately calculating subtotal + 18% GST - discount
  const retailerSales = retailers.map(r => {
    const rBills = mySalesBills.filter(b => Number(b.buyerId || b.buyer_id) === Number(r.id))
    const sales = rBills.reduce((sum, b) => {
      const sub = Number(b.subtotal ?? b.sub_total ?? 0)
      const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
      const disc = Number(b.discount ?? 0)
      const total = Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
      return sum + total
    }, 0)
    const displayName = r.name ? (r.name.split(' ')[1] || r.name) : 'Retailer'
    return { name: displayName, sales }
  }).sort((a, b) => b.sales - a.sales)

  // Financial metrics calculations
  const totalRevenue = mySalesBills.reduce((sum, b) => {
    const sub = Number(b.subtotal ?? b.sub_total ?? 0)
    const gstAmt = Number(b.gst ?? b.tax ?? (sub * 0.18))
    const disc = Number(b.discount ?? 0)
    return sum + Number(b.grandTotal ?? b.grand_total ?? b.total ?? (sub + gstAmt - disc))
  }, 0)

  const totalCollected = mySalesBills.reduce((sum, b) => sum + Number(b.paidAmount || b.paid_amount || 0), 0)
  
  const totalOutstanding = mySalesBills.reduce((sum, b) => {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mr-3"></div>
        Loading analytical reports...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Reports & Analytics</h2>
        <p className="text-dark-muted text-sm">Sales performance analytics and payment tracking for your retailer network</p>
      </div>
      
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border p-5 rounded-2xl shadow-lg">
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2 flex items-center gap-1.5"><TrendingUp size={14} className="text-emerald-400" />Total Revenue</div>
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
          <div className="text-xs uppercase tracking-wider font-semibold text-dark-muted mb-2 flex items-center gap-1.5"><Users size={14} className="text-blue-400" />Active Retailers</div>
          <div className="text-2xl font-black text-white">{retailers.length} <span className="text-xs font-normal text-dark-muted">Stores</span></div>
        </div>
      </div>
      
      {/* Sales Chart Section */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">Retailer Sales Performance</h3>
        {retailerSales.length > 0 ? (
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retailerSales}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,229,223,0.06)" />
                <XAxis dataKey="name" stroke="#9a978f" fontSize={11} tickLine={false} />
                <YAxis stroke="#9a978f" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(232,229,223,0.1)', borderRadius: '12px', color: '#e8e5df' }} formatter={(v) => [`₹${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Sales']} />
                <Bar dataKey="sales" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 text-dark-muted text-sm">No sales data recorded for retailers yet</div>
        )}
      </div>
    </div>
  )
}