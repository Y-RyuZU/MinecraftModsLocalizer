"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { ConfigService } from "@/lib/services/config-service";
import { LLMSettings } from "@/components/settings/llm-settings";
import { TranslationSettings } from "@/components/settings/translation-settings";
import { PathSettings } from "@/components/settings/path-settings";
import { UISettings } from "@/components/settings/ui-settings";
import { SettingsActions } from "@/components/settings/settings-actions";

interface DialogOptions {
  directory: boolean;
  multiple: boolean;
  title: string;
}

const mockOpen = async (options: DialogOptions): Promise<string | null> => {
  console.log('Opening dialog with options:', options);
  return '/mock/path';
};

export function SettingsTab() {
  const { config, setConfig } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  
  // Save settings
  const handleSave = () => {
    setIsSaving(true);
    
    try {
      ConfigService.save(config);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Reset settings
  const handleReset = () => {
    const defaultConfig = ConfigService.reset();
    setConfig(defaultConfig);
  };
  
  // Select directory
  const handleSelectDirectory = async (path: keyof typeof config.paths) => {
    const selected = await mockOpen({
      directory: true,
      multiple: false,
      title: `Select ${path} Directory`
    });
    
    if (selected) {
      config.paths[path] = selected;
      setConfig({ ...config });
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
