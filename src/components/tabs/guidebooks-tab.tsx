"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import { TranslationTarget, PatchouliBook } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { useAppTranslation } from "@/lib/i18n";

import { TranslationService } from "@/lib/services/translation-service";

export function GuidebooksTab() {
  const [isScanning, setIsScanning] = useState(false);
  const { t } = useAppTranslation();
  const { 
    config, 
    guidebookTranslationTargets, 
    setGuidebookTranslationTargets, 
    updateGuidebookTranslationTarget,
    isTranslating,
    progress,
    setTranslating,
    setProgress,
    addTranslationResult,
    error,
    setError
  } = useAppStore();

  // Scan for guidebooks
  const handleScanGuidebooks = async () => {
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
          // Extract Patchouli books
          const books = await FileService.invoke<PatchouliBook[]>("extract_patchouli_books", { 
            jarPath: modFile,
            tempDir: ""
          });
          
          if (books.length > 0) {
            for (const book of books) {
              targets.push({
                type: "patchouli",
                id: book.id,
                name: `${book.mod_id}: ${book.name}`,
                path: modFile,
                selected: true
              });
            }
          }
        } catch (error) {
          console.error(`Failed to extract guidebooks from mod: ${modFile}`, error);
        }
      }
      
      setGuidebookTranslationTargets(targets);
    } catch (error) {
      console.error("Failed to scan guidebooks:", error);
      setError(`Failed to scan guidebooks: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Select all guidebooks
  const handleSelectAll = (checked: boolean) => {
    const updatedTargets = guidebookTranslationTargets.map(target => ({
      ...target,
      selected: checked
    }));
    
    setGuidebookTranslationTargets(updatedTargets);
  };

  // Translate selected guidebooks
  const handleTranslate = async () => {
    try {
      setTranslating(true);
      setProgress(0);
      setError(null);
      
      const selectedTargets = guidebookTranslationTargets.filter(target => target.selected);
      
      if (selectedTargets.length === 0) {
        setError(t('errors.noGuidebooksSelected'));
        setTranslating(false);
        return;
      }
      
      // Translate each guidebook
      for (let i = 0; i < selectedTargets.length; i++) {
        const target = selectedTargets[i];
        setProgress(Math.round((i / selectedTargets.length) * 100));
        
        try {
          // Extract Patchouli books
          const books = await FileService.invoke<PatchouliBook[]>("extract_patchouli_books", { 
            jarPath: target.path,
            tempDir: ""
          });
          
          // Find the book
          const book = books.find(b => b.id === target.id);
          
          if (!book) {
            console.warn(`Book not found: ${target.id}`);
            continue;
          }
          
          // Find source language file
          const sourceFile = book.lang_files.find(file => 
            file.language === config.translation.sourceLanguage
          );
          
          if (!sourceFile) {
            console.warn(`Source language file not found for book: ${target.name}`);
            continue;
          }
          
          // Translate content
          const translatedContent = await translateGuidebookContent(
            sourceFile.content,
            config.translation.sourceLanguage,
            config.translation.targetLanguage
          );
          
          // Write translated file to JAR
          const success = await FileService.invoke<boolean>("write_patchouli_book", {
            jarPath: target.path,
            bookId: book.id,
            modId: book.mod_id,
            language: config.translation.targetLanguage,
            content: JSON.stringify(translatedContent)
          });
          
          if (success) {
            // Add translation result
            addTranslationResult({
              type: "patchouli",
              id: target.id,
              sourceLanguage: config.translation.sourceLanguage,
              targetLanguage: config.translation.targetLanguage,
              content: translatedContent,
              outputPath: target.path
            });
          } else {
            console.error(`Failed to write translated guidebook: ${target.name}`);
          }
        } catch (error) {
          console.error(`Failed to translate guidebook: ${target.name}`, error);
        }
      }
      
      setProgress(100);
    } catch (error) {
      console.error("Failed to translate guidebooks:", error);
      setError(`Failed to translate guidebooks: ${error}`);
    } finally {
      setTranslating(false);
    }
  };

  // Translate guidebook content
  const translateGuidebookContent = async (
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
        chunkSize: config.translation.guidebook_chunk_size,
        prompt_template: config.llm.prompt_template,
        maxRetries: config.llm.max_retries,
      });
      
      // Create a translation job
      const job = translationService.createJob(
        content,
        sourceLanguage,
        targetLanguage
      );
      
      // Start the translation job
      await translationService.startJob(job.id);
      
      // Get the translated content
      return translationService.getCombinedTranslatedContent(job.id);
    } catch (error) {
      console.error("Failed to translate guidebook content:", error);
      
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
          <Button onClick={handleScanGuidebooks} disabled={isScanning || isTranslating}>
            {isScanning ? t('buttons.scanning') : t('buttons.scanGuidebooks')}
          </Button>
          <Button 
            onClick={handleTranslate} 
            disabled={isScanning || isTranslating || guidebookTranslationTargets.length === 0}
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
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {t('progress.translatingGuidebooks')} {progress}%
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
                  disabled={isScanning || isTranslating || guidebookTranslationTargets.length === 0}
                />
              </TableHead>
              <TableHead>{t('tables.guidebookName')}</TableHead>
              <TableHead>{t('tables.modId')}</TableHead>
              <TableHead>{t('tables.path')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guidebookTranslationTargets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {isScanning ? t('tables.scanningForGuidebooks') : t('tables.noGuidebooksFound')}
                </TableCell>
              </TableRow>
            ) : (
              guidebookTranslationTargets.map((target) => (
                <TableRow key={target.id}>
                  <TableCell>
                    <Checkbox 
                      checked={target.selected}
                      onCheckedChange={(checked) => updateGuidebookTranslationTarget(target.id, !!checked)}
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
