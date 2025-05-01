// import i18n from 'i18next';
// import { initReactI18next } from 'react-i18next';
// import LanguageDetector from 'i18next-browser-languagedetector';
// import Backend from 'i18next-http-backend';

// // אתחול i18next
// i18n
//   // שימוש בבאקאנד לטעינת קבצי תרגום
//   .use(Backend)
//   // זיהוי אוטומטי של שפת הדפדפן
//   .use(LanguageDetector)
//   // אינטגרציה עם React
//   .use(initReactI18next)
//   // אתחול i18next
//   .init({
//     // שפת ברירת המחדל
//     fallbackLng: 'he',
//     // שפה ראשונית (ניתן לשנות על פי בחירת המשתמש)
//     lng: localStorage.getItem('language') || 'he',
//     // מרחב שמות לקבצי התרגום
//     ns: ['translations'],
//     defaultNS: 'translations',
//     // הגדרות קבצי השפה
//     backend: {
//       // נתיב לקבצי השפה
//       loadPath: '/locales/{{lng}}/{{ns}}.json',
//     },
//     // זיהוי שפה בדפדפן
//     detection: {
//       order: ['localStorage', 'navigator'],
//       caches: ['localStorage']
//     },
//     // הגדרות אינטרפולציה
//     interpolation: {
//       escapeValue: false // אין צורך ב-escape ב-React
//     },
//     react: {
//       useSuspense: true
//     }
//   });


// export const changeLanguage = (lng) => {
//     // Change language asynchronously 
//     i18n.changeLanguage(lng).then(() => {
//       // Update DOM attributes after language is fully loaded
//       document.documentElement.dir = i18n.dir();
//       document.documentElement.lang = lng;
//     });
    
//     // Store the selected language
//     localStorage.setItem('language', lng);
//   };

// // הגדרת כיוון המסמך בעת טעינה ראשונית
// const currentLang = localStorage.getItem('language') || 'he';
// document.documentElement.dir = currentLang === 'he' ? 'rtl' : 'ltr';

// export default i18n;

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
      wait: true  // חשוב: משתמש ב-Suspense להמתנה לטעינת התרגומים
    },
    // הוספת דיבוג כדי לראות בעיות טעינה
    debug: true
  });

export const changeLanguage = (lng) => {
  return i18n.changeLanguage(lng).then(() => {
    document.documentElement.dir = i18n.dir();
    document.documentElement.lang = lng;
    localStorage.setItem('language', lng);
    console.log(`Language changed to ${lng}, direction: ${i18n.dir()}`);
    
    // מטריג רינדור מחדש של הקומפוננטות
    window.dispatchEvent(new Event('languageChanged'));
  });
};

export default i18n;