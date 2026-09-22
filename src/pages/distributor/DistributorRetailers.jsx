// src/pages/distributor/DistributorRetailers.jsx
import { useState, useEffect } from 'react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { Plus, UserPlus, MoreVertical, Lock } from 'lucide-react'
import { api } from '../../api.js'

export default function DistributorRetailers() {
  const { data, addUser } = useData()
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [retailers, setRetailers] = useState([])
  const [loading, setLoading] = useState(true)
  
  const userId = user?.id || 4
  const [newUser, setNewUser] = useState({ username: '', name: '', password: '', role: 'RETAILER', parentId: userId })

  // Fetch retailers safely with robust fallback parsing
  useEffect(() => {
    async function fetchRetailers() {
      try {
        setLoading(true)
        let res = await api.getChildren('me', 'RETAILER').catch(() => api.getChildren(userId, 'RETAILER'))
        
        let list = []
        if (Array.isArray(res)) {
          list = res
        } else if (res && typeof res === 'object') {
          list = res.data || res.retailers || res.users || []
        }

        if (list.length === 0 && Array.isArray(data?.users)) {
          list = data.users.filter(u => u.role === 'RETAILER' && (Number(u.parentId || u.parent_id) === Number(userId)))
        }

        setRetailers(list)
      } catch (err) {
        console.error('Failed to fetch distributor retailers:', err)
        const allUsers = Array.isArray(data?.users) ? data.users : []
        setRetailers(allUsers.filter(u => u.role === 'RETAILER'))
      } finally {
        setLoading(false)
      }
    }
    fetchRetailers()
  }, [userId, data?.users])

  const handleAdd = async () => {
    if (!newUser.username || !newUser.name || !newUser.password) {
      alert('Please fill in all required fields including password.')
      return
    }

    try {
      await addUser({ 
        ...newUser, 
        parentId: userId,
        username: newUser.username.toLowerCase().replace(/\s/g, '_') 
      })
      
      // Refresh list after adding
      let res = await api.getChildren('me', 'RETAILER').catch(() => api.getChildren(userId, 'RETAILER'))
      let list = Array.isArray(res) ? res : (res?.data || res?.retailers || res?.users || [])
      if (list.length === 0 && Array.isArray(data?.users)) {
        list = data.users.filter(u => u.role === 'RETAILER' && (Number(u.parentId || u.parent_id) === Number(userId)))
      }
      setRetailers(list)

      setNewUser({ username: '', name: '', password: '', role: 'RETAILER', parentId: userId })
      setShowModal(false)
    } catch (err) {
      alert(err.message || 'Failed to add retailer')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-dark-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500 mr-3"></div>
        Loading retailers network...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Retailer Management</h2>
          <p className="text-dark-muted text-sm">Manage your assigned retailers and set credentials ({retailers.length})</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><Plus size={18} />Add Retailer</button>
      </div>
      
      <div className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-dark-bg/60 border-b border-dark-border text-xs uppercase tracking-wider text-dark-muted">
              <th className="px-6 py-4 font-semibold">Name</th>
              <th className="px-6 py-4 font-semibold">Username</th>
              <th className="px-6 py-4 font-semibold text-center">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/50">
            {retailers.map(u => {
              const status = u.status || 'active'
              return (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-semibold text-white text-sm">{u.name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-dark-muted">{u.username}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 rounded-lg hover:bg-white/5 text-dark-muted hover:text-white transition"><MoreVertical size={18} /></button>
                  </td>
                </tr>
              )
            })}
            {retailers.length === 0 && (
              <tr><td colSpan="4" className="text-center py-16 text-dark-muted text-sm">No retailers assigned yet. Click "Add Retailer" to begin.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-dark-border">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400"><UserPlus size={20} /></div>
              <h3 className="text-lg font-bold text-white">Add New Retailer & Password</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Full Name *</label>
                <input type="text" value={newUser.name} onChange={(e) => setNewUser(p => ({ ...p, name: e.target.value }))} className="input-field text-sm" placeholder="e.g., Retailer Store Mumbai" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Username *</label>
                <input type="text" value={newUser.username} onChange={(e) => setNewUser(p => ({ ...p, username: e.target.value }))} className="input-field text-sm font-mono" placeholder="e.g., retail_mumbai" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-muted mb-2">Password *</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                  <input type="password" value={newUser.password} onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))} className="input-field text-sm pl-10" placeholder="Enter retailer password" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8 pt-4 border-t border-dark-border">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary py-3 text-sm font-semibold">Cancel</button>
              <button onClick={handleAdd} className="flex-1 btn-primary py-3 text-sm font-bold">Add Retailer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}