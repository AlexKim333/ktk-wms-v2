const axios = require('axios');

async function fix() {
  const [baseURL, apiKey, apiSecret] = process.argv.slice(2);
  const api = axios.create({
    baseURL,
    headers: {
      'Authorization': `token ${apiKey}:${apiSecret}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    // 1. Get Stock Entry Custom DocPerms for the roles
    const res = await api.get('/api/resource/Custom DocPerm', {
      params: {
        filters: JSON.stringify([['parent', '=', 'Stock Entry']]),
        fields: JSON.stringify(['name', 'role', 'submit'])
      }
    });

    const perms = res.data.data;
    for (const p of perms) {
      if (p.role === 'Branch Manager' || p.role === 'Branch Clerk') {
        if (p.submit !== 0) {
          console.log(`Updating ${p.name} for ${p.role}...`);
          await api.put(`/api/resource/Custom DocPerm/${p.name}`, { submit: 0 });
          console.log(`Successfully removed submit right for ${p.role}`);
        }
      }
    }
    console.log('Fixed permissions successfully.');
  } catch (err) {
    console.error('Error fixing permissions:', err.response ? err.response.data : err.message);
  }
}

fix();
