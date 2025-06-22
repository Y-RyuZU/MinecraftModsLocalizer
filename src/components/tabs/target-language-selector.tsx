'use client';

import React from 'react';
import { useTranslation } from 'next-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SupportedLanguage } from '@/lib/types/llm';
import { DEFAULT_LANGUAGES } from '@/lib/types/llm';

interface TargetLanguageSelectorProps {
  labelKey: string; // Changed prop name to indicate it's a key
  availableLanguages: SupportedLanguage[];
  selectedLanguage: string | null; // Language state
  globalLanguage: string; // Global language from config
  onLanguageChange: (language: string | null) => void; // Setter for language
}

export const TargetLanguageSelector: React.FC<TargetLanguageSelectorProps> = ({
  labelKey, // Use the new prop name
  availableLanguages, // Remove default empty array
  selectedLanguage,
  globalLanguage,
  onLanguageChange,
}) => {
  const { t } = useTranslation('common');

  // Determine the effective language to display and use
  const effectiveLanguage = selectedLanguage ?? globalLanguage;

  const handleValueChange = (value: string) => {
    // If the selected value is the same as the global default, set temp to null
    if (value === globalLanguage) {
      onLanguageChange(null);
    } else {
      onLanguageChange(value);
    }
  };


  // Generate a stable ID from the key
  const selectId = `lang-select-${labelKey.replace(/\./g, '-')}`;

  // Use the same language options as the TargetLanguageDialog
  // This includes both DEFAULT_LANGUAGES and any additional languages from the config
  // Combine default languages with available languages, ensuring no duplicates
  // Create a map to track languages by id to avoid duplicates
  const languageMap = new Map();
  
  // Add default languages first
  DEFAULT_LANGUAGES.forEach(lang => {
    languageMap.set(lang.id, lang);
  });
  
  // Add additional languages, overriding defaults if there's a duplicate id
  availableLanguages.forEach(lang => {
    languageMap.set(lang.id, lang);
  });
  
  // Convert map back to array
  const allLanguages = Array.from(languageMap.values());
  
  // Use all languages without filtering
  const languagesToDisplay = allLanguages;

  return (
      <Select
        value={effectiveLanguage}
        onValueChange={handleValueChange}
      >
        <SelectTrigger id={selectId}>
          {/* Use a more specific placeholder key */}
          <SelectValue placeholder={t('tabs.selectLanguage')} />
        </SelectTrigger>
        <SelectContent>
          {languagesToDisplay.map((lang, index) => (
            <SelectItem key={`${lang.id}-${index}`} value={lang.id}>
              {lang.name} ({lang.id})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
  );
};
