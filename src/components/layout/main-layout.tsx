import React, { useEffect } from 'react';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { LanguageSwitcher } from '@/components/theme/language-switcher';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { LogDialog } from '@/components/ui/log-dialog';
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
        <header className="sticky top-0 z-40 w-full border-b bg-background">
          <div className="container max-w-5xl mx-auto px-4 flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{t('app.title')}</h1>
            </div>
            <div className="flex items-center gap-4">
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
