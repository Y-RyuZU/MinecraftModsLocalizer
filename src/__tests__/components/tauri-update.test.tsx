import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { TauriUpdateService } from '@/lib/services/tauri-update-service';
import { UpdateDialog } from '@/components/ui/update-dialog';

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: vi.fn(), message: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));
vi.mock('@/lib/services/update-service', () => ({ UpdateService: { openReleaseUrl: vi.fn() } }));
vi.mock('@/lib/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));

describe('automatic update', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(ask).mockResolvedValue(false);
    vi.mocked(message).mockResolvedValue(undefined);
  });

  it('accumulates download chunks and allows a later restart', async () => {
    vi.mocked(check).mockResolvedValue({ available: true, downloadAndInstall: async (progress: (event: unknown) => void) => {
      progress({ event: 'Started', data: { contentLength: 100 } });
      progress({ event: 'Progress', data: { chunkLength: 30 } });
      progress({ event: 'Progress', data: { chunkLength: 70 } });
      progress({ event: 'Finished' });
    } } as unknown as NonNullable<Awaited<ReturnType<typeof check>>>);
    const progress = vi.fn();
    await TauriUpdateService.downloadAndInstall(progress);
    expect(progress.mock.calls.map(([event]) => event.downloaded)).toEqual([0, 30, 100]);
    expect(relaunch).not.toHaveBeenCalled();
  });

  it('closes the dialog and clears busy state after installing with restart later', async () => {
    vi.mocked(check).mockResolvedValue({ available: true, downloadAndInstall: vi.fn().mockResolvedValue(undefined) } as unknown as NonNullable<Awaited<ReturnType<typeof check>>>);
    const onOpenChange = vi.fn();
    render(<UpdateDialog open onOpenChange={onOpenChange} updateInfo={{ updateAvailable: true, currentVersion: '3.0.2', latestVersion: '3.0.3' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'update.installNow' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByText('update.installing')).not.toBeInTheDocument();
    expect(relaunch).not.toHaveBeenCalled();
  });

  it('reports a failed install and allows retry', async () => {
    vi.mocked(check).mockRejectedValue(new Error('network failed'));
    const onOpenChange = vi.fn();
    render(<UpdateDialog open onOpenChange={onOpenChange} updateInfo={{ updateAvailable: true, currentVersion: '3.0.2', latestVersion: '3.0.3' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'update.installNow' }));
    await waitFor(() => expect(message).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'update.installNow' })).toBeEnabled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
