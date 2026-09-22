import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import MetricCard from '../../components/MetricCard.jsx'
import { Package, Warehouse } from 'lucide-react'

export default function RetailerDashboard() {
  const { user } = useAuth()
  const { data } = useData()
  const products = Array.isArray(data?.products) ? data.products : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Retailer Dashboard</h2>
        <p className="text-dark-muted text-sm">Welcome, {user?.name || 'Retailer'}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard icon={Package} label="Products" value={products.length} iconColor="text-brand-500" iconBg="bg-brand-500/15" />
        <MetricCard icon={Warehouse} label="Supplier Stock" value="View stock" iconColor="text-emerald-500" iconBg="bg-emerald-500/15" />
      </div>
    </div>
  )
}
