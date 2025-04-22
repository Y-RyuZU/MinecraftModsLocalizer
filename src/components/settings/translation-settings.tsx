"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig } from "@/lib/types/config";
import { SupportedLanguage } from "@/lib/types/llm";
import { TargetLanguageDialog } from "./target-language-dialog";
import { useAppTranslation } from "@/lib/i18n";
import { Globe } from "lucide-react";

interface TranslationSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

export function TranslationSettings({ config, setConfig }: TranslationSettingsProps) {
  const { t } = useAppTranslation();
  const [isTargetLanguageDialogOpen, setIsTargetLanguageDialogOpen] = useState(false);
  
  // Add new language
  const handleAddLanguage = (language: SupportedLanguage) => {
    // Initialize additionalLanguages array if it doesn't exist
    if (!config.translation.additionalLanguages) {
      config.translation.additionalLanguages = [];
    }
    
    // Add new language
    config.translation.additionalLanguages.push(language);
    
    // Update config
    setConfig({ ...config });
  };
  
  // Remove language
  const handleRemoveLanguage = (languageId: string) => {
    // Filter out the language to remove
    config.translation.additionalLanguages = config.translation.additionalLanguages.filter(
      lang => lang.id !== languageId
    );
    
    // Update config
    setConfig({ ...config });
  };
  
  // Change target language
  const handleTargetLanguageChange = (languageId: string) => {
    config.translation.targetLanguage = languageId;
    setConfig({ ...config });
  };
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Translation Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Source Language</label>
            <Input 
              value={config.translation.sourceLanguage}
              onChange={(e) => {
                config.translation.sourceLanguage = e.target.value;
                setConfig({ ...config });
              }}
              placeholder="e.g., en_us"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.targetLanguage')}</label>
            <div className="flex space-x-2">
              <Button 
                onClick={() => setIsTargetLanguageDialogOpen(true)}
                className="w-full flex justify-between items-center"
                variant="outline"
              >
                <span>{t('settings.manageTargetLanguage')}</span>
                <Globe className="h-4 w-4 ml-2" />
              </Button>
            </div>
            
            {/* Target Language Dialog */}
            <TargetLanguageDialog
              open={isTargetLanguageDialogOpen}
              onOpenChange={setIsTargetLanguageDialogOpen}
              additionalLanguages={config.translation.additionalLanguages || []}
              onAddLanguage={handleAddLanguage}
              onRemoveLanguage={handleRemoveLanguage}
              targetLanguage={config.translation.targetLanguage}
              onTargetLanguageChange={handleTargetLanguageChange}
            />
          </div>
          
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
      </CardContent>
    </Card>
  );
}
