/**
 * i18n.js - Internationalization Configuration
 *
 * Configures i18next for multi-language support (Hebrew/English).
 * Uses file-system backend to load translations from /locales folder.
 *
 * Configuration:
 * - fallbackLng: 'he' - Hebrew is default language
 * - supportedLngs: ['he', 'en'] - Hebrew and English supported
 * - Translation files: /locales/{lng}/translations.json
 *
 * Language Detection (in order of priority):
 * 1. accept-language HTTP header
 * 2. i18next cookie
 * 3. lng query parameter
 *
 * Exports:
 * - i18next: Configured i18next instance
 * - middleware: HTTP middleware for Express integration
 */

const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const path = require('path');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'he',
    supportedLngs: ['he', 'en'],
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },
    detection: {
      order: ['header', 'cookie', 'querystring'],
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      caches: ['cookie']
    },
    ns: ['translations'],
    defaultNS: 'translations',
  });

module.exports = { i18next, middleware };