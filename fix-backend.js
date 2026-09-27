const fs = require('fs');
let content = fs.readFileSync('server/routes/billing.js', 'utf8');

// The file currently has a corrupted block:
// // In server/routes/billing.js
// router.get('/', authenticateToken, async (dbQuery, res) => {
// ...
// });

// We want to replace everything from "// In server/routes/billing.js" to the end of the second "router.get('/', async (req, res) => {" block.

const brokenRouteRegex = /\/\/\s*In server\/routes\/billing\.js[\s\S]*?router\.get\('\/', authenticateToken, async \(dbQuery, res\) => \{[\s\S]*?\}\);/g;

content = content.replace(brokenRouteRegex, '');

const oldRouteRegex = /\/\/\s*Get bills \(sales or purchases\)[\s\S]*?router\.get\('\/', async \(req, res\) => \{[\s\S]*?res\.json\(result\.rows\);\s*\}\s*catch\s*\(err\)\s*\{\s*console\.error\('Error fetching bills:', err\);\s*res\.status\(500\)\.json\(\{ error: 'Failed to fetch bills' \}\);\s*\}\s*\}\);/g;

const newRoute = // Get bills (sales or purchases) or ALL for admin
router.get('/', async (req, res) => {
  try {
    const { type = 'sales', limit = 100 } = req.query;
    const userId = req.user.id;
    const limitInt = parseInt(limit, 10);

    let result;
    if (req.user.role === 'ADMIN') {
      result = await db.query(\
        SELECT b.*, 
          buyer.name as buyer_name, buyer.username as buyer_username, buyer.role as buyer_role,
          seller.name as seller_name, seller.username as seller_username, seller.role as seller_role
        FROM bills b
        LEFT JOIN users buyer ON b.buyer_id = buyer.id
        LEFT JOIN users seller ON b.seller_id = seller.id
        ORDER BY b.created_at DESC
        LIMIT 
      \, [limitInt]);
    } else if (type === 'sales') {
      result = await db.query(\
        SELECT b.*, 
          buyer.name as buyer_name, buyer.username as buyer_username, buyer.role as buyer_role
        FROM bills b
        LEFT JOIN users buyer ON b.buyer_id = buyer.id
        WHERE b.seller_id = 
        ORDER BY b.created_at DESC
        LIMIT 
      \, [userId, limitInt]);
    } else {
      result = await db.query(\
        SELECT b.*,
          seller.name as seller_name, seller.username as seller_username
        FROM bills b
        JOIN users seller ON b.seller_id = seller.id
        WHERE b.buyer_id = 
        ORDER BY b.created_at DESC
        LIMIT 
      \, [userId, limitInt]);
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching bills:', err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});;

content = content.replace(oldRouteRegex, newRoute);

fs.writeFileSync('server/routes/billing.js', content);
console.log('Backend billing.js fixed');
