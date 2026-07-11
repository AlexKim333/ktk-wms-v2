const axios = require('axios');

async function testRecon() {
  try {
    const res = await axios.post('http://localhost:8000/api/method/login', {usr: 'Administrator', pwd: 'admin'});
    const frappeApi = axios.create({
      baseURL: 'http://localhost:8000',
      headers: { 'Cookie': res.headers['set-cookie'].join('; ') }
    });
    
    try {
      await frappeApi.post('/api/resource/Stock Reconciliation', {
        docstatus: 1,
        purpose: 'Stock Reconciliation',
        items: [{
          item_code: 'P-150-BLANCO',
          warehouse: 'MAIN WAREHOUSE - KTK', // or whatever valid warehouse
          qty: 10
        }]
      });
      console.log('SUCCESS');
    } catch(e) {
      console.log('RECON FAIL:', e.response ? e.response.status : e.message);
      if (e.response && e.response.data) {
        console.log(e.response.data);
      }
    }
  } catch(e) {
    console.log('LOGIN FAIL:', e.message);
  }
}
testRecon();
