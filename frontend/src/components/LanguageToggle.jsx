import { useLanguageStore } from '../stores/languageStore';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguageStore();

  return (
    <div className="flex bg-[#085041] rounded overflow-hidden">
      {['en', 'mr', 'hi'].map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`px-3 py-1 text-xs font-medium transition-colors ${language === lang ? 'bg-[#1D9E75] text-white' : 'text-[#EAF3DE] hover:bg-[#1D9E75]/50'}`}
        >
          {lang === 'en' ? 'EN' : lang === 'mr' ? 'मराठी' : 'हिंदी'}
        </button>
      ))}
    </div>
  );
}
