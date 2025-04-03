import React, { useEffect, useRef, useState } from 'react';
import { Card } from './card';
import { ScrollArea } from './scroll-area';
import { useTranslation } from 'react-i18next';
import { FileService } from '@/lib/services/file-service';
import { listen } from '@tauri-apps/api/event';

// Log entry type
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  process_type?: string;
}

// Log viewer props
interface LogViewerProps {
  height?: string;
  autoScroll?: boolean;
  showTimestamp?: boolean;
  showLevel?: boolean;
  showSource?: boolean;
  filter?: string;
}

/**
 * Log viewer component
 * Displays logs in real-time
 */
export function LogViewer({
  height = '300px',
  autoScroll = true,
  showTimestamp = true,
  showLevel = true,
  showSource = false,
  filter
}: LogViewerProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Function to get log level color
  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-red-500 dark:text-red-400';
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
      message += `[${log.level}] `;
    }
    
    if (showSource && log.source) {
      message += `[${log.source}] `;
    }
    
    message += log.message;
    
    return message;
  };
  
  // Function to filter logs
  const filterLogs = (logs: LogEntry[]) => {
    if (!filter) return logs;
    
    return logs.filter(log => {
      const message = formatLogMessage(log).toLowerCase();
      return message.includes(filter.toLowerCase());
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
            console.log('Received log event:', event);
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
  
  // Effect to auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [logs, autoScroll]);
  
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
