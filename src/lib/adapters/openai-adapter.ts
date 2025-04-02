import { DEFAULT_PROMPT_TEMPLATE, LLMConfig, TranslationRequest, TranslationResponse } from "../types/llm";
import { BaseLLMAdapter } from "./base-llm-adapter";

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
  private readonly DEFAULT_MODEL = "gpt-3.5-turbo";
  
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
      prompt_template: config.prompt_template || DEFAULT_PROMPT_TEMPLATE,
    });
  }

  /**
   * Translate content using OpenAI API
   * @param request Translation request
   * @returns Translation response
   */
  public async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    
    // Format the prompt
    const prompt = this.formatPrompt(
      request.content,
      request.target_language,
      request.prompt_template
    );
    
    // Prepare the API request
    const apiUrl = this.config.base_url || this.DEFAULT_API_URL;
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
    
    // Make the API request
    let response;
    let retries = 0;
    const maxRetries = this.getMaxRetries();
    
    while (retries <= maxRetries) {
      try {
        response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.config.api_key}`
          },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          break;
        }
        
        // If rate limited, wait and retry
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * (retries + 1);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }
        
        // For other errors, throw
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      } catch (error) {
        if (retries >= maxRetries) {
          throw error;
        }
        retries++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    
    if (!response || !response.ok) {
      throw new Error("Failed to get response from OpenAI API after retries");
    }
    
    // Parse the response
    const responseData = await response.json();
    const translationText = responseData.choices[0]?.message?.content?.trim();
    
    if (!translationText) {
      throw new Error("Empty response from OpenAI API");
    }
    
    // Parse the translation text into key-value pairs
    const translatedContent = this.parseResponse(translationText, request.content);
    
    // Calculate time taken
    const timeTaken = Date.now() - startTime;
    
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
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}
