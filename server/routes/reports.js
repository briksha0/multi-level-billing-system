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
    
    // Get visible user IDs based on role
    const getVisibleUserIds = async () => {
      if (role === 'ADMIN') {
        const [users] = await db.query('SELECT id FROM users');
        return users.map(u => u.id);
      }
      
      // Because this relies on sequential DB calls, it must be an async recursive function
      const getDescendants = async (parentId) => {
        const [children] = await db.query('SELECT id FROM users WHERE parent_id = ?', [parentId]);
        let result = children.map(c => c.id);
        
        for (const c of children) {
          const descendants = await getDescendants(c.id);
          result = result.concat(descendants);
        }
        return result;
      };
      
      const descendants = await getDescendants(userId);
      return [userId, ...descendants];
    };
    
    // We don't actually use visibleIds in the counts below, but I left it in case you need it later.
    const visibleIds = await getVisibleUserIds();
    
    // Role-specific counts
    let ssCount = 0, distCount = 0, retailCount = 0;
    
    if (role === 'ADMIN') {
      const [ssRows] = await db.query('SELECT COUNT(*) as c FROM users WHERE role = ?', ['SS']);
      ssCount = ssRows[0].c;
      
      const [distRows] = await db.query('SELECT COUNT(*) as c FROM users WHERE role = ?', ['DISTRIBUTOR']);
      distCount = distRows[0].c;
      
      const [retRows] = await db.query('SELECT COUNT(*) as c FROM users WHERE role = ?', ['RETAILER']);
      retailCount = retRows[0].c;
      
    } else if (role === 'SS') {
      const [distRows] = await db.query('SELECT COUNT(*) as c FROM users WHERE role = ? AND parent_id = ?', ['DISTRIBUTOR', userId]);
      distCount = distRows[0].c;
      
      const [retRows] = await db.query(`
        SELECT COUNT(*) as c FROM users WHERE role = ? AND parent_id IN (SELECT id FROM users WHERE parent_id = ?)
      `, ['RETAILER', userId]);
      retailCount = retRows[0].c;
      
    } else if (role === 'DISTRIBUTOR') {
      const [retRows] = await db.query('SELECT COUNT(*) as c FROM users WHERE role = ? AND parent_id = ?', ['RETAILER', userId]);
      retailCount = retRows[0].c;
    }
    
    const [prodRows] = await db.query('SELECT COUNT(*) as c FROM products WHERE status = ?', ['active']);
    const productCount = prodRows[0].c;
    
    // Total stock for current user
    const [stockRows] = await db.query('SELECT COALESCE(SUM(quantity), 0) as total FROM stock WHERE user_id = ?', [userId]);
    const totalStock = Number(stockRows[0].total); // Cast from Decimal string to JS Number
    
    // Today's sales
    const today = new Date().toISOString().split('T')[0];
    const [salesRows] = await db.query('SELECT COALESCE(SUM(grand_total), 0) as total FROM bills WHERE seller_id = ? AND bill_date = ?', [userId, today]);
    const todaySales = Number(salesRows[0].total);
    
    // Pending payments
    const [pendingRows] = await db.query('SELECT COALESCE(SUM(due_amount), 0) as total FROM bills WHERE seller_id = ? AND due_amount > 0', [userId]);
    const pendingPayments = Number(pendingRows[0].total);
    
    // Low stock items
    const [lowStockRows] = await db.query(`
      SELECT COUNT(*) as c FROM stock s
      JOIN products p ON s.product_id = p.id
      WHERE s.user_id = ? AND s.quantity <= p.min_stock
    `, [userId]);
    const lowStock = lowStockRows[0].c;
    
    // Recent bills
    const [recentBills] = await db.query(`
      SELECT b.*, u.name as buyer_name
      FROM bills b
      LEFT JOIN users u ON b.buyer_id = u.id
      WHERE b.seller_id = ?
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
      recentBills,
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
      LEFT JOIN bills b ON b.buyer_id = u.id AND b.seller_id = ?
      WHERE u.parent_id = ?
    `;
    const params = [userId, userId];
    
    if (role) { 
      query += ' AND u.role = ?'; 
      params.push(role); 
    }
    
    query += ' GROUP BY u.id ORDER BY sales DESC';
    
    const [data] = await db.query(query, params);
    res.json(data);
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
    
    const [data] = await db.query(`
      SELECT 
        p.id, p.name, p.sku,
        COALESCE(SUM(bi.quantity), 0) as quantity,
        COALESCE(SUM(bi.amount), 0) as revenue
      FROM products p
      LEFT JOIN bill_items bi ON bi.product_id = p.id
      LEFT JOIN bills b ON bi.bill_id = b.id AND b.seller_id = ?
      GROUP BY p.id
      HAVING revenue > 0
      ORDER BY revenue DESC
      LIMIT ?
    `, [userId, parseInt(limit, 10)]);
    
    res.json(data);
  } catch (err) {
    console.error('Error fetching sales by product:', err);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// Payment status distribution
router.get('/payment-status', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [data] = await db.query(`
      SELECT payment_status as status, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total
      FROM bills WHERE seller_id = ?
      GROUP BY payment_status
    `, [userId]);
    
    res.json(data);
  } catch (err) {
    console.error('Error fetching payment status:', err);
    res.status(500).json({ error: 'Failed to fetch payment data' });
  }
});

// Outstanding payments
router.get('/outstanding', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [data] = await db.query(`
      SELECT 
        b.id, b.bill_number, b.grand_total, b.paid_amount, b.due_amount,
        COALESCE(u.name, b.customer_name) as buyer_name
      FROM bills b
      LEFT JOIN users u ON b.buyer_id = u.id
      WHERE b.seller_id = ? AND b.due_amount > 0
      ORDER BY b.due_amount DESC
    `, [userId]);
    
    res.json(data);
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
    
    // SQLite uses strftime('%Y-%m'), MySQL uses DATE_FORMAT
    const [data] = await db.query(`
      SELECT 
        DATE_FORMAT(bill_date, '%Y-%m') as month,
        COALESCE(SUM(grand_total), 0) as sales
      FROM bills
      WHERE seller_id = ?
      GROUP BY month
      ORDER BY month DESC
      LIMIT ?
    `, [userId, parseInt(months, 10)]);
    
    // We reverse the array after fetching so the oldest month is first
    res.json(data.reverse());
  } catch (err) {
    console.error('Error fetching monthly trend:', err);
    res.status(500).json({ error: 'Failed to fetch monthly trend' });
  }
});

// Admin-only: overall sales by level
router.get('/sales-by-level', requireRole('ADMIN'), async (req, res) => {
  try {
    const [data] = await db.query(`
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
    
    res.json(data);
  } catch (err) {
    console.error('Error fetching sales by level:', err);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

module.exports = router;