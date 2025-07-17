import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { ScrollArea } from './scroll-area';
import { useAppTranslation } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { FileService } from '@/lib/services/file-service';
import { listen } from '@tauri-apps/api/event';
import { UI_DEFAULTS } from '@/lib/constants/defaults';
import { RefreshCcw } from 'lucide-react';

// Log entry type for real-time logs
interface LogEntry {
  timestamp: string;
  level: {
    Debug: null;
    Info: null;
    Warning: null;
    Error: null;
  } | string;
  message: string;
  process_type?: string;
}

// Props for the unified log viewer
interface UnifiedLogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Mode: 'realtime' for current session, 'historical' for past session
  mode: 'realtime' | 'historical';
  
  // For historical mode
  sessionId?: string;
  minecraftDir?: string;
  
  // Optional title override
  title?: string;
}

export function UnifiedLogViewer({ 
  open, 
  onOpenChange, 
  mode, 
  sessionId, 
  minecraftDir,
  title 
}: UnifiedLogViewerProps) {
  const { t } = useAppTranslation();
  const isTranslating = useAppStore((state) => state.isTranslating);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userInteracting, setUserInteracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawLogContent, setRawLogContent] = useState<string>('');
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Callback ref to get the viewport element from ScrollArea
  const scrollAreaCallbackRef = useCallback((element: HTMLDivElement | null) => {
    if (element) {
      // Find the viewport element within the ScrollArea
      const viewport = element.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement;
      if (viewport) {
        scrollViewportRef.current = viewport;
      }
    }
  }, []);
  
  // Function to get log level string
  const getLogLevelString = (level: LogEntry['level']): string => {
    if (typeof level === 'string') {
      return level;
    }
    
    if ('Error' in level) return 'ERROR';
    if ('Warning' in level) return 'WARNING';
    if ('Info' in level) return 'INFO';
    if ('Debug' in level) return 'DEBUG';
    
    return 'UNKNOWN';
  };
  
  // Function to get log level color - enhanced for both level and process_type
  const getLogLevelColor = (log: LogEntry) => {
    const levelStr = getLogLevelString(log.level).toLowerCase();
    const processType = log.process_type?.toLowerCase() || '';
    
    // Check level first
    switch (levelStr) {
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'warning':
      case 'warn':
        return 'text-yellow-500 dark:text-yellow-400';
      case 'info':
        return 'text-blue-500 dark:text-blue-400';
      case 'debug':
        return 'text-gray-500 dark:text-gray-400';
    }
    
    // Then check process type for more specific coloring
    switch (processType) {
      case 'translation':
      case 'translation_start':
      case 'translation_stats':
      case 'translation_progress':
      case 'translation_complete':
        return 'text-green-500 dark:text-green-400';
      case 'api_request':
        return 'text-purple-500 dark:text-purple-400';
      case 'file_operation':
        return 'text-cyan-500 dark:text-cyan-400';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };
  
  // Function to format log message
  const formatLogMessage = (log: LogEntry) => {
    let message = '';
    
    // Always show timestamp and level in the dialog
    message += `[${log.timestamp}] `;
    message += `[${getLogLevelString(log.level)}] `;
    
    // Process type is optional
    if (log.process_type) {
      message += `[${log.process_type}] `;
    }
    
    message += log.message;
    
    return message;
  };
  
  // Function to filter logs - only show important logs in the dialog
  const filterLogs = useCallback((logs: LogEntry[]) => {
    return logs.filter(log => {
      const levelStr = getLogLevelString(log.level).toLowerCase();
      
      // NEVER show debug logs to users
      if (levelStr === 'debug') {
        return false;
      }
      
      // Filter out verbose backup logs
      if (log.process_type === 'BACKUP' && log.message.includes('Backed up SNBT:')) {
        return false;
      }
      
      // Only show logs that are important for the user to see
      // 1. All error logs
      if (levelStr === 'error') {
        return true;
      }
      
      // 1.5. Show ErrorLogger messages (they contain important context)
      if (log.message.includes('[ErrorLogger]') || log.message.includes('TranslationService.logError')) {
        return true;
      }
      
      // During active translation, show more logs
      if (isTranslating) {
        // Show all translation-related logs during translation
        if (log.process_type === 'TRANSLATION' || 
            log.process_type === 'TRANSLATION_START' ||
            log.process_type === 'TRANSLATION_STATS' ||
            log.process_type === 'TRANSLATION_PROGRESS' ||
            log.process_type === 'TRANSLATION_COMPLETE') {
          return true;
        }
        
        // Show all API request logs during translation
        if (log.process_type === 'API_REQUEST') {
          return true;
        }
        
        // Show file operations during translation
        if (log.process_type === 'FILE_OPERATION') {
          return true;
        }
        
        // Show warnings during translation
        if (levelStr === 'warning' || levelStr === 'warn') {
          return true;
        }
        
        // Show info logs during translation
        if (levelStr === 'info') {
          return true;
        }
      }
      
      // When not translating, only show critical logs
      // 2. Enhanced translation process logs
      if (log.process_type === 'TRANSLATION') {
        // Filter out verbose translation logs that aren't useful to users
        const message = log.message.toLowerCase();
        // Skip detailed chunk processing logs unless they're errors
        if (message.includes('chunk') && !message.includes('error') && !message.includes('failed')) {
          return false;
        }
        return true;
      }
      
      // 3. New enhanced translation logging categories
      if (log.process_type === 'TRANSLATION_START') {
        return true; // Always show translation start logs
      }
      
      if (log.process_type === 'TRANSLATION_STATS') {
        return true; // Show pre-translation statistics
      }
      
      if (log.process_type === 'TRANSLATION_PROGRESS') {
        // Show file progress but limit frequency to avoid spam
        const message = log.message.toLowerCase();
        // Only show progress at certain milestones or completion
        if (message.includes('100%') || message.includes('completed') || 
            message.includes('50%') || message.includes('75%')) {
          return true;
        }
        return false;
      }
      
      if (log.process_type === 'TRANSLATION_COMPLETE') {
        return true; // Always show completion summaries
      }
      
      // 4. Performance logs - only show for errors or important milestones
      if (log.process_type === 'PERFORMANCE') {
        // Only show performance logs for debug purposes (can be filtered out in production)
        return levelStr === 'error' || levelStr === 'warning';
      }
      
      // 5. API request logs
      if (log.process_type === 'API_REQUEST') {
        return true;
      }
      
      // 6. File operation logs
      if (log.process_type === 'FILE_OPERATION') {
        return true;
      }
      
      // 7. Backup logs (only show summary, not individual file backups)
      if (log.process_type === 'BACKUP') {
        const message = log.message.toLowerCase();
        // Show backup start/completion but not individual file backups
        if (message.includes('backing up') && message.includes('files')) {
          return true; // "Backing up X files"
        }
        if (message.includes('backup completed') || message.includes('backup failed')) {
          return true; // Backup summaries
        }
        return false; // Skip individual file backup logs
      }
      
      // 8. System logs
      if (log.process_type === 'SYSTEM') {
        return true;
      }
      
      // 9. Warnings that might be important
      if (levelStr === 'warning' || levelStr === 'warn') {
        return true;
      }
      
      // Filter out debug and info logs that aren't important for users
      return false;
    });
  }, [isTranslating]);

  // Parse raw log content into LogEntry format for historical logs
  const parseRawLogContent = useCallback((content: string): LogEntry[] => {
    const lines = content.split('\n').filter(line => line.trim());
    const logEntries: LogEntry[] = [];
    
    lines.forEach(line => {
      // Parse log format: [timestamp] [level] [process_type] message
      // Example: [2025-07-17 12:00:00] [INFO] [TRANSLATION] Starting translation
      const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\](?:\s*\[([^\]]*)\])?\s*(.*)$/);
      
      if (match) {
        const [, timestamp, level, processType, message] = match;
        
        logEntries.push({
          timestamp: timestamp.trim(),
          level: level.trim().toUpperCase() as string,
          message: message.trim(),
          process_type: processType?.trim() || undefined
        });
      } else {
        // Fallback for simpler format: [level] message
        const simpleMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (simpleMatch) {
          const [, level, message] = simpleMatch;
          logEntries.push({
            timestamp: new Date().toISOString(),
            level: level.trim().toUpperCase() as string,
            message: message.trim(),
            process_type: undefined
          });
        }
      }
    });
    
    return logEntries;
  }, []);
  
  // Load logs based on mode
  useEffect(() => {
    if (!open) return;
    
    if (mode === 'realtime') {
      // Load real-time logs
      const loadRealtimeLogs = async () => {
        try {
          if (typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
            const initialLogs = await FileService.invoke<LogEntry[]>('get_logs');
            console.log('[UnifiedLogViewer] Initial logs loaded:', initialLogs);
            // Only set logs if we don't have any yet
            setLogs(prevLogs => prevLogs.length === 0 ? (initialLogs || []) : prevLogs);
          }
        } catch (error) {
          console.error('Failed to load initial logs:', error);
          setError('Failed to load logs');
        }
      };
      
      loadRealtimeLogs();
    } else if (mode === 'historical' && sessionId && minecraftDir) {
      // Load historical logs
      const loadHistoricalLogs = async () => {
        setLoading(true);
        setError(null);
        
        try {
          const actualPath = minecraftDir.startsWith('NATIVE_DIALOG:')
            ? minecraftDir.substring('NATIVE_DIALOG:'.length)
            : minecraftDir;
          
          const logContent = await FileService.invoke<string>('read_session_log', {
            minecraftDir: actualPath,
            sessionId
          });
          
          setRawLogContent(logContent);
          const parsedLogs = parseRawLogContent(logContent);
          setLogs(parsedLogs);
        } catch (err) {
          console.error('Failed to load session log:', err);
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setLoading(false);
        }
      };
      
      loadHistoricalLogs();
    }
  }, [open, mode, sessionId, minecraftDir]);
  
  // Listen for real-time log events (only in realtime mode)
  useEffect(() => {
    if (mode !== 'realtime' || !open) return;
    
    // Skip in SSR
    if (typeof window === 'undefined') return;
    
    // Function to listen for log events
    const listenForLogs = async () => {
      try {
        // Check if we're in a Tauri environment
        if (typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
          // Listen for log events using Tauri v2 API
          const unlistenFn = await listen<LogEntry>('log', (event) => {
            console.log('[UnifiedLogViewer] Received log event:', event.payload);
            setLogs(prevLogs => [...prevLogs, event.payload]);
          });
          
          // Return cleanup function
          return unlistenFn;
        }
      } catch (error) {
        console.error('Failed to listen for log events:', error);
      }
      
      // Return no-op cleanup function
      return () => {};
    };
    
    // Listen for log events
    const unlistenPromise = listenForLogs();
    
    // Cleanup
    return () => {
      unlistenPromise.then(unlisten => unlisten && unlisten());
    };
  }, [mode, open]);
  
  // Handle user interaction detection
  const handleUserScroll = () => {
    setUserInteracting(true);
    
    // Clear existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    
    // Set a timeout to mark interaction as finished after 2 seconds
    interactionTimeoutRef.current = setTimeout(() => {
      setUserInteracting(false);
    }, UI_DEFAULTS.autoScroll.interactionDelay);
  };

  // Effect to auto-scroll to bottom (only when not actively interacting)
  useEffect(() => {
    if (autoScroll && !userInteracting && scrollViewportRef.current && mode === 'realtime') {
      const viewport = scrollViewportRef.current;
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [logs, autoScroll, userInteracting, mode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);
  
  // Keep dialog open for a few seconds after translation completes (realtime mode only)
  useEffect(() => {
    if (mode === 'realtime' && !isTranslating && open) {
      // Keep the dialog open for a few seconds after translation completes
      const timer = setTimeout(() => {
        // Don't auto-close if there was an error
        if (!useAppStore.getState().error) {
          onOpenChange(false);
        }
      }, UI_DEFAULTS.dialog.autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [mode, isTranslating, open, onOpenChange]);
  
  // Filter logs
  const filteredLogs = useMemo(() => {
    return mode === 'realtime' ? filterLogs(logs) : logs;
  }, [mode, filterLogs, logs]);
  
  // Generate title
  const dialogTitle = useMemo(() => {
    return title || (mode === 'realtime' 
      ? t('logs.translationLogs', 'Translation Logs')
      : `${t('history.sessionLogs', 'Session Logs')} - ${sessionId || ''}`);
  }, [title, mode, t, sessionId]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] 2xl:max-w-[1400px] max-h-[80vh] 2xl:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        
        {loading && (
          <div className="text-center py-8">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-red-500">
            <p>{t('errors.failedToLoadLogs', 'Failed to load logs')}</p>
            <p className="text-sm mt-2">{error}</p>
          </div>
        )}
        
        {!loading && !error && (
          <div className="py-4">
            <ScrollArea 
              ref={scrollAreaCallbackRef}
              className="border rounded-md"
              style={{ height: UI_DEFAULTS.scrollArea.defaultHeight }}
              onScroll={handleUserScroll}
              onWheel={handleUserScroll}
              onMouseDown={handleUserScroll}
              onTouchStart={handleUserScroll}
            >
              <div className="p-4 2xl:p-6 font-mono text-sm 2xl:text-base whitespace-pre-wrap">
                {filteredLogs.length === 0 ? (
                  <div className="text-gray-500 dark:text-gray-400">
                    {t('logs.noLogs', 'No logs available')}
                  </div>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div 
                      key={`${log.timestamp}-${index}`}
                      className={`${getLogLevelColor(log)} mb-1`}
                    >
                      {formatLogMessage(log)}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
        
        <DialogFooter className="flex justify-between items-center">
          {mode === 'realtime' ? (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto-scroll"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="auto-scroll" className="text-sm">
                {t('logs.autoScroll', 'Auto Scroll')}
              </label>
            </div>
          ) : (
            <div />
          )}
          
          <Button onClick={() => onOpenChange(false)}>
            {t('common.close', 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}