// src/pages/retailer/RetailerLayout.jsx
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { LayoutDashboard, Warehouse, LogOut, ChevronDown, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function RetailerLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { path: '/retailer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/retailer/stock', label: 'Stock', icon: Warehouse },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNavClick = (path) => {
    navigate(path)
    setSidebarOpen(false) // Close mobile sidebar on navigation
  }

  return (
    <div className="flex min-h-screen bg-dark-bg text-white">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar Navigation - Responsive Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-card border-r border-dark-border flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold text-lg shadow-md">
              R
            </div>
            <div>
              <div className="font-bold text-white text-sm sm:text-base">Aquaura Essentials</div>
              <div className="text-xs text-dark-muted">Retailer Panel</div>
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
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' 
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
      
      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2 rounded-xl bg-dark-bg border border-dark-border text-dark-muted hover:text-white"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-white truncate">
              {navItems.find(n => n.path === location.pathname)?.label || 'Retailer'}
            </h1>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-dark-border"
            >
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-medium text-sm shadow">
                {user?.name?.charAt(0) || 'R'}
              </div>
              <span className="text-sm text-white hidden sm:inline font-medium">{user?.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold hidden md:inline">{user?.role}</span>
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
        
        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto bg-dark-bg">
          <Outlet />
        </main>
      </div>
    </div>
  )
}