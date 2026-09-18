const express = require('express');
const db = require('../db/init');
const { authenticateToken, canAccessUser } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get stock for a user (defaults to current user)
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : req.user.id;
    
    // Permission check
    if (userId !== req.user.id) {
      const roleHierarchy = { ADMIN: 4, SS: 3, DISTRIBUTOR: 2, RETAILER: 1 };
      
      if (req.user.role !== 'ADMIN') {
        const [targetRows] = await db.query('SELECT id, parent_id, role FROM users WHERE id = ?', [userId]);
        const targetUser = targetRows[0];
        
        if (!targetUser || roleHierarchy[targetUser.role] >= roleHierarchy[req.user.role]) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        // Check hierarchy with async queries
        let current = userId;
        const visited = new Set();
        let isDescendant = false;
        
        while (current && !visited.has(current)) {
          visited.add(current);
          if (current === req.user.id) {
            isDescendant = true;
            break;
          }
          const [uRows] = await db.query('SELECT parent_id FROM users WHERE id = ?', [current]);
          current = uRows[0]?.parent_id;
        }
        
        if (!isDescendant) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
    }
    
    // UPDATED: Removed purchase_price/sale_price/gst, added new 4-tier pricing and items_per_unit
    const [stock] = await db.query(`
      SELECT s.product_id, s.quantity, p.name, p.sku, p.unit, p.items_per_unit, 
             p.ss_price, p.distributor_price, p.retail_price, p.mrp, p.min_stock
      FROM stock s
      JOIN products p ON s.product_id = p.id
      WHERE s.user_id = ?
      ORDER BY p.name
    `, [userId]);
    
    res.json(stock);
  } catch (err) {
    console.error('Error fetching stock:', err);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// Get low stock items for a user
router.get('/low-stock', async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : req.user.id;
    
    const [lowStock] = await db.query(`
      SELECT s.product_id, s.quantity, p.name, p.sku, p.min_stock
      FROM stock s
      JOIN products p ON s.product_id = p.id
      WHERE s.user_id = ? AND s.quantity <= p.min_stock
      ORDER BY s.quantity ASC
    `, [userId]);
    
    res.json(lowStock);
  } catch (err) {
    console.error('Error fetching low stock:', err);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

// Add opening stock (Admin only)
router.post('/add', async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admin can add opening stock' });
    }
    
    const { userId, productId, quantity } = req.body;
    if (!userId || !productId || quantity === undefined) {
      return res.status(400).json({ error: 'userId, productId, and quantity are required' });
    }
    
    // MySQL syntax for upsert (Insert, or update on duplicate key)
    await db.query(`
      INSERT INTO stock (user_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + ?
    `, [userId, productId, quantity, quantity]);
    
    res.json({ success: true, message: 'Stock added successfully' });
  } catch (err) {
    console.error('Error adding stock:', err);
    res.status(500).json({ error: 'Failed to add stock' });
  }
});

// Get stock transactions
router.get('/transactions', async (req, res) => {
  try {
    const { userId, limit = 50 } = req.query;
    
    let query = `
      SELECT st.*, p.name as product_name,
        from_u.name as from_name, to_u.name as to_name
      FROM stock_transactions st
      JOIN products p ON st.product_id = p.id
      LEFT JOIN users from_u ON st.from_id = from_u.id
      LEFT JOIN users to_u ON st.to_id = to_u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (userId) {
      query += ' AND (st.from_id = ? OR st.to_id = ?)';
      params.push(userId, userId);
    }
    
    query += ' ORDER BY st.created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10)); // Ensure limit is passed as an integer to avoid MySQL syntax errors
    
    const [transactions] = await db.query(query, params);
    res.json(transactions);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to fetch stock transactions' });
  }
});

// Admin update / set exact stock quantity for any user and product
router.put('/update', async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admin can update stock directly' });
    }
    
    const { userId, productId, quantity } = req.body;
    if (!userId || !productId || quantity === undefined) {
      return res.status(400).json({ error: 'userId, productId, and quantity are required' });
    }
    
    await db.query(`
      INSERT INTO stock (user_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = ?
    `, [userId, productId, quantity, quantity]);
    
    res.json({ success: true, message: 'Stock updated successfully' });
  } catch (err) {
    console.error('Error updating stock:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Transfer stock from current user (Admin/SS) to a lower tier user (Distributor/Retailer)
router.post('/transfer', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { toUserId, productId, quantity } = req.body;
    const fromUserId = req.user.id;
    const qty = parseInt(quantity, 10);

    if (!toUserId || !productId || isNaN(qty) || qty <= 0) {
      connection.release();
      return res.status(400).json({ error: 'Valid recipient, product, and quantity are required' });
    }

    // 1. Check if sender has enough stock
    const [senderStockRows] = await connection.query(
      'SELECT quantity FROM stock WHERE user_id = ? AND product_id = ?',
      [fromUserId, productId]
    );
    const senderQty = senderStockRows[0]?.quantity || 0;

    if (req.user.role !== 'ADMIN' && senderQty < qty) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: `Insufficient stock. You only have ${senderQty} available.` });
    }

    // 2. Deduct from sender's stock (if not admin, or even admin to maintain accuracy)
    await connection.query(
      'UPDATE stock SET quantity = quantity - ? WHERE user_id = ? AND product_id = ?',
      [qty, fromUserId, productId]
    );

    // 3. Add to recipient's stock (Upsert)
    await connection.query(`
      INSERT INTO stock (user_id, product_id, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + ?
    `, [toUserId, productId, qty, qty]);

    // 4. Record transaction log with matching column and value counts
    await connection.query(`
      INSERT INTO stock_transactions (from_id, to_id, product_id, quantity, type, date)
      VALUES (?, ?, ?, ?, 'TRANSFER', NOW())
    `, [fromUserId, toUserId, productId, qty]);

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Stock transferred successfully' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('Error transferring stock:', err);
    res.status(500).json({ error: 'Failed to transfer stock' });
  }
});

module.exports = router;