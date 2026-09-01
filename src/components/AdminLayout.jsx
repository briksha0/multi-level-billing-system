import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { LayoutDashboard, Users, Package, Warehouse, FileText, BarChart3, LogOut, ChevronDown } from 'lucide-react'
import { useState } from 'react'


export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/products', label: 'Products', icon: Package },
    { path: '/admin/stock', label: 'Stock', icon: Warehouse },
    { path: '/admin/billing', label: 'Billing', icon: FileText },
    { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-dark-bg">
      <aside className="w-64 bg-white border-r border-dark-border flex flex-col shadow-sm">
        <div className="p-6 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <img
              src="https://www.aquauraessentials.com/assets/images/optimized/logo-header.jpg"
              alt="Aquaura Essentials logo"
              className="h-10 w-auto rounded-lg border border-dark-border bg-white p-1.5"
            />
            <div>
              <div className="font-bold text-dark-text">Aquaura</div>
              <div className="text-xs text-dark-muted">Admin Panel</div>
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
          <button onClick={handleLogout} className="sidebar-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-50">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white/90 backdrop-blur border-b border-dark-border flex items-center justify-between px-6 shadow-sm">
          <h1 className="text-lg font-semibold text-dark-text">
            {navItems.find(n => n.path === location.pathname)?.label || 'Admin'}
          </h1>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white font-medium text-sm">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <span className="text-sm text-dark-text">{user?.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">{user?.role}</span>
              <ChevronDown size={16} className="text-dark-muted" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-dark-border rounded-xl shadow-soft py-2 z-50">
                <div className="px-4 py-2 border-b border-dark-border">
                  <div className="text-sm font-medium text-dark-text">{user?.name}</div>
                  <div className="text-xs text-dark-muted">{user?.username}</div>
                </div>
                <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50">
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
