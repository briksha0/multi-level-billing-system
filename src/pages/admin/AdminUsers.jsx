// src/pages/admin/AdminUsers.jsx
import { useState } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Plus, Search, UserPlus, Building2, Users, Store, Shield, Trash2, Key } from 'lucide-react'

export default function AdminUsers() {
  const { data, addUser, deleteUser } = useData()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('SS')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', name: '', password: '', role: 'SS', parentId: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // State for the Change Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordTargetUser, setPasswordTargetUser] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const roleConfig = {
    SS: { icon: Building2, color: 'text-accent-500', bg: 'bg-accent-500/15', label: 'Super Stores' },
    DISTRIBUTOR: { icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/15', label: 'Distributors' },
    RETAILER: { icon: Store, color: 'text-purple-500', bg: 'bg-purple-500/15', label: 'Retailers' },
  }

  const usersList = Array.isArray(data?.users) ? data.users : []

   const getParentCandidates = (role) => {
    let base = usersList;
    if (user?.role === 'ADMIN' && !base.find(u => u.id === user.id)) {
       base = [user, ...base];
    }
    
    if (role === 'SS') return base.filter(u => u.role === 'ADMIN');
    if (role === 'DISTRIBUTOR') return base.filter(u => u.role === 'SS' || u.role === 'ADMIN');
    if (role === 'RETAILER') return base.filter(u => u.role === 'DISTRIBUTOR' || u.role === 'SS' || u.role === 'ADMIN');
    return [];
  }

  const handleRoleChange = (role) => {
    const parent = getParentCandidates(role)[0]
    setNewUser(prev => ({ ...prev, role, parentId: parent?.id || '' }))
  }

  const filteredUsers = usersList.filter(u => {
    if (u.role === 'ADMIN') return false
    if (activeTab && u.role !== activeTab) return false
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.username.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Open the password change modal for a selected user
  const handleOpenPasswordModal = (targetUser) => {
    setPasswordTargetUser(targetUser)
    setNewPassword('')
    setShowPasswordModal(true)
  }

  // Submit the updated password to the backend
  const handleChangePassword = async () => {
    if (!passwordTargetUser || !newPassword) {
      alert('Please enter a new password.')
      return
    }

    try {
      const res = await fetch(`/api/users/${passwordTargetUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mlb_token')}`
        },
        body: JSON.stringify({ password: newPassword })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to update user password')
      }

      alert(`Password updated successfully for ${passwordTargetUser.name}`)
      setShowPasswordModal(false)
      setPasswordTargetUser(null)
      setNewPassword('')
    } catch (err) {
      alert(err.message || 'Failed to update password')
    }
  }

 const handleAddUser = async () => {
    if (!newUser.username || !newUser.name || !newUser.password || !newUser.parentId) {
      setError('All fields, including a valid Parent User, are required.')
      return
    }
    try {
      setError('')
      setLoading(true)
      await addUser({
        ...newUser,
        username: newUser.username.toLowerCase().replace(/\s/g, '_'),
        parentId: parseInt(newUser.parentId, 10),
      })
      const defaultParent = getParentCandidates(activeTab)[0]
      setNewUser({ username: '', name: '', password: '', role: activeTab, parentId: defaultParent?.id || 1 })
      setShowModal(false)
    } catch (err) {
      setError(err.message || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  const getParentName = (parentId) => {
    if (!parentId) return '-'
    if (Number(parentId) === Number(user?.id)) return user?.name || 'Admin'
    
    const parent = usersList.find(u => Number(u.id) === Number(parentId))
    return parent?.name || '-'
  }
  
  const handleDeleteUser = async (u) => {
    if (!u) return
    if (u.id === user?.id) {
      alert('You cannot delete your own account.')
      return
    }

    const confirmed = window.confirm(`Delete user ${u.name} (${u.username})? This action cannot be undone.`)
    if (!confirmed) return

    try {
      await deleteUser(u.id)
    } catch (err) {
      alert(err.message || 'Failed to delete user')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-dark-muted text-sm">Manage SS, Distributors, and Retailers</p>
        </div>
        <button onClick={() => {
          setError('')
          const parent = getParentCandidates(activeTab)[0]
          setNewUser(prev => ({ ...prev, role: activeTab, parentId: parent?.id || '' }))
          setShowModal(true)
        }} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add User
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {Object.entries(roleConfig).map(([role, config]) => {
          const Icon = config.icon
          const count = usersList.filter(u => u.role === role).length
          return (
            <button
              key={role}
              onClick={() => { setActiveTab(role); handleRoleChange(role) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === role
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
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl">
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
              const uStatus = u.status || 'active'
              return (
                <tr key={u.id} className="table-row hover:bg-white/[0.02]">
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
                    <span className={`status-pill ${uStatus === 'active' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      }`}>
                      {uStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-1">
                    <button
                      onClick={() => handleOpenPasswordModal(u)}
                      className="p-2 rounded-lg hover:bg-amber-500/10 text-dark-muted hover:text-amber-400 transition-colors inline-flex items-center justify-center"
                      title="Change Password"
                    >
                      <Key size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-dark-muted hover:text-red-400 transition-colors inline-flex items-center justify-center"
                      title="Delete user"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-dark-muted text-sm">No users found</div>
        )}
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-400">
                <UserPlus size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Add New User</h3>
            </div>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field text-sm"
                  placeholder="e.g., SS Mumbai"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  className="input-field text-sm"
                  placeholder="e.g., ss_mumbai"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  className="input-field text-sm"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="input-field text-sm font-medium"
                >
                  <option value="SS">Super Store</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="RETAILER">Retailer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Parent User *</label>
                <select
                  value={newUser.parentId || ''}
                  onChange={(e) => setNewUser(prev => ({ ...prev, parentId: parseInt(e.target.value, 10) }))}
                  className="input-field text-sm font-medium"
                >
                  <option value="" disabled>-- Select Parent User --</option>
                  {getParentCandidates(newUser.role).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t border-dark-border">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary py-2.5 text-sm font-semibold">Cancel</button>
              <button onClick={handleAddUser} disabled={loading} className="flex-1 btn-primary py-2.5 text-sm font-bold disabled:opacity-50">
                {loading ? 'Creating...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && passwordTargetUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-dark-border">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Key size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Change User Password</h3>
                <p className="text-xs text-dark-muted">User: <span className="text-white font-semibold">{passwordTargetUser.name}</span></p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">New Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field text-sm font-medium"
                  placeholder="Enter secure new password"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t border-dark-border">
              <button 
                onClick={() => setShowPasswordModal(false)} 
                className="flex-1 btn-secondary py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button 
                onClick={handleChangePassword} 
                className="flex-1 btn-primary py-3 text-sm font-bold bg-amber-600 hover:bg-amber-500"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}