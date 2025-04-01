"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig } from "@/lib/types/config";

interface UISettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

export function UISettings({ config, setConfig }: UISettingsProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>UI Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <Select 
              value={config.ui.theme}
              onValueChange={(value: "light" | "dark" | "system") => {
                config.ui.theme = value;
                setConfig({ ...config });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Language setting removed as it's now handled by the language switcher */}
        </div>
      </CardContent>
    </Card>
  );
}
