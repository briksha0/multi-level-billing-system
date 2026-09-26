const fs = require('fs');
let content = fs.readFileSync('server/routes/users.js', 'utf8');

const replacement =       let validParentId = parentId;
      
      if (req.user.role === 'ADMIN') {
        const allowedParentRoles = { 
          SS: ['ADMIN'], 
          DISTRIBUTOR: ['SS', 'ADMIN'], 
          RETAILER: ['SS', 'ADMIN', 'DISTRIBUTOR'] 
        }[role];
      
        if (!allowedParentRoles || !parentId) {
          return res.status(400).json({ error: 'A valid parent user is required' });
        }
      
        const parentResult = await db.query(
          'SELECT id, role FROM users WHERE id = $1 AND role = ANY($2)',
          [parentId, allowedParentRoles]
        );
        
        if (parentResult.rows.length === 0) {
          return res.status(400).json({ error: \\\A valid parent role (${allowedParentRoles.join(' or ')}) is required for this user\\\ });
        }
        validParentId = parentId;
      }
      else if (req.user.role === 'SS') {
        if (role === 'DISTRIBUTOR') {
          validParentId = req.user.id;
        } else if (role === 'RETAILER') {
          if (!parentId) return res.status(400).json({ error: 'Parent distributor is required' });
          const parentResult = await db.query('SELECT id, parent_id FROM users WHERE id = $1 AND role = $2', [parentId, 'DISTRIBUTOR']);
          const parent = parentResult.rows[0];
          if (!parent || parent.parent_id !== req.user.id) {
            return res.status(403).json({ error: 'Invalid parent distributor' });
          }
          validParentId = parentId;
        }
      }
      else if (req.user.role === 'DISTRIBUTOR') {
        if (role === 'RETAILER') validParentId = req.user.id;
      };

const rgx = /let validParentId = parentId;[\s\S]*?if \(req\.user\.role === 'DISTRIBUTOR'\) validParentId = req\.user\.id;/;
if (rgx.test(content)) {
   fs.writeFileSync('server/routes/users.js', content.replace(rgx, replacement));
   console.log('Successfully replaced via regex');
} else {
   console.log('Could not match target at all.');
}
