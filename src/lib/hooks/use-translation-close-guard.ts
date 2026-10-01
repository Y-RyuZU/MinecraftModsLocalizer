import { useEffect } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '@/lib/store';
import { useAppTranslation } from '@/lib/i18n';

/** Protect an active translation from accidental window closure. */
export function useTranslationCloseGuard() {
  const { t } = useAppTranslation();
  useEffect(() => {
    let disposed = false;
    let asking = false;
    let unlisten: (() => void) | undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (useAppStore.getState().isTranslating) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    if (isTauri()) {
      const appWindow = getCurrentWindow();
      void appWindow.onCloseRequested(async event => {
        if (!useAppStore.getState().isTranslating) return;
        event.preventDefault();
        if (asking || disposed) return;
        asking = true;
        try {
          const close = await confirm(t('closeWarning.message'), {
            title: t('closeWarning.title'), kind: 'warning',
            okLabel: t('closeWarning.close'), cancelLabel: t('closeWarning.stay'),
          });
          if (close && !disposed) await appWindow.destroy();
        } catch (error) {
          // If confirmation fails, leave the translation running.
          console.error('Could not confirm window closure', error);
        } finally { asking = false; }
      }).then(stop => { if (disposed) stop(); else unlisten = stop; })
        .catch(error => console.error('Could not register close protection', error));
    } else {
      window.addEventListener('beforeunload', beforeUnload);
    }
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [t]);
}
