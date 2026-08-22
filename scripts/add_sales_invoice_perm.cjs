const axios = require('axios');

async function addSalesInvoicePerm() {
  const [baseURL, apiKey, apiSecret] = process.argv.slice(2);
  const api = axios.create({
    baseURL,
    headers: {
      'Authorization': `token ${apiKey}:${apiSecret}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    const perm = { role: 'Branch Manager', parent: 'Sales Invoice', read: 1, write: 1, create: 1, submit: 1 };
    await api.post('/api/resource/Custom DocPerm', perm);
    console.log('Added Sales Invoice permission for Branch Manager.');
  } catch (err) {
    if (err.response && err.response.status === 409) {
      console.log('Sales Invoice permission already exists for Branch Manager.');
    } else {
      console.error('Error adding permission:', err.response ? err.response.data : err.message);
    }
  }
}

addSalesInvoicePerm();
