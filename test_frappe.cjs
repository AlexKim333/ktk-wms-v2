const axios = require('axios');

(async () => {
  try {
    const frappeApi = axios.create({
      baseURL: 'http://localhost:8000',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const loginRes = await frappeApi.post('/api/method/login', {
      usr: 'Administrator',
      pwd: 'admin'
    });
    
    // Cookie from login
    const cookies = loginRes.headers['set-cookie'];
    if (cookies) {
      frappeApi.defaults.headers['Cookie'] = cookies.join('; ');
    }

    const res = await frappeApi.get('/api/resource/Stock Entry', {
      params: {
        fields: JSON.stringify(['name', 'stock_entry_type', 'docstatus', 'custom_ordering_branch', 'custom_orderer', 'custom_customer', 'posting_date', 'posting_time', 'to_warehouse', 'from_warehouse']),
        filters: JSON.stringify([['docstatus', '=', 1], ['stock_entry_type', '=', 'Material Transfer']]),
        order_by: 'creation desc',
        limit_page_length: 5
      }
    });
    
    console.log("SUCCESS:", JSON.stringify(res.data.data, null, 2));

  } catch (e) {
    console.log("FAIL:", e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message);
  }
})();
