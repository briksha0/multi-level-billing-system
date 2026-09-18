const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/init');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Updated to async MySQL query syntax
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = users[0];
    
    // Updated to async bcrypt.compare to prevent blocking the Node.js event loop
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account is inactive' });
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        parentId: user.parent_id
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Get current user (No DB query here, so it remains synchronous)
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    // Fetch the user's current password
    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];
    
    // Verify current password
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password and update asynchronously
    const hashed = await bcrypt.hash(newPassword, 8);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ error: 'Internal server error while changing password' });
  }
});

// Get children (downline users) for a specific user ID and role
// Get downline child users for a specific user ID and role
router.get('/:id/children', authenticateToken, async (req, res) => {
  try {
    const parentId = req.params.id;
    const { role } = req.query;

    let query = 'SELECT id, username, name, role, parent_id, status, created_at FROM users WHERE parent_id = ?';
    const params = [parentId];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    query += ' ORDER BY name';

    const [children] = await db.query(query, params);
    res.json(children);
  } catch (err) {
    console.error('Error fetching child users:', err);
    res.status(500).json({ error: 'Failed to fetch child users' });
  }
});



module.exports = router;