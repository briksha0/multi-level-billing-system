import { useState } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Plus, Search, UserPlus, Building2, Users, Store, Shield, MoreVertical } from 'lucide-react'

export default function AdminUsers() {
  const { data, addUser, getChildren } = useData()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('SS')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', name: '', role: 'SS', parentId: 1 })

  const roleConfig = {
    DISTRIBUTOR: { icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/15', label: 'Distributors' },
    RETAILER: { icon: Store, color: 'text-purple-500', bg: 'bg-purple-500/15', label: 'Retailers' },
  }

  const filteredUsers = data.users.filter(u => {
    if (u.role === 'ADMIN') return false
    if (activeTab && u.role !== activeTab) return false
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.username.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleAddUser = () => {
    if (!newUser.username || !newUser.name) return
    addUser({
      ...newUser,
      username: newUser.username.toLowerCase().replace(/\s/g, '_'),
    })
    setNewUser({ username: '', name: '', role: activeTab, parentId: 1 })
    setShowModal(false)
  }

  const getParentName = (parentId) => {
    const parent = data.users.find(u => u.id === parentId)
    return parent?.name || '-'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-dark-muted text-sm">Manage SS, Distributors, and Retailers</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add User
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2">
        {Object.entries(roleConfig).map(([role, config]) => {
          const Icon = config.icon
          const count = data.users.filter(u => u.role === role).length
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
          placeholder="Search users..."
          className="input-field pl-10"
        />
      </div>
      
      {/* Users Table */}
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-dark-bg/50">
              <th className="table-header px-6 py-4">User</th>
              <th className="table-header px-6 py-4">Username</th>
              <th className="table-header px-6 py-4">Role</th>
              <th className="table-header px-6 py-4">Parent</th>
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
                  <td className="px-6 py-4 text-dark-muted">{getParentName(u.parentId)}</td>
                  <td className="px-6 py-4">
                    <span className={`status-pill ${
                      u.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {u.status}
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
          <div className="text-center py-12 text-dark-muted">No users found</div>
        )}
      </div>
      
      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
                <UserPlus size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">Add New User</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-muted mb-2">Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., SS Mumbai"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-muted mb-2">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., ss_mumbai"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-muted mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                  className="input-field"
                >
                  <option value="SS">Super Store</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="RETAILER">Retailer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-dark-muted mb-2">Parent User</label>
                <select
                  value={newUser.parentId}
                  onChange={(e) => setNewUser(prev => ({ ...prev, parentId: parseInt(e.target.value) }))}
                  className="input-field"
                >
                  {data.users.filter(u => {
                    if (newUser.role === 'SS') return u.role === 'ADMIN'
                    if (newUser.role === 'DISTRIBUTOR') return u.role === 'SS'
                    if (newUser.role === 'RETAILER') return u.role === 'DISTRIBUTOR'
                    return false
                  }).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={handleAddUser} className="flex-1 btn-primary">Add User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
