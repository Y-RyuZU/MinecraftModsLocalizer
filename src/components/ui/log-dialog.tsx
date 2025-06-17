import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Button } from './button';
import { Card } from './card';
import { ScrollArea } from './scroll-area';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { FileService } from '@/lib/services/file-service';
import { listen } from '@tauri-apps/api/event';

// Log entry type
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

interface LogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogDialog({ open, onOpenChange }: LogDialogProps) {
  const { t } = useTranslation();
  const isTranslating = useAppStore((state) => state.isTranslating);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userInteracting, setUserInteracting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
  
  // Function to get log level color
  const getLogLevelColor = (level: LogEntry['level']) => {
    const levelStr = getLogLevelString(level).toLowerCase();
    
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
  const filterLogs = (logs: LogEntry[]) => {
    return logs.filter(log => {
      const levelStr = getLogLevelString(log.level).toLowerCase();
      
      // Only show logs that are important for the user to see
      // 1. All error logs
      if (levelStr === 'error') {
        return true;
      }
      
      // 2. Translation process logs (progress, completion, etc.)
      if (log.process_type === 'TRANSLATION') {
        // Filter out verbose translation logs that aren't useful to users
        const message = log.message.toLowerCase();
        // Skip detailed chunk processing logs unless they're errors
        if (message.includes('chunk') && !message.includes('error') && !message.includes('failed')) {
          return false;
        }
        return true;
      }
      
      // 3. API request logs
      if (log.process_type === 'API_REQUEST') {
        return true;
      }
      
      // 4. File operation logs
      if (log.process_type === 'FILE_OPERATION') {
        return true;
      }
      
      // 5. Warnings that might be important
      if (levelStr === 'warning' || levelStr === 'warn') {
        return true;
      }
      
      // Filter out debug and info logs that aren't important for users
      return false;
    });
  };
  
  // Reset logs when translation starts
  useEffect(() => {
    if (isTranslating) {
      // Reset logs when translation starts
      setLogs([]);
    }
  }, [isTranslating]);
  
  // Effect to listen for log events from Tauri
  useEffect(() => {
    // Skip in SSR
    if (typeof window === 'undefined') return;
    
    // Function to load initial logs
    const loadInitialLogs = async () => {
      try {
        // Check if we're in a Tauri environment
        if (typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
          // Use FileService to invoke the get_logs command
          const initialLogs = await FileService.invoke<LogEntry[]>('get_logs');
          setLogs(initialLogs || []);
        }
      } catch (error) {
        console.error('Failed to load initial logs:', error);
      }
    };
    
    // Function to listen for log events
    const listenForLogs = async () => {
      try {
        // Check if we're in a Tauri environment
        if (typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
          // Listen for log events using Tauri v2 API
          const unlistenFn = await listen<LogEntry>('log', (event) => {
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
    
    // Load initial logs
    loadInitialLogs();
    
    // Listen for log events
    const unlistenPromise = listenForLogs();
    
    // Cleanup
    return () => {
      unlistenPromise.then(unlisten => unlisten && unlisten());
    };
  }, []);
  
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
    }, 2000);
  };

  // Effect to auto-scroll to bottom (only when not actively interacting)
  useEffect(() => {
    if (autoScroll && !userInteracting && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [logs, autoScroll, userInteracting]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);
  
  // Close dialog when translation is complete
  useEffect(() => {
    if (!isTranslating && open) {
      // Keep the dialog open for a few seconds after translation completes
      const timer = setTimeout(() => {
        // Don't auto-close if there was an error
        if (!useAppStore.getState().error) {
          onOpenChange(false);
        }
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isTranslating, open, onOpenChange]);
  
  // Filter logs
  const filteredLogs = filterLogs(logs);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t('logs.translationLogs')}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <ScrollArea 
            ref={scrollAreaRef}
            className="border rounded-md"
            style={{ height: '400px' }}
            onScroll={handleUserScroll}
            onWheel={handleUserScroll}
            onMouseDown={handleUserScroll}
            onTouchStart={handleUserScroll}
          >
            <div className="p-4 font-mono text-sm whitespace-pre-wrap">
              {filteredLogs.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">
                  {t('logs.noLogs')}
                </div>
              ) : (
                filteredLogs.map((log, index) => (
                  <div 
                    key={`${log.timestamp}-${index}`}
                    className={`${getLogLevelColor(log.level)} mb-1`}
                  >
                    {formatLogMessage(log)}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        
        <DialogFooter className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-scroll"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="auto-scroll" className="text-sm">
              {t('logs.autoScroll')}
            </label>
          </div>
          
          <Button onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Standalone log viewer component for use in other parts of the application
 * This is a wrapper around the log functionality to be used outside of the dialog
 */
interface LogViewerProps {
  height?: string;
  autoScroll?: boolean;
  showTimestamp?: boolean;
  showLevel?: boolean;
  showSource?: boolean;
  filter?: string;
}

export function LogViewer({
  height = '300px',
  autoScroll = true,
  showTimestamp = true,
  showLevel = true,
  showSource = false,
  filter
}: LogViewerProps) {
  const { t } = useTranslation();
  const isTranslating = useAppStore((state) => state.isTranslating);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userInteracting, setUserInteracting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reset logs when translation starts
  useEffect(() => {
    if (isTranslating) {
      // Reset logs when translation starts
      setLogs([]);
    }
  }, [isTranslating]);
  
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
  
  // Function to get log level color
  const getLogLevelColor = (level: LogEntry['level']) => {
    const levelStr = getLogLevelString(level).toLowerCase();
    
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
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };
  
  // Function to format log message
  const formatLogMessage = (log: LogEntry) => {
    let message = '';
    
    if (showTimestamp) {
      message += `[${log.timestamp}] `;
    }
    
    if (showLevel) {
      message += `[${getLogLevelString(log.level)}] `;
    }
    
    if (showSource && log.process_type) {
      message += `[${log.process_type}] `;
    }
    
    message += log.message;
    
    return message;
  };
  
  // Function to filter logs - only show important logs in the viewer
  const filterLogs = (logs: LogEntry[]) => {
    // First apply the custom filter if provided
    let filteredByCustom = logs;
    if (filter) {
      filteredByCustom = logs.filter(log => {
        const message = formatLogMessage(log).toLowerCase();
        return message.includes(filter.toLowerCase());
      });
    }
    
    // Then apply the importance filter
    return filteredByCustom.filter(log => {
      const levelStr = getLogLevelString(log.level).toLowerCase();
      
      // Only show logs that are important for the user to see
      // 1. All error logs
      if (levelStr === 'error') {
        return true;
      }
      
      // 2. Translation process logs (progress, completion, etc.)
      if (log.process_type === 'TRANSLATION') {
        // Filter out verbose translation logs that aren't useful to users
        const message = log.message.toLowerCase();
        // Skip detailed chunk processing logs unless they're errors
        if (message.includes('chunk') && !message.includes('error') && !message.includes('failed')) {
          return false;
        }
        return true;
      }
      
      // 3. API request logs
      if (log.process_type === 'API_REQUEST') {
        return true;
      }
      
      // 4. File operation logs
      if (log.process_type === 'FILE_OPERATION') {
        return true;
      }
      
      // 5. Warnings that might be important
      if (levelStr === 'warning' || levelStr === 'warn') {
        return true;
      }
      
      // Filter out debug and info logs that aren't important for users
      return false;
    });
  };
  
  // Effect to listen for log events from Tauri
  useEffect(() => {
    // Skip in SSR
    if (typeof window === 'undefined') return;
    
    // Function to load initial logs
    const loadInitialLogs = async () => {
      try {
        // Check if we're in a Tauri environment
        if (typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
          // Use FileService to invoke the get_logs command
          const initialLogs = await FileService.invoke<LogEntry[]>('get_logs');
          setLogs(initialLogs || []);
        }
      } catch (error) {
        console.error('Failed to load initial logs:', error);
      }
    };
    
    // Function to listen for log events
    const listenForLogs = async () => {
      try {
        // Check if we're in a Tauri environment
        if (typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined') {
          // Listen for log events using Tauri v2 API
          const unlistenFn = await listen<LogEntry>('log', (event) => {
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
    
    // Load initial logs
    loadInitialLogs();
    
    // Listen for log events
    const unlistenPromise = listenForLogs();
    
    // Cleanup
    return () => {
      unlistenPromise.then(unlisten => unlisten && unlisten());
    };
  }, []);
  
  // Handle user interaction detection for LogViewer
  const handleUserScrollViewer = () => {
    setUserInteracting(true);
    
    // Clear existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    
    // Set a timeout to mark interaction as finished after 2 seconds
    interactionTimeoutRef.current = setTimeout(() => {
      setUserInteracting(false);
    }, 2000);
  };

  // Effect to auto-scroll to bottom (only when not actively interacting)
  useEffect(() => {
    if (autoScroll && !userInteracting && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [logs, autoScroll, userInteracting]);

  // Cleanup timeout on unmount for LogViewer
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);
  
  // Filter logs
  const filteredLogs = filterLogs(logs);
  
  return (
    <Card className="w-full">
      <div className="p-4">
        <h3 className="text-lg font-medium">{t('logs.title')}</h3>
        <ScrollArea 
          ref={scrollAreaRef}
          className="mt-2 border rounded-md"
          style={{ height }}
          onScroll={handleUserScrollViewer}
          onWheel={handleUserScrollViewer}
          onMouseDown={handleUserScrollViewer}
          onTouchStart={handleUserScrollViewer}
        >
          <div className="p-4 font-mono text-sm whitespace-pre-wrap">
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400">
                {t('logs.noLogs')}
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div 
                  key={`${log.timestamp}-${index}`}
                  className={`${getLogLevelColor(log.level)} mb-1`}
                >
                  {formatLogMessage(log)}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}
