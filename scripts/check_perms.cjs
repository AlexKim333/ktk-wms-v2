const axios = require('axios');

async function check() {
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
        filters: JSON.stringify([['parent', '=', 'Material Request']]),
        fields: JSON.stringify(['name', 'role', 'read', 'write', 'create', 'submit']),
        limit_page_length: 100
      }
    });
    console.log('Custom DocPerms for Material Request:');
    console.table(res.data.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

check();
