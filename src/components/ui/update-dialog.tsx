import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './dialog';
import { Button } from './button';
import { AlertTriangle } from 'lucide-react';
import { UpdateCheckResult, UpdateService } from '@/lib/services/update-service';
import { ConfigService } from '@/lib/services/config-service';
import { useAppStore } from '@/lib/store';
import { useAppTranslation } from '@/lib/i18n';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: UpdateCheckResult;
}

export function UpdateDialog({ open, onOpenChange, updateInfo }: UpdateDialogProps) {
  const { t } = useAppTranslation();
  const { config, setConfig } = useAppStore();
  
  const handleViewRelease = async () => {
    if (updateInfo.releaseUrl) {
      await UpdateService.openReleaseUrl(updateInfo.releaseUrl);
      onOpenChange(false);
    }
  };
  
  const handleRemindLater = async () => {
    // Save the dismissed version to config
    const updatedConfig = {
      ...config,
      update: {
        ...config.update,
        lastDismissedVersion: updateInfo.latestVersion
      }
    };
    
    try {
      await ConfigService.save(updatedConfig);
      setConfig(updatedConfig);
    } catch (error) {
      console.error("Failed to save dismissed version:", error);
    }
    
    onOpenChange(false);
  };
  
  // Only show dialog if update is available
  if (!updateInfo.updateAvailable) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
        
        <div className="my-4 space-y-2">
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
        
        {updateInfo.releaseNotes && (
          <div className="my-4">
            <h4 className="text-sm font-medium mb-2">
              {t('update.releaseNotes', 'Release Notes:')}
            </h4>
            <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto p-3 bg-muted/50 rounded-md">
              {updateInfo.releaseNotes}
            </div>
          </div>
        )}
        
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRemindLater}
          >
            {t('update.remindLater', 'Remind Me Later')}
          </Button>
          <Button
            onClick={handleViewRelease}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {t('update.viewRelease', 'View Release')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}