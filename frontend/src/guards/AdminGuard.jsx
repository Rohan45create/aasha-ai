import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function AdminGuard({ children }) {
  const { role, isLoading } = useAuthStore();
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-[#085041]"><span className="material-symbols-outlined animate-spin text-5xl text-[#EAF3DE]">refresh</span></div>;
  }
  if (role !== 'asha_head' && role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
