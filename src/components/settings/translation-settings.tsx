"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AppConfig } from "@/lib/types/config";
import { DEFAULT_LANGUAGES } from "@/lib/types/llm";

interface TranslationSettingsProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}

export function TranslationSettings({ config, setConfig }: TranslationSettingsProps) {
  const [customLanguageName, setCustomLanguageName] = useState("");
  const [customLanguageId, setCustomLanguageId] = useState("");
  
  // Add custom language
  const handleAddCustomLanguage = () => {
    if (!customLanguageName || !customLanguageId) return;
    
    // Initialize customLanguages array if it doesn't exist
    if (!config.translation.customLanguages) {
      config.translation.customLanguages = [];
    }
    
    // Add new custom language
    config.translation.customLanguages.push({
      name: customLanguageName,
      id: customLanguageId
    });
    
    // Update config
    setConfig({ ...config });
    
    // Clear input fields
    setCustomLanguageName("");
    setCustomLanguageId("");
  };
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Translation Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Source Language</label>
            <Input 
              value={config.translation.sourceLanguage}
              onChange={(e) => {
                config.translation.sourceLanguage = e.target.value;
                setConfig({ ...config });
              }}
              placeholder="e.g., en_us"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Language</label>
            <Select 
              value={config.translation.targetLanguage}
              onValueChange={(value) => {
                config.translation.targetLanguage = value;
                setConfig({ ...config });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target language" />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.name} ({lang.id})
                  </SelectItem>
                ))}
                {config.translation.customLanguages?.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.name} ({lang.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Add Custom Language</label>
            <div className="flex space-x-2">
              <Input 
                placeholder="Language name (e.g., Italian)"
                value={customLanguageName}
                onChange={(e) => setCustomLanguageName(e.target.value)}
              />
              <Input 
                placeholder="Language ID (e.g., it_it)"
                value={customLanguageId}
                onChange={(e) => setCustomLanguageId(e.target.value)}
              />
              <Button 
                onClick={handleAddCustomLanguage}
                disabled={!customLanguageName || !customLanguageId}
              >
                Add
              </Button>
            </div>
          </div>
          
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
