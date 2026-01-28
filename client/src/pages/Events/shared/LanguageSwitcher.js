/**
 * LanguageSwitcher.js - Language Toggle Component
 *
 * Simple toggle between Hebrew and English languages.
 * Dispatches 'languageChanged' event for components to react.
 *
 * Languages:
 * - he: Hebrew (עברית) - RTL
 * - en: English - LTR
 *
 * Features:
 * - Visual active state for current language
 * - Persists selection via i18n
 * - Triggers global language change event
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../../i18n';
import '../../../styles/LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (lng) => {
    changeLanguage(lng);
    window.dispatchEvent(new Event('languageChanged'));
  };

  return (
    <div className="language-switcher">
      <div className="language-options">
        <button 
          className={`language-option ${i18n.language === 'he' ? 'active' : ''}`} 
          onClick={() => handleLanguageChange('he')}
        >
          עברית
        </button>
        <button 
          className={`language-option ${i18n.language === 'en' ? 'active' : ''}`}
          onClick={() => handleLanguageChange('en')}
        >
          English
        </button>
      </div>
    </div>
  );
};

export default LanguageSwitcher;