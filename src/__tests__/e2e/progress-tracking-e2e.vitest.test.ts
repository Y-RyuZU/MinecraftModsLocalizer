import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TranslationService } from '../../lib/services/translation-service';
import { FileService } from '../../lib/services/file-service';
import { runTranslationJobs } from '../../lib/services/translation-runner';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Progress Tracking E2E Tests', () => {
  let service: TranslationService;
  let outputDir: string;
  let progressUpdates: number[] = [];
  let chunkProgressUpdates: number = 0;
  let modProgressUpdates: number = 0;

  beforeEach(async () => {
    // Setup output directory
    outputDir = path.join(process.cwd(), 'src/__tests__/e2e/fixtures/output/progress-test');
    await fs.mkdir(outputDir, { recursive: true });

    // Create translation service with mock adapter
    service = new TranslationService({
      llmConfig: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.3,
        systemPrompt: 'Test prompt'
      },
      translationConfig: {
        modChunkSize: 10, // Small chunk size to create multiple chunks
        questChunkSize: 10,
        patchouliChunkSize: 10,
        customChunkSize: 10,
        maxConcurrency: 1,
        enableCache: false,
        targetLanguage: 'ja_jp',
        resourcePackFormat: '13',
        additionalContext: '',
        glossary: {},
        resourcePackName: 'TestPack',
        enableLogging: false,
        additionalLanguages: [],
        useTokenBasedChunking: false
      }
    });
    
    // Force the service to use our specified chunk size
    (service as any).chunkSize = 10;

    // Mock FileService
    FileService.setTestInvokeOverride(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'write_lang_file' || command === 'write_text_file') {
        return true;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    // Reset progress tracking
    progressUpdates = [];
    chunkProgressUpdates = 0;
    modProgressUpdates = 0;
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(outputDir, { recursive: true, force: true });
    FileService.setTestInvokeOverride(null);
  });

  it('should update progress for each chunk completion', async () => {
    // Create a large mod with many entries to ensure multiple chunks
    const largeModContent: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      largeModContent[`item.testmod.item_${i}`] = `Test Item ${i}`;
    }

    // Create job
    const job = service.createJob(largeModContent, 'ja_jp', 'large_mod.jar');
    
    // Verify multiple chunks were created (with chunk size 10, should be 5 chunks)
    expect(job.chunks.length).toBe(5);

    // Track progress updates
    const mockIncrementChunks = vi.fn(() => {
      chunkProgressUpdates++;
    });
    
    const mockIncrementMods = vi.fn(() => {
      modProgressUpdates++;
    });

    // Run translation with progress tracking
    await runTranslationJobs({
      jobs: [job],
      translationService: service,
      setCurrentJobId: vi.fn(),
      incrementCompletedChunks: mockIncrementChunks,
      incrementCompletedMods: mockIncrementMods,
      targetLanguage: 'ja_jp',
      type: 'mod',
      getOutputPath: () => outputDir,
      getResultContent: (job) => service.getCombinedTranslatedContent(job.id),
      writeOutput: async () => {},
      onResult: vi.fn()
    });

    // Verify chunk progress was updated for each chunk
    expect(mockIncrementChunks).toHaveBeenCalledTimes(5);
    expect(chunkProgressUpdates).toBe(5);

    // Verify mod progress was updated once at the end
    expect(mockIncrementMods).toHaveBeenCalledTimes(1);
    expect(modProgressUpdates).toBe(1);
  });

  it('should handle progress tracking with multiple mods', { timeout: 10000 }, async () => {
    // Create multiple small mods
    const mod1Content: Record<string, string> = {
      'item.mod1.sword': 'Sword',
      'item.mod1.shield': 'Shield'
    };

    const mod2Content: Record<string, string> = {
      'item.mod2.pickaxe': 'Pickaxe',
      'item.mod2.axe': 'Axe'
    };

    const mod3Content: Record<string, string> = {
      'item.mod3.helmet': 'Helmet',
      'item.mod3.chestplate': 'Chestplate'
    };

    // Create jobs
    const job1 = service.createJob(mod1Content, 'ja_jp', 'mod1.jar');
    const job2 = service.createJob(mod2Content, 'ja_jp', 'mod2.jar');
    const job3 = service.createJob(mod3Content, 'ja_jp', 'mod3.jar');

    // Track progress updates
    const mockIncrementChunks = vi.fn(() => {
      chunkProgressUpdates++;
    });
    
    const mockIncrementMods = vi.fn(() => {
      modProgressUpdates++;
    });

    // Run translation with progress tracking
    await runTranslationJobs({
      jobs: [job1, job2, job3],
      translationService: service,
      setCurrentJobId: vi.fn(),
      incrementCompletedChunks: mockIncrementChunks,
      incrementCompletedMods: mockIncrementMods,
      targetLanguage: 'ja_jp',
      type: 'mod',
      getOutputPath: () => outputDir,
      getResultContent: (job) => service.getCombinedTranslatedContent(job.id),
      writeOutput: async () => {},
      onResult: vi.fn()
    });

    // Each mod has 1 chunk (2 entries each with chunk size 10)
    expect(mockIncrementChunks).toHaveBeenCalledTimes(3);
    expect(chunkProgressUpdates).toBe(3);

    // Mod progress should be updated 3 times (once per mod)
    expect(mockIncrementMods).toHaveBeenCalledTimes(3);
    expect(modProgressUpdates).toBe(3);
  });

  it('should simulate slow translation to verify real-time progress', async () => {
    // Create content
    const content: Record<string, string> = {};
    for (let i = 0; i < 30; i++) {
      content[`item.slowmod.item_${i}`] = `Slow Item ${i}`;
    }

    // Create job (should have 3 chunks)
    const job = service.createJob(content, 'ja_jp', 'slow_mod.jar');
    expect(job.chunks.length).toBe(3);

    // Track progress timing
    const progressTimestamps: number[] = [];
    const mockIncrementChunks = vi.fn(() => {
      progressTimestamps.push(Date.now());
      chunkProgressUpdates++;
    });

    // Add delay to translation to simulate real-world behavior
    const originalTranslateChunk = service.translateChunk.bind(service);
    service.translateChunk = async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay per chunk
      return originalTranslateChunk(...args);
    };

    const startTime = Date.now();

    // Run translation
    await runTranslationJobs({
      jobs: [job],
      translationService: service,
      setCurrentJobId: vi.fn(),
      incrementCompletedChunks: mockIncrementChunks,
      targetLanguage: 'ja_jp',
      type: 'mod',
      getOutputPath: () => outputDir,
      getResultContent: (job) => service.getCombinedTranslatedContent(job.id),
      writeOutput: async () => {},
      onResult: vi.fn()
    });

    // Verify progress was updated incrementally, not all at once
    expect(progressTimestamps.length).toBe(3);
    
    // Check that updates were spread out over time (not all at the end)
    const firstUpdate = progressTimestamps[0] - startTime;
    const lastUpdate = progressTimestamps[2] - startTime;
    
    // First update should be relatively quick (after first chunk)
    expect(firstUpdate).toBeLessThan(200);
    
    // Last update should be significantly later
    expect(lastUpdate).toBeGreaterThan(200);
    
    // Updates should be sequential
    expect(progressTimestamps[1]).toBeGreaterThan(progressTimestamps[0]);
    expect(progressTimestamps[2]).toBeGreaterThan(progressTimestamps[1]);
  });

  it('should handle missing incrementCompletedChunks gracefully', { timeout: 10000 }, async () => {
    const content = {
      'item.test.sword': 'Test Sword'
    };

    const job = service.createJob(content, 'ja_jp', 'test.jar');

    // Run without incrementCompletedChunks
    await expect(runTranslationJobs({
      jobs: [job],
      translationService: service,
      setCurrentJobId: vi.fn(),
      // incrementCompletedChunks is intentionally omitted
      targetLanguage: 'ja_jp',
      type: 'mod',
      getOutputPath: () => outputDir,
      getResultContent: (job) => service.getCombinedTranslatedContent(job.id),
      writeOutput: async () => {},
      onResult: vi.fn()
    })).resolves.not.toThrow();

    // Job should still complete successfully
    expect(job.status).toBe('completed');
  });
});