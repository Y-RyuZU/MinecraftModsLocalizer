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
  api_key: string;
  /** Base URL (optional for some providers) */
  base_url?: string;
  /** Model to use */
  model?: string;
  /** Maximum number of retries on failure */
  max_retries: number;
  /** Custom prompt template */
  prompt_template?: string;
}

/**
 * Translation configuration
 */
export interface TranslationConfig {
  /** Source language */
  source_language: string;
  /** Target language */
  target_language: string;
  /** Chunk size for mod translations */
  mod_chunk_size: number;
  /** Chunk size for quest translations */
  quest_chunk_size: number;
  /** Chunk size for guidebook translations */
  guidebook_chunk_size: number;
  /** Custom languages */
  custom_languages: SupportedLanguage[];
  /** Resource pack name */
  resource_pack_name: string;
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
  minecraft_dir: string;
  /** Mods directory */
  mods_dir: string;
  /** Resource packs directory */
  resource_packs_dir: string;
  /** Config directory */
  config_dir: string;
  /** Logs directory */
  logs_dir: string;
}

/**
 * Default application configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  llm: {
    provider: "openai",
    api_key: "",
    model: "gpt-4o-mini-2024-07-18",
    max_retries: 5
  },
  translation: {
    source_language: "en_us",
    target_language: "ja_jp",
    mod_chunk_size: 50,
    quest_chunk_size: 1,
    guidebook_chunk_size: 1,
    custom_languages: [],
    resource_pack_name: "MinecraftModsLocalizer"
  },
  ui: {
    theme: "system"
  },
  paths: {
    minecraft_dir: "",
    mods_dir: "",
    resource_packs_dir: "",
    config_dir: "",
    logs_dir: ""
  }
};
