import { SupportedLanguage } from "./llm";

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
  /** Custom prompt template */
  promptTemplate?: string;
}

/**
 * Translation configuration
 */
export interface TranslationConfig {
  /** Target language */
  targetLanguage: string;
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
    model: "o4-mini-2025-04-16",
    maxRetries: 5
  },
  translation: {
    targetLanguage: "ja_jp",
    modChunkSize: 50,
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
