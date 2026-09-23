// server/routes/stock.js
const express = require('express');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// =====================================================
// Get stock for a user (defaults to current user)
// =====================================================
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId, 10)
      : req.user.id;

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        error: 'Invalid userId'
      });
    }

    // Permission check
    if (userId !== req.user.id) {
      const roleHierarchy = {
        ADMIN: 4,
        SS: 3,
        DISTRIBUTOR: 2,
        RETAILER: 1
      };

      if (req.user.role !== 'ADMIN') {
        const targetResult = await db.query(
          `
          SELECT id, parent_id, role
          FROM public.users
          WHERE id = $1
          `,
          [userId]
        );

        const targetUser = targetResult.rows[0];
        const isRetailerParent =
          req.user.role === 'RETAILER' &&
          targetUser?.role === 'DISTRIBUTOR' &&
          Number(targetUser.id) === Number(req.user.parent_id);

        if (
          !targetUser ||
          (roleHierarchy[targetUser.role] >= roleHierarchy[req.user.role] && !isRetailerParent)
        ) {
          return res.status(403).json({
            error: 'Access denied'
          });
        }

        // Check hierarchy
        let current = userId;
        const visited = new Set();
        let isDescendant = isRetailerParent;

        while (current && !visited.has(current)) {
          visited.add(current);

          if (current === req.user.id) {
            isDescendant = true;
            break;
          }

          const uResult = await db.query(
            `
            SELECT parent_id
            FROM public.users
            WHERE id = $1
            `,
            [current]
          );

          current = uResult.rows[0]?.parent_id;
        }

        if (!isDescendant) {
          return res.status(403).json({
            error: 'Access denied'
          });
        }
      }
    }

    // =====================================================
    // Get stock
    // =====================================================
    const result = await db.query(
      `
      SELECT
        s.product_id,
        s.quantity,
        p.name,
        p.sku,
        p.unit,
        p.items_per_unit,
        p.ss_price,
        p.distributor_price,
        p.retail_price,
        p.mrp,
        p.min_stock
      FROM public.stock AS s
      INNER JOIN public.products AS p
        ON s.product_id = p.id
      WHERE s.user_id = $1
      ORDER BY p.name ASC
      `,
      [userId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching stock:', err);

    res.status(500).json({
      error: 'Failed to fetch stock',
      details: process.env.NODE_ENV === 'development'
        ? err.message
        : undefined
    });
  }
});


// =====================================================
// Get low stock items
// =====================================================
router.get('/low-stock', async (req, res) => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId, 10)
      : req.user.id;

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        error: 'Invalid userId'
      });
    }

    const result = await db.query(
      `
      SELECT
        s.product_id,
        s.quantity,
        p.name,
        p.sku,
        p.unit,
        p.items_per_unit,
        p.min_stock
      FROM public.stock AS s
      INNER JOIN public.products AS p
        ON s.product_id = p.id
      WHERE
        s.user_id = $1
        AND s.quantity <= p.min_stock
      ORDER BY s.quantity ASC
      `,
      [userId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching low stock:', err);

    res.status(500).json({
      error: 'Failed to fetch low stock items'
    });
  }
});


// =====================================================
// Add opening stock (Admin only)
// =====================================================
router.post('/add', async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Only admin can add opening stock'
      });
    }

    const userId = parseInt(req.body.userId, 10);
    const productId = parseInt(req.body.productId, 10);
    const quantity = parseInt(req.body.quantity, 10);

    if (
      !Number.isInteger(userId) ||
      !Number.isInteger(productId) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        error: 'Valid userId, productId, and positive quantity are required'
      });
    }

    await db.query(
      `
      INSERT INTO public.stock (
        user_id,
        product_id,
        quantity
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET
        quantity = public.stock.quantity + EXCLUDED.quantity
      `,
      [userId, productId, quantity]
    );

    res.json({
      success: true,
      message: 'Stock added successfully'
    });

  } catch (err) {
    console.error('Error adding stock:', err);

    res.status(500).json({
      error: 'Failed to add stock'
    });
  }
});


// =====================================================
// Get stock transactions
// =====================================================
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.query.userId
      ? parseInt(req.query.userId, 10)
      : null;

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      500
    );

    let query = `
      SELECT
        st.*,
        p.name AS product_name,
        from_u.name AS from_name,
        to_u.name AS to_name
      FROM public.stock_transactions AS st
      INNER JOIN public.products AS p
        ON st.product_id = p.id
      LEFT JOIN public.users AS from_u
        ON st.from_id = from_u.id
      LEFT JOIN public.users AS to_u
        ON st.to_id = to_u.id
      WHERE 1 = 1
    `;

    const params = [];
    let paramIndex = 1;

    if (userId !== null) {
      query += `
        AND (
          st.from_id = $${paramIndex}
          OR st.to_id = $${paramIndex + 1}
        )
      `;

      params.push(userId, userId);
      paramIndex += 2;
    }

    query += `
      ORDER BY st.created_at DESC
      LIMIT $${paramIndex}
    `;

    params.push(limit);

    const result = await db.query(query, params);

    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching transactions:', err);

    res.status(500).json({
      error: 'Failed to fetch stock transactions'
    });
  }
});


// =====================================================
// Admin update / set exact stock quantity
// =====================================================
router.put('/update', async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Only admin can update stock directly'
      });
    }

    const userId = parseInt(req.body.userId, 10);
    const productId = parseInt(req.body.productId, 10);
    const quantity = parseInt(req.body.quantity, 10);

    if (
      !Number.isInteger(userId) ||
      !Number.isInteger(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      return res.status(400).json({
        error: 'Valid userId, productId, and non-negative quantity are required'
      });
    }

    await db.query(
      `
      INSERT INTO public.stock (
        user_id,
        product_id,
        quantity
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET
        quantity = EXCLUDED.quantity
      `,
      [userId, productId, quantity]
    );

    res.json({
      success: true,
      message: 'Stock updated successfully'
    });

  } catch (err) {
    console.error('Error updating stock:', err);

    res.status(500).json({
      error: 'Failed to update stock'
    });
  }
});


// =====================================================
// Transfer stock
// =====================================================
router.post('/transfer', async (req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const toUserId = parseInt(req.body.toUserId, 10);
    const productId = parseInt(req.body.productId, 10);
    const qty = parseInt(req.body.quantity, 10);

    const fromUserId = req.user.id;

    if (
      !Number.isInteger(toUserId) ||
      !Number.isInteger(productId) ||
      !Number.isInteger(qty) ||
      qty <= 0
    ) {
      await client.query('ROLLBACK');
      client.release();

      return res.status(400).json({
        error: 'Valid recipient, product, and positive quantity are required'
      });
    }

    if (toUserId === fromUserId) {
      await client.query('ROLLBACK');
      client.release();

      return res.status(400).json({
        error: 'You cannot transfer stock to yourself'
      });
    }

    // =================================================
    // 1. Check sender stock
    // =================================================
    const senderStockResult = await client.query(
      `
      SELECT quantity
      FROM public.stock
      WHERE user_id = $1
        AND product_id = $2
      FOR UPDATE
      `,
      [fromUserId, productId]
    );

    const senderQty = Number(
      senderStockResult.rows[0]?.quantity || 0
    );

    if (req.user.role !== 'ADMIN' && senderQty < qty) {
      await client.query('ROLLBACK');
      client.release();

      return res.status(400).json({
        error: `Insufficient stock. You only have ${senderQty} available.`
      });
    }

    // =================================================
    // 2. Deduct sender stock
    // =================================================
    await client.query(
      `
      UPDATE public.stock
      SET quantity = quantity - $1
      WHERE user_id = $2
        AND product_id = $3
      `,
      [qty, fromUserId, productId]
    );

    // =================================================
    // 3. Add recipient stock
    // =================================================
    await client.query(
      `
      INSERT INTO public.stock (
        user_id,
        product_id,
        quantity
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET
        quantity = public.stock.quantity + EXCLUDED.quantity
      `,
      [toUserId, productId, qty]
    );

    // =================================================
    // 4. Record transaction
    // =================================================
    await client.query(
      `
      INSERT INTO public.stock_transactions (
        from_id,
        to_id,
        product_id,
        quantity,
        type,
        date
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'TRANSFER',
        CURRENT_DATE
      )
      `,
      [fromUserId, toUserId, productId, qty]
    );

    await client.query('COMMIT');
    client.release();

    res.json({
      success: true,
      message: 'Stock transferred successfully'
    });

  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }

    client.release();

    console.error('Error transferring stock:', err);

    res.status(500).json({
      error: 'Failed to transfer stock'
    });
  }
});

// =====================================================
// Adjust stock (Used for Admin reporting damaged goods)
// =====================================================
router.post('/adjust', async (req, res) => {
  try {
    // Optional: Ensure only admin or authorized users can adjust stock
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admin can adjust inventory stock' });
    }

    const { userId, productId, quantityChange } = req.body;

    if (!userId || !productId || quantityChange === undefined) {
      return res.status(400).json({ error: 'Missing required fields: userId, productId, or quantityChange' });
    }

    // Insert or update stock safely using UPSERT
    await db.query(
      `
      INSERT INTO public.stock (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET quantity = stock.quantity + $3
      `,
      [userId, productId, parseInt(quantityChange, 10)]
    );

    res.json({ message: 'Stock adjusted successfully' });
  } catch (err) {
    console.error('Error adjusting stock:', err);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

module.exports = router;

