import { DEFAULT_PROMPT_TEMPLATE, LLMConfig, TranslationRequest, TranslationResponse } from "../types/llm";
import { DEFAULT_MODELS, DEFAULT_API_CONFIG } from "../types/config";
import { BaseLLMAdapter } from "./base-llm-adapter";
import { invoke } from "@tauri-apps/api/core";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

/**
 * Gemini API Adapter
 * Implements the LLM Adapter interface for Google Gemini API
 */
export class GeminiAdapter extends BaseLLMAdapter {
  /** Unique identifier for the adapter */
  public id = "gemini";
  
  /** Display name for the adapter */
  public name = "Google Gemini";
  
  /** Whether the adapter requires an API key */
  public requiresApiKey = true;

  /**
   * Constructor
   * @param config Gemini configuration
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
   * Translate content using Gemini API
   * Note: Implicit caching is automatic for Gemini 2.5 models.
   * For Gemini 1.5 models, explicit caching would require separate cache management.
   * @param request Translation request
   * @returns Translation response
   */
  public async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();
    
    // Check if API key is defined and not empty
    if (!this.config.apiKey) {
      await this.logError("Gemini API key is not configured");
      throw new Error("Gemini API key is not configured. Please set your API key in the settings.");
    }
    
    // Get system and user prompts
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.formatUserPrompt(
      request.content,
      request.targetLanguage
    );
    
    // Initialize Gemini client
    const genAI = new GoogleGenerativeAI(this.config.apiKey);
    
    const model = this.config.model || DEFAULT_MODELS.google;
    
    // Get the generative model
    const generativeModel = genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: this.config.temperature ?? DEFAULT_API_CONFIG.temperature,
        maxOutputTokens: 4096,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
    
    await this.logApiRequest(`Sending request to Gemini API (model: ${model})`);
    
    // Make the API request with retries
    let retries = 0;
    const maxRetries = this.getMaxRetries();
    
    while (retries <= maxRetries) {
      try {
        await this.logApiRequest(`API request attempt ${retries + 1}/${maxRetries + 1}`);
        
        const result = await generativeModel.generateContent(userPrompt);
        const response = await result.response;
        
        await this.logApiRequest(`API request successful`);
        
        const translationText = response.text().trim();
        
        if (!translationText) {
          const errorMessage = "Empty response from Gemini API";
          await this.logError(errorMessage);
          throw new Error(errorMessage);
        }
        
        // Parse the translation text into key-value pairs
        const translatedContent = this.parseResponse(translationText, request.content);
        
        // Calculate time taken
        const timeTaken = Date.now() - startTime;
        
        // Get token usage if available
        const tokensUsed = response.usageMetadata?.totalTokenCount;
        const promptTokens = response.usageMetadata?.promptTokenCount;
        const cachedTokens = response.usageMetadata?.cachedContentTokenCount || 0;
        
        // Log cache information if available (automatic for Gemini 2.5 models)
        const cacheInfo = cachedTokens > 0 
          ? ` (cached: ${cachedTokens}/${promptTokens} prompt tokens)`
          : '';
        
        await this.logApiRequest(`Translation completed in ${timeTaken}ms${cacheInfo}`);
        
        // Return the translation response
        return {
          content: translatedContent,
          metadata: {
            tokensUsed,
            timeTaken,
            model
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.logError(`API request failed: ${errorMessage}`);
        
        // Check for rate limit errors
        if (errorMessage.includes("429") || errorMessage.includes("quota")) {
          const waitTime = 1000 * (retries + 1);
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
    
    const errorMessage = "Failed to get response from Gemini API after retries";
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
      await this.logApiRequest("Validating Gemini API key");
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // Try to generate a simple response as a validation check
      await model.generateContent("Hi");
      
      await this.logApiRequest("API key validation successful");
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logError(`API key validation failed: ${errorMessage}`);
      return false;
    }
  }
}