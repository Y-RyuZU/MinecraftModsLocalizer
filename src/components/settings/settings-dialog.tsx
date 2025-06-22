"use client";

import { useAppTranslation } from "@/lib/i18n";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { LLMSettings } from "@/components/settings/llm-settings";
import { TranslationSettings } from "@/components/settings/translation-settings";
import { PathSettings } from "@/components/settings/path-settings";
import { UISettings } from "@/components/settings/ui-settings";
import { useAppStore } from "@/lib/store";
import { ConfigService } from "@/lib/services/config-service";
import { FileService } from "@/lib/services/file-service";

export function SettingsDialog() {
  const { t } = useAppTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { config, setConfig } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState(config);
  
  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      await ConfigService.save(config);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Discard changes
  const handleDiscard = () => {
    setConfig(originalConfig);
    setIsDialogOpen(false);
  };
  
  // Reset settings
  const handleReset = async () => {
    try {
      const defaultConfig = await ConfigService.reset();
      setConfig(defaultConfig);
    } catch (error) {
      console.error("Failed to reset settings:", error);
    }
  };
  
  // Select directory
  const handleSelectDirectory = async (path: keyof typeof config.paths) => {
    try {
      const selected = await FileService.openDirectoryDialog(`Select ${path.replace('_', ' ')} Directory`);
      
      if (selected) {
        config.paths[path] = selected;
        setConfig({ ...config });
      }
    } catch (error) {
      console.error(`Failed to select ${path} directory:`, error);
    }
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        aria-label={t('settings.openSettings')}
        onClick={() => setIsDialogOpen(true)}
      >
        <Settings className="h-5 w-5" />
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (open) {
          setOriginalConfig(config);
        }
        setIsDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cards.settings')}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-end space-x-2 pb-4 border-b">
            <Button variant="outline" onClick={handleDiscard}>
              {t('settings.discard')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t('settings.saving') : t('settings.saveSettings')}
            </Button>
          </div>
          <div className="space-y-8 py-4">
            {/* LLM Settings */}
            <LLMSettings config={config} setConfig={setConfig} />
            
            {/* Translation Settings */}
            <TranslationSettings config={config} setConfig={setConfig} />
            
            {/* Path Settings */}
            <PathSettings config={config} onSelectDirectory={handleSelectDirectory} />
            
            {/* UI Settings */}
            <UISettings config={config} setConfig={setConfig} />
            
            {/* Reset Button */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-end">
                  <Button variant="outline" onClick={handleReset}>
                    {t('settings.resetToDefaults')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
