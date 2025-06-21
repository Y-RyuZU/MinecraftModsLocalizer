import { runTranslationJobs, RunTranslationJobsOptions } from '../translation-runner';
import { TranslationService } from '../translation-service';
import { TranslationResult } from '../../types/minecraft';
import { 
  mockModData, 
  createMockTranslationJob, 
  createMockTranslationResults,
  mockErrorScenarios 
} from '../../test-utils/mock-data';

// Mock TranslationService
class MockTranslationService {
  private jobs = new Map();
  private interrupted = new Set<string>();
  private shouldFail = false;
  private failureError: Error | null = null;

  translateChunk = jest.fn().mockImplementation(async (content: Record<string, string>, targetLanguage: string) => {
    if (this.shouldFail && this.failureError) {
      throw this.failureError;
    }
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return createMockTranslationResults(content, targetLanguage);
  });

  isJobInterrupted = jest.fn().mockImplementation((jobId: string) => {
    return this.interrupted.has(jobId);
  });

  interruptJob(jobId: string) {
    this.interrupted.add(jobId);
  }

  setFailure(error: Error) {
    this.shouldFail = true;
    this.failureError = error;
  }

  clearFailure() {
    this.shouldFail = false;
    this.failureError = null;
  }
}

describe('Translation Runner', () => {
  let mockTranslationService: MockTranslationService;
  let progressTracker: {
    completedChunks: number;
    completedMods: number;
    currentJobId: string | null;
  };
  let mockCallbacks: {
    onJobStart: jest.Mock;
    onJobChunkComplete: jest.Mock;
    onJobComplete: jest.Mock;
    onJobInterrupted: jest.Mock;
    onResult: jest.Mock;
    writeOutput: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTranslationService = new MockTranslationService();
    
    progressTracker = {
      completedChunks: 0,
      completedMods: 0,
      currentJobId: null
    };

    mockCallbacks = {
      onJobStart: jest.fn(),
      onJobChunkComplete: jest.fn(),
      onJobComplete: jest.fn(),
      onJobInterrupted: jest.fn(),
      onResult: jest.fn(),
      writeOutput: jest.fn().mockResolvedValue(undefined)
    };
  });

  describe('Single Job Processing', () => {
    it('should process a single job with one chunknk successfully', async () => {
      const content = mockModData.simpleMod.content;
      const job = createMockTranslationJob(content, 'ja_jp', 'simple_mod.jar');
      
      // Ensure single chunk
      job.chunks = [{
        id: 'chunk_0',
        content,
        status: 'pending'
      }];

      const options: RunTranslationJobsOptions = {
        jobs: [job],
        translationService: mockTranslationService as any,
        onJobStart: mockCallbacks.onJobStart,
        onJobChunkComplete: mockCallbacks.onJobChunkComplete,
        onJobComplete: mockCallbacks.onJobComplete,
        onResult: mockCallbacks.onResult,
        setCurrentJobId: (jobId) => { progressTracker.currentJobId = jobId; },
        incrementCompletedChunks: () => { progressTracker.completedChunks++; },
        incrementCompletedMods: () => { progressTracker.completedMods++; },
        getOutputPath: () => '/test/output/path',
        getResultContent: () => content,
        writeOutput: mockCallbacks.writeOutput,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      // Verify job lifecycle callbacks
      expect(mockCallbacks.onJobStart).toHaveBeenCalledWith(job, 0);
      expect(mockCallbacks.onJobChunkComplete).toHaveBeenCalledWith(job, 0);
      expect(mockCallbacks.onJobComplete).toHaveBeenCalledWith(job, 0);
      expect(mockCallbacks.onResult).toHaveBeenCalled();

      // Verify job status
      expect(job.status).toBe('completed');
      expect(job.chunks[0].status).toBe('completed');
      expect(job.chunks[0].translatedContent).toBeDefined();

      // Verify progress tracking
      expect(progressTracker.completedChunks).toBe(1);
      expect(progressTracker.completedMods).toBe(1);
      expect(progressTracker.currentJobId).toBeNull(); // Reset after completion

      // Verify translation and output
      expect(mockTranslationService.translateChunk).toHaveBeenCalledWith(content, 'ja_jp', job.id);
      expect(mockCallbacks.writeOutput).toHaveBeenCalledWith(job, '/test/output/path', content);
    });

    it('should process a job with multiple chunkss', async () => {
      const content = mockModData.complexMod.content; // 150 items
      const job = createMockTranslationJob(content, 'ja_jp', 'complex_mod.jar');
      
      // Create multiple chunks manually for testing
      const chunkSize = 50;
      const entries = Object.entries(content);
      job.chunks = [];
      
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunkEntries = entries.slice(i, i + chunkSize);
        const chunkContent = Object.fromEntries(chunkEntries);
        
        job.chunks.push({
          id: `chunk_${job.chunks.length}`,
          content: chunkContent,
          status: 'pending'
        });
      }

      const expectedChunks = job.chunks.length;

      const options: RunTranslationJobsOptions = {
        jobs: [job],
        translationService: mockTranslationService as any,
        incrementCompletedChunks: () => { progressTracker.completedChunks++; },
        incrementCompletedMods: () => { progressTracker.completedMods++; },
        getOutputPath: () => '/test/output/path',
        getResultContent: () => content,
        writeOutput: mockCallbacks.writeOutput,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      // Verify all chunks were processed
      expect(mockTranslationService.translateChunk).toHaveBeenCalledTimes(expectedChunks);
      expect(progressTracker.completedChunks).toBe(expectedChunks);
      expect(progressTracker.completedMods).toBe(1);

      // Verify all chunks are completed
      job.chunks.forEach(chunk => {
        expect(chunk.status).toBe('completed');
        expect(chunk.translatedContent).toBeDefined();
      });
    });
  });

  describe('Multiple Jobs Processing', () => {
    it('should process multiple jobs sequentiallyy', async () => {
      const job1 = createMockTranslationJob(mockModData.simpleMod.content, 'ja_jp', 'mod1.jar');
      const job2 = createMockTranslationJob(mockModData.specialMod.content, 'ja_jp', 'mod2.jar');
      const job3 = createMockTranslationJob({ 'test.key': 'test value' }, 'ja_jp', 'mod3.jar');

      // Ensure single chunks for simplicity
      [job1, job2, job3].forEach(job => {
        job.chunks = [{
          id: 'chunk_0',
          content: job.chunks[0].content,
          status: 'pending'
        }];
      });

      const options: RunTranslationJobsOptions = {
        jobs: [job1, job2, job3],
        translationService: mockTranslationService as any,
        onJobStart: mockCallbacks.onJobStart,
        onJobComplete: mockCallbacks.onJobComplete,
        incrementCompletedChunks: () => { progressTracker.completedChunks++; },
        incrementCompletedMods: () => { progressTracker.completedMods++; },
        getOutputPath: (job) => `/test/output/${job.currentFileName}`,
        getResultContent: (job) => job.chunks[0].content,
        writeOutput: mockCallbacks.writeOutput,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      // Verify all jobs were started and completed
      expect(mockCallbacks.onJobStart).toHaveBeenCalledTimes(3);
      expect(mockCallbacks.onJobComplete).toHaveBeenCalledTimes(3);

      // Verify jobs were processed in order
      expect(mockCallbacks.onJobStart).toHaveBeenNthCalledWith(1, job1, 0);
      expect(mockCallbacks.onJobStart).toHaveBeenNthCalledWith(2, job2, 1);
      expect(mockCallbacks.onJobStart).toHaveBeenNthCalledWith(3, job3, 2);

      // Verify progress tracking
      expect(progressTracker.completedChunks).toBe(3);
      expect(progressTracker.completedMods).toBe(3);

      // Verify all jobs completed
      [job1, job2, job3].forEach(job => {
        expect(job.status).toBe('completed');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle chunk translation failures', async () => {
      const job = createMockTranslationJob(mockModData.simpleMod.content, 'ja_jp');
      job.chunks = [{
        id: 'chunk_0',
        content: job.chunks[0].content,
        status: 'pending'
      }];

      mockTranslationService.setFailure(mockErrorScenarios.networkError);

      const options: RunTranslationJobsOptions = {
        jobs: [job],
        translationService: mockTranslationService as any,
        incrementCompletedChunks: () => { progressTracker.completedChunks++; },
        getOutputPath: () => '/test/output/path',
        getResultContent: () => ({}),
        writeOutput: mockCallbacks.writeOutput,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      // Job should be marked as failed but runner should continue
      expect(job.status).toBe('failed');
      expect(job.chunks[0].status).toBe('failed');
      expect(job.chunks[0].error).toContain('Network request failed');

      // Progress should still be incremented
      expect(progressTracker.completedChunks).toBe(1);
    });

    it('should handle output writing failures', async () => {
      const job = createMockTranslationJob(mockModData.simpleMod.content, 'ja_jp');
      job.chunks = [{
        id: 'chunk_0',
        content: job.chunks[0].content,
        status: 'pending'
      }];

      // Make writeOutput fail
      const writeOutputMock = jest.fn().mockRejectedValue(new Error('Write failed'));

      const options: RunTranslationJobsOptions = {
        jobs: [job],
        translationService: mockTranslationService as any,
        incrementCompletedChunks: () => { progressTracker.completedChunks++; },
        incrementCompletedMods: () => { progressTracker.completedMods++; },
        setCurrentJobId: (jobId) => { progressTracker.currentJobId = jobId; },
        getOutputPath: () => '/test/output/path',
        getResultContent: () => job.chunks[0].content,
        writeOutput: writeOutputMock,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      // Translation should succeed but output writing should fail
      expect(job.chunks[0].status).toBe('completed');
      expect(job.status).toBe('completed');
      expect(writeOutputMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Job Interruption', () => {
    it('should handle job interruption during prococessing', async () => {
      const job1 = createMockTranslationJob(mockModData.simpleMod.content, 'ja_jp', 'mod1.jar');
      const job2 = createMockTranslationJob(mockModData.specialMod.content, 'ja_jp', 'mod2.jar');

      // Ensure single chunks
      [job1, job2].forEach(job => {
        job.chunks = [{
          id: 'chunk_0',
          content: job.chunks[0].content,
          status: 'pending'
        }];
      });

      // Interrupt the first job
      mockTranslationService.interruptJob(job1.id);

      const options: RunTranslationJobsOptions = {
        jobs: [job1, job2],
        translationService: mockTranslationService as any,
        onJobInterrupted: mockCallbacks.onJobInterrupted,
        setCurrentJobId: (jobId) => { progressTracker.currentJobId = jobId; },
        incrementCompletedChunks: () => { progressTracker.completedChunks++; },
        getOutputPath: () => '/test/output/path',
        getResultContent: () => ({}),
        writeOutput: mockCallbacks.writeOutput,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      // First job should be interrupted
      expect(job1.status).toBe('interrupted');
      expect(mockCallbacks.onJobInterrupted).toHaveBeenCalledWith(job1, 0);

      // Second job should not be processed
      expect(job2.status).toBe('pending');
      expect(progressTracker.currentJobId).toBeNull();
    });

    it('should handle chunk-level interruption', async () => {
      const content = mockModData.complexMod.content;
      const job = createMockTranslationJob(content, 'ja_jp');
      
      // Create multiple chunks
      const chunkSize = 10;
      const entries = Object.entries(content);
      job.chunks = [];
      
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunkEntries = entries.slice(i, i + chunkSize);
        const chunkContent = Object.fromEntries(chunkEntries);
        
        job.chunks.push({
          id: `chunk_${job.chunks.length}`,
          content: chunkContent,
          status: 'pending'
        });
      }

      // Interrupt after first chunk
      let chunkCount = 0;
      mockTranslationService.translateChunk.mockImplementation(async (content, targetLanguage, jobId) => {
        chunkCount++;
        if (chunkCount === 2) {
          mockTranslationService.interruptJob(jobId);
        }
        return createMockTranslationResults(content, targetLanguage);
      });

      const options: RunTranslationJobsOptions = {
        jobs: [job],
        translationService: mockTranslationService as any,
        onJobInterrupted: mockCallbacks.onJobInterrupted,
        incrementCompletedChunks: () => { progressTracker.completedChunks++; },
        getOutputPath: () => '/test/output/path',
        getResultContent: () => ({}),
        writeOutput: mockCallbacks.writeOutput,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      expect(job.status).toBe('interrupted');
      expect(mockCallbacks.onJobInterrupted).toHaveBeenCalled();
      
      // Should have processed some but not all chunks
      const completedChunks = job.chunks.filter(chunk => chunk.status === 'completed').length;
      expect(completedChunks).toBeGreaterThan(0);
      expect(completedChunks).toBeLessThan(job.chunks.length);
    });
  });

  describe('Progress Tracking Integration', () => {
    it('should track chunk-level progress correctltly', async () => {
      const job1 = createMockTranslationJob(mockModData.simpleMod.content, 'ja_jp'); // 3 items, 1 chunk
      const job2 = createMockTranslationJob(mockModData.specialMod.content, 'ja_jp'); // 5 items, 1 chunk

      [job1, job2].forEach(job => {
        job.chunks = [{
          id: 'chunk_0',
          content: job.chunks[0].content,
          status: 'pending'
        }];
      });

      let chunkCount = 0;
      const progressHistory: number[] = [];

      const options: RunTranslationJobsOptions = {
        jobs: [job1, job2],
        translationService: mockTranslationService as any,
        incrementCompletedChunks: () => { 
          chunkCount++; 
          progressHistory.push(chunkCount);
        },
        incrementCompletedMods: () => { progressTracker.completedMods++; },
        getOutputPath: () => '/test/output/path',
        getResultContent: () => ({}),
        writeOutput: mockCallbacks.writeOutput,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      // Check that progress was incremented twice (one chunk per job)
      expect(progressHistory).toHaveLength(2);
      expect(chunkCount).toBe(2);
    });

    it('should track mod-level progress correctlyy', async () => {
      const jobs = [
        createMockTranslationJob(mockModData.simpleMod.content, 'ja_jp', 'mod1.jar'),
        createMockTranslationJob(mockModData.specialMod.content, 'ja_jp', 'mod2.jar'),
        createMockTranslationJob({ 'test': 'value' }, 'ja_jp', 'mod3.jar')
      ];

      jobs.forEach(job => {
        job.chunks = [{
          id: 'chunk_0',
          content: job.chunks[0].content,
          status: 'pending'
        }];
      });

      let modCount = 0;
      const modProgressHistory: number[] = [];

      const options: RunTranslationJobsOptions = {
        jobs,
        translationService: mockTranslationService as any,
        incrementCompletedChunks: () => { progressTracker.completedChunks++; },
        incrementCompletedMods: () => { 
          modCount++; 
          modProgressHistory.push(modCount);
        },
        getOutputPath: () => '/test/output/path',
        getResultContent: () => ({}),
        writeOutput: mockCallbacks.writeOutput,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      // Check that progress was incremented for all mods
      expect(modProgressHistory).toHaveLength(3);
      expect(modCount).toBe(3);
    });
  });

  describe('Result Generation', () => {
    it('should generate correct translation resultlts', async () => {
      const content = mockModData.simpleMod.content;
      const job = createMockTranslationJob(content, 'ja_jp', 'simple_mod.jar');
      job.chunks = [{
        id: 'chunk_0',
        content,
        status: 'pending'
      }];

      const capturedResults: TranslationResult[] = [];

      const options: RunTranslationJobsOptions = {
        jobs: [job],
        translationService: mockTranslationService as any,
        onResult: (result) => capturedResults.push(result),
        getOutputPath: () => '/test/output/simple_mod_ja_jp.json',
        getResultContent: () => content,
        writeOutput: mockCallbacks.writeOutput,
        targetLanguage: 'ja_jp',
        type: 'mod'
      };

      await runTranslationJobs(options);

      expect(capturedResults).toHaveLength(1);
      expect(capturedResults[0]).toMatchObject({
        type: 'mod',
        id: 'simple_mod.jar',
        targetLanguage: 'ja_jp',
        content,
        outputPath: '/test/output/simple_mod_ja_jp.json',
        success: true
      });
    });
  });
});