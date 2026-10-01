import { DEFAULT_PROMPT_TEMPLATE, LLMConfig, TranslationBatchProgress, TranslationRequest, TranslationResponse } from "../types/llm";
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
      await invoke('log_error', { message, processType: "API_REQUEST" });
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
    const systemPrompt = this.getSystemPrompt(request.targetLanguage, request.systemPromptSupplement);
    const userPrompt = this.formatUserPrompt(
      request.content,
      request.targetLanguage
    );
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl || DEFAULT_API_URLS.anthropic,
      // TranslationService owns retry/backoff policy. Disable the SDK's
      // hidden retries so one configured retry is one actual HTTP request.
      maxRetries: 0,
      dangerouslyAllowBrowser: true // Required for browser environments
    });
    
    const model = this.config.model || DEFAULT_MODELS.anthropic;
    
    await this.logApiRequest(`Sending request to Anthropic API (model: ${model})`);
    
    try {
        
        const completion = await anthropic.messages.create({
          model,
          max_tokens: 4096,
          temperature: this.config.temperature ?? DEFAULT_API_CONFIG.temperature,
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
        throw error;
      }
  }

  /** Submit independent translation chunks through Anthropic's asynchronous Message Batches API. */
  public async translateBatch(
    requests: TranslationRequest[],
    options: {
      onProgress?: (progress: TranslationBatchProgress) => void;
      shouldCancel?: () => boolean;
    } = {}
  ): Promise<TranslationResponse[]> {
    if (!this.config.apiKey) throw new Error("Anthropic API key is not configured");
    if (requests.length > 100_000) throw new Error("An Anthropic Message Batch can contain at most 100,000 requests");

    const anthropic = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl || DEFAULT_API_URLS.anthropic,
      dangerouslyAllowBrowser: true,
      maxRetries: 0
    });
    const model = this.config.model || DEFAULT_MODELS.anthropic;
    const batchRequests = requests.map((request, index) => ({
      custom_id: `mml-${index}`,
      params: {
        model,
        max_tokens: 4096,
        temperature: this.config.temperature ?? DEFAULT_API_CONFIG.temperature,
        system: this.getSystemPrompt(request.targetLanguage, request.systemPromptSupplement),
        messages: [{ role: "user" as const, content: this.formatUserPrompt(request.content, request.targetLanguage) }]
      }
    }));

    let batchId: string | undefined;
    try {
      await this.logApiRequest(`Submitting ${requests.length} chunks to Anthropic Message Batches API (model: ${model})`);
      let batch = await anthropic.messages.batches.create({ requests: batchRequests });
      batchId = batch.id;
      const isTerminal = () => batch.processing_status === "ended";
      while (!isTerminal()) {
        if (options.shouldCancel?.()) {
          await anthropic.messages.batches.cancel(batch.id);
          throw new Error(`Translation interrupted by user; Anthropic batch ${batch.id} cancellation requested`);
        }
        const counts = batch.request_counts;
        options.onProgress?.({
          completed: counts.succeeded + counts.errored + counts.canceled + counts.expired,
          total: requests.length,
          status: batch.processing_status
        });
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        batch = await anthropic.messages.batches.retrieve(batch.id);
      }

      const byIndex = new Map<number, TranslationResponse>();
      const results = await anthropic.messages.batches.results(batch.id);
      for await (const item of results) {
        const index = Number(item.custom_id.match(/^mml-(\d+)$/)?.[1]);
        if (!Number.isInteger(index) || index < 0 || index >= requests.length) continue;
        if (item.result.type !== "succeeded") {
          const detail = item.result.type === "errored" ? item.result.error.error.message : item.result.type;
          const retryable = item.result.type === "errored" && item.result.error.error.type !== "invalid_request_error";
          byIndex.set(index, { content: {}, metadata: { model, error: detail, errorRetryable: retryable } });
          continue;
        }
        const message = item.result.message;
        const text = message.content.filter((part) => part.type === "text").map((part) => part.text).join("").trim();
        try {
          if (!text) throw new Error("Empty response from Anthropic Batch API");
          byIndex.set(index, {
            content: this.parseResponse(text, requests[index].content),
            metadata: { model: message.model, tokensUsed: message.usage.input_tokens + message.usage.output_tokens }
          });
        } catch (error) {
          byIndex.set(index, {
            content: {},
            metadata: { model: message.model || model, error: error instanceof Error ? error.message : String(error) }
          });
        }
      }
      options.onProgress?.({ completed: requests.length, total: requests.length, status: batch.processing_status });
      await this.logApiRequest(`Anthropic batch ${batch.id} finished (${batch.request_counts.succeeded} succeeded, ${batch.request_counts.errored} errored)`);
      return requests.map((_, index) => byIndex.get(index) ?? {
        content: {},
        metadata: { model, error: `Anthropic batch ${batch.id} omitted request mml-${index}` }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.logError(`Anthropic batch ${batchId || "submission"} failed: ${message}`);
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
      await this.logApiRequest("Validating Anthropic API key");
      
      const anthropic = new Anthropic({
        apiKey,
        baseURL: this.config.baseUrl || DEFAULT_API_URLS.anthropic,
        dangerouslyAllowBrowser: true
      });
      
      // Try to create a simple message as a validation check
      await anthropic.messages.create({
        model: DEFAULT_MODELS.anthropic,
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
