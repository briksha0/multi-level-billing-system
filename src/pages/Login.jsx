// src/pages/Login.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { User, Lock, AlertCircle, Loader2 } from 'lucide-react'

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

  const handleInputKeyDown = (event) => {
    if (event.key !== 'Enter' || loading) return

    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-dark-bg text-white">
      <div className="w-full max-w-md sm:max-w-lg mx-auto">
        {/* Sign In Form Container */}
        <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-sm w-full">
          {/* Header Branding */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-dark-border p-2.5 flex items-center justify-center shadow-inner mb-4">
              <img
                src="https://www.aquauraessentials.com/assets/images/optimized/logo-header.jpg"
                alt="Aquaura Essentials logo"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Aquaura Essentials</h1>
            
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-dark-muted text-xs sm:text-sm mb-6">Sign in to access your dashboard</p>

          {error && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm mb-6">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Username</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="w-full bg-dark-bg text-white placeholder-dark-muted border border-dark-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-2xl pl-11 pr-4 py-3 outline-none text-sm transition-all"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="w-full bg-dark-bg text-white placeholder-dark-muted border border-dark-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-2xl pl-11 pr-4 py-3 outline-none text-sm transition-all"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-2xl py-3.5 text-sm transition-all duration-200 shadow-lg shadow-brand-600/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-dark-border text-center">
            <p className="text-xs text-dark-muted">Secure Enterprise Portal · Aquaura Essentials</p>
          </div>
        </div>
      </div>
    </div>
  )
}