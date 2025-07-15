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
        useSuspense: false
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage']
      }
    });
}

export const useAppTranslation = () => {
  return useTranslation('common');
};

export default i18n;
