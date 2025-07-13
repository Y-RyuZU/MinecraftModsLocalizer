import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { runTranslationJobs, RunTranslationJobsOptions } from '@/lib/services/translation-runner';
import { TranslationService, TranslationJob } from '@/lib/services/translation-service';
import { TranslationResult } from '@/lib/types/minecraft';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}));

describe('runTranslationJobs', () => {
    let mockTranslationService: {
        translateChunk: Mock;
        isJobInterrupted: Mock;
        getJob: Mock;
        getCombinedTranslatedContent: Mock;
    };
    
    let options: RunTranslationJobsOptions;
    let mockCallbacks: {
        onJobStart: Mock;
        onJobChunkComplete: Mock;
        onJobComplete: Mock;
        onJobInterrupted: Mock;
        onResult: Mock;
        setCurrentJobId: Mock;
        incrementCompletedChunks: Mock;
        incrementCompletedMods: Mock;
        getOutputPath: Mock;
        getResultContent: Mock;
        writeOutput: Mock;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup mock translation service
        mockTranslationService = {
            translateChunk: vi.fn(),
            isJobInterrupted: vi.fn().mockReturnValue(false),
            getJob: vi.fn(),
            getCombinedTranslatedContent: vi.fn()
        };

        // Setup mock callbacks
        mockCallbacks = {
            onJobStart: vi.fn(),
            onJobChunkComplete: vi.fn(),
            onJobComplete: vi.fn(),
            onJobInterrupted: vi.fn(),
            onResult: vi.fn(),
            setCurrentJobId: vi.fn(),
            incrementCompletedChunks: vi.fn(),
            incrementCompletedMods: vi.fn(),
            getOutputPath: vi.fn().mockReturnValue('/output/path'),
            getResultContent: vi.fn().mockReturnValue({ 'key': 'translated value' }),
            writeOutput: vi.fn()
        };

        // Setup default options
        options = {
            jobs: [],
            translationService: mockTranslationService as any,
            targetLanguage: 'ja_jp',
            type: 'mod',
            ...mockCallbacks
        };
    });

    describe('Basic job processing', () => {
        it('should process a single job with one chunk', async () => {
            const job: TranslationJob = {
                id: 'job-1',
                status: 'pending',
                progress: 0,
                totalChunks: 1,
                targetLanguage: 'ja_jp',
                chunks: [{
                    id: 'chunk-1',
                    content: { 'test.key': 'Test Value' },
                    status: 'pending'
                }],
                startTime: 0,
                endTime: 0
            };

            options.jobs = [job];
            
            mockTranslationService.translateChunk.mockResolvedValue({
                'test.key': 'テスト値'
            });

            await runTranslationJobs(options);

            // Verify job lifecycle
            expect(mockCallbacks.onJobStart).toHaveBeenCalledWith(job, 0);
            expect(mockCallbacks.setCurrentJobId).toHaveBeenCalledWith('job-1');
            expect(mockTranslationService.translateChunk).toHaveBeenCalledWith(
                { 'test.key': 'Test Value' },
                'ja_jp',
                'job-1'
            );
            expect(mockCallbacks.incrementCompletedChunks).toHaveBeenCalledTimes(1);
            expect(mockCallbacks.onJobComplete).toHaveBeenCalledWith(job, 0);
            expect(mockCallbacks.incrementCompletedMods).toHaveBeenCalledTimes(1);

            // Verify output
            expect(mockCallbacks.writeOutput).toHaveBeenCalledWith(
                job,
                '/output/path',
                { 'key': 'translated value' }
            );

            // Verify result
            expect(mockCallbacks.onResult).toHaveBeenCalledWith({
                type: 'mod',
                id: 'job-1',
                displayName: 'job-1',
                targetLanguage: 'ja_jp',
                content: { 'key': 'translated value' },
                outputPath: '/output/path',
                success: true
            });

            // Verify cleanup
            expect(mockCallbacks.setCurrentJobId).toHaveBeenLastCalledWith(null);
        });

        it('should process multiple jobs sequentially', async () => {
            const jobs: TranslationJob[] = [
                {
                    id: 'job-1',
                    status: 'pending',
                    progress: 0,
                    totalChunks: 1,
                    targetLanguage: 'ja_jp',
                    chunks: [{
                        id: 'chunk-1',
                        content: { 'key1': 'Value 1' },
                        status: 'pending'
                    }],
                    startTime: 0,
                    endTime: 0
                },
                {
                    id: 'job-2',
                    status: 'pending',
                    progress: 0,
                    totalChunks: 1,
                    targetLanguage: 'ja_jp',
                    chunks: [{
                        id: 'chunk-2',
                        content: { 'key2': 'Value 2' },
                        status: 'pending'
                    }],
                    startTime: 0,
                    endTime: 0
                }
            ];

            options.jobs = jobs;
            
            mockTranslationService.translateChunk
                .mockResolvedValueOnce({ 'key1': '値1' })
                .mockResolvedValueOnce({ 'key2': '値2' });

            await runTranslationJobs(options);

            expect(mockCallbacks.onJobStart).toHaveBeenCalledTimes(2);
            expect(mockCallbacks.onJobComplete).toHaveBeenCalledTimes(2);
            expect(mockTranslationService.translateChunk).toHaveBeenCalledTimes(2);
        });
    });

    describe('Multi-chunk processing', () => {
        it('should process all chunks in a job', async () => {
            const job: TranslationJob = {
                id: 'job-1',
                status: 'pending',
                progress: 0,
                totalChunks: 3,
                targetLanguage: 'ja_jp',
                chunks: [
                    {
                        id: 'chunk-1',
                        content: { 'key1': 'Value 1' },
                        status: 'pending'
                    },
                    {
                        id: 'chunk-2',
                        content: { 'key2': 'Value 2' },
                        status: 'pending'
                    },
                    {
                        id: 'chunk-3',
                        content: { 'key3': 'Value 3' },
                        status: 'pending'
                    }
                ],
                startTime: 0,
                endTime: 0
            };

            options.jobs = [job];
            
            mockTranslationService.translateChunk
                .mockResolvedValueOnce({ 'key1': '値1' })
                .mockResolvedValueOnce({ 'key2': '値2' })
                .mockResolvedValueOnce({ 'key3': '値3' });

            await runTranslationJobs(options);

            expect(mockTranslationService.translateChunk).toHaveBeenCalledTimes(3);
            expect(mockCallbacks.incrementCompletedChunks).toHaveBeenCalledTimes(3);
            expect(mockCallbacks.onJobChunkComplete).toHaveBeenCalledTimes(3);
            
            // Verify all chunks are marked as completed
            expect(job.chunks[0].status).toBe('completed');
            expect(job.chunks[1].status).toBe('completed');
            expect(job.chunks[2].status).toBe('completed');
            expect(job.chunks[0].translatedContent).toEqual({ 'key1': '値1' });
            expect(job.chunks[1].translatedContent).toEqual({ 'key2': '値2' });
            expect(job.chunks[2].translatedContent).toEqual({ 'key3': '値3' });
        });
    });

    describe('Cancellation handling', () => {
        it('should stop processing when job is interrupted', async () => {
            const job: TranslationJob = {
                id: 'job-1',
                status: 'pending',
                progress: 0,
                totalChunks: 3,
                targetLanguage: 'ja_jp',
                chunks: [
                    {
                        id: 'chunk-1',
                        content: { 'key1': 'Value 1' },
                        status: 'pending'
                    },
                    {
                        id: 'chunk-2',
                        content: { 'key2': 'Value 2' },
                        status: 'pending'
                    },
                    {
                        id: 'chunk-3',
                        content: { 'key3': 'Value 3' },
                        status: 'pending'
                    }
                ],
                startTime: 0,
                endTime: 0
            };

            options.jobs = [job];
            
            // Simulate interruption after first chunk
            mockTranslationService.isJobInterrupted
                .mockReturnValueOnce(false)  // First check before chunk 1
                .mockReturnValueOnce(true);   // Second check before chunk 2

            mockTranslationService.translateChunk
                .mockResolvedValueOnce({ 'key1': '値1' });

            await runTranslationJobs(options);

            // Should only process first chunk
            expect(mockTranslationService.translateChunk).toHaveBeenCalledTimes(1);
            expect(mockCallbacks.incrementCompletedChunks).toHaveBeenCalledTimes(1);
            
            // Should call interrupted callback
            expect(mockCallbacks.onJobInterrupted).toHaveBeenCalledWith(job, 0);
            expect(job.status).toBe('interrupted');
            
            // Should not call complete callback
            expect(mockCallbacks.onJobComplete).not.toHaveBeenCalled();
            
            // Should not process output
            expect(mockCallbacks.writeOutput).not.toHaveBeenCalled();
            expect(mockCallbacks.onResult).not.toHaveBeenCalled();
        });

        it('should not process subsequent jobs after interruption', async () => {
            const jobs: TranslationJob[] = [
                {
                    id: 'job-1',
                    status: 'pending',
                    progress: 0,
                    totalChunks: 1,
                    targetLanguage: 'ja_jp',
                    chunks: [{
                        id: 'chunk-1',
                        content: { 'key1': 'Value 1' },
                        status: 'pending'
                    }],
                    startTime: 0,
                    endTime: 0
                },
                {
                    id: 'job-2',
                    status: 'pending',
                    progress: 0,
                    totalChunks: 1,
                    targetLanguage: 'ja_jp',
                    chunks: [{
                        id: 'chunk-2',
                        content: { 'key2': 'Value 2' },
                        status: 'pending'
                    }],
                    startTime: 0,
                    endTime: 0
                }
            ];

            options.jobs = jobs;
            
            // Interrupt during first job
            mockTranslationService.isJobInterrupted.mockReturnValue(true);

            await runTranslationJobs(options);

            // Should only start first job
            expect(mockCallbacks.onJobStart).toHaveBeenCalledTimes(1);
            expect(mockCallbacks.onJobStart).toHaveBeenCalledWith(jobs[0], 0);
            
            // Should not start second job
            expect(mockCallbacks.setCurrentJobId).not.toHaveBeenCalledWith('job-2');
        });
    });

    describe('Error handling', () => {
        it('should mark chunk as failed on translation error', async () => {
            const job: TranslationJob = {
                id: 'job-1',
                status: 'pending',
                progress: 0,
                totalChunks: 2,
                targetLanguage: 'ja_jp',
                chunks: [
                    {
                        id: 'chunk-1',
                        content: { 'key1': 'Value 1' },
                        status: 'pending'
                    },
                    {
                        id: 'chunk-2',
                        content: { 'key2': 'Value 2' },
                        status: 'pending'
                    }
                ],
                startTime: 0,
                endTime: 0
            };

            options.jobs = [job];
            
            mockTranslationService.translateChunk
                .mockRejectedValueOnce(new Error('Translation API error'))
                .mockResolvedValueOnce({ 'key2': '値2' });

            await runTranslationJobs(options);

            // Should continue processing despite error
            expect(mockTranslationService.translateChunk).toHaveBeenCalledTimes(2);
            
            // First chunk should be failed
            expect(job.chunks[0].status).toBe('failed');
            expect(job.chunks[0].error).toBe('Translation API error');
            
            // Second chunk should be successful
            expect(job.chunks[1].status).toBe('completed');
            
            // Job should be marked as failed overall
            expect(job.status).toBe('failed');
            
            // Should still create result but with success: false
            expect(mockCallbacks.onResult).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false
                })
            );
        });

        it('should handle write output failure', async () => {
            const job: TranslationJob = {
                id: 'job-1',
                status: 'pending',
                progress: 0,
                totalChunks: 1,
                targetLanguage: 'ja_jp',
                chunks: [{
                    id: 'chunk-1',
                    content: { 'key1': 'Value 1' },
                    status: 'pending'
                }],
                startTime: 0,
                endTime: 0
            };

            options.jobs = [job];
            
            mockTranslationService.translateChunk.mockResolvedValue({ 'key1': '値1' });
            mockCallbacks.writeOutput.mockRejectedValue(new Error('Write failed'));

            await runTranslationJobs(options);

            // Should handle write error gracefully
            expect(mockCallbacks.writeOutput).toHaveBeenCalled();
            
            // Should still report result but with success: false
            expect(mockCallbacks.onResult).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false
                })
            );
        });
    });

    describe('Progress tracking', () => {
        it('should update progress correctly for single job', async () => {
            const job: TranslationJob = {
                id: 'job-1',
                status: 'pending',
                progress: 0,
                totalChunks: 1,
                targetLanguage: 'ja_jp',
                currentFileName: 'test-mod.jar',
                chunks: [{
                    id: 'chunk-1',
                    content: { 'key1': 'Value 1' },
                    status: 'pending'
                }],
                startTime: 0,
                endTime: 0
            };

            options.jobs = [job];
            
            mockTranslationService.translateChunk.mockResolvedValue({ 'key1': '値1' });

            await runTranslationJobs(options);

            // Should use mod name for mod type
            expect(mockCallbacks.onResult).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'test-mod.jar',
                    displayName: 'test-mod.jar'
                })
            );
        });

        it('should call progress callbacks appropriately', async () => {
            const job: TranslationJob = {
                id: 'job-1',
                status: 'pending',
                progress: 0,
                totalChunks: 2,
                targetLanguage: 'ja_jp',
                chunks: [
                    {
                        id: 'chunk-1',
                        content: { 'key1': 'Value 1' },
                        status: 'pending'
                    },
                    {
                        id: 'chunk-2',
                        content: { 'key2': 'Value 2' },
                        status: 'pending'
                    }
                ],
                startTime: 0,
                endTime: 0
            };

            options.jobs = [job];
            options.incrementCompletedMods = undefined; // Test without mod tracking
            
            mockTranslationService.translateChunk
                .mockResolvedValueOnce({ 'key1': '値1' })
                .mockResolvedValueOnce({ 'key2': '値2' });

            await runTranslationJobs(options);

            // Should increment chunks but not mods
            expect(mockCallbacks.incrementCompletedChunks).toHaveBeenCalledTimes(2);
        });
    });
});