import { LLMAdapter, LLMConfig, TranslationRequest, TranslationResponse, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "../types/llm";
import { DEFAULT_API_CONFIG } from "../types/config";

/**
 * Base LLM Adapter class
 * Provides common functionality for all LLM adapters
 */
export abstract class BaseLLMAdapter implements LLMAdapter {
  /** Unique identifier for the adapter */
  public abstract id: string;
  
  /** Display name for the adapter */
  public abstract name: string;
  
  /** Whether the adapter requires an API key */
  public abstract requiresApiKey: boolean;
  
  /** Configuration for the adapter */
  protected config: LLMConfig;

  /**
   * Constructor
   * @param config LLM configuration
   */
  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Translate content using the LLM service
   * @param request Translation request
   * @returns Translation response
   */
  public abstract translate(request: TranslationRequest): Promise<TranslationResponse>;

  /**
   * Validate API key
   * @param apiKey API key to validate
   * @returns Whether the API key is valid
   */
  public abstract validateApiKey(apiKey: string): Promise<boolean>;

  /**
   * Get the maximum chunk size recommended for this LLM
   * @returns Maximum chunk size
   */
  public getMaxChunkSize(): number {
    return DEFAULT_API_CONFIG.chunkSize;
  }

  /**
   * Get the maximum token limit for this LLM provider
   * @returns Maximum tokens per chunk
   */
  public getMaxTokensPerChunk(): number {
    // Very conservative limit to prevent token overflow across all models
    // Individual adapters can override this for model-specific limits
    return 3000;
  }

  /**
   * Get provider-specific token overhead estimation
   * @returns Token overhead for prompts and formatting
   */
  public getTokenOverhead(): { system: number; user: number; response: number } {
    return {
      system: 100,
      user: 50,
      response: 30
    };
  }

  /**
   * Get the maximum number of retries
   * @returns Maximum number of retries
   */
  protected getMaxRetries(): number {
    return this.config.maxRetries ?? DEFAULT_API_CONFIG.maxRetries;
  }

  /**
   * Get the system prompt
   * @param customSystemPrompt Optional custom system prompt
   * @returns System prompt
   */
  protected getSystemPrompt(customSystemPrompt?: string): string {
    // Use custom system prompt if provided
    if (customSystemPrompt) {
      return customSystemPrompt;
    }
    
    // Use config system prompt if available
    if (this.config.systemPrompt) {
      return this.config.systemPrompt;
    }
    
    // If using legacy promptTemplate, extract system part (everything before user task)
    if (this.config.promptTemplate) {
      const userMarker = "Please translate the following";
      const systemEndIdx = this.config.promptTemplate.indexOf(userMarker);
      if (systemEndIdx > 0) {
        return this.config.promptTemplate.substring(0, systemEndIdx).trim();
      }
    }
    
    // Default system prompt
    return DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * Get the user prompt template
   * @param customUserPrompt Optional custom user prompt template
   * @returns User prompt template
   */
  protected getUserPromptTemplate(customUserPrompt?: string): string {
    // Use custom user prompt if provided
    if (customUserPrompt) {
      return customUserPrompt;
    }
    
    // Use config user prompt if available
    if (this.config.userPrompt) {
      return this.config.userPrompt;
    }
    
    // If using legacy promptTemplate, extract user part
    if (this.config.promptTemplate) {
      const userMarker = "Please translate the following";
      const userStartIdx = this.config.promptTemplate.indexOf(userMarker);
      if (userStartIdx >= 0) {
        return this.config.promptTemplate.substring(userStartIdx);
      }
    }
    
    // Default user prompt
    return DEFAULT_USER_PROMPT;
  }

  /**
   * Format the user prompt with variables
   * @param content Content to translate
   * @param targetLanguage Target language
   * @param customUserPrompt Optional custom user prompt template
   * @returns Formatted user prompt
   */
  protected formatUserPrompt(
    content: Record<string, string>,
    targetLanguage: string,
    customUserPrompt?: string
  ): string {
    const userPromptTemplate = this.getUserPromptTemplate(customUserPrompt);
    const formatted = userPromptTemplate
      .replace(/\{\{\s*(?:language|targetLanguage)\s*\}\}|\{language\}/gi, targetLanguage)
      .replace(/\{\{\s*line_count\s*\}\}|\{line_count\}/g, String(Object.keys(content).length))
      .replace(/\{\{\s*content\s*\}\}|\{content\}/g, JSON.stringify(content));

    return /^ja(?:[_-]|$)/i.test(targetLanguage.trim())
      ? `${formatted}\n\nWhen translating into Japanese, use natural Japanese. If a foreign or coined term has no suitable Japanese equivalent, keep it in katakana instead of forcing an unnatural kanji translation.`
      : formatted;
  }

  /**
   * Format the prompt for translation (legacy method for backward compatibility)
   * @param content Content to translate
   * @param targetLanguage Target language
   * @param promptTemplate Custom prompt template (optional)
   * @returns Formatted prompt
   */
  protected formatPrompt(
    content: Record<string, string>,
    targetLanguage: string,
    promptTemplate?: string
  ): string {
    const effectivePromptTemplate = promptTemplate || this.config.promptTemplate;
    
    if (!effectivePromptTemplate) {
      throw new Error("No prompt template provided");
    }

    const contentLines = Object.entries(content).map(([key, value]) => `${key}: ${value}`);
    const lineCount = contentLines.length;

    let prompt = effectivePromptTemplate
      .replace("{language}", targetLanguage)
      .replace("{line_count}", lineCount.toString());

    // Add the content to translate if not already in template
    if (!prompt.includes("{content}")) {
      prompt += "\n\n# Content to Translate\n";
      contentLines.forEach(line => {
        prompt += `${line}\n`;
      });
    } else {
      // Replace content placeholder
      const formattedContent = contentLines.join('\n');
      prompt = prompt.replace("{content}", formattedContent);
    }

    return prompt;
  }

  /**
   * Parse the response from the LLM
   * @param response Raw response from the LLM
   * @returns Parsed translation response
   */
  protected parseResponse(
    response: string
  ): Record<string, string> {
    const parsed: unknown = JSON.parse(response.trim());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("LLM response must be a JSON object");
    }
    for (const value of Object.values(parsed)) {
      if (typeof value !== "string") {
        throw new Error("LLM response JSON values must all be strings");
      }
    }
    return parsed as Record<string, string>;
  }
}
