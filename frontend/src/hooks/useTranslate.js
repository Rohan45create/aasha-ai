/**
 * useTranslate — transparent UI translation hook
 *
 * Usage:
 *   const { t, tReady } = useTranslate();
 *   <p>{t('Save Record')}</p>
 *
 * - Returns text as-is for English (no API call)
 * - For Marathi/Hindi: checks i18n JSON first, then localStorage cache,
 *   then calls Cloud Translation API via backend
 * - NEVER writes to Firestore or any database
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../stores/languageStore';
import { useAuthStore } from '../stores/authStore';

// ── In-memory cache per language (survives component re-renders within session)
const _memCache = {};   // { "mr:Save Record": "जतन करा", ... }

// ── Pending batch queue (collect strings over a tick before sending in one request)
let _batchQueue = [];
let _batchTimer = null;
const _batchCallbacks = {};  // key -> resolve functions

function getCacheKey(lang, text) {
  return `${lang}:${text}`;
}

function readFromLocalStorage(lang, text) {
  const key = getCacheKey(lang, text);
  if (_memCache[key] !== undefined) return _memCache[key];
  try {
    const stored = localStorage.getItem(`ashaai_tx:${key}`);
    if (stored) {
      _memCache[key] = stored;
      return stored;
    }
  } catch (_) {}
  return null;
}

function writeToLocalStorage(lang, text, translated) {
  const key = getCacheKey(lang, text);
  _memCache[key] = translated;
  try {
    localStorage.setItem(`ashaai_tx:${key}`, translated);
  } catch (_) {}
}

// Flush batch to backend
async function flushBatch(lang, getToken) {
  const batch = [..._batchQueue];
  _batchQueue = [];
  _batchTimer = null;

  if (batch.length === 0) return;

  const uniqueTexts = [...new Set(batch)];
  const callbacks = {};
  uniqueTexts.forEach(t => {
    callbacks[t] = _batchCallbacks[t] || [];
    delete _batchCallbacks[t];
  });

  try {
    const token = await getToken();
    const res = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/translate/batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          texts: uniqueTexts,
          target_language: lang,
          source_language: 'en',
        }),
      }
    );

    if (!res.ok) throw new Error(`Translation API ${res.status}`);
    const data = await res.json();

    data.translations.forEach(({ original, translated }) => {
      writeToLocalStorage(lang, original, translated);
      (callbacks[original] || []).forEach(resolve => resolve(translated));
    });
  } catch (err) {
    console.warn('[useTranslate] batch failed:', err.message);
    // Resolve with original text on error
    uniqueTexts.forEach(t => {
      (callbacks[t] || []).forEach(resolve => resolve(t));
    });
  }
}

// ── The main hook ────────────────────────────────────────────────────────────────
export function useTranslate() {
  const { t: i18nT, i18n } = useTranslation();
  const { language } = useLanguageStore();
  const { user } = useAuthStore();

  const getToken = useCallback(async () => {
    return user ? await user.getIdToken() : '';
  }, [user]);

  /**
   * t(text, i18nKey?)
   *
   * @param {string} text      - The English text to display
   * @param {string} [i18nKey] - Optional i18n JSON key (e.g. 'save', 'home')
   *
   * Returns the translated string synchronously from cache,
   * OR the original text while an async API call happens in background.
   * Components using this will re-render when the translation arrives
   * IF they subscribe to translationStore — for simple use, the cache
   * will be populated on next render.
   */
  const t = useCallback((text, i18nKey) => {
    // English — return as is
    if (language === 'en' || !text) return text;

    // 1. Try i18n JSON key (pre-translated strings)
    if (i18nKey) {
      const fromJson = i18nT(i18nKey);
      if (fromJson && fromJson !== i18nKey) return fromJson;
    }

    // 2. Try cache
    const cached = readFromLocalStorage(language, text);
    if (cached !== null) return cached;

    // 3. Enqueue for batch API call
    if (!_batchCallbacks[text]) {
      _batchCallbacks[text] = [];
      _batchQueue.push(text);
    }

    // Debounce: collect all t() calls over a 50ms tick, then send one batch request
    clearTimeout(_batchTimer);
    _batchTimer = setTimeout(() => flushBatch(language, getToken), 50);

    return text; // Return original while async call in flight
  }, [language, i18nT, getToken]);

  /**
   * tAsync(text) — async version that always resolves with translation
   * Use for critical strings where you can afford to await
   */
  const tAsync = useCallback(async (text) => {
    if (language === 'en' || !text) return text;

    const cached = readFromLocalStorage(language, text);
    if (cached !== null) return cached;

    return new Promise((resolve) => {
      if (!_batchCallbacks[text]) {
        _batchCallbacks[text] = [];
        _batchQueue.push(text);
      }
      _batchCallbacks[text].push(resolve);
      clearTimeout(_batchTimer);
      _batchTimer = setTimeout(() => flushBatch(language, getToken), 50);
    });
  }, [language, getToken]);

  /**
   * clearCache() — wipe translation cache for the current language
   * (useful after language switch to re-fetch)
   */
  const clearCache = useCallback(() => {
    Object.keys(_memCache).forEach(k => {
      if (k.startsWith(`${language}:`)) delete _memCache[k];
    });
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(`ashaai_tx:${language}:`))
        .forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  }, [language]);

  return { t, tAsync, clearCache, language };
}
