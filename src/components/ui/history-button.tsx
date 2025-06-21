import React from 'react';
import { Button } from './button';
import { History } from 'lucide-react';
import { useAppTranslation } from '@/lib/i18n';

interface HistoryButtonProps {
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function HistoryButton({ onClick, variant = 'ghost', size = 'icon' }: HistoryButtonProps) {
  const { t } = useAppTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      title={mounted ? t('history.tooltip', 'View translation history') : 'View translation history'}
    >
      <History className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">{mounted ? t('history.title', 'Translation History') : 'Translation History'}</span>
    </Button>
  );
}