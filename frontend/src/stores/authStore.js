import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  headId: null,       // The actual Firestore doc ID for asha_heads (e.g. head_sunita_001)
  ashaId: null,       // Explicit asha ID (stored separately for ASHA workers)
  isLoading: true,

  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (isLoading) => set({ isLoading }),

  // Called after head login to persist the Firestore-resolved headId
  setHeadId: (headId) => set({ headId }),
  // Called for ASHA workers
  setAshaId: (ashaId) => set({ ashaId }),
}));
