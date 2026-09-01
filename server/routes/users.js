// server/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/init');
const { authenticateToken, requireRole, canAccessUser } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get visible users based on hierarchy
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    let users = [];

    // We use a LEFT JOIN to get the parent's name in a single query, preventing N+1 DB calls
    const baseQuery = `
      SELECT u.id, u.username, u.name, u.role, u.parent_id, u.status, u.created_at, p.name as parentName 
      FROM users u 
      LEFT JOIN users p ON u.parent_id = p.id
    `;

    if (req.user.role === 'ADMIN') {
      if (role) {
        const result = await db.query(`${baseQuery} WHERE u.role = $1 AND u.id != $2`, [role, req.user.id]);
        users = result.rows;
      } else {
        const result = await db.query(`${baseQuery} WHERE u.id != $1`, [req.user.id]);
        users = result.rows;
      }
    } else {
      // Fetch all users once and build the hierarchy in memory
      const result = await db.query(baseQuery);
      const allUsers = result.rows;

      const getDescendants = (parentId, all) => {
        const children = all.filter(u => u.parent_id === parentId);
        let resList = [...children];
        children.forEach(c => {
          resList = resList.concat(getDescendants(c.id, all));
        });
        return resList;
      };

      users = getDescendants(req.user.id, allUsers);

      if (role) {
        users = users.filter(u => u.role === role);
      }
    }

    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:userId', canAccessUser, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, name, role, parent_id, status, created_at FROM users WHERE id = $1',
      [req.params.userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user (Admin or SS or Distributor)
router.post('/', requireRole('ADMIN', 'SS', 'DISTRIBUTOR'), async (req, res) => {
  try {
    const { username, name, role, parentId, password } = req.body;

    if (!username || !name || !role) {
      return res.status(400).json({ error: 'Username, name, and role are required' });
    }

    // Validate role creation permissions
    const roleHierarchy = { ADMIN: 4, SS: 3, DISTRIBUTOR: 2, RETAILER: 1 };
    if (roleHierarchy[role] >= roleHierarchy[req.user.role]) {
      return res.status(403).json({ error: 'Cannot create users at or above your level' });
    }

    // Determine valid parent
    let validParentId = parentId;
    if (req.user.role === 'SS' && role === 'DISTRIBUTOR') validParentId = req.user.id;
    if (req.user.role === 'SS' && role === 'RETAILER') {
      if (!parentId) return res.status(400).json({ error: 'Parent distributor is required' });

      const parentResult = await db.query('SELECT id, parent_id FROM users WHERE id = $1 AND role = $2', [parentId, 'DISTRIBUTOR']);
      const parent = parentResult.rows[0];

      if (!parent || parent.parent_id !== req.user.id) {
        return res.status(403).json({ error: 'Invalid parent distributor' });
      }
    }
    if (req.user.role === 'DISTRIBUTOR') validParentId = req.user.id;

    // Check existing username
    const existingResult = await db.query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
    if (existingResult.rows.length > 0) return res.status(400).json({ error: 'Username already exists' });

    const userPassword = password || (role === 'SS' ? 'ss123' : role === 'DISTRIBUTOR' ? 'dist123' : 'retail123');
    const hashed = await bcrypt.hash(userPassword, 8);

    // Insert new user with PostgreSQL RETURNING id
    const insertResult = await db.query(
      'INSERT INTO users (username, password, name, role, parent_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username.toLowerCase(), hashed, name, role, validParentId]
    );

    const newUserId = insertResult.rows[0].id;

    // Initialize empty stock for new user across all products
    const productsResult = await db.query('SELECT id FROM products');
    const products = productsResult.rows;

    if (products.length > 0) {
      // Build a bulk insert query for PostgreSQL ($1, $2, $3), ($4, $5, $6)...
      let valuesClause = [];
      let queryParams = [];
      let index = 1;

      products.forEach(p => {
        valuesClause.push(`($${index++}, $${index++}, $${index++})`);
        queryParams.push(newUserId, p.id, 0);
      });

      await db.query(
        `INSERT INTO stock (user_id, product_id, quantity) VALUES ${valuesClause.join(', ')}`,
        queryParams
      );
    }

    res.status(201).json({
      id: newUserId,
      message: 'User created successfully'
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Delete user
router.delete('/:userId', canAccessUser, async (req, res) => {
  try {
    const targetId = Number(req.params.userId);
    if (!targetId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (Number(req.user.id) === targetId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const targetResult = await db.query('SELECT id, role, parent_id FROM users WHERE id = $1', [targetId]);
    const targetUser = targetResult.rows[0];

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query('BEGIN');

    await db.query('UPDATE users SET parent_id = NULL WHERE parent_id = $1', [targetId]);
    await db.query('DELETE FROM stock WHERE user_id = $1', [targetId]);
    await db.query('DELETE FROM notifications WHERE user_id = $1', [targetId]);
    await db.query('DELETE FROM audit_logs WHERE user_id = $1', [targetId]);
    await db.query('UPDATE bills SET seller_id = NULL WHERE seller_id = $1', [targetId]);
    await db.query('UPDATE bills SET buyer_id = NULL WHERE buyer_id = $1', [targetId]);
    await db.query('UPDATE bills SET created_by = NULL WHERE created_by = $1', [targetId]);
    await db.query('UPDATE customers SET retailer_id = NULL WHERE retailer_id = $1', [targetId]);
    await db.query('DELETE FROM users WHERE id = $1', [targetId]);

    await db.query('COMMIT');
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => { });
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update user status
router.patch('/:userId/status', canAccessUser, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, req.params.userId]);
    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (err) {
    console.error('Error updating user status:', err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Get user's children
router.get('/:userId/children', canAccessUser, async (req, res) => {
  try {
    const { role } = req.query;
    let query = 'SELECT id, username, name, role, parent_id, status FROM users WHERE parent_id = $1';
    const params = [req.params.userId];

    if (role) {
      query += ' AND role = $2';
      params.push(role);
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching user's children:", err);
    res.status(500).json({ error: "Failed to fetch user's children" });
  }
});

module.exports = router;