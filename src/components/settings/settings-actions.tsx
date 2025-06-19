"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppTranslation } from "@/lib/i18n";

interface SettingsActionsProps {
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function SettingsActions({ isSaving, onSave, onReset }: SettingsActionsProps) {
  const { t } = useAppTranslation();
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-end space-x-2">
          <Button variant="outline" onClick={onReset}>
            {t('settings.resetToDefaults')}
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? t('settings.saving') : t('settings.saveSettings')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
