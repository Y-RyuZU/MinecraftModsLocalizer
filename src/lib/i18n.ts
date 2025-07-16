'use client';

import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from '../../public/locales/en/common.json';
import jaCommon from '../../public/locales/ja/common.json';

// Initialize i18next only once
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .use(LanguageDetector)
    .init({
      resources: {
        en: {
          common: enCommon
        },
        ja: {
          common: jaCommon
        }
      },
      fallbackLng: 'en',
      ns: ['common'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false
      },
      react: {
        useSuspense: false,
        // Add a check for missing translations
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor: ['br', 'strong', 'i']
      },
      // Add debug mode in development
      debug: process.env.NODE_ENV === 'development',
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage']
      }
    });
}

export const useAppTranslation = () => {
  const result = useTranslation('common');
  return result;
};

export default i18n;
