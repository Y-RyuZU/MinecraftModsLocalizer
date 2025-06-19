"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig, PathsConfig } from "@/lib/types/config";
import { useAppTranslation } from "@/lib/i18n";

interface PathSettingsProps {
  config: AppConfig;
  onSelectDirectory: (path: keyof PathsConfig) => Promise<void>;
}

export function PathSettings({ config, onSelectDirectory }: PathSettingsProps) {
  const { t } = useAppTranslation();
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.pathSettings')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">{t('settings.minecraftDirectory')}</label>
              <p className="text-sm text-muted-foreground">{config.paths.minecraftDir || t('settings.notSet')}</p>
            </div>
            <Button onClick={() => onSelectDirectory("minecraftDir")}>
              {t('settings.select')}
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">{t('settings.modsDirectory')}</label>
              <p className="text-sm text-muted-foreground">{config.paths.modsDir || t('settings.notSet')}</p>
            </div>
            <Button onClick={() => onSelectDirectory("modsDir")}>
              {t('settings.select')}
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">{t('settings.resourcePacksDirectory')}</label>
              <p className="text-sm text-muted-foreground">{config.paths.resourcePacksDir || t('settings.notSet')}</p>
            </div>
            <Button onClick={() => onSelectDirectory("resourcePacksDir")}>
              {t('settings.select')}
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">{t('settings.configDirectory')}</label>
              <p className="text-sm text-muted-foreground">{config.paths.configDir || t('settings.notSet')}</p>
            </div>
            <Button onClick={() => onSelectDirectory("configDir")}>
              {t('settings.select')}
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">{t('settings.logsDirectory')}</label>
              <p className="text-sm text-muted-foreground">{config.paths.logsDir || t('settings.notSet')}</p>
            </div>
            <Button onClick={() => onSelectDirectory("logsDir")}>
              {t('settings.select')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
