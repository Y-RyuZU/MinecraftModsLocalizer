'use client';

import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { LanguageDetectorAsyncModule } from 'i18next';
import { APP_LANGUAGES, resolveAppLanguage } from './utils/app-language';

// Import translation files
import enCommon from '../../public/locales/en/common.json';
import jaCommon from '../../public/locales/ja/common.json';
import zhCNCommon from '../../public/locales/zh-CN/common.json';
import koCommon from '../../public/locales/ko/common.json';
import deCommon from '../../public/locales/de/common.json';
import frCommon from '../../public/locales/fr/common.json';
import esCommon from '../../public/locales/es/common.json';
import itCommon from '../../public/locales/it/common.json';
import ptBRCommon from '../../public/locales/pt-BR/common.json';
import ruCommon from '../../public/locales/ru/common.json';

const browserDetector = new LanguageDetector();
const languageDetector: LanguageDetectorAsyncModule = {
  type: 'languageDetector',
  async: true,
  init: (services, options) => browserDetector.init(services, options),
  async detect() {
    const saved = browserDetector.detect(['localStorage']);
    if (saved?.length) return resolveAppLanguage(saved);
    if (isTauri()) {
      try {
        const languages = await invoke<string[]>('get_system_languages');
        if (languages.length) return resolveAppLanguage(languages);
      } catch {
        // Browser preferences remain available if native detection fails.
      }
    }
    return resolveAppLanguage(browserDetector.detect(['navigator']));
  },
  cacheUserLanguage: (language) => browserDetector.cacheUserLanguage(language)
};

// Initialize i18next only once
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .use(languageDetector)
    .init({
      resources: {
        en: {
          common: enCommon
        },
        ja: {
          common: jaCommon
        },
        'zh-CN': {
          common: zhCNCommon
        },
        ko: {
          common: koCommon
        },
        de: {
          common: deCommon
        },
        fr: {
          common: frCommon
        },
        es: {
          common: esCommon
        },
        it: {
          common: itCommon
        },
        'pt-BR': {
          common: ptBRCommon
        },
        ru: {
          common: ruCommon
        }
      },
      fallbackLng: 'en',
      supportedLngs: APP_LANGUAGES,
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
