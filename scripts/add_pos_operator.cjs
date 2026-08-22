const axios = require('axios');

async function addPosOperatorRole() {
  const [baseURL, apiKey, apiSecret] = process.argv.slice(2);
  const api = axios.create({
    baseURL,
    headers: {
      'Authorization': `token ${apiKey}:${apiSecret}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    // 1. Create POS Operator Role
    try {
      await api.post('/api/resource/Role', { role_name: 'POS Operator' });
      console.log('Role POS Operator created.');
    } catch (e) {
      if (e.response && e.response.status === 409) {
        console.log('Role POS Operator already exists.');
      } else {
        throw e;
      }
    }

    // 2. Add POS Operator permissions (similar to Branch Clerk but with some Manager rights like sales invoice submit)
    const perms = [
      { role: 'POS Operator', parent: 'Sales Invoice', read: 1, write: 1, create: 1, submit: 1 },
      { role: 'POS Operator', parent: 'Item', read: 1 },
      { role: 'POS Operator', parent: 'Warehouse', read: 1 },
      { role: 'POS Operator', parent: 'Customer', read: 1 },
      { role: 'POS Operator', parent: 'Sales Person', read: 1 },
      { role: 'POS Operator', parent: 'Bin', read: 1 },
      { role: 'POS Operator', parent: 'Item Price', read: 1 },
      { role: 'POS Operator', parent: 'Brand', read: 1 },
      { role: 'POS Operator', parent: 'Material Request', read: 1, write: 1, create: 1, submit: 1 },
      { role: 'POS Operator', parent: 'Stock Entry', read: 1, write: 1, create: 1, submit: 0 }
    ];

    for (const perm of perms) {
      try {
        await api.post('/api/resource/Custom DocPerm', perm);
        console.log(`Added permission for POS Operator on ${perm.parent}`);
      } catch (err) {
        if (err.response && err.response.status === 409) {
          console.log(`Permission already exists for POS Operator on ${perm.parent}`);
        } else {
          console.error(`Error adding permission on ${perm.parent}:`, err.response ? err.response.data : err.message);
        }
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

addPosOperatorRole();
