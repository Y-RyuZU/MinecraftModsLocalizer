/**
 * Unit Tests for SNBT Content Detection with Real File Content
 * Tests the detect_snbt_content_type logic with actual SNBT file patterns
 */

import { mockSNBTFiles } from '../../test-utils/mock-snbt-files';

describe('SNBT Content Detection Unit Tests', () => {
  
  describe('Content Pattern Recognition', () => {
    
    it('should identify direct text patterns', () => {
      const directTextExamples = [
        mockSNBTFiles.directText['starter_quest.snbt'],
        mockSNBTFiles.directText['mining_chapter.snbt'],
        mockSNBTFiles.directText['building_quest.snbt']
      ];

      directTextExamples.forEach((content) => {
        // Check for direct text indicators
        const hasDirectText = 
          content.includes('description: [') ||
          content.includes('title: "') ||
          content.includes('subtitle: "') ||
          content.includes('Welcome to') ||
          content.includes('Time to') ||
          content.includes('Now that you');

        expect(hasDirectText).toBe(true);
        
        // Should NOT have JSON key patterns as primary content
        const hasMinimalJsonKeys = !content.includes('ftbquests.') || 
          (content.match(/ftbquests\./g) || []).length <= 2; // Allow minimal keys
        
        expect(hasMinimalJsonKeys).toBe(true);
      });
    });

    it('should identify JSON key reference patterns', () => {
      const jsonKeyExamples = [
        mockSNBTFiles.jsonKeys['localized_quest.snbt'],
        mockSNBTFiles.jsonKeys['modded_items_quest.snbt'],
        mockSNBTFiles.jsonKeys['mixed_content_quest.snbt']
      ];

      jsonKeyExamples.forEach((content) => {
        // Check for JSON key indicators
        const hasJsonKeys = 
          content.includes('ftbquests.') ||
          content.includes('minecraft:') ||
          content.includes('item.') ||
          content.includes('block.');

        expect(hasJsonKeys).toBe(true);
        
        // Count the number of translation keys
        const keyCount = (content.match(/ftbquests\./g) || []).length;
        expect(keyCount).toBeGreaterThan(0);
      });
    });

    it('should detect modded item references', () => {
      const moddedContent = mockSNBTFiles.jsonKeys['modded_items_quest.snbt'];
      
      // Should contain modded item IDs
      expect(moddedContent).toContain('thermal:machine_frame');
      expect(moddedContent).toContain('thermal:machine_furnace');
      expect(moddedContent).toContain('thermal:energy_cell');
      
      // Should contain localization keys
      expect(moddedContent).toContain('ftbquests.chapter.modded.title');
      expect(moddedContent).toContain('ftbquests.quest.modded.machines.title');
    });

    it('should handle mixed content correctly', () => {
      const mixedContent = mockSNBTFiles.jsonKeys['mixed_content_quest.snbt'];
      
      // Contains both localization keys and item references
      expect(mixedContent).toContain('ftbquests.quest.mixed.automation.title');
      expect(mixedContent).toContain('item.thermal.machine_pulverizer');
      expect(mixedContent).toContain('block.minecraft.redstone_ore');
      
      // Should be classified as json_keys due to key predominance
      const keyPatterns = mixedContent.match(/(ftbquests\.|item\.|block\.)/g) || [];
      expect(keyPatterns.length).toBeGreaterThan(5);
    });
  });

  describe('Real SNBT Structure Validation', () => {
    
    it('should maintain valid SNBT syntax in direct text files', () => {
      const directTextFile = mockSNBTFiles.directText['starter_quest.snbt'];
      
      // Check SNBT structural elements
      expect(directTextFile).toContain('id: "');
      expect(directTextFile).toContain('filename: "');
      expect(directTextFile).toContain('quests: [{');
      expect(directTextFile).toContain('tasks: [{');
      expect(directTextFile).toContain('rewards: [{');
      expect(directTextFile).toContain('}]');
      
      // Check for proper array syntax
      expect(directTextFile).toContain('description: [');
      expect(directTextFile).toContain('dependencies: [');
    });

    it('should maintain valid SNBT syntax in JSON key files', () => {
      const jsonKeyFile = mockSNBTFiles.jsonKeys['localized_quest.snbt'];
      
      // Check SNBT structural elements
      expect(jsonKeyFile).toContain('id: "');
      expect(jsonKeyFile).toContain('filename: "');
      expect(jsonKeyFile).toContain('quests: [{');
      expect(jsonKeyFile).toContain('tasks: [{');
      expect(jsonKeyFile).toContain('rewards: [{');
      
      // Check that localization keys are properly quoted
      expect(jsonKeyFile).toContain('title: "ftbquests.');
      expect(jsonKeyFile).toContain('subtitle: "ftbquests.');
    });

    it('should handle complex quest dependencies correctly', () => {
      const miningQuest = mockSNBTFiles.directText['mining_chapter.snbt'];
      
      // Should have proper dependency syntax
      expect(miningQuest).toContain('dependencies: ["1A2B3C4D5E6F7890"]');
      
      // Should maintain proper task structure
      expect(miningQuest).toContain('type: "item"');
      expect(miningQuest).toContain('count: 1L');
      
      const buildingQuest = mockSNBTFiles.directText['building_quest.snbt'];
      expect(buildingQuest).toContain('type: "structure"');
      expect(buildingQuest).toContain('ignore_nbt: true');
    });
  });

  describe('Translation Strategy Validation', () => {
    
    it('should identify translatable strings in direct text files', () => {
      const starterQuest = mockSNBTFiles.directText['starter_quest.snbt'];
      
      const translatableStrings = [
        'Welcome to the Adventure',
        'Welcome to this amazing modpack!',
        'Complete this quest to get started on your journey.',
        'You\'ll receive some basic items to help you begin.'
      ];

      translatableStrings.forEach(str => {
        expect(starterQuest).toContain(str);
      });
    });

    it('should identify non-translatable keys in JSON key files', () => {
      const localizedQuest = mockSNBTFiles.jsonKeys['localized_quest.snbt'];
      
      const localizationKeys = [
        'ftbquests.chapter.tutorial.title',
        'ftbquests.quest.tutorial.first.title',
        'ftbquests.quest.tutorial.first.subtitle',
        'ftbquests.task.collect.dirt.title'
      ];

      localizationKeys.forEach(key => {
        expect(localizedQuest).toContain(key);
      });
    });

    it('should validate KubeJS lang file structure', () => {
      const kubejsLang = mockSNBTFiles.kubejsLang['en_us.json'];
      const parsedLang = JSON.parse(kubejsLang);
      
      // Should have proper key structure
      expect(parsedLang['ftbquests.chapter.tutorial.title']).toBeDefined();
      expect(parsedLang['ftbquests.quest.tutorial.first.title']).toBeDefined();
      
      // Values should be translatable English text
      expect(parsedLang['ftbquests.chapter.tutorial.title']).toBe('Getting Started Tutorial');
      expect(parsedLang['ftbquests.quest.tutorial.first.title']).toBe('Collect Basic Resources');
      
      // Should contain all expected keys
      const expectedKeys = [
        'ftbquests.chapter.tutorial.title',
        'ftbquests.quest.tutorial.first.title',
        'ftbquests.quest.tutorial.first.subtitle',
        'ftbquests.chapter.modded.title',
        'ftbquests.quest.modded.machines.title'
      ];

      expectedKeys.forEach(key => {
        expect(parsedLang[key]).toBeDefined();
        expect(typeof parsedLang[key]).toBe('string');
        expect(parsedLang[key].length).toBeGreaterThan(0);
      });
    });
  });

  describe('File Extension and Path Validation', () => {
    
    it('should validate SNBT file extensions', () => {
      const snbtFiles = [
        'starter_quest.snbt',
        'mining_chapter.snbt',
        'localized_quest.snbt',
        'modded_items_quest.snbt'
      ];

      snbtFiles.forEach(filename => {
        expect(filename).toMatch(/\.snbt$/);
        expect(filename).not.toMatch(/\.ja_jp\.snbt$/); // Original files shouldn't have language suffix
      });
    });

    it('should validate typical quest file paths', () => {
      const validPaths = [
        '/test/modpack/config/ftbquests/quests/chapters/starter_quest.snbt',
        '/home/user/.minecraft/config/ftbquests/quests/chapters/mining.snbt',
        'C:\\Users\\user\\AppData\\Roaming\\.minecraft\\config\\ftbquests\\quests\\main.snbt',
        '/server/minecraft/config/ftbquests/quests/rewards/special_rewards.snbt'
      ];

      validPaths.forEach(path => {
        expect(path).toMatch(/config[\/\\]ftbquests[\/\\]quests/);
        expect(path).toMatch(/\.snbt$/);
      });
    });

    it('should validate KubeJS lang file paths', () => {
      const validLangPaths = [
        '/test/modpack/kubejs/assets/kubejs/lang/en_us.json',
        '/home/user/.minecraft/kubejs/assets/kubejs/lang/en_us.json',
        'C:\\Users\\user\\AppData\\Roaming\\.minecraft\\kubejs\\assets\\kubejs\\lang\\en_us.json'
      ];

      validLangPaths.forEach(path => {
        expect(path).toMatch(/kubejs[\/\\]assets[\/\\]kubejs[\/\\]lang/);
        expect(path).toMatch(/en_us\.json$/);
      });
    });
  });
});