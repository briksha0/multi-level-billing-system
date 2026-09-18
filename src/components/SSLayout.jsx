import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { LayoutDashboard, Users, Warehouse, FileText, BarChart3, LogOut, Network, ChevronDown, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function SSLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { path: '/ss/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/ss/network', label: 'Network', icon: Network },
    { path: '/ss/stock', label: 'Stock', icon: Warehouse },
    { path: '/ss/billing', label: 'Billing', icon: FileText },
    { path: '/ss/reports', label: 'Reports', icon: BarChart3 },
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

      {/* Sidebar (Responsive Drawer on Mobile, Fixed on Desktop) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-dark-card border-r border-dark-border flex flex-col transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-dark-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              S
            </div>
            <div>
              <div className="font-bold text-white text-base">MLB System</div>
              <div className="text-xs text-dark-muted">Super Store Panel</div>
            </div>
          </div>
          {/* Close button for mobile */}
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden text-dark-muted hover:text-white p-1"
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
                    ? 'bg-accent-500/15 text-accent-400 border border-accent-500/30 shadow-sm' 
                    : 'text-dark-muted hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-dark-border">
          <button onClick={handleLogout} className="sidebar-link w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-4 lg:px-8 z-30 shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile Hamburger Toggle */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-dark-bg border border-dark-border text-white hover:bg-white/5 transition"
              aria-label="Open Menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base lg:text-lg font-bold text-white truncate">
              {navItems.find(n => n.path === location.pathname)?.label || 'Super Store'}
            </h1>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-dark-border"
            >
              <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-white font-bold text-sm shadow">
                {user?.name?.charAt(0) || 'S'}
              </div>
              <span className="text-sm font-semibold text-white hidden sm:inline">{user?.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-500/20 text-accent-400 font-bold uppercase hidden md:inline">{user?.role}</span>
              <ChevronDown size={16} className="text-dark-muted" />
            </button>
            
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-dark-card border border-dark-border rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 border-b border-dark-border">
                  <div className="text-sm font-bold text-white">{user?.name}</div>
                  <div className="text-xs text-dark-muted font-mono mt-0.5">{user?.username}</div>
                </div>
                <button onClick={handleLogout} className="w-full px-4 py-2.5 text-left text-sm font-semibold text-red-400 hover:bg-red-500/15 transition flex items-center gap-2">
                  <LogOut size={16} /> Logout Account
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