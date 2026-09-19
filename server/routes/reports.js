// server/routes/reports.js
const express = require('express');
const db = require('../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get dashboard summary
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    
    // Role-specific counts
    let ssCount = 0, distCount = 0, retailCount = 0;
    
    if (role === 'ADMIN') {
      const ssRows = await db.query('SELECT COUNT(*) as c FROM users WHERE role = $1', ['SS']);
      ssCount = parseInt(ssRows.rows[0].c, 10);
      
      const distRows = await db.query('SELECT COUNT(*) as c FROM users WHERE role = $1', ['DISTRIBUTOR']);
      distCount = parseInt(distRows.rows[0].c, 10);
      
      const retRows = await db.query('SELECT COUNT(*) as c FROM users WHERE role = $1', ['RETAILER']);
      retailCount = parseInt(retRows.rows[0].c, 10);
      
    } else if (role === 'SS') {
      const distRows = await db.query('SELECT COUNT(*) as c FROM users WHERE role = $1 AND parent_id = $2', ['DISTRIBUTOR', userId]);
      distCount = parseInt(distRows.rows[0].c, 10);
      
      const retRows = await db.query(`
        SELECT COUNT(*) as c FROM users WHERE role = $1 AND parent_id IN (SELECT id FROM users WHERE parent_id = $2)
      `, ['RETAILER', userId]);
      retailCount = parseInt(retRows.rows[0].c, 10);
      
    } else if (role === 'DISTRIBUTOR') {
      const retRows = await db.query('SELECT COUNT(*) as c FROM users WHERE role = $1 AND parent_id = $2', ['RETAILER', userId]);
      retailCount = parseInt(retRows.rows[0].c, 10);
    }
    
    const prodRows = await db.query('SELECT COUNT(*) as c FROM products WHERE status = $1', ['active']);
    const productCount = parseInt(prodRows.rows[0].c, 10);
    
    // Total stock for current user
    const stockRows = await db.query('SELECT COALESCE(SUM(quantity), 0) as total FROM stock WHERE user_id = $1', [userId]);
    const totalStock = Number(stockRows.rows[0].total);
    
    // Today's sales
    const today = new Date().toISOString().split('T')[0];
    const salesRows = await db.query('SELECT COALESCE(SUM(grand_total), 0) as total FROM bills WHERE seller_id = $1 AND bill_date = $2', [userId, today]);
    const todaySales = Number(salesRows.rows[0].total);
    
    // Pending payments
    const pendingRows = await db.query('SELECT COALESCE(SUM(due_amount), 0) as total FROM bills WHERE seller_id = $1 AND due_amount > 0', [userId]);
    const pendingPayments = Number(pendingRows.rows[0].total);
    
    // Low stock items
    const lowStockRows = await db.query(`
      SELECT COUNT(*) as c FROM stock s
      JOIN products p ON s.product_id = p.id
      WHERE s.user_id = $1 AND s.quantity <= p.min_stock
    `, [userId]);
    const lowStock = parseInt(lowStockRows.rows[0].c, 10);
    
    // Recent bills
    const recentBillsResult = await db.query(`
      SELECT b.*, u.name as buyer_name
      FROM bills b
      LEFT JOIN users u ON b.buyer_id = u.id
      WHERE b.seller_id = $1
      ORDER BY b.created_at DESC
      LIMIT 5
    `, [userId]);
    
    res.json({
      ssCount,
      distCount,
      retailCount,
      productCount,
      totalStock,
      todaySales,
      pendingPayments,
      lowStock,
      recentBills: recentBillsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching dashboard summary:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// Sales by buyer (for sales analysis)
router.get('/sales-by-buyer', async (req, res) => {
  try {
    const { role } = req.query;
    const userId = req.user.id;
    
    let query = `
      SELECT 
        u.id, u.name, u.role,
        COALESCE(SUM(b.grand_total), 0) as sales,
        COUNT(b.id) as bill_count
      FROM users u
      LEFT JOIN bills b ON b.buyer_id = u.id AND b.seller_id = $1
      WHERE u.parent_id = $2
    `;
    const params = [userId, userId];
    
    if (role) { 
      query += ' AND u.role = $3'; 
      params.push(role); 
    }
    
    query += ' GROUP BY u.id, u.name, u.role ORDER BY sales DESC';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sales by buyer:', err);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// Sales by product
router.get('/sales-by-product', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;
    
    const result = await db.query(`
      SELECT 
        p.id, p.name, p.sku,
        COALESCE(SUM(bi.quantity), 0) as quantity,
        COALESCE(SUM(bi.amount), 0) as revenue
      FROM products p
      LEFT JOIN bill_items bi ON bi.product_id = p.id
      LEFT JOIN bills b ON bi.bill_id = b.id AND b.seller_id = $1
      GROUP BY p.id, p.name, p.sku
      HAVING COALESCE(SUM(bi.amount), 0) > 0
      ORDER BY revenue DESC
      LIMIT $2
    `, [userId, parseInt(limit, 10)]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sales by product:', err);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// Payment status distribution
router.get('/payment-status', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(`
      SELECT payment_status as status, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total
      FROM bills WHERE seller_id = $1
      GROUP BY payment_status
    `, [userId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching payment status:', err);
    res.status(500).json({ error: 'Failed to fetch payment data' });
  }
});

// Outstanding payments
router.get('/outstanding', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(`
      SELECT 
        b.id, b.bill_number, b.grand_total, b.paid_amount, b.due_amount,
        COALESCE(u.name, b.customer_name) as buyer_name
      FROM bills b
      LEFT JOIN users u ON b.buyer_id = u.id
      WHERE b.seller_id = $1 AND b.due_amount > 0
      ORDER BY b.due_amount DESC
    `, [userId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching outstanding payments:', err);
    res.status(500).json({ error: 'Failed to fetch outstanding payments' });
  }
});

// Monthly sales trend
router.get('/monthly-trend', async (req, res) => {
  try {
    const userId = req.user.id;
    const { months = 6 } = req.query;
    
    // PostgreSQL uses TO_CHAR instead of DATE_FORMAT
    const result = await db.query(`
      SELECT 
        TO_CHAR(bill_date, 'YYYY-MM') as month,
        COALESCE(SUM(grand_total), 0) as sales
      FROM bills
      WHERE seller_id = $1
      GROUP BY month
      ORDER BY month DESC
      LIMIT $2
    `, [userId, parseInt(months, 10)]);
    
    res.json(result.rows.reverse());
  } catch (err) {
    console.error('Error fetching monthly trend:', err);
    res.status(500).json({ error: 'Failed to fetch monthly trend' });
  }
});

// Admin-only: overall sales by level
router.get('/sales-by-level', requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        CASE 
          WHEN bill_type = 'ADMIN_TO_SS' THEN 'Admin'
          WHEN bill_type IN ('SS_TO_DIST', 'SS_TO_RETAIL') THEN 'SS'
          WHEN bill_type = 'DIST_TO_RETAIL' THEN 'Distributor'
          WHEN bill_type = 'RETAIL_TO_CUSTOMER' THEN 'Retailer'
        END as level,
        COALESCE(SUM(grand_total), 0) as sales
      FROM bills
      GROUP BY level
      ORDER BY sales DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sales by level:', err);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

module.exports = router;