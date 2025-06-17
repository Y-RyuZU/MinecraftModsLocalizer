import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { TranslationResult } from '@/lib/types/minecraft';

interface CompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: TranslationResult[];
  hasError: boolean;
  totalItems?: number;
  completedItems?: number;
  translationType: string;
  onViewLogs?: () => void;
  onFinalize?: () => void;
}

export function CompletionDialog({
  open,
  onOpenChange,
  results,
  hasError,
  translationType,
  onViewLogs,
  onFinalize
}: CompletionDialogProps) {
  const { t } = useTranslation();

  // Count successful and failed results based on the success field
  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  const successCount = successfulResults.length;
  const failureCount = failedResults.length;


  const getStatusIcon = () => {
    if (failureCount > 0 && successCount === 0) {
      return <XCircle className="h-12 w-12 text-red-500" />;
    } else if (failureCount > 0 && successCount > 0) {
      return <AlertTriangle className="h-12 w-12 text-yellow-500" />;
    } else {
      return <CheckCircle className="h-12 w-12 text-green-500" />;
    }
  };

  const getStatusTitle = () => {
    if (failureCount > 0 && successCount === 0) {
      return t('completion.failed');
    } else if (failureCount > 0 && successCount > 0) {
      return t('completion.partiallyCompleted');
    } else {
      return t('completion.completed');
    }
  };

  const getStatusMessage = () => {
    if (failureCount > 0 && successCount === 0) {
      return t('completion.failedMessage', { type: translationType });
    } else if (failureCount > 0 && successCount > 0) {
      return t('completion.partialMessage', {
        successful: successCount,
        failed: failureCount,
        type: translationType
      });
    } else {
      return t('completion.successMessage', {
        count: successCount,
        type: translationType
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getStatusIcon()}
            {getStatusTitle()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <p className="text-center text-lg">
            {getStatusMessage()}
          </p>
          
          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">{t('completion.results')}:</h4>
              <div className="max-h-32 overflow-y-auto border rounded p-2">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                      {result.id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {hasError && (
            <div className="bg-destructive/20 text-destructive p-3 rounded text-sm">
              {t('completion.errorHint')}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between">
          {onViewLogs && (
            <Button variant="outline" onClick={onViewLogs}>
              {t('completion.viewLogs')}
            </Button>
          )}
          <Button onClick={() => {
            onOpenChange(false);
            onFinalize?.();
          }}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}