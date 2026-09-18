// 1. Load environment variables first
require('dotenv').config();

// 2. Import packages (only declare these once!)
const express = require('express');
const cors = require('cors');
const path = require('path');

// 3. Initialize database
require('./db/init');

// 4. Initialize Express app BEFORE using app.use()
const app = express();
const PORT = process.env.PORT || 3001;

// 5. Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/bills', require('./routes/billing'));
app.use('/api/reports', require('./routes/reports'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 MLB System Backend Server                               ║
║                                                              ║
║   API:    http://localhost:${PORT}/api                         ║
║   Health: http://localhost:${PORT}/api/health                  ║
║                                                              ║
║   Frontend: npm run dev (http://localhost:5173)              ║
║                                                              ║
║   Demo Credentials:                                          ║
║     • Admin:       admin / admin123                          ║
║     • SS:          ss_agra / ss123                           ║
║     • Distributor: dist_a / dist123                          ║
║     • Retailer:    retail_a / retail123                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});