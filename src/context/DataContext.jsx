import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext.jsx'
import { api } from '../api.js'

const DataContext = createContext()

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [data, setData] = useState({
    users: [],
    categories: [],
    products: [],
    bills: [],
    customers: [],
    stock: [], // <-- Added stock to state
  })
  const [loading, setLoading] = useState(false)

  // Load initial data when user logs in
  useEffect(() => {
    if (user) {
      loadInitialData()
    } else {
      setData({ users: [], categories: [], products: [], bills: [], customers: [] })
    }
  }, [user])

 const loadInitialData = async () => {
    setLoading(true)
    try {
      const [users, categories, products, bills, stock] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getCategories().catch(() => []),
        api.getProducts().catch(() => []),
        api.getBills('sales').catch(() => []),
        api.getStock().catch(() => []), // <-- Fetch stock here
      ])
      setData(prev => ({ ...prev, users, categories, products, bills, stock })) // <-- Add stock to state
    } catch (err) {
      console.error('Failed to load initial data:', err)
    }
    setLoading(false)
  }

 // Helper: get user by ID (safely handles undefined/null)
  const getUserById = useCallback((id) => {
    if (!id) return null;
    return data.users.find(u => u.id === id) || api.getUser(id).catch(() => null)
  }, [data.users])

  // Helper: get product by ID
  const getProductById = useCallback((id) => {
    return data.products.find(p => p.id === id)
  }, [data.products])

  // Helper: get category by ID
  const getCategoryById = useCallback((id) => {
    return data.categories.find(c => c.id === id)
  }, [data.categories])

  // Get children of a user
  const getChildren = useCallback(async (userId, roleFilter = null) => {
    try {
      return await api.getUserChildren(userId, roleFilter)
    } catch {
      return data.users.filter(u => {
        if (u.parentId !== userId) return false
        if (roleFilter && u.role !== roleFilter) return false
        return true
      })
    }
  }, [data.users])

  // Get all descendants
  const getAllDescendants = useCallback((userId) => {
    const result = []
    const findChildren = (parentId) => {
      const children = data.users.filter(u => u.parentId === parentId)
      children.forEach(c => {
        result.push(c)
        findChildren(c.id)
      })
    }
    findChildren(userId)
    return result
  }, [data.users])

  // Get user's stock
  const getUserStock = useCallback(async (userId) => {
    try {
      const stock = await api.getStock(userId)
      const stockObj = {}
      stock.forEach(s => { stockObj[s.product_id] = s.quantity })
      return stockObj
    } catch {
      return {}
    }
  }, [])

  // Get total stock value
  const getTotalStockValue = useCallback(async (userId) => {
    try {
      const stock = await api.getStock(userId)
      return stock.reduce((sum, s) => sum + (s.quantity * s.purchase_price), 0)
    } catch {
      return 0
    }
  }, [])

  // Get low stock items
  const getLowStockItems = useCallback(async (userId) => {
    try {
      return await api.getLowStock(userId)
    } catch {
      return []
    }
  }, [])

  // Get user's sales bills
  const getUserSalesBills = useCallback(async (userId) => {
    try {
      return await api.getBills('sales')
    } catch {
      return data.bills
    }
  }, [data.bills])

  // Get user's purchase bills
  const getUserPurchaseBills = useCallback(async (userId) => {
    try {
      return await api.getBills('purchases')
    } catch {
      return []
    }
  }, [])

  // Get today's sales
  const getTodaySales = useCallback(async (userId) => {
    try {
      const summary = await api.getSummary()
      return summary.todaySales || 0
    } catch {
      return 0
    }
  }, [])

  // Get pending payments
  const getPendingPayments = useCallback(async (userId) => {
    try {
      const summary = await api.getSummary()
      return summary.pendingPayments || 0
    } catch {
      return 0
    }
  }, [])

  // Create bill
  const createBill = useCallback(async (billData, items) => {
    try {
      const result = await api.createBill({ ...billData, items })
      // Refresh bills list
      const bills = await api.getBills('sales')
      setData(prev => ({ ...prev, bills }))
      return result
    } catch (err) {
      throw err
    }
  }, [])

  // Add user
  const addUser = useCallback(async (userData) => {
    try {
      const result = await api.createUser(userData)
      // Refresh users
      const users = await api.getUsers()
      setData(prev => ({ ...prev, users }))
      return result
    } catch (err) {
      throw err
    }
  }, [])

  // Add product
  const addProduct = useCallback(async (productData) => {
    try {
      const result = await api.createProduct(productData)
      const products = await api.getProducts()
      setData(prev => ({ ...prev, products }))
      return result
    } catch (err) {
      throw err
    }
  }, [])

  // FIX: Make updateProduct match addProduct's clean structure!
  const updateProduct = useCallback(async (id, productData) => {
    try {
      const result = await api.updateProduct(id, productData);
      const products = await api.getProducts(); // Fetch fresh list from DB
      setData(prev => ({ ...prev, products })); // Update React state immediately
      return result;
    } catch (err) {
      console.error('Failed to update product:', err);
      throw err;
    }
  }, []);

  // Add opening stock
  const addOpeningStock = useCallback(async (userId, productId, quantity) => {
    try {
      return await api.addStock(userId, productId, quantity)
    } catch (err) {
      throw err
    }
  }, [])

  // Get bill items
  const getBillItems = useCallback(async (billId) => {
    try {
      const bill = await api.getBill(billId)
      return bill.items || []
    } catch {
      return []
    }
  }, [])

  // Get visible users based on role
  const getVisibleUsers = useCallback((currentUser) => {
    if (!currentUser) return []
    if (currentUser.role === 'ADMIN') return data.users.filter(u => u.id !== currentUser.id)
    return getAllDescendants(currentUser.id)
  }, [data.users, getAllDescendants])

  return (
    <DataContext.Provider value={{
      data,
      loading,
      refresh: loadInitialData,
      getChildren,
      getAllDescendants,
      getUserStock,
      getTotalStockValue,
      getLowStockItems,
      getUserSalesBills,
      getUserPurchaseBills,
      getTodaySales,
      getPendingPayments,
      createBill,
      addUser,
      addProduct,
      updateProduct,
      addOpeningStock,
      getUserById,
      getProductById,
      getCategoryById,
      getBillItems,
      getVisibleUsers,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}