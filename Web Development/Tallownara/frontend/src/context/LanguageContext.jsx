import { createContext, useContext, useState, useCallback } from 'react';
import TRANSLATIONS from '../i18n/translations';

const STORAGE_KEY = 'tallownara_lang';
const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'en'
  );

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    document.documentElement.lang = newLang;
    document.title = newLang === 'id'
      ? 'Tallownara \u2014 Skincare & Obat Tallow Murni'
      : 'Tallownara \u2014 Pure Tallow Skincare & Medicine';
  }, []);

  const t = useCallback((key) => {
    const dict = TRANSLATIONS[lang];
    return dict?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
  }, [lang]);

  const tHtml = useCallback((key) => {
    const dict = TRANSLATIONS[lang];
    return dict?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tHtml }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
