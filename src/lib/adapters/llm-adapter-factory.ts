import { LLMAdapter, LLMConfig } from "../types/llm";
import { OpenAIAdapter } from "./openai-adapter";

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
    if (this.adapters.has(config.id)) {
      return this.adapters.get(config.id)!;
    }

    // Create a new adapter instance
    let adapter: LLMAdapter;

    switch (config.id) {
      case "openai":
        adapter = new OpenAIAdapter(config);
        break;
      // Add more adapter implementations here
      default:
        throw new Error(`Unsupported LLM provider: ${config.id}`);
    }

    // Store the instance
    this.adapters.set(config.id, adapter);

    return adapter;
  }

  /**
   * Get all available adapter types
   * @returns Array of available adapter types
   */
  public static getAvailableAdapterTypes(): { id: string; name: string; requiresApiKey: boolean }[] {
    return [
      { id: "openai", name: "OpenAI", requiresApiKey: true },
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
