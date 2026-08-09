import axios, { AxiosError } from 'axios';

const defaultBase =
  process.env.NODE_ENV === 'production'
    ? 'https://api.pickfoo.in/admin/api/v1'
    : 'http://localhost:5001/api/v1';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || defaultBase,
  withCredentials: true,
  timeout: 10000,
  // Intentionally no global Content-Type. A default of application/json makes
  // Axios JSON-serialize FormData, so multer never sees "file" and returns 400.
});

api.interceptors.request.use(
  (config) => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('admin_token')
        : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      // Omit Content-Type so the browser sets multipart/form-data + boundary.
      config.headers.set('Content-Type', false);
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (
      typeof window !== 'undefined' &&
      (status === 401 || status === 403) &&
      !window.location.pathname.startsWith('/login')
    ) {
      void import('@/store/useAuthStore').then(({ useAuthStore }) => {
        useAuthStore.getState().clearSession();
        window.location.replace('/login');
      });
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(
  err: unknown,
  fallback = 'Request failed',
): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ message?: string }>;
    const msg = ax.response?.data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    return ax.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default api;
