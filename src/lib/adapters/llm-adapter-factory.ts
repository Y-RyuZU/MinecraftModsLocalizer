import { LLMAdapter, LLMConfig } from "../types/llm";
import { OpenAIAdapter } from "./openai-adapter";
import { AnthropicAdapter } from "./anthropic-adapter";
import { GeminiAdapter } from "./gemini-adapter";
import { normalizeProvider } from "../types/config";

/**
 * LLM Adapter Factory
 * Creates and manages LLM adapters
 */
export class LLMAdapterFactory {
  /**
   * Get an adapter instance
   * @param config LLM configuration
   * @returns LLM adapter instance
   */
  public static getAdapter(config: LLMConfig): LLMAdapter {
    if (!["openai", "anthropic", "gemini", "google"].includes(config.provider)) {
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
    // Adapters contain credentials and model settings. Create a fresh instance
    // so changing settings cannot reuse stale credentials from an old session.
    const provider = normalizeProvider(config.provider);
    const normalizedConfig = { ...config, provider };

    // Create a new adapter instance
    let adapter: LLMAdapter;

    switch (provider) {
      case "openai":
        adapter = new OpenAIAdapter(normalizedConfig);
        break;
      case "anthropic":
        adapter = new AnthropicAdapter(normalizedConfig);
        break;
      case "gemini":
        adapter = new GeminiAdapter(normalizedConfig);
        break;
      // Add more adapter implementations here
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
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
    // Kept for callers from older versions. Adapters are no longer cached.
  }
}
