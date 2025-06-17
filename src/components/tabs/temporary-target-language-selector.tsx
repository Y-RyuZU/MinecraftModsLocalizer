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
import { Label } from '@/components/ui/label';
import { SupportedLanguage } from '@/lib/types/llm';
import { DEFAULT_LANGUAGES } from '@/lib/types/llm';

interface TemporaryTargetLanguageSelectorProps {
  labelKey: string; // Changed prop name to indicate it's a key
  availableLanguages: SupportedLanguage[];
  selectedLanguage: string | null; // Temporary language state
  globalLanguage: string; // Global language from config
  onLanguageChange: (language: string | null) => void; // Setter for temporary language
  sourceLanguage: string; // Source language to filter out
}

export const TemporaryTargetLanguageSelector: React.FC<TemporaryTargetLanguageSelectorProps> = ({
  labelKey, // Use the new prop name
  availableLanguages, // Remove default empty array
  selectedLanguage,
  globalLanguage,
  onLanguageChange,
  sourceLanguage,
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

  // Translate the label key here
  const translatedLabel = t(labelKey);

  // Generate a stable ID from the key
  const selectId = `temp-lang-select-${labelKey.replace(/\./g, '-')}`;

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
  
  // Filter out the source language
  const languagesToDisplay = allLanguages.filter(lang => lang.id !== sourceLanguage);

  return (
    <div className="flex flex-col space-y-1.5">
      {/* Use the translated label */}
      <Label htmlFor={selectId}>{translatedLabel}</Label>
      <Select
        value={effectiveLanguage}
        onValueChange={handleValueChange}
      >
        <SelectTrigger id={selectId}>
          {/* Use a more specific placeholder key */}
          <SelectValue placeholder={t('tabs.selectTemporaryLanguage')} />
        </SelectTrigger>
        <SelectContent>
          {languagesToDisplay.map((lang, index) => (
            <SelectItem key={`${lang.id}-${index}`} value={lang.id}>
              {lang.name} ({lang.id})
              {lang.id === globalLanguage && selectedLanguage === null && ` (${t('tabs.default')})`}
              {lang.id === selectedLanguage && ` (${t('tabs.temporary')})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
