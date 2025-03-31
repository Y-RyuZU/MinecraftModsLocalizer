"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig } from "@/lib/types/config";

interface PathSettingsProps {
  config: AppConfig;
  onSelectDirectory: (path: keyof typeof config.paths) => Promise<void>;
}

export function PathSettings({ config, onSelectDirectory }: PathSettingsProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Path Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Minecraft Directory</label>
              <p className="text-sm text-muted-foreground">{config.paths.minecraftDir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("minecraftDir")}>
              Select
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Mods Directory</label>
              <p className="text-sm text-muted-foreground">{config.paths.modsDir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("modsDir")}>
              Select
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Resource Packs Directory</label>
              <p className="text-sm text-muted-foreground">{config.paths.resourcePacksDir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("resourcePacksDir")}>
              Select
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Config Directory</label>
              <p className="text-sm text-muted-foreground">{config.paths.configDir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("configDir")}>
              Select
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Logs Directory</label>
              <p className="text-sm text-muted-foreground">{config.paths.logsDir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("logsDir")}>
              Select
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
