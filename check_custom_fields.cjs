const axios = require('axios');

async function checkOrAddCustomFields() {
  try {
    const loginRes = await axios.post('http://localhost:8000/api/method/login', {
      usr: 'Administrator',
      pwd: 'admin'
    });
    
    const frappeApi = axios.create({
      baseURL: 'http://localhost:8000',
      headers: {
        'Cookie': loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'].join('; ') : '',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log("Connected to Frappe.");
    
    // Check if Custom Field exists
    const res = await frappeApi.get('/api/resource/Custom Field?filters=[["dt", "=", "Item"], ["fieldname", "=", "custom_tier_1_barcode"]]');
    if (res.data.data.length > 0) {
      console.log("Custom fields already exist.");
    } else {
      console.log("Custom fields do not exist. We can create them.");
    }

  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}

checkOrAddCustomFields();
