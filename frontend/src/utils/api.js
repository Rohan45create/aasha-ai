import { auth } from '../firebase';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiFetch = async (endpoint, options = {}) => {
  const user = auth.currentUser;
  let token = '';

  if (user) {
    token = await user.getIdToken();
  }

  const defaultHeaders = {
    'Authorization': `Bearer ${token}`
  };

  // Do not set Content-Type if options.body is FormData (browser will set it with boundary)
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
    let errorMsg = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMsg = errorData.detail || errorData.message || errorMsg;
    } catch (e) {
      errorMsg = response.statusText;
    }
    throw new Error(errorMsg);
  }

  return response.json();
};
