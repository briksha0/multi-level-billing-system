import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Building2, User, Lock, AlertCircle, ArrowRight } from 'lucide-react'

// Demo accounts matching the exact seeds in our MySQL database
const DEMO_ACCOUNTS = [
  { id: 1, role: 'ADMIN', username: 'admin', password: 'admin123' },
  { id: 2, role: 'SS', username: 'ss_agra', password: 'ss123' },
  { id: 3, role: 'DISTRIBUTOR', username: 'dist_a', password: 'dist123' },
  { id: 4, role: 'RETAILER', username: 'retail_a', password: 'retail123' }
];

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Removed DEMO_USERS from context since we use the real DB seeded ones above
  const { login, getRoleHomeRoute } = useAuth() 
  const navigate = useNavigate()

  // Converted to async/await to handle the real API request
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // login() should now return a Promise from your updated AuthContext
      const result = await login(username, password)
      
      if (result.success) {
        // The real backend returns the user object on success
        navigate(getRoleHomeRoute(result.user.role))
      } else {
        setError(result.error || 'Invalid credentials')
      }
    } catch (err) {
      setError('An error occurred connecting to the server')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (user) => {
    setUsername(user.username)
    setPassword(user.password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'radial-gradient(1200px 600px at 80% -10%, rgba(196,112,70,0.12), transparent 60%), #202024'
    }}>
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        
        {/* Left side - Info */}
        <div className="hidden md:block">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-brand-500/20">
              <Building2 size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">MLB System</h1>
              <p className="text-sm text-dark-muted">Multi-Level Billing & Stock Management</p>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Complete Distribution<br />
            <span className="bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">
              Management Platform
            </span>
          </h2>
          
          <p className="text-dark-muted mb-8 leading-relaxed">
            Manage your entire distribution chain from Admin to Super Store to Distributor to Retailer to Customer.
            Automated stock transfer, multi-level billing, payment tracking, and comprehensive reporting.
          </p>
          
          <div className="space-y-4">
            {[
              { title: 'Role-Based Access', desc: 'Each level sees only what they need' },
              { title: 'Automated Stock Flow', desc: 'Bills automatically update inventory' },
              { title: 'Complete Reporting', desc: 'Sales, stock, payments, GST & more' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-dark-card/50 border border-dark-border">
                <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center text-brand-400 flex-shrink-0">
                  <ArrowRight size={16} />
                </div>
                <div>
                  <div className="font-medium text-white text-sm">{item.title}</div>
                  <div className="text-xs text-dark-muted">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Right side - Login Form */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-8 shadow-2xl">
          <div className="md:hidden flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xl">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">MLB System</h1>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-dark-muted text-sm mb-6">Sign in to access your dashboard</p>
          
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-dark-muted mb-2">Username</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field pl-10 bg-dark-bg text-white border-dark-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-full rounded-lg py-2 outline-none"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-dark-muted mb-2">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10 bg-dark-bg text-white border-dark-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-full rounded-lg py-2 outline-none"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-dark-border">
            <p className="text-xs text-dark-muted mb-3 uppercase tracking-wide">Quick Demo Logins:</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(u => (
                <button
                  key={u.id}
                  onClick={() => quickLogin(u)}
                  className="text-left p-2 rounded-lg bg-dark-bg border border-dark-border hover:border-brand-500 transition-colors text-xs"
                >
                  <div className="font-medium text-white">{u.role}</div>
                  <div className="text-dark-muted">{u.username}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}