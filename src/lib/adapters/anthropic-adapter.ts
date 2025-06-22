import { DEFAULT_PROMPT_TEMPLATE, LLMConfig, TranslationRequest, TranslationResponse } from "../types/llm";
import { DEFAULT_MODELS, DEFAULT_API_URLS, DEFAULT_API_CONFIG } from "../types/config";
import { BaseLLMAdapter } from "./base-llm-adapter";
import { invoke } from "@tauri-apps/api/core";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic API Adapter
 * Implements the LLM Adapter interface for Anthropic API
 */
export class AnthropicAdapter extends BaseLLMAdapter {
  /** Unique identifier for the adapter */
  public id = "anthropic";
  
  /** Display name for the adapter */
  public name = "Anthropic";
  
  /** Whether the adapter requires an API key */
  public requiresApiKey = true;

  /**
   * Constructor
   * @param config Anthropic configuration
   */
  constructor(config: LLMConfig) {
    super({
      ...config,
      promptTemplate: config.promptTemplate || DEFAULT_PROMPT_TEMPLATE,
    });
  }

  /**
   * Log an API request message to the backend
   * @param message Message to log
   */
  private async logApiRequest(message: string): Promise<void> {
    try {
      await invoke('log_api_request', { message });
    } catch (error) {
      console.error('Failed to log API request message:', error);
    }
  }

  /**
   * Log an error message to the backend
   * @param message Error message
   */
  private async logError(message: string): Promise<void> {
    try {
      await invoke('log_error', { message, process_type: "API_REQUEST" });
    } catch (error) {
      console.error('Failed to log error message:', error);
    }
  }


  /**
   * Translate content using Anthropic API
   * @param request Translation request
   * @returns Translation response
   */
  public async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    
    // Check if API key is defined and not empty
    if (!this.config.apiKey) {
      await this.logError("Anthropic API key is not configured");
      throw new Error("Anthropic API key is not configured. Please set your API key in the settings.");
    }
    
    // Get system prompt and user prompt
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.formatUserPrompt(
      request.content,
      request.targetLanguage
    );
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl || DEFAULT_API_URLS.anthropic,
      dangerouslyAllowBrowser: true // Required for browser environments
    });
    
    const model = this.config.model || DEFAULT_MODELS.anthropic;
    
    await this.logApiRequest(`Sending request to Anthropic API (model: ${model})`);
    
    // Make the API request with retries
    let retries = 0;
    const maxRetries = this.getMaxRetries();
    
    while (retries <= maxRetries) {
      try {
        await this.logApiRequest(`API request attempt ${retries + 1}/${maxRetries + 1}`);
        
        const completion = await anthropic.messages.create({
          model,
          max_tokens: DEFAULT_API_CONFIG.maxTokens,
          temperature: DEFAULT_API_CONFIG.temperature,
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: {
                type: "ephemeral"
              }
            }
          ],
          messages: [
            {
              role: "user",
              content: userPrompt
            }
          ]
        });
        
        await this.logApiRequest(`API request successful`);
        
        // Extract text content from the response
        let translationText = "";
        for (const block of completion.content) {
          if (block.type === "text") {
            translationText += block.text;
          }
        }
        
        translationText = translationText.trim();
        
        if (!translationText) {
          const errorMessage = "Empty response from Anthropic API";
          await this.logError(errorMessage);
          throw new Error(errorMessage);
        }
        
        // Parse the translation text into key-value pairs
        const translatedContent = this.parseResponse(translationText, request.content);
        
        // Calculate time taken
        const timeTaken = Date.now() - startTime;
        
        // Log cache usage information if available
        const usage = completion.usage as unknown as Record<string, unknown>;
        const cacheCreationTokens = (usage?.cache_creation_input_tokens as number) || 0;
        const cacheReadTokens = (usage?.cache_read_input_tokens as number) || 0;
        let cacheInfo = '';
        if (cacheCreationTokens > 0) {
          cacheInfo += ` (cache write: ${cacheCreationTokens} tokens)`;
        }
        if (cacheReadTokens > 0) {
          cacheInfo += ` (cache hit: ${cacheReadTokens} tokens)`;
        }
        
        await this.logApiRequest(`Translation completed in ${timeTaken}ms${cacheInfo}`);
        
        // Return the translation response
        return {
          content: translatedContent,
          metadata: {
            tokensUsed: completion.usage.input_tokens + completion.usage.output_tokens,
            timeTaken,
            model: completion.model
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.logError(`API request failed: ${errorMessage}`);
        
        // Check for rate limit errors
        if (error instanceof Anthropic.APIError && error.status === 429) {
          const retryAfter = error.headers?.['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * (retries + 1);
          await this.logApiRequest(`Rate limited, waiting ${waitTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        retries++;
        await this.logApiRequest(`Retrying in ${1000 * retries}ms (attempt ${retries + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    
    const errorMessage = "Failed to get response from Anthropic API after retries";
    await this.logError(errorMessage);
    throw new Error(errorMessage);
  }


  /**
   * Validate API key
   * @param apiKey API key to validate
   * @returns Whether the API key is valid
   */
  public async validateApiKey(apiKey: string): Promise<boolean> {
    // Check if API key is defined and not empty
    if (!apiKey) {
      return false;
    }
    
    try {
      await this.logApiRequest("Validating Anthropic API key");
      
      const anthropic = new Anthropic({
        apiKey,
        baseURL: this.config.baseUrl || DEFAULT_API_URLS.anthropic,
        dangerouslyAllowBrowser: true
      });
      
      // Try to create a simple message as a validation check
      await anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }]
      });
      
      await this.logApiRequest("API key validation successful");
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logError(`API key validation failed: ${errorMessage}`);
      return false;
    }
  }
}