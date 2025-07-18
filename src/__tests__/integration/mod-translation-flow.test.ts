import { FileService } from '../../lib/services/file-service';
import { generateTestModData } from '../services/mod-translation-check.test';

// Mock the FileService
const mockInvoke = jest.fn();

describe('Mod Translation Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FileService.setTestInvokeOverride(mockInvoke);
  });

  afterEach(() => {
    FileService.setTestInvokeOverride(null);
  });

  describe('Complete Translation Detection Flow', () => {
    it('should correctly detect existing translations during mod scanning', async () => {
      // Mock responses for the complete flow
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'get_mod_files':
            return Promise.resolve([
              '/mods/SilentGear-1.19.2-3.2.2.jar',
              '/mods/create-1.19.2-0.5.1.jar',
              '/mods/custommod-1.0.0.jar',
            ]);
          
          case 'analyze_mod_jar':
            // Return mod info based on the jar path
            if (args.jarPath.includes('SilentGear')) {
              return Promise.resolve({
                id: 'silentgear',
                name: 'Silent Gear',
                version: '3.2.2',
                jarPath: args.jarPath,
                langFiles: [
                  { language: 'en_us', path: 'assets/silentgear/lang/en_us.json', content: {} },
                  { language: 'ja_jp', path: 'assets/silentgear/lang/ja_jp.json', content: {} },
                  { language: 'zh_cn', path: 'assets/silentgear/lang/zh_cn.json', content: {} },
                ],
                patchouliBooks: [],
                langFormat: 'json',
              });
            } else if (args.jarPath.includes('create')) {
              return Promise.resolve({
                id: 'create',
                name: 'Create',
                version: '0.5.1',
                jarPath: args.jarPath,
                langFiles: [
                  { language: 'en_us', path: 'assets/create/lang/en_us.json', content: {} },
                  { language: 'ja_jp', path: 'assets/create/lang/ja_jp.json', content: {} },
                  { language: 'zh_cn', path: 'assets/create/lang/zh_cn.json', content: {} },
                  { language: 'ko_kr', path: 'assets/create/lang/ko_kr.json', content: {} },
                  { language: 'de_de', path: 'assets/create/lang/de_de.json', content: {} },
                ],
                patchouliBooks: [],
                langFormat: 'json',
              });
            } else {
              return Promise.resolve({
                id: 'custommod',
                name: 'Custom Mod',
                version: '1.0.0',
                jarPath: args.jarPath,
                langFiles: [
                  { language: 'en_us', path: 'assets/custommod/lang/en_us.json', content: {} },
                ],
                patchouliBooks: [],
                langFormat: 'json',
              });
            }
          
          case 'check_mod_translation_exists':
            // Use test data to determine if translation exists
            const testData = generateTestModData();
            const mod = testData.find(m => m.id === args.modId);
            if (mod && mod.expectedTranslations[args.targetLanguage as keyof typeof mod.expectedTranslations] !== undefined) {
              return Promise.resolve(mod.expectedTranslations[args.targetLanguage as keyof typeof mod.expectedTranslations]);
            }
            return Promise.resolve(false);
          
          default:
            return Promise.resolve(null);
        }
      });

      // Simulate scanning mods
      const modFiles = await FileService.getModFiles('/mods');
      expect(modFiles).toHaveLength(3);

      // Simulate analyzing each mod and checking for translations
      const targetLanguage = 'ja_jp';
      const modTargets = [];

      for (const modFile of modFiles) {
        const modInfo = await FileService.invoke<any>('analyze_mod_jar', { jarPath: modFile });
        
        const hasExistingTranslation = await FileService.invoke<boolean>('check_mod_translation_exists', {
          modPath: modFile,
          modId: modInfo.id,
          targetLanguage: targetLanguage,
        });

        modTargets.push({
          type: 'mod' as const,
          id: modInfo.id,
          name: modInfo.name,
          path: modFile,
          selected: true,
          langFormat: modInfo.langFormat,
          hasExistingTranslation,
        });
      }

      // Verify results
      expect(modTargets).toHaveLength(3);
      
      const silentGear = modTargets.find(m => m.id === 'silentgear');
      expect(silentGear?.hasExistingTranslation).toBe(true);
      
      const createMod = modTargets.find(m => m.id === 'create');
      expect(createMod?.hasExistingTranslation).toBe(true);
      
      const customMod = modTargets.find(m => m.id === 'custommod');
      expect(customMod?.hasExistingTranslation).toBe(false);
    });

    it('should handle different target languages correctly', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'check_mod_translation_exists') {
          // Simulate different translation availability
          const translations: Record<string, Record<string, boolean>> = {
            'silentgear': { 'ja_jp': true, 'zh_cn': true, 'ko_kr': false, 'de_de': false },
            'create': { 'ja_jp': true, 'zh_cn': true, 'ko_kr': true, 'de_de': true },
            'custommod': { 'ja_jp': false, 'zh_cn': false, 'ko_kr': false, 'de_de': false },
          };
          
          return Promise.resolve(
            translations[args.modId]?.[args.targetLanguage] || false
          );
        }
        return Promise.resolve(null);
      });

      const testCases = [
        { modId: 'silentgear', lang: 'ko_kr', expected: false },
        { modId: 'create', lang: 'de_de', expected: true },
        { modId: 'custommod', lang: 'ja_jp', expected: false },
      ];

      for (const testCase of testCases) {
        const result = await FileService.invoke<boolean>('check_mod_translation_exists', {
          modPath: `/mods/${testCase.modId}.jar`,
          modId: testCase.modId,
          targetLanguage: testCase.lang,
        });
        
        expect(result).toBe(testCase.expected);
      }
    });

    it('should handle the skipExistingTranslations configuration', async () => {
      const config = {
        translation: {
          skipExistingTranslations: true,
        },
      };

      mockInvoke.mockImplementation((command, args) => {
        if (command === 'analyze_mod_jar') {
          return Promise.resolve({
            id: 'testmod',
            name: 'Test Mod',
            version: '1.0.0',
            jarPath: args.jarPath,
            langFiles: [{ language: 'en_us', path: 'assets/testmod/lang/en_us.json', content: {} }],
            patchouliBooks: [],
            langFormat: 'json',
          });
        }
        if (command === 'check_mod_translation_exists') {
          return Promise.resolve(true); // Translation exists
        }
        return Promise.resolve(null);
      });

      const modFile = '/mods/testmod.jar';
      const targetLanguage = 'ja_jp';

      // First, analyze the mod
      const modInfo = await FileService.invoke<any>('analyze_mod_jar', { jarPath: modFile });

      // Check if translation exists (only if skipExistingTranslations is enabled)
      let shouldTranslate = true;
      if (config.translation.skipExistingTranslations && targetLanguage) {
        const hasExistingTranslation = await FileService.invoke<boolean>('check_mod_translation_exists', {
          modPath: modFile,
          modId: modInfo.id,
          targetLanguage: targetLanguage,
        });
        
        shouldTranslate = !hasExistingTranslation;
      }

      // Verify that the mod should be skipped
      expect(shouldTranslate).toBe(false);
    });

    it('should handle errors gracefully throughout the flow', async () => {
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'analyze_mod_jar' && args.jarPath.includes('corrupt')) {
          throw new Error('Failed to analyze corrupt mod');
        }
        if (command === 'check_mod_translation_exists' && args.modId === 'errormod') {
          throw new Error('Failed to check translation');
        }
        return Promise.resolve(null);
      });

      // Test corrupt mod analysis
      await expect(
        FileService.invoke('analyze_mod_jar', { jarPath: '/mods/corrupt.jar' })
      ).rejects.toThrow('Failed to analyze corrupt mod');

      // Test translation check error
      await expect(
        FileService.invoke('check_mod_translation_exists', {
          modPath: '/mods/error.jar',
          modId: 'errormod',
          targetLanguage: 'ja_jp',
        })
      ).rejects.toThrow('Failed to check translation');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent translation checks efficiently', async () => {
      let callCount = 0;
      mockInvoke.mockImplementation((command) => {
        if (command === 'check_mod_translation_exists') {
          callCount++;
          // Simulate some processing time
          return new Promise(resolve => {
            setTimeout(() => resolve(Math.random() > 0.5), 10);
          });
        }
        return Promise.resolve(null);
      });

      const mods = Array.from({ length: 10 }, (_, i) => ({
        id: `mod${i}`,
        path: `/mods/mod${i}.jar`,
      }));

      const startTime = Date.now();
      
      // Check all mods concurrently
      const results = await Promise.all(
        mods.map(mod =>
          FileService.invoke<boolean>('check_mod_translation_exists', {
            modPath: mod.path,
            modId: mod.id,
            targetLanguage: 'ja_jp',
          })
        )
      );

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(callCount).toBe(10);
      // Should complete relatively quickly due to concurrent execution
      expect(duration).toBeLessThan(200);
    });
  });
});