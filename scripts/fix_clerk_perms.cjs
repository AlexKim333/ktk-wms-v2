const axios = require('axios');

async function fixClerk() {
  const [baseURL, apiKey, apiSecret] = process.argv.slice(2);
  const api = axios.create({
    baseURL,
    headers: {
      'Authorization': `token ${apiKey}:${apiSecret}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    const res = await api.get('/api/resource/Custom DocPerm', {
      params: {
        filters: JSON.stringify([['role', '=', 'Branch Clerk']]),
        fields: JSON.stringify(['name', 'parent', 'create', 'write', 'submit']),
        limit_page_length: 100
      }
    });

    const perms = res.data.data;
    for (const p of perms) {
      if (p.parent === 'Stock Entry' || p.parent === 'Material Request') {
        if (p.create !== 0 || p.write !== 0 || p.submit !== 0) {
          console.log(`Updating ${p.name} for Branch Clerk on ${p.parent}...`);
          await api.put(`/api/resource/Custom DocPerm/${p.name}`, { 
            create: 0, 
            write: 0, 
            submit: 0 
          });
          console.log(`Successfully removed create/write/submit right for Branch Clerk on ${p.parent}`);
        }
      }
    }
    console.log('Fixed Branch Clerk permissions successfully.');
  } catch (err) {
    console.error('Error fixing permissions:', err.response ? err.response.data : err.message);
  }
}

fixClerk();
