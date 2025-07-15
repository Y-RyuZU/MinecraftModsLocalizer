import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TranslationService } from '@/lib/services/translation-service';
import { FileService } from '@/lib/services/file-service';
import { TranslationTarget, TranslationTargetType } from '@/lib/types/minecraft';

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
  
  getMaxChunkSize(): number {
    return 10;
  }
}

describe('Simple E2E Translation Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const outputDir = path.join(fixturesDir, 'output', 'simple');
  
  beforeAll(async () => {
    // Mock Tauri invoke for test environment
    (global as any).window = {
      __TAURI_INTERNALS__: {
        invoke: async (cmd: string, args: any) => {
          // Mock Tauri commands used by TranslationService
          console.log(`[Mock Tauri] ${cmd}:`, args);
          return null;
        }
      }
    };
    // Clean output directory
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });
    
    // Set up FileService mock
    FileService.setTestInvokeOverride(async (command, args) => {
      switch (command) {
        case 'read_text_file':
          return await fs.readFile(args?.path as string, 'utf-8');
        
        case 'write_text_file':
          const filePath = args?.path as string;
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, args?.content as string);
          return true;
        
        default:
          return null;
      }
    });
  });
  
  afterAll(() => {
    FileService.setTestInvokeOverride(null);
  });
  
  test('should translate a simple mod file', async () => {
    const modPath = path.join(fixturesDir, 'mods', 'sample-mod', 'assets', 'samplemod', 'lang', 'en_us.json');
    const content = await fs.readFile(modPath, 'utf-8');
    const entries = JSON.parse(content);
    
    const target: TranslationTarget = {
      type: 'mod',
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
      chunkSize: 5,
      maxRetries: 3
    });
    
    // Override adapter
    (service as any).adapter = new SimpleE2EMockAdapter();
    
    // Create a translation job
    const job = service.createJob(
      entries,
      'ja_jp',
      target.path
    );
    
    expect(job.chunks.length).toBeGreaterThan(0);
    expect(job.status).toBe('pending');
    
    // Start the job
    const completedJob = await service.startJob(job.id);
    
    expect(completedJob.status).toBe('completed');
    expect(completedJob.progress).toBe(100);
    
    // Get translated content
    const translatedContent = service.getCombinedTranslatedContent(job.id);
    
    // Verify translations
    expect(Object.keys(translatedContent).length).toBe(Object.keys(entries).length);
    expect(translatedContent['item.samplemod.example_item']).toBe('[JP] Example Item');
    expect(translatedContent['block.samplemod.example_block']).toBe('[JP] Example Block');
    
    // Write output
    const outputPath = path.join(outputDir, 'samplemod.ja_jp.json');
    await fs.writeFile(outputPath, JSON.stringify(translatedContent, null, 2));
    
    // Verify file was written
    const writtenContent = await fs.readFile(outputPath, 'utf-8');
    const writtenData = JSON.parse(writtenContent);
    expect(writtenData['item.samplemod.example_item']).toBe('[JP] Example Item');
  });
  
  test('should handle quest files with proper formatting', async () => {
    const questPath = path.join(fixturesDir, 'quests', 'ftb', 'quests', 'chapters', 'getting_started.snbt');
    const content = await fs.readFile(questPath, 'utf-8');
    
    // Extract translatable content from SNBT
    const translatableContent: Record<string, string> = {};
    
    // Extract title
    const titleMatch = content.match(/title:\s*"([^"]+)"/);
    if (titleMatch) {
      translatableContent['title'] = titleMatch[1];
    }
    
    // Extract quest titles
    const questTitleMatches = content.matchAll(/title:\s*"([^"]+)"/g);
    let questIndex = 0;
    for (const match of questTitleMatches) {
      if (questIndex > 0) { // Skip the chapter title
        translatableContent[`quest_${questIndex}_title`] = match[1];
      }
      questIndex++;
    }
    
    const target: TranslationTarget = {
      type: 'quest',
      id: 'ftb-quest',
      name: 'FTB Quest',
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
    
    // Override adapter
    (service as any).adapter = new SimpleE2EMockAdapter();
    
    // Create and run job
    const job = service.createJob(
      translatableContent,
      'ja_jp',
      target.path
    );
    
    await service.startJob(job.id);
    
    const translatedContent = service.getCombinedTranslatedContent(job.id);
    
    expect(translatedContent['title']).toBe('[JP] Getting Started');
    expect(translatedContent['quest_1_title']).toBe('[JP] Welcome!');
    
    // Apply translations back to SNBT
    let translatedSNBT = content;
    
    // Replace chapter title
    if (translatedContent['title']) {
      translatedSNBT = translatedSNBT.replace(
        /title:\s*"[^"]+"/,
        `title: "${translatedContent['title']}"`
      );
    }
    
    // Write output
    const outputPath = path.join(outputDir, 'getting_started.ja_jp.snbt');
    await fs.writeFile(outputPath, translatedSNBT);
    
    // Verify output contains translations
    const writtenContent = await fs.readFile(outputPath, 'utf-8');
    expect(writtenContent).toContain('[JP] Getting Started');
  });
  
  test('should preserve formatting codes and placeholders', async () => {
    const testContent = {
      'test.formatting': 'Color: §eYellow§r text',
      'test.placeholder.single': 'You have %s items',
      'test.placeholder.multiple': 'Level %d: %s',
      'test.placeholder.indexed': 'Player %1$s has %2$d points'
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
        customInstructions: 'Preserve all formatting codes'
      },
      maxRetries: 3
    });
    
    // Override adapter
    (service as any).adapter = new SimpleE2EMockAdapter();
    
    const job = service.createJob(
      testContent,
      'ja_jp',
      'test.json'
    );
    
    await service.startJob(job.id);
    
    const translated = service.getCombinedTranslatedContent(job.id);
    
    // Verify formatting codes are preserved
    expect(translated['test.formatting']).toContain('§e');
    expect(translated['test.formatting']).toContain('§r');
    
    // Verify placeholders are preserved
    expect(translated['test.placeholder.single']).toContain('%s');
    expect(translated['test.placeholder.multiple']).toContain('%d');
    expect(translated['test.placeholder.multiple']).toContain('%s');
    expect(translated['test.placeholder.indexed']).toContain('%1$s');
    expect(translated['test.placeholder.indexed']).toContain('%2$d');
  });
});