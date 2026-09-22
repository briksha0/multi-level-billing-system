import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { DataProvider } from './context/DataContext.jsx'
import Login from './pages/Login.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import SSLayout from './components/SSLayout.jsx'
import DistributorLayout from './components/DistributorLayout.jsx'
import RetailerLayout from './components/RetailerLayout.jsx'


// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminProducts from './pages/admin/AdminProducts.jsx'
import AdminStock from './pages/admin/AdminStock.jsx'
import AdminBilling from './pages/admin/AdminBilling.jsx'
import AdminReports from './pages/admin/AdminReports.jsx'
// SS Pages
import SSDashboard from './pages/ss/SSDashboard.jsx'
import SSNetwork from './pages/ss/SSNetwork.jsx'
import SSStock from './pages/ss/SSStock.jsx'
import SSBilling from './pages/ss/SSBilling.jsx'
import SSReports from './pages/ss/SSReports.jsx'

// Distributor Pages
import DistributorDashboard from './pages/distributor/DistributorDashboard.jsx'
import DistributorRetailers from './pages/distributor/DistributorRetailers.jsx'
import DistributorStock from './pages/distributor/DistributorStock.jsx'
import DistributorBilling from './pages/distributor/DistributorBilling.jsx'
import DistributorReports from './pages/distributor/DistributorReports.jsx'

// Retailer Pages
import RetailerDashboard from './pages/retailer-pages/RetailerDashboard.jsx'
import RetailerStock from './pages/retailer-pages/RetailerStock.jsx'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, getRoleHomeRoute } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHomeRoute(user.role)} replace />
  }
  return children
}

function RoleRedirect() {
  const { user, getRoleHomeRoute } = useAuth()
  if (user) return <Navigate to={getRoleHomeRoute(user.role)} replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="stock" element={<AdminStock />} />
            <Route path="billing" element={<AdminBilling />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>

          {/* SS Routes */}
          <Route path="/ss" element={<ProtectedRoute allowedRoles={['ADMIN', 'SS']}><SSLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<SSDashboard />} />
            <Route path="network" element={<SSNetwork />} />
            <Route path="stock" element={<SSStock />} />
            <Route path="billing" element={<SSBilling />} />
            <Route path="reports" element={<SSReports />} />
          </Route>

          {/* Distributor Routes */}
          <Route path="/distributor" element={<ProtectedRoute allowedRoles={['ADMIN', 'SS', 'DISTRIBUTOR']}><DistributorLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DistributorDashboard />} />
            <Route path="retailers" element={<DistributorRetailers />} />
            <Route path="stock" element={<DistributorStock />} />
            <Route path="billing" element={<DistributorBilling />} />
            <Route path="reports" element={<DistributorReports />} />
          </Route>

          {/* Retailer Routes */}
                <Route path="/retailer" element={<ProtectedRoute allowedRoles={['ADMIN', 'SS', 'DISTRIBUTOR', 'RETAILER']}><RetailerLayout /></ProtectedRoute>}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<RetailerDashboard />} />
                  <Route path="stock" element={<RetailerStock />} />
                </Route>


          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DataProvider>
    </AuthProvider>
  )
}