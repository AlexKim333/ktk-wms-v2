const https = require('https');

const postData = JSON.stringify({
  usr: 'Administrator',
  pwd: 'admin' // If this fails, we just don't have the password.
});

const req = https.request({
  hostname: 'ktkpos.frappe.cloud',
  port: 443,
  path: '/api/method/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return console.log("Login failed");

  const queryPath = '/api/resource/Stock%20Entry?fields=["name","stock_entry_type","docstatus","from_warehouse","to_warehouse"]&filters=[["docstatus","=",1],["stock_entry_type","=","Material%20Transfer"]]&order_by=creation%20desc&limit_page_length=5';
  
  https.get({
    hostname: 'ktkpos.frappe.cloud',
    port: 443,
    path: queryPath,
    headers: {
      'Cookie': cookies.join('; ')
    }
  }, (res2) => {
    let data = '';
    res2.on('data', chunk => data += chunk);
    res2.on('end', () => console.log("DATA:", data));
  });
});

req.on('error', (e) => console.error(e));
req.write(postData);
req.end();
