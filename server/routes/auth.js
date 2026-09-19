// server/routes/auth.js
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
    
    // PostgreSQL query syntax using $1 parameter
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    // Async bcrypt compare
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

    // Fetch the user's current password using PostgreSQL $1 parameter
    const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    
    // Verify current password
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password and update asynchronously
    const hashed = await bcrypt.hash(newPassword, 8);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ error: 'Internal server error while changing password' });
  }
});

// Get children (downline users) for a specific user ID and role
router.get('/:id/children', authenticateToken, async (req, res) => {
  try {
    const parentId = req.params.id;
    const { role } = req.query;

    let query = 'SELECT id, username, name, role, parent_id, status, created_at FROM users WHERE parent_id = $1';
    const params = [parentId];

    if (role) {
      query += ' AND role = $2';
      params.push(role);
    }

    query += ' ORDER BY name';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching child users:', err);
    res.status(500).json({ error: 'Failed to fetch child users' });
  }
});

module.exports = router;