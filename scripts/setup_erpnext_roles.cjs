const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Usage: node scripts/setup_erpnext_roles.js <url> <api_key> <api_secret>

async function setup() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node setup_erpnext_roles.js <url> <api_key> <api_secret>');
    process.exit(1);
  }

  const [baseURL, apiKey, apiSecret] = args;
  
  const api = axios.create({
    baseURL,
    headers: {
      'Authorization': `token ${apiKey}:${apiSecret}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  const roles = ['Branch Manager', 'Branch Clerk'];
  
  for (const roleName of roles) {
    try {
      await api.post('/api/resource/Role', { role_name: roleName });
      console.log(`Created Role: ${roleName}`);
    } catch (e) {
      if (e.response && e.response.status === 409) {
        console.log(`Role ${roleName} already exists.`);
      } else {
        console.error(`Error creating role ${roleName}:`, e.response ? e.response.data : e.message);
      }
    }
  }

  const permissions = [
    { role: 'Branch Manager', parent: 'Stock Entry', read: 1, write: 1, create: 1, submit: 0 },
    { role: 'Branch Clerk', parent: 'Stock Entry', read: 1, write: 0, create: 0, submit: 0 },
    { role: 'Branch Manager', parent: 'Material Request', read: 1, write: 1, create: 1, submit: 1 },
    { role: 'Branch Clerk', parent: 'Material Request', read: 1, write: 0, create: 0, submit: 0 },
    { role: 'Branch Manager', parent: 'User', read: 1, write: 1, create: 1, submit: 0 },
    // Basic read permissions
    { role: 'Branch Manager', parent: 'Item', read: 1 },
    { role: 'Branch Clerk', parent: 'Item', read: 1 },
    { role: 'Branch Manager', parent: 'Warehouse', read: 1 },
    { role: 'Branch Clerk', parent: 'Warehouse', read: 1 },
    { role: 'Branch Manager', parent: 'Customer', read: 1 },
    { role: 'Branch Clerk', parent: 'Customer', read: 1 },
    { role: 'Branch Manager', parent: 'Sales Person', read: 1 },
    { role: 'Branch Clerk', parent: 'Sales Person', read: 1 },
    { role: 'Branch Manager', parent: 'Bin', read: 1 },
    { role: 'Branch Clerk', parent: 'Bin', read: 1 },
    { role: 'Branch Manager', parent: 'Item Price', read: 1 },
    { role: 'Branch Clerk', parent: 'Item Price', read: 1 },
    { role: 'Branch Manager', parent: 'Brand', read: 1 },
    { role: 'Branch Clerk', parent: 'Brand', read: 1 }
  ];

  for (const perm of permissions) {
    try {
      // Create Custom DocPerm
      await api.post('/api/resource/Custom DocPerm', perm);
      console.log(`Added permission for ${perm.role} on ${perm.parent}`);
    } catch (e) {
      if (e.response && e.response.status === 409) {
        console.log(`Permission for ${perm.role} on ${perm.parent} may already exist (Conflict).`);
      } else {
        console.error(`Error adding permission for ${perm.role} on ${perm.parent}:`, e.response ? e.response.data : e.message);
      }
    }
  }

  console.log('Setup complete. Please verify in ERPNext backend.');
}

setup();
