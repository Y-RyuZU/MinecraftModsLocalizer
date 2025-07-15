import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { TranslationService } from '@/lib/services/translation-service';
import { OpenAIAdapter } from '@/lib/adapters/openai-adapter';
import { AnthropicAdapter } from '@/lib/adapters/anthropic-adapter';
import { TranslationRequest, TranslationResponse } from '@/lib/types/translation';

// Mock the adapters
vi.mock('@/lib/adapters/openai-adapter');
vi.mock('@/lib/adapters/anthropic-adapter');

describe('TranslationService', () => {
    let service: TranslationService;
    let mockAdapter: {
        translate: Mock;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Setup mock adapter
        mockAdapter = {
            translate: vi.fn()
        };
        
        // Mock the adapter constructors
        (OpenAIAdapter as any).mockImplementation(() => ({
            ...mockAdapter,
            id: 'openai',
            name: 'OpenAI',
            getMaxChunkSize: () => 50
        }));
        (AnthropicAdapter as any).mockImplementation(() => ({
            ...mockAdapter,
            id: 'anthropic',
            name: 'Anthropic',
            getMaxChunkSize: () => 50
        }));
    });

    describe('createJob', () => {
        it('should create a translation job with proper structure', () => {
            service = new TranslationService({
                llmConfig: {
                    provider: 'openai',
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    baseUrl: 'https://api.openai.com'
                },
                chunkSize: 50,
                useTokenBasedChunking: false
            });

            const content = {
                'item.minecraft.apple': 'Apple',
                'item.minecraft.bread': 'Bread',
                'item.minecraft.carrot': 'Carrot'
            };

            const job = service.createJob(content, 'ja_jp', 'test-file.json');

            expect(job).toMatchObject({
                id: expect.any(String),
                status: 'pending',
                progress: 0,
                totalChunks: 1,
                targetLanguage: 'ja_jp',
                currentFileName: 'test-file.json',
                chunks: expect.any(Array)
            });

            expect(job.chunks).toHaveLength(1);
            expect(job.chunks[0]).toMatchObject({
                id: expect.any(String),
                content: content,
                status: 'pending'
            });
        });

        it('should split content into multiple chunks when exceeding chunk size', () => {
            service = new TranslationService({
                llmConfig: {
                    provider: 'openai',
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    baseUrl: 'https://api.openai.com'
                },
                chunkSize: 2,
                useTokenBasedChunking: false
            });

            const content: Record<string, string> = {};
            for (let i = 0; i < 5; i++) {
                content[`key${i}`] = `value${i}`;
            }

            const job = service.createJob(content, 'ja_jp');

            expect(job.chunks).toHaveLength(3); // 5 items / 2 per chunk = 3 chunks
            expect(Object.keys(job.chunks[0].content)).toHaveLength(2);
            expect(Object.keys(job.chunks[1].content)).toHaveLength(2);
            expect(Object.keys(job.chunks[2].content)).toHaveLength(1);
        });
    });

    describe('translateChunk', () => {
        beforeEach(() => {
            service = new TranslationService({
                llmConfig: {
                    provider: 'openai',
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    baseUrl: 'https://api.openai.com'
                },
                chunkSize: 50,
                maxRetries: 3
            });
        });

        it('should successfully translate a chunk', async () => {
            const content = {
                'item.minecraft.apple': 'Apple',
                'item.minecraft.bread': 'Bread'
            };
            
            const expectedResponse: TranslationResponse = {
                translatedContent: {
                    'item.minecraft.apple': 'リンゴ',
                    'item.minecraft.bread': 'パン'
                },
                tokensUsed: 100,
                timeMs: 500
            };

            mockAdapter.translate.mockResolvedValueOnce(expectedResponse);

            const result = await service.translateChunk(content, 'ja_jp', 'job-123');

            expect(mockAdapter.translate).toHaveBeenCalledWith({
                content,
                targetLanguage: 'ja_jp',
                promptTemplate: undefined
            });

            expect(result).toEqual(expectedResponse.translatedContent);
        });

        it('should retry on failure', async () => {
            const content = { 'test.key': 'Test Value' };
            
            mockAdapter.translate
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce({
                    translatedContent: { 'test.key': 'テスト値' },
                    tokensUsed: 50,
                    timeMs: 300
                });

            const result = await service.translateChunk(content, 'ja_jp', 'job-123');

            expect(mockAdapter.translate).toHaveBeenCalledTimes(3);
            expect(result).toEqual({ 'test.key': 'テスト値' });
        });

        it('should not retry on API key error', async () => {
            const content = { 'test.key': 'Test Value' };
            
            mockAdapter.translate.mockRejectedValueOnce(
                new Error('Invalid API key')
            );

            await expect(
                service.translateChunk(content, 'ja_jp', 'job-123')
            ).rejects.toThrow('Invalid API key');

            expect(mockAdapter.translate).toHaveBeenCalledTimes(1);
        });

        it('should handle job interruption', async () => {
            const content = { 'test.key': 'Test Value' };
            const jobId = 'job-123';
            
            // Create a job first
            service.createJob(content, 'ja_jp');
            
            // Interrupt the job
            service.interruptJob(jobId);

            await expect(
                service.translateChunk(content, 'ja_jp', jobId)
            ).rejects.toThrow('Job interrupted');

            expect(mockAdapter.translate).not.toHaveBeenCalled();
        });
    });

    describe('startJob', () => {
        it('should process all chunks in a job', async () => {
            service = new TranslationService({
                llmConfig: {
                    provider: 'openai',
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    baseUrl: 'https://api.openai.com'
                },
                chunkSize: 2,
                onProgress: vi.fn()
            });

            const content = {
                'key1': 'Value 1',
                'key2': 'Value 2',
                'key3': 'Value 3'
            };

            const job = service.createJob(content, 'ja_jp');

            mockAdapter.translate
                .mockResolvedValueOnce({
                    translatedContent: { 'key1': '値1', 'key2': '値2' },
                    tokensUsed: 50,
                    timeMs: 200
                })
                .mockResolvedValueOnce({
                    translatedContent: { 'key3': '値3' },
                    tokensUsed: 30,
                    timeMs: 150
                });

            await service.startJob(job.id);

            const updatedJob = service.getJob(job.id);
            expect(updatedJob?.status).toBe('completed');
            expect(updatedJob?.progress).toBe(100);
            
            const combinedContent = service.getCombinedTranslatedContent(job.id);
            expect(combinedContent).toEqual({
                'key1': '値1',
                'key2': '値2',
                'key3': '値3'
            });
        });

        it('should update progress during translation', async () => {
            const onProgress = vi.fn();
            
            service = new TranslationService({
                llmConfig: {
                    provider: 'openai',
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    baseUrl: 'https://api.openai.com'
                },
                chunkSize: 1,
                onProgress
            });

            const content = {
                'key1': 'Value 1',
                'key2': 'Value 2'
            };

            const job = service.createJob(content, 'ja_jp');

            mockAdapter.translate.mockImplementation(async () => {
                return {
                    translatedContent: { 'key': '値' },
                    tokensUsed: 50,
                    timeMs: 200
                };
            });

            await service.startJob(job.id);

            // Progress should be called for each chunk completion
            expect(onProgress).toHaveBeenCalledTimes(2);
            expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
                id: job.id,
                progress: 50
            }));
            expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
                id: job.id,
                progress: 100
            }));
        });
    });

    describe('Token-based chunking', () => {
        it('should split content based on token estimation', () => {
            service = new TranslationService({
                llmConfig: {
                    provider: 'openai',
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    baseUrl: 'https://api.openai.com'
                },
                useTokenBasedChunking: true,
                maxTokensPerChunk: 100
            });

            const content: Record<string, string> = {};
            // Create entries with different token sizes
            content['short'] = 'Hi'; // ~5 tokens
            content['medium'] = 'This is a medium length text that should take more tokens'; // ~50 tokens
            content['long'] = 'This is a very long text that contains many words and should definitely exceed our token limit when combined with other entries in the same chunk'; // ~100 tokens

            const job = service.createJob(content, 'ja_jp');

            // Should create multiple chunks due to token limits
            expect(job.chunks.length).toBeGreaterThan(1);
            
            // Verify no chunk exceeds token limit
            job.chunks.forEach(chunk => {
                const estimatedTokens = Object.entries(chunk.content)
                    .reduce((sum, [key, value]) => sum + Math.ceil((key.length + value.length) / 3), 0);
                expect(estimatedTokens).toBeLessThanOrEqual(150); // Allow some overhead
            });
        });
    });

    describe('Error handling and recovery', () => {
        it('should mark chunk as failed on translation error', async () => {
            service = new TranslationService({
                llmConfig: {
                    provider: 'openai',
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    baseUrl: 'https://api.openai.com'
                },
                maxRetries: 1
            });

            const content = { 'test.key': 'Test Value' };
            const job = service.createJob(content, 'ja_jp');

            mockAdapter.translate.mockRejectedValue(new Error('Translation failed'));

            await service.startJob(job.id);

            const updatedJob = service.getJob(job.id);
            expect(updatedJob?.status).toBe('failed');
            expect(updatedJob?.chunks[0].status).toBe('failed');
            expect(updatedJob?.chunks[0].error).toBe('Translation failed');
        });
    });

    describe('API call counting', () => {
        it('should track API call counts', async () => {
            service = new TranslationService({
                llmConfig: {
                    provider: 'openai',
                    apiKey: 'test-key',
                    model: 'gpt-4',
                    baseUrl: 'https://api.openai.com'
                },
                chunkSize: 1
            });

            const content = {
                'key1': 'Value 1',
                'key2': 'Value 2'
            };

            mockAdapter.translate.mockResolvedValue({
                translatedContent: { 'key': '値' },
                tokensUsed: 50,
                timeMs: 200
            });

            await service.translateChunk(content['key1'], 'ja_jp', 'job-1');
            await service.translateChunk(content['key2'], 'ja_jp', 'job-2');

            expect(service.getApiCallCount()).toBe(2);
        });
    });
});