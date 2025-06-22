import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { useAppTranslation } from '@/lib/i18n';
import { CheckCircle, XCircle, AlertTriangle, Search } from 'lucide-react';
import { TranslationResult } from '@/lib/types/minecraft';
import { useAppStore } from '@/lib/store';

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
  const { t } = useAppTranslation();
  const [filterText, setFilterText] = useState("");
  const saveResultsToHistory = useAppStore((state) => state.saveResultsToHistory);

  // Count successful and failed results based on the success field
  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  const successCount = successfulResults.length;
  const failureCount = failedResults.length;

  // Filter results for search
  const filteredResults = results.filter(result => 
    !filterText || 
    result.id.toLowerCase().includes(filterText.toLowerCase()) ||
    (result.displayName && result.displayName.toLowerCase().includes(filterText.toLowerCase()))
  );


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
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] pr-12">
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
          
          {/* Success/Failure Count Display */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 py-4 border-y bg-muted/20 rounded-lg">
            <div className="flex items-center gap-2 min-w-fit">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">
                {t('completion.successful', 'Successful')}: 
                <span className="ml-1 text-green-700 dark:text-green-400 font-bold">{successCount}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-fit">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium">
                {t('completion.failed', 'Failed')}: 
                <span className="ml-1 text-red-700 dark:text-red-400 font-bold">{failureCount}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-fit">
              <span className="text-sm font-medium text-muted-foreground">
                {t('completion.total', 'Total')}: 
                <span className="ml-1 font-bold">{results.length}</span>
              </span>
            </div>
          </div>
          
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{t('completion.results')}:</h4>
                <div className="relative w-[250px]">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder={t('completion.searchResults', 'Search results...')}
                    className="pl-8 w-full h-8"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded p-2">
                {filteredResults.length > 0 ? (
                  filteredResults.map((result, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className={result.success ? 'text-green-700' : 'text-red-700'}>
                        {result.displayName || result.id}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    {filterText ? t('completion.noResultsFound', 'No results found') : t('completion.noResults', 'No results')}
                  </div>
                )}
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
            saveResultsToHistory();
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