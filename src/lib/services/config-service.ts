import { AppConfig, DEFAULT_CONFIG } from "../types/config";

// Check if we're running in a Tauri context
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

// Mock invoke function for development
const mockInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  console.log(`[MOCK] Invoking command: ${command}`, args);
  
  if (command === "load_config") {
    return JSON.stringify(DEFAULT_CONFIG) as unknown as T;
  }
  
  if (command === "save_config") {
    return true as unknown as T;
  }
  
  return {} as T;
};

// Use the real invoke function if available, otherwise use the mock
const tauriInvoke = isTauri 
  ? window.__TAURI__?.invoke 
  : mockInvoke;

/**
 * Configuration service
 * Manages application configuration
 */
export class ConfigService {
  /** Configuration storage key */
  private static readonly STORAGE_KEY = "minecraft-mods-localizer-config";
  
  /** Current configuration */
  private static config: AppConfig = DEFAULT_CONFIG;
  
  /** Whether the configuration has been loaded */
  private static loaded = false;

  /**
   * Load configuration from storage
   * @returns Configuration
   */
  public static async load(): Promise<AppConfig> {
    if (this.loaded) {
      return this.config;
    }
    
    try {
      if (isTauri) {
        // Load from Tauri backend
        const configJson = await tauriInvoke<string>("load_config");
        const parsedConfig = JSON.parse(configJson) as AppConfig;
        this.config = parsedConfig;
      } else {
        // Try to load from localStorage for development
        const storedConfig = localStorage.getItem(this.STORAGE_KEY);
        
        if (storedConfig) {
          // Parse and merge with default config to ensure all fields are present
          const parsedConfig = JSON.parse(storedConfig) as Partial<AppConfig>;
          this.config = this.mergeWithDefault(parsedConfig);
        }
      }
      
      this.loaded = true;
    } catch (error) {
      console.error("Failed to load configuration:", error);
    }
    
    return this.config;
  }

  /**
   * Save configuration to storage
   * @param config Configuration to save
   */
  public static async save(config: AppConfig): Promise<void> {
    try {
      // Update current configuration
      this.config = config;
      
      if (isTauri) {
        // Save to Tauri backend
        await tauriInvoke<boolean>("save_config", { 
          config_json: JSON.stringify(config) 
        });
      } else {
        // Save to localStorage for development
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
      }
    } catch (error) {
      console.error("Failed to save configuration:", error);
    }
  }

  /**
   * Update configuration
   * @param partialConfig Partial configuration to update
   * @returns Updated configuration
   */
  public static async update(partialConfig: Partial<AppConfig>): Promise<AppConfig> {
    // Load current configuration if not loaded
    if (!this.loaded) {
      await this.load();
    }
    
    // Merge with current configuration
    const updatedConfig = this.deepMerge(this.config, partialConfig);
    
    // Save updated configuration
    await this.save(updatedConfig);
    
    return updatedConfig;
  }

  /**
   * Reset configuration to defaults
   * @returns Default configuration
   */
  public static async reset(): Promise<AppConfig> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save(this.config);
    return this.config;
  }

  /**
   * Get current configuration
   * @returns Current configuration
   */
  public static async getConfig(): Promise<AppConfig> {
    // Load current configuration if not loaded
    if (!this.loaded) {
      await this.load();
    }
    
    return this.config;
  }

  /**
   * Merge partial configuration with default configuration
   * @param partialConfig Partial configuration
   * @returns Merged configuration
   */
  private static mergeWithDefault(partialConfig: Partial<AppConfig>): AppConfig {
    return this.deepMerge(DEFAULT_CONFIG, partialConfig);
  }

  /**
   * Get provider-specific default model
   * @param provider Provider ID
   * @returns Default model for the provider
   */
  public static getDefaultModel(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'gpt-4o-mini-2024-07-18';
      case 'anthropic':
        return 'claude-3-haiku-20240307';
      case 'google':
        return 'gemini-1.5-pro';
      default:
        return '';
    }
  }

  /**
   * Deep merge two objects
   * @param target Target object
   * @param source Source object
   * @returns Merged object
   */
  private static deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        const sourceValue = source[key as keyof T];
        const targetValue = target[key as keyof T];
        
        if (isObject(sourceValue)) {
          if (!(key in target)) {
            Object.assign(output, { [key]: sourceValue });
          } else if (isObject(targetValue)) {
            output[key as keyof T] = this.deepMerge(
              targetValue as Record<string, unknown>,
              sourceValue as Record<string, unknown>
            ) as T[keyof T];
          } else {
            Object.assign(output, { [key]: sourceValue });
          }
        } else {
          Object.assign(output, { [key]: sourceValue });
        }
      });
    }
    
    return output;
  }
}

/**
 * Check if value is an object
 * @param item Value to check
 * @returns Whether the value is an object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item) && typeof item === "object" && !Array.isArray(item);
}
