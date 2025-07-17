import { FileService } from '../file-service';

describe('FileService - FTB Quest File Discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up the test invoke override for FileService
    FileService.setTestInvokeOverride((command: string, args: any) => {
      if (command === 'get_ftb_quest_files') {
        const dir = args?.dir || '';
        return Promise.resolve([
          `${dir}/ftb/quests/chapter1.snbt`,
          `${dir}/ftb/quests/chapter2.snbt`,
          `${dir}/ftb/quests/chapter3.snbt`,
        ]);
      }
      if (command === 'get_better_quest_files') {
        return Promise.resolve([
          `${args?.dir}/betterquests/DefaultQuests.json`,
          `${args?.dir}/betterquests/QuestLines.json`,
        ]);
      }
      if (command === 'get_files_with_extension') {
        if (args?.extension === '.json') {
          return Promise.resolve([
            `${args?.dir}/example1.json`,
            `${args?.dir}/example2.json`,
            `${args?.dir}/subfolder/example3.json`,
          ]);
        } else if (args?.extension === '.snbt') {
          return Promise.resolve([
            `${args?.dir}/example1.snbt`,
            `${args?.dir}/example2.snbt`,
          ]);
        }
      }
      if (command === 'read_text_file') {
        return Promise.resolve(`Mock content for ${args?.path}`);
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    // Reset the test invoke override
    FileService.setTestInvokeOverride(null);
  });

  describe('get_ftb_quest_files functionality', () => {
    it('should return SNBT files using built-in mock', async () => {
      // Use the FileService method
      const result = await FileService.getFTBQuestFiles('/test/modpack');
      
      // The built-in mock returns SNBT files with the pattern: dir/ftb/quests/chapterX.snbt
      expect(result).toEqual([
        '/test/modpack/ftb/quests/chapter1.snbt',
        '/test/modpack/ftb/quests/chapter2.snbt',
        '/test/modpack/ftb/quests/chapter3.snbt',
      ]);
      
      // Verify SNBT files are returned
      result.forEach(file => {
        expect(file).toMatch(/\.snbt$/);
        expect(file).toMatch(/ftb\/quests/);
      });
    });

    it('should handle different directory paths correctly', async () => {
      // Test with different directory path
      const result = await FileService.getFTBQuestFiles('/different/path');
      
      // The built-in mock adapts to the directory provided
      expect(result).toEqual([
        '/different/path/ftb/quests/chapter1.snbt',
        '/different/path/ftb/quests/chapter2.snbt',
        '/different/path/ftb/quests/chapter3.snbt',
      ]);
      
      // Verify SNBT files are returned
      result.forEach(file => {
        expect(file).toMatch(/\.snbt$/);
        expect(file).toMatch(/\/different\/path\/ftb\/quests/);
      });
    });

    it('should work with empty directory path', async () => {
      const result = await FileService.getFTBQuestFiles('');
      
      expect(result).toEqual([
        '/ftb/quests/chapter1.snbt',
        '/ftb/quests/chapter2.snbt',
        '/ftb/quests/chapter3.snbt',
      ]);
    });
  });

  describe('getFTBQuestFiles wrapper function', () => {
    it('should call the correct Tauri command', async () => {
      const result = await FileService.getFTBQuestFiles('/test/directory');
      
      // Should return the mock data from the FileService
      expect(result).toEqual([
        '/test/directory/ftb/quests/chapter1.snbt',
        '/test/directory/ftb/quests/chapter2.snbt',
        '/test/directory/ftb/quests/chapter3.snbt',
      ]);
    });

    it('should handle directory paths correctly in wrapper', async () => {
      const result = await FileService.getFTBQuestFiles('/custom/modpack/path');
      
      expect(result).toEqual([
        '/custom/modpack/path/ftb/quests/chapter1.snbt',
        '/custom/modpack/path/ftb/quests/chapter2.snbt',
        '/custom/modpack/path/ftb/quests/chapter3.snbt',
      ]);
    });
  });

  describe('other file operations', () => {
    it('should handle get_better_quest_files', async () => {
      const result = await FileService.getBetterQuestFiles('/test/modpack');
      
      expect(result).toEqual([
        '/test/modpack/betterquests/DefaultQuests.json',
        '/test/modpack/betterquests/QuestLines.json',
      ]);
    });

    it('should handle get_files_with_extension for JSON', async () => {
      const result = await FileService.getFilesWithExtension('/test/modpack', '.json');
      
      expect(result).toEqual([
        '/test/modpack/example1.json',
        '/test/modpack/example2.json',
        '/test/modpack/subfolder/example3.json',
      ]);
    });

    it('should handle get_files_with_extension for SNBT', async () => {
      const result = await FileService.getFilesWithExtension('/test/modpack', '.snbt');
      
      expect(result).toEqual([
        '/test/modpack/example1.snbt',
        '/test/modpack/example2.snbt',
      ]);
    });

    it('should handle read_text_file', async () => {
      const result = await FileService.readTextFile('/test/file.txt');
      
      expect(result).toBe('Mock content for /test/file.txt');
    });
  });
});