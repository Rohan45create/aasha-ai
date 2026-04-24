import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function ASHAGuard({ children }) {
  const { role, isLoading } = useAuthStore();
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><span className="material-symbols-outlined animate-spin text-5xl text-[#1D9E75]">refresh</span></div>;
  }
  if (role !== 'asha_worker') {
    return <Navigate to="/login" replace />;
  }
  return children;
}
