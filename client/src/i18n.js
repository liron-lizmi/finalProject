/**
 * i18n.js - Client-side Internationalization Configuration
 *
 * Configures i18next for React with Hebrew/English language support.
 * Uses HTTP backend to load translations from public/locales folder.
 *
 * Configuration:
 * - fallbackLng: 'he' - Hebrew is default
 * - Loads saved language from localStorage or defaults to Hebrew
 * - Translation files: /locales/{lng}/translations.json
 * - Suspense enabled for async loading
 *
 * Language Detection Order:
 * 1. localStorage (persisted user preference)
 * 2. Browser navigator.language
 *
 * Exports:
 * - default: Configured i18n instance
 * - changeLanguage(lng): Changes language, updates dir/lang attributes, saves to localStorage
 * - toggleLanguage(): Toggles between Hebrew and English
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'he',
    lng: localStorage.getItem('language') || 'he',
    ns: ['translations'],
    defaultNS: 'translations',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: true,
    },
    debug: true
  });

export const changeLanguage = (lng) => {
  return i18n.changeLanguage(lng).then(() => {
    document.documentElement.dir = i18n.dir();
    document.documentElement.lang = lng;
    localStorage.setItem('language', lng);
    
    window.dispatchEvent(new Event('languageChanged'));
  });
};

export const toggleLanguage = () => {
  const currentLang = i18n.language;
  const newLang = currentLang === 'he' ? 'en' : 'he';
  return changeLanguage(newLang);
};

export default i18n;