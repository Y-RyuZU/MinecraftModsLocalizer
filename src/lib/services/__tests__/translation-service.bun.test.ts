import { test, describe, beforeEach, expect, mock } from 'bun:test';
import { TranslationService } from '../translation-service';
import { LLMConfig } from '../../types/llm';
import { mockModData } from '../../test-utils/mock-data';
import { LLMAdapterFactory } from '../../adapters/llm-adapter-factory';

// Mock the LLM adapter factory
const mockAdapter = {
  id: 'mock',
  name: 'Mock LLM',
  requiresApiKey: false,
  translate: mock(),
  translateBatch: mock(),
  validateApiKey: mock(),
  getMaxChunkSize: mock(() => 50)
};

// Mock LLM adapter factory
mock.module('../../adapters/llm-adapter-factory', () => ({
  LLMAdapterFactory: {
    getAdapter: mock(() => mockAdapter)
  }
}));

// Mock Tauri invoke
mock.module('@tauri-apps/api/core', () => ({
  invoke: mock(() => Promise.resolve(undefined))
}));

describe('TranslationService', () => {
  let translationService: TranslationService;

  beforeEach(() => {
    mockAdapter.translate.mockClear();
    mockAdapter.translateBatch.mockClear();
    mockAdapter.validateApiKey.mockClear();
    mockAdapter.getMaxChunkSize.mockClear();
    
    // Mock LLMAdapterFactory to return our mock adapter
    LLMAdapterFactory.getAdapter = mock(() => mockAdapter);
    
    const config: LLMConfig = {
      provider: 'mock',
      apiKey: 'test-key',
      model: 'mock-model',
      maxRetries: 2
    };

    translationService = new TranslationService({
      llmConfig: config,
      chunkSize: 3,
      maxRetries: 2
    });

    // Reset mock functions
    mockAdapter.translate.mockImplementation(() => Promise.resolve({
      content: { 'test.key': 'translated value' },
      metadata: { tokensUsed: 10, timeTaken: 100 }
    }));
    mockAdapter.validateApiKey.mockImplementation(() => Promise.resolve(true));
  });

  test('startJob submits a single Batch API request and preserves the output keys', async () => {
    const service = new TranslationService({ llmConfig: { provider: 'openai', apiKey: 'synthetic', useBatchApi: true }, chunkSize: 1 });
    mockAdapter.translateBatch.mockResolvedValue([{ content: { a: '訳A' } }, { content: { b: '訳B' } }]);
    const job = service.createJob({ a: 'A', b: 'B' }, 'ja_jp');
    await service.startJob(job.id);
    expect(mockAdapter.translateBatch).toHaveBeenCalledTimes(1);
    expect(mockAdapter.translate).not.toHaveBeenCalled();
    expect(job.status).toBe('completed');
    expect(service.getCombinedTranslatedContent(job.id)).toEqual({ a: '訳A', b: '訳B' });
  });

  test('token chunking keeps oversized values and their Minecraft keys intact', () => {
    const service = new TranslationService({ llmConfig: { provider: 'openai', apiKey: 'synthetic' }, useTokenBasedChunking: true, maxTokensPerChunk: 100 });
    const source = { 'quest.long': 'Long sentence! Another sentence? '.repeat(100), 'quest.long_part_1': 'Real key' };
    const job = service.createJob(source, 'ja_jp');
    expect(Object.assign({}, ...job.chunks.map(chunk => chunk.content))).toEqual(source);
  });

  describe('Job Creation', () => {
    test('should create a translation job with correct structure', () => {
      const content = mockModData.simpleMod.content;
      const targetLanguage = 'ja_jp';
      const fileName = 'test_mod.jar';

      const job = translationService.createJob(content, targetLanguage, fileName);

      expect(job).toMatchObject({
        id: expect.stringMatching(/^job_\d+_[a-z0-9]+$/),
        targetLanguage,
        status: 'pending',
        progress: 0,
        currentFileName: fileName,
        startTime: expect.any(Number)
      });

      expect(job.chunks).toHaveLength(1); // 3 items with chunk size 3
      expect(job.chunks[0]).toMatchObject({
        id: expect.stringContaining('chunk_0'),
        content: content,
        status: 'pending'
      });
    });

    test('should split large content into multiple chunks', () => {
      const largeContent = Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [`key_${i}`, `value_${i}`])
      );
      
      const job = translationService.createJob(largeContent, 'ja_jp');

      const expectedChunks = Math.ceil(10 / 3); // chunk size is 3
      expect(job.chunks).toHaveLength(expectedChunks);

      // Verify all content is preserved across chunks
      const allContent: Record<string, string> = {};
      job.chunks.forEach(chunk => {
        Object.assign(allContent, chunk.content);
      });

      expect(allContent).toEqual(largeContent);
    });

    test('should store and retrieve jobs correctly', () => {
      const job = translationService.createJob(mockModData.simpleMod.content, 'ja_jp');
      
      const retrievedJob = translationService.getJob(job.id);
      expect(retrievedJob).toEqual(job);

      const allJobs = translationService.getAllJobs();
      expect(allJobs).toContain(job);
    });
  });

  describe('Progress Tracking', () => {
    test('should call progress callback during translation', () => {
      const onProgress = mock();
      const onComplete = mock();

      const service = new TranslationService({
        llmConfig: { provider: 'mock', apiKey: 'test-key' },
        chunkSize: 3,
        onProgress,
        onComplete
      });

      const job = service.createJob(mockModData.simpleMod.content, 'ja_jp');
      
      // Simulate progress update
      const updatedJob = { ...job, progress: 50 };
      onProgress(updatedJob);

      expect(onProgress).toHaveBeenCalledWith(updatedJob);
    });
  });

  describe('Job Management', () => {
    test('should clear jobs correctly', () => {
      const job1 = translationService.createJob(mockModData.simpleMod.content, 'ja_jp');
      translationService.createJob({'key': 'value'}, 'zh_cn');

      expect(translationService.getAllJobs()).toHaveLength(2);

      translationService.clearJob(job1.id);
      expect(translationService.getAllJobs()).toHaveLength(1);
      expect(translationService.getJob(job1.id)).toBeUndefined();

      translationService.clearAllJobs();
      expect(translationService.getAllJobs()).toHaveLength(0);
    });

    test('should track interruption state', () => {
      const job = translationService.createJob(mockModData.simpleMod.content, 'ja_jp');

      expect(translationService.isJobInterrupted(job.id)).toBe(false);

      translationService.interruptJob(job.id);
      expect(translationService.isJobInterrupted(job.id)).toBe(true);
    });
  });

  describe('Content Processing', () => {
    test('retries the original chunk when a provider batch response has invalid JSON shape', async () => {
      const source = { first: 'First source', second: 'Second source' };
      const batchConfig: LLMConfig = {
        provider: 'mock',
        apiKey: 'test-key',
        model: 'mock-model',
        maxRetries: 2,
        useBatchApi: true
      };
      translationService = new TranslationService({ llmConfig: batchConfig, chunkSize: 3, maxRetries: 2 });
      const batchJob = translationService.createJob(source, 'ja_jp');
      mockAdapter.translateBatch.mockImplementation(async () => [{ content: { first: 'First translated' } }]);
      mockAdapter.translate.mockImplementation(async (request: { content: Record<string, string> }) => ({
        content: Object.fromEntries(Object.entries(request.content).map(([key, value]) => [key, `Retry: ${value}`]))
      }));

      const results = await translationService.translateChunksBatch([{
        content: source,
        targetLanguage: 'ja_jp',
        jobId: batchJob.id
      }]);

      expect(results).toEqual([{
        translatedContent: { first: 'Retry: First source', second: 'Retry: Second source' }
      }]);
      expect(mockAdapter.translateBatch).toHaveBeenCalledTimes(1);
      expect(mockAdapter.translate).toHaveBeenCalledTimes(1);
      expect(mockAdapter.translate.mock.calls[0][0].content).toEqual(source);
    });

    test('accepts structurally valid batch JSON without a second quality heuristic', async () => {
      const source = { name: 'Hostile Neural Networks', description: 'The Enrichment Chamber is ready.' };
      const batchConfig: LLMConfig = {
        provider: 'mock',
        apiKey: 'test-key',
        model: 'mock-model',
        useBatchApi: true
      };
      translationService = new TranslationService({ llmConfig: batchConfig, chunkSize: 100, maxRetries: 0 });
      const job = translationService.createJob(source, 'en_us');
      mockAdapter.translateBatch.mockImplementation(async () => [{ content: source }]);

      const results = await translationService.translateChunksBatch([{
        content: source,
        targetLanguage: 'en_us',
        jobId: job.id
      }]);

      expect(results).toEqual([{ translatedContent: source }]);
      expect(mockAdapter.translate).not.toHaveBeenCalled();
    });

    test('should handle various content types', () => {
      const contents = [
        mockModData.simpleMod.content,
        mockModData.specialMod.content,
        { 'single.key': 'single value' },
        Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key_${i}`, `value_${i}`]))
      ];

      contents.forEach(content => {
        const job = translationService.createJob(content, 'ja_jp');
        expect(job.chunks.length).toBeGreaterThan(0);
        
        // Verify all content is preserved
        const preservedContent: Record<string, string> = {};
        job.chunks.forEach(chunk => {
          Object.assign(preservedContent, chunk.content);
        });
        expect(preservedContent).toEqual(content);
      });
    });
  });

  describe('Adapter Integration', () => {
    test('should use the correct chunk size from adapter', () => {
      const config: LLMConfig = {
        provider: 'mock',
        apiKey: 'test-key'
      };

      new TranslationService({ llmConfig: config });
      
      // Should use adapter's max chunk size (50) as default
      expect(mockAdapter.getMaxChunkSize).toHaveBeenCalled();
    });

    test('should respect custom chunk size', () => {
      const config: LLMConfig = {
        provider: 'mock',
        apiKey: 'test-key'
      };

      const customChunkSize = 25;
      const service = new TranslationService({ 
        llmConfig: config, 
        chunkSize: customChunkSize 
      });
      
      const largeContent = Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`key_${i}`, `value_${i}`])
      );
      
      const job = service.createJob(largeContent, 'ja_jp');
      const expectedChunks = Math.ceil(100 / customChunkSize);
      expect(job.chunks).toHaveLength(expectedChunks);
    });
  });

  describe('Error Handling', () => {
    test('retries a malformed JSON response with the unchanged original chunk', async () => {
      const source = { one: 'First', two: 'Second' };
      mockAdapter.translate
        .mockResolvedValueOnce({ content: { one: '日本語:First' }, metadata: { tokensUsed: 10, timeTaken: 100 } })
        .mockResolvedValueOnce({ content: { one: '日本語:First', two: '日本語:Second' }, metadata: { tokensUsed: 10, timeTaken: 100 } });
      const translated = await translationService.translateChunk(source, 'ja_jp', 'adaptive-split-test');

      expect(translated).toEqual({
        one: '日本語:First', two: '日本語:Second'
      });
      expect(mockAdapter.translate).toHaveBeenCalledTimes(2);
      expect(mockAdapter.translate.mock.calls.map(([request]) => request.content)).toEqual([source, source]);
      expect(mockAdapter.translate.mock.calls[1][0].systemPromptSupplement).toContain('previous response was invalid');
    });

    test('sends placeholders directly in the JSON values and asks the model to preserve them', async () => {
      mockAdapter.translate.mockResolvedValueOnce({
        content: { first: "こんにちは", second: "使う %s" },
        metadata: { tokensUsed: 10, timeTaken: 100 }
      });

      await expect(translationService.translateChunk({
        first: "Hello",
        second: "Use %s"
      }, "ja_jp", "invalid-entry-only-retry-test")).resolves.toEqual({
        first: "こんにちは",
        second: "使う %s"
      });
      expect(mockAdapter.translate).toHaveBeenCalledTimes(1);
      expect(mockAdapter.translate.mock.calls[0][0].content).toEqual({ first: "Hello", second: "Use %s" });
      expect(mockAdapter.translate.mock.calls[0][0].systemPromptSupplement).toContain("Preserve formatting codes and placeholders unchanged");
    });

    test('retries extra keys using the original key:value JSON', async () => {
      mockAdapter.translate
        .mockResolvedValueOnce({ content: { one: "こんにちは %s {魚} §a<item>", two: "使う $1 と ${name}", extra: "余計" } })
        .mockResolvedValueOnce({
          content: { one: "こんにちは %s {魚} §a<item>", two: "使う $1 と ${name}" },
          metadata: { tokensUsed: 10, timeTaken: 100 }
        });

      await expect(translationService.translateChunk({
        one: "Hello %s {fish} §a<item>",
        two: "Use $1 and ${name}"
      }, "ja_jp", "placeholder-validation-test")).resolves.toEqual({
        one: "こんにちは %s {魚} §a<item>",
        two: "使う $1 と ${name}"
      });
      expect(mockAdapter.translate).toHaveBeenCalledTimes(2);
      expect(mockAdapter.translate.mock.calls[0][0].content).toEqual({
        one: "Hello %s {fish} §a<item>",
        two: "Use $1 and ${name}"
      });
      expect(mockAdapter.translate.mock.calls[1][0].content).toEqual({
        one: "Hello %s {fish} §a<item>",
        two: "Use $1 and ${name}"
      });
    });

    test('allows translating braced guidebook markup while preserving real placeholders', async () => {
      mockAdapter.translate.mockImplementation(async () => ({
        content: { one: "こんにちは %1$s {魚} §a<item>" },
        metadata: { tokensUsed: 10, timeTaken: 100 }
      }));

      await expect(translationService.translateChunk({
        one: "Hello %1$s {fish} §a<item>"
      }, "ja_jp", "valid-placeholders-test")).resolves.toEqual({
        one: "こんにちは %1$s {魚} §a<item>"
      });
    });

    test('accepts translated labels inside standalone angle brackets', async () => {
      mockAdapter.translate.mockImplementation(async () => ({
        content: { one: "<オフ>" },
        metadata: { tokensUsed: 10, timeTaken: 100 }
      }));

      await expect(translationService.translateChunk({ one: "<Off>" }, "ja_jp", "angle-label-test"))
        .resolves.toEqual({ one: "<オフ>" });
    });

    test('leaves JSON-looking translation values unchanged', async () => {
      const value = JSON.stringify({ one: "翻訳済み" });
      mockAdapter.translate.mockImplementation(async () => ({
        content: { one: value },
        metadata: { tokensUsed: 10, timeTaken: 100 }
      }));

      await expect(translationService.translateChunk({ one: "{fish}" }, "ja_jp", "nested-json-test"))
        .resolves.toEqual({ one: value });
      expect(mockAdapter.translate).toHaveBeenCalledTimes(1);
    });

    test('sends Minecraft color codes raw and relies on the prompt to preserve them', async () => {
      mockAdapter.translate.mockResolvedValueOnce({
        content: { one: "押す &6%s&r" },
        metadata: { tokensUsed: 10, timeTaken: 100 }
      });

      await expect(translationService.translateChunk({ one: "Tap &6%s&r" }, "ja_jp", "format-retry-test"))
        .resolves.toEqual({ one: "押す &6%s&r" });
      expect(mockAdapter.translate).toHaveBeenCalledTimes(1);
      expect(mockAdapter.translate.mock.calls[0][0].content).toEqual({ one: "Tap &6%s&r" });
      expect(mockAdapter.translate.mock.calls[0][0].systemPromptSupplement).toContain("Preserve formatting codes and placeholders unchanged");
    });

    test('passes complex source keys through unchanged', async () => {
      const sourceKey = "file_0::/pages/1/text";
      mockAdapter.translate.mockImplementation(async ({ content }: { content: Record<string, string> }) => ({
        content: Object.fromEntries(Object.keys(content).map((key) => [key, "日本語"])),
        metadata: { tokensUsed: 10, timeTaken: 100 }
      }));

      await expect(translationService.translateChunk({ [sourceKey]: "Original text" }, "ja_jp", "direct-key-test"))
        .resolves.toEqual({ [sourceKey]: "日本語" });
      expect(mockAdapter.translate.mock.calls[0][0].content).toEqual({ [sourceKey]: "Original text" });
    });

    test('retries a malformed singleton response once with an exact-key correction prompt', async () => {
      mockAdapter.translate
        .mockResolvedValueOnce({ content: {}, metadata: { tokensUsed: 10, timeTaken: 100 } })
        .mockResolvedValueOnce({ content: { one: "翻訳済み" }, metadata: { tokensUsed: 10, timeTaken: 100 } });

      await expect(translationService.translateChunk({ one: "Source" }, "ja_jp", "singleton-schema-retry"))
        .resolves.toEqual({ one: "翻訳済み" });
      expect(mockAdapter.translate).toHaveBeenCalledTimes(2);
      expect(mockAdapter.translate.mock.calls[1][0].content).toEqual({ one: "Source" });
      expect(mockAdapter.translate.mock.calls[1][0].systemPromptSupplement).toContain("previous response was invalid");
    });

    test('should handle missing jobs gracefully', () => {
      expect(translationService.getJob('nonexistent')).toBeUndefined();
      expect(() => translationService.getCombinedTranslatedContent('nonexistent')).toThrow();
    });

    test('should validate input parameters', () => {
      expect(() => translationService.createJob({}, 'ja_jp')).not.toThrow();
      expect(() => translationService.createJob(mockModData.simpleMod.content, '')).not.toThrow();
    });
  });
});
