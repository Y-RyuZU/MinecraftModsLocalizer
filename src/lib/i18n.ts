import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from '../../public/locales/en/common.json';
import jaCommon from '../../public/locales/ja/common.json';

// Initialize i18next
i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .use(LanguageDetector) // detect user language
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
      escapeValue: false // react already safes from xss
    }
  });

export const useAppTranslation = () => {
  return useTranslation('common');
};

export default i18n;
