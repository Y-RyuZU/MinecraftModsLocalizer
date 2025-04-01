import { LLMAdapter, LLMConfig, TranslationRequest, TranslationResponse } from "../types/llm";

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
  
  /** Default maximum retries */
  protected readonly DEFAULT_MAX_RETRIES = 5;
  
  /** Default chunk size */
  protected readonly DEFAULT_CHUNK_SIZE = 50;

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
    return this.DEFAULT_CHUNK_SIZE;
  }

  /**
   * Get the maximum number of retries
   * @returns Maximum number of retries
   */
  protected getMaxRetries(): number {
    return this.config.maxRetries ?? this.DEFAULT_MAX_RETRIES;
  }

  /**
   * Format the prompt for translation
   * @param content Content to translate
   * @param targetLanguage Target language
   * @param prompt_template Custom prompt template (optional)
   * @returns Formatted prompt
   */
  protected formatPrompt(
    content: Record<string, string>,
    targetLanguage: string,
    prompt_template?: string
  ): string {
    const promptTemplate = prompt_template || this.config.prompt_template;
    
    if (!promptTemplate) {
      throw new Error("No prompt template provided");
    }

    const contentLines = Object.entries(content).map(([key, value]) => `${key}: ${value}`);
    const lineCount = contentLines.length;

    let prompt = promptTemplate
      .replace("{language}", targetLanguage)
      .replace("{line_count}", lineCount.toString());

    // Add the content to translate
    prompt += "\n\n# Content to Translate\n";
    contentLines.forEach(line => {
      prompt += `${line}\n`;
    });

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
    const originalKeys = Object.keys(originalContent);
    const translatedContent: Record<string, string> = {};
    
    // Split the response into lines and process each line
    const responseLines = response.trim().split("\n");
    
    // Basic validation - check if we have the same number of lines
    if (responseLines.length !== originalKeys.length) {
      throw new Error(
        `Response line count (${responseLines.length}) does not match original content line count (${originalKeys.length})`
      );
    }

    // Process each line
    for (let i = 0; i < originalKeys.length; i++) {
      const key = originalKeys[i];
      const line = responseLines[i];
      
      // Try to extract the translated value
      // First check if the line contains the key (format: "key: value")
      const keyValueMatch = line.match(new RegExp(`^${key}:\\s*(.+)$`));
      
      if (keyValueMatch) {
        // If the line contains the key, extract the value
        translatedContent[key] = keyValueMatch[1].trim();
      } else {
        // If the line doesn't contain the key, use the whole line as the value
        translatedContent[key] = line.trim();
      }
    }

    return translatedContent;
  }
}
