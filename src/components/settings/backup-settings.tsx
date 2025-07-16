"use client";

import { useAppTranslation } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive } from "lucide-react";
import { type AppConfig } from "@/lib/types/config";

interface BackupSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

export function BackupSettings({ config, setConfig }: BackupSettingsProps) {
  const { t } = useAppTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <HardDrive className="h-5 w-5" />
          <span>{t('settings.backup.title')}</span>
        </CardTitle>
        <CardDescription>
          {t('settings.backup.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('settings.backup.simpleBackupDescription', 'Backups are created automatically during translation. Original files are preserved before translation, and results are saved after completion.')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}