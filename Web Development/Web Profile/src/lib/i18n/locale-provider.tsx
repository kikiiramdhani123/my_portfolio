"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { dictionary, type Locale } from "./dictionary";

const STORAGE_KEY = "locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (typeof dictionary)["en"];
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    // Deliberately deferred: reading localStorage during render would
    // desync the server-rendered ("en") markup from the client's stored
    // preference and trigger a hydration mismatch. Rendering "en" first,
    // then swapping post-mount, keeps hydration consistent at the cost of
    // one extra render.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "id") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setLocaleState(stored);
    }
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: dictionary[locale] }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}

/** Resolves a `{ en, id }` localized value for the current locale. */
export function useLocalized<T>(value: { en: T; id: T }): T {
  const { locale } = useLocale();
  return value[locale];
}
