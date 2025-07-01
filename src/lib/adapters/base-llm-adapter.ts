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
    // Default conservative limit that works for most models
    return 5000;
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
    
    // Split the response into lines and filter out empty lines
    const allLines = response.trim().split("\n").filter(line => line.trim() !== "");
    
    // First approach: Try to extract all lines that match the exact key format
    for (const key of originalKeys) {
      for (const line of allLines) {
        const keyValueMatch = line.match(new RegExp(`^${key}:\\s*(.+)$`));
        if (keyValueMatch) {
          translatedContent[key] = keyValueMatch[1].trim();
          break; // Found this key, move to next
        }
      }
    }
    
    // If we found all keys using exact matching, return
    if (Object.keys(translatedContent).length === originalKeys.length) {
      return translatedContent;
    }
    
    // Second approach: Handle cases where response doesn't include keys
    // Try to filter out markdown blocks, explanations, etc.
    const filteredLines = allLines.filter(line => {
      const trimmed = line.trim();
      
      // Skip markdown code blocks
      if (trimmed.startsWith('```') || trimmed.endsWith('```')) {
        return false;
      }
      
      // Skip common explanatory patterns
      if (trimmed.toLowerCase().includes('translation') || 
          trimmed.toLowerCase().includes('here') ||
          trimmed.toLowerCase().includes('translated') ||
          trimmed.startsWith('#') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('-')) {
        return false;
      }
      
      return true;
    });
    
    // Reset and try positional matching with filtered lines
    for (const key of Object.keys(translatedContent)) {
      delete translatedContent[key];
    }
    
    // Use the first N filtered lines that could be translations
    const candidateLines = filteredLines.slice(0, originalKeys.length);
    
    for (let i = 0; i < originalKeys.length && i < candidateLines.length; i++) {
      const key = originalKeys[i];
      const line = candidateLines[i];
      
      // Check if line includes the key
      const keyValueMatch = line.match(new RegExp(`^${key}:\\s*(.+)$`));
      
      if (keyValueMatch) {
        translatedContent[key] = keyValueMatch[1].trim();
      } else {
        // Use the entire line as the translation
        translatedContent[key] = line.trim();
      }
    }
    
    // Final validation
    if (Object.keys(translatedContent).length !== originalKeys.length) {
      // Log the response for debugging
      console.warn('Failed to parse LLM response:', {
        originalKeys,
        allLinesCount: allLines.length,
        filteredLinesCount: filteredLines.length,
        parsedKeys: Object.keys(translatedContent),
        response: response.substring(0, 500) + (response.length > 500 ? '...' : '')
      });
      
      throw new Error(
        `Could not parse all translations. Expected ${originalKeys.length} translations but only found ${Object.keys(translatedContent).length}. Response had ${allLines.length} lines (${filteredLines.length} after filtering).`
      );
    }

    return translatedContent;
  }
}
