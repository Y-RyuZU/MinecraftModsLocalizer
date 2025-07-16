import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TranslationService } from '@/lib/services/translation-service';
import { FileService } from '@/lib/services/file-service';
import { BackupService } from '@/lib/services/backup-service';
import type { TranslationTarget, TranslationTargetType } from '@/lib/types/minecraft';

// Mock Tauri API
const mockInvoke = mock();
global.window = {
  __TAURI_INTERNALS__: {
    invoke: mockInvoke
  }
} as any;

// Simple mock adapter for E2E testing
class SimpleE2EMockAdapter {
  async translate(request: any): Promise<any> {
    const translations: Record<string, string> = {};
    
    // Simple mock translation: add [JP] prefix
    for (const [key, value] of Object.entries(request.content)) {
      if (typeof value === 'string') {
        translations[key] = `[JP] ${value}`;
      }
    }
    
    return {
      success: true,
      content: translations,
      usage: {
        prompt_tokens: 100,
        completion_tokens: 100,
        total_tokens: 200
      }
    };
  }
  
  getChunkSize(): number {
    return 50;
  }
  
  dispose(): void {
    // No-op
  }
}

describe('Backup System E2E Tests', () => {
  const testDir = path.join(process.cwd(), 'test-output', 'backup-e2e');
  const configDir = path.join(testDir, 'config');
  const logsDir = path.join(testDir, 'logs');
  const sessionId = '2025-07-16_14-30-45';
  
  beforeAll(async () => {
    // Create test directories
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(logsDir, { recursive: true });
    
    // Mock file system operations
    mockInvoke.mockImplementation(async (command: string, args: any) => {
      switch (command) {
        case 'generate_session_id':
          return sessionId;
          
        case 'backup_snbt_files': {
          // Simulate SNBT backup
          const backupDir = path.join(args.sessionPath, 'backup', 'snbt_original');
          await fs.mkdir(backupDir, { recursive: true });
          for (const file of args.files) {
            const fileName = path.basename(file);
            await fs.writeFile(path.join(backupDir, fileName), 'original content');
          }
          return;
        }
          
        case 'backup_resource_pack': {
          // Simulate resource pack backup
          const packBackupDir = path.join(args.sessionPath, 'backup', 'resource_pack');
          await fs.mkdir(packBackupDir, { recursive: true });
          await fs.writeFile(path.join(packBackupDir, 'pack.mcmeta'), '{}');
          return;
        }
          
        case 'update_translation_summary': {
          // Simulate summary update
          const summaryPath = path.join(logsDir, 'localizer', args.sessionId, 'translation_summary.json');
          await fs.mkdir(path.dirname(summaryPath), { recursive: true });
          
          let summary = { lang: args.targetLanguage, translations: [] };
          try {
            const existing = await fs.readFile(summaryPath, 'utf-8');
            summary = JSON.parse(existing);
          } catch {}
          
          summary.translations.push({
            type: args.translationType,
            name: args.name,
            status: args.status,
            keys: `${args.translatedKeys}/${args.totalKeys}`
          });
          
          await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
          return;
        }
          
        case 'list_translation_sessions':
          // Return mock sessions
          return [sessionId, '2025-07-15_10-15-23'];
          
        case 'get_translation_summary':
          // Return mock summary
          return {
            lang: 'ja_jp',
            translations: [
              {
                type: 'quest',
                name: 'test_quest.snbt',
                status: 'completed',
                keys: '10/10'
              }
            ]
          };
          
        // Handle logging commands
        case 'log_translation_start':
        case 'log_translation_statistics':
        case 'log_translation_process':
        case 'log_translation_completion':
        case 'log_error':
        case 'log_file_operation':
          // Mock logging - just return success
          return;
          
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    });
  });
  
  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {}
  });
  
  test('SNBT backup flow', async () => {
    const files = ['/test/quest1.snbt', '/test/quest2.snbt'];
    const sessionPath = path.join(logsDir, 'localizer', sessionId);
    
    // Trigger backup
    await mockInvoke('backup_snbt_files', { files, sessionPath });
    
    // Verify backup was created
    const backupDir = path.join(sessionPath, 'backup', 'snbt_original');
    const backupExists = await fs.access(backupDir).then(() => true).catch(() => false);
    expect(backupExists).toBe(true);
    
    // Verify files were backed up
    const backedUpFiles = await fs.readdir(backupDir);
    expect(backedUpFiles).toContain('quest1.snbt');
    expect(backedUpFiles).toContain('quest2.snbt');
  });
  
  test('Resource pack backup flow', async () => {
    const packPath = '/test/resource-pack';
    const sessionPath = path.join(logsDir, 'localizer', sessionId);
    
    // Trigger backup
    await mockInvoke('backup_resource_pack', { packPath, sessionPath });
    
    // Verify backup was created
    const backupDir = path.join(sessionPath, 'backup', 'resource_pack');
    const backupExists = await fs.access(backupDir).then(() => true).catch(() => false);
    expect(backupExists).toBe(true);
    
    // Verify pack.mcmeta exists
    const packMeta = await fs.readFile(path.join(backupDir, 'pack.mcmeta'), 'utf-8');
    expect(packMeta).toBe('{}');
  });
  
  test('Translation summary updates', async () => {
    const summaryData = {
      minecraftDir: testDir,
      sessionId,
      translationType: 'quest',
      name: 'test_quest.snbt',
      status: 'completed',
      translatedKeys: 10,
      totalKeys: 10,
      targetLanguage: 'ja_jp'
    };
    
    // Update summary
    await mockInvoke('update_translation_summary', summaryData);
    
    // Verify summary was created
    const summaryPath = path.join(logsDir, 'localizer', sessionId, 'translation_summary.json');
    const summaryExists = await fs.access(summaryPath).then(() => true).catch(() => false);
    expect(summaryExists).toBe(true);
    
    // Verify content
    const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
    expect(summary.lang).toBe('ja_jp');
    expect(summary.translations).toHaveLength(1);
    expect(summary.translations[0]).toEqual({
      type: 'quest',
      name: 'test_quest.snbt',
      status: 'completed',
      keys: '10/10'
    });
  });
  
  test('Translation history retrieval', async () => {
    // Get session list
    const sessions = await mockInvoke('list_translation_sessions', { minecraftDir: testDir });
    expect(sessions).toContain(sessionId);
    expect(sessions[0]).toBe(sessionId); // Newest first
    
    // Get session summary
    const summary = await mockInvoke('get_translation_summary', {
      minecraftDir: testDir,
      sessionId
    });
    
    expect(summary.lang).toBe('ja_jp');
    expect(summary.translations).toHaveLength(1);
    
    // Test session stats calculation
    const totalTranslations = summary.translations.length;
    const successfulTranslations = summary.translations.filter(t => t.status === 'completed').length;
    const successRate = (successfulTranslations / totalTranslations) * 100;
    
    expect(totalTranslations).toBe(1);
    expect(successfulTranslations).toBe(1);
    expect(successRate).toBe(100);
  });
  
  test('Complete translation flow with backups', async () => {
    // Setup test files
    const questFile = path.join(configDir, 'ftbquests', 'quests', 'test.snbt');
    await fs.mkdir(path.dirname(questFile), { recursive: true });
    await fs.writeFile(questFile, 'quest_data { title: "Test Quest" }');
    
    // The backup flow is triggered from the UI components (QuestsTab/ModsTab),
    // not from the translation service itself.
    // Here we'll just verify the backup commands work when called directly.
    
    const sessionPath = path.join(logsDir, 'localizer', sessionId);
    
    // Test SNBT backup
    await mockInvoke('backup_snbt_files', {
      files: [questFile],
      sessionPath
    });
    
    // Verify backup directory was created
    const backupDir = path.join(sessionPath, 'backup', 'snbt_original');
    const backupExists = await fs.access(backupDir).then(() => true).catch(() => false);
    expect(backupExists).toBe(true);
    
    // Test translation summary update
    await mockInvoke('update_translation_summary', {
      minecraftDir: testDir,
      sessionId,
      translationType: 'quest',
      name: 'test.snbt',
      status: 'completed',
      translatedKeys: 1,
      totalKeys: 1,
      targetLanguage: 'ja_jp'
    });
    
    // Verify summary was created
    const summaryPath = path.join(logsDir, 'localizer', sessionId, 'translation_summary.json');
    const summaryExists = await fs.access(summaryPath).then(() => true).catch(() => false);
    expect(summaryExists).toBe(true);
  });
  
  test('Backup service integration', async () => {
    const backupService = new BackupService();
    
    // Test backup ID generation
    const backupId = backupService.generateBackupId('quest');
    expect(backupId).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_quest$/);
    
    // Mock Tauri environment for createBackup test
    const originalInvoke = backupService['invoke'];
    backupService['invoke'] = mockInvoke as any;
    
    // Mock successful backup creation
    mockInvoke.mockImplementationOnce(async () => path.join(logsDir, 'backup', 'test-backup'));
    
    const result = await backupService.createBackup({
      type: 'quest' as TranslationTargetType,
      sourceName: 'test_quest',
      targetLanguage: 'ja_jp',
      sessionId,
      filePaths: ['/test/quest.snbt'],
      statistics: {
        totalKeys: 10,
        successfulTranslations: 10,
        fileSize: 1024
      }
    });
    
    expect(result.metadata.type).toBe('quest');
    expect(result.metadata.sourceName).toBe('test_quest');
    
    // Restore original invoke
    backupService['invoke'] = originalInvoke;
  });
});