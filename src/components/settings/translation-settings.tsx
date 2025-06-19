"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig } from "@/lib/types/config";
import { useAppTranslation } from "@/lib/i18n";

interface TranslationSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

export function TranslationSettings({ config, setConfig }: TranslationSettingsProps) {
  const { t } = useAppTranslation();
  
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Translation Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Resource Pack Name</label>
            <Input 
              value={config.translation.resourcePackName}
              onChange={(e) => {
                config.translation.resourcePackName = e.target.value;
                setConfig({ ...config });
              }}
              placeholder="Enter resource pack name"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Mod Chunk Size</label>
            <Input 
              type="number"
              value={config.translation.modChunkSize}
              onChange={(e) => {
                config.translation.modChunkSize = parseInt(e.target.value);
                setConfig({ ...config });
              }}
              placeholder="Enter chunk size"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Quest Chunk Size</label>
            <Input 
              type="number"
              value={config.translation.questChunkSize}
              onChange={(e) => {
                config.translation.questChunkSize = parseInt(e.target.value);
                setConfig({ ...config });
              }}
              placeholder="Enter chunk size"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Guidebook Chunk Size</label>
            <Input 
              type="number"
              value={config.translation.guidebookChunkSize}
              onChange={(e) => {
                config.translation.guidebookChunkSize = parseInt(e.target.value);
                setConfig({ ...config });
              }}
              placeholder="Enter chunk size"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
