import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { OpenAIAdapter } from '@/lib/adapters/openai-adapter';
import { TranslationRequest } from '@/lib/types/translation';
import OpenAI from 'openai';

// Mock OpenAI
vi.mock('openai', () => {
    const mockCreate = vi.fn();
    const MockOpenAI = vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: mockCreate
            }
        }
    }));
    return { default: MockOpenAI };
});

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}));

describe('OpenAIAdapter', () => {
    let adapter: OpenAIAdapter;
    let mockCreate: Mock;
    let mockInvoke: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Get mock functions
        const MockOpenAI = OpenAI as unknown as Mock;
        const mockInstance = new MockOpenAI();
        mockCreate = mockInstance.chat.completions.create;
        
        // Get invoke mock
        mockInvoke = vi.mocked(import('@tauri-apps/api/core').then(m => m.invoke));
    });

    describe('constructor', () => {
        it('should initialize with default config', () => {
            adapter = new OpenAIAdapter({
                apiKey: 'test-key'
            });

            expect(OpenAI).toHaveBeenCalledWith({
                apiKey: 'test-key',
                baseURL: undefined,
                dangerouslyAllowBrowser: true
            });
        });

        it('should use custom base URL', () => {
            adapter = new OpenAIAdapter({
                apiKey: 'test-key',
                baseUrl: 'https://custom.api.com'
            });

            expect(OpenAI).toHaveBeenCalledWith({
                apiKey: 'test-key',
                baseURL: 'https://custom.api.com',
                dangerouslyAllowBrowser: true
            });
        });
    });

    describe('translate', () => {
        beforeEach(() => {
            adapter = new OpenAIAdapter({
                apiKey: 'test-key',
                model: 'gpt-4'
            });
        });

        it('should successfully translate content', async () => {
            const request: TranslationRequest = {
                content: {
                    'item.minecraft.apple': 'Apple',
                    'item.minecraft.bread': 'Bread'
                },
                targetLanguage: 'ja_jp'
            };

            const mockResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'item.minecraft.apple: リンゴ\nitem.minecraft.bread: パン'
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 50,
                    completion_tokens: 30,
                    total_tokens: 80
                }
            };

            mockCreate.mockResolvedValueOnce(mockResponse);

            const result = await adapter.translate(request);

            expect(mockCreate).toHaveBeenCalledWith({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: expect.stringContaining('Minecraft game translator')
                    },
                    {
                        role: 'user',
                        content: expect.stringContaining('item.minecraft.apple: Apple')
                    }
                ],
                temperature: 0.3,
                user: 'minecraft-mod-localizer'
            });

            expect(result).toEqual({
                translatedContent: {
                    'item.minecraft.apple': 'リンゴ',
                    'item.minecraft.bread': 'パン'
                },
                tokensUsed: 80,
                timeMs: expect.any(Number)
            });
        });

        it('should use custom prompt template', async () => {
            const request: TranslationRequest = {
                content: {
                    'test.key': 'Test Value'
                },
                targetLanguage: 'ja_jp',
                promptTemplate: 'customPrompt'
            };

            const mockResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'test.key: テスト値'
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 20,
                    completion_tokens: 10,
                    total_tokens: 30
                }
            };

            mockCreate.mockResolvedValueOnce(mockResponse);

            const result = await adapter.translate(request);

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    messages: expect.arrayContaining([
                        expect.objectContaining({
                            role: 'user',
                            content: expect.stringContaining('customPrompt')
                        })
                    ])
                })
            );
        });

        it('should handle rate limit errors with retry', async () => {
            const request: TranslationRequest = {
                content: { 'test.key': 'Test' },
                targetLanguage: 'ja_jp'
            };

            const rateLimitError = new Error('Rate limit exceeded') as any;
            rateLimitError.status = 429;
            rateLimitError.headers = {
                get: (key: string) => key === 'retry-after' ? '2' : null
            };

            const mockResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'test.key: テスト'
                    },
                    finish_reason: 'stop'
                }],
                usage: { total_tokens: 20 }
            };

            mockCreate
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce(mockResponse);

            const result = await adapter.translate(request);

            expect(mockCreate).toHaveBeenCalledTimes(2);
            expect(result.translatedContent).toEqual({ 'test.key': 'テスト' });
        });

        it('should retry on temporary errors', async () => {
            const request: TranslationRequest = {
                content: { 'test.key': 'Test' },
                targetLanguage: 'ja_jp'
            };

            const mockResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'test.key: テスト'
                    },
                    finish_reason: 'stop'
                }],
                usage: { total_tokens: 20 }
            };

            mockCreate
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce(mockResponse);

            const result = await adapter.translate(request);

            expect(mockCreate).toHaveBeenCalledTimes(3);
            expect(result.translatedContent).toEqual({ 'test.key': 'テスト' });
        });

        it('should throw after max retries', async () => {
            const request: TranslationRequest = {
                content: { 'test.key': 'Test' },
                targetLanguage: 'ja_jp'
            };

            mockCreate.mockRejectedValue(new Error('Persistent error'));

            await expect(adapter.translate(request)).rejects.toThrow('Persistent error');
            expect(mockCreate).toHaveBeenCalledTimes(3); // Default max retries
        });

        it('should handle missing content in response', async () => {
            const request: TranslationRequest = {
                content: { 'test.key': 'Test' },
                targetLanguage: 'ja_jp'
            };

            const mockResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: null
                    },
                    finish_reason: 'stop'
                }],
                usage: { total_tokens: 20 }
            };

            mockCreate.mockResolvedValueOnce(mockResponse);

            await expect(adapter.translate(request)).rejects.toThrow('No content in response');
        });

        it('should parse response with various formats', async () => {
            const request: TranslationRequest = {
                content: {
                    'key1': 'Value 1',
                    'key2': 'Value 2',
                    'key3': 'Value 3'
                },
                targetLanguage: 'ja_jp'
            };

            // Test response with markdown formatting
            const mockResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: `Here are the translations:

\`\`\`
key1: 値1
key2: 値2
\`\`\`

And here's another one:
key3: 値3

That's all!`
                    },
                    finish_reason: 'stop'
                }],
                usage: { total_tokens: 50 }
            };

            mockCreate.mockResolvedValueOnce(mockResponse);

            const result = await adapter.translate(request);

            expect(result.translatedContent).toEqual({
                'key1': '値1',
                'key2': '値2',
                'key3': '値3'
            });
        });

        it('should handle response with extra whitespace', async () => {
            const request: TranslationRequest = {
                content: {
                    'test.key': 'Test'
                },
                targetLanguage: 'ja_jp'
            };

            const mockResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: '  test.key  :  テスト  '
                    },
                    finish_reason: 'stop'
                }],
                usage: { total_tokens: 20 }
            };

            mockCreate.mockResolvedValueOnce(mockResponse);

            const result = await adapter.translate(request);

            expect(result.translatedContent).toEqual({
                'test.key': 'テスト'
            });
        });

        it('should validate all keys are translated', async () => {
            const request: TranslationRequest = {
                content: {
                    'key1': 'Value 1',
                    'key2': 'Value 2'
                },
                targetLanguage: 'ja_jp'
            };

            const mockResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'key1: 値1' // Missing key2
                    },
                    finish_reason: 'stop'
                }],
                usage: { total_tokens: 20 }
            };

            mockCreate.mockResolvedValueOnce(mockResponse);

            await expect(adapter.translate(request)).rejects.toThrow('Missing translations for keys: key2');
        });
    });

    describe('cache behavior', () => {
        beforeEach(() => {
            adapter = new OpenAIAdapter({
                apiKey: 'test-key',
                model: 'gpt-4'
            });
        });

        it('should log cache information', async () => {
            const request: TranslationRequest = {
                content: { 'test.key': 'Test' },
                targetLanguage: 'ja_jp'
            };

            const mockResponse = {
                id: 'chatcmpl-123',
                object: 'chat.completion',
                created: 1234567890,
                model: 'gpt-4',
                system_fingerprint: 'fp_123abc',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'test.key: テスト'
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 20,
                    completion_tokens: 10,
                    total_tokens: 30,
                    prompt_tokens_details: {
                        cached_tokens: 15
                    }
                }
            };

            mockCreate.mockResolvedValueOnce(mockResponse);

            await adapter.translate(request);

            // Should log cache hit ratio
            expect(mockInvoke).toHaveBeenCalledWith(
                'log_api_cache_info',
                expect.objectContaining({
                    provider: 'OpenAI',
                    systemFingerprint: 'fp_123abc',
                    cachedTokens: 15,
                    totalPromptTokens: 20,
                    cacheHitRatio: 0.75
                })
            );
        });
    });

    describe('error handling edge cases', () => {
        beforeEach(() => {
            adapter = new OpenAIAdapter({
                apiKey: 'test-key',
                model: 'gpt-4'
            });
        });

        it('should handle invalid API key format', async () => {
            const request: TranslationRequest = {
                content: { 'test.key': 'Test' },
                targetLanguage: 'ja_jp'
            };

            const error = new Error('Invalid API key') as any;
            error.status = 401;

            mockCreate.mockRejectedValueOnce(error);

            await expect(adapter.translate(request)).rejects.toThrow('Invalid API key');
            expect(mockCreate).toHaveBeenCalledTimes(1); // No retry on auth errors
        });

        it('should handle model not found', async () => {
            const request: TranslationRequest = {
                content: { 'test.key': 'Test' },
                targetLanguage: 'ja_jp'
            };

            const error = new Error('Model not found') as any;
            error.status = 404;
            error.code = 'model_not_found';

            mockCreate.mockRejectedValueOnce(error);

            await expect(adapter.translate(request)).rejects.toThrow('Model not found');
        });
    });
});