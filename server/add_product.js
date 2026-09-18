require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_NAME || 'mlb_system'
  });

  try {
    console.log('🔄 1. Upgrading products table schema...');
    
    // Add the new pricing columns. We use a try-catch for each in case they already exist.
    const columns = [
      'ALTER TABLE products ADD COLUMN ss_price DECIMAL(10,2) DEFAULT 0',
      'ALTER TABLE products ADD COLUMN distributor_price DECIMAL(10,2) DEFAULT 0',
      'ALTER TABLE products ADD COLUMN retail_price DECIMAL(10,2) DEFAULT 0',
      'ALTER TABLE products ADD COLUMN mrp DECIMAL(10,2) DEFAULT 0'
    ];

    for (const query of columns) {
      try {
        await pool.query(query);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') throw err; // Ignore if column already exists
      }
    }
    console.log('✅ Schema updated successfully with 4 pricing tiers.');

    console.log('🔄 2. Inserting 26 products from image data...');

    // Exact data mapped from edited-image.png
    // Array map: [name, category_id, sku, barcode, unit, ss, dist, retail, mrp, purchase_price (fallback), sale_price (fallback), gst, hsn, min_stock]
    const newProducts = [
      ['Liquid Detergent 500ml+250ml', 2, 'LD-750', '890101', 'PCS', 116.95, 126.31, 138.00, 209, 116.95, 209, 18, '3402', 50],
      ['Liquid Detergent 1L', 2, 'LD-1L', '890102', 'PCS', 161.02, 173.90, 190.00, 269, 161.02, 269, 18, '3402', 50],
      ['Floor Cleaner 500ml', 2, 'FC-500', '890103', 'PCS', 42.37, 45.76, 50.00, 89, 42.37, 89, 18, '3402', 50],
      ['Floor Cleaner 1L', 2, 'FC-1L', '890104', 'PCS', 67.80, 73.22, 80.00, 149, 67.80, 149, 18, '3402', 50],
      ['Floor Cleaner 2L', 2, 'FC-2L', '890105', 'PCS', 105.93, 114.41, 125.00, 229, 105.93, 229, 18, '3402', 50],
      ['Floor Cleaner 5L', 2, 'FC-5L', '890106', 'PCS', 254.24, 274.58, 300.00, 799, 254.24, 799, 18, '3402', 50],
      ['Bathroom Cleaner 500ml', 2, 'BC-500', '890107', 'PCS', 50.85, 54.92, 60.00, 109, 50.85, 109, 18, '3402', 50],
      ['Bathroom Cleaner 5L', 2, 'BC-5L', '890108', 'PCS', 364.41, 393.56, 430.00, 849, 364.41, 849, 18, '3402', 50],
      ['Dishwash 250ml', 2, 'DW-250', '890109', 'PCS', 33.90, 36.61, 40.00, 55, 33.90, 55, 18, '3402', 50],
      ['Dishwash 500ml', 2, 'DW-500', '890110', 'PCS', 59.32, 64.07, 70.00, 105, 59.32, 105, 18, '3402', 50],
      ['Dishwash 5L', 2, 'DW-5L', '890111', 'PCS', 406.78, 439.32, 480.00, 949, 406.78, 949, 18, '3402', 50],
      ['Handwash 250ml', 2, 'HW-250', '890112', 'PCS', 46.61, 50.34, 55.00, 89, 46.61, 89, 18, '3402', 50],
      ['Handwash 500ml', 2, 'HW-500', '890113', 'PCS', 73.73, 79.63, 87.00, 149, 73.73, 149, 18, '3402', 50],
      ['Handwash 5L', 2, 'HW-5L', '890114', 'PCS', 406.78, 439.32, 480.00, 949, 406.78, 949, 18, '3402', 50],
      ['Toilet Cleaner 250ml', 2, 'TC-250', '890115', 'PCS', 28.70, 30.50, 35.00, 55, 28.70, 55, 18, '3402', 50],
      ['Toilet Cleaner 500ml', 2, 'TC-500', '890116', 'PCS', 46.61, 50.34, 55.00, 110, 46.61, 110, 18, '3402', 50],
      ['Toilet Cleaner 1L', 2, 'TC-1L', '890117', 'PCS', 77.97, 84.20, 92.00, 199, 77.97, 199, 18, '3402', 50],
      ['Toilet Cleaner 5L', 2, 'TC-5L', '890118', 'PCS', 296.61, 320.34, 350.00, 749, 296.61, 749, 18, '3402', 50],
      ['White Phenyl 1L', 2, 'WP-1L', '890119', 'PCS', 29.66, 32.03, 35.00, 80, 29.66, 80, 18, '3808', 50],
      ['White Phenyl 5L', 2, 'WP-5L', '890120', 'PCS', 101.69, 109.83, 120.00, 299, 101.69, 299, 18, '3808', 50],
      ['Black Phenyl 500ml', 2, 'BP-500', '890121', 'PCS', 29.66, 32.03, 35.00, 80, 29.66, 80, 18, '3808', 50],
      ['Black Phenyl 5L', 2, 'BP-5L', '890122', 'PCS', 228.81, 247.12, 270.00, 499, 228.81, 499, 18, '3808', 50],
      ['Glass Cleaner 500ml', 2, 'GC-500', '890123', 'PCS', 46.61, 50.34, 55.00, 109, 46.61, 109, 18, '3402', 50],
      ['Glass Cleaner 5L', 2, 'GC-5L', '890124', 'PCS', 254.24, 274.58, 300.00, 599, 254.24, 599, 18, '3402', 50],
      ['Room Freshener 200ml', 2, 'RF-200', '890125', 'PCS', 63.56, 68.64, 75.00, 179, 63.56, 179, 18, '3307', 50],
      ['Room Freshener 5L', 2, 'RF-5L', '890126', 'PCS', 677.97, 732.20, 800.00, 1499, 677.97, 1499, 18, '3307', 50]
    ];

    const insertQuery = `
      INSERT INTO products 
      (name, category_id, sku, barcode, unit, ss_price, distributor_price, retail_price, mrp, purchase_price, sale_price, gst, hsn, min_stock) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      ss_price = VALUES(ss_price), distributor_price = VALUES(distributor_price), 
      retail_price = VALUES(retail_price), mrp = VALUES(mrp)
    `;

    for (const p of newProducts) {
      const [result] = await pool.query(insertQuery, p);
      
      // If it's a completely new insert (not an update), initialize stock to 0 for everyone
      if (result.insertId) {
         const [users] = await pool.query('SELECT id FROM users');
         if (users.length > 0) {
           const stockValues = users.map(u => [u.id, result.insertId, 0]);
           await pool.query('INSERT IGNORE INTO stock (user_id, product_id, quantity) VALUES ?', [stockValues]);
         }
         console.log(`  Added: ${p[0]}`);
      } else {
         console.log(`  Updated existing: ${p[0]}`);
      }
    }
    
    console.log('🎉 All 26 products inserted/updated successfully!');

  } catch (error) {
    console.error('❌ Error during update:', error);
  } finally {
    process.exit(0);
  }
}

run();