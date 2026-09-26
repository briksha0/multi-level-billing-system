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
    return buyer && ['SS', 'DISTRIBUTOR', 'RETAILER'].includes(buyer.role);
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
      return { status: 403, error: 'Admin can only bill to users within the hierarchy' };
    }
    const buyerResult = await db.query('SELECT role FROM users WHERE id = $1', [buyerId]);
    const buyerRole = buyerResult.rows[0].role;
    let billType = 'ADMIN_TO_SS';
    if (buyerRole === 'DISTRIBUTOR') billType = 'ADMIN_TO_DIST';
    if (buyerRole === 'RETAILER') billType = 'ADMIN_TO_RETAIL';
    return { billType };
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
      case 'ADMIN_TO_DIST': defaultRate = product.distributor_price; break;
      case 'ADMIN_TO_RETAIL': defaultRate = product.retail_price; break;
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
      return res.status(500).json({ error: 'Failed to create bill: ' + err.message + ' | Stack: ' + err.stack });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Bill creation error:', err);
    return res.status(500).json({ error: 'Failed to create bill: ' + err.message + ' | Stack: ' + err.stack });
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

// PUT /api/bills/:id - Update bill and stock
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { discount = 0, paidAmount = 0, paymentMethod = 'Cash', items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  const normalizedItems = items.map(item => ({
    productId: Number(item.productId),
    quantity: Number(item.quantity),
    rate: Number(item.rate || 0),
    gst: item.gst === undefined ? undefined : Number(item.gst)
  })).filter(item => item.quantity > 0);

  if (normalizedItems.length === 0 || normalizedItems.some(item => !Number.isInteger(item.productId) || !Number.isInteger(item.quantity))) {
    return res.status(400).json({ error: 'At least one item must have a valid positive quantity' });
  }

  const client = await db.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const billResult = await client.query(
      'SELECT * FROM public.bills WHERE id = $1 FOR UPDATE',
      [id]
    );
    const bill = billResult.rows[0];

    if (!bill) {
      const error = new Error('Bill not found');
      error.status = 404;
      throw error;
    }
    if (bill.seller_id !== req.user.id && req.user.role !== 'ADMIN') {
      const error = new Error('Only the bill seller can update this bill');
      error.status = 403;
      throw error;
    }

    const oldItemsResult = await client.query(
      'SELECT product_id, quantity FROM public.bill_items WHERE bill_id = $1',
      [id]
    );

    const oldQuantities = new Map();
    for (const item of oldItemsResult.rows) {
      oldQuantities.set(Number(item.product_id), Number(item.quantity));
    }

    const newQuantities = new Map();
    for (const item of normalizedItems) {
      newQuantities.set(item.productId, (newQuantities.get(item.productId) || 0) + item.quantity);
    }

    const adjustStock = async (userId, productId, delta, label) => {
      if (!userId || delta === 0) return;

      const stockResult = await client.query(
        'SELECT quantity FROM public.stock WHERE user_id = $1 AND product_id = $2 FOR UPDATE',
        [userId, productId]
      );
      const currentQuantity = stockResult.rows[0] ? Number(stockResult.rows[0].quantity) : 0;

      if (delta < 0 && currentQuantity < Math.abs(delta)) {
        const productResult = await client.query(
          'SELECT name FROM public.products WHERE id = $1',
          [productId]
        );
        const productName = productResult.rows[0]?.name || 'product';
        const error = new Error(`Insufficient ${label} stock for ${productName}`);
        error.status = 400;
        throw error;
      }

      if (stockResult.rows[0]) {
        await client.query(
          'UPDATE public.stock SET quantity = quantity + $1 WHERE user_id = $2 AND product_id = $3',
          [delta, userId, productId]
        );
      } else if (delta > 0) {
        await client.query(
          'INSERT INTO public.stock (user_id, product_id, quantity) VALUES ($1, $2, $3)',
          [userId, productId, delta]
        );
      }
    };

    const productIds = new Set([...oldQuantities.keys(), ...newQuantities.keys()]);
    for (const productId of productIds) {
      const delta = (newQuantities.get(productId) || 0) - (oldQuantities.get(productId) || 0);
      await adjustStock(bill.seller_id, productId, -delta, 'seller');

      if (bill.buyer_id && bill.bill_type !== 'RETAIL_TO_CUSTOMER') {
        await adjustStock(bill.buyer_id, productId, delta, 'buyer');
      }
    }

    const totals = await computeBillTotals(
      bill.bill_type,
      normalizedItems,
      discount,
      paidAmount
    );

    await client.query('DELETE FROM public.bill_items WHERE bill_id = $1', [id]);
    for (const item of totals.billItems) {
      await client.query(
        'INSERT INTO public.bill_items (bill_id, product_id, quantity, rate, gst, amount) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, item.productId, item.quantity, item.rate, item.gstRate, item.amount]
      );
    }

    await client.query('DELETE FROM public.stock_transactions WHERE bill_id = $1', [id]);
    if (bill.buyer_id && bill.bill_type !== 'RETAIL_TO_CUSTOMER') {
      const todayStr = new Date().toISOString().split('T')[0];
      for (const item of totals.billItems) {
        await client.query(
          'INSERT INTO public.stock_transactions (date, from_id, to_id, product_id, quantity, type, bill_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [todayStr, bill.seller_id, bill.buyer_id, item.productId, item.quantity, 'OUT', id]
        );
      }
    }

    await client.query(
      `UPDATE public.bills
       SET subtotal = $1, discount = $2, gst = $3, grand_total = $4,
           paid_amount = $5, due_amount = $6, payment_status = $7, payment_method = $8
       WHERE id = $9`,
      [
        totals.subtotal,
        totals.discountAmount,
        totals.totalGst,
        totals.grandTotal,
        totals.finalPaid,
        totals.dueAmount,
        totals.paymentStatus,
        paymentMethod,
        id
      ]
    );

    await client.query('DELETE FROM public.payments WHERE bill_id = $1', [id]);
    if (totals.finalPaid > 0) {
      await client.query(
        'INSERT INTO public.payments (bill_id, amount, method, date) VALUES ($1, $2, $3, CURRENT_DATE)',
        [id, totals.finalPaid, paymentMethod]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    res.json({ message: 'Bill and stock updated successfully' });
  } catch (err) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error('Bill update error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to update bill and stock' });
  } finally {
    client.release();
  }
});

// DELETE /api/bills/:id - Delete a bill
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await db.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const billResult = await client.query(
      'SELECT seller_id, buyer_id, bill_type FROM public.bills WHERE id = $1 FOR UPDATE',
      [id]
    );
    const bill = billResult.rows[0];

    if (!bill) {
      const error = new Error('Bill not found');
      error.status = 404;
      throw error;
    }
    if (bill.seller_id !== req.user.id && req.user.role !== 'ADMIN') {
      const error = new Error('Only the bill seller can delete this bill');
      error.status = 403;
      throw error;
    }

    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM public.bill_items WHERE bill_id = $1',
      [id]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        `INSERT INTO public.stock (user_id, product_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, product_id)
         DO UPDATE SET quantity = public.stock.quantity + EXCLUDED.quantity`,
        [bill.seller_id, item.product_id, item.quantity]
      );

      if (bill.buyer_id && bill.bill_type !== 'RETAIL_TO_CUSTOMER') {
        const buyerStockResult = await client.query(
          'SELECT quantity FROM public.stock WHERE user_id = $1 AND product_id = $2 FOR UPDATE',
          [bill.buyer_id, item.product_id]
        );
        const buyerQuantity = buyerStockResult.rows[0] ? Number(buyerStockResult.rows[0].quantity) : 0;
        if (buyerQuantity < Number(item.quantity)) {
          const error = new Error('Cannot delete bill because buyer stock is already lower than the billed quantity');
          error.status = 400;
          throw error;
        }

        await client.query(
          'UPDATE public.stock SET quantity = quantity - $1 WHERE user_id = $2 AND product_id = $3',
          [item.quantity, bill.buyer_id, item.product_id]
        );
      }
    }

    await client.query('DELETE FROM public.stock_transactions WHERE bill_id = $1', [id]);
    await client.query('DELETE FROM public.payments WHERE bill_id = $1', [id]);
    await client.query('DELETE FROM public.bill_items WHERE bill_id = $1', [id]);
    await client.query('DELETE FROM public.bills WHERE id = $1', [id]);
    await client.query('COMMIT');
    transactionStarted = false;
    res.json({ message: 'Bill deleted successfully and stock reversed' });
  } catch (err) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error('Bill delete error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to delete bill and reverse stock' });
  } finally {
    client.release();
  }
});

module.exports = router;