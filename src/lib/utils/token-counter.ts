/**
 * Token counter utility for estimating token usage in translation chunks
 * Uses word-based estimation as a proxy for actual token counting
 */

export interface TokenEstimationConfig {
  /** Word-to-token ratio multiplier (default: 1.3) */
  wordToTokenRatio: number;
  /** Additional tokens for JSON formatting overhead (default: 20) */
  jsonOverhead: number;
  /** Additional tokens for system prompt overhead (default: 100) */
  systemPromptOverhead: number;
  /** Additional tokens for user prompt overhead (default: 50) */
  userPromptOverhead: number;
  /** Additional tokens for response formatting overhead (default: 30) */
  responseOverhead: number;
}

export interface TokenEstimationResult {
  /** Estimated total tokens for content */
  contentTokens: number;
  /** Estimated tokens for prompt overhead */
  promptOverhead: number;
  /** Estimated tokens for response space */
  responseOverhead: number;
  /** Total estimated tokens */
  totalTokens: number;
  /** Number of words counted */
  wordCount: number;
  /** Number of entries in content */
  entryCount: number;
}

/** Default configuration for token estimation */
export const DEFAULT_TOKEN_CONFIG: TokenEstimationConfig = {
  wordToTokenRatio: 1.5, // More conservative estimate: 1 word ≈ 1.5 tokens
  jsonOverhead: 50,
  systemPromptOverhead: 300, // Increased for longer system prompts
  userPromptOverhead: 200, // Increased for formatting overhead
  responseOverhead: 100, // Increased for response space
};

/**
 * Estimate token count for translation content
 * @param content Content to translate (key-value pairs)
 * @param config Token estimation configuration
 * @returns Token estimation result
 */
export function estimateTokens(
  content: Record<string, string>,
  config: Partial<TokenEstimationConfig> = {}
): TokenEstimationResult {
  const effectiveConfig = { ...DEFAULT_TOKEN_CONFIG, ...config };
  
  // Count words in content
  let wordCount = 0;
  const entries = Object.entries(content);
  
  for (const [key, value] of entries) {
    // Count words in key and value
    wordCount += countWords(key);
    wordCount += countWords(value);
  }
  
  // Calculate token estimates
  const contentTokens = Math.ceil(wordCount * effectiveConfig.wordToTokenRatio);
  const promptOverhead = effectiveConfig.systemPromptOverhead + 
                        effectiveConfig.userPromptOverhead + 
                        effectiveConfig.jsonOverhead;
  const responseOverhead = effectiveConfig.responseOverhead;
  const totalTokens = contentTokens + promptOverhead + responseOverhead;
  
  return {
    contentTokens,
    promptOverhead,
    responseOverhead,
    totalTokens,
    wordCount,
    entryCount: entries.length,
  };
}

/**
 * Count words in a text string
 * @param text Text to count words in
 * @returns Number of words
 */
function countWords(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  // Split by whitespace and filter out empty strings
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Check if content would exceed token limit
 * @param content Content to check
 * @param maxTokens Maximum token limit
 * @param config Token estimation configuration
 * @returns True if content exceeds limit
 */
export function exceedsTokenLimit(
  content: Record<string, string>,
  maxTokens: number,
  config: Partial<TokenEstimationConfig> = {}
): boolean {
  const estimation = estimateTokens(content, config);
  return estimation.totalTokens > maxTokens;
}

/**
 * Calculate optimal chunk size based on token limits
 * @param content Sample content to analyze
 * @param maxTokens Maximum tokens per chunk
 * @param config Token estimation configuration
 * @returns Recommended number of entries per chunk
 */
export function calculateOptimalChunkSize(
  content: Record<string, string>,
  maxTokens: number,
  config: Partial<TokenEstimationConfig> = {}
): number {
  const entries = Object.entries(content);
  if (entries.length === 0) {
    return 1;
  }
  
  // Estimate tokens per entry based on average
  const estimation = estimateTokens(content, config);
  const tokensPerEntry = estimation.totalTokens / entries.length;
  
  // Calculate how many entries can fit within the limit
  const effectiveConfig = { ...DEFAULT_TOKEN_CONFIG, ...config };
  const promptOverhead = effectiveConfig.systemPromptOverhead + 
                        effectiveConfig.userPromptOverhead + 
                        effectiveConfig.jsonOverhead;
  const responseOverhead = effectiveConfig.responseOverhead;
  const availableTokensForContent = maxTokens - promptOverhead - responseOverhead;
  
  const entriesPerChunk = Math.floor(availableTokensForContent / (tokensPerEntry - (promptOverhead + responseOverhead) / entries.length));
  
  // Ensure at least 1 entry per chunk, but cap at reasonable maximum
  return Math.max(1, Math.min(entriesPerChunk, 100));
}

/**
 * Estimate token usage for a specific LLM provider
 * @param content Content to estimate
 * @param provider LLM provider name
 * @returns Token estimation with provider-specific adjustments
 */
export function estimateTokensForProvider(
  content: Record<string, string>,
  provider: 'openai' | 'anthropic' | 'gemini'
): TokenEstimationResult {
  // Provider-specific configurations with increased overhead estimates
  const providerConfigs: Record<string, Partial<TokenEstimationConfig>> = {
    openai: {
      wordToTokenRatio: 1.5, // More conservative ratio
      systemPromptOverhead: 300, // Increased for longer system prompts
      userPromptOverhead: 200, // Increased for formatting overhead
    },
    anthropic: {
      wordToTokenRatio: 1.4,
      systemPromptOverhead: 250,
      userPromptOverhead: 150,
    },
    gemini: {
      wordToTokenRatio: 1.6,
      systemPromptOverhead: 350,
      userPromptOverhead: 250,
    },
  };
  
  const config = providerConfigs[provider] || {};
  return estimateTokens(content, config);
}