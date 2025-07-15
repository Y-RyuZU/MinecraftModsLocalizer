import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { BackupService, type CreateBackupOptions, type BackupInfo, type BackupMetadata } from '../backup-service';

// Mock Tauri environment
const mockInvoke = mock(() => Promise.resolve());

// Mock window object for Tauri environment detection
Object.defineProperty(global, 'window', {
  value: {
    __TAURI_INTERNALS__: {
      invoke: mockInvoke
    }
  },
  writable: true,
});

// Mock document for Tauri environment detection
Object.defineProperty(global, 'document', {
  value: {
    documentElement: {
      classList: {
        contains: mock(() => true)
      }
    }
  },
  writable: true,
});

describe('BackupService', () => {
  let backupService: BackupService;

  beforeEach(() => {
    mockInvoke.mockClear();
    backupService = new BackupService();
  });

  describe('createBackup', () => {
    test('should create backup with valid options', async () => {
      const mockBackupPath = '/logs/localizer/2025-07-13_16-48-00/backups/mod_test-mod_ja_jp_2025-07-13T16-48-00-000Z';
      mockInvoke.mockResolvedValueOnce(mockBackupPath);

      const options: CreateBackupOptions = {
        type: 'mod',
        sourceName: 'test-mod',
        targetLanguage: 'ja_jp',
        sessionId: '2025-07-13_16-48-00',
        filePaths: ['/test/path/file.json'],
        statistics: {
          totalKeys: 100,
          successfulTranslations: 95,
          fileSize: 1024
        }
      };

      const result = await backupService.createBackup(options);

      expect(mockInvoke).toHaveBeenCalledWith('create_backup', {
        metadata: expect.objectContaining({
          type: 'mod',
          sourceName: 'test-mod',
          targetLanguage: 'ja_jp',
          sessionId: '2025-07-13_16-48-00',
          originalPaths: ['/test/path/file.json'],
          statistics: {
            totalKeys: 100,
            successfulTranslations: 95,
            fileSize: 1024
          }
        }),
        filePaths: ['/test/path/file.json']
      });

      expect(result.backupPath).toBe(mockBackupPath);
      expect(result.canRestore).toBe(true);
      expect(result.metadata.type).toBe('mod');
      expect(result.metadata.sourceName).toBe('test-mod');
    });

    test('should generate unique backup ID', async () => {
      const mockBackupPath = '/logs/localizer/session/backups/backup_id';
      mockInvoke.mockResolvedValueOnce(mockBackupPath);

      const options: CreateBackupOptions = {
        type: 'quest',
        sourceName: 'test quest',
        targetLanguage: 'zh_cn',
        sessionId: 'session-123',
        filePaths: ['/test/quest.snbt'],
        statistics: {
          totalKeys: 50,
          successfulTranslations: 48,
          fileSize: 512
        }
      };

      const result = await backupService.createBackup(options);

      expect(result.metadata.id).toMatch(/quest_test_quest_zh_cn_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z/);
    });

    test('should handle backup creation failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to create backup directory'));

      const options: CreateBackupOptions = {
        type: 'mod',
        sourceName: 'failing-mod',
        targetLanguage: 'ja_jp',
        sessionId: 'session-fail',
        filePaths: ['/test/fail.json'],
        statistics: {
          totalKeys: 10,
          successfulTranslations: 0,
          fileSize: 100
        }
      };

      await expect(backupService.createBackup(options)).rejects.toThrow('Backup creation failed');
    });
  });

  describe('listBackups', () => {
    test('should list all backups without filters', async () => {
      const mockBackups: BackupInfo[] = [
        {
          metadata: {
            id: 'backup1',
            timestamp: '2025-07-13T16:48:00.000Z',
            type: 'mod',
            sourceName: 'test-mod',
            targetLanguage: 'ja_jp',
            sessionId: 'session1',
            statistics: { totalKeys: 100, successfulTranslations: 95, fileSize: 1024 },
            originalPaths: ['/test/file1.json']
          },
          backupPath: '/logs/session1/backups/backup1',
          canRestore: true
        }
      ];

      mockInvoke.mockResolvedValueOnce(mockBackups);

      const result = await backupService.listBackups();

      expect(mockInvoke).toHaveBeenCalledWith('list_backups', {
        type: undefined,
        sessionId: undefined,
        limit: undefined
      });

      expect(result).toEqual(mockBackups);
    });

    test('should list backups with type filter', async () => {
      const mockBackups: BackupInfo[] = [];
      mockInvoke.mockResolvedValueOnce(mockBackups);

      await backupService.listBackups({ type: 'quest' });

      expect(mockInvoke).toHaveBeenCalledWith('list_backups', {
        type: 'quest',
        sessionId: undefined,
        limit: undefined
      });
    });

    test('should list backups with session filter', async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await backupService.listBackups({ sessionId: 'session-123' });

      expect(mockInvoke).toHaveBeenCalledWith('list_backups', {
        type: undefined,
        sessionId: 'session-123',
        limit: undefined
      });
    });

    test('should list backups with limit', async () => {
      mockInvoke.mockResolvedValueOnce([]);

      await backupService.listBackups({ limit: 5 });

      expect(mockInvoke).toHaveBeenCalledWith('list_backups', {
        type: undefined,
        sessionId: undefined,
        limit: 5
      });
    });
  });

  describe('restoreBackup', () => {
    test('should restore backup to target path', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const backupId = 'backup-123';
      const targetPath = '/restore/target';

      await backupService.restoreBackup(backupId, targetPath);

      expect(mockInvoke).toHaveBeenCalledWith('restore_backup', {
        backupId,
        targetPath
      });
    });

    test('should handle restore failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Backup not found'));

      await expect(
        backupService.restoreBackup('nonexistent', '/target')
      ).rejects.toThrow('Backup restoration failed');
    });
  });

  describe('deleteBackup', () => {
    test('should delete backup by ID', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const backupId = 'backup-to-delete';

      await backupService.deleteBackup(backupId);

      expect(mockInvoke).toHaveBeenCalledWith('delete_backup', {
        backupId
      });
    });

    test('should handle delete failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(
        backupService.deleteBackup('protected-backup')
      ).rejects.toThrow('Backup deletion failed');
    });
  });

  describe('pruneOldBackups', () => {
    test('should prune backups older than retention days', async () => {
      const deletedCount = 5;
      mockInvoke.mockResolvedValueOnce(deletedCount);

      const result = await backupService.pruneOldBackups(30);

      expect(mockInvoke).toHaveBeenCalledWith('prune_old_backups', {
        retentionDays: 30
      });

      expect(result).toBe(deletedCount);
    });

    test('should handle pruning with zero retention', async () => {
      mockInvoke.mockResolvedValueOnce(0);

      const result = await backupService.pruneOldBackups(0);

      expect(result).toBe(0);
    });
  });

  describe('getBackupInfo', () => {
    test('should get backup info by ID', async () => {
      const mockBackupInfo: BackupInfo = {
        metadata: {
          id: 'backup-info',
          timestamp: '2025-07-13T16:48:00.000Z',
          type: 'patchouli',
          sourceName: 'test-book',
          targetLanguage: 'ja_jp',
          sessionId: 'session-info',
          statistics: { totalKeys: 20, successfulTranslations: 20, fileSize: 2048 },
          originalPaths: ['/test/book.json']
        },
        backupPath: '/logs/session-info/backups/backup-info',
        canRestore: true
      };

      mockInvoke.mockResolvedValueOnce(mockBackupInfo);

      const result = await backupService.getBackupInfo('backup-info');

      expect(mockInvoke).toHaveBeenCalledWith('get_backup_info', {
        backupId: 'backup-info'
      });

      expect(result).toEqual(mockBackupInfo);
    });

    test('should return null for non-existent backup', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const result = await backupService.getBackupInfo('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getBackupStorageSize', () => {
    test('should get total backup storage size', async () => {
      const mockSize = 1048576; // 1MB
      mockInvoke.mockResolvedValueOnce(mockSize);

      const result = await backupService.getBackupStorageSize();

      expect(mockInvoke).toHaveBeenCalledWith('get_backup_storage_size');
      expect(result).toBe(mockSize);
    });

    test('should return zero for empty backup storage', async () => {
      mockInvoke.mockResolvedValueOnce(0);

      const result = await backupService.getBackupStorageSize();

      expect(result).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should throw error when not in Tauri environment', async () => {
      // Store original window
      const originalWindow = global.window;
      
      // Mock non-Tauri environment
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
      });

      const nonTauriService = new BackupService();

      await expect(nonTauriService.createBackup({} as CreateBackupOptions))
        .rejects.toThrow('Backup service requires Tauri environment');
        
      // Restore original window
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
      });
    });
  });

  describe('generateBackupId', () => {
    test('should generate valid backup ID format', async () => {
      // We can't directly test the private method, but we can verify the format through createBackup
      mockInvoke.mockResolvedValueOnce('/test/path');

      const options: CreateBackupOptions = {
        type: 'custom',
        sourceName: 'my-custom-file',
        targetLanguage: 'ko_kr',
        sessionId: 'session-test',
        filePaths: ['/test.json'],
        statistics: { totalKeys: 1, successfulTranslations: 1, fileSize: 100 }
      };

      const result = await backupService.createBackup(options);

      // Check ID format: type_cleanSourceName_targetLanguage_timestamp
      expect(result.metadata.id).toMatch(/^custom_my_custom_file_ko_kr_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
    });

    test('should clean source name for backup ID', async () => {
      mockInvoke.mockResolvedValueOnce('/test/path');

      const options: CreateBackupOptions = {
        type: 'mod',
        sourceName: 'mod with spaces & special chars!',
        targetLanguage: 'ja_jp',
        sessionId: 'session-test',
        filePaths: ['/test.json'],
        statistics: { totalKeys: 1, successfulTranslations: 1, fileSize: 100 }
      };

      const result = await backupService.createBackup(options);

      // Source name should be cleaned (spaces and special chars replaced with underscores)
      expect(result.metadata.id).toMatch(/^mod_mod_with_spaces___special_chars__ja_jp_/);
    });
  });
});