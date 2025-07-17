import React from 'react';
import { UnifiedLogViewer } from './unified-log-viewer';

interface LogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogDialog({ open, onOpenChange }: LogDialogProps) {
  return (
    <UnifiedLogViewer
      open={open}
      onOpenChange={onOpenChange}
      mode="realtime"
    />
  );
}

// Re-export the UnifiedLogViewer for backward compatibility
export { UnifiedLogViewer } from './unified-log-viewer';