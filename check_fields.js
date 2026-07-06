const token = 'token b39ba33d40f563a:7e9584e88666381';
const url = 'https://ktkpos.frappe.cloud/api/resource/Custom Field?filters=[["dt","=","Stock Entry"]]&limit_page_length=0';

fetch(url, { headers: { 'Authorization': token } })
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data.data, null, 2)))
  .catch(err => console.error(err));
