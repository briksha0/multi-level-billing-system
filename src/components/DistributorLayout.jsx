// src/pages/distributor/DistributorLayout.jsx
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { LayoutDashboard, Users, Warehouse, FileText, BarChart3, LogOut, Store, ChevronDown, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function DistributorLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  const handleNavClick = (path) => {
    navigate(path)
    setSidebarOpen(false) // Close mobile sidebar drawer upon navigation
  }

  return (
    <div className="flex h-screen overflow-hidden bg-dark-bg text-white">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar - Responsive Drawer for Mobile & Sticky for Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-card border-r border-dark-border flex flex-col h-screen transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 border-b border-dark-border flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-lg shadow-md">
              D
            </div>
            <div>
              <div className="font-bold text-white text-sm sm:text-base">Aquaura Essentials</div>
              <div className="text-xs text-dark-muted">Distributor Panel</div>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden p-1 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white"
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
                onClick={() => handleNavClick(item.path)}
                className={`sidebar-link w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                    : 'text-dark-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-dark-border flex-shrink-0">
          <button onClick={handleLogout} className="sidebar-link w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <header className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2 rounded-xl bg-dark-bg border border-dark-border text-dark-muted hover:text-white"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-white truncate">
              {navItems.find(n => n.path === location.pathname)?.label || 'Distributor'}
            </h1>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-dark-border"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-medium text-sm shadow">
                {user?.name?.charAt(0) || 'D'}
              </div>
              <span className="text-sm text-white hidden sm:inline font-medium">{user?.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold hidden md:inline">{user?.role}</span>
              <ChevronDown size={16} className="text-dark-muted" />
            </button>
            
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-dark-card border border-dark-border rounded-xl shadow-2xl py-2 z-50">
                <div className="px-4 py-2 border-b border-dark-border">
                  <div className="text-sm font-medium text-white truncate">{user?.name}</div>
                  <div className="text-xs text-dark-muted truncate">{user?.username}</div>
                </div>
                <button onClick={handleLogout} className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>
        
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-dark-bg">
          <Outlet />
        </main>
      </div>
    </div>
  )
}