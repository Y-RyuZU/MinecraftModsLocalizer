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
  /** Enable token-based chunking instead of entry-based */
  useTokenBasedChunking?: boolean;
  /** Maximum tokens per chunk (when using token-based chunking) */
  maxTokensPerChunk?: number;
  /** Fallback to entry-based chunking if token estimation fails */
  fallbackToEntryBased?: boolean;
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

/**
 * Default application configuration
 * Unified configuration with all default values in one place
 */
export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: "openai",
    apiKey: "",
    model: DEFAULT_MODELS.openai,
    maxRetries: 3,
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt: DEFAULT_USER_PROMPT,
    temperature: 1.0
  },
  translation: {
    modChunkSize: 50,
    questChunkSize: 1,
    guidebookChunkSize: 1,
    additionalLanguages: [],
    resourcePackName: "MinecraftModsLocalizer",
    useTokenBasedChunking: false,
    maxTokensPerChunk: 5000,
    fallbackToEntryBased: true
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
