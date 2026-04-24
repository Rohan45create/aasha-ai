import { create } from 'zustand';
import i18n from '../i18n';

export const useLanguageStore = create((set) => ({
  language: localStorage.getItem('language') || 'en',
  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    set({ language: lang });
  },
}));
