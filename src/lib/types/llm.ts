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
  promptTemplate?: string;
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
  provider: string;
  /** API key */
  apiKey: string;
  /** Base URL (optional for some providers) */
  baseUrl?: string;
  /** Model to use */
  model?: string;
  /** Maximum number of retries on failure */
  maxRetries?: number;
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
 * Default system prompt for translation
 * Contains the role and translation rules
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a professional translator specializing in Minecraft mods and gaming content.

## Important Translation Rules
- Translate every JSON value while preserving every JSON key exactly
- Return exactly one valid JSON object with the same keys as the input
- Do not add, remove, rename, reorder, or duplicate keys
- Output JSON only, without Markdown fences, greetings, or explanations

## Detailed Translation Instructions
- Treat each JSON value as an independent translation unit
- Use appropriate phonetic transcription for proper nouns when needed
- When a foreign word, technical term, proper noun, or mod-specific term does not have a natural Japanese equivalent, use a readable katakana rendering instead of forcing an unnatural kanji translation
- Preserve programming variables (e.g., %s, $1, \\") and special symbols as they are
- Maintain backslashes (\\\\) as they may be used as escape characters
- Do not edit any characters that appear to be special symbols
- For idiomatic expressions, prioritize conveying the meaning over literal translation
- When appropriate, adapt cultural references to be more relevant to the target language audience
- The text is about Minecraft mods. Keep this context in mind while translating`;

/**
 * Default user prompt template for translation
 * Contains the specific task with variables
 */
export const DEFAULT_USER_PROMPT = `Please translate the following English text into {language}.

## Input Text Information
- Number of entries: {line_count}
- The input below is a JSON object. Translate only its string values.
- Return one JSON object with the exact same keys and one translated string value for each key.
- Do not wrap the JSON in Markdown or add any commentary.

# JSON Content to Translate
{content}`;

/**
 * Default translation prompt template (legacy - for backward compatibility)
 * This combines system and user prompts into one
 */
export const DEFAULT_PROMPT_TEMPLATE = DEFAULT_SYSTEM_PROMPT + '\n\n' + DEFAULT_USER_PROMPT;
