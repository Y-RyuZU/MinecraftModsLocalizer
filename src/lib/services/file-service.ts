/**
 * File service for handling Minecraft files
 */

// Check if we're running in a Tauri context
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

// Mock invoke function for development
const mockInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  console.log(`[MOCK] Invoking command: ${command}`, args);
  
  switch (command) {
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
      
    case "open_directory_dialog":
      return `/mock/path` as unknown as T;
      
    case "create_resource_pack":
      return `${args?.dir}/${args?.name}` as unknown as T;
      
    case "write_lang_file":
      return true as unknown as T;
      
    default:
      return {} as T;
  }
};

// Use the real invoke function if available, otherwise use the mock
const tauriInvoke = isTauri 
  ? window.__TAURI__?.invoke 
  : mockInvoke;

/**
 * File service
 */
export class FileService {
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
   * @returns Success status
   */
  static async writeLangFile(
    modId: string,
    language: string,
    content: Record<string, string>,
    dir: string
  ): Promise<boolean> {
    try {
      return await tauriInvoke<boolean>("write_lang_file", { 
        modId, 
        language, 
        content: JSON.stringify(content), 
        dir 
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
    try {
      const result = await tauriInvoke<string | null>("open_directory_dialog", { title });
      return result;
    } catch (error) {
      console.error("Failed to open directory dialog:", error);
      throw error;
    }
  }
}
