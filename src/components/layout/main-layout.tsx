import React, { useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { LanguageSwitcher } from '@/components/theme/language-switcher';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { LogDialog } from '@/components/ui/log-dialog';
import { HistoryButton } from '@/components/ui/history-button';
import { HistoryDialog } from '@/components/ui/history-dialog';
import { DebugLogDialog } from '@/components/debug-log-dialog';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import { useAppTranslation } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { t } = useAppTranslation();
  const isTranslating = useAppStore((state) => state.isTranslating);
  const isLogDialogOpen = useAppStore((state) => state.isLogDialogOpen);
  const setLogDialogOpen = useAppStore((state) => state.setLogDialogOpen);
  const [isHistoryDialogOpen, setHistoryDialogOpen] = useState(false);
  const [isDebugLogDialogOpen, setDebugLogDialogOpen] = useState(false);
  
  // Open log dialog when translation starts
  useEffect(() => {
    if (isTranslating) {
      setLogDialogOpen(true);
    }
  }, [isTranslating, setLogDialogOpen]);
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="min-h-screen bg-background">
        {/* Log Dialog */}
        <LogDialog 
          open={isLogDialogOpen} 
          onOpenChange={setLogDialogOpen} 
        />
        {/* History Dialog */}
        <HistoryDialog
          open={isHistoryDialogOpen}
          onOpenChange={setHistoryDialogOpen}
        />
        {/* Debug Log Dialog */}
        <DebugLogDialog
          open={isDebugLogDialogOpen}
          onOpenChange={setDebugLogDialogOpen}
        />
        <header className="sticky top-0 z-40 w-full border-b bg-background">
          <div className="container max-w-5xl mx-auto px-4 flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{t('app.title')}</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDebugLogDialogOpen(true)}
                title="Debug Logs"
              >
                <Bug className="h-5 w-5" />
              </Button>
              <HistoryButton onClick={() => setHistoryDialogOpen(true)} />
              <LanguageSwitcher />
              <ThemeToggle />
              <SettingsDialog />
            </div>
          </div>
        </header>
        <main className="container max-w-5xl mx-auto px-4 py-6">{children}</main>
      </div>
    </ThemeProvider>
  );
}
