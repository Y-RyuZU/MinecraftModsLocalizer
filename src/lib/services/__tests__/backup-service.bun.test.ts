import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { BackupService, type CreateBackupOptions, type BackupInfo } from '../backup-service';

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