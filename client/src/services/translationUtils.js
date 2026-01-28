/**
 * translationUtils.js - Hebrew to English Translation Utilities
 *
 * Provides translation functionality for Hebrew text to other languages.
 * Used primarily for translating venue and vendor names/addresses from Google Places.
 *
 * Translation Methods (in priority order):
 * 1. Browser's built-in Translator API (if available)
 * 2. Google Translate API fallback
 *
 * Functions:
 * - containsHebrew(text): Checks if text contains Hebrew characters (Unicode range)
 * - translateText(text, targetLang): Translates Hebrew text to target language
 * - translateItem(item, targetLang): Translates venue/vendor object fields
 *   (name, formatted_address, vicinity) - preserves originals as originalX
 * - translateItems(items, targetLang): Batch translates array of items
 *
 * Usage: Import individual functions or default object with all utilities
 */

import { apiFetch } from '../utils/api';


//  Checks if text contains Hebrew characters
export const containsHebrew = (text) => {
  if (!text) return false;
  return /[\u0590-\u05FF]/.test(text);
};

//  Translates text from Hebrew to target language
export const translateText = async (text, targetLang = 'en') => {
  if (!text || targetLang === 'he') return text;
  
  if (!containsHebrew(text)) return text;
   
  try {
    if ('translator' in window && 'createTranslator' in window.translator) {
      try {
        const translator = await window.translator.createTranslator({
          sourceLanguage: 'he',
          targetLanguage: targetLang
        });
        const translation = await translator.translate(text);
        return translation;
      } catch (browserApiError) {
      }
    }
     
    const response = await apiFetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=he&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Translation API returned ${response.status}`);
    }
    
    const data = await response.json();
     
    // Parse the response structure
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0];
    }
     
  } catch (error) {
    // Translation failed
  }
   
  return text;
};

//  Translates vendor/venue object fields
export const translateItem = async (item, targetLang = 'en') => {
  if (targetLang === 'he') return item;

  const translated = { ...item };

  // Translate name
  if (item.name && containsHebrew(item.name)) {
    translated.originalName = item.name;
    translated.name = await translateText(item.name, targetLang);
  }

  // Translate formatted address
  if (item.formatted_address && containsHebrew(item.formatted_address)) {
    translated.originalFormattedAddress = item.formatted_address;
    translated.formatted_address = await translateText(
      item.formatted_address,
      targetLang
    );
  }

  // Translate vicinity (short address)
  if (item.vicinity && containsHebrew(item.vicinity)) {
    translated.originalVicinity = item.vicinity;
    translated.vicinity = await translateText(item.vicinity, targetLang);
  }

  return translated;
};

// Translates array of items (vendors/venues)

export const translateItems = async (items, targetLang = 'en') => {
  if (!items || items.length === 0 || targetLang === 'he') {
    return items;
  }

  return await Promise.all(
    items.map(item => translateItem(item, targetLang))
  );
};

const translationUtils = {
  containsHebrew,
  translateText,
  translateItem,
  translateItems
};

export default translationUtils;
