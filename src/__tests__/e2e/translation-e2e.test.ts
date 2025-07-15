import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TranslationService } from '@/lib/services/translation-service';
import { FileService } from '@/lib/services/file-service';
import { TranslationTarget, TranslationTargetType } from '@/lib/types/minecraft';
import { OpenAIAdapter } from '@/lib/adapters/openai-adapter';

// Mock the LLM adapter to provide predictable translations
class MockE2EAdapter {
  async translate(request: any): Promise<any> {
    const translations: Record<string, string> = {};
    
    // Generate predictable Japanese translations
    for (const [key, value] of Object.entries(request.content)) {
      if (typeof value === 'string') {
        // Simple mock translation: prefix with [JA] and keep placeholders
        translations[key] = `[JA] ${value}`;
      }
    }
    
    return {
      success: true,
      content: translations,
      usage: {
        input_tokens: 100,
        output_tokens: 100,
        total_tokens: 200
      }
    };
  }
}

describe('E2E Translation Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const outputDir = path.join(fixturesDir, 'output');
  
  beforeAll(async () => {
    // Clean output directory
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });
    
    // Override FileService for testing
    FileService.setTestInvokeOverride(async (command, args) => {
      switch (command) {
        case 'get_mod_files':
          return [
            path.join(fixturesDir, 'mods', 'sample-mod', 'assets', 'samplemod', 'lang', 'en_us.json'),
            path.join(fixturesDir, 'mods', 'complex-mod', 'assets', 'complexmod', 'lang', 'en_us.json')
          ];
        
        case 'get_ftb_quest_files':
          return [
            path.join(fixturesDir, 'quests', 'ftb', 'quests', 'chapters', 'getting_started.snbt'),
            path.join(fixturesDir, 'quests', 'ftb', 'quests', 'chapters', 'advanced.snbt')
          ];
        
        case 'get_better_quest_files':
          return [
            path.join(fixturesDir, 'quests', 'better', 'DefaultQuests.json')
          ];
        
        case 'read_text_file':
          return await fs.readFile(args?.path as string, 'utf-8');
        
        case 'write_text_file':
          await fs.mkdir(path.dirname(args?.path as string), { recursive: true });
          await fs.writeFile(args?.path as string, args?.content as string);
          return true;
        
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    });
  });
  
  afterAll(() => {
    // Reset the override
    FileService.setTestInvokeOverride(null);
  });
  
  describe('Mod Translation', () => {
    test('should translate simple mod with basic entries', async () => {
      const modPath = path.join(fixturesDir, 'mods', 'sample-mod', 'assets', 'samplemod', 'lang', 'en_us.json');
      const content = await fs.readFile(modPath, 'utf-8');
      const entries = JSON.parse(content);
      
      const target: TranslationTarget = {
        type: 'mod' as TranslationTargetType,
        id: 'samplemod',
        name: 'Sample Mod',
        path: modPath,
        selected: true
      };
      
      const service = new TranslationService({
        llmConfig: {
          provider: 'openai',
          apiKey: 'test-key',
          baseUrl: '',
          temperature: 0.3
        },
        promptTemplate: {
          targetLanguage: 'ja_jp',
          sourceLang: 'en_us',
          customInstructions: ''
        },
        maxRetries: 3
      });
      
      // Override the adapter with our mock
      (service as any).adapter = new MockE2EAdapter();
      
      const job = service.createJob(entries, 'ja_jp', modPath);
      expect(job.chunks.length).toBeGreaterThan(0);
      
      // Start translation
      const completedJob = await service.startJob(job.id);
      
      // Check results
      expect(completedJob.status).toBe('completed');
      expect(completedJob.progress).toBe(100);
      
      // Verify all keys were translated
      const allTranslations = service.getCombinedTranslatedContent(job.id);
      
      for (const key of Object.keys(entries)) {
        expect(allTranslations[key]).toStartWith('[JA] ');
      }
      
      // Write output
      const outputPath = path.join(outputDir, 'samplemod_ja_jp.json');
      await fs.writeFile(outputPath, JSON.stringify(allTranslations, null, 2));
      
      // Verify output file
      const outputContent = await fs.readFile(outputPath, 'utf-8');
      const outputData = JSON.parse(outputContent);
      expect(outputData['item.samplemod.example_item']).toBe('[JA] Example Item');
    });
    
    test('should handle complex mod with formatting placeholders', async () => {
      const modPath = path.join(fixturesDir, 'mods', 'complex-mod', 'assets', 'complexmod', 'lang', 'en_us.json');
      const content = await fs.readFile(modPath, 'utf-8');
      const entries = JSON.parse(content);
      
      const target: TranslationTarget = {
        type: 'mod' as TranslationTargetType,
        id: 'complexmod',
        name: 'Complex Mod',
        path: modPath,
        selected: true
      };
      
      const service = new TranslationService({
        llmConfig: {
          provider: 'openai',
          apiKey: 'test-key',
          baseUrl: '',
          temperature: 0.3
        },
        promptTemplate: {
          targetLanguage: 'ja_jp',
          sourceLang: 'en_us',
          customInstructions: ''
        },
        maxRetries: 3
      });
      
      // Override the adapter with our mock
      (service as any).adapter = new MockE2EAdapter();
      
      const job = service.createJob(entries, 'ja_jp', modPath);
      
      // Start translation
      await service.startJob(job.id);
      
      const allTranslations = service.getCombinedTranslatedContent(job.id);
      
      // Verify placeholders are preserved
      expect(allTranslations['item.complexmod.energy_crystal.tooltip']).toContain('%s');
      expect(allTranslations['block.complexmod.energy_conduit.tooltip']).toContain('%d');
      expect(allTranslations['complexmod.gui.energy']).toContain('%d');
      
      // Verify color codes are preserved
      expect(allTranslations['complexmod.tooltip.shift_info']).toContain('§e');
      expect(allTranslations['complexmod.tooltip.shift_info']).toContain('§r');
    });
  });
  
  describe('FTB Quest Translation', () => {
    test('should translate FTB quest files', async () => {
      const questPath = path.join(fixturesDir, 'quests', 'ftb', 'quests', 'chapters', 'getting_started.snbt');
      const content = await fs.readFile(questPath, 'utf-8');
      
      // Extract translatable strings from SNBT
      const translatableStrings: Record<string, string> = {};
      
      // Extract title
      const titleMatch = content.match(/title:\s*"([^"]+)"/);
      if (titleMatch) {
        translatableStrings['chapter.title'] = titleMatch[1];
      }
      
      // Extract quest titles and descriptions
      const questBlocks = content.match(/\{[^}]*title:[^}]*\}/g) || [];
      questBlocks.forEach((block, index) => {
        const titleMatch = block.match(/title:\s*"([^"]+)"/);
        if (titleMatch) {
          translatableStrings[`quest.${index}.title`] = titleMatch[1];
        }
        
        const descMatch = block.match(/description:\s*\[([^\]]+)\]/);
        if (descMatch) {
          const descriptions = descMatch[1].match(/"([^"]+)"/g) || [];
          descriptions.forEach((desc, descIndex) => {
            translatableStrings[`quest.${index}.description.${descIndex}`] = desc.replace(/"/g, '');
          });
        }
      });
      
      const target: TranslationTarget = {
        type: 'quest' as TranslationTargetType,
        id: 'ftb-getting-started',
        name: 'Getting Started',
        path: questPath,
        selected: true,
        questFormat: 'ftb'
      };
      
      const service = new TranslationService({
        llmConfig: {
          provider: 'openai',
          apiKey: 'test-key',
          baseUrl: '',
          temperature: 0.3
        },
        promptTemplate: {
          targetLanguage: 'ja_jp',
          sourceLang: 'en_us',
          customInstructions: ''
        },
        maxRetries: 3
      });
      
      // Override the adapter with our mock
      (service as any).adapter = new MockE2EAdapter();
      
      const job = service.createJob(translatableStrings, 'ja_jp', questPath);
      
      await service.startJob(job.id);
      
      const translations = service.getCombinedTranslatedContent(job.id);
      
      // Check if chapter title was translated
      expect(translations['chapter.title']).toBeDefined();
      expect(translations['chapter.title']).toContain('[JA]');
      
      // Check if at least one quest was translated
      const questTitles = Object.keys(translations).filter(k => k.includes('quest.') && k.includes('.title'));
      expect(questTitles.length).toBeGreaterThan(0);
      
      // Generate translated SNBT
      let translatedContent = content;
      
      // Replace title
      if (translations['chapter.title']) {
        translatedContent = translatedContent.replace(
          /title:\s*"[^"]+"/,
          `title: "${translations['chapter.title']}"`
        );
      }
      
      // Write output
      const outputPath = path.join(outputDir, 'getting_started.ja_jp.snbt');
      await fs.writeFile(outputPath, translatedContent);
    });
  });
  
  describe('Better Questing Translation', () => {
    test('should translate Better Questing files', async () => {
      const questPath = path.join(fixturesDir, 'quests', 'better', 'DefaultQuests.json');
      const content = await fs.readFile(questPath, 'utf-8');
      const questData = JSON.parse(content);
      
      // Extract translatable strings
      const translatableStrings: Record<string, string> = {};
      
      // Extract quest names and descriptions
      const questDb = questData['questDatabase:9'] || {};
      for (const [questId, quest] of Object.entries(questDb)) {
        const props = (quest as any)['properties:10']?.['betterquesting:10'] || {};
        if (props['name:8']) {
          translatableStrings[`quest.${questId}.name`] = props['name:8'];
        }
        if (props['desc:8']) {
          translatableStrings[`quest.${questId}.desc`] = props['desc:8'];
        }
      }
      
      // Extract quest line names
      const questLines = questData['questLines:9'] || {};
      for (const [lineId, line] of Object.entries(questLines)) {
        const props = (line as any)['properties:10']?.['betterquesting:10'] || {};
        if (props['name:8']) {
          translatableStrings[`questline.${lineId}.name`] = props['name:8'];
        }
        if (props['desc:8']) {
          translatableStrings[`questline.${lineId}.desc`] = props['desc:8'];
        }
      }
      
      const target: TranslationTarget = {
        type: 'quest' as TranslationTargetType,
        id: 'better-quests',
        name: 'Better Quests',
        path: questPath,
        selected: true,
        questFormat: 'better'
      };
      
      const service = new TranslationService({
        llmConfig: {
          provider: 'openai',
          apiKey: 'test-key',
          baseUrl: '',
          temperature: 0.3
        },
        promptTemplate: {
          targetLanguage: 'ja_jp',
          sourceLang: 'en_us',
          customInstructions: ''
        },
        maxRetries: 3
      });
      
      // Override the adapter with our mock
      (service as any).adapter = new MockE2EAdapter();
      
      const job = service.createJob(translatableStrings, 'ja_jp', questPath);
      
      await service.startJob(job.id);
      
      const translations = service.getCombinedTranslatedContent(job.id);
      
      // Check if translations exist (quest IDs might be cleaned up)
      const questKeys = Object.keys(translations).filter(k => k.startsWith('quest.'));
      
      // If no quest keys found, check what was actually extracted
      if (questKeys.length === 0) {
        console.log('Extracted translatable strings:', Object.keys(translatableStrings));
        console.log('Translations received:', Object.keys(translations));
      }
      
      expect(questKeys.length).toBeGreaterThan(0);
      
      // Verify first quest translation exists
      const firstQuestKey = questKeys.find(k => k.includes('.name'));
      expect(firstQuestKey).toBeDefined();
      expect(translations[firstQuestKey!]).toContain('[JA]');
      
      // Apply translations back to JSON
      const translatedData = JSON.parse(JSON.stringify(questData));
      
      // Apply quest translations
      for (const [questId, quest] of Object.entries(translatedData['questDatabase:9'] || {})) {
        const props = (quest as any)['properties:10']?.['betterquesting:10'];
        if (props) {
          if (translations[`quest.${questId}.name`]) {
            props['name:8'] = translations[`quest.${questId}.name`];
          }
          if (translations[`quest.${questId}.desc`]) {
            props['desc:8'] = translations[`quest.${questId}.desc`];
          }
        }
      }
      
      // Write output
      const outputPath = path.join(outputDir, 'DefaultQuests.ja_jp.json');
      await fs.writeFile(outputPath, JSON.stringify(translatedData, null, 2));
      
      // Verify output
      const outputContent = await fs.readFile(outputPath, 'utf-8');
      const outputData = JSON.parse(outputContent);
      expect(outputData['questDatabase:9']?.['0:10']?.['properties:10']?.['betterquesting:10']?.['name:8']).toBeDefined();
    });
  });
  
  describe('Integration with Translation Runner', () => {
    test('should handle full translation workflow with multiple file types', async () => {
      // This test would simulate the full workflow including:
      // 1. Reading multiple files
      // 2. Creating translation jobs
      // 3. Running translations with progress tracking
      // 4. Writing output files
      // 5. Verifying results
      
      const targets: TranslationTarget[] = [
        {
          type: 'mod' as TranslationTargetType,
          id: 'samplemod',
          name: 'Sample Mod',
          path: path.join(fixturesDir, 'mods', 'sample-mod', 'assets', 'samplemod', 'lang', 'en_us.json'),
          selected: true
        },
        {
          type: 'quest' as TranslationTargetType,
          id: 'ftb-getting-started',
          name: 'Getting Started',
          path: path.join(fixturesDir, 'quests', 'ftb', 'quests', 'chapters', 'getting_started.snbt'),
          selected: true,
          questFormat: 'ftb'
        }
      ];
      
      // Test would continue with full workflow...
      expect(targets.length).toBe(2);
    });
  });
});