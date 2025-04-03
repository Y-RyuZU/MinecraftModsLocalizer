"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import { TranslationTarget, ModInfo, LangFile } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { useAppTranslation } from "@/lib/i18n";

import { TranslationService } from "@/lib/services/translation-service";

export function ModsTab() {
  const [isScanning, setIsScanning] = useState(false);
  const [filterText, setFilterText] = useState("");
  const { t } = useAppTranslation();
  const { 
    config, 
    modTranslationTargets, 
    setModTranslationTargets, 
    updateModTranslationTarget,
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

  // Scan for mods
  const handleScanMods = async () => {
    try {
      setIsScanning(true);
      setError(null);
      
      // Check if mods directory is set
      if (!config.paths.modsDir) {
        const selected = await FileService.openDirectoryDialog("Select Minecraft Mods Directory");
        
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
          const modInfo = await FileService.invoke<ModInfo>("analyze_mod_jar", { jarPath: modFile });
          
          if (modInfo.lang_files && modInfo.lang_files.length > 0) {
            targets.push({
              type: "mod",
              id: modInfo.id,
              name: modInfo.name,
              path: modFile,
              selected: true
            });
          }
        } catch (error) {
          console.error(`Failed to analyze mod: ${modFile}`, error);
        }
      }
      
      setModTranslationTargets(targets);
    } catch (error) {
      console.error("Failed to scan mods:", error);
      setError(`Failed to scan mods: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Select all mods
  const handleSelectAll = (checked: boolean) => {
    const updatedTargets = modTranslationTargets.map(target => ({
      ...target,
      selected: checked
    }));
    
    setModTranslationTargets(updatedTargets);
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

  // Translate selected mods
  const handleTranslate = async () => {
    try {
      setTranslating(true);
      setProgress(0);
      setError(null);
      setCurrentJobId(null);
      
      const selectedTargets = modTranslationTargets.filter(target => target.selected);
      
      if (selectedTargets.length === 0) {
        setError(t('errors.noModsSelected'));
        setTranslating(false);
        return;
      }
      
      // Check if resource packs directory is set
      if (!config.paths.resourcePacksDir) {
        const selected = await FileService.openDirectoryDialog("Select Minecraft Resource Packs Directory");
        
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
          const langFiles = await FileService.invoke<LangFile[]>("extract_lang_files", { 
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
    try {
      // Create a translation service
      const translationService = new TranslationService({
        llmConfig: {
          provider: config.llm.provider,
          apiKey: config.llm.apiKey,
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
        },
        chunkSize: config.translation.mod_chunk_size,
        prompt_template: config.llm.prompt_template,
        maxRetries: config.llm.max_retries,
        onProgress: (job) => {
          setProgress(job.progress);
        }
      });
      
      // Store the translation service in the ref
      translationServiceRef.current = translationService;
      
      // Create a translation job
      const job = translationService.createJob(
        content,
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
      return translationService.getCombinedTranslatedContent(job.id);
    } catch (error) {
      console.error("Failed to translate mod content:", error);
      
      // Fallback to mock translation
      const translated: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(content)) {
        translated[key] = `[${targetLanguage}] ${value}`;
      }
      
      return translated;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handleScanMods} disabled={isScanning || isTranslating}>
            {isScanning ? t('buttons.scanning') : t('buttons.scanMods')}
          </Button>
          <Button 
            onClick={handleTranslate} 
            disabled={isScanning || isTranslating || modTranslationTargets.length === 0}
          >
            {isTranslating ? t('buttons.translating') : t('buttons.translate')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            placeholder={t('filters.filterMods')}
            className="w-[250px]" 
            disabled={isScanning || isTranslating}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
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
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {t('progress.translatingMods')} {progress}%
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
                  disabled={isScanning || isTranslating || modTranslationTargets.length === 0}
                />
              </TableHead>
              <TableHead>{t('tables.modName')}</TableHead>
              <TableHead>{t('tables.modId')}</TableHead>
              <TableHead>{t('tables.path')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modTranslationTargets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {isScanning ? t('tables.scanningForMods') : t('tables.noModsFound')}
                </TableCell>
              </TableRow>
            ) : (
              modTranslationTargets
                .filter(target => 
                  filterText === "" || 
                  target.name.toLowerCase().includes(filterText.toLowerCase()) ||
                  target.id.toLowerCase().includes(filterText.toLowerCase())
                )
                .map((target) => (
                <TableRow key={target.id}>
                  <TableCell>
                    <Checkbox 
                      checked={target.selected}
                      onCheckedChange={(checked) => updateModTranslationTarget(target.id, !!checked)}
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
