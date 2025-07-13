import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { TranslationService } from '@/lib/services/translation-service';
import { LLMAdapterFactory } from '@/lib/adapters/llm-adapter-factory';

// Mock Tauri API
const mockInvoke = mock(() => Promise.resolve());
mock.module('@tauri-apps/api/core', () => ({
    invoke: mockInvoke
}));

describe('TranslationService', () => {
    let service: TranslationService;
    let mockAdapter: any;
    let mockTranslate: any;
    let originalGetAdapter: any;

    beforeEach(() => {
        // Setup mock adapter
        mockTranslate = mock();
        mockAdapter = {
            id: 'mock',
            name: 'Mock Adapter',
            translate: mockTranslate,
            getMaxChunkSize: () => 50
        };
        
        // Save original getAdapter
        originalGetAdapter = LLMAdapterFactory.getAdapter;
        // Set up default mock
        LLMAdapterFactory.getAdapter = () => mockAdapter;
    });
    
    afterEach(() => {
        // Restore original getAdapter
        LLMAdapterFactory.getAdapter = originalGetAdapter;
    });

    describe('createJob', () => {
        it('should create a translation job with proper structure', () => {
            
            service = new TranslationService({
                llmConfig: {
                    provider: 'mock',
                    apiKey: 'test-key',
                    model: 'test-model',
                    baseUrl: 'https://api.test.com'
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

            expect(job.id).toBeDefined();
            expect(job.status).toBe('pending');
            expect(job.progress).toBe(0);
            expect(job.targetLanguage).toBe('ja_jp');
            expect(job.currentFileName).toBe('test-file.json');
            expect(Array.isArray(job.chunks)).toBe(true);

            expect(job.chunks).toHaveLength(1);
            expect(job.chunks[0].id).toBeDefined();
            expect(job.chunks[0].content).toEqual(content);
            expect(job.chunks[0].status).toBe('pending');
        });

        it('should split content into multiple chunks when exceeding chunk size', () => {
            // LLMAdapterFactory is already mocked in beforeEach
            
            service = new TranslationService({
                llmConfig: {
                    provider: 'mock',
                    apiKey: 'test-key',
                    model: 'test-model'
                },
                chunkSize: 2,
                useTokenBasedChunking: false,
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
            // LLMAdapterFactory is already mocked in beforeEach
            
            service = new TranslationService({
                llmConfig: {
                    provider: 'mock',
                    apiKey: 'test-key',
                    model: 'test-model'
                },
                chunkSize: 50,
                maxRetries: 3,
            });
        });

        it('should successfully translate a chunk', async () => {
            const content = {
                'item.minecraft.apple': 'Apple',
                'item.minecraft.bread': 'Bread'
            };
            
            const expectedResponse = {
                content: {
                    'item.minecraft.apple': 'リンゴ',
                    'item.minecraft.bread': 'パン'
                },
                metadata: {
                    tokensUsed: 100,
                    timeTaken: 500
                }
            };

            mockAdapter.translate.mockResolvedValueOnce(expectedResponse);

            const result = await service.translateChunk(content, 'ja_jp', 'job-123');

            expect(mockAdapter.translate).toHaveBeenCalledWith({
                content,
                targetLanguage: 'ja_jp',
                promptTemplate: undefined
            });

            expect(result).toEqual(expectedResponse.content);
        });

        it('should retry on failure', async () => {
            const content = { 'test.key': 'Test Value' };
            
            // Set up mock to fail twice then succeed
            let callCount = 0;
            mockTranslate.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('Network error'));
                } else if (callCount === 2) {
                    return Promise.reject(new Error('Timeout'));
                } else {
                    return Promise.resolve({
                        content: { 'test.key': 'テスト値' },
                        metadata: { tokensUsed: 50, timeTaken: 300 }
                    });
                }
            });

            const result = await service.translateChunk(content, 'ja_jp', 'job-123');

            expect(mockTranslate).toHaveBeenCalledTimes(3);
            expect(result).toEqual({ 'test.key': 'テスト値' });
        });

        it('should not retry on API key error', async () => {
            const content = { 'test.key': 'Test Value' };
            
            mockTranslate.mockImplementation(() => {
                return Promise.reject(new Error('API key is not configured'));
            });

            let error: any;
            try {
                await service.translateChunk(content, 'ja_jp', 'job-123');
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect(error.message).toContain('API key is not configured or is invalid');
            expect(mockTranslate).toHaveBeenCalledTimes(1);
        });
    });

    describe('Token-based chunking', () => {
        it('should split content based on token estimation', () => {
            // LLMAdapterFactory is already mocked in beforeEach
            
            service = new TranslationService({
                llmConfig: {
                    provider: 'mock',
                    apiKey: 'test-key',
                    model: 'test-model'
                },
                useTokenBasedChunking: true,
                maxTokensPerChunk: 100,
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

    describe('Multiple translations', () => {
        it('should handle multiple translation calls', async () => {
            // LLMAdapterFactory is already mocked in beforeEach
            
            service = new TranslationService({
                llmConfig: {
                    provider: 'mock',
                    apiKey: 'test-key',
                    model: 'test-model'
                },
                chunkSize: 1,
            });

            const content1 = { 'key1': 'Value 1' };
            const content2 = { 'key2': 'Value 2' };

            mockTranslate.mockImplementation((request) => {
                const key = Object.keys(request.content)[0];
                return Promise.resolve({
                    content: { [key]: `${request.content[key]}の翻訳` },
                    metadata: { tokensUsed: 50, timeTaken: 200 }
                });
            });

            const result1 = await service.translateChunk(content1, 'ja_jp', 'job-1');
            const result2 = await service.translateChunk(content2, 'ja_jp', 'job-2');

            expect(result1).toEqual({ 'key1': 'Value 1の翻訳' });
            expect(result2).toEqual({ 'key2': 'Value 2の翻訳' });
            expect(mockTranslate).toHaveBeenCalledTimes(2);
        });
    });
});