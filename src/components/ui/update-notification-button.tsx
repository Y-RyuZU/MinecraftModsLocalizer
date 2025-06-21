import React from 'react';
import { Button } from './button';
import { Bell, BellDot } from 'lucide-react';
import { useAppTranslation } from '@/lib/i18n';

interface UpdateNotificationButtonProps {
  hasUpdate: boolean;
  onClick: () => void;
}

export function UpdateNotificationButton({ hasUpdate, onClick }: UpdateNotificationButtonProps) {
  const { t } = useAppTranslation();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={hasUpdate ? t('update.newVersionAvailable', 'New version available') : t('update.checkForUpdates', 'Check for updates')}
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