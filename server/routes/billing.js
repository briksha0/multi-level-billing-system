const express = require('express');
const db = require('../db/init'); // This is now your MySQL pool
const { authenticateToken, canAccessUser } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Helper: Validate buyer is in seller's hierarchy
// Made async because it queries the database
async function validateBuyer(sellerId, buyerId, sellerRole) {
  if (sellerRole === 'ADMIN') {
    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [buyerId]);
    const buyer = rows[0];
    return buyer && buyer.role === 'SS';
  }
  if (sellerRole === 'SS') {
    const [rows] = await db.query('SELECT id, parent_id, role FROM users WHERE id = ?', [buyerId]);
    const buyer = rows[0];
    if (!buyer) return false;
    if (buyer.role === 'DISTRIBUTOR') return buyer.parent_id === sellerId;
    if (buyer.role === 'RETAILER') {
      const [distRows] = await db.query('SELECT parent_id FROM users WHERE id = ?', [buyer.parent_id]);
      const dist = distRows[0];
      return dist?.parent_id === sellerId;
    }
    return false;
  }
  if (sellerRole === 'DISTRIBUTOR') {
    const [rows] = await db.query('SELECT parent_id, role FROM users WHERE id = ?', [buyerId]);
    const buyer = rows[0];
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
    
    let bills;
    if (type === 'sales') {
      const [rows] = await db.query(`
        SELECT b.*, 
          buyer.name as buyer_name, buyer.username as buyer_username, buyer.role as buyer_role
        FROM bills b
        LEFT JOIN users buyer ON b.buyer_id = buyer.id
        WHERE b.seller_id = ?
        ORDER BY b.created_at DESC
        LIMIT ?
      `, [userId, limitInt]);
      bills = rows;
    } else {
      const [rows] = await db.query(`
        SELECT b.*,
          seller.name as seller_name, seller.username as seller_username
        FROM bills b
        JOIN users seller ON b.seller_id = seller.id
        WHERE b.buyer_id = ?
        ORDER BY b.created_at DESC
        LIMIT ?
      `, [userId, limitInt]);
      bills = rows;
    }
    
    res.json(bills);
  } catch (err) {
    console.error('Error fetching bills:', err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// Get single bill with items
router.get('/:billId', async (req, res) => {
  try {
    const [billRows] = await db.query(`
      SELECT b.*,
        buyer.name as buyer_name, buyer.username as buyer_username,
        seller.name as seller_name, seller.username as seller_username
      FROM bills b
      LEFT JOIN users buyer ON b.buyer_id = buyer.id
      JOIN users seller ON b.seller_id = seller.id
      WHERE b.id = ?
    `, [req.params.billId]);
    
    const bill = billRows[0];
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    
    // Permission check
    if (bill.seller_id !== req.user.id && bill.buyer_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [items] = await db.query(`
      SELECT bi.*, p.name as product_name, p.sku, p.unit
      FROM bill_items bi
      JOIN products p ON bi.product_id = p.id
      WHERE bi.bill_id = ?
    `, [req.params.billId]);
    
    const [payments] = await db.query('SELECT * FROM payments WHERE bill_id = ? ORDER BY created_at DESC', [req.params.billId]);
    
    res.json({ ...bill, items, payments });
  } catch (err) {
    console.error('Error fetching bill details:', err);
    res.status(500).json({ error: 'Failed to fetch bill details' });
  }
});

// Create bill
router.post('/', async (req, res) => {
  try {
    const { buyerId, customerName, items, discount = 0, paidAmount = 0, paymentMethod = 'Cash', billType } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    
    // Validate bill type and buyer 
    let actualBillType = billType;
    if (req.user.role === 'ADMIN') {
      if (!buyerId) return res.status(400).json({ error: 'Buyer is required' });
      if (!(await validateBuyer(req.user.id, buyerId, req.user.role))) {
        return res.status(403).json({ error: 'Admin can only bill to Super Stores' });
      }
      actualBillType = 'ADMIN_TO_SS';
    } else if (req.user.role === 'SS') {
      if (!buyerId) return res.status(400).json({ error: 'Buyer is required' });
      if (!(await validateBuyer(req.user.id, buyerId, req.user.role))) {
        return res.status(403).json({ error: 'Invalid buyer - must be your distributor or retailer' });
      }
      const [buyerRows] = await db.query('SELECT role FROM users WHERE id = ?', [buyerId]);
      actualBillType = buyerRows[0].role === 'DISTRIBUTOR' ? 'SS_TO_DIST' : 'SS_TO_RETAIL';
    } else if (req.user.role === 'DISTRIBUTOR') {
      if (!buyerId) return res.status(400).json({ error: 'Buyer is required' });
      if (!(await validateBuyer(req.user.id, buyerId, req.user.role))) {
        return res.status(403).json({ error: 'Invalid buyer - must be your retailer' });
      }
      actualBillType = 'DIST_TO_RETAIL';
    } else if (req.user.role === 'RETAILER') {
      actualBillType = 'RETAIL_TO_CUSTOMER';
    }
    
    // Validate stock availability
    for (const item of items) {
      const [stockRows] = await db.query('SELECT quantity FROM stock WHERE user_id = ? AND product_id = ?', [req.user.id, item.productId]);
      const stock = stockRows[0];
      if (!stock || stock.quantity < item.quantity) {
        const [prodRows] = await db.query('SELECT name FROM products WHERE id = ?', [item.productId]);
        const product = prodRows[0];
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
      // Select the 4 pricing tiers instead of the old sale_price and gst
      const [prodRows] = await db.query('SELECT ss_price, distributor_price, retail_price, mrp FROM products WHERE id = ?', [item.productId]);
      const product = prodRows[0];
      
      // Determine the correct default rate based on who is buying
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
      
      // Since GST is no longer in the products table, we fall back to what's passed in from the frontend, or 0.
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
    const [countRows] = await db.query('SELECT COUNT(*) as count FROM bills WHERE bill_date = ?', [todayStr]);
    const billNumber = `BILL-${todayCode}-${String(countRows[0].count + 1).padStart(4, '0')}`;
    
    // ==========================================
    // MySQL Transaction Handling
    // ==========================================
    const connection = await db.getConnection(); 
    await connection.beginTransaction();
    
    try {
      // 1. Create bill
      const [billResult] = await connection.query(`
        INSERT INTO bills (bill_number, bill_date, seller_id, buyer_id, customer_name, bill_type, subtotal, discount, gst, grand_total, paid_amount, due_amount, payment_status, payment_method, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        billNumber, todayStr, req.user.id, buyerId || null, customerName || null,
        actualBillType, subtotal, discount, totalGst, grandTotal,
        finalPaid, dueAmount, paymentStatus, paymentMethod, req.user.id
      ]);
      
      const billId = billResult.insertId;
      
      // 2. Insert bill items
      for (const item of billItems) {
        await connection.query(
          'INSERT INTO bill_items (bill_id, product_id, quantity, rate, gst, amount) VALUES (?, ?, ?, ?, ?, ?)',
          [billId, item.productId, item.quantity, item.rate, item.gst, item.amount]
        );
      }
      
      // 3. Update stock - deduct from seller
      for (const item of billItems) {
        await connection.query(
          'UPDATE stock SET quantity = quantity - ? WHERE user_id = ? AND product_id = ?',
          [item.quantity, req.user.id, item.productId]
        );
      }
      
      // 4. Update stock - add to buyer (if not retail to customer)
      if (buyerId && actualBillType !== 'RETAIL_TO_CUSTOMER') {
        for (const item of billItems) {
          await connection.query(`
            INSERT INTO stock (user_id, product_id, quantity) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE quantity = quantity + ?
          `, [buyerId, item.productId, item.quantity, item.quantity]);
        }
        
        // 5. Create stock transactions
        for (const item of billItems) {
          await connection.query(
            'INSERT INTO stock_transactions (date, from_id, to_id, product_id, quantity, type, bill_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [todayStr, req.user.id, buyerId, item.productId, item.quantity, 'OUT', billId]
          );
        }
      }
      
      // 6. Create payment record if paid
      if (finalPaid > 0) {
        await connection.query(
          'INSERT INTO payments (bill_id, amount, method, date) VALUES (?, ?, ?, ?)',
          [billId, finalPaid, paymentMethod, todayStr]
        );
      }
      
      await connection.commit(); 
      connection.release(); 
      
      res.status(201).json({ 
        success: true, 
        billId, 
        billNumber, 
        message: 'Bill created successfully, stock updated automatically' 
      });

    } catch (dbError) {
      await connection.rollback(); 
      connection.release();
      throw dbError; 
    }
    
  } catch (err) {
    console.error('Bill creation error:', err);
    res.status(500).json({ error: 'Failed to create bill' });
  }
});

// Add payment to a bill
router.post('/:billId/payments', async (req, res) => {
  try {
    const { amount, method = 'Cash' } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
    
    const [billRows] = await db.query('SELECT * FROM bills WHERE id = ?', [req.params.billId]);
    const bill = billRows[0];
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    
    if (bill.seller_id !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const actualPayment = Math.min(amount, bill.due_amount);
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Transaction block for payment
    const connection = await db.getConnection();
    await connection.beginTransaction();
    
    try {
      await connection.query(
        'INSERT INTO payments (bill_id, amount, method, date) VALUES (?, ?, ?, ?)',
        [bill.id, actualPayment, method, todayStr]
      );
      
      const newPaid = Number(bill.paid_amount) + actualPayment;
      const newDue = Number(bill.grand_total) - newPaid;
      const newStatus = newDue <= 0.01 ? 'PAID' : 'PARTIAL'; 
      
      await connection.query(
        'UPDATE bills SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ?',
        [newPaid, newDue, newStatus, bill.id]
      );
      
      await connection.commit();
      connection.release();
      
      res.json({ success: true, message: 'Payment recorded successfully' });
    } catch (dbErr) {
      await connection.rollback();
      connection.release();
      throw dbErr;
    }
    
  } catch (err) {
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
    const [customers] = await db.query('SELECT * FROM customers WHERE retailer_id = ? ORDER BY name', [req.user.id]);
    res.json(customers);
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
    
    const [result] = await db.query(
      'INSERT INTO customers (name, phone, email, address, retailer_id) VALUES (?, ?, ?, ?, ?)',
      [name, phone || '', email || '', address || '', req.user.id]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Customer added successfully' });
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});


// Example Node.js / Express backend route handler for creating bills
router.post('/bills', async (req, res) => {
  try {
    const { 
      sellerId, 
      buyerId, 
      customerName, 
      billType, 
      subtotal, 
      gst, 
      discount, 
      grandTotal, 
      paidAmount, 
      paymentMethod, 
      items 
    } = req.body

    const calculatedSub = Number(subtotal || 0)
    const calculatedGst = Number(gst || (calculatedSub * 0.18))
    const calculatedDisc = Number(discount || 0)
    const calculatedGrand = Number(grandTotal || (calculatedSub + calculatedGst - calculatedDisc))
    const paid = Number(paidAmount || calculatedGrand)
    const due = calculatedGrand - paid

    // Insert into bills table including tax/GST columns
    const [billResult] = await db.query(
      `INSERT INTO bills (seller_id, buyer_id, customer_name, bill_type, subtotal, gst, discount, grand_total, paid_amount, due_amount, payment_method, bill_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [sellerId, buyerId || null, customerName || 'Walk-in', billType || 'RETAIL_TO_CUSTOMER', calculatedSub, calculatedGst, calculatedDisc, calculatedGrand, paid, due, paymentMethod || 'Cash']
    )

    const billId = billResult.insertId

    // Insert line items...
    for (const item of items) {
      await db.query(
        `INSERT INTO bill_items (bill_id, product_id, quantity, rate, amount) VALUES (?, ?, ?, ?, ?)`,
        [billId, item.productId, item.quantity, item.rate, item.quantity * item.rate]
      )
    }

    res.status(201).json({ success: true, billId, message: 'Bill created successfully with GST stored' })
  } catch (err) {
    console.error('Database error saving bill:', err)
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router;