// lib/i18n.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Lang = "en" | "fr";

type Translations = {
  [key: string]: {
    en: string;
    fr: string;
  };
};

// Add keys as we internationalize more of the app
const translations: Translations = {
  "header.location_default": {
    en: "Delivering to New Glasgow B2H",
    fr: "Livraison à New Glasgow B2H",
  },
  "header.search_placeholder": {
    en: "Search for Collectables...",
    fr: "Rechercher des objets de collection...",
  },
  "header.login_button": {
    en: "Login / Sign Up",
    fr: "Connexion / Inscription",
  },
  "header.cart": {
    en: "Cart",
    fr: "Panier",
  },
  "settings.title": {
    en: "Account Settings",
    fr: "Paramètres du compte",
  },
  "settings.subtitle": {
    en: "Manage your account details, security, and preferences.",
    fr: "Gérez les détails de votre compte, la sécurité et vos préférences.",
  },
};

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Optional: remember choice in localStorage
  useEffect(() => {
    const stored = window.localStorage.getItem("collectorshub_lang");
    if (stored === "en" || stored === "fr") {
      setLangState(stored);
    }
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    window.localStorage.setItem("collectorshub_lang", next);
  };

  const t = (key: string): string => {
    const entry = translations[key];
    if (!entry) return key; // fallback: show key if missing
    return entry[lang] ?? entry.en ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside a LanguageProvider");
  }
  return ctx;
}