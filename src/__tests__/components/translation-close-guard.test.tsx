import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTranslationCloseGuard } from '@/lib/hooks/use-translation-close-guard';
import { useAppStore } from '@/lib/store';
const mock = vi.hoisted(() => ({ handler: undefined as undefined | ((event: {preventDefault: () => void}) => Promise<void>), destroy: vi.fn(), confirm: vi.fn(), stop: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ destroy: mock.destroy, onCloseRequested: vi.fn(async handler => { mock.handler = handler; return mock.stop; }) }) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ confirm: mock.confirm }));
vi.mock('@/lib/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => { vi.clearAllMocks(); useAppStore.setState({isTranslating: false}); });
describe('translation close protection', () => {
  it('leaves idle closure unchanged', async () => {
    const { unmount } = renderHook(useTranslationCloseGuard);
    await waitFor(() => expect(mock.handler).toBeDefined());
    const preventDefault = vi.fn(); await mock.handler!({preventDefault});
    expect(preventDefault).not.toHaveBeenCalled(); expect(mock.confirm).not.toHaveBeenCalled();
    unmount(); expect(mock.stop).toHaveBeenCalled();
  });
  it('keeps the window open when closing is declined', async () => {
    const { unmount } = renderHook(useTranslationCloseGuard);
    useAppStore.setState({isTranslating: true}); mock.confirm.mockResolvedValue(false);
    const preventDefault = vi.fn(); await mock.handler!({preventDefault});
    expect(preventDefault).toHaveBeenCalled(); expect(mock.destroy).not.toHaveBeenCalled(); unmount();
  });
  it('closes only after confirmation', async () => {
    const { unmount } = renderHook(useTranslationCloseGuard);
    useAppStore.setState({isTranslating: true}); mock.confirm.mockResolvedValue(true);
    await mock.handler!({preventDefault: vi.fn()}); expect(mock.destroy).toHaveBeenCalledOnce(); unmount();
  });
  it('blocks repeated close attempts while confirmation is open', async () => {
    const { unmount } = renderHook(useTranslationCloseGuard);
    useAppStore.setState({isTranslating: true});
    let resolve!: (value:boolean)=>void; mock.confirm.mockImplementation(() => new Promise<boolean>(r => {resolve=r;}));
    const pending = mock.handler!({preventDefault: vi.fn()});
    await mock.handler!({preventDefault: vi.fn()}); expect(mock.confirm).toHaveBeenCalledOnce();
    resolve(false); await pending; unmount();
  });
});
