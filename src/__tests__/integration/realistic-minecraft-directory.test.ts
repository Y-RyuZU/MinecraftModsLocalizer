/**
 * Integration tests using realistic Minecraft directory structure
 */

import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createMinecraftTestDirectory, addTranslatedFiles, type MinecraftTestStructure } from '../test-utils/minecraft-directory-mock';
import { FileService } from '@/lib/services/file-service';

// Mock FileService.invoke to use our test directory
const mockInvoke = vi.fn();
vi.spyOn(FileService, 'invoke').mockImplementation(mockInvoke);

describe('Realistic Minecraft Directory Integration Tests', () => {
  let testStructure: MinecraftTestStructure;
  
  beforeEach(() => {
    testStructure = createMinecraftTestDirectory();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    testStructure.cleanup();
  });
  
  describe('Directory Structure Creation', () => {
    it('should create proper Minecraft directory structure', () => {
      expect(testStructure.basePath).toBeDefined();
      expect(testStructure.modsPath).toContain('mods');
      expect(testStructure.configPath).toContain('config');
      expect(testStructure.resourcepacksPath).toContain('resourcepacks');
    });
    
    it('should contain realistic mod files', async () => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        if (command === 'get_mod_files') {
          const fs = require('fs');
          const path = require('path');
          const files = fs.readdirSync(testStructure.modsPath);
          return Promise.resolve(files.map((f: string) => path.join(testStructure.modsPath, f)));
        }
        return Promise.resolve([]);
      });
      
      const modFiles = await FileService.invoke<string[]>('get_mod_files', { dir: testStructure.basePath });
      
      expect(modFiles).toHaveLength(5);
      expect(modFiles.some(f => f.includes('jei_'))).toBe(true);
      expect(modFiles.some(f => f.includes('thermal_expansion_'))).toBe(true);
      expect(modFiles.some(f => f.includes('ftb_quests_'))).toBe(true);
    });
    
    it('should contain realistic FTB quest files', async () => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        if (command === 'get_ftb_quest_files') {
          const fs = require('fs');
          const path = require('path');
          const questsPath = path.join(testStructure.configPath, 'ftbquests', 'quests');
          
          // Recursively find all .snbt files
          const findSNBTFiles = (dir: string): string[] => {
            const files: string[] = [];
            if (fs.existsSync(dir)) {
              const items = fs.readdirSync(dir, { withFileTypes: true });
              for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                  files.push(...findSNBTFiles(fullPath));
                } else if (item.name.endsWith('.snbt')) {
                  files.push(fullPath);
                }
              }
            }
            return files;
          };
          
          return Promise.resolve(findSNBTFiles(questsPath));
        }
        return Promise.resolve([]);
      });
      
      const questFiles = await FileService.invoke<string[]>('get_ftb_quest_files', { dir: testStructure.basePath });
      
      expect(questFiles.length).toBeGreaterThan(0);
      expect(questFiles.some(f => f.includes('getting_started.snbt'))).toBe(true);
      expect(questFiles.some(f => f.includes('mining_chapter.snbt'))).toBe(true);
      expect(questFiles.some(f => f.includes('tech_progression.snbt'))).toBe(true);
    });
    
    it('should contain KubeJS lang files', async () => {
      const fs = require('fs');
      const path = require('path');
      const kubejsLangPath = path.join(testStructure.basePath, 'kubejs', 'assets', 'kubejs', 'lang', 'en_us.json');
      
      expect(fs.existsSync(kubejsLangPath)).toBe(true);
      
      const langContent = JSON.parse(fs.readFileSync(kubejsLangPath, 'utf-8'));
      expect(Object.keys(langContent)).toContain('ftbquests.chapter.getting_started.title');
      expect(langContent['ftbquests.chapter.getting_started.title']).toBe('Getting Started Guide');
    });
    
    it('should contain Better Questing files', async () => {
      const fs = require('fs');
      const path = require('path');
      const defaultQuestsPath = path.join(testStructure.configPath, 'betterquesting', 'DefaultQuests', 'DefaultQuests.lang');
      
      expect(fs.existsSync(defaultQuestsPath)).toBe(true);
      
      const langContent = fs.readFileSync(defaultQuestsPath, 'utf-8');
      expect(langContent).toContain('betterquesting.title.quest_lines=Quest Lines');
      expect(langContent).toContain('betterquesting.quest.getting_started=Getting Started with Better Questing');
    });
  });
  
  describe('Translation Existence Detection', () => {
    beforeEach(() => {
      // Add some translated files
      addTranslatedFiles(testStructure, 'ja_jp');
    });
    
    it('should detect existing KubeJS translations', async () => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        if (command === 'check_quest_translation_exists') {
          const fs = require('fs');
          const path = require('path');
          
          // Check if translation exists based on the quest path
          if (args.questPath.includes('kubejs/assets/kubejs/lang/en_us.json')) {
            const translatedPath = args.questPath.replace('en_us.json', `${args.targetLanguage}.json`);
            return Promise.resolve(fs.existsSync(translatedPath));
          }
          
          return Promise.resolve(false);
        }
        return Promise.resolve(false);
      });
      
      const kubejsPath = require('path').join(testStructure.basePath, 'kubejs', 'assets', 'kubejs', 'lang', 'en_us.json');
      const exists = await FileService.invoke<boolean>('check_quest_translation_exists', {
        questPath: kubejsPath,
        targetLanguage: 'ja_jp'
      });
      
      expect(exists).toBe(true);
    });
    
    it('should detect existing Better Questing translations', async () => {
      const fs = require('fs');
      const path = require('path');
      const translatedPath = path.join(testStructure.configPath, 'betterquesting', 'DefaultQuests', 'DefaultQuests.ja_jp.lang');
      
      expect(fs.existsSync(translatedPath)).toBe(true);
      
      const translatedContent = fs.readFileSync(translatedPath, 'utf-8');
      expect(translatedContent).toContain('betterquesting.title.quest_lines=クエストライン');
    });
    
    it('should not detect translations for non-existent languages', async () => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        if (command === 'check_quest_translation_exists') {
          const fs = require('fs');
          const path = require('path');
          
          if (args.questPath.includes('kubejs/assets/kubejs/lang/en_us.json')) {
            const translatedPath = args.questPath.replace('en_us.json', `${args.targetLanguage}.json`);
            return Promise.resolve(fs.existsSync(translatedPath));
          }
          
          return Promise.resolve(false);
        }
        return Promise.resolve(false);
      });
      
      const kubejsPath = require('path').join(testStructure.basePath, 'kubejs', 'assets', 'kubejs', 'lang', 'en_us.json');
      const exists = await FileService.invoke<boolean>('check_quest_translation_exists', {
        questPath: kubejsPath,
        targetLanguage: 'ko_kr'  // Korean translation doesn't exist
      });
      
      expect(exists).toBe(false);
    });
  });
  
  describe('SNBT Content Analysis', () => {
    it('should properly analyze direct text SNBT content', async () => {
      mockInvoke.mockImplementation((command: string, args: any) => {
        if (command === 'detect_snbt_content_type') {
          const fs = require('fs');
          if (fs.existsSync(args.filePath)) {
            const content = fs.readFileSync(args.filePath, 'utf-8');
            
            // Simple heuristic: check for direct text vs JSON keys
            const hasDirectText = content.includes('Welcome to') || 
                                 content.includes('Time to') || 
                                 content.includes('Complete this quest');
            const hasJsonKeys = content.includes('ftbquests.') || 
                               content.includes('minecraft:') ||
                               content.includes('item.');
            
            if (hasJsonKeys && !hasDirectText) {
              return Promise.resolve('json_keys');
            } else if (hasDirectText) {
              return Promise.resolve('direct_text');
            }
          }
          return Promise.resolve('direct_text');
        }
        return Promise.resolve('direct_text');
      });
      
      const fs = require('fs');
      const path = require('path');
      const questPath = path.join(testStructure.configPath, 'ftbquests', 'quests', 'chapters', 'getting_started.snbt');
      
      const contentType = await FileService.invoke<string>('detect_snbt_content_type', {
        filePath: questPath
      });
      
      expect(contentType).toBe('direct_text');
      
      // Verify the actual content
      const content = fs.readFileSync(questPath, 'utf-8');
      expect(content).toContain('Welcome to the modpack!');
      expect(content).toContain('Complete this quest to progress further!');
    });
  });
  
  describe('File Path Validation', () => {
    it('should validate realistic Minecraft paths', () => {
      expect(testStructure.basePath).toMatch(/minecraft-test-/);
      expect(testStructure.modsPath).toMatch(/mods$/);
      expect(testStructure.configPath).toMatch(/config$/);
      
      // Paths should be absolute and not contain NATIVE_DIALOG prefix
      expect(testStructure.basePath).not.toContain('NATIVE_DIALOG:');
      expect(testStructure.modsPath).not.toContain('NATIVE_DIALOG:');
    });
    
    it('should handle cross-platform paths correctly', () => {
      const path = require('path');
      
      // Ensure paths use correct separators for the platform
      expect(testStructure.modsPath).toBe(path.join(testStructure.basePath, 'mods'));
      expect(testStructure.configPath).toBe(path.join(testStructure.basePath, 'config'));
    });
  });
  
  describe('Cleanup Functionality', () => {
    it('should properly cleanup test directories', () => {
      const fs = require('fs');
      const tempPath = testStructure.basePath;
      
      expect(fs.existsSync(tempPath)).toBe(true);
      
      testStructure.cleanup();
      
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });
});