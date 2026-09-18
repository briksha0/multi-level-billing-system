import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { LayoutDashboard, Users, Warehouse, FileText, BarChart3, LogOut, Store, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export default function DistributorLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const navItems = [
    { path: '/distributor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/distributor/retailers', label: 'Retailers', icon: Store },
    { path: '/distributor/stock', label: 'Stock', icon: Warehouse },
    { path: '/distributor/billing', label: 'Billing', icon: FileText },
    { path: '/distributor/reports', label: 'Reports', icon: BarChart3 },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-dark-card border-r border-dark-border flex flex-col">
        <div className="p-6 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-lg">
              D
            </div>
            <div>
              <div className="font-bold text-white">MLB System</div>
              <div className="text-xs text-dark-muted">Distributor Panel</div>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`sidebar-link w-full text-left ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-dark-border">
          <button onClick={handleLogout} className="sidebar-link w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-white">
            {navItems.find(n => n.path === location.pathname)?.label || 'Distributor'}
          </h1>
          
          <div className="relative">
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-medium text-sm">
                {user?.name?.charAt(0) || 'D'}
              </div>
              <span className="text-sm text-white">{user?.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{user?.role}</span>
              <ChevronDown size={16} className="text-dark-muted" />
            </button>
            
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-dark-card border border-dark-border rounded-xl shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-dark-border">
                  <div className="text-sm font-medium text-white">{user?.name}</div>
                  <div className="text-xs text-dark-muted">{user?.username}</div>
                </div>
                <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10">
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>
        
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
