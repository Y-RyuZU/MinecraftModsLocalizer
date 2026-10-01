import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogViewer } from '@/components/log-viewer';
import { FileService } from '@/lib/services/file-service';
import { useAppTranslation } from '@/lib/i18n';
import { Trash2 } from 'lucide-react';

interface DebugLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter?: string;
}

export function DebugLogDialog({ open, onOpenChange, filter }: DebugLogDialogProps) {
  const { t } = useAppTranslation();
  const handleClearLogs = async () => {
    try {
      await FileService.invoke('clear_logs', {});
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t('header.debugLogs')} {filter && `(${filter})`}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearLogs}
              title={t('logs.clearLogs')} aria-label={t('logs.clearLogs')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <LogViewer className="h-[500px]" filter={filter} />
      </DialogContent>
    </Dialog>
  );
}