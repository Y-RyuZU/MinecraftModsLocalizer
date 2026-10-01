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
  /** Extra system guidance for a retry after response validation fails. */
  systemPromptSupplement?: string;
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
    /** Per-request error returned by an asynchronous provider batch. */
    error?: string;
    /** Whether retrying this failed batch item synchronously is likely to help. */
    errorRetryable?: boolean;
  };
}

export interface TranslationBatchProgress {
  completed: number;
  total: number;
  status: string;
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
  /** Submit independent translations in one provider-managed async job, when supported. */
  translateBatch?(
    requests: TranslationRequest[],
    options?: {
      onProgress?: (progress: TranslationBatchProgress) => void;
      shouldCancel?: () => boolean;
      resumeJobId?: string;
      onSubmitted?: (id: string) => Promise<void>;
    }
  ): Promise<TranslationResponse[]>;
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
  /** Use the provider's asynchronous discounted batch API when available. */
  useBatchApi?: boolean;
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
- Preserve programming variables (e.g., %s, $1, \\") and special symbols as they are
- Maintain backslashes (\\\\) as they may be used as escape characters
- Preserve exact placeholders such as %s, %1$d, %%, $1, \${name}, and numeric tokens such as {0}; preserve markup tags such as <item>
- Treat Minecraft formatting codes such as §a, &6, &l, and &r as literal control tokens: copy each exactly once without translating, omitting, duplicating, or changing it. Keep each code with the same formatted phrase; when target-language word order changes, move the code with that phrase.
- Some mod guidebook markup wraps translatable words in braces (for example, {fish}); keep the braces but translate the words inside them. Do not confuse these with actual placeholders such as {0}.
- If the entire value is a visible label wrapped in angle brackets (for example, <Off> or <None>), translate the label but retain the brackets.
- Do not edit any characters that appear to be special symbols
- For idiomatic expressions, prioritize conveying the meaning over literal translation
- When appropriate, adapt cultural references to be more relevant to the target language audience
- Use terminology and transliteration natural to the selected target language and its Minecraft community
- Keep established localized terms when they exist, and preserve the original spelling of names or acronyms when that is clearest
- This is Minecraft mod localization. Values may be item, block, GUI, tooltip, configuration, quest, or guidebook text; use that game context rather than translating as generic prose`;

/** Added only for Japanese translations; do not apply these language-specific rules elsewhere. */
export const JAPANESE_LOCALIZATION_PROMPT = `## Japanese Localization Guidance
- Use natural Japanese terminology familiar to Minecraft players and mod communities
- If an imported, technical, or mod-specific term has no established natural Japanese equivalent, use readable katakana rather than forcing an unnatural kanji compound
- Do not arbitrarily convert mod names, acronyms, brands, or specialized terms into kanji
- Keep established Japanese terms when available; preserve original spelling when it is clearer`;

/**
 * Default user prompt template for translation
 * Contains the specific task with variables
 */
export const DEFAULT_USER_PROMPT = `Translate the string values in this JSON object into {language}:
{content}`;

/**
 * Default translation prompt template (legacy - for backward compatibility)
 * This combines system and user prompts into one
 */
export const DEFAULT_PROMPT_TEMPLATE = DEFAULT_SYSTEM_PROMPT + '\n\n' + DEFAULT_USER_PROMPT;
