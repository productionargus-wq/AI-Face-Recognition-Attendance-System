import axios from 'axios';

let rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
rawBaseUrl = rawBaseUrl.replace(/\/+$/, '');
if (!rawBaseUrl.endsWith('/api/v1')) {
  rawBaseUrl += '/api/v1';
}

export const API_BASE_URL = rawBaseUrl;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('argus_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const extractErrorMessage = (err, fallback = 'An unexpected error occurred.') => {
  if (!err) return fallback;
  const detail = err.response?.data?.detail ?? err.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === 'string') return d;
        const field = Array.isArray(d?.loc) ? d.loc.filter((l) => l !== 'body').join('.') : '';
        const msg = d?.msg || JSON.stringify(d);
        return field ? `${field}: ${msg}` : msg;
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    return detail.message || detail.msg || JSON.stringify(detail);
  }
  if (typeof err === 'string' && err.trim()) return err;
  if (err.message) return err.message;
  return fallback;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.data && error.response.data.detail && typeof error.response.data.detail !== 'string') {
      error.response.data.detail = extractErrorMessage(error);
    }
    const config = error.config;
    // Auto-retry GET requests on network failures or Render spin-up 502/503/504
    const isNetworkOrGateway = !error.response || [502, 503, 504].includes(error.response?.status);
    if (config && isNetworkOrGateway && (config.method || 'get').toLowerCase() === 'get') {
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount < 3) {
        config.__retryCount += 1;
        const delay = config.__retryCount * 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(config);
      }
    }
    return Promise.reject(error);
  }
);

// Proactively warm up backend service to eliminate Render free tier cold-start delays
setTimeout(() => {
  api.get('/health').catch(() => {});
}, 100);

export default api;