import { useState } from 'react';
import { useLanguageStore } from '../stores/languageStore';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguageStore();
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async (lang) => {
    if (lang === language) return;
    setSwitching(true);
    setLanguage(lang);
    // Give a moment for translations to start loading, then clear spinner
    setTimeout(() => setSwitching(false), 800);
  };

  return (
    <div className="flex bg-[#085041] rounded overflow-hidden relative">
      {['en', 'mr', 'hi'].map((lang) => (
        <button
          key={lang}
          onClick={() => handleSwitch(lang)}
          disabled={switching}
          className={`px-3 py-1 text-xs font-medium transition-colors ${language === lang
              ? 'bg-[#1D9E75] text-white'
              : 'text-[#EAF3DE] hover:bg-[#1D9E75]/50 disabled:opacity-60'
            }`}
        >
          {lang === 'en' ? 'EN' : lang === 'mr' ? 'मराठी' : 'हिंदी'}
        </button>
      ))}
      {switching && (
        <span
          className="material-symbols-outlined"
          style={{
            position: 'absolute', right: '-22px', top: '50%', transform: 'translateY(-50%)',
            fontSize: '16px', color: '#EAF3DE',
            animation: 'spin 0.8s linear infinite',
          }}
        >refresh</span>
      )}
      <style>{`@keyframes spin { from { transform: translateY(-50%) rotate(0deg); } to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  );
}
