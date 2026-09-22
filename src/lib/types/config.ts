import { SupportedLanguage, DEFAULT_PROMPT_TEMPLATE, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "./llm";

/**
 * Default model configurations for each provider
 */
export const DEFAULT_MODELS = {
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-4-5-20251001",
  gemini: "gemini-3.8-flash",
  // Kept for config files created by older releases.
  google: "gemini-3.8-flash"
} as const;

/**
 * Default API URLs for each provider
 */
export const DEFAULT_API_URLS = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com",
  gemini: undefined, // Google uses SDK default
  google: undefined // Legacy provider ID
} as const;

export type ProviderId = "openai" | "anthropic" | "gemini";

export const PROVIDER_DEFINITIONS: Record<ProviderId, {
  name: string;
  apiKeyUrl: string;
  environmentVariable: string;
  alternativeEnvironmentVariable?: string;
}> = {
  openai: {
    name: "OpenAI",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    environmentVariable: "OPENAI_API_KEY"
  },
  anthropic: {
    name: "Anthropic",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    environmentVariable: "ANTHROPIC_API_KEY"
  },
  gemini: {
    name: "Google Gemini",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    environmentVariable: "GEMINI_API_KEY",
    alternativeEnvironmentVariable: "GOOGLE_API_KEY"
  }
};

/** Normalize provider IDs used by older config files. */
export function normalizeProvider(provider: string | undefined): ProviderId {
  switch (provider?.toLowerCase()) {
    case "anthropic":
      return "anthropic";
    case "gemini":
    case "google":
      return "gemini";
    case "openai":
    default:
      return "openai";
  }
}

// Removed DEFAULT_API_CONFIG - values moved to DEFAULT_CONFIG for unified configuration

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  config: "minecraft-mods-localizer-config"
} as const;

/**
 * Application configuration
 */
export interface AppConfig {
  /** LLM provider configuration */
  llm: LLMProviderConfig;
  /** Translation configuration */
  translation: TranslationConfig;
  /** UI configuration */
  ui: UIConfig;
  /** File paths configuration */
  paths: PathsConfig;
  /** Update configuration */
  update?: UpdateConfig;
}

/**
 * LLM provider configuration
 */
export interface LLMProviderConfig {
  /** Provider ID */
  provider: string;
  /** Active API key (legacy compatibility) */
  apiKey: string;
  /** API keys stored per provider */
  apiKeys: ApiKeys;
  /** Base URL (optional for some providers) */
  baseUrl?: string;
  /** Model to use */
  model?: string;
  /** Maximum number of retries on failure */
  maxRetries: number;
  /** Custom prompt template (legacy - combined system and user) */
  promptTemplate?: string;
  /** System prompt for setting the AI's role and behavior */
  systemPrompt?: string;
  /** User prompt template with variables for the specific task */
  userPrompt?: string;
  /** Temperature setting for the LLM (0.0 to 2.0) */
  temperature?: number;
}

/**
 * Translation configuration
 */
export interface TranslationConfig {
  /** Chunk size for mod translations */
  modChunkSize: number;
  /** Chunk size for quest translations */
  questChunkSize: number;
  /** Chunk size for guidebook translations */
  guidebookChunkSize: number;
  /** Additional languages */
  additionalLanguages: SupportedLanguage[];
  /** Resource pack name */
  resourcePackName: string;
}

/**
 * UI configuration
 */
export interface UIConfig {
  /** Theme (light or dark) */
  theme: "light" | "dark" | "system";
}

/**
 * Paths configuration
 */
export interface PathsConfig {
  /** Minecraft directory */
  minecraftDir: string;
  /** Mods directory */
  modsDir: string;
  /** Resource packs directory */
  resourcePacksDir: string;
  /** Config directory */
  configDir: string;
  /** Logs directory */
  logsDir: string;
}

/**
 * Update configuration
 */
export interface UpdateConfig {
  /** Whether to check for updates on startup */
  checkOnStartup: boolean;
  /** Last dismissed version (to avoid repeated notifications) */
  lastDismissedVersion?: string;
  /** Last check timestamp */
  lastCheckTime?: number;
}

/** Provider-specific API keys. */
export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  /** Legacy Google provider key. */
  google?: string;
}

/**
 * Default application configuration
 * Unified configuration with all default values in one place
 */
export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: "openai",
    apiKey: "",
    apiKeys: {
      openai: "",
      anthropic: "",
      gemini: ""
    },
    model: DEFAULT_MODELS.openai,
    maxRetries: 3,
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt: DEFAULT_USER_PROMPT,
    temperature: 1.0
  },
  translation: {
    modChunkSize: 50,
    questChunkSize: 50,
    guidebookChunkSize: 50,
    additionalLanguages: [],
    resourcePackName: "MinecraftModsLocalizer"
  },
  ui: {
    theme: "system"
  },
  paths: {
    minecraftDir: "",
    modsDir: "",
    resourcePacksDir: "",
    configDir: "",
    logsDir: ""
  },
  update: {
    checkOnStartup: true
  }
};

/**
 * Backward compatibility: Export individual default values from unified config
 * This maintains existing API while using the unified configuration as source
 */
export const DEFAULT_API_CONFIG = {
  temperature: DEFAULT_CONFIG.llm.temperature!,
  maxRetries: DEFAULT_CONFIG.llm.maxRetries,
  chunkSize: DEFAULT_CONFIG.translation.modChunkSize
} as const;
