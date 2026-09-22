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

// Resolve the concrete bill type for the current seller and validate the buyer
async function resolveBillType(user, buyerId) {
  if (user.role === 'ADMIN') {
    if (!buyerId) return { status: 400, error: 'Buyer is required' };
    if (!(await validateBuyer(user.id, buyerId, user.role))) {
      return { status: 403, error: 'Admin can only bill to Super Stores' };
    }
    return { billType: 'ADMIN_TO_SS' };
  }
  if (user.role === 'SS') {
    if (!buyerId) return { status: 400, error: 'Buyer is required' };
    if (!(await validateBuyer(user.id, buyerId, user.role))) {
      return { status: 403, error: 'Invalid buyer - must be your distributor or retailer' };
    }
    const buyerResult = await db.query('SELECT role FROM users WHERE id = $1', [buyerId]);
    const buyer = buyerResult.rows[0];
    if (!buyer) return { status: 400, error: 'Invalid buyer' };
    return { billType: buyer.role === 'DISTRIBUTOR' ? 'SS_TO_DIST' : 'SS_TO_RETAIL' };
  }
  if (user.role === 'DISTRIBUTOR') {
    if (!buyerId) return { status: 400, error: 'Buyer is required' };
    if (!(await validateBuyer(user.id, buyerId, user.role))) {
      return { status: 403, error: 'Invalid buyer - must be your retailer' };
    }
    return { billType: 'DIST_TO_RETAIL' };
  }
  if (user.role === 'RETAILER') {
    return { billType: 'RETAIL_TO_CUSTOMER' };
  }
  return { status: 403, error: 'Unsupported role' };
}

// Validate that the seller has enough stock for every requested item
async function validateStockAvailability(sellerId, items) {
  for (const item of items) {
    const stockResult = await db.query('SELECT quantity FROM stock WHERE user_id = $1 AND product_id = $2', [sellerId, item.productId]);
    const stock = stockResult.rows[0];
    if (!stock || stock.quantity < item.quantity) {
      const prodResult = await db.query('SELECT name FROM products WHERE id = $1', [item.productId]);
      const product = prodResult.rows[0];
      return { error: `Insufficient stock for ${product?.name || 'product'}. Available: ${stock?.quantity || 0}, Requested: ${item.quantity}` };
    }
  }
  return { ok: true };
}

// Compute per-item rates, GST (18%), and the bill totals for a given bill type
async function computeBillTotals(actualBillType, items, discount, paidAmount) {
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

    const rate = Number(item.rate || defaultRate);
    const quantity = Number(item.quantity);
    const itemSubtotal = quantity * rate;
    const gstRate = item.gst !== undefined ? Number(item.gst) : 18; // Default to 18% GST
    const itemGst = itemSubtotal * (gstRate / 100);

    subtotal += itemSubtotal;
    totalGst += itemGst;

    billItems.push({
      ...item,
      quantity,
      rate,
      gstRate,
      gstAmount: itemGst,
      amount: itemSubtotal + itemGst
    });
  }

  const discountAmount = Number(discount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const grandTotal = taxableAmount + totalGst;
  const finalPaid = Math.min(Number(paidAmount) || 0, grandTotal);
  const dueAmount = Math.max(0, grandTotal - finalPaid);
  const paymentStatus = dueAmount === 0 ? 'PAID' : finalPaid > 0 ? 'PARTIAL' : 'PENDING';

  return { subtotal, totalGst, billItems, discountAmount, grandTotal, finalPaid, dueAmount, paymentStatus };
}

// Generate the next bill number for today's date
async function generateBillNumber(todayStr) {
  const countResult = await db.query('SELECT COUNT(*) as count FROM bills WHERE bill_date = $1', [todayStr]);
  return `BILL-${todayStr.replace(/-/g, '')}-${String(parseInt(countResult.rows[0].count, 10) + 1).padStart(4, '0')}`;
}

// Create bill
router.post('/', async (req, res) => {
  const { buyerId, customerName, items, discount = 0, paidAmount = 0, paymentMethod = 'Cash' } = req.body;

  // ---- All validation happens BEFORE a pooled connection is acquired ----
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  try {
    // Validate bill type and buyer
    const resolved = await resolveBillType(req.user, buyerId);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error });
    }
    const actualBillType = resolved.billType;

    // Validate stock availability
    const stockCheck = await validateStockAvailability(req.user.id, items);
    if (stockCheck.error) {
      return res.status(400).json({ error: stockCheck.error });
    }

    // Calculate subtotal, GST, and totals
    const {
      subtotal, totalGst, billItems, discountAmount, grandTotal, finalPaid, dueAmount, paymentStatus
    } = await computeBillTotals(actualBillType, items, discount, paidAmount);

    // Generate bill number
    const todayStr = new Date().toISOString().split('T')[0];
    const billNumber = await generateBillNumber(todayStr);

    // ==========================================
    // PostgreSQL Transaction Handling
    // ==========================================
    const client = await db.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;

      // 1. Create bill header with subtotal, discount, gst, and grand total
      const billResult = await client.query(`
      INSERT INTO bills (bill_number, bill_date, seller_id, buyer_id, customer_name, bill_type, subtotal, discount, gst, grand_total, paid_amount, due_amount, payment_status, payment_method, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [
        billNumber, todayStr, req.user.id, buyerId || null, customerName || null,
        actualBillType, subtotal, discountAmount, totalGst, grandTotal,
        finalPaid, dueAmount, paymentStatus, paymentMethod, req.user.id
      ]);

      const billId = billResult.rows[0].id;

      // 2. Insert bill items with explicit item-level GST and amount records
      for (const item of billItems) {
        await client.query(
          'INSERT INTO bill_items (bill_id, product_id, quantity, rate, gst, amount) VALUES ($1, $2, $3, $4, $5, $6)',
          [billId, item.productId, item.quantity, item.rate, item.gstRate, item.amount]
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
      transactionStarted = false;

      return res.status(201).json({
        success: true,
        billId,
        billNumber,
        subtotal,
        gst: totalGst,
        grandTotal,
        message: 'Bill created successfully with subtotal and GST saved to database'
      });

    } catch (err) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          console.error('Bill rollback error:', rollbackErr);
        }
      }
      console.error('Bill creation error:', err);
      return res.status(500).json({ error: 'Failed to create bill and save GST records' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Bill creation error:', err);
    return res.status(500).json({ error: 'Failed to create bill and save GST records' });
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

// Set a bill's payment status from the billing screen.
router.patch('/:billId/payment-status', async (req, res) => {
  const client = await db.connect();
  try {
    const { status, method = 'Cash' } = req.body;
    if (!['PAID', 'PENDING'].includes(status)) {
      client.release();
      return res.status(400).json({ error: 'Status must be PAID or PENDING' });
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

    await client.query('BEGIN');
    if (status === 'PENDING') {
      await client.query('DELETE FROM payments WHERE bill_id = $1', [bill.id]);
      await client.query(
        "UPDATE bills SET paid_amount = 0, due_amount = grand_total, payment_status = 'PENDING' WHERE id = $1",
        [bill.id]
      );
    } else {
      const dueAmount = Math.max(0, Number(bill.grand_total) - Number(bill.paid_amount));
      if (dueAmount > 0.01) {
        const todayStr = new Date().toISOString().split('T')[0];
        await client.query(
          'INSERT INTO payments (bill_id, amount, method, date) VALUES ($1, $2, $3, $4)',
          [bill.id, dueAmount, method, todayStr]
        );
      }
      await client.query(
        "UPDATE bills SET paid_amount = grand_total, due_amount = 0, payment_status = 'PAID' WHERE id = $1",
        [bill.id]
      );
    }
    await client.query('COMMIT');
    client.release();
    res.json({ success: true, status });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Payment status update error:', err);
    res.status(500).json({ error: 'Failed to update payment status' });
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