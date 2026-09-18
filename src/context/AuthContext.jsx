import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api.js'

const AuthContext = createContext()

// Demo credentials for display on login page
const DEMO_USERS = [
  { id: 1, username: 'admin', role: 'ADMIN', name: 'System Admin' },
  { id: 2, username: 'ss_agra', role: 'SS', name: 'SS Agra' },
  { id: 3, username: 'dist_a', role: 'DISTRIBUTOR', name: 'Distributor A' },
  { id: 4, username: 'retail_a', role: 'RETAILER', name: 'Retailer A' },
]

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const token = api.getToken()
      if (token) {
        try {
          const data = await api.getMe()
          setUser(data.user)
        } catch (err) {
          api.clearToken()
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  const login = async (username, password) => {
    try {
      const data = await api.login(username, password)
      api.setToken(data.token)
      setUser(data.user)
      
      return { success: true, user: data.user }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }

  const logout = () => {
    api.clearToken()
    setUser(null)
  }

  const hasPermission = (requiredRole) => {
    if (!user) return false
    const hierarchy = { ADMIN: 4, SS: 3, DISTRIBUTOR: 2, RETAILER: 1 }
    return hierarchy[user.role] >= hierarchy[requiredRole]
  }

  const getRoleHomeRoute = (role) => {
    switch (role) {
      case 'ADMIN': return '/admin/dashboard'
      case 'SS': return '/ss/dashboard'
      case 'DISTRIBUTOR': return '/distributor/dashboard'
      case 'RETAILER': return '/retailer/dashboard'
      default: return '/login'
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasPermission, getRoleHomeRoute, DEMO_USERS }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}