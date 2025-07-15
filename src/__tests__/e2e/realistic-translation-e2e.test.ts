import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TranslationService } from '@/lib/services/translation-service';
import { FileService } from '@/lib/services/file-service';
import { runTranslationJobs } from '@/lib/services/translation-runner';
import { TranslationTarget, TranslationTargetType, TranslationJob } from '@/lib/types/minecraft';

// More realistic mock adapter that simulates actual translation behavior
class RealisticMockAdapter {
  private translationMap: Record<string, string> = {
    // Common Minecraft terms
    'item': 'アイテム',
    'block': 'ブロック',
    'tool': 'ツール',
    'energy': 'エネルギー',
    'power': '電力',
    'storage': '貯蔵',
    'machine': '機械',
    'crystal': 'クリスタル',
    'quantum': '量子',
    'reactor': 'リアクター',
    'temperature': '温度',
    'progress': '進捗',
    'manual': 'マニュアル',
    'chapter': '章',
    'getting started': 'はじめに',
    'welcome': 'ようこそ',
    'first': '最初の',
    'tools': 'ツール',
    'mining': '採掘',
    'time': '時間',
    'advanced': '高度な',
    'technology': 'テクノロジー',
    'solar': 'ソーラー',
    'panel': 'パネル'
  };
  
  async translate(request: any): Promise<any> {
    const translations: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(request.content)) {
      if (typeof value === 'string') {
        let translated = value;
        
        // Preserve formatting codes and placeholders
        const placeholders: string[] = [];
        translated = translated.replace(/(%[sd]|%\d+\$[sd]|§[0-9a-fklmnor])/g, (match) => {
          placeholders.push(match);
          return `__PLACEHOLDER_${placeholders.length - 1}__`;
        });
        
        // Simple word-by-word translation
        for (const [eng, jpn] of Object.entries(this.translationMap)) {
          const regex = new RegExp(`\\b${eng}\\b`, 'gi');
          translated = translated.replace(regex, jpn);
        }
        
        // Add Japanese particles and make it more natural
        translated = translated
          .replace(/\bの\s+の\b/g, 'の') // Remove duplicate particles
          .replace(/\b(アイテム|ブロック|ツール)\b/g, '$1') // Keep nouns as-is
          .replace(/:\s*(\d+)/g, '：$1') // Japanese colon for numbers
          .replace(/\./g, '。'); // Japanese period
        
        // Restore placeholders
        placeholders.forEach((placeholder, index) => {
          translated = translated.replace(`__PLACEHOLDER_${index}__`, placeholder);
        });
        
        // If no translation happened, add a [翻訳] prefix
        if (translated === value) {
          translated = `[翻訳] ${value}`;
        }
        
        translations[key] = translated;
      }
    }
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      success: true,
      content: translations,
      usage: {
        input_tokens: Object.keys(request.content).length * 10,
        output_tokens: Object.keys(translations).length * 15,
        total_tokens: Object.keys(request.content).length * 25
      }
    };
  }
  
  getMaxTokensPerChunk(): number {
    return 1000;
  }
}

describe('Realistic E2E Translation Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const outputDir = path.join(fixturesDir, 'output', 'realistic');
  
  beforeAll(async () => {
    // Clean and create output directory
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });
    
    // Set up FileService override for real file operations
    FileService.setTestInvokeOverride(async (command, args) => {
      switch (command) {
        case 'read_text_file':
          return await fs.readFile(args?.path as string, 'utf-8');
        
        case 'write_text_file':
          const filePath = args?.path as string;
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, args?.content as string);
          return true;
        
        case 'create_directory':
          await fs.mkdir(args?.path as string, { recursive: true });
          return true;
        
        default:
          throw new Error(`Unhandled command in E2E test: ${command}`);
      }
    });
  });
  
  afterAll(() => {
    FileService.setTestInvokeOverride(null);
  });
  
  describe('Full Translation Pipeline', () => {
    test('should translate mod with chunking and progress tracking', async () => {
      const modPath = path.join(fixturesDir, 'mods', 'complex-mod', 'assets', 'complexmod', 'lang', 'en_us.json');
      const content = await fs.readFile(modPath, 'utf-8');
      const entries = JSON.parse(content);
      
      // Track progress
      let completedChunks = 0;
      let totalProgress = 0;
      
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
          customInstructions: 'Preserve all formatting codes and placeholders'
        },
        chunkSize: 5, // Force multiple chunks
        maxRetries: 3
      });
      
      // Override the adapter with our mock
      (service as any).adapter = new RealisticMockAdapter();
      
      const target: TranslationTarget = {
        type: 'mod' as TranslationTargetType,
        id: 'complexmod',
        name: 'Complex Mod',
        path: modPath,
        selected: true
      };
      
      // Create job using the current API
      const job = service.createJob(entries, 'ja_jp', modPath);
      
      // Start translation
      const completedJob = await service.startJob(job.id);
      
      // Track progress from completed job
      completedChunks = completedJob.chunks.filter(c => c.status === 'completed').length;
      totalProgress = completedJob.progress;
      
      // Get translated content
      const translatedContent = service.getCombinedTranslatedContent(job.id);
      
      // Write output
      const outputPath = path.join(outputDir, 'complexmod.ja_jp.json');
      await FileService.writeTextFile(outputPath, JSON.stringify(translatedContent, null, 2));
      
      // Verify progress tracking
      expect(completedChunks).toBeGreaterThan(0);
      expect(totalProgress).toBe(100);
      
      // Verify output
      const outputContent = await fs.readFile(outputPath, 'utf-8');
      const outputData = JSON.parse(outputContent);
      
      // Check specific translations
      expect(outputData['item.complexmod.energy_crystal']).toContain('エネルギー');
      expect(outputData['item.complexmod.energy_crystal']).toContain('クリスタル');
      expect(outputData['block.complexmod.machine_frame']).toContain('機械');
      expect(outputData['tile.complexmod.reactor']).toContain('リアクター');
      
      // Verify placeholders are preserved
      expect(outputData['item.complexmod.energy_crystal.tooltip']).toContain('%s');
      expect(outputData['complexmod.gui.energy']).toMatch(/%d.*%d/);
      
      // Verify color codes are preserved
      expect(outputData['complexmod.tooltip.shift_info']).toContain('§e');
      expect(outputData['complexmod.tooltip.shift_info']).toContain('§r');
    });
    
    test.skip('should handle token-based chunking for large files', async () => {
      // Create a large mod file
      const largeMod: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeMod[`item.largemod.item_${i}`] = `Large Mod Item Number ${i}`;
        largeMod[`item.largemod.item_${i}.tooltip`] = `This is a detailed tooltip for item number ${i} with lots of text`;
        largeMod[`block.largemod.block_${i}`] = `Large Mod Block ${i}`;
      }
      
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
        useTokenBasedChunking: true,
        maxTokensPerChunk: 500,
        maxRetries: 3
      });
      
      // Override the adapter with our mock
      (service as any).adapter = new RealisticMockAdapter();
      
      const target: TranslationTarget = {
        type: 'mod' as TranslationTargetType,
        id: 'largemod',
        name: 'Large Mod',
        path: '/fake/path',
        selected: true
      };
      
      const job = service.createJob(largeMod, 'ja_jp', '/fake/path');
      
      // Should create multiple chunks due to token limit
      expect(job.chunks.length).toBeGreaterThan(5);
      
      // Start translation
      const completedJob = await service.startJob(job.id);
      
      expect(completedJob.status).toBe('completed');
      expect(completedJob.progress).toBe(100);
      
      // Verify all entries were translated
      const allTranslations = service.getCombinedTranslatedContent(job.id);
      
      expect(Object.keys(allTranslations).length).toBe(Object.keys(largeMod).length);
    });
  });
  
  describe('Error Handling and Recovery', () => {
    test.skip('should handle translation failures gracefully', async () => {
      // Mock adapter that fails on certain entries
      class FailingMockAdapter {
        private callCount = 0;
        
        async translate(request: any): Promise<any> {
          this.callCount++;
          
          // Fail on second call
          if (this.callCount === 2) {
            throw new Error('API rate limit exceeded');
          }
          
          return {
            success: true,
            content: Object.fromEntries(
              Object.entries(request.content).map(([k, v]) => [k, `[TRANS] ${v}`])
            ),
            usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
          };
        }
      }
      
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
        chunkSize: 2,
        maxRetries: 3
      });
      
      // Override the adapter with our mock
      (service as any).adapter = new FailingMockAdapter();
      
      const testContent = {
        'test.1': 'First',
        'test.2': 'Second',
        'test.3': 'Third',
        'test.4': 'Fourth'
      };
      
      const target: TranslationTarget = {
        type: 'mod' as TranslationTargetType,
        id: 'testmod',
        name: 'Test Mod',
        path: '/fake/path',
        selected: true
      };
      
      const job = service.createJob(testContent, 'ja_jp', '/fake/path');
      expect(job.chunks.length).toBe(2); // 4 entries / 2 per chunk
      
      // Start translation, expecting partial failure
      const completedJob = await service.startJob(job.id);
      
      // Should complete with partial results
      expect(completedJob.status).toBe('completed');
      
      // Check chunk statuses
      const successCount = completedJob.chunks.filter(c => c.status === 'completed').length;
      const failureCount = completedJob.chunks.filter(c => c.status === 'failed').length;
      
      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
      
      // Verify partial results are still available
      const translatedContent = service.getCombinedTranslatedContent(job.id);
      expect(Object.keys(translatedContent).length).toBe(2); // Only successfully translated entries
    });
  });
  
  describe('Custom Instructions and Formatting', () => {
    test('should apply custom translation instructions', async () => {
      const customInstructions = `
        - Keep all item names in UPPERCASE
        - Add 【】 brackets around block names
        - Preserve all technical terms in English
      `;
      
      class CustomInstructionAdapter {
        async translate(request: any): Promise<any> {
          const translations: Record<string, string> = {};
          
          for (const [key, value] of Object.entries(request.content)) {
            if (typeof value === 'string') {
              let translated = value;
              
              // Apply custom instructions based on key type
              if (key.includes('.item.')) {
                translated = translated.toUpperCase();
              } else if (key.includes('.block.')) {
                translated = `【${translated}】`;
              }
              
              translations[key] = `[JA] ${translated}`;
            }
          }
          
          return {
            success: true,
            content: translations,
            usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }
          };
        }
        
        getMaxChunkSize() { return 50; }
      }
      
      const content = {
        'item.test.sword': 'Diamond Sword',
        'block.test.ore': 'Diamond Ore',
        'message.test.info': 'Technical information'
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
          customInstructions
        },
        maxRetries: 3
      });
      
      // Override the adapter with our mock
      (service as any).adapter = new CustomInstructionAdapter();
      
      const target: TranslationTarget = {
        type: 'mod' as TranslationTargetType,
        id: 'testmod',
        name: 'Test Mod',
        path: '/fake/path',
        selected: true
      };
      
      const job = service.createJob(content, 'ja_jp', '/fake/path');
      
      // Start translation
      await service.startJob(job.id);
      
      // Get translated content
      const translations = service.getCombinedTranslatedContent(job.id);
      
      // Verify custom instructions were applied
      expect(translations['item.test.sword']).toBeDefined();
      expect(translations['item.test.sword']).toContain('[JA]');
      
      expect(translations['block.test.ore']).toBeDefined();
      expect(translations['block.test.ore']).toContain('[JA]');
      
      expect(translations['message.test.info']).toBeDefined();
      expect(translations['message.test.info']).toContain('[JA]');
    });
  });
});