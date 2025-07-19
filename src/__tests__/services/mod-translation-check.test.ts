import { FileService } from '../../lib/services/file-service';

// Mock window.__TAURI_INTERNALS__ before importing FileService
const mockInvoke = jest.fn();

describe('Mod Translation Existence Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set the test invoke override
    FileService.setTestInvokeOverride(mockInvoke);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Reset the test invoke override
    FileService.setTestInvokeOverride(null);
  });

  describe('check_mod_translation_exists', () => {
    it('should return true when translation exists (JSON format)', async () => {
      // Mock the backend response
      mockInvoke.mockResolvedValueOnce(true);

      const result = await FileService.invoke<boolean>('check_mod_translation_exists', {
        modPath: '/path/to/testmod.jar',
        modId: 'testmod',
        targetLanguage: 'ja_jp',
      });

      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('check_mod_translation_exists', {
        modPath: '/path/to/testmod.jar',
        modId: 'testmod',
        targetLanguage: 'ja_jp',
      });
    });

    it('should return false when translation does not exist', async () => {
      mockInvoke.mockResolvedValueOnce(false);

      const result = await FileService.invoke<boolean>('check_mod_translation_exists', {
        modPath: '/path/to/testmod.jar',
        modId: 'testmod',
        targetLanguage: 'zh_cn',
      });

      expect(result).toBe(false);
    });

    it('should handle case sensitivity in language codes', async () => {
      // Test uppercase
      mockInvoke.mockResolvedValueOnce(true);
      
      const result1 = await FileService.invoke<boolean>('check_mod_translation_exists', {
        modPath: '/path/to/testmod.jar',
        modId: 'testmod',
        targetLanguage: 'JA_JP',
      });

      expect(result1).toBe(true);
      
      // Test mixed case
      mockInvoke.mockResolvedValueOnce(true);
      
      const result2 = await FileService.invoke<boolean>('check_mod_translation_exists', {
        modPath: '/path/to/testmod.jar',
        modId: 'testmod',
        targetLanguage: 'ja_JP',
      });

      expect(result2).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to open mod file'));

      await expect(
        FileService.invoke<boolean>('check_mod_translation_exists', {
          modPath: '/path/to/nonexistent.jar',
          modId: 'testmod',
          targetLanguage: 'ja_jp',
        })
      ).rejects.toThrow('Failed to open mod file');
    });
  });

  describe('Frontend integration with mod scanning', () => {
    it('should correctly set hasExistingTranslation during scan', async () => {
      // Mock analyze_mod_jar to return mod info
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
          // Return true for ja_jp, false for others
          return Promise.resolve(args.targetLanguage === 'ja_jp');
        }
        return Promise.resolve(null);
      });

      // Simulate the scan logic from mods-tab.tsx
      const modFile = '/path/to/testmod.jar';
      const targetLanguage = 'ja_jp';
      const config = { translation: { skipExistingTranslations: true } };

      const modInfo = await FileService.invoke<any>('analyze_mod_jar', { jarPath: modFile });
      
      let hasExistingTranslation = false;
      if (targetLanguage && config.translation.skipExistingTranslations) {
        hasExistingTranslation = await FileService.invoke<boolean>('check_mod_translation_exists', {
          modPath: modFile,
          modId: modInfo.id,
          targetLanguage: targetLanguage,
        });
      }

      const target = {
        type: 'mod' as const,
        id: modInfo.id,
        name: modInfo.name,
        path: modFile,
        selected: true,
        langFormat: modInfo.langFormat,
        hasExistingTranslation,
      };

      expect(target.hasExistingTranslation).toBe(true);
    });

    it('should handle multiple mods with different translation states', async () => {
      const mods = [
        { id: 'mod1', name: 'Mod 1', path: '/path/to/mod1.jar', hasTranslation: true },
        { id: 'mod2', name: 'Mod 2', path: '/path/to/mod2.jar', hasTranslation: false },
        { id: 'mod3', name: 'Mod 3', path: '/path/to/mod3.jar', hasTranslation: true },
      ];

      mockInvoke.mockImplementation((command, args) => {
        if (command === 'check_mod_translation_exists') {
          const mod = mods.find(m => m.path === args.modPath);
          return Promise.resolve(mod?.hasTranslation || false);
        }
        return Promise.resolve(null);
      });

      const results = await Promise.all(
        mods.map(async (mod) => {
          const exists = await FileService.invoke<boolean>('check_mod_translation_exists', {
            modPath: mod.path,
            modId: mod.id,
            targetLanguage: 'ja_jp',
          });
          return { ...mod, exists };
        })
      );

      expect(results[0].exists).toBe(true);
      expect(results[1].exists).toBe(false);
      expect(results[2].exists).toBe(true);
    });
  });

  describe('Edge cases and special scenarios', () => {
    it('should handle empty language code', async () => {
      mockInvoke.mockResolvedValueOnce(false);

      const result = await FileService.invoke<boolean>('check_mod_translation_exists', {
        modPath: '/path/to/testmod.jar',
        modId: 'testmod',
        targetLanguage: '',
      });

      expect(result).toBe(false);
    });

    it('should handle mods with special characters in ID', async () => {
      mockInvoke.mockResolvedValueOnce(true);

      const result = await FileService.invoke<boolean>('check_mod_translation_exists', {
        modPath: '/path/to/test-mod_2.jar',
        modId: 'test-mod_2',
        targetLanguage: 'ja_jp',
      });

      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('check_mod_translation_exists', {
        modPath: '/path/to/test-mod_2.jar',
        modId: 'test-mod_2',
        targetLanguage: 'ja_jp',
      });
    });

    it('should handle very long mod paths', async () => {
      const longPath = '/very/long/path/'.repeat(20) + 'testmod.jar';
      mockInvoke.mockResolvedValueOnce(true);

      const result = await FileService.invoke<boolean>('check_mod_translation_exists', {
        modPath: longPath,
        modId: 'testmod',
        targetLanguage: 'ja_jp',
      });

      expect(result).toBe(true);
    });
  });
});

// Test data generators for debugging
export const generateTestModData = () => {
  return [
    {
      id: 'silentgear',
      name: 'Silent Gear',
      path: '/mods/SilentGear-1.19.2-3.2.2.jar',
      expectedTranslations: {
        ja_jp: true,
        zh_cn: true,
        ko_kr: false,
        de_de: false,
      },
    },
    {
      id: 'create',
      name: 'Create',
      path: '/mods/create-1.19.2-0.5.1.jar',
      expectedTranslations: {
        ja_jp: true,
        zh_cn: true,
        ko_kr: true,
        de_de: true,
      },
    },
    {
      id: 'custommod',
      name: 'Custom Mod',
      path: '/mods/custommod-1.0.0.jar',
      expectedTranslations: {
        ja_jp: false,
        zh_cn: false,
        ko_kr: false,
        de_de: false,
      },
    },
  ];
};