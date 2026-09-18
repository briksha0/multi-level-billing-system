// server/db/init.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');

// Explicitly load .env from the root directory if this file is inside server/db/
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Create the connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true // Required to run multiple CREATE TABLE queries at once
});

async function initializeDB() {
  try {
    // 1. Create tables using MySQL-compatible syntax
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role ENUM('ADMIN', 'SS', 'DISTRIBUTOR', 'RETAILER') NOT NULL,
        parent_id INT,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        category_id INT,
        sku VARCHAR(50) UNIQUE NOT NULL,
        barcode VARCHAR(100),
        unit VARCHAR(20) DEFAULT 'PCS',
        ss_price DECIMAL(10,2) DEFAULT 0,
        distributor_price DECIMAL(10,2) DEFAULT 0,
        retail_price DECIMAL(10,2) DEFAULT 0,
        mrp DECIMAL(10,2) DEFAULT 0,
        min_stock INT DEFAULT 10,
        status VARCHAR(20) DEFAULT 'active',
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS stock (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT DEFAULT 0,
        UNIQUE KEY unique_stock (user_id, product_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS bills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_number VARCHAR(50) UNIQUE NOT NULL,
        bill_date DATE NOT NULL,
        seller_id INT,
        buyer_id INT,
        customer_name VARCHAR(150),
        bill_type VARCHAR(50) NOT NULL,
        subtotal DECIMAL(12,2) DEFAULT 0,
        discount DECIMAL(12,2) DEFAULT 0,
        gst DECIMAL(12,2) DEFAULT 0,
        grand_total DECIMAL(12,2) DEFAULT 0,
        paid_amount DECIMAL(12,2) DEFAULT 0,
        due_amount DECIMAL(12,2) DEFAULT 0,
        payment_status VARCHAR(20) DEFAULT 'PENDING',
        payment_method VARCHAR(50),
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id),
        FOREIGN KEY (buyer_id) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS bill_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        rate DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) DEFAULT 0,
        gst DECIMAL(5,2) DEFAULT 0,
        amount DECIMAL(12,2) NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS stock_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        from_id INT,
        to_id INT,
        product_id INT,
        quantity INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        bill_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_id) REFERENCES users(id),
        FOREIGN KEY (to_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (bill_id) REFERENCES bills(id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT,
        amount DECIMAL(12,2) NOT NULL,
        method VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES bills(id)
      );

      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        retailer_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (retailer_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        \`read\` TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // 2. Check if DB is empty and needs seeding
    const [userRows] = await pool.query('SELECT COUNT(*) as count FROM users');

    if (userRows[0].count === 0) {
      console.log('🌱 Seeding initial MySQL database...');

      const hash = async (pw) => await bcrypt.hash(pw, 8);

      // Helper function to insert users
      const insertUser = async (username, password, name, role, parentId) => {
        const hashedPw = await hash(password);
        const [result] = await pool.query(
          'INSERT INTO users (username, password, name, role, parent_id) VALUES (?, ?, ?, ?, ?)',
          [username, hashedPw, name, role, parentId]
        );
        return result.insertId;
      };

      // Users
      const adminId = await insertUser('admin', 'admin123', 'System Admin', 'ADMIN', null);
      const ssAgraId = await insertUser('ss_agra', 'ss123', 'SS Agra', 'SS', adminId);
      const ssDelhiId = await insertUser('ss_delhi', 'ss123', 'SS Delhi', 'SS', adminId);
      const distAId = await insertUser('dist_a', 'dist123', 'Distributor A', 'DISTRIBUTOR', ssAgraId);
      const distBId = await insertUser('dist_b', 'dist123', 'Distributor B', 'DISTRIBUTOR', ssAgraId);
      const distCId = await insertUser('dist_c', 'dist123', 'Distributor C', 'DISTRIBUTOR', ssDelhiId);
      const retailAId = await insertUser('retail_a', 'retail123', 'Retailer A', 'RETAILER', distAId);
      await insertUser('retail_b', 'retail123', 'Retailer B', 'RETAILER', distAId);
      await insertUser('retail_c', 'retail123', 'Retailer C', 'RETAILER', distBId);
      await insertUser('retail_d', 'retail123', 'Retailer D', 'RETAILER', distCId);

      // 3. Ensure default categories exist first before inserting products
      await pool.query(`
        INSERT INTO categories (id, name) VALUES 
        (1, 'General'),
        (2, 'Cleaning Supplies')
        ON DUPLICATE KEY UPDATE name=name;
      `);

      // Products (26 Items with ONLY 4-tier pricing + min_stock)
      const products = [
        ['Liquid Detergent 500ml+250ml', 2, 'LD-750', '890101', 'PCS', 99.11, 107.04, 116.95, 209, 50],
        ['Liquid Detergent 1L',             2, 'LD-1L',  '890102', 'PCS', 136.46, 147.37, 161.02, 269, 50],

        ['Floor Cleaner 500ml',             2, 'FC-500', '890103', 'PCS', 35.91, 38.78, 42.37, 89, 50],
        ['Floor Cleaner 1L',                2, 'FC-1L',  '890104', 'PCS', 57.46, 62.05, 67.80, 149, 50],
        ['Floor Cleaner 2L',                2, 'FC-2L',  '890105', 'PCS', 89.77, 96.96, 105.93, 229, 50],
        ['Floor Cleaner 5L',                2, 'FC-5L',  '890106', 'PCS', 215.46, 232.69, 254.24, 799, 50],

        ['Bathroom Cleaner 500ml',          2, 'BC-500', '890107', 'PCS', 43.09, 46.54, 50.85, 109, 50],
        ['Bathroom Cleaner 5L',             2, 'BC-5L',  '890108', 'PCS', 308.82, 333.53, 364.41, 849, 50],

        ['Dishwash 250ml',                  2, 'DW-250', '890109', 'PCS', 28.73, 31.03, 33.90, 55, 50],
        ['Dishwash 500ml',                  2, 'DW-500', '890110', 'PCS', 50.27, 54.30, 59.38, 105, 50],
        ['Dishwash 5L',                     2, 'DW-5L',  '890111', 'PCS', 344.73, 372.31, 406.78, 949, 50],

        ['Handwash 250ml',                  2, 'HW-250', '890112', 'PCS', 39.50, 42.66, 46.61, 89, 50],
        ['Handwash 500ml',                  2, 'HW-500', '890113', 'PCS', 62.48, 67.48, 73.73, 149, 50],
        ['Handwash 5L',                     2, 'HW-5L',  '890114', 'PCS', 344.73, 372.31, 406.78, 949, 50],

        ['Toilet Cleaner 250ml',            2, 'TC-250', '890115', 'PCS', 24.32, 25.85, 29.66, 55, 50],
        ['Toilet Cleaner 500ml',            2, 'TC-500', '890116', 'PCS', 39.50, 42.66, 46.61, 110, 50],
        ['Toilet Cleaner 1L',               2, 'TC-1L',  '890117', 'PCS', 66.08, 71.36, 77.97, 199, 50],
        ['Toilet Cleaner 5L',               2, 'TC-5L',  '890118', 'PCS', 251.36, 271.47, 296.61, 749, 50],

        ['White Phenyl 1L',                 2, 'WP-1L',  '890119', 'PCS', 25.14, 27.14, 29.66, 80, 50],
        ['White Phenyl 5L',                 2, 'WP-5L',  '890120', 'PCS', 86.18, 93.08, 101.69, 299, 50],

        ['Black Phenyl 500ml',              2, 'BP-500', '890121', 'PCS', 25.14, 27.14, 29.66, 80, 50],
        ['Black Phenyl 5L',                 2, 'BP-5L',  '890122', 'PCS', 194.08, 209.42, 228.81, 499, 50],

        ['Glass Cleaner 500ml',             2, 'GC-500', '890123', 'PCS', 39.50, 42.66, 46.61, 109, 50],
        ['Glass Cleaner 5L',                2, 'GC-5L',  '890124', 'PCS', 215.46, 232.69, 254.24, 599, 50],

        ['Room Freshener 200ml',            2, 'RF-200', '890125', 'PCS', 53.86, 58.17, 63.56, 179, 50],
        ['Room Freshener 5L',               2, 'RF-5L',  '890126', 'PCS', 574.55, 620.51, 677.97, 1499, 50]
      ];

      for (const p of products) {
        await pool.query(
          'INSERT INTO products (name, category_id, sku, barcode, unit, ss_price, distributor_price, retail_price, mrp, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          p
        );
      }

      // Stock Seeding Helper
      const insertStocks = async (userId, stockMap) => {
        for (const [pid, qty] of Object.entries(stockMap)) {
          await pool.query('INSERT INTO stock (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, pid, qty]);
        }
      };

      // Automatically generate a stock map for all 26 products
      const generateStock = (qty) => {
        const stock = {};
        for(let i = 1; i <= 26; i++) stock[i] = qty;
        return stock;
      };

      await insertStocks(adminId, generateStock(1000));
      await insertStocks(ssAgraId, generateStock(200));
      await insertStocks(ssDelhiId, generateStock(150));
      await insertStocks(distAId, generateStock(100));
      await insertStocks(distBId, generateStock(60));
      await insertStocks(distCId, generateStock(60));
      await insertStocks(retailAId, generateStock(30));

      // Sample Bills
      const [billRes] = await pool.query(
        `INSERT INTO bills (bill_number, bill_date, seller_id, buyer_id, bill_type, subtotal, discount, gst, grand_total, paid_amount, due_amount, payment_status, payment_method, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['BILL-0001', '2026-09-10', adminId, ssAgraId, 'ADMIN_TO_SS', 31441, 0, 5659.38, 37100.38, 37100.38, 0, 'PAID', 'Bank Transfer', adminId]
      );
      const bill1Id = billRes.insertId;

      // Bill items using the new Product 1 & 2 pricing
      await pool.query('INSERT INTO bill_items (bill_id, product_id, quantity, rate, gst, amount) VALUES (?, ?, ?, ?, ?, ?)', [bill1Id, 1, 200, 116.95, 18, 27600.20]);
      await pool.query('INSERT INTO bill_items (bill_id, product_id, quantity, rate, gst, amount) VALUES (?, ?, ?, ?, ?, ?)', [bill1Id, 2, 50, 161.02, 18, 9500.18]);

      // Customers
      const customers = [
        ['Walk-in Customer', '', '', '', retailAId],
        ['Rajesh Kumar', '9876543210', 'rajesh@email.com', '123 Main St', retailAId],
        ['Priya Sharma', '9876543211', 'priya@email.com', '456 Park Ave', retailAId]
      ];
      for (const c of customers) {
        await pool.query('INSERT INTO customers (name, phone, email, address, retailer_id) VALUES (?, ?, ?, ?, ?)', c);
      }

      console.log('✅ Database seeded successfully!');
    }
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }
}

// Run initialization
initializeDB();

module.exports = pool;