import { AppConfig, DEFAULT_CONFIG } from "../types/config";

// Flag to indicate if we're in a server-side rendering environment
const isSSR = typeof window === 'undefined';

/**
 * Check if we're running in a Tauri environment
 * This is a reliable way to check in Tauri v2
 */
const isTauriEnvironment = (): boolean => {
  // Always return false in SSR
  if (isSSR) {
    return false;
  }
  
  try {
    // In Tauri v2, we can check for these properties
    // Use type assertions with unknown first to avoid direct any usage
    const hasTauriInternals = typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined';
    const hasIsTauri = typeof (window as unknown as Record<string, unknown>).isTauri !== 'undefined';
    const hasTauriClass = document.documentElement.classList.contains('tauri');
    
    return hasTauriInternals || hasIsTauri || hasTauriClass;
  } catch (error) {
    console.error('Error checking Tauri environment:', error);
    return false;
  }
};

// Check if we're running in a Tauri context
const isTauri = !isSSR && isTauriEnvironment();


/**
 * Mock invoke function for development
 * Only used when Tauri is not available
 */
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

// Get the Tauri invoke function
const getTauriInvokeFunction = () => {
  if (!isTauri || isSSR) return null;
  
  // Try to get the invoke function from Tauri v2 APIs
  if (typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
    const tauriInternals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ as Record<string, unknown>;
    if (typeof tauriInternals?.invoke === 'function') {
      return tauriInternals.invoke as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    }
  }
  
  // Fallback to window.isTauri if available
  if (typeof (window as unknown as Record<string, unknown>).isTauri !== 'undefined') {
    const isTauriObj = (window as unknown as Record<string, unknown>).isTauri as Record<string, unknown>;
    if (typeof isTauriObj?.invoke === 'function') {
      return isTauriObj.invoke as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    }
  }
  
  console.warn('Tauri detected but invoke function not found');
  return null;
};

// Define a function to safely invoke Tauri commands
const tauriInvokeFunction = !isSSR ? getTauriInvokeFunction() : null;

// Log Tauri availability
if (!isSSR) {
  console.log(`Tauri API available: ${isTauri ? 'yes' : 'no'}`);
  if (isTauri && tauriInvokeFunction) {
    console.log('Successfully loaded Tauri invoke function');
  }
}

/**
 * Invoke a Tauri command or use mock if not in Tauri environment
 * In SSR, always use mock
 */
const tauriInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  // In SSR, always use mock
  if (isSSR) {
    console.log(`[SSR] Using mock for command: ${command}`);
    return mockInvoke<T>(command, args);
  }
  
  const tauriAvailable = isTauri && tauriInvokeFunction;
  console.log(`Invoking ${command} in ${tauriAvailable ? 'Tauri' : 'mock'} environment`);
  
  if (tauriAvailable) {
    try {
      // Use the Tauri invoke function
      return await tauriInvokeFunction<T>(command, args);
    } catch (error) {
      console.error(`Error invoking Tauri command ${command}:`, error);
      throw error;
    }
  } else {
    return mockInvoke<T>(command, args);
  }
};

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
        return 'o4-mini-2025-04-16';
      case 'anthropic':
        return 'claude-3-5-haiku-latest';
      case 'google':
        return 'gemini-2.5-flash';
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
  private static deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target } as any;
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = (target as any)[key];
        
        if (sourceValue === undefined) {
          continue;
        }
        
        if (isObject(sourceValue) && isObject(targetValue)) {
          result[key] = this.deepMerge(targetValue, sourceValue);
        } else {
          result[key] = sourceValue;
        }
      }
    }
    
    return result as T;
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
