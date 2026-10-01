import { LLMAdapter, LLMConfig } from "../types/llm";
import { OpenAIAdapter } from "./openai-adapter";
import { AnthropicAdapter } from "./anthropic-adapter";
import { GeminiAdapter } from "./gemini-adapter";

/**
 * LLM Adapter Factory
 * Creates and manages LLM adapters
 */
export class LLMAdapterFactory {
  /** Create an adapter for the current settings; never reuse credentials from an earlier job. */
  public static getAdapter(config: LLMConfig): LLMAdapter {
    switch (config.provider) {
      case "openai": return new OpenAIAdapter(config);
      case "anthropic": return new AnthropicAdapter(config);
      case "google":
      case "gemini": return new GeminiAdapter(config);
      default: throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }

  /**
   * Get all available adapter types
   * @returns Array of available adapter types
   */
  public static getAvailableAdapterTypes(): { id: string; name: string; requiresApiKey: boolean }[] {
    return [
      { id: "openai", name: "OpenAI", requiresApiKey: true },
      { id: "anthropic", name: "Anthropic", requiresApiKey: true },
      { id: "google", name: "Google Gemini", requiresApiKey: true },
      // Add more adapter types here
    ];
  }

}
