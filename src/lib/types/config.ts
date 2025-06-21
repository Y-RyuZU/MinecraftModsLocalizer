import { SupportedLanguage, DEFAULT_PROMPT_TEMPLATE, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "./llm";

/**
 * Default model configurations for each provider
 */
export const DEFAULT_MODELS = {
  openai: "o4-mini-2025-04-16",
  anthropic: "claude-3-5-haiku-20241022",
  google: "gemini-1.5-flash"
} as const;

/**
 * Default API URLs for each provider
 */
export const DEFAULT_API_URLS = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com",
  google: undefined // Google uses SDK default
} as const;

/**
 * Default API configuration
 */
export const DEFAULT_API_CONFIG = {
  temperature: 0.3,
  maxTokens: 4096,
  maxRetries: 5,
  chunkSize: 50
} as const;

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
}

/**
 * LLM provider configuration
 */
export interface LLMProviderConfig {
  /** Provider ID */
  provider: string;
  /** API key */
  apiKey: string;
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
 * Default application configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: "openai",
    apiKey: "",
    model: DEFAULT_MODELS.openai,
    maxRetries: DEFAULT_API_CONFIG.maxRetries,
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt: DEFAULT_USER_PROMPT
  },
  translation: {
    modChunkSize: DEFAULT_API_CONFIG.chunkSize,
    questChunkSize: 1,
    guidebookChunkSize: 1,
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
  }
};
