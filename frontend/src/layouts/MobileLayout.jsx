import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LanguageToggle from '../components/LanguageToggle';
import SyncStatusBar from '../components/SyncStatusBar';
import { useTranslation } from 'react-i18next';

export default function MobileLayout() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const navItems = [
    { path: '/asha/home', icon: 'home', label: t('home') },
    { path: '/asha/priority-list', icon: 'priority_high', label: t('priority_list') },
    { path: '/asha/ask', icon: 'search', label: t('ask_ai') },
    { path: '/asha/profile', icon: 'person', label: t('profile') },
  ];

  return (
    // Desktop wrapper — grey background, centres the phone UI
    <div className="min-h-screen bg-gray-200 sm:flex sm:items-start sm:justify-center sm:pt-4">
      {/* Phone container — full screen on mobile, bounded on desktop */}
      <div className="w-full sm:max-w-[430px] sm:min-h-[calc(100vh-2rem)] sm:shadow-2xl sm:rounded-2xl overflow-hidden bg-[#F1EFE8] flex flex-col relative font-sans antialiased text-[#1A1A18]">
        
        {/* Top bar */}
        <header className="flex justify-between items-center p-4 bg-[#085041] text-white shadow-md z-10 sticky top-0">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Logo" className="w-30 rounded-full" onError={(e) => { e.target.style.display='none'; }} />
            {/* <h1 className="text-xl font-bold font-['Noto_Sans']">AshaAI</h1> */}
          </div>
          <div className="flex flex-col items-end gap-1">
            <LanguageToggle />
            <SyncStatusBar />
          </div>
        </header>

        {/* Offline banner */}
        {isOffline && (
          <div className="bg-[#E24B4A] text-white text-xs font-medium px-4 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">cloud_off</span>
            Offline Mode — Changes will sync when connected
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          <Outlet />
        </main>

        {/* Bottom nav */}
        <nav className="absolute bottom-0 w-full bg-white border-t border-[#D3D1C7] flex justify-around p-2 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          {navItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
            return (
              <Link key={item.path} to={item.path} className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 ${isActive ? 'text-[#1D9E75] bg-[#EAF3DE]' : 'text-[#5F5E5A] hover:bg-gray-50'}`}>
                <span className="material-symbols-outlined mb-1">{item.icon}</span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
