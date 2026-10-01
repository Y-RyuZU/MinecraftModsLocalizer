import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ModsTab } from '@/components/tabs/mods-tab';
import { TranslationTab, type TranslationTabProps } from '@/components/tabs/common/translation-tab';
import { FileService } from '@/lib/services/file-service';
import { runTranslationJobs } from '@/lib/services/translation-runner';
import { useAppStore } from '@/lib/store';
import { DEFAULT_CONFIG } from '@/lib/types/config';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@/components/tabs/common/translation-tab', () => ({ TranslationTab: vi.fn(() => null) }));
vi.mock('@/lib/services/file-service');
vi.mock('@/lib/services/translation-runner');
vi.mock('@/lib/store');
vi.mock('@/lib/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
let store: any;
let service: any;
const target = (id = 'testmod', name = 'Test Mod') => ({ type: 'mod' as const, id, name, path: `/minecraft/mods/${id}.jar`, selected: true });
function handlers() {
  render(<ModsTab />);
  return vi.mocked(TranslationTab).mock.calls.at(-1)![0] as TranslationTabProps;
}
async function translate(targets = [target()]) {
  await handlers().onTranslate(targets, 'ja_jp', service, vi.fn(), vi.fn(), '/minecraft', 'test-session');
}
beforeEach(() => {
  vi.clearAllMocks();
  store = { config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)), modTranslationTargets: [], isTranslating: false, progress: 0, wholeProgress: 0 };
  for (const name of ['setModTranslationTargets','updateModTranslationTarget','setTranslating','setProgress','setWholeProgress','setTotalChunks','setCompletedChunks','setTotalMods','setCompletedMods','incrementCompletedMods','incrementCompletedChunks','addTranslationResult','setError','setCurrentJobId','setCompletionDialogOpen','setLogDialogOpen','resetTranslationState','setScanning','setScanProgress','resetScanProgress']) store[name] = vi.fn();
  vi.mocked(useAppStore).mockReturnValue(store);
  vi.mocked(useAppStore.getState).mockReturnValue(store);
  vi.mocked(FileService.createResourcePack).mockResolvedValue('/minecraft/resourcepacks/test-pack');
  vi.mocked(FileService.getModFiles).mockResolvedValue(['/minecraft/mods/testmod.jar']);
  vi.mocked(FileService.invoke).mockImplementation(async command => {
    if (command === 'analyze_mod_jar') return { id: 'testmod', name: 'Test Mod', langFiles: ['en_us'] } as any;
    if (command === 'extract_lang_files') return [{ language: 'en_us', content: { 'item.test': 'Test Item' } }] as any;
    return false as any;
  });
  service = { createJob: vi.fn((content, language, name) => ({ id: name, chunks: [{ content }], targetLanguage: language })), getCombinedTranslatedContent: vi.fn() };
});

describe('ModsTab handlers', () => {
  it('scans the mods subdirectory and exposes language format and translation status', async () => {
    await handlers().onScan('/minecraft', 'ja_jp');
    expect(FileService.getModFiles).toHaveBeenCalledWith('/minecraft/mods');
    expect(store.setModTranslationTargets).toHaveBeenCalledWith([expect.objectContaining({ id: 'testmod', relativePath: 'testmod.jar', langFormat: 'json', hasExistingTranslation: false })]);
    expect(store.setScanning).toHaveBeenLastCalledWith(false);
  });
  it('handles a bad JAR without losing the scan cleanup', async () => {
    vi.mocked(FileService.invoke).mockRejectedValue(new Error('Invalid JAR'));
    await handlers().onScan('/minecraft');
    expect(store.setModTranslationTargets).toHaveBeenCalledWith([]);
    expect(store.resetScanProgress).toHaveBeenCalled();
  });
  it('passes real jobs to the shared translation runner', async () => {
    await translate();
    expect(runTranslationJobs).toHaveBeenCalledWith(expect.objectContaining({ jobs: [expect.objectContaining({ modId: 'testmod' })], targetLanguage: 'ja_jp', sessionId: 'test-session' }));
  });
  it('creates the resource pack before running translation', async () => {
    await translate();
    expect(FileService.createResourcePack).toHaveBeenCalled();
    expect(vi.mocked(FileService.createResourcePack).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(runTranslationJobs).mock.invocationCallOrder[0]);
  });
  it('does not create a pack or run jobs without English source files', async () => {
    vi.mocked(FileService.invoke).mockImplementation(async command => (command === 'extract_lang_files' ? [] : false) as any);
    await translate();
    expect(runTranslationJobs).not.toHaveBeenCalled();
    expect(FileService.createResourcePack).not.toHaveBeenCalled();
  });
  it('creates jobs in alphabetical name order', async () => {
    await translate([target('b', 'B Mod'), target('a', 'A Mod')]);
    expect(service.createJob.mock.calls.map((call: any[]) => call[2])).toEqual(['A Mod', 'B Mod']);
  });
  it('tracks completed files and chunks separately', async () => {
    await translate();
    expect(store.setTotalMods).toHaveBeenCalledWith(1);
    expect(runTranslationJobs).toHaveBeenCalledWith(expect.objectContaining({ incrementWholeProgress: store.incrementCompletedMods, incrementCompletedChunks: store.incrementCompletedChunks }));
  });
  it('logs scan failures with their path', async () => {
    vi.mocked(FileService.invoke).mockRejectedValue(new Error('Invalid JAR'));
    await handlers().onScan('/minecraft');
    expect(invoke).toHaveBeenCalledWith('log_error', expect.objectContaining({ processType: 'SCAN', message: expect.stringContaining('/minecraft/mods/testmod.jar') }));
  });
});
