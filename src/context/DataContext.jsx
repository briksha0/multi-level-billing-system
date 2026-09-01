// src/context/DataContext.jsx
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
    stock: [],
  })
  const [loading, setLoading] = useState(false)

  // Load initial data when user logs in
  useEffect(() => {
    if (user) {
      loadInitialData()
    } else {
      setData({ users: [], categories: [], products: [], bills: [], customers: [], stock: [] })
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
        api.getStock().catch(() => []),
      ])
      setData(prev => ({ ...prev, users, categories, products, bills, stock }))
    } catch (err) {
      console.error('Failed to load initial data:', err)
    }
    setLoading(false)
  }

  // Helper: get user by ID (safely handles undefined/null)
  const getUserById = useCallback((id) => {
    if (!id) return null;
    return data.users.find(u => Number(u.id) === Number(id)) || api.getUser(id).catch(() => null)
  }, [data.users])

  // Helper: get product by ID
  const getProductById = useCallback((id) => {
    return data.products.find(p => Number(p.id) === Number(id))
  }, [data.products])

  // Helper: get category by ID
  const getCategoryById = useCallback((id) => {
    return data.categories.find(c => Number(c.id) === Number(id))
  }, [data.categories])

  // Get children of a user
  const getChildren = useCallback(async (userId, roleFilter = null) => {
    try {
      return await api.getUserChildren(userId, roleFilter)
    } catch {
      return data.users.filter(u => {
        if (Number(u.parentId || u.parent_id) !== Number(userId)) return false
        if (roleFilter && u.role !== roleFilter) return false
        return true
      })
    }
  }, [data.users])

  // Get all descendants
  const getAllDescendants = useCallback((userId) => {
    const result = []
    const findChildren = (parentId) => {
      const children = data.users.filter(u => Number(u.parentId || u.parent_id) === Number(parentId))
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
      if (Array.isArray(stock)) {
        stock.forEach(s => {
          stockObj[Number(s.product_id || s.productId)] = Number(s.quantity) || 0
        })
      }
      return stockObj
    } catch {
      return {}
    }
  }, [])

  // Get total stock value
  const getTotalStockValue = useCallback(async (userId) => {
    try {
      const stock = await api.getStock(userId)
      if (!Array.isArray(stock)) return 0
      return stock.reduce((sum, s) => {
        const qty = Number(s.quantity) || 0
        const price = Number(s.ss_price || s.purchase_price || 0)
        return sum + (qty * price)
      }, 0)
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
      const result = await api.createBill(billData, items)
      const [bills, stock] = await Promise.all([
        api.getBills('sales').catch(() => data.bills),
        api.getStock().catch(() => data.stock)
      ])
      setData(prev => ({ ...prev, bills, stock }))
      return result
    } catch (err) {
      throw err
    }
  }, [data.bills, data.stock])

  // Add user
  const addUser = useCallback(async (userData) => {
    try {
      const result = await api.createUser(userData)
      const users = await api.getUsers()
      setData(prev => ({ ...prev, users }))
      return result
    } catch (err) {
      throw err
    }
  }, [])

  // Delete user
  const deleteUser = useCallback(async (userId) => {
    try {
      const result = await api.deleteUser(userId)
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

  // Update product
  const updateProduct = useCallback(async (id, productData) => {
    try {
      const result = await api.updateProduct(id, productData)
      const products = await api.getProducts()
      setData(prev => ({ ...prev, products }))
      return result
    } catch (err) {
      console.error('Failed to update product:', err)
      throw err
    }
  }, [])

  // Add opening stock
  const addOpeningStock = useCallback(async (userId, productId, quantity) => {
    try {
      const result = await api.addStock(userId, productId, quantity)
      const stock = await api.getStock(userId).catch(() => data.stock)
      setData(prev => ({ ...prev, stock }))
      return result
    } catch (err) {
      throw err
    }
  }, [data.stock])

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
    if (currentUser.role === 'ADMIN') return data.users.filter(u => Number(u.id) !== Number(currentUser.id))
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
      deleteUser,
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