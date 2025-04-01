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
  prompt_template?: string;
}

/**
 * Translation configuration
 */
export interface TranslationConfig {
  /** Source language */
  sourceLanguage: string;
  /** Target language */
  targetLanguage: string;
  /** Chunk size for mod translations */
  mod_chunk_size: number;
  /** Chunk size for quest translations */
  quest_chunk_size: number;
  /** Chunk size for guidebook translations */
  guidebook_chunk_size: number;
  /** Custom languages */
  customLanguages: SupportedLanguage[];
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
    model: "gpt-4o-mini-2024-07-18",
    maxRetries: 5
  },
  translation: {
    sourceLanguage: "en_us",
    targetLanguage: "ja_jp",
    mod_chunk_size: 50,
    quest_chunk_size: 1,
    guidebook_chunk_size: 1,
    customLanguages: [],
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
