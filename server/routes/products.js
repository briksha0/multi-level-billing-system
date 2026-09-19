// server/routes/products.js
const express = require('express');
const db = require('../db/init');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categories WHERE status = $1', ['active']);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category (Admin only)
router.post('/categories', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    
    const result = await db.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name]);
    res.status(201).json({ id: result.rows[0].id, name });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Get all products
router.get('/', async (req, res) => {
  try {
    const { categoryId, status } = req.query;
    let query = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (categoryId) { 
      query += ` AND p.category_id = $${paramIndex++}`; 
      params.push(categoryId); 
    }
    if (status) { 
      query += ` AND p.status = $${paramIndex++}`; 
      params.push(status); 
    }
    
    query += ' ORDER BY p.name';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product
router.get('/:productId', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = $1
    `, [req.params.productId]);
    
    const product = result.rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create product (Admin only)
router.post('/', requireRole('ADMIN'), async (req, res) => {
  try {
    const { 
      name, categoryId, sku, barcode, unit, itemsPerUnit, items_per_unit,
      ssPrice, distributorPrice, retailPrice, mrp, 
      minStock, initialStock
    } = req.body;
    
    if (!name || !sku) return res.status(400).json({ error: 'Name and SKU are required' });
    
    const existingResult = await db.query('SELECT id FROM products WHERE sku = $1', [sku]);
    if (existingResult.rows.length > 0) return res.status(400).json({ error: 'SKU already exists' });
    
    const packSize = itemsPerUnit || items_per_unit || '';

    const insertResult = await db.query(`
      INSERT INTO products (name, category_id, sku, barcode, unit, items_per_unit, ss_price, distributor_price, retail_price, mrp, min_stock)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      name, categoryId || 2, sku, barcode || '', unit || 'PCS', packSize,
      ssPrice || 0, distributorPrice || 0, retailPrice || 0, mrp || 0, 
      minStock || 10
    ]);
    
    const newProductId = insertResult.rows[0].id;
    
    // Initialize stock for all existing users using a PostgreSQL bulk insert
    const usersResult = await db.query('SELECT id FROM users');
    const users = usersResult.rows;

    if (users.length > 0) {
      let valuesClause = [];
      let queryParams = [];
      let index = 1;

      users.forEach(u => {
        const qty = u.id === req.user.id ? (parseInt(initialStock, 10) || 0) : 0;
        valuesClause.push(`($${index++}, $${index++}, $${index++})`);
        queryParams.push(u.id, newProductId, qty);
      });

      await db.query(
        `INSERT INTO stock (user_id, product_id, quantity) VALUES ${valuesClause.join(', ')}`,
        queryParams
      );
    }
    
    res.status(201).json({ id: newProductId, message: 'Product created successfully' });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product (Admin only)
router.put('/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const productId = req.params.id;
    const { 
      name, categoryId, category_id, sku, barcode, unit, itemsPerUnit, items_per_unit,
      ssPrice, ss_price, distributorPrice, distributor_price, 
      retailPrice, retail_price, mrp, minStock, min_stock 
    } = req.body;

    const catId = category_id || categoryId || 2;
    const sPrice = ss_price || ssPrice || 0;
    const dPrice = distributor_price || distributorPrice || 0;
    const rPrice = retail_price || retailPrice || 0;
    const itemMrp = mrp || 0;
    const mStock = min_stock || minStock || 10;
    const itemBarcode = barcode || '';
    const itemUnit = unit || 'PCS';
    const packSize = itemsPerUnit || items_per_unit || '';

    await db.query(
      `UPDATE products 
       SET name = $1, category_id = $2, sku = $3, barcode = $4, unit = $5, items_per_unit = $6, ss_price = $7, distributor_price = $8, retail_price = $9, mrp = $10, min_stock = $11 
       WHERE id = $12`,
      [name, catId, sku, itemBarcode, itemUnit, packSize, sPrice, dPrice, rPrice, itemMrp, mStock, productId]
    );

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

module.exports = router;