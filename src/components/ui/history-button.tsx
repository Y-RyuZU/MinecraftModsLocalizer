import React from 'react';
import { Button } from './button';
import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HistoryButtonProps {
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function HistoryButton({ onClick, variant = 'ghost', size = 'icon' }: HistoryButtonProps) {
  const { t } = useTranslation();
  
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      title={t('history.tooltip', 'View translation history')}
    >
      <History className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">{t('history.title', 'Translation History')}</span>
    </Button>
  );
}