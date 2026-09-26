const fs = require('fs');
let content = fs.readFileSync('server/routes/billing.js', 'utf8');

content = content.replace(
  "return buyer && buyer.role === 'SS';",
  "return buyer && ['SS', 'DISTRIBUTOR', 'RETAILER'].includes(buyer.role);"
);

content = content.replace(
  "return { status: 403, error: 'Admin can only bill to Super Stores' };",
  "return { status: 403, error: 'Admin can only bill to users within the hierarchy' };"
);

content = content.replace(
  "return { billType: 'ADMIN_TO_SS' };",
  "const buyerResult = await db.query('SELECT role FROM users WHERE id = ', [buyerId]);\n    const buyerRole = buyerResult.rows[0].role;\n    let billType = 'ADMIN_TO_SS';\n    if (buyerRole === 'DISTRIBUTOR') billType = 'ADMIN_TO_DIST';\n    if (buyerRole === 'RETAILER') billType = 'ADMIN_TO_RETAIL';\n    return { billType };"
);

fs.writeFileSync('server/routes/billing.js', content);
console.log('Fixed billing logic in backend');
