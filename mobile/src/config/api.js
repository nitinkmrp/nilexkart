import axios from 'axios';

const BASE_URL = 'https://final-project1-d3iz.onrender.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
