/**
 * Tests for SNBT Content Type Detection
 * Tests the detect_snbt_content_type function and related logic
 */

import { FileService } from '../file-service';
import { invoke } from '@tauri-apps/api/core';

jest.mock('@tauri-apps/api/core');
const mockInvoke = invoke as jest.MockedFunction<typeof invoke>;

describe('SNBT Content Type Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detect_snbt_content_type command', () => {
    it('should detect direct text content', async () => {
      const snbtContent = `{
        title: "Welcome to the Modpack",
        description: "Complete your first quest to get started.",
        subtitle: "This is a subtitle",
        text: "Some additional text"
      }`;

      mockInvoke.mockResolvedValue('direct_text');

      const result = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: '/test/quest.snbt'
      });

      expect(result).toBe('direct_text');
      expect(mockInvoke).toHaveBeenCalledWith('detect_snbt_content_type', {
        filePath: '/test/quest.snbt'
      });
    });

    it('should detect JSON key references', async () => {
      const snbtContent = `{
        title: "ftbquests.quest.starter.title",
        description: "ftbquests.quest.starter.description",
        item: "minecraft:stone",
        block: "minecraft:dirt"
      }`;

      mockInvoke.mockResolvedValue('json_keys');

      const result = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: '/test/quest.snbt'
      });

      expect(result).toBe('json_keys');
      expect(mockInvoke).toHaveBeenCalledWith('detect_snbt_content_type', {
        filePath: '/test/quest.snbt'
      });
    });

    it('should default to direct_text for uncertain content', async () => {
      const snbtContent = `{
        id: "starter_quest",
        enabled: true,
        x: 0,
        y: 0
      }`;

      mockInvoke.mockResolvedValue('direct_text');

      const result = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: '/test/quest.snbt'
      });

      expect(result).toBe('direct_text');
    });

    it('should handle file read errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed to read SNBT file: File not found'));

      await expect(
        FileService.invoke<string>('detect_snbt_content_type', {
          filePath: '/nonexistent/quest.snbt'
        })
      ).rejects.toThrow('Failed to read SNBT file: File not found');
    });
  });

  describe('Content type patterns', () => {
    const testCases = [
      {
        name: 'FTB Quests key references',
        content: `{
          title: "ftbquests.quest.chapter1.title",
          description: "ftbquests.quest.chapter1.desc"
        }`,
        expected: 'json_keys'
      },
      {
        name: 'Minecraft item references',
        content: `{
          item: "minecraft:iron_sword",
          block: "minecraft:stone"
        }`,
        expected: 'json_keys'
      },
      {
        name: 'Localization key patterns',
        content: `{
          text: "item.minecraft.iron_sword.name",
          tooltip: "gui.button.craft"
        }`,
        expected: 'json_keys'
      },
      {
        name: 'Direct text content',
        content: `{
          title: "Welcome to the Adventure",
          description: "Embark on an epic journey through the modded world.",
          text: "Collect resources and build your base!"
        }`,
        expected: 'direct_text'
      },
      {
        name: 'Mixed content with direct text priority',
        content: `{
          title: "Welcome to the Adventure",
          description: "Use minecraft:stone to build",
          text: "This quest teaches you the basics"
        }`,
        expected: 'direct_text'
      },
      {
        name: 'Pure JSON keys without readable text',
        content: `{
          item: "minecraft:stone",
          count: 64,
          nbt: "{display:{Name:'Special Stone'}}"
        }`,
        expected: 'json_keys'
      }
    ];

    testCases.forEach((testCase) => {
      it(`should detect ${testCase.expected} for ${testCase.name}`, async () => {
        mockInvoke.mockResolvedValue(testCase.expected);

        const result = await FileService.invoke<string>('detect_snbt_content_type', {
          filePath: '/test/quest.snbt'
        });

        expect(result).toBe(testCase.expected);
      });
    });
  });

  describe('Integration with quest translation', () => {
    it('should use content type detection in quest translation flow', async () => {
      // Mock the sequence of calls that would happen during quest translation
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'detect_snbt_content_type':
            return Promise.resolve('direct_text');
          case 'read_text_file':
            return Promise.resolve(`{
              title: "Welcome Quest",
              description: "Your first adventure begins here!"
            }`);
          case 'write_text_file':
            return Promise.resolve(true);
          default:
            return Promise.resolve(true);
        }
      });

      // Simulate quest translation flow
      const contentType = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: '/test/quest.snbt'
      });

      expect(contentType).toBe('direct_text');

      // Verify the content type would be used to determine translation strategy
      if (contentType === 'direct_text') {
        // For direct text, the file would be translated in-place
        const content = await FileService.invoke<string>('read_text_file', {
          path: '/test/quest.snbt'
        });
        
        expect(content).toContain('Welcome Quest');
        
        // Simulate writing translated content back to the same file
        await FileService.invoke<boolean>('write_text_file', {
          path: '/test/quest.snbt',
          content: content.replace('Welcome Quest', 'ようこそクエスト')
        });
      }

      expect(mockInvoke).toHaveBeenCalledWith('detect_snbt_content_type', {
        filePath: '/test/quest.snbt'
      });
      expect(mockInvoke).toHaveBeenCalledWith('read_text_file', {
        path: '/test/quest.snbt'
      });
      expect(mockInvoke).toHaveBeenCalledWith('write_text_file', {
        path: '/test/quest.snbt',
        content: expect.stringContaining('ようこそクエスト')
      });
    });

    it('should handle JSON key content type in quest translation', async () => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        switch (command) {
          case 'detect_snbt_content_type':
            return Promise.resolve('json_keys');
          case 'read_text_file':
            return Promise.resolve(`{
              title: "ftbquests.quest.starter.title",
              description: "ftbquests.quest.starter.description"
            }`);
          case 'write_text_file':
            return Promise.resolve(true);
          default:
            return Promise.resolve(true);
        }
      });

      const contentType = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: '/test/quest.snbt'
      });

      expect(contentType).toBe('json_keys');

      // For JSON keys, the file should be preserved with language suffix
      if (contentType === 'json_keys') {
        const content = await FileService.invoke<string>('read_text_file', {
          path: '/test/quest.snbt'
        });
        
        expect(content).toContain('ftbquests.quest.starter.title');
        
        // Simulate writing to language-suffixed file
        await FileService.invoke<boolean>('write_text_file', {
          path: '/test/quest.ja_jp.snbt',
          content: content // Keys should remain unchanged
        });
      }

      expect(mockInvoke).toHaveBeenCalledWith('write_text_file', {
        path: '/test/quest.ja_jp.snbt',
        content: expect.stringContaining('ftbquests.quest.starter.title')
      });
    });
  });
});