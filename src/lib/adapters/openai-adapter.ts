import { DEFAULT_promptTemplate, LLMConfig, TranslationRequest, TranslationResponse } from "../types/llm";
import { BaseLLMAdapter } from "./base-llm-adapter";
import { invoke } from "@tauri-apps/api/core";

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
  
  /** Default model to use */
  private readonly DEFAULT_MODEL = "gpt-4o-mini-2024-07-18";
  
  /** Default API URL */
  private readonly DEFAULT_API_URL = "https://api.openai.com/v1/chat/completions";
  
  /** Default chunk size for this model */
  protected readonly DEFAULT_CHUNK_SIZE = 50;

  /**
   * Constructor
   * @param config OpenAI configuration
   */
  constructor(config: LLMConfig) {
    super({
      ...config,
      promptTemplate: config.promptTemplate || DEFAULT_promptTemplate,
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
    
    // Format the prompt
    const prompt = this.formatPrompt(
      request.content,
      request.targetLanguage,
      request.promptTemplate
    );
    
    // Prepare the API request
    const apiUrl = this.config.baseUrl || this.DEFAULT_API_URL;
    const model = this.config.model || this.DEFAULT_MODEL;
    
    const requestBody = {
      model,
      messages: [
        {
          role: "system",
          content: "You are a professional translator specializing in Minecraft mods and gaming content."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4096
    };
    
    await this.logApiRequest(`Sending request to OpenAI API (model: ${model})`);
    
    // Make the API request
    let response;
    let retries = 0;
    const maxRetries = this.getMaxRetries();
    
    while (retries <= maxRetries) {
      try {
        await this.logApiRequest(`API request attempt ${retries + 1}/${maxRetries + 1}`);
        
        response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.config.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          await this.logApiRequest(`API request successful (status: ${response.status})`);
          break;
        }
        
        // If rate limited, wait and retry
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * (retries + 1);
          await this.logApiRequest(`Rate limited, waiting ${waitTime}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }
        
        // For other errors, throw
        const errorData = await response.json();
        const errorMessage = `OpenAI API error: ${errorData.error?.message || response.statusText}`;
        await this.logError(errorMessage);
        throw new Error(errorMessage);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.logError(`API request failed: ${errorMessage}`);
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        retries++;
        await this.logApiRequest(`Retrying in ${1000 * retries}ms (attempt ${retries + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    
    if (!response || !response.ok) {
      const errorMessage = "Failed to get response from OpenAI API after retries";
      await this.logError(errorMessage);
      throw new Error(errorMessage);
    }
    
    // Parse the response
    const responseData = await response.json();
    const translationText = responseData.choices[0]?.message?.content?.trim();
    
    if (!translationText) {
      const errorMessage = "Empty response from OpenAI API";
      await this.logError(errorMessage);
      throw new Error(errorMessage);
    }
    
    // Parse the translation text into key-value pairs
    const translatedContent = this.parseResponse(translationText, request.content);
    
    // Calculate time taken
    const timeTaken = Date.now() - startTime;
    
    await this.logApiRequest(`Translation completed in ${timeTaken}ms (tokens: ${responseData.usage?.total_tokens})`);
    
    // Return the translation response
    return {
      content: translatedContent,
      metadata: {
        tokensUsed: responseData.usage?.total_tokens,
        timeTaken,
        model: responseData.model
      }
    };
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
      
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });
      
      const isValid = response.ok;
      
      if (isValid) {
        await this.logApiRequest("API key validation successful");
      } else {
        await this.logError(`API key validation failed (status: ${response.status})`);
      }
      
      return isValid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logError(`API key validation failed: ${errorMessage}`);
      return false;
    }
  }
}
