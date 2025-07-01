import { AppConfig, DEFAULT_CONFIG, STORAGE_KEYS, DEFAULT_MODELS } from "../types/config";
import { SupportedLanguage } from "../types/llm";

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
        // Load from Tauri backend and convert from snake_case
        const configJson = await tauriInvoke<string>("load_config");
        const backendConfig = JSON.parse(configJson);
        this.config = convertFromSnakeCase(backendConfig);
      } else {
        // Try to load from localStorage for development
        const storedConfig = localStorage.getItem(STORAGE_KEYS.config);
        
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
        // Convert to snake_case and save to Tauri backend
        const backendConfig = convertToSnakeCase(config);
        await tauriInvoke<boolean>("save_config", { 
          configJson: JSON.stringify(backendConfig) 
        });
      } else {
        // Save to localStorage for development
        localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
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
    const providerKey = provider.toLowerCase() as keyof typeof DEFAULT_MODELS;
    return DEFAULT_MODELS[providerKey] || '';
  }

  /**
   * Deep merge two objects
   * @param target Target object
   * @param source Source object
   * @returns Merged object
   */
  private static deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target } as Record<string, unknown>;
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = (target as Record<string, unknown>)[key];
        
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
 * Convert camelCase config to snake_case for Tauri backend
 * @param config Frontend config in camelCase
 * @returns Backend config in snake_case
 */
function convertToSnakeCase(config: AppConfig): Record<string, unknown> {
  return {
    llm: {
      provider: config.llm.provider,
      api_key: config.llm.apiKey,
      base_url: config.llm.baseUrl,
      model: config.llm.model,
      max_retries: config.llm.maxRetries,
      prompt_template: config.llm.promptTemplate,
      system_prompt: config.llm.systemPrompt,
      user_prompt: config.llm.userPrompt,
      temperature: config.llm.temperature
    },
    translation: {
      mod_chunk_size: config.translation.modChunkSize,
      quest_chunk_size: config.translation.questChunkSize,
      guidebook_chunk_size: config.translation.guidebookChunkSize,
      custom_languages: config.translation.additionalLanguages,
      resource_pack_name: config.translation.resourcePackName,
      use_token_based_chunking: config.translation.useTokenBasedChunking,
      max_tokens_per_chunk: config.translation.maxTokensPerChunk,
      fallback_to_entry_based: config.translation.fallbackToEntryBased
    },
    ui: {
      theme: config.ui.theme
    },
    paths: {
      minecraft_dir: config.paths.minecraftDir,
      mods_dir: config.paths.modsDir,
      resource_packs_dir: config.paths.resourcePacksDir,
      config_dir: config.paths.configDir,
      logs_dir: config.paths.logsDir
    }
  };
}

/**
 * Convert snake_case config from Tauri backend to camelCase for frontend
 * @param backendConfig Backend config in snake_case
 * @returns Frontend config in camelCase
 */
function convertFromSnakeCase(backendConfig: Record<string, unknown>): AppConfig {
  const llm = backendConfig.llm as Record<string, unknown> | undefined;
  const translation = backendConfig.translation as Record<string, unknown> | undefined;
  const ui = backendConfig.ui as Record<string, unknown> | undefined;
  const paths = backendConfig.paths as Record<string, unknown> | undefined;

  return {
    llm: {
      provider: (llm?.provider as string) || "",
      apiKey: (llm?.api_key as string) || "",
      baseUrl: llm?.base_url as string | undefined,
      model: llm?.model as string | undefined,
      maxRetries: (llm?.max_retries as number) || DEFAULT_CONFIG.llm.maxRetries,
      promptTemplate: llm?.prompt_template as string | undefined,
      systemPrompt: llm?.system_prompt as string | undefined,
      userPrompt: llm?.user_prompt as string | undefined,
      temperature: (llm?.temperature as number) || DEFAULT_CONFIG.llm.temperature
    },
    translation: {
      modChunkSize: (translation?.mod_chunk_size as number) || DEFAULT_CONFIG.translation.modChunkSize,
      questChunkSize: (translation?.quest_chunk_size as number) || DEFAULT_CONFIG.translation.questChunkSize,
      guidebookChunkSize: (translation?.guidebook_chunk_size as number) || DEFAULT_CONFIG.translation.guidebookChunkSize,
      additionalLanguages: (translation?.custom_languages as SupportedLanguage[]) || DEFAULT_CONFIG.translation.additionalLanguages,
      resourcePackName: (translation?.resource_pack_name as string) || DEFAULT_CONFIG.translation.resourcePackName,
      useTokenBasedChunking: (translation?.use_token_based_chunking as boolean) ?? DEFAULT_CONFIG.translation.useTokenBasedChunking,
      maxTokensPerChunk: (translation?.max_tokens_per_chunk as number) || DEFAULT_CONFIG.translation.maxTokensPerChunk,
      fallbackToEntryBased: (translation?.fallback_to_entry_based as boolean) ?? DEFAULT_CONFIG.translation.fallbackToEntryBased
    },
    ui: {
      theme: (ui?.theme as "light" | "dark" | "system") || DEFAULT_CONFIG.ui.theme
    },
    paths: {
      minecraftDir: (paths?.minecraft_dir as string) || DEFAULT_CONFIG.paths.minecraftDir,
      modsDir: (paths?.mods_dir as string) || DEFAULT_CONFIG.paths.modsDir,
      resourcePacksDir: (paths?.resource_packs_dir as string) || DEFAULT_CONFIG.paths.resourcePacksDir,
      configDir: (paths?.config_dir as string) || DEFAULT_CONFIG.paths.configDir,
      logsDir: (paths?.logs_dir as string) || DEFAULT_CONFIG.paths.logsDir
    }
  };
}

/**
 * Check if value is an object
 * @param item Value to check
 * @returns Whether the value is an object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item) && typeof item === "object" && !Array.isArray(item);
}
