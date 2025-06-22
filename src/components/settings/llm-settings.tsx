"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { AppConfig, DEFAULT_MODELS } from "@/lib/types/config";
import { useAppTranslation } from "@/lib/i18n";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "@/lib/types/llm";

interface LLMSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}


export function LLMSettings({ config, setConfig }: LLMSettingsProps) {
  const { t } = useAppTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
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
  }, [config, setConfig]);
  
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
            <div className="relative flex items-center">
              <Input 
                type={showApiKey ? "text" : "password"}
                value={config.llm.apiKey}
                onChange={(e) => {
                  config.llm.apiKey = e.target.value;
                  setConfig({ ...config });
                }}
                placeholder={t('settings.apiKeyPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
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
            <label className="text-sm font-medium">{t('settings.systemPrompt') || 'System Prompt'}</label>
            <Textarea 
              value={config.llm.systemPrompt || DEFAULT_SYSTEM_PROMPT}
              onChange={(e) => {
                config.llm.systemPrompt = e.target.value;
                setConfig({ ...config });
              }}
              placeholder={t('settings.systemPromptPlaceholder') || 'Enter system prompt...'}
              rows={6}
              className="resize-vertical"
            />
          </div>
          
          <div className="space-y-2 col-span-2">
            <label className="text-sm font-medium">{t('settings.userPrompt') || 'User Prompt Template'}</label>
            <Textarea 
              value={config.llm.userPrompt || DEFAULT_USER_PROMPT}
              onChange={(e) => {
                config.llm.userPrompt = e.target.value;
                setConfig({ ...config });
              }}
              placeholder={t('settings.userPromptPlaceholder') || 'Enter user prompt template...'}
              rows={4}
              className="resize-vertical"
            />
            <p className="text-xs text-muted-foreground">
              Available variables: {'{language}'}, {'{line_count}'}, {'{content}'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
