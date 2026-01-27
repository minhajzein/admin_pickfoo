import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      setAuth: (user, token) => {
        if (token) localStorage.setItem('admin_token', token);
        set({ user, isAuthenticated: !!user });
      },
      logout: async () => {
        try {
          await api.get('/auth/logout');
        } finally {
          localStorage.removeItem('admin_token');
          set({ user: null, isAuthenticated: false });
        }
      },
      initialize: async () => {
        try {
          const response = await api.get('/auth/me');
          if (response.data.success) {
            set({ user: response.data.user, isAuthenticated: true, isInitialized: true });
          } else {
            set({ user: null, isAuthenticated: false, isInitialized: true });
          }
        } catch {
          set({ user: null, isAuthenticated: false, isInitialized: true });
        }
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
