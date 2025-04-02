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
              <p className="text-sm text-muted-foreground">{config.paths.minecraft_dir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("minecraft_dir")}>
              Select
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Mods Directory</label>
              <p className="text-sm text-muted-foreground">{config.paths.mods_dir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("mods_dir")}>
              Select
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Resource Packs Directory</label>
              <p className="text-sm text-muted-foreground">{config.paths.resource_packs_dir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("resource_packs_dir")}>
              Select
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Config Directory</label>
              <p className="text-sm text-muted-foreground">{config.paths.config_dir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("config_dir")}>
              Select
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Logs Directory</label>
              <p className="text-sm text-muted-foreground">{config.paths.logs_dir || "Not set"}</p>
            </div>
            <Button onClick={() => onSelectDirectory("logs_dir")}>
              Select
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
