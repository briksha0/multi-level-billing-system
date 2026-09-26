const fs = require('fs');
let content = fs.readFileSync('server/routes/billing.js', 'utf8');

content = content.replace(
  "return res.status(500).json({ error: 'Failed to create bill and save GST records' });",
  "return res.status(500).json({ error: 'Failed to create bill: ' + err.message + ' | Stack: ' + err.stack });"
);

// There are two of them (one inside transaction, one outside)
content = content.replace(
  "return res.status(500).json({ error: 'Failed to create bill and save GST records' });",
  "return res.status(500).json({ error: 'Failed to create bill: ' + err.message + ' | Stack: ' + err.stack });"
);

fs.writeFileSync('server/routes/billing.js', content);
console.log('Updated error reporting');
