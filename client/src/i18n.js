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
      wait: true  
    },
    debug: true
  });

export const changeLanguage = (lng) => {
  return i18n.changeLanguage(lng).then(() => {
    document.documentElement.dir = i18n.dir();
    document.documentElement.lang = lng;
    localStorage.setItem('language', lng);
    console.log(`Language changed to ${lng}, direction: ${i18n.dir()}`);
    
    window.dispatchEvent(new Event('languageChanged'));
  });
};

export const toggleLanguage = () => {
  const currentLang = i18n.language;
  const newLang = currentLang === 'he' ? 'en' : 'he';
  return changeLanguage(newLang);
};

export default i18n;