"use client";

import { useAppTranslation } from "@/lib/i18n";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LLMSettings } from "@/components/settings/llm-settings";
import { TranslationSettings } from "@/components/settings/translation-settings";
import { PathSettings } from "@/components/settings/path-settings";
import { UISettings } from "@/components/settings/ui-settings";
import { SettingsActions } from "@/components/settings/settings-actions";
import { useAppStore } from "@/lib/store";
import { ConfigService } from "@/lib/services/config-service";
import { FileService } from "@/lib/services/file-service";

export function SettingsDropdown() {
  const { t } = useAppTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { config, setConfig } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cards.settings')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-8 py-4">
            {/* LLM Settings */}
            <LLMSettings config={config} setConfig={setConfig} />
            
            {/* Translation Settings */}
            <TranslationSettings config={config} setConfig={setConfig} />
            
            {/* Path Settings */}
            <PathSettings config={config} onSelectDirectory={handleSelectDirectory} />
            
            {/* UI Settings */}
            <UISettings config={config} setConfig={setConfig} />
            
            {/* Actions */}
            <SettingsActions 
              isSaving={isSaving} 
              onSave={handleSave} 
              onReset={handleReset} 
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
