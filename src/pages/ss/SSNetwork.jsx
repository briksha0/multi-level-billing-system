// src/pages/ss/SSUsers.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Plus, Search, UserPlus, Users, Store, Shield, MoreVertical, Lock } from 'lucide-react'
import { api } from '../../api.js'

export default function SSUsers() {
  const { data, addUser } = useData()
  const { user } = useAuth()
  const ssId = user?.id || 1

  const [activeTab, setActiveTab] = useState('DISTRIBUTOR')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [usersList, setUsersList] = useState([])
  
  // Create user form state including password and loading indicators
  const [newUser, setNewUser] = useState({ username: '', name: '', password: '', role: 'DISTRIBUTOR', parentId: ssId })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const roleConfig = {
    DISTRIBUTOR: { icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/15', label: 'My Distributors' },
    RETAILER: { icon: Store, color: 'text-purple-500', bg: 'bg-purple-500/15', label: 'Network Retailers' },
  }

  // Fetch users via API with context fallback
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await api.getUsers().catch(() => data?.users || [])
        const safeUsers = Array.isArray(res) ? res : (res?.data || res?.users || data?.users || [])
        setUsersList(safeUsers)
      } catch (err) {
        console.error('Failed to fetch users:', err)
        setUsersList(data?.users || [])
      }
    }
    fetchUsers()
  }, [data?.users])

  const isAdmin = user?.role === 'ADMIN'

  // Filter users belonging to this hierarchy
  const myDistributorIds = usersList.filter(u => u.role === 'DISTRIBUTOR' && (isAdmin || Number(u.parentId ?? u.parent_id) === Number(ssId))).map(d => d.id)

  const filteredUsers = usersList.filter(u => {
    if (u.role === 'ADMIN' || u.role === 'SS') return false
    if (activeTab && u.role !== activeTab) return false

    if (!isAdmin) {
      if (u.role === 'DISTRIBUTOR' && Number(u.parentId ?? u.parent_id) !== Number(ssId)) return false
      if (u.role === 'RETAILER' && !myDistributorIds.includes(Number(u.parentId ?? u.parent_id))) return false
    }

    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.username.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Full Create User Handler with submission state management
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.name || !newUser.password || isSubmitting) return
    try {
      setIsSubmitting(true)
      await addUser({
        name: newUser.name.trim(),
        username: newUser.username.toLowerCase().replace(/\s/g, '_'),
        password: newUser.password,
        role: newUser.role,
        parentId: Number(newUser.parentId) || ssId,
      })

      // Reset form and close modal
      setNewUser({ username: '', name: '', password: '', role: activeTab, parentId: ssId })
      setShowModal(false)

      // Refresh list from API
      const res = await api.getUsers().catch(() => [])
      setUsersList(Array.isArray(res) ? res : (res?.users || data?.users || []))
    } catch (err) {
      alert(err.message || 'Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getParentName = (parentId) => {
    const parent = usersList.find(u => Number(u.id) === Number(parentId))
    return parent?.name || '-'
  }

  const availableParents = isAdmin 
    ? usersList.filter(u => u.role === 'SS' || u.role === 'DISTRIBUTOR' || u.role === 'ADMIN')
    : usersList.filter(u => u.id === ssId || (newUser.role === 'RETAILER' && u.role === 'DISTRIBUTOR' && Number(u.parentId ?? u.parent_id) === Number(ssId)))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Distributor & Retailer Network</h2>
          <p className="text-dark-muted text-sm">Manage downline distributors and retailers</p>
        </div>
        <button onClick={() => { setNewUser(prev => ({ ...prev, role: activeTab, parentId: ssId })); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add Network User
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2">
        {Object.entries(roleConfig).map(([role, config]) => {
          const Icon = config.icon
          const count = usersList.filter(u => {
            if (role === 'DISTRIBUTOR') return u.role === 'DISTRIBUTOR' && (isAdmin || Number(u.parentId || u.parent_id) === Number(ssId))
            if (role === 'RETAILER') return u.role === 'RETAILER' && (isAdmin || myDistributorIds.includes(Number(u.parentId || u.parent_id)))
            return false
          }).length

          return (
            <button
              key={role}
              onClick={() => { setActiveTab(role); setNewUser(prev => ({ ...prev, role })) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === role
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/50'
                  : 'bg-dark-card border border-dark-border text-dark-muted hover:text-white'
              }`}
            >
              <Icon size={16} />
              {config.label}
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">{count}</span>
            </button>
          )
        })}
      </div>
      
      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search network users..."
          className="input-field pl-10"
        />
      </div>
      
      {/* Users Table */}
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full">
          <thead>
            <tr className="bg-dark-bg/50">
              <th className="table-header px-6 py-4">User</th>
              <th className="table-header px-6 py-4">Username</th>
              <th className="table-header px-6 py-4">Role</th>
              <th className="table-header px-6 py-4">Assigned Parent</th>
              <th className="table-header px-6 py-4">Status</th>
              <th className="table-header px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => {
              const config = roleConfig[u.role]
              const Icon = config?.icon || Shield
              return (
                <tr key={u.id} className="table-row">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${config?.bg} flex items-center justify-center ${config?.color}`}>
                        <Icon size={16} />
                      </div>
                      <span className="font-medium text-white">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-dark-muted font-mono text-sm">{u.username}</td>
                  <td className="px-6 py-4">
                    <span className={`status-pill ${config?.bg} ${config?.color}`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-4 text-dark-muted">{getParentName(u.parentId || u.parent_id)}</td>
                  <td className="px-6 py-4">
                    <span className={`status-pill ${
                      (u.status || 'active') === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {u.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white transition-colors">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-dark-muted">No network users found</div>
        )}
      </div>
      
      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
                <UserPlus size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">Add New Network User</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-muted mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                  className="input-field"
                >
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="RETAILER">Retailer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-dark-muted mb-2">Assign Parent To</label>
                <select
                  value={newUser.parentId}
                  onChange={(e) => setNewUser(prev => ({ ...prev, parentId: e.target.value }))}
                  className="input-field"
                >
                  <option value={ssId}>Myself ({user?.name || 'Admin'})</option>
                  {availableParents.filter(p => Number(p.id) !== Number(ssId)).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-dark-muted mb-2">Full Name *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm text-dark-muted mb-2">Username *</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., dist_north"
                />
              </div>
              
              <div>
                <label className="block text-sm text-dark-muted mb-2">Password *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    className="input-field pl-10 text-white"
                    placeholder="Enter login password"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} disabled={isSubmitting} className="flex-1 btn-secondary disabled:opacity-50">Cancel</button>
              <button 
                onClick={handleCreateUser} 
                disabled={!newUser.username || !newUser.name || !newUser.password || isSubmitting} 
                className="flex-1 btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}