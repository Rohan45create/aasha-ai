import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useTx } from '../context/TranslationContext';
import LanguageToggle from '../components/LanguageToggle';

export default function AdminLayout() {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const tx = useTx();

  const handleLogout = async () => {
    await signOut(auth);
  };

  const navItems = [
    { path: '/admin/dashboard', icon: 'dashboard',        labelKey: 'admin_dashboard',   label: 'Dashboard' },
    { path: '/admin/workers',   icon: 'group',             labelKey: 'worker_management', label: 'Workers' },
    { path: '/admin/referrals', icon: 'local_hospital',    labelKey: 'referrals',         label: 'NRC Referrals' },
    { path: '/admin/review',    icon: 'pending_actions',   labelKey: 'pending_review',    label: 'Pending Review' },
    { path: '/admin/builder',   icon: 'build',             labelKey: 'survey_builder',    label: 'Survey Builder' },
    { path: '/admin/map',       icon: 'map',               labelKey: 'coverage_map',      label: 'Coverage Map' },
    { path: '/admin/reports',   icon: 'description',       labelKey: 'reports',           label: 'Reports' },
  ];

  const NavContent = () => (
    <>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3 mb-2">
          {/* <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#085041] font-bold text-xl">A</div>
          <h1 className="text-2xl font-bold">AshaAI</h1> */}
          <img src='/logo.png' alt='Logo' className='w-35 rounded-full' />
        </div>
        <p className="text-sm opacity-80">{tx('Supervisor Portal')}</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-[#1D9E75] font-medium' : 'hover:bg-white/10 opacity-90'}`}
                >
                  <span className="material-symbols-outlined mr-3 text-xl">{item.icon}</span>
                  <span className="md:inline">{tx(item.label, item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="truncate flex-1">
            <p className="text-sm font-medium">{user?.displayName || 'Admin'}</p>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors ml-2 flex-shrink-0" title="Logout">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
        <div className="flex justify-center bg-black/20 rounded-xl p-1">
          <LanguageToggle />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#F1EFE8] font-sans text-[#1A1A18] overflow-hidden">
      {/* Mobile hamburger overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — hidden on mobile, visible on md+ */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 flex flex-col bg-[#085041] text-white shadow-xl transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <NavContent />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between p-4 bg-[#085041] text-white">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-lg">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="text-lg font-bold">AshaAI {tx('Admin', 'admin_dashboard')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg">
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-[#F1EFE8]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
