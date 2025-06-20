"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig } from "@/lib/types/config";
import { useAppTranslation } from "@/lib/i18n";
import { DEFAULT_promptTemplate } from "@/lib/types/llm";

interface LLMSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

// Default models for each provider
const DEFAULT_MODELS = {
  openai: "o4-mini-2025-04-16",
  anthropic: "claude-3-5-haiku-latest",
  google: "gemini-2.5-flash"
};

export function LLMSettings({ config, setConfig }: LLMSettingsProps) {
  const { t } = useAppTranslation();
  // Set default model when provider changes
  const handleProviderChange = (value: string) => {
    const newConfig = { ...config };
    newConfig.llm.provider = value;
    
    // Set default model for the selected provider
    if (DEFAULT_MODELS[value as keyof typeof DEFAULT_MODELS]) {
      newConfig.llm.model = DEFAULT_MODELS[value as keyof typeof DEFAULT_MODELS];
    }
    
    setConfig(newConfig);
  };
  
  // Set default model on initial load if not set
  useEffect(() => {
    if (!config.llm.model && config.llm.provider) {
      const defaultModel = DEFAULT_MODELS[config.llm.provider as keyof typeof DEFAULT_MODELS];
      if (defaultModel) {
        const newConfig = { ...config };
        newConfig.llm.model = defaultModel;
        setConfig(newConfig);
      }
    }
  }, []);
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.llmSettings')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.provider')}</label>
            <Select 
              value={config.llm.provider}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('settings.selectProvider')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.apiKey')}</label>
            <Input 
              type="password"
              value={config.llm.apiKey}
              onChange={(e) => {
                config.llm.apiKey = e.target.value;
                setConfig({ ...config });
              }}
              placeholder={t('settings.apiKeyPlaceholder')}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.model')}</label>
            <Input 
              value={config.llm.model || DEFAULT_MODELS[config.llm.provider as keyof typeof DEFAULT_MODELS] || ""}
              onChange={(e) => {
                config.llm.model = e.target.value;
                setConfig({ ...config });
              }}
              placeholder={DEFAULT_MODELS[config.llm.provider as keyof typeof DEFAULT_MODELS] || t('settings.modelPlaceholder')}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.maxRetries')}</label>
            <Input 
              type="number"
              value={config.llm.maxRetries || 5}
              onChange={(e) => {
                config.llm.maxRetries = parseInt(e.target.value);
                setConfig({ ...config });
              }}
              placeholder="5"
            />
          </div>
          
          <div className="space-y-2 col-span-2">
            <label className="text-sm font-medium">{t('settings.prompt')}</label>
            <Textarea 
              value={config.llm.promptTemplate || DEFAULT_promptTemplate}
              onChange={(e) => {
                config.llm.promptTemplate = e.target.value;
                setConfig({ ...config });
              }}
              placeholder={t('settings.promptPlaceholder')}
              rows={8}
              className="resize-vertical"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
