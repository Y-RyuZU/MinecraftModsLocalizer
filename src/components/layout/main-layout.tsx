import React from 'react';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { LanguageSwitcher } from '@/components/theme/language-switcher';
import { useAppTranslation } from '@/lib/i18n';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { t } = useAppTranslation();
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
          <div className="container max-w-5xl mx-auto px-4 flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{t('app.title')}</h1>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="container max-w-5xl mx-auto px-4 py-6">{children}</main>
      </div>
    </ThemeProvider>
  );
}
