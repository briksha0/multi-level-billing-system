// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../db/init'); // Using the PostgreSQL connection pool

const JWT_SECRET = process.env.JWT_SECRET || 'mlb-system-secret-key-change-in-production';

// Authenticate token middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // PostgreSQL query syntax using $1 parameter
    const result = await db.query(
      'SELECT id, username, name, role, parent_id, status FROM users WHERE id = $1', 
      [decoded.userId]
    );
    const user = result.rows[0];
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.error('Auth Middleware Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// requireRole is strictly checking req.user, so it remains synchronous
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

// Authorization check for user downline/hierarchy access
async function canAccessUser(req, res, next) {
  try {
    const targetId = parseInt(req.params.userId || req.body.buyerId || req.query.userId, 10);
    if (!targetId) return next();
    
    const roleHierarchy = { ADMIN: 4, SS: 3, DISTRIBUTOR: 2, RETAILER: 1 };
    const requesterLevel = roleHierarchy[req.user.role];
    
    // Admin can access everyone
    if (req.user.role === 'ADMIN') return next();
    
    // Check if target is in requester's hierarchy
    const targetResult = await db.query(
      'SELECT id, parent_id, role FROM users WHERE id = $1', 
      [targetId]
    );
    const targetUser = targetResult.rows[0];
    
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    
    // Can only manage users lower in hierarchy
    if (roleHierarchy[targetUser.role] >= requesterLevel) {
      return res.status(403).json({ error: 'Cannot access users at or above your level' });
    }
    
    // Check if target is descendant of requester
    let current = targetId;
    const visited = new Set();
    let isDescendant = false;

    while (current && !visited.has(current)) {
      visited.add(current);
      if (current === req.user.id) {
        isDescendant = true;
        break; // Found the ancestor
      }
      
      // Fetch the parent of the current user using PostgreSQL syntax
      const parentCheck = await db.query(
        'SELECT parent_id FROM users WHERE id = $1', 
        [current]
      );
      current = parentCheck.rows[0]?.parent_id;
    }
    
    if (!isDescendant) {
      return res.status(403).json({ error: 'Access denied: this user is not in your hierarchy' });
    }
    
    next();
  } catch (err) {
    console.error('Hierarchy Check Error:', err);
    return res.status(500).json({ error: 'Internal server error during authorization check' });
  }
}

module.exports = { authenticateToken, requireRole, canAccessUser, JWT_SECRET };