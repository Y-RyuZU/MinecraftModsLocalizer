import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask, message } from '@tauri-apps/plugin-dialog';

export interface UpdateProgress {
  contentLength?: number;
  downloaded: number;
}

export interface UpdateResult {
  shouldUpdate: boolean;
  manifest?: any;
  error?: string;
}

export class TauriUpdateService {
  /**
   * Check for updates using Tauri's updater plugin
   */
  public static async checkForUpdates(): Promise<UpdateResult> {
    try {
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
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<void> {
    try {
      const update = await check();
      
      if (!update?.available) {
        throw new Error('No update available');
      }
      
      // Download and install the update
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            if (event.data.contentLength) {
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
            console.log(`Downloaded ${event.data.chunkLength} of ${event.data.contentLength || 'unknown'}`);
            if (onProgress) {
              onProgress({
                contentLength: event.data.contentLength,
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
        'Update has been installed. Would you like to restart the application now?',
        {
          title: 'Update Complete',
          kind: 'info',
          okLabel: 'Restart Now',
          cancelLabel: 'Later'
        }
      );
      
      if (shouldRestart) {
        await relaunch();
      }
    } catch (error) {
      console.error('Failed to download and install update:', error);
      await message(
        error instanceof Error ? error.message : 'Failed to install update',
        {
          title: 'Update Error',
          kind: 'error'
        }
      );
      throw error;
    }
  }
}