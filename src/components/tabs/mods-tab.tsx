"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import { TranslationTarget, ModInfo, LangFile } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";

// Mock functions for development
const mockInvoke = async <T,>(command: string, args?: Record<string, unknown>): Promise<T> => {
  console.log(`Invoking command: ${command}`, args);
  
  if (command === "analyze_mod_jar") {
    // Extract the mod number from the path to create unique IDs
    const modPath = args?.jarPath as string;
    const modNumber = modPath.match(/example-mod-(\d+)\.jar$/)?.[1] || "1";
    
    return {
      id: `example-mod-${modNumber}`,
      name: `Example Mod ${modNumber}`,
      version: "1.0.0",
      jar_path: args?.jarPath,
      lang_files: [{ language: "en_us", path: `assets/example/lang/en_us.json`, content: {} }],
      patchouli_books: []
    } as unknown as T;
  }
  
  if (command === "extract_lang_files") {
    return [
      {
        language: "en_us",
        path: "assets/example/lang/en_us.json",
        content: {
          "block.example.test": "Test Block",
          "item.example.test": "Test Item"
        }
      }
    ] as unknown as T;
  }
  
  return {} as T;
};

interface DialogOptions {
  directory: boolean;
  multiple: boolean;
  title: string;
}

const mockOpen = async (options: DialogOptions): Promise<string | null> => {
  console.log('Opening dialog with options:', options);
  return '/mock/path';
};

export function ModsTab() {
  const [isScanning, setIsScanning] = useState(false);
  const { 
    config, 
    translationTargets, 
    setTranslationTargets, 
    updateTranslationTarget,
    isTranslating,
    progress,
    setTranslating,
    setProgress,
    addTranslationResult,
    error,
    setError
  } = useAppStore();

  // Scan for mods
  const handleScanMods = async () => {
    try {
      setIsScanning(true);
      setError(null);
      
      // Check if mods directory is set
      if (!config.paths.modsDir) {
        const selected = await mockOpen({
          directory: true,
          multiple: false,
          title: "Select Minecraft Mods Directory"
        });
        
        if (!selected) {
          setIsScanning(false);
          return;
        }
        
        // Update config with selected directory
        config.paths.modsDir = selected;
      }
      
      // Get mod files
      const modFiles = await FileService.getModFiles(config.paths.modsDir);
      
      // Create translation targets
      const targets: TranslationTarget[] = [];
      
      for (const modFile of modFiles) {
        try {
          const modInfo = await mockInvoke<ModInfo>("analyze_mod_jar", { jarPath: modFile });
          
          if (modInfo.lang_files && modInfo.lang_files.length > 0) {
            targets.push({
              type: "mod",
              id: modInfo.id,
              name: modInfo.name,
              path: modFile,
              selected: false
            });
          }
        } catch (error) {
          console.error(`Failed to analyze mod: ${modFile}`, error);
        }
      }
      
      setTranslationTargets(targets);
    } catch (error) {
      console.error("Failed to scan mods:", error);
      setError(`Failed to scan mods: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Select all mods
  const handleSelectAll = (checked: boolean) => {
    const updatedTargets = translationTargets.map(target => ({
      ...target,
      selected: checked
    }));
    
    setTranslationTargets(updatedTargets);
  };

  // Translate selected mods
  const handleTranslate = async () => {
    try {
      setTranslating(true);
      setProgress(0);
      setError(null);
      
      const selectedTargets = translationTargets.filter(target => target.selected);
      
      if (selectedTargets.length === 0) {
        setError("No mods selected for translation");
        setTranslating(false);
        return;
      }
      
      // Check if resource packs directory is set
      if (!config.paths.resourcePacksDir) {
        const selected = await mockOpen({
          directory: true,
          multiple: false,
          title: "Select Minecraft Resource Packs Directory"
        });
        
        if (!selected) {
          setTranslating(false);
          return;
        }
        
        // Update config with selected directory
        config.paths.resourcePacksDir = selected;
      }
      
      // Create resource pack
      const resourcePackDir = await FileService.createResourcePack(
        config.translation.resourcePackName,
        config.translation.targetLanguage,
        config.paths.resourcePacksDir
      );
      
      // Translate each mod
      for (let i = 0; i < selectedTargets.length; i++) {
        const target = selectedTargets[i];
        setProgress(Math.round((i / selectedTargets.length) * 100));
        
        try {
          // Extract language files
          const langFiles = await mockInvoke<LangFile[]>("extract_lang_files", { 
            jarPath: target.path,
            tempDir: ""
          });
          
          // Find source language file
          const sourceFile = langFiles.find((file) => 
            file.language === config.translation.sourceLanguage
          );
          
          if (!sourceFile) {
            console.warn(`Source language file not found for mod: ${target.name}`);
            continue;
          }
          
          // Translate content
          const translatedContent = await translateModContent(
            sourceFile.content,
            config.translation.sourceLanguage,
            config.translation.targetLanguage
          );
          
          // Write translated file to resource pack
          await FileService.writeLangFile(
            target.id,
            config.translation.targetLanguage,
            translatedContent,
            resourcePackDir
          );
          
          // Add translation result
          addTranslationResult({
            type: "mod",
            id: target.id,
            sourceLanguage: config.translation.sourceLanguage,
            targetLanguage: config.translation.targetLanguage,
            content: translatedContent,
            outputPath: resourcePackDir
          });
        } catch (error) {
          console.error(`Failed to translate mod: ${target.name}`, error);
        }
      }
      
      setProgress(100);
    } catch (error) {
      console.error("Failed to translate mods:", error);
      setError(`Failed to translate mods: ${error}`);
    } finally {
      setTranslating(false);
    }
  };

  // Translate mod content
  const translateModContent = async (
    content: Record<string, string>,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<Record<string, string>> => {
    // In a real implementation, this would use the LLM adapter to translate the content
    // For now, we'll just return a mock translation
    const translated: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(content)) {
      translated[key] = `[${targetLanguage}] ${value}`;
    }
    
    return translated;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handleScanMods} disabled={isScanning || isTranslating}>
            {isScanning ? "Scanning..." : "Scan Mods"}
          </Button>
          <Button 
            onClick={handleTranslate} 
            disabled={isScanning || isTranslating || translationTargets.length === 0}
          >
            {isTranslating ? "Translating..." : "Translate Selected"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            placeholder="Filter mods..." 
            className="w-[250px]" 
            disabled={isScanning || isTranslating}
          />
        </div>
      </div>
      
      {error && (
        <div className="bg-destructive/20 text-destructive p-2 rounded">
          {error}
        </div>
      )}
      
      {isTranslating && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            Translating mods... {progress}%
          </p>
        </div>
      )}
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  disabled={isScanning || isTranslating || translationTargets.length === 0}
                />
              </TableHead>
              <TableHead>Mod Name</TableHead>
              <TableHead>Mod ID</TableHead>
              <TableHead>Path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {translationTargets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {isScanning ? "Scanning for mods..." : "No mods found. Click 'Scan Mods' to scan for mods."}
                </TableCell>
              </TableRow>
            ) : (
              translationTargets.map((target) => (
                <TableRow key={target.id}>
                  <TableCell>
                    <Checkbox 
                      checked={target.selected}
                      onCheckedChange={(checked) => updateTranslationTarget(target.id, !!checked)}
                      disabled={isScanning || isTranslating}
                    />
                  </TableCell>
                  <TableCell>{target.name}</TableCell>
                  <TableCell>{target.id}</TableCell>
                  <TableCell className="truncate max-w-[300px]">{target.path}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
