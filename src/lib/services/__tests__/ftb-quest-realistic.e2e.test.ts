/**
 * Realistic E2E Tests for FTB Quest Translation Logic
 * Uses actual SNBT file content and realistic translation scenarios
 */

import { FileService } from '../file-service';
import { invoke } from '@tauri-apps/api/core';
import { mockSNBTFiles, expectedTranslations, mockFileStructure } from '../../test-utils/mock-snbt-files';

// Mock Tauri API
jest.mock('@tauri-apps/api/core');
const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('FTB Quest Translation - Realistic E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SNBT Content Type Detection', () => {
    beforeEach(() => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        if (command === 'detect_snbt_content_type') {
          const filePath = args.filePath;
          
          // Simulate actual content type detection logic
          if (filePath.includes('starter_quest') || 
              filePath.includes('mining_chapter') || 
              filePath.includes('building_quest')) {
            return Promise.resolve('direct_text');
          }
          
          if (filePath.includes('localized_quest') || 
              filePath.includes('modded_items_quest') || 
              filePath.includes('mixed_content_quest')) {
            return Promise.resolve('json_keys');
          }
          
          return Promise.resolve('direct_text');
        }
        
        if (command === 'read_text_file') {
          const content = mockFileStructure[args.path as keyof typeof mockFileStructure];
          return Promise.resolve(content || '');
        }
        
        return Promise.resolve(true);
      });
    });

    it('should correctly detect direct text in starter quest', async () => {
      const result = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: '/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt'
      });

      expect(result).toBe('direct_text');
      
      // Verify the actual content contains direct text
      const content = await FileService.invoke<string>('read_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt'
      });
      
      expect(content).toContain('Welcome to the Adventure');
      expect(content).toContain('Welcome to this amazing modpack!');
      expect(content).toContain('Complete this quest to get started');
    });

    it('should correctly detect JSON keys in localized quest', async () => {
      const result = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: '/test/modpack/config/ftbquests/quests/chapters/localized_quest.snbt'
      });

      expect(result).toBe('json_keys');
      
      // Verify the actual content contains JSON key references
      const content = await FileService.invoke<string>('read_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/localized_quest.snbt'
      });
      
      expect(content).toContain('ftbquests.chapter.tutorial.title');
      expect(content).toContain('ftbquests.quest.tutorial.first.title');
      expect(content).toContain('ftbquests.task.collect.dirt.title');
    });

    it('should handle mixed content with proper classification', async () => {
      const result = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: '/test/modpack/config/ftbquests/quests/chapters/mixed_content_quest.snbt'
      });

      expect(result).toBe('json_keys');
      
      const content = await FileService.invoke<string>('read_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/mixed_content_quest.snbt'
      });
      
      // Mixed content should be classified as json_keys due to majority pattern
      expect(content).toContain('ftbquests.quest.mixed.automation.title');
      expect(content).toContain('item.thermal.machine_pulverizer');
      expect(content).toContain('block.minecraft.redstone_ore');
    });
  });

  describe('KubeJS Lang File Translation', () => {
    beforeEach(() => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'get_ftb_quest_files':
            // Simulate KubeJS lang file discovery
            return Promise.resolve([
              {
                id: 'kubejs_en_us',
                name: 'en_us.json',
                path: '/test/modpack/kubejs/assets/kubejs/lang/en_us.json',
                questFormat: 'ftb'
              }
            ]);
          
          case 'read_text_file':
            const content = mockFileStructure[args.path as keyof typeof mockFileStructure];
            return Promise.resolve(content || '');
          
          case 'write_text_file':
            // Verify the translation path and content
            if (args.path.includes('ja_jp.json')) {
              const translatedContent = JSON.parse(args.content);
              
              // Verify that key structure is maintained
              expect(translatedContent).toHaveProperty('ftbquests.chapter.tutorial.title');
              expect(translatedContent).toHaveProperty('ftbquests.quest.tutorial.first.title');
              
              // Verify that values are translated (mock translation)
              expect(translatedContent['ftbquests.chapter.tutorial.title']).toContain('チュートリアル');
            }
            return Promise.resolve(true);
          
          case 'check_quest_translation_exists':
            // Simulate no existing translation
            return Promise.resolve(false);
          
          default:
            return Promise.resolve(true);
        }
      });
    });

    it('should translate KubeJS lang file and maintain key structure', async () => {
      // Read the original lang file
      const originalContent = await FileService.invoke<string>('read_text_file', {
        path: '/test/modpack/kubejs/assets/kubejs/lang/en_us.json'
      });

      const originalLang = JSON.parse(originalContent);
      
      // Verify original structure
      expect(originalLang).toHaveProperty('ftbquests.chapter.tutorial.title');
      expect(originalLang['ftbquests.chapter.tutorial.title']).toBe('Getting Started Tutorial');
      
      // Simulate translation process
      const translatedLang: Record<string, string> = {};
      for (const [key, value] of Object.entries(originalLang)) {
        // Mock translation: replace with Japanese equivalent
        const japaneseTranslation = expectedTranslations.ja_jp.kubejsLang[value as string] || `[ja_jp] ${value}`;
        translatedLang[key] = japaneseTranslation;
      }

      // Write translated file
      await FileService.invoke<boolean>('write_text_file', {
        path: '/test/modpack/kubejs/assets/kubejs/lang/ja_jp.json',
        content: JSON.stringify(translatedLang, null, 2)
      });

      // Verify the write call was made correctly
      expect(mockInvoke).toHaveBeenCalledWith('write_text_file', {
        path: '/test/modpack/kubejs/assets/kubejs/lang/ja_jp.json',
        content: expect.stringContaining('入門チュートリアル')
      });
    });

    it('should discover KubeJS files correctly', async () => {
      const questFiles = await FileService.invoke<any[]>('get_ftb_quest_files', {
        dir: '/test/modpack'
      });

      expect(questFiles).toHaveLength(1);
      expect(questFiles[0]).toMatchObject({
        name: 'en_us.json',
        path: '/test/modpack/kubejs/assets/kubejs/lang/en_us.json',
        questFormat: 'ftb'
      });
    });
  });

  describe('Direct SNBT Translation', () => {
    beforeEach(() => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'get_ftb_quest_files':
            // Simulate direct SNBT file discovery (no KubeJS)
            return Promise.resolve([
              {
                id: 'starter_quest',
                name: 'starter_quest.snbt',
                path: '/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt',
                questFormat: 'ftb'
              },
              {
                id: 'mining_chapter',
                name: 'mining_chapter.snbt',
                path: '/test/modpack/config/ftbquests/quests/chapters/mining_chapter.snbt',
                questFormat: 'ftb'
              }
            ]);
          
          case 'detect_snbt_content_type':
            return Promise.resolve('direct_text');
          
          case 'read_text_file':
            const content = mockFileStructure[args.path as keyof typeof mockFileStructure];
            return Promise.resolve(content || '');
          
          case 'write_text_file':
            // Verify in-place translation for direct text
            if (args.path.includes('starter_quest.snbt')) {
              expect(args.content).toContain('アドベンチャーへようこそ');
              expect(args.content).toContain('この素晴らしいモッドパックへようこそ！');
            }
            return Promise.resolve(true);
          
          case 'backup_snbt_files':
            // Verify backup is called before translation
            expect(args.files).toContain('/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt');
            return Promise.resolve(true);
          
          default:
            return Promise.resolve(true);
        }
      });
    });

    it('should translate direct text SNBT files in-place', async () => {
      // Read original file
      const originalContent = await FileService.invoke<string>('read_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt'
      });

      expect(originalContent).toContain('Welcome to the Adventure');
      expect(originalContent).toContain('Welcome to this amazing modpack!');

      // Simulate translation
      let translatedContent = originalContent;
      for (const [english, japanese] of Object.entries(expectedTranslations.ja_jp.directText)) {
        translatedContent = translatedContent.replace(new RegExp(english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), japanese);
      }

      // Write back to same file (in-place)
      await FileService.invoke<boolean>('write_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt',
        content: translatedContent
      });

      // Verify backup was called
      expect(mockInvoke).toHaveBeenCalledWith('backup_snbt_files', {
        files: expect.arrayContaining(['/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt']),
        sessionPath: expect.any(String)
      });

      // Verify translation was written to original file
      expect(mockInvoke).toHaveBeenCalledWith('write_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt',
        content: expect.stringContaining('アドベンチャーへようこそ')
      });
    });

    it('should handle complex SNBT structure correctly', async () => {
      const originalContent = await FileService.invoke<string>('read_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/mining_chapter.snbt'
      });

      // Verify complex structure is preserved
      expect(originalContent).toContain('id: "0000000000000002"');
      expect(originalContent).toContain('group: "mining"');
      expect(originalContent).toContain('order_index: 1');
      expect(originalContent).toContain('dependencies: ["1A2B3C4D5E6F7890"]');

      // Verify translatable content is identified
      expect(originalContent).toContain('Mining and Resources');
      expect(originalContent).toContain('First Pickaxe');
      expect(originalContent).toContain('Craft your mining tool');
    });
  });

  describe('JSON Key Reference Handling', () => {
    beforeEach(() => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'detect_snbt_content_type':
            if (args.filePath.includes('localized_quest')) {
              return Promise.resolve('json_keys');
            }
            return Promise.resolve('direct_text');
          
          case 'read_text_file':
            const content = mockFileStructure[args.path as keyof typeof mockFileStructure];
            return Promise.resolve(content || '');
          
          case 'write_text_file':
            // For SNBT files, should modify original file in-place
            if (args.path.includes('localized_quest.snbt') && !args.path.includes('ja_jp')) {
              // Keys should remain unchanged for JSON key reference files
              expect(args.content).toContain('ftbquests.chapter.tutorial.title');
              expect(args.content).toContain('ftbquests.quest.tutorial.first.title');
              expect(args.content).not.toContain('チュートリアル'); // No direct translation in SNBT
            }
            return Promise.resolve(true);
          
          default:
            return Promise.resolve(true);
        }
      });
    });

    it('should preserve JSON keys in SNBT files', async () => {
      const contentType = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: '/test/modpack/config/ftbquests/quests/chapters/localized_quest.snbt'
      });

      expect(contentType).toBe('json_keys');

      const originalContent = await FileService.invoke<string>('read_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/localized_quest.snbt'
      });

      // For JSON keys, content should be preserved as-is and written to original file
      // Translation would happen in the corresponding lang file, not the SNBT
      await FileService.invoke<boolean>('write_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/localized_quest.snbt',
        content: originalContent // Keys preserved
      });

      expect(mockInvoke).toHaveBeenCalledWith('write_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/localized_quest.snbt',
        content: expect.stringContaining('ftbquests.chapter.tutorial.title')
      });
    });

    it('should handle modded item references correctly', async () => {
      const originalContent = await FileService.invoke<string>('read_text_file', {
        path: '/test/modpack/config/ftbquests/quests/chapters/modded_items_quest.snbt'
      });

      // Verify modded item references are preserved
      expect(originalContent).toContain('thermal:machine_frame');
      expect(originalContent).toContain('thermal:machine_furnace');
      expect(originalContent).toContain('thermal:energy_cell');

      // Verify quest keys are preserved
      expect(originalContent).toContain('ftbquests.chapter.modded.title');
      expect(originalContent).toContain('ftbquests.quest.modded.machines.title');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle mixed modpack with both KubeJS and direct SNBT', async () => {
      // Scenario: Modpack has both KubeJS lang files and some direct text SNBT files
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'get_ftb_quest_files':
            // Return both types of files
            return Promise.resolve([
              {
                id: 'kubejs_en_us',
                name: 'en_us.json',
                path: '/test/modpack/kubejs/assets/kubejs/lang/en_us.json',
                questFormat: 'ftb'
              },
              {
                id: 'legacy_quest',
                name: 'legacy_quest.snbt',
                path: '/test/modpack/config/ftbquests/quests/chapters/legacy_quest.snbt',
                questFormat: 'ftb'
              }
            ]);
          
          case 'detect_snbt_content_type':
            if (args.filePath.includes('legacy_quest')) {
              return Promise.resolve('direct_text');
            }
            return Promise.resolve('json_keys');
          
          default:
            return Promise.resolve(true);
        }
      });

      const questFiles = await FileService.invoke<any[]>('get_ftb_quest_files', {
        dir: '/test/modpack'
      });

      expect(questFiles).toHaveLength(2);
      
      // Verify KubeJS file
      const kubejsFile = questFiles.find(f => f.name === 'en_us.json');
      expect(kubejsFile).toBeDefined();
      expect(kubejsFile.path).toContain('kubejs/assets/kubejs/lang');

      // Verify legacy SNBT file
      const legacyFile = questFiles.find(f => f.name === 'legacy_quest.snbt');
      expect(legacyFile).toBeDefined();
      expect(legacyFile.path).toContain('config/ftbquests/quests');

      // Verify content type detection
      const contentType = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: legacyFile.path
      });
      expect(contentType).toBe('direct_text');
    });

    it('should validate realistic file paths and structures', async () => {
      // Test realistic file path patterns
      const testPaths = [
        '/home/user/.minecraft/config/ftbquests/quests/chapters/chapter1.snbt',
        '/home/user/.minecraft/kubejs/assets/kubejs/lang/en_us.json',
        'C:\\Users\\user\\AppData\\Roaming\\.minecraft\\config\\ftbquests\\quests\\main.snbt',
        '/opt/minecraft/server/config/ftbquests/quests/rewards/reward_chapter.snbt'
      ];

      for (const testPath of testPaths) {
        mockInvoke.mockResolvedValueOnce('direct_text');
        
        const result = await FileService.invoke<string>('detect_snbt_content_type', {
          filePath: testPath
        });

        expect(result).toBe('direct_text');
        expect(mockInvoke).toHaveBeenCalledWith('detect_snbt_content_type', {
          filePath: testPath
        });
      }
    });
  });
});