import React from 'react';
import { Button } from './button';
import { useAppStore } from '@/lib/store';
import { useAppTranslation } from '@/lib/i18n';

interface LogButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function LogButton({ 
  variant = 'outline', 
  size = 'sm',
  className = ''
}: LogButtonProps) {
  const { t } = useAppTranslation();
  const setLogDialogOpen = useAppStore((state) => state.setLogDialogOpen);
  
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => setLogDialogOpen(true)}
    >
      {t('logs.openLogs')}
    </Button>
  );
}
