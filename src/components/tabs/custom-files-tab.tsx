"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import { TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { useAppTranslation } from "@/lib/i18n";
import { TranslationService } from "@/lib/services/translation-service";


export function CustomFilesTab() {
  const [isScanning, setIsScanning] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [customDirectory, setCustomDirectory] = useState<string | null>(null);
  const { t } = useAppTranslation();
  
  const { 
    config, 
    customFilesTranslationTargets, 
    setCustomFilesTranslationTargets, 
    updateCustomFilesTranslationTarget,
    isTranslating,
    progress,
    setTranslating,
    setProgress,
    addTranslationResult,
    error,
    setError
  } = useAppStore();

  // Select directory
  const handleSelectDirectory = async () => {
    try {
      const selected = await FileService.openDirectoryDialog("Select Directory with JSON/SNBT Files");
      
      if (selected) {
        // Check if the path has the NATIVE_DIALOG prefix
        if (selected.startsWith("NATIVE_DIALOG:")) {
          // Remove the prefix
          const actualPath = selected.substring("NATIVE_DIALOG:".length);
          console.log("Native dialog was used!");
          setCustomDirectory(actualPath);
          // Show a success message
          setError(null);
        } else {
          console.log("Mock dialog was used!");
          setCustomDirectory(selected);
          // Show a warning message
          setError("Warning: Mock dialog was used instead of native dialog");
        }
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
      setError(`Failed to select directory: ${error}`);
    }
  };

  // Scan for files
  const handleScanFiles = async () => {
    if (!customDirectory) {
      setError(t('errors.selectDirectoryFirst'));
      return;
    }

    try {
      setIsScanning(true);
      setError(null);
      
      // Get JSON and SNBT files
      const jsonFiles = await FileService.getFilesWithExtension(customDirectory, ".json");
      const snbtFiles = await FileService.getFilesWithExtension(customDirectory, ".snbt");
      
      // Combine files
      const allFiles = [...jsonFiles, ...snbtFiles];
      
      // Create translation targets
      const targets: TranslationTarget[] = [];
      
      for (let i = 0; i < allFiles.length; i++) {
        const filePath = allFiles[i];
        try {
          // Get file name
          const fileName = filePath.split('/').pop() || "unknown";
          
          targets.push({
            type: "custom",
            id: `custom-file-${i + 1}`,
            name: fileName,
            path: filePath,
            selected: true
          });
        } catch (error) {
          console.error(`Failed to process file: ${filePath}`, error);
        }
      }
      
      setCustomFilesTranslationTargets(targets);
    } catch (error) {
      console.error("Failed to scan files:", error);
      setError(`Failed to scan files: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Select all files
  const handleSelectAll = (checked: boolean) => {
    const updatedTargets = customFilesTranslationTargets.map(target => ({
      ...target,
      selected: checked
    }));
    
    setCustomFilesTranslationTargets(updatedTargets);
  };

  // Translate selected files
  const handleTranslate = async () => {
    try {
      setTranslating(true);
      setProgress(0);
      setError(null);
      
      const selectedTargets = customFilesTranslationTargets.filter(target => target.selected);
      
      if (selectedTargets.length === 0) {
        setError(t('errors.noFilesSelected'));
        setTranslating(false);
        return;
      }
      
      // Create output directory
      const outputDir = `${customDirectory}/translated`;
      await FileService.createDirectory(outputDir);
      
      // Translate each file
      for (let i = 0; i < selectedTargets.length; i++) {
        const target = selectedTargets[i];
        setProgress(Math.round((i / selectedTargets.length) * 100));
        
        try {
          // Read file content
          const content = await FileService.readTextFile(target.path);
          
          // Determine file type
          const isJson = target.path.toLowerCase().endsWith('.json');
          const isSnbt = target.path.toLowerCase().endsWith('.snbt');
          
          // Translate content
          let translatedContent = "";
          
          if (isJson) {
            translatedContent = await translateJsonContent(
              content,
              config.translation.sourceLanguage,
              config.translation.targetLanguage
            );
          } else if (isSnbt) {
            translatedContent = await translateSnbtContent(
              content,
              config.translation.sourceLanguage,
              config.translation.targetLanguage
            );
          } else {
            console.warn(`Unsupported file type: ${target.path}`);
            continue;
          }
          
          // Get file name
          const fileName = target.path.split('/').pop() || "unknown";
          
          // Create output path
          const outputPath = `${outputDir}/${config.translation.targetLanguage}_${fileName}`;
          
          // Write translated file
          await FileService.writeTextFile(outputPath, translatedContent);
          
          // Add translation result
          addTranslationResult({
            type: "custom",
            id: target.id,
            sourceLanguage: config.translation.sourceLanguage,
            targetLanguage: config.translation.targetLanguage,
            content: { [target.id]: translatedContent },
            outputPath
          });
        } catch (error) {
          console.error(`Failed to translate file: ${target.name}`, error);
        }
      }
      
      setProgress(100);
    } catch (error) {
      console.error("Failed to translate files:", error);
      setError(`Failed to translate files: ${error}`);
    } finally {
      setTranslating(false);
    }
  };

  // Translate JSON content
  const translateJsonContent = async (
    content: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> => {
    try {
      // Parse JSON
      const jsonData = JSON.parse(content);
      
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
      });
      
      // Translate the JSON content recursively
      const translatedJson = await translateJsonRecursively(jsonData, translationService, sourceLanguage, targetLanguage);
      
      // Stringify JSON
      return JSON.stringify(translatedJson, null, 2);
    } catch (error) {
      console.error("Failed to translate JSON content:", error);
      return `[${targetLanguage}] ${content}`;
    }
  };

  // Translate JSON recursively
  const translateJsonRecursively = async (
    json: unknown,
    translationService: TranslationService,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<unknown> => {
    if (typeof json === 'string') {
      // Create a translation job with a simple key-value structure
      const job = translationService.createJob(
        { text: json },
        sourceLanguage,
        targetLanguage
      );
      
      // Start the translation job
      await translationService.startJob(job.id);
      
      // Get the translated content
      const translatedContent = translationService.getCombinedTranslatedContent(job.id);
      return translatedContent.text || `[${targetLanguage}] ${json}`;
    } else if (Array.isArray(json)) {
      const translatedArray = [];
      for (const item of json) {
        translatedArray.push(await translateJsonRecursively(item, translationService, sourceLanguage, targetLanguage));
      }
      return translatedArray;
    } else if (typeof json === 'object' && json !== null) {
      const result: Record<string, unknown> = {};
      for (const key in json) {
        result[key] = await translateJsonRecursively(json[key], translationService, sourceLanguage, targetLanguage);
      }
      return result;
    } else {
      return json;
    }
  };

  // Translate SNBT content
  const translateSnbtContent = async (
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
      });
      
      // Create a translation job with a simple key-value structure
      const job = translationService.createJob(
        { content },
        sourceLanguage,
        targetLanguage
      );
      
      // Start the translation job
      await translationService.startJob(job.id);
      
      // Get the translated content
      const translatedContent = translationService.getCombinedTranslatedContent(job.id);
      return translatedContent.content || `[${targetLanguage}] ${content}`;
    } catch (error) {
      console.error("Failed to translate SNBT content:", error);
      return `[${targetLanguage}] ${content}`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handleSelectDirectory} disabled={isScanning || isTranslating}>
            {t('buttons.selectDirectory')}
          </Button>
          <Button onClick={handleScanFiles} disabled={!customDirectory || isScanning || isTranslating}>
            {isScanning ? t('buttons.scanning') : t('buttons.scanFiles')}
          </Button>
          <Button 
            onClick={handleTranslate} 
            disabled={isScanning || isTranslating || customFilesTranslationTargets.length === 0}
          >
            {isTranslating ? t('buttons.translating') : t('buttons.translate')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            placeholder={t('filters.filterFiles')}
            className="w-[250px]" 
            disabled={isScanning || isTranslating}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>
      
      {customDirectory && (
        <div className="text-sm text-muted-foreground">
          {t('misc.selectedDirectory')} {customDirectory}
        </div>
      )}
      
      {error && (
        <div className="bg-destructive/20 text-destructive p-2 rounded">
          {error}
        </div>
      )}
      
      {isTranslating && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {t('progress.translatingFiles')} {progress}%
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
                  disabled={isScanning || isTranslating || customFilesTranslationTargets.length === 0}
                />
              </TableHead>
              <TableHead>{t('tables.fileName')}</TableHead>
              <TableHead>{t('tables.type')}</TableHead>
              <TableHead>{t('tables.path')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customFilesTranslationTargets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {isScanning ? t('tables.scanningForFiles') : t('tables.noFilesFound')}
                </TableCell>
              </TableRow>
            ) : (
              customFilesTranslationTargets
                .filter(target => 
                  filterText === "" || 
                  target.name.toLowerCase().includes(filterText.toLowerCase())
                )
                .map((target) => (
                <TableRow key={target.id}>
                  <TableCell>
                    <Checkbox 
                      checked={target.selected}
                      onCheckedChange={(checked) => updateCustomFilesTranslationTarget(target.id, !!checked)}
                      disabled={isScanning || isTranslating}
                    />
                  </TableCell>
                  <TableCell>{target.name}</TableCell>
                  <TableCell>{target.path.toLowerCase().endsWith('.json') ? "JSON" : "SNBT"}</TableCell>
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
