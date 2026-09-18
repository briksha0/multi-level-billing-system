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
        const [rows] = await db.query(`${baseQuery} WHERE u.role = ? AND u.id != ?`, [role, req.user.id]);
        users = rows;
      } else {
        const [rows] = await db.query(`${baseQuery} WHERE u.id != ?`, [req.user.id]);
        users = rows;
      }
    } else {
      // Fetch all users once and build the hierarchy in memory (much faster than recursive DB queries)
      const [allUsers] = await db.query(baseQuery);
      
      const getDescendants = (parentId, all) => {
        const children = all.filter(u => u.parent_id === parentId);
        let result = [...children];
        children.forEach(c => { 
          result = result.concat(getDescendants(c.id, all)); 
        });
        return result;
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
    const [users] = await db.query(
      'SELECT id, username, name, role, parent_id, status, created_at FROM users WHERE id = ?',
      [req.params.userId]
    );
    
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user (Admin or SS or Distributor)
router.post('/', requireRole('ADMIN', 'SS', 'DISTRIBUTOR'), async (req, res) => {
  try {
    const { username, name, role, parentId } = req.body;
    
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
      
      const [parents] = await db.query('SELECT id, parent_id FROM users WHERE id = ? AND role = ?', [parentId, 'DISTRIBUTOR']);
      const parent = parents[0];
      
      if (!parent || parent.parent_id !== req.user.id) {
        return res.status(403).json({ error: 'Invalid parent distributor' });
      }
    }
    if (req.user.role === 'DISTRIBUTOR') validParentId = req.user.id;
    
    // Check existing username
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });
    
    const defaultPassword = role === 'SS' ? 'ss123' : role === 'DISTRIBUTOR' ? 'dist123' : 'retail123';
    const hashed = await bcrypt.hash(defaultPassword, 8); // Async hash
    
    // Insert new user
    const [result] = await db.query(
      'INSERT INTO users (username, password, name, role, parent_id) VALUES (?, ?, ?, ?, ?)',
      [username.toLowerCase(), hashed, name, role, validParentId]
    );
    
    const newUserId = result.insertId; // MySQL uses insertId instead of lastInsertRowid
    
    // Initialize empty stock for new user
    const [products] = await db.query('SELECT id FROM products');
    if (products.length > 0) {
      // Bulk insert is much more efficient than looping through individual inserts
      const stockValues = products.map(p => [newUserId, p.id, 0]);
      await db.query('INSERT INTO stock (user_id, product_id, quantity) VALUES ?', [stockValues]);
    }
    
    res.status(201).json({ 
      id: newUserId, 
      message: 'User created successfully',
      defaultPassword
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user status
router.patch('/:userId/status', canAccessUser, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.userId]);
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
    let query = 'SELECT id, username, name, role, parent_id, status FROM users WHERE parent_id = ?';
    const params = [req.params.userId];
    
    if (role) { 
      query += ' AND role = ?'; 
      params.push(role); 
    }
    
    const [children] = await db.query(query, params);
    res.json(children);
  } catch (err) {
    console.error("Error fetching user's children:", err);
    res.status(500).json({ error: "Failed to fetch user's children" });
  }
});

module.exports = router;