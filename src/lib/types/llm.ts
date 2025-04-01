/**
 * LLM Adapter Interface and Types
 * This file defines the interfaces and types for the LLM translation service adapters.
 */

/**
 * Translation request parameters
 */
export interface TranslationRequest {
  /** Text content to translate in key-value format */
  content: Record<string, string>;
  /** Target language for translation */
  targetLanguage: string;
  /** Optional custom prompt to use for translation */
  prompt_template?: string;
}

/**
 * Translation response
 */
export interface TranslationResponse {
  /** Translated content in key-value format */
  content: Record<string, string>;
  /** Optional metadata about the translation */
  metadata?: {
    /** Number of tokens used */
    tokensUsed?: number;
    /** Time taken for translation */
    timeTaken?: number;
    /** Model used for translation */
    model?: string;
  };
}

/**
 * Error response from LLM service
 */
export interface LLMError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Optional additional details */
  details?: unknown;
}

/**
 * LLM Adapter interface
 * Defines the contract for all LLM service adapters
 */
export interface LLMAdapter {
  /** Unique identifier for the adapter */
  id: string;
  /** Display name for the adapter */
  name: string;
  /** Whether the adapter requires an API key */
  requiresApiKey: boolean;
  /** Translate content using the LLM service */
  translate(request: TranslationRequest): Promise<TranslationResponse>;
  /** Validate API key */
  validateApiKey(apiKey: string): Promise<boolean>;
  /** Get the maximum chunk size recommended for this LLM */
  getMaxChunkSize(): number;
}

/**
 * LLM Provider configuration
 */
export interface LLMConfig {
  /** Provider ID */
  id: string;
  /** API key */
  apiKey: string;
  /** Base URL (optional for some providers) */
  baseUrl?: string;
  /** Model to use */
  model?: string;
  /** Maximum number of retries on failure */
  maxRetries?: number;
  /** Custom prompt template */
  prompt_template?: string;
}

/**
 * Supported language definition
 */
export interface SupportedLanguage {
  /** Display name of the language */
  name: string;
  /** Language ID (e.g., "ja_jp", "zh_cn") */
  id: string;
  /** Optional flag emoji */
  flag?: string;
}

/**
 * Default supported languages
 */
export const DEFAULT_LANGUAGES: SupportedLanguage[] = [
  { name: "日本語", id: "ja_jp", flag: "🇯🇵" },
  { name: "中文 (简体)", id: "zh_cn", flag: "🇨🇳" },
  { name: "한국어", id: "ko_kr", flag: "🇰🇷" },
  { name: "Deutsch", id: "de_de", flag: "🇩🇪" },
  { name: "Français", id: "fr_fr", flag: "🇫🇷" },
  { name: "Español", id: "es_es", flag: "🇪🇸" },
  { name: "Italiano", id: "it_it", flag: "🇮🇹" },
  { name: "Português (Brasil)", id: "pt_br", flag: "🇧🇷" },
  { name: "Русский", id: "ru_ru", flag: "🇷🇺" },
];

/**
 * Default translation prompt template
 */
export const DEFAULT_PROMPT_TEMPLATE = `You are a professional translator. Please translate the following English text into {language}. 

## Important Translation Rules
- Translate line by line, strictly in order
- Ensure the number of lines before and after translation matches exactly (do not add or remove lines)
- Output only the translation result, without any greetings or explanations

## Input Text Information
- Number of lines: {line_count}

## Detailed Translation Instructions
- Treat sentences on different lines as separate, even if they seem contextually connected
- If multiple sentences appear on a single line, translate them as one line
- Use appropriate phonetic transcription for proper nouns when needed
- Preserve programming variables (e.g., %s, $1, \\") and special symbols as they are
- Maintain backslashes (\\\\) as they may be used as escape characters
- Do not edit any characters that appear to be special symbols
- For idiomatic expressions, prioritize conveying the meaning over literal translation.
- When appropriate, adapt cultural references to be more relevant to the target language audience.
- The text is about Minecraft mods. Keep this context in mind while translating

Once you receive the input text, proceed with the translation following these rules strictly.`;
