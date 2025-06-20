import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { ScrollArea } from './scroll-area';
import { useAppTranslation } from '@/lib/i18n';
import { CheckCircle, XCircle, Search, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { TranslationResult } from '@/lib/types/minecraft';

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistoryDialog({ open, onOpenChange }: HistoryDialogProps) {
  const { t } = useAppTranslation();
  const [filterText, setFilterText] = useState("");
  const historicalResults = useAppStore((state) => state.historicalResults);
  const clearHistoricalResults = useAppStore((state) => state.clearHistoricalResults);

  // Filter results for search
  const filteredResults = historicalResults.filter(result => 
    !filterText || 
    result.id.toLowerCase().includes(filterText.toLowerCase()) ||
    result.type.toLowerCase().includes(filterText.toLowerCase()) ||
    result.targetLanguage.toLowerCase().includes(filterText.toLowerCase())
  );

  // Group results by translation session (by timestamp proximity)
  const groupedResults = React.useMemo(() => {
    const groups: { timestamp: Date; results: TranslationResult[] }[] = [];
    let currentGroup: TranslationResult[] = [];
    let lastTimestamp: Date | null = null;

    // Sort by output path (which typically includes timestamp)
    const sortedResults = [...filteredResults].sort((a, b) => 
      a.outputPath.localeCompare(b.outputPath)
    );

    sortedResults.forEach((result) => {
      // Extract timestamp from output path if possible
      const timestampMatch = result.outputPath.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
      const timestamp = timestampMatch ? new Date(timestampMatch[1].replace(/_/g, ' ').replace(/-/g, ':')) : new Date();

      // If timestamp differs by more than 1 minute, start a new group
      if (!lastTimestamp || Math.abs(timestamp.getTime() - lastTimestamp.getTime()) > 60000) {
        if (currentGroup.length > 0) {
          groups.push({ timestamp: lastTimestamp!, results: currentGroup });
        }
        currentGroup = [result];
        lastTimestamp = timestamp;
      } else {
        currentGroup.push(result);
      }
    });

    // Add the last group
    if (currentGroup.length > 0 && lastTimestamp) {
      groups.push({ timestamp: lastTimestamp, results: currentGroup });
    }

    return groups.reverse(); // Most recent first
  }, [filteredResults]);

  const handleClearHistory = () => {
    if (window.confirm(t('history.confirmClear', 'Are you sure you want to clear all translation history?'))) {
      clearHistoricalResults();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh]">
        <div className="pr-10">
          <DialogHeader>
            <DialogTitle>{t('history.title', 'Translation History')}</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4 overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-muted-foreground">
              {t('history.totalResults', '{{count}} total results', { count: historicalResults.length })}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative w-[200px] sm:w-[250px]">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t('history.searchPlaceholder', 'Search history...')}
                  className="pl-8 w-full h-8"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />
              </div>
              {historicalResults.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearHistory}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('history.clear', 'Clear')}
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="h-[400px] border rounded-md p-4">
            {groupedResults.length > 0 ? (
              <div className="space-y-6">
                {groupedResults.map((group, groupIndex) => (
                  <div key={groupIndex} className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      {group.timestamp.toLocaleString()}
                    </h4>
                    <div className="space-y-1 pl-4">
                      {group.results.map((result, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          {result.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                          <span className={result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                            {result.id}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">{result.type}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            {result.targetLanguage}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {historicalResults.length === 0 
                  ? t('history.noHistory', 'No translation history yet')
                  : t('history.noResultsFound', 'No results found matching your search')
                }
              </div>
            )}
          </ScrollArea>
          </div>
          
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}