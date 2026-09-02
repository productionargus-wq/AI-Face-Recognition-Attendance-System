import axios from 'axios';

let rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
rawBaseUrl = rawBaseUrl.replace(/\/+$/, '');
if (!rawBaseUrl.endsWith('/api/v1')) {
  rawBaseUrl += '/api/v1';
}

export const API_BASE_URL = rawBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('argus_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token on 401 if unauthorized
      // localStorage.removeItem('argus_token');
    }
    return Promise.reject(error);
  }
);

export default api;