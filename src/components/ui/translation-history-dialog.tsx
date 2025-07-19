"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { ScrollArea } from './scroll-area';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './table';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, RefreshCcw, ArrowUpDown, FileText, FolderOpen } from 'lucide-react';
import { useAppTranslation } from '@/lib/i18n';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/lib/store';
import { FileService } from '@/lib/services/file-service';
import { UnifiedLogViewer } from './unified-log-viewer';

interface TranslationHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortField = 'sessionId' | 'language' | 'totalTranslations' | 'successRate';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface SessionSummary {
  sessionId: string;
  language: string;
  totalTranslations: number;
  successfulTranslations: number;
  successRate: number;
  timestamp: Date;
  expanded: boolean;
  summary?: TranslationSummary;
  loading?: boolean;
  error?: string;
}

interface TranslationEntry {
  type: string;
  name: string;
  status: string;
  keys: string;
}

interface TranslationSummary {
  lang: string;
  translations: TranslationEntry[];
}


// Format session ID to human-readable date/time
const formatSessionId = (id: string) => {
  // Format: YYYY-MM-DD_HH-MM-SS
  const match = id.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
  return id;
};

// Parse session ID to Date object
const parseSessionId = (id: string): Date => {
  const match = id.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
    // Return current date if parsing resulted in invalid date
    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  }
  // Return current date for invalid format
  return new Date();
};

// Calculate session summary stats
const calculateSessionStats = (summary: TranslationSummary): { totalTranslations: number; successfulTranslations: number; successRate: number } => {
  const totalTranslations = summary.translations.length;
  const successfulTranslations = summary.translations.filter(t => t.status === 'completed').length;
  const successRate = totalTranslations > 0 ? (successfulTranslations / totalTranslations) * 100 : 0;
  
  return {
    totalTranslations,
    successfulTranslations,
    successRate
  };
};

function SessionDetailsRow({ sessionSummary, onViewLogs }: { sessionSummary: SessionSummary; onViewLogs: (sessionId: string) => void }) {
  const { t } = useAppTranslation();
  const { summary } = sessionSummary;
  
  if (!summary) return null;
  
  // Helper function to get localized type name
  const getLocalizedType = (type: string) => {
    const typeKey = `history.types.${type}`;
    return t(typeKey, type);
  };
  
  // Helper function to get localized status
  const getLocalizedStatus = (status: string) => {
    const statusKey = `history.statuses.${status}`;
    return t(statusKey, status);
  };
  
  // Helper function to render status with icon and text
  const renderStatus = (status: string) => {
    const localizedStatus = getLocalizedStatus(status);
    
    if (status === 'completed') {
      return (
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-400">{localizedStatus}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-2">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">{localizedStatus}</span>
        </div>
      );
    }
  };
  
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={5} className="p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-lg font-semibold">{t('history.sessionDetails', 'Session Details')}</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewLogs(sessionSummary.sessionId)}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              {t('history.viewLogs', 'View Logs')}
            </Button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px] max-w-[180px] w-[15%]">{t('history.status', 'Status')}</TableHead>
                  <TableHead className="min-w-[180px] w-[50%]">{t('history.fileName', 'File Name')}</TableHead>
                  <TableHead className="min-w-[100px] max-w-[150px] w-[20%]">{t('history.type', 'Type')}</TableHead>
                  <TableHead className="min-w-[80px] max-w-[120px] w-[15%]">{t('history.keyCount', 'Keys')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.translations.map((translation, index) => (
                  <TableRow key={index}>
                    <TableCell className="min-w-[120px] max-w-[180px] w-[15%]">
                      {renderStatus(translation.status)}
                    </TableCell>
                    <TableCell className="font-medium min-w-[180px] w-[50%] truncate" title={translation.name}>{translation.name}</TableCell>
                    <TableCell className="min-w-[100px] max-w-[150px] w-[20%]">{getLocalizedType(translation.type)}</TableCell>
                    <TableCell className="font-mono text-sm min-w-[80px] max-w-[120px] w-[15%]">{translation.keys}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function SessionRow({ sessionSummary, onToggle, minecraftDir, updateSession, onViewLogs }: { 
  sessionSummary: SessionSummary; 
  onToggle: () => void; 
  minecraftDir: string;
  updateSession: (sessionId: string, updates: Partial<SessionSummary>) => void;
  onViewLogs: (sessionId: string) => void;
}) {
  const { t } = useAppTranslation();
  
  const loadSummary = useCallback(async () => {
    if (sessionSummary.summary) return;
    
    updateSession(sessionSummary.sessionId, { loading: true });
    
    try {
      const result = await invoke<TranslationSummary>('get_translation_summary', {
        minecraftDir,
        sessionId: sessionSummary.sessionId
      });
      
      const stats = calculateSessionStats(result);
      updateSession(sessionSummary.sessionId, {
        summary: result,
        totalTranslations: stats.totalTranslations,
        successfulTranslations: stats.successfulTranslations,
        successRate: stats.successRate,
        language: result.lang,
        loading: false,
        error: undefined
      });
    } catch (err) {
      console.error('Failed to load translation summary:', err);
      updateSession(sessionSummary.sessionId, {
        error: err instanceof Error ? err.message : String(err),
        loading: false
      });
    }
  }, [sessionSummary.sessionId, sessionSummary.summary, updateSession, minecraftDir]);
  
  useEffect(() => {
    if (sessionSummary.expanded && !sessionSummary.summary && !sessionSummary.loading) {
      loadSummary();
    }
  }, [sessionSummary.expanded, sessionSummary.summary, sessionSummary.loading, loadSummary]);
  
  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50 focus:bg-muted/50 focus:outline-none" 
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={sessionSummary.expanded}
        aria-label={`${sessionSummary.expanded ? 'Collapse' : 'Expand'} session ${formatSessionId(sessionSummary.sessionId)}`}
      >
        <TableCell>
          <div className="flex items-center space-x-2">
            {sessionSummary.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium">{formatSessionId(sessionSummary.sessionId)}</span>
          </div>
        </TableCell>
        <TableCell>
          {sessionSummary.loading ? (
            <span className="text-muted-foreground">{t('common.loading', 'Loading...')}</span>
          ) : (
            sessionSummary.language || '-'
          )}
        </TableCell>
        <TableCell>
          {sessionSummary.loading ? '-' : sessionSummary.totalTranslations.toString()}
        </TableCell>
        <TableCell>
          {sessionSummary.loading ? '-' : `${sessionSummary.successfulTranslations}/${sessionSummary.totalTranslations}`}
        </TableCell>
        <TableCell>
          {sessionSummary.loading ? '-' : (
            <div className="flex items-center space-x-2">
              <div className="w-16 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${sessionSummary.successRate}%` }}
                ></div>
              </div>
              <span className="text-sm text-muted-foreground">{sessionSummary.successRate.toFixed(1)}%</span>
            </div>
          )}
        </TableCell>
      </TableRow>
      
      {sessionSummary.expanded && (
        <SessionDetailsRow sessionSummary={sessionSummary} onViewLogs={onViewLogs} />
      )}
    </>
  );
}

export function TranslationHistoryDialog({ open, onOpenChange }: TranslationHistoryDialogProps) {
  const { t } = useAppTranslation();
  const profileDirectory = useAppStore(state => state.profileDirectory);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'sessionId', direction: 'desc' });
  const [sessionLogDialogOpen, setSessionLogDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [historyDirectory, setHistoryDirectory] = useState<string>('');

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use historyDirectory if set, otherwise fall back to profileDirectory
      const minecraftDir = historyDirectory || profileDirectory;
      
      if (!minecraftDir) {
        setError(t('errors.noMinecraftDir', 'Minecraft directory is not set. Please select a profile directory.'));
        return;
      }
      
      // Use the minecraft directory path directly
      const actualPath = minecraftDir;
      
      const sessionList = await invoke<string[]>('list_translation_sessions', {
        minecraftDir: actualPath
      });
      
      const sessionSummaries: SessionSummary[] = sessionList.map(sessionId => ({
        sessionId,
        language: '-',
        totalTranslations: 0,
        successfulTranslations: 0,
        successRate: 0,
        timestamp: parseSessionId(sessionId),
        expanded: false,
        loading: false
      }));
      
      setSessions(sessionSummaries);
    } catch (err) {
      console.error('Failed to load translation sessions:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [historyDirectory, profileDirectory, t]);

  useEffect(() => {
    if (open) {
      // Use existing profileDirectory as fallback if historyDirectory is not set
      if (!historyDirectory && profileDirectory) {
        setHistoryDirectory(profileDirectory);
      }
      loadSessions();
    }
  }, [open, loadSessions, historyDirectory, profileDirectory]);
  
  // Handle directory selection for history
  const handleSelectHistoryDirectory = async () => {
    try {
      const selected = await FileService.openDirectoryDialog('Select Profile Directory for History');
      if (selected) {
        // Validate the directory path
        if (!selected.trim()) {
          setError(t('errors.invalidDirectory', 'Invalid directory selected'));
          return;
        }
        
        setHistoryDirectory(selected);
        setError(null);
        
        // Automatically reload sessions with new directory
        loadSessions();
      }
    } catch (error) {
      console.error('Failed to select history directory:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(t('errors.directorySelectionFailed', `Failed to select directory: ${errorMessage}`));
    }
  };

  const handleToggleSession = (sessionId: string) => {
    setSessions(prev => prev.map(session => 
      session.sessionId === sessionId 
        ? { ...session, expanded: !session.expanded }
        : session
    ));
  };

  const updateSession = (sessionId: string, updates: Partial<SessionSummary>) => {
    setSessions(prev => prev.map(session => 
      session.sessionId === sessionId 
        ? { ...session, ...updates }
        : session
    ));
  };

  const handleViewLogs = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    setSessionLogDialogOpen(true);
  }, []);

  const handleSort = (field: SortField) => {
    const direction = sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ field, direction });
  };

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const { field, direction } = sortConfig;
      const multiplier = direction === 'asc' ? 1 : -1;
      
      switch (field) {
        case 'sessionId':
          return (a.timestamp.getTime() - b.timestamp.getTime()) * multiplier;
        case 'language':
          return a.language.localeCompare(b.language) * multiplier;
        case 'totalTranslations':
          return (a.totalTranslations - b.totalTranslations) * multiplier;
        case 'successRate':
          return (a.successRate - b.successRate) * multiplier;
        default:
          return 0;
      }
    });
  }, [sessions, sortConfig]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      className="flex items-center space-x-1 hover:bg-muted/50 rounded px-2 py-1 transition-colors"
      onClick={() => handleSort(field)}
    >
      <span>{children}</span>
      <ArrowUpDown className="h-4 w-4" />
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full max-h-[85vh] 2xl:max-h-[90vh] overflow-hidden sm:max-w-[85vw] 2xl:max-w-[1600px]">
        <DialogHeader>
          <div className="flex flex-col space-y-4">
            <DialogTitle>{t('settings.backup.translationHistory', 'Translation History')}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectHistoryDirectory}
                className="flex items-center gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                {t('buttons.selectProfileDirectory', 'Select Profile Directory')}
              </Button>
              {(historyDirectory || profileDirectory) && (
                <div className="text-sm text-muted-foreground">
                  {t('misc.selectedDirectory')} {(historyDirectory || profileDirectory)}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          {loading && (
            <div className="text-center py-8">
              <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500">
              <p>{t('errors.failedToLoad', 'Failed to load sessions')}</p>
              <p className="text-sm mt-2">{error}</p>
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('settings.backup.noHistory', 'No translation history found')}</p>
            </div>
          )}

          {!loading && !error && sessions.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <ScrollArea className="h-[60vh] min-h-[400px] 2xl:h-[70vh] 2xl:min-h-[500px] w-full overflow-auto">
                <div className="min-w-[800px]">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px] w-[30%]">
                        <SortButton field="sessionId">{t('history.sessionDate', 'Session Date')}</SortButton>
                      </TableHead>
                      <TableHead className="min-w-[120px] max-w-[180px] w-[15%]">
                        <SortButton field="language">{t('history.targetLanguage', 'Target Language')}</SortButton>
                      </TableHead>
                      <TableHead className="min-w-[100px] max-w-[140px] w-[15%]">
                        <SortButton field="totalTranslations">{t('history.totalItems', 'Total Items')}</SortButton>
                      </TableHead>
                      <TableHead className="min-w-[120px] max-w-[160px] w-[15%]">
                        {t('history.successCount', 'Success Count')}
                      </TableHead>
                      <TableHead className="min-w-[180px] w-[25%]">
                        <SortButton field="successRate">{t('history.successRate', 'Success Rate')}</SortButton>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSessions.map((sessionSummary) => (
                      <SessionRow
                        key={sessionSummary.sessionId}
                        sessionSummary={sessionSummary}
                        onToggle={() => handleToggleSession(sessionSummary.sessionId)}
                        minecraftDir={historyDirectory || profileDirectory || ''}
                        updateSession={updateSession}
                        onViewLogs={handleViewLogs}
                      />
                    ))}
                  </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => loadSessions()}
            disabled={loading}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            {t('common.refresh', 'Refresh')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            {t('common.close', 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Session Log Dialog using Unified Log Viewer */}
      <UnifiedLogViewer
        open={sessionLogDialogOpen}
        onOpenChange={setSessionLogDialogOpen}
        mode="historical"
        sessionId={selectedSessionId || undefined}
        minecraftDir={historyDirectory || profileDirectory}
        title={selectedSessionId ? `${t('history.sessionLogs', 'Session Logs')} - ${formatSessionId(selectedSessionId)}` : undefined}
      />
    </Dialog>
  );
}