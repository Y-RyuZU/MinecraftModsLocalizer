"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { ConfigService } from "@/lib/services/config-service";
import { LLMSettings } from "@/components/settings/llm-settings";
import { TranslationSettings } from "@/components/settings/translation-settings";
import { PathSettings } from "@/components/settings/path-settings";
import { UISettings } from "@/components/settings/ui-settings";
import { SettingsActions } from "@/components/settings/settings-actions";

import { FileService } from "@/lib/services/file-service";
import { useAppTranslation } from "@/lib/i18n";
import { toast } from "sonner";

export function SettingsTab() {
  const { config, setConfig } = useAppStore();
  const { t } = useAppTranslation();
  const [isSaving, setIsSaving] = useState(false);
  
  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      await ConfigService.save(config);
      
      // Update the store with the latest config to ensure all components get updated
      const updatedConfig = await ConfigService.getConfig();
      setConfig(updatedConfig);
      
      // Show success feedback
      toast.success(t('settings.saveSuccess'), {
        description: t('settings.saveSuccessDescription'),
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(t('settings.saveError'), {
        description: t('settings.saveErrorDescription'),
      });
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
    <div className="space-y-8">
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
  );
}
