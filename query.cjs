const axios = require('axios');
axios.post('http://localhost:8000/api/method/login', {usr: 'Administrator', pwd: 'admin'})
.then(res => axios.get('http://localhost:8000/api/resource/Item?limit_page_length=100&filters=[["item_code", "like", "P-160%"]]', {headers: {'Cookie': res.headers['set-cookie'].join('; ')}}))
.then(r => console.log(r.data.data.map(i => i.name)));
