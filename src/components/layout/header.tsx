import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { LanguageSwitcher } from '@/components/theme/language-switcher';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { HistoryButton } from '@/components/ui/history-button';
import { UpdateNotificationButton } from '@/components/ui/update-notification-button';
import { UpdateDialog } from '@/components/ui/update-dialog';
import { useAppTranslation } from '@/lib/i18n';
import { UpdateService, UpdateCheckResult } from '@/lib/services/update-service';

interface HeaderProps {
  onDebugLogClick: () => void;
  onHistoryClick: () => void;
}

export function Header({ onDebugLogClick, onHistoryClick }: HeaderProps) {
  const { t } = useAppTranslation();
  const [isUpdateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  
  // Set mounted to true on client-side to prevent hydration mismatches
  useEffect(() => {
    setMounted(true);
    // Check if running in Tauri debug mode
    if (typeof window !== 'undefined' && window.__TAURI_DEBUG__) {
      setIsDebugMode(true);
    }
  }, []);
  
  // Check for updates on mount
  useEffect(() => {
    if (mounted) {
      // Check for updates after a short delay
      const timer = setTimeout(async () => {
        try {
          const result = await UpdateService.checkForUpdates();
          setUpdateInfo(result);
          
          // Automatically show update dialog if update is available
          if (result.updateAvailable) {
            setUpdateDialogOpen(true);
          }
        } catch (error) {
          console.error("Failed to check for updates:", error);
        }
      }, 5000); // Check 5 seconds after mount
      
      return () => clearTimeout(timer);
    }
  }, [mounted]);
  
  const handleUpdateClick = async () => {
    if (updateInfo && updateInfo.updateAvailable) {
      setUpdateDialogOpen(true);
    } else {
      // Force check for updates
      try {
        const result = await UpdateService.checkForUpdates(true);
        setUpdateInfo(result);
        if (result.updateAvailable) {
          setUpdateDialogOpen(true);
        } else {
          // TODO: Show a toast notification saying "Already up to date"
        }
      } catch (error) {
        console.error("Failed to check for updates:", error);
      }
    }
  };
  
  
  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container max-w-5xl 2xl:max-w-7xl mx-auto px-4 xl:px-6 2xl:px-8 flex h-16 2xl:h-20 items-center justify-between">
          <div className="flex items-center gap-2 2xl:gap-3">
            <h1 className="text-xl 2xl:text-2xl font-bold">
              {mounted ? t('app.title') : 'Minecraft Mods Localizer'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <UpdateNotificationButton
              hasUpdate={updateInfo?.updateAvailable || false}
              onClick={handleUpdateClick}
              title={mounted ? (updateInfo?.updateAvailable ? t('update.newVersionAvailable', 'New version available') : t('update.checkForUpdates', 'Check for updates')) : 'Check for updates'}
            />
            {isDebugMode && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDebugLogClick}
                title={t('header.debugLogs', 'Debug Logs')}
              >
                <Bug className="h-5 w-5" />
              </Button>
            )}
            <HistoryButton onClick={onHistoryClick} />
            <LanguageSwitcher />
            <ThemeToggle />
            <SettingsDialog />
          </div>
        </div>
      </header>
      
      {/* Update Dialog */}
      {updateInfo && (
        <UpdateDialog
          open={isUpdateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          updateInfo={updateInfo}
        />
      )}
    </>
  );
}