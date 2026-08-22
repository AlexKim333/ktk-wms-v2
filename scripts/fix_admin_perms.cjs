const axios = require('axios');

async function fixAdminPerms() {
  const [baseURL, apiKey, apiSecret] = process.argv.slice(2);
  const api = axios.create({
    baseURL,
    headers: {
      'Authorization': `token ${apiKey}:${apiSecret}`,
      'Content-Type': 'application/json'
    }
  });

  const doctypesToFix = ['Material Request', 'Stock Entry', 'Sales Invoice', 'User'];
  const rolesToAdd = [
    { role: 'System Manager', read: 1, write: 1, create: 1, submit: 1, cancel: 1, amend: 1, delete: 1, export: 1, report: 1, share: 1, email: 1, print: 1 },
    { role: 'Stock Manager', read: 1, write: 1, create: 1, submit: 1, cancel: 1, amend: 1, delete: 1, export: 1, report: 1, share: 1, email: 1, print: 1 }
  ];

  for (const doctype of doctypesToFix) {
    for (const roleObj of rolesToAdd) {
      if (doctype === 'User' && roleObj.role === 'Stock Manager') continue; // Only System Manager needs full User rights usually
      
      const payload = {
        parent: doctype,
        parenttype: 'DocType',
        parentfield: 'permissions',
        ...roleObj
      };

      try {
        await api.post('/api/resource/Custom DocPerm', payload);
        console.log(`Added ${roleObj.role} to Custom DocPerm for ${doctype}`);
      } catch (err) {
        if (err.response && err.response.status === 409) {
          console.log(`${roleObj.role} already exists for ${doctype} (Conflict).`);
        } else {
          console.error(`Error adding ${roleObj.role} for ${doctype}:`, err.response ? err.response.data : err.message);
        }
      }
    }
  }
}

fixAdminPerms();
