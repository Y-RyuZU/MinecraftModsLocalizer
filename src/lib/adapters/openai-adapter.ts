import { DEFAULT_PROMPT_TEMPLATE, LLMConfig, TranslationBatchProgress, TranslationRequest, TranslationResponse } from "../types/llm";
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
    const systemPrompt = this.getSystemPrompt(request.targetLanguage, request.systemPromptSupplement);
    const userPrompt = this.formatUserPrompt(
      request.content,
      request.targetLanguage
    );
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl || undefined,
      // TranslationService owns retry/backoff policy. Disable the SDK's
      // hidden retries so one configured retry is one actual HTTP request.
      maxRetries: 0,
      dangerouslyAllowBrowser: true // Required for browser environments
    });
    
    const model = this.config.model || DEFAULT_MODELS.openai;
    
    await this.logApiRequest(`Sending request to OpenAI API (model: ${model})`);
    
    try {
        
        const isReasoningModel = /^(gpt-[56]|o[1-9])/i.test(model);
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
          ...(isReasoningModel ? {
            ...(model.toLowerCase() === "gpt-6-luna" ? { reasoning_effort: "low" as const } : {})
          } : {
            temperature: this.config.temperature ?? DEFAULT_API_CONFIG.temperature
          }),
          response_format: { type: "json_object" },
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
        const usageInfo = completion.usage
          ? ` (tokens: input=${completion.usage.prompt_tokens}, cached=${cachedTokens}, output=${completion.usage.completion_tokens}, total=${completion.usage.total_tokens})`
          : " (token usage unavailable)";
        await this.logApiRequest(`Translation completed in ${timeTaken}ms${usageInfo}`);
        
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
        throw error;
      }
  }

  public async translateBatch(
    requests: TranslationRequest[],
    options: {
      onProgress?: (progress: TranslationBatchProgress) => void;
      shouldCancel?: () => boolean;
    } = {}
  ): Promise<TranslationResponse[]> {
    if (!this.config.apiKey) throw new Error("OpenAI API key is not configured");
    if (requests.length === 0) return [];
    if (requests.length > 50_000) throw new Error("An OpenAI Batch API job can contain at most 50,000 translation chunks");
    if (options.shouldCancel?.()) throw new Error("Translation interrupted by user");

    const model = this.config.model || DEFAULT_MODELS.openai;
    const isReasoningModel = /^(gpt-[56]|o[1-9])/i.test(model);
    const lines = requests.map((request, index) => {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: this.getSystemPrompt(request.targetLanguage, request.systemPromptSupplement) },
          { role: "user", content: this.formatUserPrompt(request.content, request.targetLanguage) }
        ],
        response_format: { type: "json_object" },
        user: "minecraft-mod-localizer"
      };
      if (isReasoningModel) {
        if (model.toLowerCase() === "gpt-6-luna") body.reasoning_effort = "low";
      } else {
        body.temperature = this.config.temperature ?? DEFAULT_API_CONFIG.temperature;
      }
      return JSON.stringify({
        custom_id: `mml-${index}`,
        method: "POST",
        url: "/v1/chat/completions",
        body
      });
    }).join("\n");
    const inputBytes = new TextEncoder().encode(lines).byteLength;
    if (inputBytes > 200 * 1024 * 1024) throw new Error("OpenAI Batch input exceeds the 200 MB file limit");

    const openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl || undefined,
      maxRetries: 0,
      dangerouslyAllowBrowser: true
    });
    let inputFileId: string | undefined;
    let outputFileId: string | undefined;
    let errorFileId: string | undefined;
    let batchId: string | undefined;
    let terminal = false;
    let resultFilesRetrieved = false;

    try {
      await this.logApiRequest(`Submitting ${requests.length} translation chunks to OpenAI Batch API (model: ${model})`);
      const inputFile = await openai.files.create({
        file: new File([lines], "minecraft-mods-localizer.jsonl", { type: "application/jsonl" }),
        purpose: "batch"
      });
      inputFileId = inputFile.id;

      let batch = await openai.batches.create({
        input_file_id: inputFile.id,
        endpoint: "/v1/chat/completions",
        completion_window: "24h"
      });
      batchId = batch.id;
      options.onProgress?.({ completed: 0, total: requests.length, status: batch.status });
      await this.logApiRequest(`OpenAI Batch job ${batch.id} created (${requests.length} chunks)`);

      while (!["completed", "failed", "expired", "cancelled"].includes(batch.status)) {
        if (options.shouldCancel?.()) {
          await openai.batches.cancel(batch.id);
          throw new Error(`Translation interrupted by user; OpenAI Batch ${batch.id} cancellation requested`);
        }
        if (batch.expires_at && Date.now() > batch.expires_at * 1000 + 5 * 60_000) {
          throw new Error(`OpenAI Batch ${batch.id} did not reach a terminal state before expiration`);
        }
        await new Promise((resolve) => setTimeout(resolve, 15_000));
        batch = await openai.batches.retrieve(batch.id);
        options.onProgress?.({
          completed: (batch.request_counts?.completed ?? 0) + (batch.request_counts?.failed ?? 0),
          total: requests.length,
          status: batch.status
        });
      }

      terminal = true;
      if (batch.status === "failed" || batch.status === "cancelled") {
        throw new Error(`OpenAI Batch ${batch.id} ended with status ${batch.status}`);
      }
      outputFileId = batch.output_file_id;
      errorFileId = batch.error_file_id;
      if (!outputFileId && !errorFileId) throw new Error(`OpenAI Batch ${batch.id} finished without result files`);

      const resultById = new Map<string, TranslationResponse>();
      let batchInputTokens = 0;
      let batchOutputTokens = 0;
      let batchTotalTokens = 0;
      const readResultLines = async (fileId: string) => (await (await openai.files.content(fileId)).text()).split(/\r?\n/).filter(Boolean);
      const outputLines = outputFileId ? await readResultLines(outputFileId) : [];
      const errorLines = errorFileId ? await readResultLines(errorFileId) : [];
      resultFilesRetrieved = true;
      for (const line of outputLines) {
        let item: {
          custom_id?: string;
          error?: { message?: string; code?: string };
          response?: {
              status_code?: number;
              body?: {
              error?: { message?: string; code?: string };
              choices?: Array<{ message?: { content?: string | null } }>;
              model?: string;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            };
          };
        };
        try {
          item = JSON.parse(line) as typeof item;
        } catch {
          continue;
        }
        const requestIndex = Number(item.custom_id?.match(/^mml-(\d+)$/)?.[1]);
        if (!Number.isInteger(requestIndex) || requestIndex < 0 || requestIndex >= requests.length) continue;
        const responseBody = item.response?.body;
        const translationText = responseBody?.choices?.[0]?.message?.content?.trim();
        if (item.error || !item.response || (item.response.status_code ?? 0) >= 400 || !translationText) {
          resultById.set(`mml-${requestIndex}`, {
            content: {},
            metadata: {
              model: responseBody?.model || model,
              errorRetryable: false,
              error: item.error
                ? `${item.error.code ? `${item.error.code}: ` : ""}${item.error.message || "Batch request failed"}`
                : `OpenAI returned HTTP ${item.response?.status_code ?? "no response"}${responseBody?.error?.message ? `: ${responseBody.error.message}` : ""}`
            }
          });
          continue;
        }
        try {
          batchInputTokens += responseBody?.usage?.prompt_tokens ?? 0;
          batchOutputTokens += responseBody?.usage?.completion_tokens ?? 0;
          batchTotalTokens += responseBody?.usage?.total_tokens ?? 0;
          resultById.set(`mml-${requestIndex}`, {
            content: this.parseResponse(translationText, requests[requestIndex].content),
            metadata: { model: responseBody?.model || model, tokensUsed: responseBody?.usage?.total_tokens }
          });
        } catch (error) {
          resultById.set(`mml-${requestIndex}`, {
            content: {},
            metadata: { model: responseBody?.model || model, error: error instanceof Error ? error.message : String(error) }
          });
        }
      }
      for (const line of errorLines) {
        let item: { custom_id?: string; error?: { message?: string; code?: string } };
        try {
          item = JSON.parse(line) as typeof item;
        } catch {
          continue;
        }
        const requestIndex = Number(item.custom_id?.match(/^mml-(\d+)$/)?.[1]);
        if (!Number.isInteger(requestIndex) || requestIndex < 0 || requestIndex >= requests.length) continue;
        const code = item.error?.code || "batch_request_failed";
        resultById.set(`mml-${requestIndex}`, {
          content: {},
          metadata: {
            model,
            error: `${code}: ${item.error?.message || "Batch request failed"}`,
            errorRetryable: /rate.?limit|429|server.?error|batch_expired/i.test(code)
          }
        });
      }
      options.onProgress?.({ completed: requests.length, total: requests.length, status: batch.status });
      const tokenUsage = batchTotalTokens > 0
        ? `, tokens: input=${batchInputTokens}, output=${batchOutputTokens}, total=${batchTotalTokens}`
        : "";
      await this.logApiRequest(`OpenAI Batch ${batch.id} finished (${batch.request_counts?.completed ?? 0} succeeded, ${batch.request_counts?.failed ?? 0} failed${tokenUsage})`);
      return requests.map((_, index) => resultById.get(`mml-${index}`) ?? {
        content: {},
        metadata: { model, error: `OpenAI Batch ${batch.id} omitted request mml-${index}` }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.logError(`OpenAI Batch ${batchId || "submission"} failed: ${message}`);
      throw error;
    } finally {
      // Batch input/output files are provider-hosted; remove them once results are collected.
      if (terminal) {
        const cleanupFiles = resultFilesRetrieved
          ? [inputFileId, outputFileId, errorFileId]
          : [inputFileId];
        for (const fileId of cleanupFiles) {
          if (fileId) await openai.files.delete(fileId).catch(() => undefined);
        }
      }
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
