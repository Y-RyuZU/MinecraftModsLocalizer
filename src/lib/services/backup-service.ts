/**
 * Backup service for translation system
 * Handles backup creation, listing, restoration, and management using existing session infrastructure
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
    const hasTauriClass = document.documentElement.classList.contains('tauri');
    
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
      const backupId = this.generateBackupId(options.type, options.sourceName, options.targetLanguage);
      
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
   * List available backups with optional filtering
   */
  async listBackups(options?: {
    type?: TranslationTargetType;
    sessionId?: string;
    limit?: number;
  }): Promise<BackupInfo[]> {
    if (!this.invoke) {
      throw new Error('Backup service requires Tauri environment');
    }

    try {
      const backups = await this.invoke<BackupInfo[]>('list_backups', {
        type: options?.type,
        sessionId: options?.sessionId,
        limit: options?.limit,
      });

      return backups;
    } catch (error) {
      console.error('Failed to list backups:', error);
      throw new Error(`Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore files from a backup
   */
  async restoreBackup(backupId: string, targetPath: string): Promise<void> {
    if (!this.invoke) {
      throw new Error('Backup service requires Tauri environment');
    }

    try {
      await this.invoke('restore_backup', {
        backupId,
        targetPath,
      });
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw new Error(`Backup restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    if (!this.invoke) {
      throw new Error('Backup service requires Tauri environment');
    }

    try {
      await this.invoke('delete_backup', { backupId });
    } catch (error) {
      console.error('Failed to delete backup:', error);
      throw new Error(`Backup deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Prune old backups based on retention policy
   */
  async pruneOldBackups(retentionDays: number): Promise<number> {
    if (!this.invoke) {
      throw new Error('Backup service requires Tauri environment');
    }

    try {
      const deletedCount = await this.invoke<number>('prune_old_backups', {
        retentionDays,
      });

      return deletedCount;
    } catch (error) {
      console.error('Failed to prune old backups:', error);
      throw new Error(`Backup pruning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get backup details by ID
   */
  async getBackupInfo(backupId: string): Promise<BackupInfo | null> {
    if (!this.invoke) {
      throw new Error('Backup service requires Tauri environment');
    }

    try {
      const backupInfo = await this.invoke<BackupInfo | null>('get_backup_info', {
        backupId,
      });

      return backupInfo;
    } catch (error) {
      console.error('Failed to get backup info:', error);
      throw new Error(`Failed to get backup info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get total backup storage size
   */
  async getBackupStorageSize(): Promise<number> {
    if (!this.invoke) {
      throw new Error('Backup service requires Tauri environment');
    }

    try {
      const size = await this.invoke<number>('get_backup_storage_size');
      return size;
    } catch (error) {
      console.error('Failed to get backup storage size:', error);
      throw new Error(`Failed to get backup storage size: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(type: TranslationTargetType, sourceName: string, targetLanguage: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanSourceName = sourceName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${type}_${cleanSourceName}_${targetLanguage}_${timestamp}`;
  }
}

// Export singleton instance
export const backupService = new BackupService();