// src/pages/Login.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Building2, User, Lock, AlertCircle, ArrowRight } from 'lucide-react'

// Demo accounts matching the exact seeds in our PostgreSQL database
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

  const { login, getRoleHomeRoute } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(username, password)

      if (result && result.success) {
        navigate(getRoleHomeRoute(result.user.role))
      } else {
        setError(result?.error || 'Invalid credentials')
      }
    } catch (err) {
      setError(err.message || 'An error occurred connecting to the server')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (acc) => {
    setUsername(acc.username)
    setPassword(acc.password)
  }

  const handleInputKeyDown = (event) => {
    if (event.key !== 'Enter' || loading) return

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        <div className="hidden md:block">
          <div className="flex items-center gap-3 mb-8">
            <img
              src="https://www.aquauraessentials.com/assets/images/optimized/logo-header.jpg"
              alt="Aquaura Essentials logo"
              className="h-14 w-auto rounded-xl border border-dark-border bg-white p-2 shadow-soft"
            />
            <div>
              <h1 className="text-2xl font-bold text-dark-text">Aquaura Essentials</h1>
              <p className="text-sm text-dark-muted">Multi-Level Billing & Stock Management</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-dark-text mb-4 leading-tight">
            Pure essentials for a
            <span className="block bg-gradient-to-r from-brand-500 to-accent-600 bg-clip-text text-transparent">
              cleaner business flow
            </span>
          </h2>

          <p className="text-dark-muted mb-8 leading-relaxed">
            Manage your distribution chain with smarter stock movement, secure billing, and clear reporting across every business level.
          </p>

          <div className="space-y-4">
            {[
              { title: 'Role-Based Access', desc: 'Every team sees the right business view' },
              { title: 'Stock Automation', desc: 'Bills update inventory without manual steps' },
              { title: 'Complete Reporting', desc: 'Track payments, sales and distribution performance' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-white/80 border border-dark-border shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 flex-shrink-0">
                  <ArrowRight size={16} />
                </div>
                <div>
                  <div className="font-semibold text-dark-text text-sm">{item.title}</div>
                  <div className="text-xs text-dark-muted">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/90 border border-dark-border rounded-3xl p-8 shadow-soft backdrop-blur-sm">
          <div className="md:hidden flex items-center gap-3 mb-6">
            <img
              src="https://www.aquauraessentials.com/assets/images/optimized/logo-header.jpg"
              alt="Aquaura Essentials logo"
              className="h-12 w-auto rounded-xl border border-dark-border bg-white p-1.5"
            />
            <div>
              <h1 className="text-xl font-bold text-dark-text">Aquaura Essentials</h1>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-dark-text mb-2">Welcome back</h2>
          <p className="text-dark-muted text-sm mb-6">Sign in to access your dashboard</p>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm mb-4">
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
                  onKeyDown={handleInputKeyDown}
                  className="input-field pl-10 bg-white text-dark-text border-dark-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-full rounded-xl py-2.5 outline-none text-sm"
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
                  onKeyDown={handleInputKeyDown}
                  className="input-field pl-10 bg-white text-dark-text border-dark-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-full rounded-xl py-2.5 outline-none text-sm"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-xl py-2.5 font-medium disabled:opacity-50 transition-colors shadow-lg shadow-brand-600/20"
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
                  type="button"
                  onClick={() => quickLogin(u)}
                  className="text-left p-2.5 rounded-xl bg-brand-50 border border-brand-100 hover:border-brand-500 transition-colors text-xs group"
                >
                  <div className="font-semibold text-dark-text group-hover:text-brand-700 transition-colors">{u.role}</div>
                  <div className="text-dark-muted font-mono mt-0.5">{u.username}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}