// src/pages/admin/AdminLayout.jsx
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { LayoutDashboard, Users, Package, Warehouse, FileText, BarChart3, LogOut, ChevronDown, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
    <div className="flex h-screen bg-dark-bg overflow-hidden">
      
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Sidebar (Responsive Drawer on Mobile, Sticky Fixed on Desktop) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-dark-border flex flex-col transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen shadow-sm
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-dark-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="https://www.aquauraessentials.com/assets/images/optimized/logo-header.jpg"
              alt="Aquaura Essentials logo"
              className="h-10 w-auto rounded-lg border border-dark-border bg-white p-1.5"
            />
            <div>
              <div className="font-bold text-dark-text">Aquaura Essencials</div>
              <div className="text-xs text-dark-muted">Admin Panel</div>
            </div>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden text-dark-muted hover:text-dark-text p-1"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setSidebarOpen(false)
                }}
                className={`sidebar-link w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive 
                    ? 'bg-brand-50 text-brand-600 border border-brand-200 shadow-sm' 
                    : 'text-dark-muted hover:text-dark-text hover:bg-slate-50'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-dark-border flex-shrink-0">
          <button onClick={handleLogout} className="sidebar-link w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-white/90 backdrop-blur border-b border-dark-border flex items-center justify-between px-4 lg:px-8 shadow-sm z-30 shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile Hamburger Toggle */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 border border-dark-border text-dark-text hover:bg-slate-200 transition"
              aria-label="Open Menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base lg:text-lg font-semibold text-dark-text truncate">
              {navItems.find(n => n.path === location.pathname)?.label || 'Admin'}
            </h1>
          </div>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors border border-transparent hover:border-dark-border"
            >
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white font-medium text-sm shadow">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <span className="text-sm font-semibold text-dark-text hidden sm:inline">{user?.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 hidden md:inline">{user?.role}</span>
              <ChevronDown size={16} className="text-dark-muted" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-dark-border rounded-xl shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-dark-border">
                  <div className="text-sm font-medium text-dark-text">{user?.name}</div>
                  <div className="text-xs text-dark-muted">{user?.username}</div>
                </div>
                <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm font-semibold text-red-500 hover:bg-red-50 flex items-center gap-2">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Scrollable View Area */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}