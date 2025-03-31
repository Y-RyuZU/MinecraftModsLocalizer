"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import { TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";

interface DialogOptions {
  directory: boolean;
  multiple: boolean;
  title: string;
}

const mockOpen = async (options: DialogOptions): Promise<string | null> => {
  console.log('Opening dialog with options:', options);
  return '/mock/path';
};

export function QuestsTab() {
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

  // Scan for quests
  const handleScanQuests = async () => {
    try {
      setIsScanning(true);
      setError(null);
      
      // Check if config directory is set
      if (!config.paths.configDir) {
        const selected = await mockOpen({
          directory: true,
          multiple: false,
          title: "Select Minecraft Config Directory"
        });
        
        if (!selected) {
          setIsScanning(false);
          return;
        }
        
        // Update config with selected directory
        config.paths.configDir = selected;
      }
      
      // Get FTB quest files
      const ftbQuestFiles = await FileService.getFTBQuestFiles(config.paths.configDir);
      
      // Get Better Quests files
      const betterQuestFiles = await FileService.getBetterQuestFiles(config.paths.configDir);
      
      // Create translation targets
      const targets: TranslationTarget[] = [];
      
      // Add FTB quests
      for (let i = 0; i < ftbQuestFiles.length; i++) {
        const questFile = ftbQuestFiles[i];
        try {
          // In a real implementation, we would parse the quest file to get more information
          // For now, we'll just use the file path
          const fileName = questFile.split('/').pop() || "unknown";
          const questNumber = i + 1;
          
          targets.push({
            type: "ftb",
            id: `ftb-quest-${questNumber}`,
            name: `FTB Quest ${questNumber}: ${fileName}`,
            path: questFile,
            selected: false
          });
        } catch (error) {
          console.error(`Failed to analyze FTB quest: ${questFile}`, error);
        }
      }
      
      // Add Better Quests
      for (let i = 0; i < betterQuestFiles.length; i++) {
        const questFile = betterQuestFiles[i];
        try {
          // In a real implementation, we would parse the quest file to get more information
          // For now, we'll just use the file path
          const fileName = questFile.split('/').pop() || "unknown";
          const questNumber = i + 1;
          
          targets.push({
            type: "better",
            id: `better-quest-${questNumber}`,
            name: `Better Quest ${questNumber}: ${fileName}`,
            path: questFile,
            selected: false
          });
        } catch (error) {
          console.error(`Failed to analyze Better quest: ${questFile}`, error);
        }
      }
      
      setTranslationTargets(targets);
    } catch (error) {
      console.error("Failed to scan quests:", error);
      setError(`Failed to scan quests: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Select all quests
  const handleSelectAll = (checked: boolean) => {
    const updatedTargets = translationTargets.map(target => ({
      ...target,
      selected: checked
    }));
    
    setTranslationTargets(updatedTargets);
  };

  // Translate selected quests
  const handleTranslate = async () => {
    try {
      setTranslating(true);
      setProgress(0);
      setError(null);
      
      const selectedTargets = translationTargets.filter(target => target.selected);
      
      if (selectedTargets.length === 0) {
        setError("No quests selected for translation");
        setTranslating(false);
        return;
      }
      
      // Translate each quest
      for (let i = 0; i < selectedTargets.length; i++) {
        const target = selectedTargets[i];
        setProgress(Math.round((i / selectedTargets.length) * 100));
        
        try {
          // Read quest file
          const content = await FileService.readTextFile(target.path);
          
          // Translate content
          let translatedContent = "";
          
          if (target.type === "ftb") {
            translatedContent = await translateFTBQuest(
              content,
              config.translation.sourceLanguage,
              config.translation.targetLanguage
            );
          } else if (target.type === "better") {
            translatedContent = await translateBetterQuest(
              content,
              config.translation.sourceLanguage,
              config.translation.targetLanguage
            );
          }
          
          // Write translated file
          const outputPath = target.path.replace(
            `.${target.type}`,
            `.${config.translation.targetLanguage}.${target.type}`
          );
          
          await FileService.writeTextFile(outputPath, translatedContent);
          
          // Add translation result
          addTranslationResult({
            type: target.type,
            id: target.id,
            sourceLanguage: config.translation.sourceLanguage,
            targetLanguage: config.translation.targetLanguage,
            content: { [target.id]: translatedContent },
            outputPath
          });
        } catch (error) {
          console.error(`Failed to translate quest: ${target.name}`, error);
        }
      }
      
      setProgress(100);
    } catch (error) {
      console.error("Failed to translate quests:", error);
      setError(`Failed to translate quests: ${error}`);
    } finally {
      setTranslating(false);
    }
  };

  // Translate FTB quest
  const translateFTBQuest = async (
    content: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> => {
    // In a real implementation, this would use the LLM adapter to translate the content
    // For now, we'll just return a mock translation
    return `[${targetLanguage}] ${content}`;
  };

  // Translate Better quest
  const translateBetterQuest = async (
    content: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> => {
    // In a real implementation, this would use the LLM adapter to translate the content
    // For now, we'll just return a mock translation
    return `[${targetLanguage}] ${content}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handleScanQuests} disabled={isScanning || isTranslating}>
            {isScanning ? "Scanning..." : "Scan Quests"}
          </Button>
          <Button 
            onClick={handleTranslate} 
            disabled={isScanning || isTranslating || translationTargets.length === 0}
          >
            {isTranslating ? "Translating..." : "Translate Selected"}
          </Button>
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
            Translating quests... {progress}%
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
              <TableHead>Quest Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {translationTargets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {isScanning ? "Scanning for quests..." : "No quests found. Click 'Scan Quests' to scan for quests."}
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
                  <TableCell>{target.type === "ftb" ? "FTB Quest" : "Better Quest"}</TableCell>
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
