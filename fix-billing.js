const fs = require('fs');
let content = fs.readFileSync('server/routes/billing.js', 'utf8');

// 1. Fix validateBuyer
content = content.replace(
  "return buyer && buyer.role === 'SS';",
  "return buyer && ['SS', 'DISTRIBUTOR', 'RETAILER'].includes(buyer.role);"
);

// 2. Fix resolveBillType
const oldResolveBillType =   if (user.role === 'ADMIN') {
    if (!buyerId) return { status: 400, error: 'Buyer is required' };
    if (!(await validateBuyer(user.id, buyerId, user.role))) {
      return { status: 403, error: 'Admin can only bill to Super Stores' };
    }
    return { billType: 'ADMIN_TO_SS' };
  };

const newResolveBillType =   if (user.role === 'ADMIN') {
    if (!buyerId) return { status: 400, error: 'Buyer is required' };
    if (!(await validateBuyer(user.id, buyerId, user.role))) {
      return { status: 403, error: 'Admin can only bill to users within the hierarchy' };
    }
    const buyerResult = await db.query('SELECT role FROM users WHERE id = ', [buyerId]);
    const buyerRole = buyerResult.rows[0].role;
    let billType = 'ADMIN_TO_SS';
    if (buyerRole === 'DISTRIBUTOR') billType = 'ADMIN_TO_DIST';
    if (buyerRole === 'RETAILER') billType = 'ADMIN_TO_RETAIL';
    return { billType };
  };

content = content.replace(oldResolveBillType, newResolveBillType);

fs.writeFileSync('server/routes/billing.js', content);
console.log('Fixed billing logic in backend');
