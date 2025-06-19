import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { FileService } from '@/lib/services/file-service';

interface LogEntry {
  timestamp: string;
  level: 'Debug' | 'Info' | 'Warning' | 'Error';
  message: string;
  processType?: string;
}

interface LogViewerProps {
  className?: string;
  filter?: string;
}

export function LogViewer({ className, filter }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Load existing logs
    const loadLogs = async () => {
      try {
        const existingLogs = await FileService.invoke<LogEntry[]>('get_logs', {});
        setLogs(existingLogs);
      } catch (error) {
        console.error('Failed to load logs:', error);
      }
    };

    loadLogs();

    // Listen for new log entries
    const unlisten = listen<LogEntry>('log', (event) => {
      const logEntry = event.payload;
      
      // Filter if needed
      if (filter && logEntry.processType !== filter) {
        return;
      }

      setLogs((prevLogs) => [...prevLogs, logEntry]);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [filter]);

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'Debug':
        return 'text-muted-foreground';
      case 'Info':
        return 'text-foreground';
      case 'Warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'Error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-foreground';
    }
  };

  return (
    <ScrollArea className={cn("h-[400px] rounded-md border p-4", className)}>
      <div className="space-y-1 font-mono text-sm">
        {logs.map((log, index) => (
          <div key={index} className={cn("flex gap-2", getLevelColor(log.level))}>
            <span className="text-muted-foreground">[{log.timestamp}]</span>
            <span>[{log.level}]</span>
            {log.processType && (
              <span className="text-muted-foreground">[{log.processType}]</span>
            )}
            <span className="flex-1">{log.message}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}