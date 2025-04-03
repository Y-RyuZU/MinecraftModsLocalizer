"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import { TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { useAppTranslation } from "@/lib/i18n";

import { TranslationService } from "@/lib/services/translation-service";

export function QuestsTab() {
  const [isScanning, setIsScanning] = useState(false);
  const { t } = useAppTranslation();
  const { 
    config, 
    questTranslationTargets, 
    setQuestTranslationTargets, 
    updateQuestTranslationTarget,
    isTranslating,
    progress,
    setTranslating,
    setProgress,
    addTranslationResult,
    error,
    setError,
    currentJobId,
    setCurrentJobId
  } = useAppStore();
  
  // Reference to the translation service
  const translationServiceRef = useRef<TranslationService | null>(null);

  // Scan for quests
  const handleScanQuests = async () => {
    try {
      setIsScanning(true);
      setError(null);
      
      // Check if config directory is set
      if (!config.paths.configDir) {
        const selected = await FileService.openDirectoryDialog("Select Minecraft Config Directory");
        
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
            selected: true
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
            selected: true
          });
        } catch (error) {
          console.error(`Failed to analyze Better quest: ${questFile}`, error);
        }
      }
      
      setQuestTranslationTargets(targets);
    } catch (error) {
      console.error("Failed to scan quests:", error);
      setError(`Failed to scan quests: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Select all quests
  const handleSelectAll = (checked: boolean) => {
    const updatedTargets = questTranslationTargets.map(target => ({
      ...target,
      selected: checked
    }));
    
    setQuestTranslationTargets(updatedTargets);
  };
  
  // Cancel translation
  const handleCancelTranslation = () => {
    if (currentJobId && translationServiceRef.current) {
      translationServiceRef.current.interruptJob(currentJobId);
      setError(t('info.translationCancelled'));
      setCurrentJobId(null);
      setTranslating(false);
      setProgress(0);
    }
  };

  // Translate selected quests
  const handleTranslate = async () => {
    try {
      setTranslating(true);
      setProgress(0);
      setError(null);
      setCurrentJobId(null);
      
      const selectedTargets = questTranslationTargets.filter(target => target.selected);
      
      if (selectedTargets.length === 0) {
        setError(t('errors.noQuestsSelected'));
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
    try {
      // Create a translation service
      const translationService = new TranslationService({
        llmConfig: {
          provider: config.llm.provider,
          apiKey: config.llm.apiKey,
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
        },
        chunkSize: config.translation.quest_chunk_size,
        prompt_template: config.llm.prompt_template,
        maxRetries: config.llm.max_retries,
        onProgress: (job) => {
          setProgress(job.progress);
        }
      });
      
      // Store the translation service in the ref
      translationServiceRef.current = translationService;
      
      // Create a translation job with a simple key-value structure
      const job = translationService.createJob(
        { content },
        sourceLanguage,
        targetLanguage
      );
      
      // Store the job ID
      setCurrentJobId(job.id);
      
      // Start the translation job
      await translationService.startJob(job.id);
      
      // Clear the job ID
      setCurrentJobId(null);
      
      // Get the translated content
      const translatedContent = translationService.getCombinedTranslatedContent(job.id);
      return translatedContent.content || `[${targetLanguage}] ${content}`;
    } catch (error) {
      console.error("Failed to translate FTB quest content:", error);
      return `[${targetLanguage}] ${content}`;
    }
  };

  // Translate Better quest
  const translateBetterQuest = async (
    content: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> => {
    try {
      // Create a translation service
      const translationService = new TranslationService({
        llmConfig: {
          provider: config.llm.provider,
          apiKey: config.llm.apiKey,
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
        },
        chunkSize: config.translation.quest_chunk_size,
        prompt_template: config.llm.prompt_template,
        maxRetries: config.llm.max_retries,
        onProgress: (job) => {
          setProgress(job.progress);
        }
      });
      
      // Store the translation service in the ref
      translationServiceRef.current = translationService;
      
      // Create a translation job with a simple key-value structure
      const job = translationService.createJob(
        { content },
        sourceLanguage,
        targetLanguage
      );
      
      // Store the job ID
      setCurrentJobId(job.id);
      
      // Start the translation job
      await translationService.startJob(job.id);
      
      // Clear the job ID
      setCurrentJobId(null);
      
      // Get the translated content
      const translatedContent = translationService.getCombinedTranslatedContent(job.id);
      return translatedContent.content || `[${targetLanguage}] ${content}`;
    } catch (error) {
      console.error("Failed to translate Better quest content:", error);
      return `[${targetLanguage}] ${content}`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handleScanQuests} disabled={isScanning || isTranslating}>
            {isScanning ? t('buttons.scanning') : t('buttons.scanQuests')}
          </Button>
          <Button 
            onClick={handleTranslate} 
            disabled={isScanning || isTranslating || questTranslationTargets.length === 0}
          >
            {isTranslating ? t('buttons.translating') : t('buttons.translate')}
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
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {t('progress.translatingQuests')} {progress}%
              </p>
            </div>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleCancelTranslation}
              disabled={!currentJobId}
            >
              {t('buttons.cancel')}
            </Button>
          </div>
        </div>
      )}
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  disabled={isScanning || isTranslating || questTranslationTargets.length === 0}
                />
              </TableHead>
              <TableHead>{t('tables.questName')}</TableHead>
              <TableHead>{t('tables.type')}</TableHead>
              <TableHead>{t('tables.path')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questTranslationTargets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {isScanning ? t('tables.scanningForQuests') : t('tables.noQuestsFound')}
                </TableCell>
              </TableRow>
            ) : (
              questTranslationTargets.map((target) => (
                <TableRow key={target.id}>
                  <TableCell>
                    <Checkbox 
                      checked={target.selected}
                      onCheckedChange={(checked) => updateQuestTranslationTarget(target.id, !!checked)}
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
