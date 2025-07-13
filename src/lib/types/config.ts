import { SupportedLanguage } from "./llm";
import { 
  DEFAULT_MODELS as IMPORTED_DEFAULT_MODELS,
  DEFAULT_API_URLS as IMPORTED_DEFAULT_API_URLS,
  DEFAULT_PROVIDER,
  API_DEFAULTS,
  TRANSLATION_DEFAULTS,
  UI_DEFAULTS,
  UPDATE_DEFAULTS,
  STORAGE_KEYS as IMPORTED_STORAGE_KEYS,
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT
} from "../constants/defaults";

// Re-export from defaults for backward compatibility
export const DEFAULT_MODELS = IMPORTED_DEFAULT_MODELS;
export const DEFAULT_API_URLS = IMPORTED_DEFAULT_API_URLS;

// Removed DEFAULT_API_CONFIG - values moved to DEFAULT_CONFIG for unified configuration

// Re-export storage keys
export const STORAGE_KEYS = IMPORTED_STORAGE_KEYS;

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
    provider: DEFAULT_PROVIDER,
    apiKey: "",
    model: DEFAULT_MODELS.openai,
    maxRetries: API_DEFAULTS.maxRetries,
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPrompt: DEFAULT_USER_PROMPT,
    temperature: API_DEFAULTS.temperature
  },
  translation: {
    modChunkSize: TRANSLATION_DEFAULTS.modChunkSize,
    questChunkSize: TRANSLATION_DEFAULTS.questChunkSize,
    guidebookChunkSize: TRANSLATION_DEFAULTS.guidebookChunkSize,
    additionalLanguages: [],
    resourcePackName: TRANSLATION_DEFAULTS.resourcePackName,
    useTokenBasedChunking: TRANSLATION_DEFAULTS.useTokenBasedChunking,
    maxTokensPerChunk: TRANSLATION_DEFAULTS.maxTokensPerChunk,
    fallbackToEntryBased: TRANSLATION_DEFAULTS.fallbackToEntryBased
  },
  ui: {
    theme: UI_DEFAULTS.theme
  },
  paths: {
    minecraftDir: "",
    modsDir: "",
    resourcePacksDir: "",
    configDir: "",
    logsDir: ""
  },
  update: {
    checkOnStartup: UPDATE_DEFAULTS.checkOnStartup
  }
};

/**
 * Backward compatibility: Export individual default values from unified config
 * This maintains existing API while using the unified configuration as source
 */
export const DEFAULT_API_CONFIG = {
  temperature: API_DEFAULTS.temperature,
  maxRetries: API_DEFAULTS.maxRetries,
  chunkSize: TRANSLATION_DEFAULTS.modChunkSize
} as const;
