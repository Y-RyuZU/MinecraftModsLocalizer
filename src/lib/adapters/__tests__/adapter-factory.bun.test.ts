import { expect, test } from 'bun:test';
import { LLMAdapterFactory } from '../llm-adapter-factory';
import { GeminiAdapter } from '../gemini-adapter';
import type { LLMConfig } from '../../types/llm';

test('Google settings resolve to Gemini and updated credentials are never taken from a cached adapter', () => {
  const first = LLMAdapterFactory.getAdapter({ provider: 'google', apiKey: 'synthetic-old', model: 'old-model' });
  const second = LLMAdapterFactory.getAdapter({ provider: 'google', apiKey: 'synthetic-new', model: 'new-model' });
  expect(first).toBeInstanceOf(GeminiAdapter);
  expect(second).not.toBe(first);
  expect((second as unknown as { config: LLMConfig }).config).toMatchObject({ apiKey: 'synthetic-new', model: 'new-model' });
  expect(LLMAdapterFactory.getAdapter({ provider: 'gemini', apiKey: '' })).toBeInstanceOf(GeminiAdapter);
  expect(() => LLMAdapterFactory.getAdapter({ provider: 'unknown', apiKey: '' })).toThrow('Unsupported');
});
