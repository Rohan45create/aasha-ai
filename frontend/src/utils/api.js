import { auth } from '../firebase';
import { useAuthStore } from '../stores/authStore';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const showToast = (message, type = 'info') => {
  const existing = document.getElementById('global-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'global-toast';
  toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-xl shadow-lg text-sm font-medium flex items-center space-x-2 transition-all duration-300 animate-slide-down ${
    type === 'error' ? 'bg-[#FCEBEB] text-[#791F1F] border border-[#E24B4A]' : 'bg-[#EAF3DE] text-[#085041] border border-[#1D9E75]'
  }`;
  toast.innerHTML = `<span class="material-symbols-outlined text-[18px]">${type === 'error' ? 'error' : 'info'}</span><span>${message}</span>`;
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

export const apiFetch = async (endpoint, options = {}) => {
  const user = auth.currentUser;
  let token = '';

  if (user) {
    token = await user.getIdToken();
  }

  const defaultHeaders = {
    'Authorization': `Bearer ${token}`
  };

  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  if (!response.ok) {
    if (response.status === 429) {
      showToast("Too many requests — please wait a moment.", "error");
    }

    let errorMsg = 'An error occurred';
    let errorCode = null;
    try {
      const errorData = await response.json();
      const detail = errorData.detail;
      if (detail && typeof detail === 'object') {
        errorMsg = detail.message || errorMsg;
        errorCode = detail.code;
      } else {
        errorMsg = detail || errorData.message || errorMsg;
        errorCode = errorData.code;
      }
    } catch (e) {
      errorMsg = response.statusText;
    }

    if (errorCode === 'PROFILE_NOT_FOUND') {
      useAuthStore.getState().logout();
      showToast("Account not found. Please contact your supervisor.", "error");
    }

    const err = new Error(errorMsg);
    err.code = errorCode;
    throw err;
  }

  return response.json();
};

export const resolveIdentity = async (idToken) => {
  const response = await fetch(`${BASE_URL}/api/admin/auth/resolve-identity`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    let errorData = {};
    try { errorData = await response.json(); } catch (e) {}
    const detail = errorData.detail || {};
    const err = new Error(detail.message || 'Identity resolution failed');
    err.code = detail.code || 'UNKNOWN_ERROR';
    throw err;
  }

  return response.json();
};
