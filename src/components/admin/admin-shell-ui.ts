/**
 * Tiny external store for admin chrome (sidebar / mobile drawer).
 * Keeps shell toggles from re-rendering the active page under <body>.
 */
import { useSyncExternalStore } from "react";

type AdminShellUiState = {
  sidebarOpen: boolean;
  mobileOpen: boolean;
  pendingHref: string | null;
};

let state: AdminShellUiState = {
  sidebarOpen: true,
  mobileOpen: false,
  pendingHref: null,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const adminShellUi = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): AdminShellUiState {
    return state;
  },
  set(partial: Partial<AdminShellUiState>) {
    state = { ...state, ...partial };
    emit();
  },
  toggleSidebar() {
    state = { ...state, sidebarOpen: !state.sidebarOpen };
    emit();
  },
  openMobile() {
    state = { ...state, mobileOpen: true };
    emit();
  },
  closeMobile() {
    if (!state.mobileOpen) return;
    state = { ...state, mobileOpen: false };
    emit();
  },
  setPendingHref(href: string | null) {
    if (state.pendingHref === href) return;
    state = { ...state, pendingHref: href };
    emit();
  },
};

export function useAdminShellUi(): AdminShellUiState {
  return useSyncExternalStore(
    adminShellUi.subscribe,
    adminShellUi.getSnapshot,
    adminShellUi.getSnapshot,
  );
}
