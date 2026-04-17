import axios from 'axios';

const defaultBase =
  process.env.NODE_ENV === 'production'
    ? 'https://api.pickfoo.in/admin/api/v1'
    : 'http://localhost:5001/api/v1';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || defaultBase,
  withCredentials: true,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add token from localStorage if cookie is not used/blocked
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
