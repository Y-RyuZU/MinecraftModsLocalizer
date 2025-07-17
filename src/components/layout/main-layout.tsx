import React, { useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { LogDialog } from '@/components/ui/log-dialog';
import { TranslationHistoryDialog } from '@/components/ui/translation-history-dialog';
import { DebugLogDialog } from '@/components/debug-log-dialog';
import { Header } from './header';
import { useAppStore } from '@/lib/store';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
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
        <TranslationHistoryDialog
          open={isHistoryDialogOpen}
          onOpenChange={setHistoryDialogOpen}
        />
        {/* Debug Log Dialog */}
        <DebugLogDialog
          open={isDebugLogDialogOpen}
          onOpenChange={setDebugLogDialogOpen}
        />
        {/* Header */}
        <Header 
          onDebugLogClick={() => setDebugLogDialogOpen(true)}
          onHistoryClick={() => setHistoryDialogOpen(true)}
        />
        <main className="container max-w-5xl xl:max-w-6xl 2xl:max-w-[1600px] mx-auto px-4 xl:px-6 2xl:px-8 py-6 xl:py-8 2xl:py-10">{children}</main>
      </div>
    </ThemeProvider>
  );
}
