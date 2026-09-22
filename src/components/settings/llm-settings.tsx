"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download, ExternalLink, Eye, EyeOff, KeyRound } from "lucide-react";
import {
  AppConfig,
  DEFAULT_MODELS,
  DEFAULT_API_CONFIG,
  normalizeProvider,
  PROVIDER_DEFINITIONS,
  ProviderId
} from "@/lib/types/config";
import { useAppTranslation } from "@/lib/i18n";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "@/lib/types/llm";

interface LLMSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

const providerOptions: ProviderId[] = ["openai", "anthropic", "gemini"];

export function LLMSettings({ config, setConfig }: LLMSettingsProps) {
  const { t } = useAppTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);
  const provider = normalizeProvider(config.llm.provider);
  const providerDefinition = PROVIDER_DEFINITIONS[provider];
  const providerApiKey = config.llm.apiKeys?.[provider] || (config.llm.provider === provider ? config.llm.apiKey : "");
  const defaultModel = DEFAULT_MODELS[provider];

  const updateLLM = (patch: Partial<AppConfig["llm"]>) => {
    setConfig({
      ...config,
      llm: {
        ...config.llm,
        ...patch
      }
    });
  };

  const handleProviderChange = (value: string) => {
    const nextProvider = normalizeProvider(value);
    const nextApiKey = config.llm.apiKeys?.[nextProvider] || "";
    updateLLM({
      provider: nextProvider,
      apiKey: nextApiKey,
      model: DEFAULT_MODELS[nextProvider]
    });
    setApiKeyMessage(null);
  };

  useEffect(() => {
    if (!config.llm.model) {
      updateLLM({ model: defaultModel });
    }
    // The default is only filled when a config has no model yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.llm.model, defaultModel]);

  const handleOpenProviderConsole = async () => {
    try {
      await invoke("open_external_url", { url: providerDefinition.apiKeyUrl });
    } catch {
      window.open(providerDefinition.apiKeyUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleLoadEnvironmentKey = async () => {
    try {
      const key = await invoke<string | null>("get_api_key_from_environment", { provider });
      if (!key) {
        setApiKeyMessage(`${providerDefinition.environmentVariable}: ${t("settings.apiKeyNotFound") || "not found"}`);
        return;
      }

      updateLLM({
        apiKey: key,
        apiKeys: { ...config.llm.apiKeys, [provider]: key }
      });
      setApiKeyMessage(t("settings.apiKeyLoaded") || "API key loaded from environment");
    } catch (error) {
      console.error("Failed to load API key from environment:", error);
      setApiKeyMessage(t("settings.apiKeyNotFound") || "Could not load API key from environment");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t("settings.llmSettings")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("settings.provider")}</label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("settings.selectProvider")} />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((id) => (
                  <SelectItem key={id} value={id}>
                    {PROVIDER_DEFINITIONS[id].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("settings.apiKey")}</label>
            <div className="relative flex items-center">
              <Input
                type={showApiKey ? "text" : "password"}
                value={providerApiKey}
                onChange={(event) => {
                  const key = event.target.value;
                  updateLLM({
                    apiKey: key,
                    apiKeys: { ...config.llm.apiKeys, [provider]: key }
                  });
                  setApiKeyMessage(null);
                }}
                placeholder={t("settings.apiKeyPlaceholder")}
                className="pr-10"
              />
              <button
                type="button"
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
                className="absolute right-2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleOpenProviderConsole}>
                <KeyRound className="mr-2 h-4 w-4" />
                {t("settings.getApiKey") || "Get API key"}
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleLoadEnvironmentKey}>
                <Download className="mr-2 h-4 w-4" />
                {t("settings.loadApiKeyFromEnvironment") || "Load from environment"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settings.environmentVariable") || "Environment variable"}: {providerDefinition.environmentVariable}
            </p>
            {apiKeyMessage && <p className="text-xs text-muted-foreground">{apiKeyMessage}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("settings.model")}</label>
            <Input
              value={config.llm.model || defaultModel}
              onChange={(event) => updateLLM({ model: event.target.value })}
              placeholder={defaultModel || t("settings.modelPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("settings.maxRetries")}</label>
            <Input
              type="number"
              value={config.llm.maxRetries ?? DEFAULT_API_CONFIG.maxRetries}
              onChange={(event) => updateLLM({ maxRetries: Number.parseInt(event.target.value, 10) || 0 })}
              placeholder={DEFAULT_API_CONFIG.maxRetries.toString()}
              min="0"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("settings.temperature") || "Temperature"}</label>
            <Input
              type="number"
              value={config.llm.temperature ?? DEFAULT_API_CONFIG.temperature}
              onChange={(event) => updateLLM({ temperature: Number.parseFloat(event.target.value) || 0 })}
              placeholder={DEFAULT_API_CONFIG.temperature.toString()}
              min="0"
              max="2"
              step="0.1"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.temperatureHint") || "Controls randomness (0.0-2.0)."}
            </p>
          </div>

          <div className="space-y-2 col-span-2">
            <label className="text-sm font-medium">{t("settings.systemPrompt") || "System Prompt"}</label>
            <Textarea
              value={config.llm.systemPrompt || DEFAULT_SYSTEM_PROMPT}
              onChange={(event) => updateLLM({ systemPrompt: event.target.value })}
              placeholder={t("settings.systemPromptPlaceholder") || "Enter system prompt..."}
              rows={6}
              className="resize-vertical"
            />
          </div>

          <div className="space-y-2 col-span-2">
            <label className="text-sm font-medium">{t("settings.userPrompt") || "User Prompt Template"}</label>
            <Textarea
              value={config.llm.userPrompt || DEFAULT_USER_PROMPT}
              onChange={(event) => updateLLM({ userPrompt: event.target.value })}
              placeholder={t("settings.userPromptPlaceholder") || "Enter user prompt template..."}
              rows={4}
              className="resize-vertical"
            />
            <p className="text-xs text-muted-foreground">
              Available variables: {"{language}"}, {"{line_count}"}, {"{content}"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
