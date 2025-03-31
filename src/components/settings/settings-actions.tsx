"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SettingsActionsProps {
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function SettingsActions({ isSaving, onSave, onReset }: SettingsActionsProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-end space-x-2">
          <Button variant="outline" onClick={onReset}>
            Reset to Defaults
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
