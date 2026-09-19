// server/routes/billing.js
const express = require('express');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Helper: Validate buyer is in seller's hierarchy
async function validateBuyer(sellerId, buyerId, sellerRole) {
  if (sellerRole === 'ADMIN') {
    const result = await db.query('SELECT role FROM users WHERE id = $1', [buyerId]);
    const buyer = result.rows[0];
    return buyer && buyer.role === 'SS';
  }
  if (sellerRole === 'SS') {
    const result = await db.query('SELECT id, parent_id, role FROM users WHERE id = $1', [buyerId]);
    const buyer = result.rows[0];
    if (!buyer) return false;
    if (buyer.role === 'DISTRIBUTOR') return buyer.parent_id === sellerId;
    if (buyer.role === 'RETAILER') {
      const distResult = await db.query('SELECT parent_id FROM users WHERE id = $1', [buyer.parent_id]);
      const dist = distResult.rows[0];
      return dist?.parent_id === sellerId;
    }
    return false;
  }
  if (sellerRole === 'DISTRIBUTOR') {
    const result = await db.query('SELECT parent_id, role FROM users WHERE id = $1', [buyerId]);
    const buyer = result.rows[0];
    return buyer && buyer.role === 'RETAILER' && buyer.parent_id === sellerId;
  }
  return false;
}

// Get bills (sales or purchases)
router.get('/', async (req, res) => {
  try {
    const { type = 'sales', limit = 100 } = req.query;
    const userId = req.user.id;
    const limitInt = parseInt(limit, 10);
    
    let result;
    if (type === 'sales') {
      result = await db.query(`
        SELECT b.*, 
          buyer.name as buyer_name, buyer.username as buyer_username, buyer.role as buyer_role
        FROM bills b
        LEFT JOIN users buyer ON b.buyer_id = buyer.id
        WHERE b.seller_id = $1
        ORDER BY b.created_at DESC
        LIMIT $2
      `, [userId, limitInt]);
    } else {
      result = await db.query(`
        SELECT b.*,
          seller.name as seller_name, seller.username as seller_username
        FROM bills b
        JOIN users seller ON b.seller_id = seller.id
        WHERE b.buyer_id = $1
        ORDER BY b.created_at DESC
        LIMIT $2
      `, [userId, limitInt]);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching bills:', err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// Get single bill with items
router.get('/:billId', async (req, res) => {
  try {
    const billResult = await db.query(`
      SELECT b.*,
        buyer.name as buyer_name, buyer.username as buyer_username,
        seller.name as seller_name, seller.username as seller_username
      FROM bills b
      LEFT JOIN users buyer ON b.buyer_id = buyer.id
      JOIN users seller ON b.seller_id = seller.id
      WHERE b.id = $1
    `, [req.params.billId]);
    
    const bill = billResult.rows[0];
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    
    // Permission check
    if (bill.seller_id !== req.user.id && bill.buyer_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const itemsResult = await db.query(`
      SELECT bi.*, p.name as product_name, p.sku, p.unit
      FROM bill_items bi
      JOIN products p ON bi.product_id = p.id
      WHERE bi.bill_id = $1
    `, [req.params.billId]);
    
    const paymentsResult = await db.query('SELECT * FROM payments WHERE bill_id = $1 ORDER BY created_at DESC', [req.params.billId]);
    
    res.json({ ...bill, items: itemsResult.rows, payments: paymentsResult.rows });
  } catch (err) {
    console.error('Error fetching bill details:', err);
    res.status(500).json({ error: 'Failed to fetch bill details' });
  }
});

// Create bill
router.post('/', async (req, res) => {
  const client = await db.connect();
  try {
    const { buyerId, customerName, items, discount = 0, paidAmount = 0, paymentMethod = 'Cash', billType } = req.body;
    
    if (!items || items.length === 0) {
      client.release();
      return res.status(400).json({ error: 'At least one item is required' });
    }
    
    // Validate bill type and buyer 
    let actualBillType = billType;
    if (req.user.role === 'ADMIN') {
      if (!buyerId) {
        client.release();
        return res.status(400).json({ error: 'Buyer is required' });
      }
      if (!(await validateBuyer(req.user.id, buyerId, req.user.role))) {
        client.release();
        return res.status(403).json({ error: 'Admin can only bill to Super Stores' });
      }
      actualBillType = 'ADMIN_TO_SS';
    } else if (req.user.role === 'SS') {
      if (!buyerId) {
        client.release();
        return res.status(400).json({ error: 'Buyer is required' });
      }
      if (!(await validateBuyer(req.user.id, buyerId, req.user.role))) {
        client.release();
        return res.status(403).json({ error: 'Invalid buyer - must be your distributor or retailer' });
      }
      const buyerResult = await db.query('SELECT role FROM users WHERE id = $1', [buyerId]);
      actualBillType = buyerResult.rows[0].role === 'DISTRIBUTOR' ? 'SS_TO_DIST' : 'SS_TO_RETAIL';
    } else if (req.user.role === 'DISTRIBUTOR') {
      if (!buyerId) {
        client.release();
        return res.status(400).json({ error: 'Buyer is required' });
      }
      if (!(await validateBuyer(req.user.id, buyerId, req.user.role))) {
        client.release();
        return res.status(403).json({ error: 'Invalid buyer - must be your retailer' });
      }
      actualBillType = 'DIST_TO_RETAIL';
    } else if (req.user.role === 'RETAILER') {
      actualBillType = 'RETAIL_TO_CUSTOMER';
    }
    
    // Validate stock availability
    for (const item of items) {
      const stockResult = await db.query('SELECT quantity FROM stock WHERE user_id = $1 AND product_id = $2', [req.user.id, item.productId]);
      const stock = stockResult.rows[0];
      if (!stock || stock.quantity < item.quantity) {
        const prodResult = await db.query('SELECT name FROM products WHERE id = $1', [item.productId]);
        const product = prodResult.rows[0];
        client.release();
        return res.status(400).json({ 
          error: `Insufficient stock for ${product?.name || 'product'}. Available: ${stock?.quantity || 0}, Requested: ${item.quantity}` 
        });
      }
    }
    
    // Calculate totals with dynamic tier pricing
    let subtotal = 0;
    let totalGst = 0;
    const billItems = [];
    
    for (const item of items) {
      const prodResult = await db.query('SELECT ss_price, distributor_price, retail_price, mrp FROM products WHERE id = $1', [item.productId]);
      const product = prodResult.rows[0];
      
      let defaultRate = 0;
      switch (actualBillType) {
        case 'ADMIN_TO_SS': defaultRate = product.ss_price; break;
        case 'SS_TO_DIST': defaultRate = product.distributor_price; break;
        case 'SS_TO_RETAIL': 
        case 'DIST_TO_RETAIL': defaultRate = product.retail_price; break;
        case 'RETAIL_TO_CUSTOMER': defaultRate = product.mrp; break;
        default: defaultRate = product.mrp;
      }
      
      const rate = item.rate || defaultRate;
      const itemTotal = item.quantity * rate;
      const gstRate = item.gst || 0; 
      const itemGst = itemTotal * gstRate / 100;
      
      subtotal += itemTotal;
      totalGst += itemGst;
      
      billItems.push({ ...item, rate, gst: gstRate, amount: itemTotal + itemGst });
    }
    
    const grandTotal = subtotal - discount + totalGst;
    const finalPaid = Math.min(paidAmount, grandTotal);
    const dueAmount = grandTotal - finalPaid;
    const paymentStatus = dueAmount === 0 ? 'PAID' : finalPaid > 0 ? 'PARTIAL' : 'PENDING';
    
    // Generate bill number
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCode = todayStr.replace(/-/g, '');
    const countResult = await db.query('SELECT COUNT(*) as count FROM bills WHERE bill_date = $1', [todayStr]);
    const billNumber = `BILL-${todayCode}-${String(parseInt(countResult.rows[0].count, 10) + 1).padStart(4, '0')}`;
    
    // ==========================================
    // PostgreSQL Transaction Handling
    // ==========================================
    await client.query('BEGIN');
    
    // 1. Create bill
    const billResult = await client.query(`
      INSERT INTO bills (bill_number, bill_date, seller_id, buyer_id, customer_name, bill_type, subtotal, discount, gst, grand_total, paid_amount, due_amount, payment_status, payment_method, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [
      billNumber, todayStr, req.user.id, buyerId || null, customerName || null,
      actualBillType, subtotal, discount, totalGst, grandTotal,
      finalPaid, dueAmount, paymentStatus, paymentMethod, req.user.id
    ]);
    
    const billId = billResult.rows[0].id;
    
    // 2. Insert bill items
    for (const item of billItems) {
      await client.query(
        'INSERT INTO bill_items (bill_id, product_id, quantity, rate, gst, amount) VALUES ($1, $2, $3, $4, $5, $6)',
        [billId, item.productId, item.quantity, item.rate, item.gst, item.amount]
      );
    }
    
    // 3. Update stock - deduct from seller
    for (const item of billItems) {
      await client.query(
        'UPDATE stock SET quantity = quantity - $1 WHERE user_id = $2 AND product_id = $3',
        [item.quantity, req.user.id, item.productId]
      );
    }
    
    // 4. Update stock - add to buyer (if not retail to customer)
    if (buyerId && actualBillType !== 'RETAIL_TO_CUSTOMER') {
      for (const item of billItems) {
        await client.query(`
          INSERT INTO stock (user_id, product_id, quantity) 
          VALUES ($1, $2, $3) 
          ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = stock.quantity + $4
        `, [buyerId, item.productId, item.quantity, item.quantity]);
      }
      
      // 5. Create stock transactions
      for (const item of billItems) {
        await client.query(
          'INSERT INTO stock_transactions (date, from_id, to_id, product_id, quantity, type, bill_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [todayStr, req.user.id, buyerId, item.productId, item.quantity, 'OUT', billId]
        );
      }
    }
    
    // 6. Create payment record if paid
    if (finalPaid > 0) {
      await client.query(
        'INSERT INTO payments (bill_id, amount, method, date) VALUES ($1, $2, $3, $4)',
        [billId, finalPaid, paymentMethod, todayStr]
      );
    }
    
    await client.query('COMMIT');
    client.release(); 
    
    res.status(201).json({ 
      success: true, 
      billId, 
      billNumber, 
      message: 'Bill created successfully, stock updated automatically' 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Bill creation error:', err);
    res.status(500).json({ error: 'Failed to create bill' });
  }
});

// Add payment to a bill
router.post('/:billId/payments', async (req, res) => {
  const client = await db.connect();
  try {
    const { amount, method = 'Cash' } = req.body;
    if (!amount || amount <= 0) {
      client.release();
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    const billResult = await client.query('SELECT * FROM bills WHERE id = $1', [req.params.billId]);
    const bill = billResult.rows[0];
    if (!bill) {
      client.release();
      return res.status(404).json({ error: 'Bill not found' });
    }
    
    if (bill.seller_id !== req.user.id && req.user.role !== 'ADMIN') {
      client.release();
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const actualPayment = Math.min(amount, parseFloat(bill.due_amount));
    const todayStr = new Date().toISOString().split('T')[0];
    
    await client.query('BEGIN');
    
    await client.query(
      'INSERT INTO payments (bill_id, amount, method, date) VALUES ($1, $2, $3, $4)',
      [bill.id, actualPayment, method, todayStr]
    );
    
    const newPaid = Number(bill.paid_amount) + actualPayment;
    const newDue = Number(bill.grand_total) - newPaid;
    const newStatus = newDue <= 0.01 ? 'PAID' : 'PARTIAL'; 
    
    await client.query(
      'UPDATE bills SET paid_amount = $1, due_amount = $2, payment_status = $3 WHERE id = $4',
      [newPaid, newDue, newStatus, bill.id]
    );
    
    await client.query('COMMIT');
    client.release();
    
    res.json({ success: true, message: 'Payment recorded successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Get customers (Retailer only)
router.get('/customers', async (req, res) => {
  try {
    if (req.user.role !== 'RETAILER') {
      return res.status(403).json({ error: 'Only retailers can manage customers' });
    }
    const result = await db.query('SELECT * FROM customers WHERE retailer_id = $1 ORDER BY name', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Create customer
router.post('/customers', async (req, res) => {
  try {
    if (req.user.role !== 'RETAILER') {
      return res.status(403).json({ error: 'Only retailers can add customers' });
    }
    const { name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name is required' });
    
    const result = await db.query(
      'INSERT INTO customers (name, phone, email, address, retailer_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, phone || '', email || '', address || '', req.user.id]
    );
    
    res.status(201).json({ id: result.rows[0].id, message: 'Customer added successfully' });
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

module.exports = router;