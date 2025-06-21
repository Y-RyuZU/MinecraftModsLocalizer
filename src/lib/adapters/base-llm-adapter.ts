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
    const contentLines = Object.entries(content).map(([key, value]) => `${key}: ${value}`);
    const lineCount = contentLines.length;
    
    // Format content
    const formattedContent = contentLines.join('\n');
    
    // Replace variables
    return userPromptTemplate
      .replace("{language}", targetLanguage)
      .replace("{line_count}", lineCount.toString())
      .replace("{content}", formattedContent);
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
