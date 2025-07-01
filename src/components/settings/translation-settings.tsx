"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AppConfig } from "@/lib/types/config";
import { useAppTranslation } from "@/lib/i18n";
import { SupportedLanguage } from "@/lib/types/llm";
import { TargetLanguageDialog } from "./target-language-dialog";

interface TranslationSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

export function TranslationSettings({ config, setConfig }: TranslationSettingsProps) {
  const { t } = useAppTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

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


  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.translationSettings')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Target Language Settings */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline"
                onClick={() => setDialogOpen(true)}
              >
                {t('settings.manageTargetLanguage')}
              </Button>
            </div>
          </div>

          {/* Token-Based Chunking Settings */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <h3 className="text-sm font-semibold">Token-Based Chunking (Recommended)</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Enable Token-Based Chunking</label>
                  <p className="text-xs text-muted-foreground">
                    Prevents "maximum context length exceeded" errors by intelligently sizing chunks
                  </p>
                </div>
                <Switch
                  checked={config.translation.useTokenBasedChunking ?? true}
                  onCheckedChange={(checked) => {
                    setConfig({
                      ...config,
                      translation: {
                        ...config.translation,
                        useTokenBasedChunking: checked
                      }
                    });
                  }}
                />
              </div>
              
              {config.translation.useTokenBasedChunking && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Tokens Per Chunk</label>
                    <Input 
                      type="number"
                      value={config.translation.maxTokensPerChunk || 3000}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          translation: {
                            ...config.translation,
                            maxTokensPerChunk: parseInt(e.target.value) || 3000
                          }
                        });
                      }}
                      placeholder="3000"
                      min="1000"
                      max="10000"
                    />
                    <p className="text-xs text-muted-foreground">
                      Conservative limit to prevent token overflow (1000-10000)
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Fallback to Entry-Based</label>
                      <p className="text-xs text-muted-foreground">
                        Use entry-based chunking if token estimation fails
                      </p>
                    </div>
                    <Switch
                      checked={config.translation.fallbackToEntryBased ?? true}
                      onCheckedChange={(checked) => {
                        setConfig({
                          ...config,
                          translation: {
                            ...config.translation,
                            fallbackToEntryBased: checked
                          }
                        });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Other Translation Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.resourcePackName')}</label>
              <Input 
                value={config.translation.resourcePackName || "MinecraftModsLocalizer"}
                onChange={(e) => {
                  config.translation.resourcePackName = e.target.value;
                  setConfig({ ...config });
                }}
                placeholder="MinecraftModsLocalizer"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.modChunkSize')}</label>
              <Input 
                type="number"
                value={config.translation.modChunkSize || 50}
                onChange={(e) => {
                  config.translation.modChunkSize = parseInt(e.target.value);
                  setConfig({ ...config });
                }}
                placeholder="50"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.questChunkSize')}</label>
              <Input 
                type="number"
                value={config.translation.questChunkSize || 1}
                onChange={(e) => {
                  config.translation.questChunkSize = parseInt(e.target.value);
                  setConfig({ ...config });
                }}
                placeholder="1"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.guidebookChunkSize')}</label>
              <Input 
                type="number"
                value={config.translation.guidebookChunkSize || 1}
                onChange={(e) => {
                  config.translation.guidebookChunkSize = parseInt(e.target.value);
                  setConfig({ ...config });
                }}
                placeholder="1"
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
      />
    </Card>
  );
}