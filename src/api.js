// src/api.js
// API helper module - handles all backend communication
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('mlb_token');
}

function setToken(token) {
  if (token) localStorage.setItem('mlb_token', token);
  else localStorage.removeItem('mlb_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
 try {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Try to parse JSON
  const data = await response.json();

  // Handle HTTP errors
  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`
    );
  }

  return data;

} catch (error) {
  console.error(`API request failed: ${endpoint}`, error);
  throw error;
}
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () => request('/auth/me'),
  
  // Users
  getUsers: (role) => request(`/users${role ? `?role=${role}` : ''}`),
  getUser: (id) => request(`/users/${id}`),
  createUser: (userData) => request('/users', { method: 'POST', body: JSON.stringify(userData) }),
  updateUserStatus: (id, status) => request(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getUserChildren: (id, role) => request(`/users/${id}/children${role ? `?role=${role}` : ''}`),
  
  // Children downline alias method
  getChildren(userId, role) {
    const query = role ? `?role=${role}` : '';
    return request(`/users/${userId}/children${query}`);
  },
  
  // Products & Categories
  getCategories: () => request('/products/categories'),
  createCategory: (name) => request('/products/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  getProducts: (categoryId) => request(`/products${categoryId ? `?categoryId=${categoryId}` : ''}`),
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (productData) => request('/products', { method: 'POST', body: JSON.stringify(productData) }),
  updateProduct: (id, productData) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(productData) }),
  
  // Stock Updates
  updateStock: (userId, productId, quantity) => request('/stock/update', { method: 'PUT', body: JSON.stringify({ userId, productId, quantity }) }),
  
  // Stock Transfer
  transferStock: (toUserId, productId, quantity) => request('/stock/transfer', { method: 'POST', body: JSON.stringify({ toUserId, productId, quantity }) }),
  
  // Stock
  getStock: (userId) => request(`/stock${userId ? `?userId=${userId}` : ''}`),
  getLowStock: (userId) => request(`/stock/low-stock${userId ? `?userId=${userId}` : ''}`),
  addStock: (userId, productId, quantity) => request('/stock/add', { method: 'POST', body: JSON.stringify({ userId, productId, quantity }) }),
  getStockTransactions: (userId, limit) => request(`/stock/transactions${userId ? `?userId=${userId}` : ''}${limit ? `&limit=${limit}` : ''}`),
  
  // Billing
  getBills: (type = 'sales') => request(`/bills?type=${type}`),
  getBill: (id) => request(`/bills/${id}`),
  createBill: (billData, items) => request('/bills', { method: 'POST', body: JSON.stringify({ ...billData, items }) }),
  addPayment: (billId, amount, method) => request(`/bills/${billId}/payments`, { method: 'POST', body: JSON.stringify({ amount, method }) }),
  
  // Customers
  getCustomers: () => request('/bills/customers'),
  createCustomer: (customerData) => request('/bills/customers', { method: 'POST', body: JSON.stringify(customerData) }),
  
  // Reports
  getSummary: () => request('/reports/summary'),
  getSalesByBuyer: (role) => request(`/reports/sales-by-buyer${role ? `?role=${role}` : ''}`),
  getSalesByProduct: (limit) => request(`/reports/sales-by-product${limit ? `?limit=${limit}` : ''}`),
  getPaymentStatus: () => request('/reports/payment-status'),
  getOutstanding: () => request('/reports/outstanding'),
  getMonthlyTrend: (months) => request(`/reports/monthly-trend${months ? `?months=${months}` : ''}`),
  getSalesByLevel: () => request('/reports/sales-by-level'),
  
  // Token management
  setToken,
  getToken,
  clearToken: () => setToken(null),
  
};