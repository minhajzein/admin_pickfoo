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
  /** Session check failed for network reasons; the token may still be valid. */
  connectionError: boolean;
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

let initializeInFlight: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  connectionError: false,

  clearSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      clearTokenCookie();
      clearLegacyPersistedAuth();
    }
    set({ user: null, isAuthenticated: false, isInitialized: true, connectionError: false });
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
      connectionError: false,
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
      // A stale cookie without a token would make proxy.ts bounce /login back to /.
      clearTokenCookie();
      set({ user: null, isAuthenticated: false, isInitialized: true, connectionError: false });
      return;
    }

    if (initializeInFlight) return initializeInFlight;
    initializeInFlight = (async () => {
      try {
        const response = await api.get('/auth/me', { timeout: 20000 });
        const me = response.data?.user;
        if (response.data?.success && me?.role === 'admin') {
          set({
            user: me,
            isAuthenticated: true,
            isInitialized: true,
            connectionError: false,
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
        // Slow network / API down: keep the token and let the user retry.
        // Redirecting to /login here loops with proxy.ts (cookie still set).
        set({ user: null, isAuthenticated: false, isInitialized: true, connectionError: true });
      } finally {
        initializeInFlight = null;
      }
    })();
    return initializeInFlight;
  },
}));
