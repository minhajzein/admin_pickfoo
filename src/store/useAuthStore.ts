import { create } from 'zustand';
import axios from 'axios';
import api from '@/lib/axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: User | null, token?: string) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

function setTokenCookie(token: string) {
  const secure = window.location.protocol === 'https:' ? 'Secure;' : '';
  document.cookie = `admin_token=${token}; path=/; max-age=${30 * 24 * 60 * 60}; ${secure} SameSite=Lax`;
}

function clearTokenCookie() {
  document.cookie =
    'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

/** Drop legacy zustand persist blob (conflicted with admin_token). */
function clearLegacyPersistedAuth() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('admin-auth-storage');
  } catch {
    /* ignore */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,

  clearSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      clearTokenCookie();
      clearLegacyPersistedAuth();
    }
    set({ user: null, isAuthenticated: false, isInitialized: true });
  },

  setAuth: (user, token) => {
    if (typeof window !== 'undefined' && token) {
      localStorage.setItem('admin_token', token);
      setTokenCookie(token);
    }
    set({
      user,
      isAuthenticated: !!user && user.role === 'admin',
      isInitialized: true,
    });
  },

  logout: async () => {
    try {
      await api.get('/auth/logout');
    } catch {
      /* still clear local session */
    } finally {
      get().clearSession();
    }
  },

  initialize: async () => {
    if (typeof window !== 'undefined') {
      clearLegacyPersistedAuth();
    }

    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('admin_token')
        : null;

    if (!token) {
      set({ user: null, isAuthenticated: false, isInitialized: true });
      return;
    }

    try {
      const response = await api.get('/auth/me', { timeout: 8000 });
      const me = response.data?.user;
      if (response.data?.success && me?.role === 'admin') {
        set({
          user: me,
          isAuthenticated: true,
          isInitialized: true,
        });
        return;
      }
      get().clearSession();
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      // Expired or invalid token — wipe and send to login.
      if (status === 401 || status === 403) {
        get().clearSession();
        return;
      }
      // API down (502) or network: don't keep a fake logged-in state.
      set({ user: null, isAuthenticated: false, isInitialized: true });
    }
  },
}));
