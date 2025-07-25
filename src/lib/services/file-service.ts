/**
 * File service for handling Minecraft files
 */
// Flag to indicate if we're in a server-side rendering environment
const isSSR = typeof window === 'undefined';

// Note: We use the Rust backend for dialog operations to avoid chunk loading issues

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
    const hasTauriClass = typeof document !== 'undefined' && document.documentElement?.classList?.contains('tauri');
    
    console.log('Tauri detection:', {
      hasTauriInternals,
      hasIsTauri,
      hasTauriClass
    });
    
    return hasTauriInternals || hasIsTauri || hasTauriClass;
  } catch (error) {
    console.error('Error checking Tauri environment:', error);
    return false;
  }
};

// Check if we're running in a Tauri context
const isTauri = !isSSR && isTauriEnvironment();

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

// Allow tests to override the invoke function
let testInvokeOverride: (<T>(command: string, args?: Record<string, unknown>) => Promise<T>) | null = null;

// Log Tauri availability
if (!isSSR) {
  console.log(`Tauri API available: ${isTauri ? 'yes' : 'no'}`);
  if (isTauri && tauriInvokeFunction) {
    console.log('Successfully loaded Tauri invoke function');
  }
  
  // Log more details about the window object
  console.log('window.__TAURI_INTERNALS__:', (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__);
  console.log('window.isTauri:', (window as unknown as Record<string, unknown>).isTauri);
}

/**
 * Mock invoke function for development
 * Only used when Tauri is not available
 */
const mockInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  console.log(`[MOCK] Invoking command: ${command}`, args);
  
  switch (command) {
    case "open_directory_dialog":
      // Return a realistic test minecraft path for development
      console.log("[MOCK] Simulating native dialog selection");
      // Use a path that resembles actual Minecraft installations
      const testPath = process.platform === 'win32' 
        ? 'C:\\Users\\Test\\AppData\\Roaming\\.minecraft'
        : '/home/test/.minecraft';
      return testPath as unknown as T;
      
    case "get_mod_files":
      return [
        `${args?.dir}/example-mod-1.jar`,
        `${args?.dir}/example-mod-2.jar`,
        `${args?.dir}/example-mod-3.jar`,
      ] as unknown as T;
      
    case "get_ftb_quest_files":
      return [
        `${args?.dir}/ftb/quests/chapter1.snbt`,
        `${args?.dir}/ftb/quests/chapter2.snbt`,
        `${args?.dir}/ftb/quests/chapter3.snbt`,
      ] as unknown as T;
      
    case "get_better_quest_files":
      return [
        `${args?.dir}/betterquests/DefaultQuests.json`,
        `${args?.dir}/betterquests/QuestLines.json`,
      ] as unknown as T;
      
    case "get_files_with_extension":
      if (args?.extension === ".json") {
        return [
          `${args?.dir}/example1.json`,
          `${args?.dir}/example2.json`,
          `${args?.dir}/subfolder/example3.json`,
        ] as unknown as T;
      } else if (args?.extension === ".snbt") {
        return [
          `${args?.dir}/example1.snbt`,
          `${args?.dir}/example2.snbt`,
        ] as unknown as T;
      }
      return [] as unknown as T;
      
    case "read_text_file":
      return `Mock content for ${args?.path}` as unknown as T;
      
    case "write_text_file":
      return true as unknown as T;
      
    case "create_directory":
      return true as unknown as T;
      
    case "create_resource_pack":
      return `${args?.dir}/${args?.name}` as unknown as T;
      
    case "write_lang_file":
      console.log(`[MOCK] Writing lang file with format: ${args?.format || 'json'}`);
      return true as unknown as T;
      
    default:
      return {} as T;
  }
};

/**
 * Invoke a Tauri command or use mock if not in Tauri environment
 * In SSR, always use mock
 */
const tauriInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  // If test override is set, use it
  if (testInvokeOverride) {
    return testInvokeOverride<T>(command, args);
  }
  
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
 * File service
 */
export class FileService {
  /**
   * Set a custom invoke function for testing
   * @param invokeFunc Custom invoke function or null to reset
   */
  static setTestInvokeOverride(invokeFunc: (<T>(command: string, args?: Record<string, unknown>) => Promise<T>) | null): void {
    testInvokeOverride = invokeFunc;
  }
  /**
   * Invoke a Tauri command
   * @param command Command to invoke
   * @param args Command arguments
   * @returns Command result
   */
  static async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    try {
      return await tauriInvoke<T>(command, args);
    } catch (error) {
      console.error(`Failed to invoke command ${command}:`, error);
      throw error;
    }
  }
  /**
   * Get mod files from a directory
   * @param dir Directory path
   * @returns Array of mod file paths
   */
  static async getModFiles(dir: string): Promise<string[]> {
    try {
      return await tauriInvoke<string[]>("get_mod_files", { dir });
    } catch (error) {
      console.error("Failed to get mod files:", error);
      throw error;
    }
  }

  /**
   * Get FTB quest files from a directory
   * @param dir Directory path
   * @returns Array of FTB quest file paths
   */
  static async getFTBQuestFiles(dir: string): Promise<string[]> {
    try {
      return await tauriInvoke<string[]>("get_ftb_quest_files", { dir });
    } catch (error) {
      console.error("Failed to get FTB quest files:", error);
      throw error;
    }
  }

  /**
   * Get Better Quests files from a directory
   * @param dir Directory path
   * @returns Array of Better Quests file paths
   */
  static async getBetterQuestFiles(dir: string): Promise<string[]> {
    try {
      return await tauriInvoke<string[]>("get_better_quest_files", { dir });
    } catch (error) {
      console.error("Failed to get Better Quests files:", error);
      throw error;
    }
  }

  /**
   * Create a resource pack
   * @param name Resource pack name
   * @param language Target language
   * @param dir Output directory
   * @returns Resource pack directory path
   */
  static async createResourcePack(
    name: string,
    language: string,
    dir: string
  ): Promise<string> {
    try {
      return await tauriInvoke<string>("create_resource_pack", { 
        name, 
        language, 
        dir 
      });
    } catch (error) {
      console.error("Failed to create resource pack:", error);
      throw error;
    }
  }

  /**
   * Write a language file to a resource pack
   * @param modId Mod ID
   * @param language Target language
   * @param content File content
   * @param dir Resource pack directory
   * @param format File format ('json' or 'lang'), defaults to 'json'
   * @returns Success status
   */
  static async writeLangFile(
    modId: string,
    language: string,
    content: Record<string, string>,
    dir: string,
    format?: 'json' | 'lang'
  ): Promise<boolean> {
    try {
      return await tauriInvoke<boolean>("write_lang_file", { 
        modId, 
        language, 
        content: JSON.stringify(content), 
        dir,
        format: format || 'json'
      });
    } catch (error) {
      console.error("Failed to write language file:", error);
      throw error;
    }
  }

  /**
   * Read a text file
   * @param path File path
   * @returns File content
   */
  static async readTextFile(path: string): Promise<string> {
    try {
      return await tauriInvoke<string>("read_text_file", { path });
    } catch (error) {
      console.error("Failed to read text file:", error);
      throw error;
    }
  }

  /**
   * Write a text file
   * @param path File path
   * @param content File content
   * @returns Success status
   */
  static async writeTextFile(path: string, content: string): Promise<boolean> {
    try {
      return await tauriInvoke<boolean>("write_text_file", { path, content });
    } catch (error) {
      console.error("Failed to write text file:", error);
      throw error;
    }
  }

  /**
   * Get files with a specific extension from a directory
   * @param dir Directory path
   * @param extension File extension (e.g., ".json")
   * @returns Array of file paths
   */
  static async getFilesWithExtension(dir: string, extension: string): Promise<string[]> {
    try {
      return await tauriInvoke<string[]>("get_files_with_extension", { dir, extension });
    } catch (error) {
      console.error(`Failed to get files with extension ${extension}:`, error);
      throw error;
    }
  }

  /**
   * Create a directory
   * @param path Directory path
   * @returns Success status
   */
  static async createDirectory(path: string): Promise<boolean> {
    try {
      return await tauriInvoke<boolean>("create_directory", { path });
    } catch (error) {
      console.error("Failed to create directory:", error);
      throw error;
    }
  }

  /**
   * Open a directory dialog
   * @param title Dialog title
   * @returns Selected directory path or null if canceled
   */
  static async openDirectoryDialog(title: string): Promise<string | null> {
    console.log("FileService.openDirectoryDialog: Opening directory dialog");
    
    try {
      // Use the Rust backend command for dialog operations to avoid chunk loading issues
      const result = await tauriInvoke<string | null>("open_directory_dialog", { title });
      console.log("FileService.openDirectoryDialog: Result from Rust backend:", result);
      return result;
    } catch (error) {
      console.error("Failed to open directory dialog:", error);
      return null;
    }
  }
}
