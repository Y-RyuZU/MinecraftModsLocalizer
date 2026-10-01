import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import { invoke } from '@tauri-apps/api/core';
import { OpenAIAdapter } from '@/lib/adapters/openai-adapter';
import { DEFAULT_MODELS } from '@/lib/constants/defaults';

const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', async importOriginal => {
  const actual = await importOriginal<typeof import('openai')>();
  const Client = vi.fn(function () { return { chat: { completions: { create: sdk.create } } }; });
  return { ...actual, default: Object.assign(Client, { APIError: actual.default.APIError }) };
});
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
const request = { content: { 'test.key': 'Test Value' }, targetLanguage: 'ja_jp' };
const response = (text = '{"test.key":"テスト値"}') => ({
  model: 'test-model', choices: [{ message: { content: text } }],
  usage: { total_tokens: 80, prompt_tokens: 50, prompt_tokens_details: { cached_tokens: 20 } }
});
const adapter = (overrides = {}) => new OpenAIAdapter({ provider: 'openai', apiKey: 'synthetic-key', maxRetries: 0, ...overrides });
beforeEach(() => { vi.clearAllMocks(); sdk.create.mockReset(); });
afterEach(() => vi.useRealTimers());

describe('OpenAIAdapter current JSON contract', () => {
  it('uses the default model and returns content with usage metadata', async () => {
    sdk.create.mockResolvedValue(response());
    const result = await adapter().translate(request);
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'synthetic-key', baseURL: undefined, maxRetries: 0, dangerouslyAllowBrowser: true });
    expect(sdk.create).toHaveBeenCalledWith(expect.objectContaining({
      model: DEFAULT_MODELS.openai,
      messages: [expect.objectContaining({ role: 'system' }), expect.objectContaining({ role: 'user', content: expect.stringContaining(JSON.stringify(request.content)) })]
    }));
    expect(result).toEqual({ content: { 'test.key': 'テスト値' }, metadata: { model: 'test-model', tokensUsed: 80, timeTaken: expect.any(Number) } });
  });
  it('uses the configured endpoint, model, temperature and prompt', async () => {
    sdk.create.mockResolvedValue(response());
    await adapter({ baseUrl: 'https://example.invalid', model: 'custom-model', temperature: 0, userPrompt: 'Translate {{content}} to {{targetLanguage}}' }).translate(request);
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://example.invalid' }));
    expect(sdk.create).toHaveBeenCalledWith(expect.objectContaining({ model: 'custom-model', temperature: 0,
      messages: expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining('Translate {"test.key":"Test Value"} to ja_jp') })]) }));
  });
  it('accepts JSON surrounded by whitespace', async () => {
    sdk.create.mockResolvedValue(response(' \n {"test.key":"テスト値"}\n '));
    expect((await adapter().translate(request)).content).toEqual({ 'test.key': 'テスト値' });
  });
  it.each(['not JSON', 'test.key: テスト値', '```json\n{"test.key":"値"}\n```', '["値"]', '{"test.key":42}'])('rejects malformed or non-contract output: %s', async text => {
    sdk.create.mockResolvedValue(response(text));
    await expect(adapter().translate(request)).rejects.toThrow();
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
  it('rejects an empty response', async () => {
    sdk.create.mockResolvedValue(response(''));
    await expect(adapter().translate(request)).rejects.toThrow('Empty response');
  });
  it.each([new Error('Network error'), new OpenAI.APIError(429, {}, 'Rate limit', new Headers())])('leaves retry policy to TranslationService: %s', async error => {
    sdk.create.mockRejectedValue(error);
    await expect(adapter({ maxRetries: 3 }).translate(request)).rejects.toBe(error);
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
  it.each(['Invalid API key', 'Model not found', 'Persistent error'])('surfaces API errors without losing their cause: %s', async message => {
    sdk.create.mockRejectedValue(new Error(message));
    await expect(adapter().translate(request)).rejects.toThrow(message);
  });
  it('logs cache usage', async () => {
    sdk.create.mockResolvedValue(response());
    await adapter().translate(request);
    expect(invoke).toHaveBeenCalledWith('log_api_request', { message: expect.stringContaining('cached=20') });
  });
});
