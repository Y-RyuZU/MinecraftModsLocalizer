/**
 * Minecraft file types and interfaces
 */

/**
 * Common translation target type
 */
export type TranslationTargetType = "mod" | "quest" | "patchouli" | "custom";

/**
 * Mod information
 */
export interface ModInfo {
  /** Mod ID */
  id: string;
  /** Mod name */
  name: string;
  /** Mod version */
  version: string;
  /** Path to the mod JAR file */
  jarPath: string;
  /** Language files in the mod */
  langFiles: LangFile[];
  /** Patchouli books in the mod */
  patchouliBooks: PatchouliBook[];
  /** Source language file format ('json' or 'lang') */
  langFormat: 'json' | 'lang';
}

/**
 * Language file
 */
export interface LangFile {
  /** Language code (e.g., "en_us") */
  language: string;
  /** Path to the file within the JAR */
  path: string;
  /** Content of the file */
  content: Record<string, string>;
}

/**
 * Patchouli book
 */
export interface PatchouliBook {
  /** Book ID */
  id: string;
  /** Mod ID */
  modId: string;
  /** Book name */
  name: string;
  /** Path to the book directory within the JAR */
  path: string;
  /** Language files in the book */
  langFiles: LangFile[];
}

/**
 * Quest file
 */
export interface QuestFile {
  /** Quest format */
  format: "ftb" | "better";
  /** Path to the file */
  path: string;
  /** Content of the file */
  content: string;
}

/**
 * FTB Quest
 */
export interface FTBQuest {
  /** Quest ID */
  id: string;
  /** Quest title */
  title: string;
  /** Quest subtitle */
  subtitle?: string;
  /** Quest description */
  description: string[];
  /** Path to the quest file */
  path: string;
}

/**
 * Better Quest
 */
export interface BetterQuest {
  /** Quest ID */
  id: string;
  /** Quest name */
  name: string;
  /** Quest description */
  description: string;
  /** Path to the quest file */
  path: string;
}

/**
 * Translation target
 */
export interface TranslationTarget {
  /** Target type */
  type: TranslationTargetType;
  /** Target ID */
  id: string;
  /** Target name */
  name: string;
  /** Target path (full path) */
  path: string;
  /** Relative path (for display) */
  relativePath?: string;
  /** Whether the target is selected for translation */
  selected: boolean;
  /** Quest format (only for quest type) */
  questFormat?: "ftb" | "better";
  /** Language file format (only for mod type) */
  langFormat?: "json" | "lang";
  /** Whether the target already has a translation for the current target language */
  hasExistingTranslation?: boolean;
}

/**
 * Patchouli-specific translation job
 */
import type { TranslationJob } from "../services/translation-service";
export interface PatchouliTranslationJob extends TranslationJob {
  bookId: string;
  modId: string;
  targetPath: string;
}

/**
 * Mod-specific translation job
 */
export interface ModTranslationJob extends TranslationJob {
  modId: string;
}

/**
 * Translation result
 */
export interface TranslationResult {
  /** Target type */
  type: TranslationTargetType;
  /** Target ID */
  id: string;
  /** Display name (optional, used for guidebooks and other items where name differs from ID) */
  displayName?: string;
  /** Target language */
  targetLanguage: string;
  /** Translated content */
  content: Record<string, string>;
  /** Output path */
  outputPath: string;
  /** Whether the translation was successful */
  success: boolean;
  /** Session ID for backup integration (optional) */
  sessionId?: string;
  /** Whether to enable backup for this translation (optional) */
  enableBackup?: boolean;
}

/**
 * Resource pack information
 */
export interface ResourcePack {
  /** Resource pack name */
  name: string;
  /** Resource pack description */
  description: string;
  /** Resource pack format */
  format: number;
  /** Path to the resource pack directory */
  path: string;
}

/**
 * Resource pack manifest (pack.mcmeta)
 */
export interface ResourcePackManifest {
  /** Pack information */
  pack: {
    /** Pack description */
    description: string;
    /** Pack format */
    pack_format: number;
  };
}
