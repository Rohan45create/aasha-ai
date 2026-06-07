import { create } from 'zustand';
import { auth } from '../firebase';
import { resolveIdentity, showToast } from '../utils/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  docId: null,
  headId: null,       // Kept for backward compatibility
  ashaId: null,       // Kept for backward compatibility
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (isLoading) => set({ isLoading }),
  setHeadId: (headId) => set({ headId }),
  setAshaId: (ashaId) => set({ ashaId }),

  handleFirebaseLogin: async (firebaseUser, navigate) => {
    set({ isLoading: true });
    try {
      if (!firebaseUser) {
        get().logout();
        return;
      }
      
      const token = await firebaseUser.getIdToken();
      const identity = await resolveIdentity(token);

      const docId = identity.doc_id;
      const role = identity.role;

      set({
        user: firebaseUser,
        docId: docId,
        role: role,
        headId: role === 'asha_head' ? docId : null,
        ashaId: role === 'asha_worker' ? docId : null,
        isAuthenticated: true,
        isLoading: false
      });

      if (role === 'asha_head') {
        navigate('/admin/dashboard');
      } else {
        navigate('/asha/home');
      }

    } catch (err) {
      if (err.code === 'PROFILE_NOT_FOUND') {
        showToast("Account not found. Please contact your supervisor.", "error");
      } else {
        showToast("Login failed. Please try again.", "error");
      }
      await get().logout();
    }
  },

  logout: async () => {
    try {
      await auth.signOut();
    } catch (e) {}
    set({
      user: null,
      role: null,
      docId: null,
      headId: null,
      ashaId: null,
      isAuthenticated: false,
      isLoading: false
    });
  }
}));
