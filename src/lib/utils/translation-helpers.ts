import { invoke } from "@tauri-apps/api/core";
import { TranslationTarget, TranslationTargetType } from "@/lib/types/minecraft";

/**
 * Common utility functions for translation tabs
 */

/**
 * Calculate relative path for display
 */
export function calculateRelativePath(fullPath: string, baseDirectory: string): string {
    return fullPath.startsWith(baseDirectory)
        ? fullPath.substring(baseDirectory.length).replace(/^[/\\]+/, '')
        : fullPath;
}

/**
 * Sort translation targets alphabetically by name
 */
export function sortTargetsAlphabetically(targets: TranslationTarget[]): TranslationTarget[] {
    return [...targets].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Log scan error to backend
 */
export async function logScanError(
    itemType: string,
    itemPath: string,
    error: unknown,
    processType: 'MOD_SCAN' | 'GUIDEBOOK_SCAN' | 'QUEST_SCAN' | 'CUSTOM_FILE_SCAN'
): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for specific error types
    if (errorMessage.includes("Failed to parse JSON") || 
        errorMessage.includes("Unexpected end of JSON")) {
        console.warn(`JSON parsing error in ${itemType}: ${itemPath}`, error);
        try {
            await invoke('log_warning', {
                message: `JSON parsing error in ${itemType}: ${itemPath} - ${errorMessage}`,
                processType
            });
        } catch {}
    } else if (errorMessage.includes("invalid utf-8") || 
               errorMessage.includes("stream did not contain valid UTF-8")) {
        console.warn(`UTF-8 encoding error in ${itemType}: ${itemPath}`, error);
        try {
            await invoke('log_warning', {
                message: `UTF-8 encoding error in ${itemType}: ${itemPath} - This file may contain invalid characters`,
                processType
            });
        } catch {}
    } else if (errorMessage.includes("No such file or directory") || 
               errorMessage.includes("IO error")) {
        console.error(`IO error reading ${itemType}: ${itemPath}`, error);
        try {
            await invoke('log_error', {
                message: `IO error reading ${itemType}: ${itemPath} - ${errorMessage}`,
                processType
            });
        } catch {}
    } else {
        console.error(`Failed to analyze ${itemType}: ${itemPath}`, error);
        try {
            await invoke('log_error', {
                message: `Failed to analyze ${itemType}: ${itemPath} - ${errorMessage}`,
                processType
            });
        } catch {}
    }
}

/**
 * Create a standard translation target
 */
export function createTranslationTarget(
    type: TranslationTargetType,
    id: string,
    name: string,
    path: string,
    baseDirectory: string,
    additionalProps?: Record<string, unknown>
): TranslationTarget {
    return {
        type,
        id,
        name,
        path,
        relativePath: calculateRelativePath(path, baseDirectory),
        selected: true,
        ...additionalProps
    };
}