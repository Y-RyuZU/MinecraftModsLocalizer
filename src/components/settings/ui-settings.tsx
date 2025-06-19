"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig } from "@/lib/types/config";
import { useAppTranslation } from "@/lib/i18n";

interface UISettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

export function UISettings({ config, setConfig }: UISettingsProps) {
  const { t } = useAppTranslation();
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t('settings.uiSettings')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings.theme')}</label>
            <Select 
              value={config.ui.theme}
              onValueChange={(value: "light" | "dark" | "system") => {
                config.ui.theme = value;
                setConfig({ ...config });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('settings.selectTheme')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('settings.light')}</SelectItem>
                <SelectItem value="dark">{t('settings.dark')}</SelectItem>
                <SelectItem value="system">{t('settings.system')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Language setting removed as it's now handled by the language switcher */}
        </div>
      </CardContent>
    </Card>
  );
}
