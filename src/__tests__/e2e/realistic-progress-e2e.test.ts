import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { TranslationService } from '@/lib/services/translation-service';
import { runTranslationJobs } from '@/lib/services/translation-runner';
import { FileService } from '@/lib/services/file-service';

describe('Realistic Progress Tracking E2E', () => {
  let service: TranslationService;
  let progressUpdates: number[] = [];
  let chunkCompletionTimes: number[] = [];

  beforeAll(() => {
    // Setup service with realistic configuration
    service = new TranslationService({
      llmConfig: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        temperature: 0.3,
        systemPrompt: 'Test prompt'
      },
      translationConfig: {
        modChunkSize: 50, // Realistic chunk size
        questChunkSize: 50,
        patchouliChunkSize: 50,
        customChunkSize: 50,
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

    // Mock file operations
    FileService.setTestInvokeOverride(async (command: string) => {
      if (command === 'write_lang_file' || command === 'write_text_file') {
        return true;
      }
      throw new Error(`Unexpected command: ${command}`);
    });
  });

  afterAll(() => {
    FileService.setTestInvokeOverride(null);
  });

  test('should show realistic progress for large mod translation', async () => {
    // Create a realistic mod with 250 entries (5 chunks of 50 each)
    const largeMod: Record<string, string> = {};
    for (let i = 0; i < 250; i++) {
      largeMod[`item.realmod.item_${i}`] = `Item Name ${i}`;
      largeMod[`item.realmod.item_${i}.desc`] = `This is a description for item ${i} with some longer text`;
    }

    // Create job
    const job = service.createJob(largeMod, 'ja_jp', 'RealMod.jar');
    
    // Should create 10 chunks with default chunk size 50 (500 entries / 50 = 10)
    expect(job.chunks.length).toBe(10);

    // Track progress
    progressUpdates = [];
    chunkCompletionTimes = [];
    const startTime = Date.now();

    let completedChunks = 0;
    const mockIncrementChunks = () => {
      completedChunks++;
      const progress = (completedChunks / job.chunks.length) * 100;
      progressUpdates.push(progress);
      chunkCompletionTimes.push(Date.now() - startTime);
    };

    // Mock the translation with realistic delay
    service.translateChunk = async (content: Record<string, string>, targetLang: string) => {
      // Simulate API call delay (100-300ms per chunk for testing)
      const delay = 100 + Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Return mock translated content
      const translated: Record<string, string> = {};
      for (const [key, value] of Object.entries(content)) {
        translated[key] = `[${targetLang.toUpperCase()}] ${value}`;
      }
      return translated;
    };

    // Run translation
    await runTranslationJobs({
      jobs: [job],
      translationService: service,
      setCurrentJobId: () => {},
      incrementCompletedChunks: mockIncrementChunks,
      targetLanguage: 'ja_jp',
      type: 'mod',
      getOutputPath: () => '/output',
      getResultContent: (job) => service.getCombinedTranslatedContent(job.id),
      writeOutput: async () => {},
      onResult: () => {}
    });

    // Verify progress was updated correctly
    expect(progressUpdates.length).toBe(10);
    expect(progressUpdates[0]).toBe(10); // 1/10 = 10%
    expect(progressUpdates[1]).toBe(20); // 2/10 = 20%
    expect(progressUpdates[4]).toBe(50); // 5/10 = 50%
    expect(progressUpdates[9]).toBe(100); // 10/10 = 100%

    // Verify timing is realistic (chunks complete over time, not all at once)
    for (let i = 1; i < chunkCompletionTimes.length; i++) {
      expect(chunkCompletionTimes[i]).toBeGreaterThan(chunkCompletionTimes[i - 1]);
    }

    // Total time should be at least 1 second (10 chunks * 100ms minimum)
    expect(chunkCompletionTimes[9]).toBeGreaterThan(1000);
  });

  test('should handle very small progress increments for huge files', async () => {
    // Create a huge mod with 1000 entries (20 chunks)
    const hugeMod: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) {
      hugeMod[`item.hugemod.item_${i}`] = `Item ${i}`;
    }

    const job = service.createJob(hugeMod, 'ja_jp', 'HugeMod.jar');
    expect(job.chunks.length).toBe(20); // 1000 / 50 = 20 chunks

    progressUpdates = [];
    let completedChunks = 0;
    const mockIncrementChunks = () => {
      completedChunks++;
      const progress = (completedChunks / job.chunks.length) * 100;
      progressUpdates.push(progress);
    };

    // Use faster translation for this test
    service.translateChunk = async (content, targetLang) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      const translated: Record<string, string> = {};
      for (const [key, value] of Object.entries(content)) {
        translated[key] = `[JA] ${value}`;
      }
      return translated;
    };

    await runTranslationJobs({
      jobs: [job],
      translationService: service,
      setCurrentJobId: () => {},
      incrementCompletedChunks: mockIncrementChunks,
      targetLanguage: 'ja_jp',
      type: 'mod',
      getOutputPath: () => '/output',
      getResultContent: (job) => service.getCombinedTranslatedContent(job.id),
      writeOutput: async () => {},
      onResult: () => {}
    });

    // Check small increments (5% per chunk)
    expect(progressUpdates[0]).toBe(5);   // 1/20 = 5%
    expect(progressUpdates[1]).toBe(10);  // 2/20 = 10%
    expect(progressUpdates[2]).toBe(15);  // 3/20 = 15%
    
    // Verify we get all 20 updates
    expect(progressUpdates.length).toBe(20);
    expect(progressUpdates[19]).toBe(100);
  });

  test('should handle multiple mods with accurate overall progress', async () => {
    // Create 3 mods of different sizes
    const mod1: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      mod1[`item.mod1.item_${i}`] = `Mod1 Item ${i}`;
    }

    const mod2: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      mod2[`item.mod2.item_${i}`] = `Mod2 Item ${i}`;
    }

    const mod3: Record<string, string> = {};
    for (let i = 0; i < 150; i++) {
      mod3[`item.mod3.item_${i}`] = `Mod3 Item ${i}`;
    }

    const job1 = service.createJob(mod1, 'ja_jp', 'mod1.jar'); // 2 chunks
    const job2 = service.createJob(mod2, 'ja_jp', 'mod2.jar'); // 1 chunk
    const job3 = service.createJob(mod3, 'ja_jp', 'mod3.jar'); // 3 chunks

    const totalChunks = job1.chunks.length + job2.chunks.length + job3.chunks.length;
    expect(totalChunks).toBe(6); // 2 + 1 + 3 = 6

    progressUpdates = [];
    let completedChunks = 0;
    const mockIncrementChunks = () => {
      completedChunks++;
      const progress = (completedChunks / totalChunks) * 100;
      progressUpdates.push(Math.round(progress));
    };

    // Fast translation for this test
    service.translateChunk = async (content) => {
      const translated: Record<string, string> = {};
      for (const [key, value] of Object.entries(content)) {
        translated[key] = `[JA] ${value}`;
      }
      return translated;
    };

    await runTranslationJobs({
      jobs: [job1, job2, job3],
      translationService: service,
      setCurrentJobId: () => {},
      incrementCompletedChunks: mockIncrementChunks,
      targetLanguage: 'ja_jp',
      type: 'mod',
      getOutputPath: () => '/output',
      getResultContent: (job) => service.getCombinedTranslatedContent(job.id),
      writeOutput: async () => {},
      onResult: () => {}
    });

    // Verify progress increments
    expect(progressUpdates).toEqual([
      17,  // 1/6 ≈ 16.67% → 17%
      33,  // 2/6 ≈ 33.33% → 33%
      50,  // 3/6 = 50%
      67,  // 4/6 ≈ 66.67% → 67%
      83,  // 5/6 ≈ 83.33% → 83%
      100  // 6/6 = 100%
    ]);
  });
});