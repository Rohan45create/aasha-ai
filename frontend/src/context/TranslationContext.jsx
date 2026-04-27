/**
 * TranslationContext + TranslationProvider
 *
 * Wraps the app. When the user switches language (EN → मराठी / हिंदी):
 *   1. All components using useTx() immediately get the new language function.
 *   2. Any string not in the i18n JSON → queued → sent as one batch to
 *      POST /api/translate/batch  →  cached in localStorage
 *   3. Once the API responds, every consumer auto re-renders.
 *   4. NEVER writes to Firestore or any database.
 *
 * Usage in any component:
 *   import { useTx } from '../../context/TranslationContext';
 *   const tx = useTx();
 *   <p>{tx('Save Record')}</p>
 *   <button>{tx('Submit', 'save')}</button>  ← second arg = i18n JSON key
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useLanguageStore } from '../stores/languageStore';
import { useAuthStore } from '../stores/authStore';
import i18n from '../i18n';

// ── localStorage-backed cache ─────────────────────────────────────────────────
const _mem = {};   // in-memory layer; { "mr\x00Save": "जतन करा" }

function cacheKey(lang, text) { return `${lang}\x00${text}`; }

function getCache(lang, text) {
  const k = cacheKey(lang, text);
  if (_mem[k] !== undefined) return _mem[k];
  try {
    const v = localStorage.getItem(`_tx:${k}`);
    if (v !== null) { _mem[k] = v; return v; }
  } catch (_) {}
  return null;
}

function setCache(lang, text, translated) {
  const k = cacheKey(lang, text);
  _mem[k] = translated;
  try { localStorage.setItem(`_tx:${k}`, translated); } catch (_) {}
}

// ── Context ────────────────────────────────────────────────────────────────────
const TranslationContext = createContext(() => '');

export function TranslationProvider({ children }) {
  const { language } = useLanguageStore();
  const { user } = useAuthStore();

  // ── We store translations as state so React re-renders consumers on API response
  const [translations, setTranslations] = useState({});  // { cacheKey: translatedText }

  // Refs for stable async access
  const langRef = useRef(language);
  const userRef = useRef(user);
  const queueRef = useRef(new Set());
  const timerRef = useRef(null);

  useEffect(() => { langRef.current = language; }, [language]);
  useEffect(() => { userRef.current = user; }, [user]);

  // When language changes, reset translations state for new language
  useEffect(() => {
    queueRef.current.clear();
    clearTimeout(timerRef.current);
  }, [language]);

  // ── Flush batch to backend ─────────────────────────────────────────────────
  const flushBatch = useCallback(async () => {
    const lang = langRef.current;
    const texts = [...queueRef.current];
    queueRef.current.clear();
    timerRef.current = null;

    if (!texts.length || lang === 'en') return;

    try {
      const token = userRef.current ? await userRef.current.getIdToken() : '';
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/translate/batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ texts, target_language: lang, source_language: 'en' }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Write to cache + state — state update triggers re-render of all consumers
      const newEntries = {};
      data.translations.forEach(({ original, translated }) => {
        setCache(lang, original, translated);
        newEntries[cacheKey(lang, original)] = translated;
      });

      // Merge into translations state → re-renders tx consumers
      setTranslations(prev => ({ ...prev, ...newEntries }));
    } catch (err) {
      console.warn('[Translation] batch error:', err.message);
    }
  }, []);

  // ── tx — the function passed to all consumers ─────────────────────────────
  // Depends on `language` and `translations` so consumers re-render when either changes
  const tx = useCallback((text, i18nKey) => {
    if (!text) return text;
    const lang = langRef.current;

    // English — no-op
    if (lang === 'en') return text;

    // 1. i18n JSON key (static pre-translated strings)
    if (i18nKey) {
      const v = i18n.t(i18nKey);
      if (v && v !== i18nKey) return v;
    }

    // 2. Cache hit (mem or localStorage)
    const cached = getCache(lang, text);
    if (cached !== null) return cached;

    // 3. Also check current translations state (populated after API response)
    const stateVal = translations[cacheKey(lang, text)];
    if (stateVal) return stateVal;

    // 4. Enqueue for batch API call (debounced 60ms)
    queueRef.current.add(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushBatch, 60);

    return text; // Return original while API call is in flight
  }, [language, translations, flushBatch]);
  // ↑ `translations` dep is the key — every time API responds, `tx` gets a new
  //   reference, which React propagates to all Context consumers as a re-render.

  return (
    <TranslationContext.Provider value={tx}>
      {children}
    </TranslationContext.Provider>
  );
}

/**
 * useTx() — get the tx function in any component
 *
 * const tx = useTx();
 * <p>{tx('Today's patients')}</p>
 * <span>{tx('Save', 'save')}</span>  ← 'save' is the i18n JSON key
 */
export function useTx() {
  return useContext(TranslationContext);
}
