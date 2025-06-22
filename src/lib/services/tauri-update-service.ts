import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask, message } from '@tauri-apps/plugin-dialog';

export interface UpdateProgress {
  contentLength?: number;
  downloaded: number;
}

export interface UpdateResult {
  shouldUpdate: boolean;
  manifest?: Record<string, unknown>;
  error?: string;
}

export class TauriUpdateService {
  /**
   * Check for updates using Tauri's updater plugin
   */
  public static async checkForUpdates(): Promise<UpdateResult> {
    try {
      // Check if we're in development mode
      if (typeof window !== 'undefined' && window.__TAURI_DEBUG__) {
        console.log('Skipping update check in development mode');
        return { shouldUpdate: false };
      }
      
      const update = await check();
      
      if (update?.available) {
        return {
          shouldUpdate: true,
          manifest: {
            version: update.version,
            date: update.date,
            body: update.body,
          }
        };
      }
      
      return { shouldUpdate: false };
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return {
        shouldUpdate: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Download and install update
   */
  public static async downloadAndInstall(
    onProgress?: (progress: UpdateProgress) => void,
    t?: (key: string, fallback: string) => string
  ): Promise<void> {
    try {
      // Check if we're in development mode
      if (typeof window !== 'undefined' && window.__TAURI_DEBUG__) {
        throw new Error(t?.('update.errors.devModeNotAvailable', 'Auto-update not available in development mode') || 'Auto-update not available in development mode');
      }
      
      const update = await check();
      
      if (!update?.available) {
        throw new Error(t?.('update.errors.noUpdateAvailable', 'No update available') || 'No update available');
      }
      
      // Download and install the update
      let totalContentLength = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            if (event.data.contentLength) {
              totalContentLength = event.data.contentLength;
              console.log(`Started downloading ${event.data.contentLength} bytes`);
            }
            if (onProgress) {
              onProgress({
                contentLength: event.data.contentLength,
                downloaded: 0
              });
            }
            break;
          case 'Progress':
            console.log(`Downloaded ${event.data.chunkLength} of ${totalContentLength || 'unknown'}`);
            if (onProgress) {
              onProgress({
                contentLength: totalContentLength,
                downloaded: event.data.chunkLength
              });
            }
            break;
          case 'Finished':
            console.log('Download finished');
            break;
        }
      });
      
      // Ask user to restart the app
      const shouldRestart = await ask(
        t?.('update.restartPrompt', 'Update has been installed. Would you like to restart the application now?') || 'Update has been installed. Would you like to restart the application now?',
        {
          title: t?.('update.updateComplete', 'Update Complete') || 'Update Complete',
          kind: 'info',
          okLabel: t?.('update.restartNow', 'Restart Now') || 'Restart Now',
          cancelLabel: t?.('update.restartLater', 'Later') || 'Later'
        }
      );
      
      if (shouldRestart) {
        await relaunch();
      }
    } catch (error) {
      console.error('Failed to download and install update:', error);
      await message(
        error instanceof Error ? error.message : (t?.('update.errors.installFailed', 'Failed to install update') || 'Failed to install update'),
        {
          title: t?.('update.errors.updateError', 'Update Error') || 'Update Error',
          kind: 'error'
        }
      );
      throw error;
    }
  }
}