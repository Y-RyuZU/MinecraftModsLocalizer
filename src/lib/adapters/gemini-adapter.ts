import { DEFAULT_PROMPT_TEMPLATE, LLMConfig, TranslationBatchProgress, TranslationRequest, TranslationResponse } from "../types/llm";
import { DEFAULT_MODELS, DEFAULT_API_CONFIG } from "../types/config";
import { BaseLLMAdapter } from "./base-llm-adapter";
import { invoke } from "@tauri-apps/api/core";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai/web";

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
      await invoke('log_error', { message, processType: "API_REQUEST" });
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
    const systemPrompt = this.getSystemPrompt(request.targetLanguage, request.systemPromptSupplement);
    const userPrompt = this.formatUserPrompt(
      request.content,
      request.targetLanguage
    );
    
    // Initialize Gemini client
    const genAI = new GoogleGenAI({
      apiKey: this.config.apiKey,
      httpOptions: {
        ...(this.config.baseUrl ? { baseUrl: this.config.baseUrl } : {}),
        // The TranslationService owns retry/backoff policy. The Gemini SDK
        // defaults to five attempts for 5xx/429 responses, which would make
        // one configured retry silently send several extra requests.
        retryOptions: { attempts: 1 }
      }
    });
    
    const model = this.config.model || DEFAULT_MODELS.gemini;
    
    await this.logApiRequest(`Sending request to Gemini API (model: ${model})`);
    
    try {
        
        const response = await genAI.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            ...(!model.startsWith("gemini-3.") && {
              temperature: this.config.temperature ?? DEFAULT_API_CONFIG.temperature
            }),
            // Do not impose an application-side cap that can truncate large JSON batches.
            // The provider applies the selected model's native output limit.
            responseMimeType: "application/json",
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
          },
        });
        
        await this.logApiRequest(`API request successful`);
        
        const translationText = (response.text || "").trim();
        
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
            model: response.modelVersion || model
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.logError(`API request failed: ${errorMessage}`);
        throw error;
      }
  }

  /** Submit translation chunks in one Gemini Batch API job. */
  public async translateBatch(
    requests: TranslationRequest[],
    options: {
      onProgress?: (progress: TranslationBatchProgress) => void;
      shouldCancel?: () => boolean;
    } = {}
  ): Promise<TranslationResponse[]> {
    if (!this.config.apiKey) throw new Error("Gemini API key is not configured");
    if (requests.length === 0) return [];

    const model = this.config.model || DEFAULT_MODELS.gemini;
    const genAI = new GoogleGenAI({
      apiKey: this.config.apiKey,
      httpOptions: {
        ...(this.config.baseUrl ? { baseUrl: this.config.baseUrl } : {}),
        retryOptions: { attempts: 1 }
      }
    });
    const inlinedRequests = requests.map((request, index) => ({
      contents: [{ role: "user" as const, parts: [{ text: this.formatUserPrompt(request.content, request.targetLanguage) }] }],
      config: {
        systemInstruction: this.getSystemPrompt(request.targetLanguage, request.systemPromptSupplement),
        ...(!model.startsWith("gemini-3.") && {
          temperature: this.config.temperature ?? DEFAULT_API_CONFIG.temperature
        }),
        responseMimeType: "application/json",
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      },
      metadata: { key: `mml-${index}` }
    }));
    const inputBytes = new TextEncoder().encode(JSON.stringify(inlinedRequests)).byteLength;
    if (inputBytes >= 20 * 1024 * 1024) {
      throw new Error("Gemini inline Batch API input must be smaller than 20 MB");
    }

    let batchName: string | undefined;
    try {
      await this.logApiRequest(`Submitting ${requests.length} chunks to Gemini Batch API (model: ${model})`);
      let batch = await genAI.batches.create({
        model,
        src: inlinedRequests,
        config: { displayName: `MML-${Date.now()}` }
      });
      batchName = batch.name;
      if (!batchName) throw new Error("Gemini Batch API did not return a job name");

      const terminalStates = new Set(["JOB_STATE_SUCCEEDED", "JOB_STATE_PARTIALLY_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"]);
      while (!terminalStates.has(batch.state || "")) {
        if (options.shouldCancel?.()) {
          await genAI.batches.cancel({ name: batchName });
          throw new Error(`Translation interrupted by user; Gemini batch ${batchName} cancellation requested`);
        }
        options.onProgress?.({ completed: 0, total: requests.length, status: batch.state || "unknown" });
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        batch = await genAI.batches.get({ name: batchName });
      }

      if (batch.state !== "JOB_STATE_SUCCEEDED" && batch.state !== "JOB_STATE_PARTIALLY_SUCCEEDED") {
        throw new Error(`Gemini batch ${batchName} ended with status ${batch.state || "unknown"}${batch.error ? `: ${JSON.stringify(batch.error)}` : ""}`);
      }
      const byIndex = new Map<number, TranslationResponse>();
      for (const result of batch.dest?.inlinedResponses || []) {
        const index = Number(result.metadata?.key?.match(/^mml-(\d+)$/)?.[1]);
        if (!Number.isInteger(index) || index < 0 || index >= requests.length) continue;
        if (result.error || !result.response) {
          const detail = result.error ? JSON.stringify(result.error) : "Gemini Batch API returned an empty response";
          byIndex.set(index, { content: {}, metadata: { model, error: detail, errorRetryable: !/invalid|malformed|unsupported/i.test(detail) } });
          continue;
        }
        try {
          const text = (
            result.response.text ||
            result.response.candidates?.flatMap((candidate) => candidate.content?.parts?.map((part) => part.text || "") || []).join("") ||
            ""
          ).trim();
          if (!text) throw new Error("Empty response from Gemini Batch API");
          byIndex.set(index, {
            content: this.parseResponse(text, requests[index].content),
            metadata: {
              model: result.response.modelVersion || model,
              tokensUsed: result.response.usageMetadata?.totalTokenCount
            }
          });
        } catch (error) {
          byIndex.set(index, {
            content: {},
            metadata: { model: result.response.modelVersion || model, error: error instanceof Error ? error.message : String(error) }
          });
        }
      }
      options.onProgress?.({ completed: requests.length, total: requests.length, status: batch.state || "completed" });
      await this.logApiRequest(`Gemini batch ${batchName} finished (${byIndex.size}/${requests.length} responses returned)`);
      return requests.map((_, index) => byIndex.get(index) ?? {
        content: {},
        metadata: { model, error: `Gemini batch ${batchName} omitted request mml-${index}` }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.logError(`Gemini batch ${batchName || "submission"} failed: ${message}`);
      throw error;
    }
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
      
      const genAI = new GoogleGenAI({ apiKey });

      // Try to generate a simple response as a validation check.
      await genAI.models.generateContent({
        model: DEFAULT_MODELS.gemini,
        contents: "Hi"
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
