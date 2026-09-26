const fs = require('fs');
let content = fs.readFileSync('server/routes/billing.js', 'utf8');

content = content.replace(
  "case 'ADMIN_TO_SS': defaultRate = product.ss_price; break;",
  "case 'ADMIN_TO_SS': defaultRate = product.ss_price; break;\n      case 'ADMIN_TO_DIST': defaultRate = product.distributor_price; break;\n      case 'ADMIN_TO_RETAIL': defaultRate = product.retail_price; break;"
);

fs.writeFileSync('server/routes/billing.js', content);
console.log('Fixed computeBillTotals rates');
