"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig } from "@/lib/types/config";

interface LLMSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

// Default models for each provider
const DEFAULT_MODELS = {
  openai: "gpt-4o-mini-2024-07-18",
  anthropic: "claude-3-haiku-20240307",
  google: "gemini-1.5-pro"
};

export function LLMSettings({ config, setConfig }: LLMSettingsProps) {
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
        <CardTitle>LLM Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <Select 
              value={config.llm.provider}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <Input 
              type="password"
              value={config.llm.api_key}
              onChange={(e) => {
                config.llm.api_key = e.target.value;
                setConfig({ ...config });
              }}
              placeholder="Enter API key"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL (Optional)</label>
            <Input 
              value={config.llm.base_url || ""}
              onChange={(e) => {
                config.llm.base_url = e.target.value;
                setConfig({ ...config });
              }}
              placeholder="Enter base URL"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Input 
              value={config.llm.model || ""}
              onChange={(e) => {
                config.llm.model = e.target.value;
                setConfig({ ...config });
              }}
              placeholder="Enter model name"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Retries</label>
            <Input 
              type="number"
              value={config.llm.max_retries}
              onChange={(e) => {
                config.llm.max_retries = parseInt(e.target.value);
                setConfig({ ...config });
              }}
              placeholder="Enter max retries"
            />
          </div>
          
          <div className="space-y-2 col-span-2">
            <label className="text-sm font-medium">Custom Prompt Template</label>
            <Input 
              value={config.llm.prompt_template || ""}
              onChange={(e) => {
                config.llm.prompt_template = e.target.value;
                setConfig({ ...config });
              }}
              placeholder="Enter custom prompt template"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
