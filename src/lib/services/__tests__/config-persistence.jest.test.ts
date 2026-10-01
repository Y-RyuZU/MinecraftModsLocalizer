import { convertFromSnakeCase, convertToSnakeCase, migrateRetiredDefaultModel } from '../config-service';
import { DEFAULT_CONFIG, DEFAULT_MODELS } from '../../types/config';

test('settings retain API keys, prompts, zero values and disabled options across conversion', () => {
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as typeof DEFAULT_CONFIG;
  config.llm.apiKeys = { google: 'synthetic-google', openai: 'synthetic-openai' };
  config.llm.batchApiByProvider = { openai: true, anthropic: false, gemini: true };
  config.llm.temperature = 0;
  config.llm.maxRetries = 0;
  config.llm.systemPrompt = 'Custom system prompt';
  config.llm.userPrompt = '{{content}}';
  config.translation.skipExistingTranslations = false;
  config.translation.useTokenBasedChunking = true;
  config.update = { checkOnStartup: false, lastDismissedVersion: '3.0.0', lastCheckTime: 123 };
  expect(convertFromSnakeCase(convertToSnakeCase(config))).toEqual({ ...config, llm: { ...config.llm, apiKey: 'synthetic-openai', apiKeys: { openai: 'synthetic-openai', anthropic: '', gemini: 'synthetic-google' } } });
});

test('only retired built-in model defaults migrate', () => {
  for (const [provider, model] of [['google', 'gemini-1.5-flash'], ['anthropic', 'claude-3-5-haiku-20241022']] as const) {
    const llm = { ...DEFAULT_CONFIG.llm, provider, model };
    expect(migrateRetiredDefaultModel(llm).model).toBe(DEFAULT_MODELS[provider]);
    expect(migrateRetiredDefaultModel({ ...llm, baseUrl: 'https://example.invalid' }).model).toBe(model);
    expect(migrateRetiredDefaultModel({ ...llm, model: 'custom-model' }).model).toBe('custom-model');
  }
});

