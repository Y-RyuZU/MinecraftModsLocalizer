/**
 * Simplified backup service for translation system
 * Only handles backup creation - all management features have been removed
 * as per TX016 specification for a minimal backup system
 */

import { type TranslationTargetType } from '@/lib/types/minecraft';

// Check if we're running in a server-side rendering environment
const isSSR = typeof window === 'undefined';

// Check if we're running in a Tauri environment
const isTauriEnvironment = (): boolean => {
  if (isSSR) return false;
  
  try {
    const hasTauriInternals = typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined';
    const hasIsTauri = typeof (window as unknown as Record<string, unknown>).isTauri !== 'undefined';
    const hasTauriClass = typeof document !== 'undefined' && document.documentElement?.classList?.contains('tauri');
    
    return hasTauriInternals || hasIsTauri || hasTauriClass;
  } catch (error) {
    console.error('Error checking Tauri environment:', error);
    return false;
  }
};

const isTauri = !isSSR && isTauriEnvironment();

// Get the Tauri invoke function
const getTauriInvokeFunction = () => {
  if (!isTauri || isSSR) return null;
  
  if (typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
    const tauriInternals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ as Record<string, unknown>;
    if (typeof tauriInternals?.invoke === 'function') {
      return tauriInternals.invoke as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    }
  }
  
  return null;
};

/**
 * Backup metadata interface
 */
export interface BackupMetadata {
  /** Unique backup identifier */
  id: string;
  /** Backup creation timestamp */
  timestamp: string;
  /** Type of content backed up */
  type: TranslationTargetType;
  /** Name of the source file/mod */
  sourceName: string;
  /** Target language code */
  targetLanguage: string;
  /** Session ID this backup belongs to */
  sessionId: string;
  /** Translation statistics */
  statistics: {
    totalKeys: number;
    successfulTranslations: number;
    fileSize: number;
  };
  /** Original file paths that were backed up */
  originalPaths: string[];
}

/**
 * Backup information interface
 */
export interface BackupInfo {
  /** Backup metadata */
  metadata: BackupMetadata;
  /** Full path to backup directory */
  backupPath: string;
  /** Whether this backup can be restored */
  canRestore: boolean;
}

/**
 * Backup creation options
 */
export interface CreateBackupOptions {
  /** Type of content being backed up */
  type: TranslationTargetType;
  /** Name of the source */
  sourceName: string;
  /** Target language */
  targetLanguage: string;
  /** Session ID for the current translation session */
  sessionId: string;
  /** Paths to files that will be backed up */
  filePaths: string[];
  /** Translation statistics */
  statistics: {
    totalKeys: number;
    successfulTranslations: number;
    fileSize: number;
  };
}

/**
 * Backup service implementation
 */
export class BackupService {
  private invoke = getTauriInvokeFunction();

  /**
   * Create a backup before translation begins
   */
  async createBackup(options: CreateBackupOptions): Promise<BackupInfo> {
    if (!this.invoke) {
      throw new Error('Backup service requires Tauri environment');
    }

    try {
      // Generate unique backup ID
      const backupId = this.generateFullBackupId(options.type, options.sourceName, options.targetLanguage);
      
      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date().toISOString(),
        type: options.type,
        sourceName: options.sourceName,
        targetLanguage: options.targetLanguage,
        sessionId: options.sessionId,
        statistics: options.statistics,
        originalPaths: options.filePaths,
      };

      // Call Tauri backend to create backup
      const backupPath = await this.invoke<string>('create_backup', {
        metadata,
        filePaths: options.filePaths,
      });

      return {
        metadata,
        backupPath,
        canRestore: true,
      };
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error(`Backup creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Generate unique backup ID for a given type (public for testing)
   */
  generateBackupId(type: TranslationTargetType): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                      new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    return `${timestamp}_${type}`;
  }

  /**
   * Generate unique backup ID with full details
   */
  private generateFullBackupId(type: TranslationTargetType, sourceName: string, targetLanguage: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanSourceName = sourceName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${type}_${cleanSourceName}_${targetLanguage}_${timestamp}`;
  }
}

// Export singleton instance
export const backupService = new BackupService();