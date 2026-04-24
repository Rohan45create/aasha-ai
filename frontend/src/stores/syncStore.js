import { create } from 'zustand';

export const useSyncStore = create((set) => ({
  isOnline: navigator.onLine,
  pendingCount: 0,
  syncStatus: navigator.onLine ? 'green' : 'red', // green, amber, red
  setOnline: (status) => set({ isOnline: status, syncStatus: status ? (useSyncStore.getState().pendingCount > 0 ? 'amber' : 'green') : 'red' }),
  setPendingCount: (count) => set({ pendingCount: count, syncStatus: !useSyncStore.getState().isOnline ? 'red' : (count > 0 ? 'amber' : 'green') }),
}));

window.addEventListener('online', () => useSyncStore.getState().setOnline(true));
window.addEventListener('offline', () => useSyncStore.getState().setOnline(false));
