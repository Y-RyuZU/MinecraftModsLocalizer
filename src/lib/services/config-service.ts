import { AppConfig, DEFAULT_CONFIG } from "../types/config";

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
  public static load(): AppConfig {
    if (this.loaded) {
      return this.config;
    }
    
    try {
      // Try to load from localStorage
      const storedConfig = localStorage.getItem(this.STORAGE_KEY);
      
      if (storedConfig) {
        // Parse and merge with default config to ensure all fields are present
        const parsedConfig = JSON.parse(storedConfig) as Partial<AppConfig>;
        this.config = this.mergeWithDefault(parsedConfig);
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
  public static save(config: AppConfig): void {
    try {
      // Update current configuration
      this.config = config;
      
      // Save to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error("Failed to save configuration:", error);
    }
  }

  /**
   * Update configuration
   * @param partialConfig Partial configuration to update
   * @returns Updated configuration
   */
  public static update(partialConfig: Partial<AppConfig>): AppConfig {
    // Load current configuration if not loaded
    if (!this.loaded) {
      this.load();
    }
    
    // Merge with current configuration
    const updatedConfig = this.deepMerge(this.config, partialConfig);
    
    // Save updated configuration
    this.save(updatedConfig);
    
    return updatedConfig;
  }

  /**
   * Reset configuration to defaults
   * @returns Default configuration
   */
  public static reset(): AppConfig {
    this.config = { ...DEFAULT_CONFIG };
    this.save(this.config);
    return this.config;
  }

  /**
   * Get current configuration
   * @returns Current configuration
   */
  public static getConfig(): AppConfig {
    // Load current configuration if not loaded
    if (!this.loaded) {
      this.load();
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
