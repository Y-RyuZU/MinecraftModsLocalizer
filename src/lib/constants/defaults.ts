/**
 * Centralized default values for the entire application
 * This file contains all default constants to ensure consistency
 */

// ============================================
// Model and Provider Defaults
// ============================================
export const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  google: "gemini-1.5-flash",
} as const;

export const DEFAULT_API_URLS = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com",
  google: undefined,
} as const;

export const DEFAULT_PROVIDER = "openai";

// ============================================
// API Configuration Defaults
// ============================================
export const API_DEFAULTS = {
  temperature: 1.0,
  maxRetries: 3,
  timeout: 10000, // 10 seconds
  rateLimitRetryBase: 1000, // Base retry delay in ms
} as const;

// ============================================
// Translation Configuration Defaults
// ============================================
export const TRANSLATION_DEFAULTS = {
  modChunkSize: 50,
  questChunkSize: 1,
  guidebookChunkSize: 1,
  resourcePackName: "MinecraftModsLocalizer",
  useTokenBasedChunking: false,
  maxTokensPerChunk: 3000,
  fallbackToEntryBased: true,
  maxEntriesPerChunk: 100, // Cap for safety
  contentSplitThreshold: 1000, // Characters
  splitPartMaxLength: 800, // Characters
  maxFailedChunksRatio: 0.1, // 10% failure threshold
} as const;

// ============================================
// Token Estimation Defaults
// ============================================
export const TOKEN_ESTIMATION_DEFAULTS = {
  default: {
    wordToTokenRatio: 1.5,
    jsonOverhead: 50,
    systemPromptOverhead: 300,
    userPromptOverhead: 200,
    responseOverhead: 100,
  },
  openai: {
    wordToTokenRatio: 1.5,
    systemPromptOverhead: 300,
    userPromptOverhead: 200,
    responseOverhead: 100,
  },
  anthropic: {
    wordToTokenRatio: 1.4,
    systemPromptOverhead: 250,
    userPromptOverhead: 150,
    responseOverhead: 80,
  },
  gemini: {
    wordToTokenRatio: 1.6,
    systemPromptOverhead: 350,
    userPromptOverhead: 250,
    responseOverhead: 120,
  },
} as const;

// ============================================
// Model Token Limits
// ============================================
export const MODEL_TOKEN_LIMITS = {
  openai: {
    "gpt-4o": 8000,
    "o1": 8000,
    "o4": 8000,
    "gpt-4": 6000,
    "gpt-3.5": 2000,
    default: 3000,
  },
  anthropic: {
    maxOutputTokens: 4096,
    validationTokens: 10,
  },
  gemini: {
    maxOutputTokens: 4096,
  },
  fallback: 3000, // Conservative default for unknown models
} as const;


// ============================================
// UI Configuration Defaults
// ============================================
export const UI_DEFAULTS = {
  theme: "system" as const,
  autoScroll: {
    enabled: true,
    interactionDelay: 2000, // ms
    smooth: false,
  },
  scrollArea: {
    defaultHeight: "400px",
    logViewerHeight: "300px",
  },
  dialog: {
    autoCloseDelay: 5000, // ms after completion
  },
} as const;

// ============================================
// Update Service Defaults
// ============================================
export const UPDATE_DEFAULTS = {
  githubRepo: "Y-RyuZU/MinecraftModsLocalizer",
  checkOnStartup: true,
  cacheExpiration: 3600000, // 1 hour in ms
  requestTimeout: 10000, // 10 seconds
} as const;

// ============================================
// Storage Keys
// ============================================
export const STORAGE_KEYS = {
  config: "minecraft-mods-localizer-config",
} as const;

// ============================================
// Supported Languages
// ============================================
export const DEFAULT_LANGUAGES = [
  { id: "ja_jp", name: "日本語 (Japanese)" },
  { id: "zh_cn", name: "简体中文 (Simplified Chinese)" },
  { id: "ko_kr", name: "한국어 (Korean)" },
  { id: "de_de", name: "Deutsch (German)" },
  { id: "fr_fr", name: "Français (French)" },
  { id: "es_es", name: "Español (Spanish)" },
  { id: "it_it", name: "Italiano (Italian)" },
  { id: "pt_br", name: "Português Brasileiro (Brazilian Portuguese)" },
  { id: "ru_ru", name: "Русский (Russian)" },
] as const;

// ============================================
// Prompt Templates
// ============================================
export const DEFAULT_SYSTEM_PROMPT = `You are a professional translator specializing in Minecraft mod translations. Your task is to translate the provided content while following these rules:

1. **Preserve all formatting**: Keep all Minecraft formatting codes (like &a, &b, §1, §2, etc.) and special characters exactly as they appear
2. **Maintain technical terms**: Do not translate:
   - Mod names
   - Item/block names that are meant to stay in English
   - Commands and their syntax
   - File paths and technical identifiers
3. **Context awareness**: Consider Minecraft gameplay context when translating
4. **Natural language**: Make translations sound natural in the target language while preserving the original meaning
5. **Consistency**: Use consistent translations for recurring terms throughout the text`;

export const DEFAULT_USER_PROMPT = `Please translate the following Minecraft mod content from English to {{targetLanguage}}. 
The content is provided in JSON format with key-value pairs.
Return ONLY the translated JSON with the same structure, translating only the values, not the keys.

Content to translate:
{{content}}`;

// Legacy combined prompt for backward compatibility
export const DEFAULT_PROMPT_TEMPLATE = `${DEFAULT_SYSTEM_PROMPT}

${DEFAULT_USER_PROMPT}`;