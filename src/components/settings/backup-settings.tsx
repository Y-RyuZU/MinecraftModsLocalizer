"use client";

import { useAppTranslation } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HardDrive, Trash2, Database } from "lucide-react";
import { type AppConfig } from "@/lib/types/config";
import { useState, useEffect } from "react";
import { backupService } from "@/lib/services/backup-service";

interface BackupSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

export function BackupSettings({ config, setConfig }: BackupSettingsProps) {
  const { t } = useAppTranslation();
  const [storageSize, setStorageSize] = useState<number>(0);
  const [isPruning, setIsPruning] = useState(false);

  // Load storage size on mount
  useEffect(() => {
    const loadStorageSize = async () => {
      try {
        const size = await backupService.getBackupStorageSize();
        setStorageSize(size);
      } catch (error) {
        console.error('Failed to load backup storage size:', error);
      }
    };
    
    loadStorageSize();
  }, []);

  const formatSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleToggleBackup = (enabled: boolean) => {
    setConfig({
      ...config,
      backup: {
        ...config.backup,
        enabled
      }
    });
  };

  const handleRetentionDaysChange = (value: string) => {
    const retentionDays = parseInt(value) || 0;
    setConfig({
      ...config,
      backup: {
        ...config.backup,
        retentionDays
      }
    });
  };

  const handleMaxBackupsChange = (value: string) => {
    const maxBackupsPerType = parseInt(value) || 0;
    setConfig({
      ...config,
      backup: {
        ...config.backup,
        maxBackupsPerType
      }
    });
  };

  const handleAutoPruneToggle = (autoPruneOnStartup: boolean) => {
    setConfig({
      ...config,
      backup: {
        ...config.backup,
        autoPruneOnStartup
      }
    });
  };

  const handlePruneNow = async () => {
    try {
      setIsPruning(true);
      const deletedCount = await backupService.pruneOldBackups(config.backup?.retentionDays || 30);
      
      // Refresh storage size
      const newSize = await backupService.getBackupStorageSize();
      setStorageSize(newSize);
      
      console.log(`Pruned ${deletedCount} old backups`);
    } catch (error) {
      console.error('Failed to prune backups:', error);
    } finally {
      setIsPruning(false);
    }
  };

  // Ensure backup config exists
  const backupConfig = config.backup || {
    enabled: true,
    retentionDays: 30,
    maxBackupsPerType: 10,
    autoPruneOnStartup: false
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <HardDrive className="h-5 w-5" />
          <span>{t('settings.backup.title', 'Backup Settings')}</span>
        </CardTitle>
        <CardDescription>
          {t('settings.backup.description', 'Configure automatic backup of translation files')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Backup */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="backup-enabled">
              {t('settings.backup.enabled', 'Enable Automatic Backup')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('settings.backup.enabledDescription', 'Create backups before overwriting translation files')}
            </p>
          </div>
          <Switch
            id="backup-enabled"
            checked={backupConfig.enabled}
            onCheckedChange={handleToggleBackup}
          />
        </div>

        {/* Retention Period */}
        <div className="space-y-2">
          <Label htmlFor="retention-days">
            {t('settings.backup.retentionDays', 'Retention Period (days)')}
          </Label>
          <div className="flex items-center space-x-2">
            <Input
              id="retention-days"
              type="number"
              min="0"
              value={backupConfig.retentionDays}
              onChange={(e) => handleRetentionDaysChange(e.target.value)}
              className="w-32"
              disabled={!backupConfig.enabled}
            />
            <span className="text-sm text-muted-foreground">
              {backupConfig.retentionDays === 0 
                ? t('settings.backup.keepForever', 'Keep forever')
                : t('settings.backup.days', 'days')
              }
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.backup.retentionDescription', 'Backups older than this will be automatically deleted. Set to 0 to keep forever.')}
          </p>
        </div>

        {/* Max Backups Per Type */}
        <div className="space-y-2">
          <Label htmlFor="max-backups">
            {t('settings.backup.maxBackupsPerType', 'Max Backups per Type')}
          </Label>
          <div className="flex items-center space-x-2">
            <Input
              id="max-backups"
              type="number"
              min="0"
              value={backupConfig.maxBackupsPerType}
              onChange={(e) => handleMaxBackupsChange(e.target.value)}
              className="w-32"
              disabled={!backupConfig.enabled}
            />
            <span className="text-sm text-muted-foreground">
              {backupConfig.maxBackupsPerType === 0 
                ? t('settings.backup.unlimited', 'Unlimited')
                : t('settings.backup.backups', 'backups')
              }
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.backup.maxBackupsDescription', 'Maximum number of backups to keep for each translation type. Set to 0 for unlimited.')}
          </p>
        </div>

        {/* Auto Prune */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-prune">
              {t('settings.backup.autoPrune', 'Auto-prune on Startup')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('settings.backup.autoPruneDescription', 'Automatically delete old backups when the application starts')}
            </p>
          </div>
          <Switch
            id="auto-prune"
            checked={backupConfig.autoPruneOnStartup}
            onCheckedChange={handleAutoPruneToggle}
            disabled={!backupConfig.enabled}
          />
        </div>

        {/* Storage Info */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {t('settings.backup.storageUsed', 'Storage Used')}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatSize(storageSize)}
            </span>
          </div>
          
          <div className="flex justify-end mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePruneNow}
              disabled={!backupConfig.enabled || isPruning}
              className="text-muted-foreground"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isPruning 
                ? t('settings.backup.pruning', 'Pruning...')
                : t('settings.backup.pruneNow', 'Prune Old Backups')
              }
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}