import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { Card } from './card';
import { ScrollArea } from './scroll-area';
import { Badge } from './badge';
import { Trash2, Download, Calendar, Package, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAppTranslation } from '@/lib/i18n';
import { backupService, type BackupInfo, type BackupMetadata } from '@/lib/services/backup-service';
import { type TranslationTargetType } from '@/lib/types/minecraft';

interface BackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BACKUP_TYPE_ICONS = {
  mod: Package,
  quest: FileText,
  patchouli: FileText,
  custom: FileText,
} as const;

const BACKUP_TYPE_COLORS = {
  mod: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  quest: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  patchouli: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  custom: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
} as const;

interface BackupItemProps {
  backup: BackupInfo;
  onRestore: (backupId: string) => void;
  onDelete: (backupId: string) => void;
  isProcessing: boolean;
}

function BackupItem({ backup, onRestore, onDelete, isProcessing }: BackupItemProps) {
  const { t } = useAppTranslation();
  const { metadata } = backup;
  
  const IconComponent = BACKUP_TYPE_ICONS[metadata.type as keyof typeof BACKUP_TYPE_ICONS] || FileText;
  const typeColor = BACKUP_TYPE_COLORS[metadata.type as keyof typeof BACKUP_TYPE_COLORS] || BACKUP_TYPE_COLORS.custom;
  
  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };
  
  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <IconComponent className="h-5 w-5 text-muted-foreground" />
          <div>
            <h4 className="font-medium">{metadata.sourceName}</h4>
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={typeColor}>
                {metadata.type}
              </Badge>
              <Badge variant="outline">
                {metadata.targetLanguage}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          {backup.canRestore ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(metadata.timestamp)}</span>
        </div>
        <div>
          <span className="font-medium">{metadata.statistics.totalKeys}</span> keys
        </div>
        <div>
          <span className="font-medium">{metadata.statistics.successfulTranslations}</span> translated
        </div>
        <div>
          {formatFileSize(metadata.statistics.fileSize)}
        </div>
      </div>
      
      {metadata.originalPaths.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Files:</span> {metadata.originalPaths.length} backed up
        </div>
      )}
      
      <div className="flex items-center justify-between pt-2 border-t">
        <div className="text-xs text-muted-foreground">
          Session: {metadata.sessionId}
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRestore(metadata.id)}
            disabled={!backup.canRestore || isProcessing}
            className="h-8"
          >
            {isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Download className="h-3 w-3 mr-1" />
            )}
            {t('backup.restore')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(metadata.id)}
            disabled={isProcessing}
            className="h-8 text-destructive hover:text-destructive"
          >
            {isProcessing ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Trash2 className="h-3 w-3 mr-1" />
            )}
            {t('backup.delete')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function BackupDialog({ open, onOpenChange }: BackupDialogProps) {
  const { t } = useAppTranslation();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<TranslationTargetType | 'all'>('all');
  const [storageSize, setStorageSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const loadBackups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const options = filter === 'all' ? {} : { type: filter };
      const backupList = await backupService.listBackups(options);
      setBackups(backupList);
      
      // Get storage size
      const size = await backupService.getBackupStorageSize();
      setStorageSize(size);
    } catch (err) {
      console.error('Failed to load backups:', err);
      setError(err instanceof Error ? err.message : 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (open) {
      loadBackups();
    }
  }, [open, loadBackups]);

  const handleRestore = async (backupId: string) => {
    try {
      setProcessing(backupId);
      setError(null);
      
      // Use Tauri dialog to select target directory
      const { FileService } = await import('@/lib/services/file-service');
      const targetDirectory = await FileService.openDirectoryDialog('Select target directory for restoration');
      
      if (!targetDirectory) {
        setProcessing(null);
        return; // User cancelled
      }
      
      // Restore the backup to the selected directory
      await backupService.restoreBackup(backupId, targetDirectory);
      
      console.log(`Backup ${backupId} restored to ${targetDirectory}`);
      
      await loadBackups(); // Refresh list
    } catch (err) {
      console.error('Failed to restore backup:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (backupId: string) => {
    try {
      setProcessing(backupId);
      setError(null);
      
      await backupService.deleteBackup(backupId);
      await loadBackups(); // Refresh list
    } catch (err) {
      console.error('Failed to delete backup:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete backup');
    } finally {
      setProcessing(null);
    }
  };

  const handlePruneOld = async () => {
    try {
      setProcessing('prune');
      setError(null);
      
      const deletedCount = await backupService.pruneOldBackups(30); // 30 days retention
      console.log(`Pruned ${deletedCount} old backups`);
      
      await loadBackups(); // Refresh list
    } catch (err) {
      console.error('Failed to prune old backups:', err);
      setError(err instanceof Error ? err.message : 'Failed to prune old backups');
    } finally {
      setProcessing(null);
    }
  };

  const formatStorageSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const filteredBackups = backups;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>{t('backup.title', 'Backup Management')}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filter and Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <label htmlFor="backup-filter" className="text-sm font-medium">
                {t('backup.filter', 'Filter by type')}:
              </label>
              <select
                id="backup-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value as TranslationTargetType | 'all')}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="all">{t('backup.all', 'All')}</option>
                <option value="mod">{t('backup.mod', 'Mods')}</option>
                <option value="quest">{t('backup.quest', 'Quests')}</option>
                <option value="patchouli">{t('backup.patchouli', 'Patchouli')}</option>
                <option value="custom">{t('backup.custom', 'Custom')}</option>
              </select>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredBackups.length} {t('backup.backups', 'backups')} • {formatStorageSize(storageSize)}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 border border-red-200 bg-red-50 text-red-700 rounded-md text-sm">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Backup List */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">{t('backup.loading', 'Loading backups...')}</span>
                </div>
              ) : filteredBackups.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('backup.empty', 'No backups found')}</p>
                  <p className="text-sm mt-2">
                    {t('backup.emptyMessage', 'Backups will be created automatically during translation')}
                  </p>
                </div>
              ) : (
                filteredBackups.map((backup) => (
                  <BackupItem
                    key={backup.metadata.id}
                    backup={backup}
                    onRestore={handleRestore}
                    onDelete={handleDelete}
                    isProcessing={processing === backup.metadata.id}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePruneOld}
            disabled={processing === 'prune' || filteredBackups.length === 0}
            className="text-muted-foreground"
          >
            {processing === 'prune' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {t('backup.pruneOld', 'Clean Old Backups')}
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => loadBackups()} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t('backup.refresh', 'Refresh')}
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}