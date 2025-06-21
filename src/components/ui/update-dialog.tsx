import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './dialog';
import { Button } from './button';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { UpdateCheckResult, UpdateService } from '@/lib/services/update-service';
import { TauriUpdateService, UpdateProgress } from '@/lib/services/tauri-update-service';
import { useAppTranslation } from '@/lib/i18n';
import { Progress } from './progress';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: UpdateCheckResult;
}

export function UpdateDialog({ open, onOpenChange, updateInfo }: UpdateDialogProps) {
  const { t } = useAppTranslation();
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  
  const handleAutoUpdate = async () => {
    setIsUpdating(true);
    try {
      await TauriUpdateService.downloadAndInstall((progress) => {
        setUpdateProgress(progress);
      });
    } catch (error) {
      console.error("Failed to auto-update:", error);
      setIsUpdating(false);
      setUpdateProgress(null);
    }
  };
  
  const handleOpenDownloadPage = async () => {
    if (updateInfo.releaseUrl) {
      try {
        await UpdateService.openReleaseUrl(updateInfo.releaseUrl);
      } catch (error) {
        console.error("Failed to open download page:", error);
        // Fallback to window.open if Tauri fails
        if (typeof window !== 'undefined') {
          window.open(updateInfo.releaseUrl, '_blank');
        }
      }
    }
  };
  
  // Only show dialog if update is available
  if (!updateInfo.updateAvailable) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <DialogTitle>
              {t('update.title', 'Update Available')}
            </DialogTitle>
          </div>
          <DialogDescription className="mt-3">
            {t('update.description', 
              'A new version of MinecraftModsLocalizer is available for download.'
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4 space-y-4">
          {/* Version Information */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('update.currentVersion', 'Current version:')}
              </span>
              <span className="font-mono">v{updateInfo.currentVersion}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('update.latestVersion', 'Latest version:')}
              </span>
              <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                v{updateInfo.latestVersion}
              </span>
            </div>
          </div>
          
          {/* Release Notes */}
          {updateInfo.releaseNotes && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                {t('update.releaseNotes', 'Release Notes:')}
              </h4>
              <div className="text-sm max-h-64 overflow-y-auto p-4 bg-muted/30 rounded-md whitespace-pre-wrap">
                {updateInfo.releaseNotes}
              </div>
            </div>
          )}
          
          {/* Update Progress */}
          {isUpdating && updateProgress && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                {t('update.downloading', 'Downloading Update...')}
              </h4>
              <Progress 
                value={updateProgress.contentLength 
                  ? (updateProgress.downloaded / updateProgress.contentLength) * 100 
                  : 0
                } 
                className="w-full"
              />
              {updateProgress.contentLength && (
                <p className="text-xs text-muted-foreground text-center">
                  {Math.round(updateProgress.downloaded / 1024 / 1024)}MB / 
                  {Math.round(updateProgress.contentLength / 1024 / 1024)}MB
                </p>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex gap-2">
          {!isUpdating && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t('update.remindLater', 'Remind Me Later')}
              </Button>
              <Button
                variant="outline"
                onClick={handleOpenDownloadPage}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('update.manualDownload', 'Manual Download')}
              </Button>
              <Button
                onClick={handleAutoUpdate}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {t('update.installNow', 'Install Now')}
              </Button>
            </>
          )}
          {isUpdating && (
            <Button disabled className="w-full">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('update.installing', 'Installing Update...')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}