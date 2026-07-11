const axios = require('axios');

async function testSalesInvoice() {
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

    // We will try to create a Draft Sales Invoice to see if it allows it.
    // P-160-NEGRO is likely an item with 0 valuation rate.
    const siData = {
      docstatus: 0,
      customer: 'YIMAI', // assuming YIMAI exists from previous context
      update_stock: 1,
      set_posting_time: 1,
      items: [
        {
          item_code: 'P-160-NEGRO',
          qty: 1,
          rate: 100, // Selling price
          warehouse: 'ALARCON - K' // assuming ALARCON - K exists
        }
      ]
    };

    console.log("Submitting Sales Invoice draft...");
    const res = await frappeApi.post('/api/resource/Sales Invoice', siData);
    console.log("Success! SI created:", res.data.data.name);

    // Now try to submit it to see if it throws a valuation error.
    console.log("Attempting to submit SI...");
    const submitRes = await frappeApi.put(`/api/resource/Sales Invoice/${res.data.data.name}`, { docstatus: 1 });
    console.log("Success! SI submitted.");
    
  } catch (err) {
    if (err.response) {
      console.error("ERPNext Error:", err.response.status, err.response.statusText);
      console.error("Error Details:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("Error:", err.message);
    }
  }
}

testSalesInvoice();
