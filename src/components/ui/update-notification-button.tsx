import React from 'react';
import { Button } from './button';
import { Bell, BellDot } from 'lucide-react';

interface UpdateNotificationButtonProps {
  hasUpdate: boolean;
  onClick: () => void;
  title?: string;
}

export function UpdateNotificationButton({ hasUpdate, onClick, title = 'Check for updates' }: UpdateNotificationButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={title}
      className="relative"
    >
      {hasUpdate ? (
        <>
          <BellDot className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </>
      ) : (
        <Bell className="h-5 w-5" />
      )}
    </Button>
  );
}