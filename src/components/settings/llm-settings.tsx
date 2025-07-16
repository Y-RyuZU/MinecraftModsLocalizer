"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { AppConfig, DEFAULT_MODELS, DEFAULT_API_CONFIG } from "@/lib/types/config";
import { useAppTranslation } from "@/lib/i18n";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "@/lib/types/llm";

interface LLMSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}


export function LLMSettings({ config, setConfig }: LLMSettingsProps) {
  const { t, ready } = useAppTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Initialize apiKeys if not present
  if (!config.llm.apiKeys) {
    config.llm.apiKeys = {
      openai: "",
      anthropic: "",
      google: ""
    };
  }
  
  // Get current API key based on selected provider
  const getCurrentApiKey = () => {
    const provider = config.llm.provider as keyof typeof config.llm.apiKeys;
    // Use provider-specific key if available, fallback to legacy apiKey
    return config.llm.apiKeys[provider] || config.llm.apiKey || "";
  };
  
  // Set API key for current provider
  const setCurrentApiKey = (value: string) => {
    const newConfig = { ...config };
    const provider = newConfig.llm.provider as keyof typeof newConfig.llm.apiKeys;
    
    // Ensure apiKeys object exists
    if (!newConfig.llm.apiKeys) {
      newConfig.llm.apiKeys = {
        openai: "",
        anthropic: "",
        google: ""
      };
    }
    
    // Set provider-specific key
    newConfig.llm.apiKeys[provider] = value;
    
    // Also update legacy apiKey for backward compatibility
    newConfig.llm.apiKey = value;
    
    setConfig(newConfig);
  };
  
  // Set default model when provider changes
  const handleProviderChange = (value: string) => {
    const newConfig = { ...config };
    newConfig.llm.provider = value;
    
    // Set default model for the selected provider
    if (DEFAULT_MODELS[value as keyof typeof DEFAULT_MODELS]) {
      newConfig.llm.model = DEFAULT_MODELS[value as keyof typeof DEFAULT_MODELS];
    }
    
    // Always update the legacy apiKey to match the provider-specific key (even if empty)
    const provider = value as keyof typeof newConfig.llm.apiKeys;
    if (newConfig.llm.apiKeys) {
      newConfig.llm.apiKey = newConfig.llm.apiKeys[provider] || "";
    }
    
    setConfig(newConfig);
    
    // Reset the show/hide state when switching providers
    setShowApiKey(false);
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
  
  // Don't render until translations are loaded
  if (!ready) {
    return <div className="animate-pulse h-96 bg-muted rounded-lg" />;
  }
  
  // Get provider display name
  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case "openai":
        return t('settings.providers.openai');
      case "anthropic":
        return t('settings.providers.anthropic');
      case "google":
        return t('settings.providers.google');
      default:
        return provider;
    }
  };
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.llmSettings')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Configuration Group */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {getProviderDisplayName(config.llm.provider)} Configuration
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            {/* Provider Selection */}
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
                  <SelectItem value="openai">{t('settings.providers.openai')}</SelectItem>
                  <SelectItem value="anthropic">{t('settings.providers.anthropic')}</SelectItem>
                  <SelectItem value="google">{t('settings.providers.google')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* API Key for current provider */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('settings.apiKey')} - {getProviderDisplayName(config.llm.provider)}
              </label>
              <div className="relative flex items-center">
                <Input 
                  type={showApiKey ? "text" : "password"}
                  value={getCurrentApiKey()}
                  onChange={(e) => setCurrentApiKey(e.target.value)}
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
              <p className="text-xs text-muted-foreground">
                {t('settings.apiKeyProviderHint', { provider: getProviderDisplayName(config.llm.provider) })}
              </p>
            </div>
            
            {/* Model for current provider */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.model')}</label>
              <Input 
                value={config.llm.model || DEFAULT_MODELS[config.llm.provider as keyof typeof DEFAULT_MODELS] || ""}
                onChange={(e) => {
                  const newConfig = { ...config };
                  newConfig.llm.model = e.target.value;
                  setConfig(newConfig);
                }}
                placeholder={DEFAULT_MODELS[config.llm.provider as keyof typeof DEFAULT_MODELS] || t('settings.modelPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.modelProviderHint', { 
                  provider: getProviderDisplayName(config.llm.provider),
                  defaultModel: DEFAULT_MODELS[config.llm.provider as keyof typeof DEFAULT_MODELS] 
                })}
              </p>
            </div>
          </div>
        </div>
        
        {/* Advanced Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {t('settings.advancedSettings')}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.maxRetries')}</label>
              <Input 
                type="number"
                value={config.llm.maxRetries ?? DEFAULT_API_CONFIG.maxRetries}
                onChange={(e) => {
                  const newConfig = { ...config };
                  newConfig.llm.maxRetries = parseInt(e.target.value);
                  setConfig(newConfig);
                }}
                placeholder={DEFAULT_API_CONFIG.maxRetries.toString()}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.temperature')}</label>
              <Input 
                type="number"
                value={config.llm.temperature ?? DEFAULT_API_CONFIG.temperature}
                onChange={(e) => {
                  const newConfig = { ...config };
                  newConfig.llm.temperature = parseFloat(e.target.value);
                  setConfig(newConfig);
                }}
                placeholder={DEFAULT_API_CONFIG.temperature.toString()}
                min="0"
                max="2"
                step="0.1"
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.temperatureHint')}
              </p>
            </div>
          </div>
        </div>
        
        {/* Prompts */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {t('settings.prompts')}
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.systemPrompt')}</label>
              <Textarea 
                value={config.llm.systemPrompt || DEFAULT_SYSTEM_PROMPT}
                onChange={(e) => {
                  const newConfig = { ...config };
                  newConfig.llm.systemPrompt = e.target.value;
                  setConfig(newConfig);
                }}
                placeholder={t('settings.systemPromptPlaceholder')}
                rows={6}
                className="resize-vertical"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('settings.userPrompt')}</label>
              <Textarea 
                value={config.llm.userPrompt || DEFAULT_USER_PROMPT}
                onChange={(e) => {
                  const newConfig = { ...config };
                  newConfig.llm.userPrompt = e.target.value;
                  setConfig(newConfig);
                }}
                placeholder={t('settings.userPromptPlaceholder')}
                rows={4}
                className="resize-vertical"
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.availableVariables')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}