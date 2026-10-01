/** @jest-environment node */
import { invoke } from '@tauri-apps/api/core';
import { TranslationService } from '../translation-service';
import { runTranslationJobs } from '../translation-runner';
import { applyQuestTranslations, extractQuestText, filterExistingQuestTranslations } from '../quest-text';

jest.mock('@tauri-apps/api/core', () => ({ invoke: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../adapters/llm-adapter-factory', () => ({ LLMAdapterFactory: { getAdapter: () => ({ id: 'openai', getMaxChunkSize: () => 100 }) } }));
jest.mock('@/lib/store', () => ({ useAppStore: { getState: () => ({ profileDirectory: '/test/modpack' }) } }));

const source = '{ title: "Welcome", description: ["Collect stone"], tasks: [{ item: "minecraft:stone", count: 64 }] }';
const translations: Record<string, string> = { Welcome: 'ようこそ', 'Collect stone': '石を集めよう' };
let service: TranslationService;
beforeEach(() => {
  jest.clearAllMocks();
  service = new TranslationService({ llmConfig: { provider: 'openai', apiKey: 'synthetic' }, chunkSize: 1 });
  jest.spyOn(service, 'translateChunk').mockImplementation(async content => Object.fromEntries(Object.entries(content).map(([key, value]) => [key, translations[value] || value])));
});

async function run(content: Record<string, string>, writeOutput: (content: Record<string, string>) => Promise<void>) {
  const job = service.createJob(content, 'ja_jp', 'starter');
  const onResult = jest.fn();
  await runTranslationJobs({ jobs: [job], translationService: service, targetLanguage: 'ja_jp', type: 'ftb', sessionId: 'synthetic-session',
    getOutputPath: () => '/test/modpack/ja_jp.json', getResultContent: () => service.getCombinedTranslatedContent(job.id),
    writeOutput: async (_job, _path, translated) => writeOutput(translated), onResult });
  return { job, onResult };
}

test('writes a complete locale and records successful history with exact key counts', async () => {
  const write = jest.fn().mockResolvedValue(undefined);
  const { onResult } = await run({ 'quest.title': 'Welcome', 'quest.description': 'Collect stone' }, write);
  expect(write).toHaveBeenCalledWith({ 'quest.title': 'ようこそ', 'quest.description': '石を集めよう' });
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ success: true, sessionId: 'synthetic-session' }));
  expect(invoke).toHaveBeenCalledWith('batch_update_translation_summary', expect.objectContaining({
    entries: [expect.objectContaining({ translationType: 'ftb', status: 'completed', translatedKeys: 2, totalKeys: 2 })]
  }));
});

test('rebuilds direct SNBT using translated text while preserving item IDs and counts', async () => {
  const bundle = extractQuestText(source);
  const write = jest.fn().mockResolvedValue(undefined);
  await run(bundle.content, async content => write(applyQuestTranslations(source, bundle, content)));
  expect(write).toHaveBeenCalledWith('{ title: "ようこそ", description: ["石を集めよう"], tasks: [{ item: "minecraft:stone", count: 64 }] }');
});

test('does not write or report success when a translated quest key is missing', async () => {
  jest.mocked(service.translateChunk).mockResolvedValue({});
  const write = jest.fn();
  const { job, onResult } = await run({ title: 'Welcome' }, write);
  expect(job.status).toBe('failed');
  expect(write).not.toHaveBeenCalled();
  expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
});

test('skips an existing translated locale before submitting work', async () => {
  const target = { id: 'quests', name: 'en_us.json', path: '/test/modpack/kubejs/assets/kubejs/lang/en_us.json', type: 'ftb' as const, selected: true };
  const exists = jest.fn().mockResolvedValue(true);
  expect(await filterExistingQuestTranslations([target], 'ja_jp', exists)).toEqual([]);
  expect(exists).toHaveBeenCalledWith('/test/modpack/kubejs/assets/kubejs/lang/ja_jp.json');
});
