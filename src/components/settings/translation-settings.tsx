"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig } from "@/lib/types/config";
import { useAppTranslation } from "@/lib/i18n";
import { SupportedLanguage, DEFAULT_LANGUAGES } from "@/lib/types/llm";
import { TargetLanguageDialog } from "./target-language-dialog";

interface TranslationSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

export function TranslationSettings({ config, setConfig }: TranslationSettingsProps) {
  const { t } = useAppTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Handle target language change
  const handleTargetLanguageChange = (languageId: string) => {
    config.translation.targetLanguage = languageId;
    setConfig({ ...config });
  };

  // Handle adding additional language
  const handleAddLanguage = (language: SupportedLanguage) => {
    if (!config.translation.additionalLanguages) {
      config.translation.additionalLanguages = [];
    }
    config.translation.additionalLanguages.push(language);
    setConfig({ ...config });
  };

  // Handle removing additional language
  const handleRemoveLanguage = (languageId: string) => {
    if (config.translation.additionalLanguages) {
      config.translation.additionalLanguages = config.translation.additionalLanguages.filter(
        (lang) => lang.id !== languageId
      );
      setConfig({ ...config });
    }
  };

  // Get all available languages (default + additional)
  const allLanguages = [...DEFAULT_LANGUAGES, ...(config.translation.additionalLanguages || [])];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Translation Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Target Language Settings */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.targetLanguage')}</label>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline"
                onClick={() => setDialogOpen(true)}
              >
                {t('settings.manageTargetLanguage')}
              </Button>
            </div>
          </div>

          {/* Other Translation Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resource Pack Name</label>
              <Input 
                value={config.translation.resourcePackName}
                onChange={(e) => {
                  config.translation.resourcePackName = e.target.value;
                  setConfig({ ...config });
                }}
                placeholder="Enter resource pack name"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Mod Chunk Size</label>
              <Input 
                type="number"
                value={config.translation.modChunkSize}
                onChange={(e) => {
                  config.translation.modChunkSize = parseInt(e.target.value);
                  setConfig({ ...config });
                }}
                placeholder="Enter chunk size"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Quest Chunk Size</label>
              <Input 
                type="number"
                value={config.translation.questChunkSize}
                onChange={(e) => {
                  config.translation.questChunkSize = parseInt(e.target.value);
                  setConfig({ ...config });
                }}
                placeholder="Enter chunk size"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Guidebook Chunk Size</label>
              <Input 
                type="number"
                value={config.translation.guidebookChunkSize}
                onChange={(e) => {
                  config.translation.guidebookChunkSize = parseInt(e.target.value);
                  setConfig({ ...config });
                }}
                placeholder="Enter chunk size"
              />
            </div>
          </div>
        </div>
      </CardContent>
      
      <TargetLanguageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        additionalLanguages={config.translation.additionalLanguages || []}
        onAddLanguage={handleAddLanguage}
        onRemoveLanguage={handleRemoveLanguage}
        targetLanguage={config.translation.targetLanguage}
        onTargetLanguageChange={handleTargetLanguageChange}
      />
    </Card>
  );
}