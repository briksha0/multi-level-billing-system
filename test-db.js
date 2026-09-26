const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'mlb_system'
});

async function testTransaction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Inserting bill...');
    const res1 = await client.query(
      INSERT INTO bills (bill_number, bill_date, seller_id, buyer_id, customer_name, bill_type, subtotal, discount, gst, grand_total, paid_amount, due_amount, payment_status, payment_method, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id,
      ['TEST-001', '2026-09-26', 1, 3, null, 'ADMIN_TO_DIST', 1000, 0, 180, 1180, 0, 1180, 'PENDING', 'Cash', 1]
    );
    const billId = res1.rows[0].id;
    console.log('Bill ID:', billId);

    console.log('Inserting bill item...');
    await client.query(
      'INSERT INTO bill_items (bill_id, product_id, quantity, rate, gst, amount) VALUES ($1, $2, $3, $4, $5, $6)',
      [billId, 1, 10, 100, 18, 1180]
    );

    console.log('Updating stock deduct...');
    await client.query(
      'UPDATE stock SET quantity = quantity - $1 WHERE user_id = $2 AND product_id = $3',
      [10, 1, 1]
    );

    console.log('Updating stock add...');
    await client.query(
      INSERT INTO stock (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = stock.quantity + $4
    , [3, 1, 10, 10]);

    console.log('Inserting stock transaction...');
    await client.query(
      'INSERT INTO stock_transactions (date, from_id, to_id, product_id, quantity, type, bill_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['2026-09-26', 1, 3, 1, 10, 'OUT', billId]
    );

    await client.query('ROLLBACK');
    console.log('Transaction SUCCESS, rolled back');
  } catch (err) {
    console.error('TRANSACTION ERROR:', err.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    pool.end();
  }
}
testTransaction();
