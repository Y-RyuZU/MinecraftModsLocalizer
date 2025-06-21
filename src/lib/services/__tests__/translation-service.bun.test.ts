import { test, describe, beforeEach, expect, mock } from 'bun:test';
import { TranslationService } from '../translation-service';
import { LLMConfig } from '../../types/llm';
import { mockModData } from '../../test-utils/mock-data';

// Mock the LLM adapter factory
const mockAdapter = {
  id: 'mock',
  name: 'Mock LLM',
  requiresApiKey: false,
  translate: mock(),
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
    mockAdapter.validateApiKey.mockClear();
    mockAdapter.getMaxChunkSize.mockClear();
    
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
      const job2 = translationService.createJob({'key': 'value'}, 'zh_cn');

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

      const service = new TranslationService({ llmConfig: config });
      
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