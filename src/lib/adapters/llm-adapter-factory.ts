import { LLMAdapter, LLMConfig } from "../types/llm";
import { OpenAIAdapter } from "./openai-adapter";
import { AnthropicAdapter } from "./anthropic-adapter";
import { GeminiAdapter } from "./gemini-adapter";

/**
 * LLM Adapter Factory
 * Creates and manages LLM adapters
 */
export class LLMAdapterFactory {
  /** Map of adapter IDs to adapter instances */
  private static adapters: Map<string, LLMAdapter> = new Map();

  /**
   * Get an adapter instance
   * @param config LLM configuration
   * @returns LLM adapter instance
   */
  public static getAdapter(config: LLMConfig): LLMAdapter {
    // Check if we already have an instance for this provider
    if (this.adapters.has(config.provider)) {
      return this.adapters.get(config.provider)!;
    }

    // Create a new adapter instance
    let adapter: LLMAdapter;

    switch (config.provider) {
      case "openai":
        adapter = new OpenAIAdapter(config);
        break;
      case "anthropic":
        adapter = new AnthropicAdapter(config);
        break;
      case "gemini":
        adapter = new GeminiAdapter(config);
        break;
      // Add more adapter implementations here
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }

    // Store the instance
    this.adapters.set(config.provider, adapter);

    return adapter;
  }

  /**
   * Get all available adapter types
   * @returns Array of available adapter types
   */
  public static getAvailableAdapterTypes(): { id: string; name: string; requiresApiKey: boolean }[] {
    return [
      { id: "openai", name: "OpenAI", requiresApiKey: true },
      { id: "anthropic", name: "Anthropic", requiresApiKey: true },
      { id: "gemini", name: "Google Gemini", requiresApiKey: true },
      // Add more adapter types here
    ];
  }

  /**
   * Clear all adapter instances
   */
  public static clearAdapters(): void {
    this.adapters.clear();
  }
}
