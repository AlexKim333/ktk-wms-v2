import axios from 'axios';

const frappeApi = axios.create({
  baseURL: '', 
  withCredentials: true, 
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

export default frappeApi;