import { DEFAULT_PROMPT_TEMPLATE, LLMConfig, TranslationRequest, TranslationResponse } from "../types/llm";
import { DEFAULT_MODELS, DEFAULT_API_CONFIG } from "../types/config";
import { BaseLLMAdapter } from "./base-llm-adapter";
import { invoke } from "@tauri-apps/api/core";
import OpenAI from "openai";

/**
 * OpenAI API Adapter
 * Implements the LLM Adapter interface for OpenAI API
 */
export class OpenAIAdapter extends BaseLLMAdapter {
  /** Unique identifier for the adapter */
  public id = "openai";
  
  /** Display name for the adapter */
  public name = "OpenAI";
  
  /** Whether the adapter requires an API key */
  public requiresApiKey = true;

  /**
   * Constructor
   * @param config OpenAI configuration
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
      await invoke('log_error', { message, processType: "API_REQUEST" });
    } catch (error) {
      console.error('Failed to log error message:', error);
    }
  }

  /**
   * Translate content using OpenAI API
   * @param request Translation request
   * @returns Translation response
   */
  public async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    
    // Check if API key is defined and not empty
    if (!this.config.apiKey) {
      await this.logError("OpenAI API key is not configured");
      throw new Error("OpenAI API key is not configured. Please set your API key in the settings.");
    }
    
    // Get system and user prompts
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.formatUserPrompt(
      request.content,
      request.targetLanguage
    );
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl || undefined,
      dangerouslyAllowBrowser: true // Required for browser environments
    });
    
    const model = this.config.model || DEFAULT_MODELS.openai;
    
    await this.logApiRequest(`Sending request to OpenAI API (model: ${model})`);
    
    // Make the API request with retries
    let retries = 0;
    const maxRetries = this.getMaxRetries();
    
    while (retries <= maxRetries) {
      try {
        await this.logApiRequest(`API request attempt ${retries + 1}/${maxRetries + 1}`);
        
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ],
          temperature: this.config.temperature ?? DEFAULT_API_CONFIG.temperature,
          user: "minecraft-mod-localizer"
        });
        
        await this.logApiRequest(`API request successful`);
        
        const translationText = completion.choices[0]?.message?.content?.trim();
        
        if (!translationText) {
          const errorMessage = "Empty response from OpenAI API";
          await this.logError(errorMessage);
          throw new Error(errorMessage);
        }
        
        // Parse the translation text into key-value pairs
        const translatedContent = this.parseResponse(translationText, request.content);
        
        // Calculate time taken
        const timeTaken = Date.now() - startTime;
        
        const usage = completion.usage as Record<string, unknown> | undefined;
        const promptTokensDetails = usage?.prompt_tokens_details as Record<string, unknown> | undefined;
        const cachedTokens = (promptTokensDetails?.cached_tokens as number) || 0;
        const cacheInfo = cachedTokens > 0 
          ? ` (cached: ${cachedTokens}/${completion.usage?.prompt_tokens} prompt tokens)`
          : '';
        await this.logApiRequest(`Translation completed in ${timeTaken}ms${cacheInfo}`);
        
        // Return the translation response
        return {
          content: translatedContent,
          metadata: {
            tokensUsed: completion.usage?.total_tokens,
            timeTaken,
            model: completion.model
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.logError(`API request failed: ${errorMessage}`);
        
        // Check for rate limit errors
        if (error instanceof OpenAI.APIError && error.status === 429) {
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
    
    const errorMessage = "Failed to get response from OpenAI API after retries";
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
      await this.logApiRequest("Validating OpenAI API key");
      
      const openai = new OpenAI({
        apiKey,
        baseURL: this.config.baseUrl || undefined,
        dangerouslyAllowBrowser: true
      });
      
      // Try to list models as a validation check
      await openai.models.list();
      
      await this.logApiRequest("API key validation successful");
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logError(`API key validation failed: ${errorMessage}`);
      return false;
    }
  }
}