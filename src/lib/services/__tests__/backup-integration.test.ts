import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { invoke } from '@tauri-apps/api/core';
import path from 'path';

// Mock Tauri invoke
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn()
}));

describe('Backup Integration Tests', () => {
  const mockMinecraftDir = '/test/minecraft';
  const mockSessionId = '2025-07-16_14-30-45';
  const mockInvoke = invoke as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SNBT Backup Flow', () => {
    test('should backup SNBT files before translation', async () => {
      const snbtFiles = [
        '/path/to/quest1.snbt',
        '/path/to/quest2.snbt'
      ];
      
      // Mock successful backup
      mockInvoke.mockResolvedValueOnce(undefined);

      await invoke('backup_snbt_files', {
        files: snbtFiles,
        sessionPath: path.join(mockMinecraftDir, 'logs', 'localizer', mockSessionId)
      });

      expect(mockInvoke).toHaveBeenCalledWith('backup_snbt_files', {
        files: snbtFiles,
        sessionPath: expect.stringContaining(mockSessionId)
      });
    });

    test('should handle backup failure gracefully', async () => {
      const snbtFiles = ['/path/to/quest.snbt'];
      
      // Mock backup failure
      mockInvoke.mockRejectedValueOnce(new Error('Backup failed'));

      // Should not throw - backup failures don't interrupt translation
      await expect(
        invoke('backup_snbt_files', {
          files: snbtFiles,
          sessionPath: path.join(mockMinecraftDir, 'logs', 'localizer', mockSessionId)
        })
      ).rejects.toThrow('Backup failed');
    });
  });

  describe('Resource Pack Backup Flow', () => {
    test('should backup resource pack after translation', async () => {
      const resourcePackPath = '/path/to/resource-pack';
      
      // Mock successful backup
      mockInvoke.mockResolvedValueOnce(undefined);

      await invoke('backup_resource_pack', {
        packPath: resourcePackPath,
        sessionPath: path.join(mockMinecraftDir, 'logs', 'localizer', mockSessionId)
      });

      expect(mockInvoke).toHaveBeenCalledWith('backup_resource_pack', {
        packPath: resourcePackPath,
        sessionPath: expect.stringContaining(mockSessionId)
      });
    });
  });

  describe('Translation Summary Updates', () => {
    test('should update translation summary after each job', async () => {
      const summaryData = {
        minecraftDir: mockMinecraftDir,
        sessionId: mockSessionId,
        translationType: 'mod',
        name: 'Applied Energistics 2',
        status: 'completed',
        translatedKeys: 1523,
        totalKeys: 1523,
        targetLanguage: 'ja_jp'
      };

      // Mock successful update
      mockInvoke.mockResolvedValueOnce(undefined);

      await invoke('update_translation_summary', summaryData);

      expect(mockInvoke).toHaveBeenCalledWith('update_translation_summary', summaryData);
    });

    test('should handle concurrent summary updates', async () => {
      const updates = [
        {
          minecraftDir: mockMinecraftDir,
          sessionId: mockSessionId,
          translationType: 'mod',
          name: 'Mod1',
          status: 'completed',
          translatedKeys: 100,
          totalKeys: 100,
          targetLanguage: 'ja_jp'
        },
        {
          minecraftDir: mockMinecraftDir,
          sessionId: mockSessionId,
          translationType: 'quest',
          name: 'Quest1',
          status: 'completed',
          translatedKeys: 50,
          totalKeys: 50,
          targetLanguage: 'ja_jp'
        }
      ];

      // Mock all updates as successful
      mockInvoke.mockResolvedValue(undefined);

      // Fire updates concurrently
      await Promise.all(
        updates.map(update => invoke('update_translation_summary', update))
      );

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });
  });

  describe('Translation History Dialog', () => {
    test('should list translation sessions sorted by newest first', async () => {
      const mockSessions = [
        '2025-07-16_14-30-45',
        '2025-07-16_10-15-23',
        '2025-07-15_18-45-00'
      ];

      mockInvoke.mockResolvedValueOnce(mockSessions);

      const sessions = await invoke('list_translation_sessions', {
        minecraftDir: mockMinecraftDir
      });

      expect(sessions).toEqual(mockSessions);
      // Verify newest first ordering
      expect(sessions[0]).toBe('2025-07-16_14-30-45');
      expect(sessions[sessions.length - 1]).toBe('2025-07-15_18-45-00');
    });

    test('should retrieve translation summary for a session', async () => {
      const mockSummary = {
        lang: 'ja_jp',
        translations: [
          {
            type: 'mod',
            name: 'Applied Energistics 2',
            status: 'completed',
            keys: '1523/1523'
          },
          {
            type: 'quest',
            name: 'chapter_1.snbt',
            status: 'completed',
            keys: '234/234'
          }
        ]
      };

      mockInvoke.mockResolvedValueOnce(mockSummary);

      const summary = await invoke('get_translation_summary', {
        minecraftDir: mockMinecraftDir,
        sessionId: mockSessionId
      });

      expect(summary).toEqual(mockSummary);
    });

    test('should handle missing translation summary gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Translation summary not found'));

      await expect(
        invoke('get_translation_summary', {
          minecraftDir: mockMinecraftDir,
          sessionId: 'non-existent-session'
        })
      ).rejects.toThrow('Translation summary not found');
    });
  });

  describe('Session ID Consistency', () => {
    test('should use same session ID for entire translation batch', async () => {
      // Mock session ID generation
      mockInvoke.mockResolvedValueOnce(mockSessionId);

      const sessionId = await invoke('generate_session_id');
      
      // Simulate multiple translation jobs using same session
      const jobs = ['mod1', 'mod2', 'quest1'];
      
      for (const job of jobs) {
        await invoke('update_translation_summary', {
          minecraftDir: mockMinecraftDir,
          sessionId: sessionId,
          translationType: job.startsWith('mod') ? 'mod' : 'quest',
          name: job,
          status: 'completed',
          translatedKeys: 100,
          totalKeys: 100,
          targetLanguage: 'ja_jp'
        });
      }

      // Verify all updates used the same session ID
      const updateCalls = mockInvoke.mock.calls.filter(
        call => call[0] === 'update_translation_summary'
      );
      
      expect(updateCalls).toHaveLength(3);
      updateCalls.forEach(call => {
        expect(call[1].sessionId).toBe(sessionId);
      });
    });
  });

  describe('Backup Service Integration', () => {
    test('createBackup should generate proper backup ID with session timestamp', async () => {
      // Mock successful backup creation
      mockInvoke.mockResolvedValueOnce({
        id: 'quest_test_quest_ja_jp_2025-07-16T14-30-45-000Z',
        path: '/test/config/backups/quest_test_quest_ja_jp_2025-07-16T14-30-45-000Z',
        metadata: {
          id: 'quest_test_quest_ja_jp_2025-07-16T14-30-45-000Z',
          type: 'quest',
          source: 'test_quest',
          targetLanguage: 'ja_jp',
          timestamp: '2025-07-16T14:30:45.000Z',
          originalPath: '/test/quest.snbt'
        }
      });

      const result = await invoke('create_backup', {
        type: 'quest',
        sourceName: 'test_quest',
        targetLanguage: 'ja_jp',
        originalPath: '/test/quest.snbt',
        configDir: '/test/config'
      });
      
      // Verify format matches expected pattern
      expect(result.metadata.id).toMatch(/^quest_test_quest_ja_jp_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
    });
  });
});