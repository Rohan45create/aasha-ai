import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (isLoading) => set({ isLoading }),

  // Computed-style getters
  get ashaId() { return get().user?.uid || null; },
  get headId() {
    const { user, role } = get();
    if (!user) return null;
    return (role === 'asha_head' || role === 'admin') ? user.uid : null;
  },
}));
