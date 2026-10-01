/**
 * Minecraft file types and interfaces
 */

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
  /** Languages available for each English asset namespace and file format. */
  availableLanguagesByNamespaceAndFormat?: Record<string, Partial<Record<"json" | "lang", string[]>>>;
  /** Language codes already present in the mod archive. */
  availableLanguages: string[];
  /** Languages available for each asset namespace that has English source text. */
  availableLanguagesByNamespace: Record<string, string[]>;
  /** Patchouli books in the mod */
  patchouliBooks: PatchouliBook[];
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
  /** Non-string JSON values whose text leaves are translated and rebuilt in place. */
  structuredContent?: Record<string, unknown>;
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
  /** Language codes already present in this book. */
  availableLanguages: string[];
}

/**
 * Quest file
 */
export interface QuestFile {
  /** Quest file type */
  type: "ftb" | "better";
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
  type: "mod" | "ftb" | "better" | "patchouli" | "custom";
  /** Target ID */
  id: string;
  /** Target name */
  name: string;
  /** Target path (full path) */
  path: string;
  /** Relative path (for display) */
  relativePath?: string;
  /** Languages already present in the mod archive. */
  availableLanguages?: string[];
  /** Languages available for each English asset namespace in the mod archive. */
  availableLanguagesByNamespace?: Record<string, string[]>;
  /** Languages available for each English asset namespace and file format. */
  availableLanguagesByNamespaceAndFormat?: Record<string, Partial<Record<"json" | "lang", string[]>>>;
  /** Locales already emitted for each namespace/format in the configured output resource pack. */
  resourcePackLanguagesByNamespaceAndFormat?: Record<string, Partial<Record<"json" | "lang", string[]>>>;
  /** Language explicitly opted into replacing when an existing translation is found. */
  forceTranslationLanguage?: string;
  /** Whether the target is selected for translation */
  selected: boolean;
}

/**
 * Patchouli-specific translation job
 */
import type { TranslationJob } from "../services/translation-service";
export interface PatchouliTranslationJob extends TranslationJob {
  bookId: string;
  modId: string;
  sourcePaths: string[];
  targetPath: string;
}

/**
 * Mod-specific translation job
 */
export interface ModTranslationJob extends TranslationJob {
  resourceNamespace: string;
  modName: string;
  fileExtension: "json" | "lang";
  structuredContent?: Record<string, unknown>;
}

/**
 * Translation result
 */
export interface TranslationResult {
  /** Target type */
  type: "mod" | "ftb" | "better" | "patchouli" | "custom";
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
