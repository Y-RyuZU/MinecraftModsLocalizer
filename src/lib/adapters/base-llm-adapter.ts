import { LLMAdapter, LLMConfig, TranslationRequest, TranslationResponse, DEFAULT_LANGUAGES, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT, JAPANESE_LOCALIZATION_PROMPT } from "../types/llm";
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
   * Get the maximum number of retries
   * @returns Maximum number of retries
   */
  protected getMaxRetries(): number {
    return this.config.maxRetries ?? DEFAULT_API_CONFIG.maxRetries;
  }

  /**
   * Get the system prompt
   * @param targetLanguage Target language
   * @param customSystemPrompt Optional custom system prompt
   * @returns System prompt
   */
  protected getSystemPrompt(targetLanguage: string, systemPromptSupplement?: string): string {
    let systemPrompt: string;
    if (this.config.systemPrompt) {
      // Use config system prompt if available
      systemPrompt = this.config.systemPrompt;
    } else {
      // If using legacy promptTemplate, extract system part (everything before user task)
      const userMarker = "Please translate the following";
      const systemEndIdx = this.config.promptTemplate?.indexOf(userMarker) ?? -1;
      if (systemEndIdx > 0) {
        systemPrompt = this.config.promptTemplate!.substring(0, systemEndIdx).trim();
      } else {
        systemPrompt = DEFAULT_SYSTEM_PROMPT;
      }
    }

    if (systemPromptSupplement) systemPrompt += `\n\n${systemPromptSupplement}`;
    return isJapaneseLanguage(targetLanguage)
      ? systemPrompt + "\n\n" + JAPANESE_LOCALIZATION_PROMPT
      : systemPrompt;
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
    const lineCount = Object.keys(content).length;

    // Serialize the whole object so keys containing punctuation, newlines, or
    // quotes cannot be confused with the translated text.
    const formattedContent = JSON.stringify(content);

    // Replace variables
    const variables: Record<string, string> = {
      targetLanguage,
      language: DEFAULT_LANGUAGES.find(({ id }) => id.toLowerCase() === targetLanguage.trim().toLowerCase().replace(/-/g, "_"))?.name ?? targetLanguage,
      line_count: lineCount.toString(),
      content: formattedContent
    };
    return userPromptTemplate.replace(/\{\{(targetLanguage|language|line_count|content)\}\}|\{(targetLanguage|language|line_count|content)\}/g,
      (_match, doubleKey, singleKey) => variables[doubleKey || singleKey]);
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
   * @param originalContent Original content keys
   * @returns Parsed translation response
   */
  protected parseResponse(
    response: string,
    originalContent: Record<string, string>
  ): Record<string, string> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error("Invalid JSON translation response");
    }
    return this.validateJsonTranslation(parsed, originalContent);
  }

  /** Accept only the exact key:value JSON object requested from the model. */
  private validateJsonTranslation(
    parsed: unknown,
    originalContent: Record<string, string>
  ): Record<string, string> {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Translation response must be a JSON object");
    }

    const translated = parsed as Record<string, unknown>;
    const expectedKeys = Object.keys(originalContent).sort();
    const actualKeys = Object.keys(translated).sort();
    if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key, index) => key !== actualKeys[index])) {
      throw new Error("Invalid translation response schema (keys do not match input)");
    }
    if (actualKeys.some((key) => typeof translated[key] !== "string")) {
      throw new Error("Invalid translation response schema (values must be strings)");
    }
    return translated as Record<string, string>;
  }
}

function isJapaneseLanguage(language: string): boolean {
  const normalized = language.trim().toLowerCase().replace(/-/g, "_");
  return normalized === "ja" || normalized.startsWith("ja_") || normalized === "japanese" || normalized === "日本語";
}
