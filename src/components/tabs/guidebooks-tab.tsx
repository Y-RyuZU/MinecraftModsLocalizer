"use client";

import { useAppStore } from "@/lib/store";
import { LangFile, PatchouliBook, TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";

export function GuidebooksTab() {
  const { 
    config, 
    guidebookTranslationTargets, 
    setGuidebookTranslationTargets, 
    updateGuidebookTranslationTarget,
    isTranslating,
    progress,
    wholeProgress,
    setTranslating,
    setProgress,
    setWholeProgress,
    setTotalChunks,
    setCompletedChunks,
    incrementCompletedChunks,
    addTranslationResult,
    error,
    setError,
    currentJobId,
    setCurrentJobId
  } = useAppStore();

  // Scan for guidebooks
  const handleScan = async (directory: string) => {
    // Get mod files
    const modFiles = await FileService.getModFiles(directory);
    
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
          // Calculate relative path by removing the selected directory part
          const relativePath = modFile.startsWith(directory) 
            ? modFile.substring(directory.length).replace(/^[/\\]+/, '') 
            : modFile;
            
          for (const book of books) {
            targets.push({
              type: "patchouli",
              id: book.id,
              name: `${book.modId}: ${book.name}`,
              path: modFile,
              relativePath: relativePath,
              selected: true
            });
          }
        }
      } catch (error) {
        console.error(`Failed to extract guidebooks from mod: ${modFile}`, error);
      }
    }
    
    setGuidebookTranslationTargets(targets);
  };

  // Translate guidebooks
  const handleTranslate = async (
    selectedTargets: TranslationTarget[], 
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void
  ) => {
    // Reset whole progress tracking
    setCompletedChunks(0);
    setWholeProgress(0);
    
    // Count total chunks across all guidebooks to track whole progress
    let totalChunksCount = 0;
    
    // First pass: count total chunks for all guidebooks
    for (const target of selectedTargets) {
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
        const sourceFile = book.langFiles.find((file: LangFile) => 
          file.language === config.translation.sourceLanguage
        );
        
        if (!sourceFile) {
          console.warn(`Source language file not found for book: ${target.name}`);
          continue;
        }
        
        // Count the number of entries in the source file
        const entriesCount = Object.keys(sourceFile.content).length;
        
        // Calculate number of chunks based on chunk size
        const chunksCount = Math.ceil(entriesCount / config.translation.guidebookChunkSize);
        totalChunksCount += chunksCount;
      } catch (error) {
        console.error(`Failed to analyze guidebook for chunk counting: ${target.name}`, error);
      }
    }
    
    // Set total chunks for whole progress tracking
    setTotalChunks(totalChunksCount);
    
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
        const sourceFile = book.langFiles.find((file: LangFile) => 
          file.language === config.translation.sourceLanguage
        );
        
        if (!sourceFile) {
          console.warn(`Source language file not found for book: ${target.name}`);
          continue;
        }
        
        // Create a translation job
        const job = translationService.createJob(
          sourceFile.content,
          config.translation.sourceLanguage,
          targetLanguage,
          target.name
        );
        
        // Store the job ID
        setCurrentJobId(job.id);
        
        // Start the translation job
        await translationService.startJob(job.id);
        
        // Update whole progress based on chunks in this job
        const jobChunksCount = job.chunks.length;
        for (let j = 0; j < jobChunksCount; j++) {
          incrementCompletedChunks();
        }
        
        // Get the translated content
        const translatedContent = translationService.getCombinedTranslatedContent(job.id);
        
        // Write translated file to JAR
        const success = await FileService.invoke<boolean>("write_patchouli_book", {
          jarPath: target.path,
          bookId: book.id,
          modId: book.modId,
          language: targetLanguage,
          content: JSON.stringify(translatedContent)
        });
        
        if (success) {
          // Add translation result
          addTranslationResult({
            type: "patchouli",
            id: target.id,
            sourceLanguage: config.translation.sourceLanguage,
            targetLanguage: targetLanguage,
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
    
    // Clear the job ID
    setCurrentJobId(null);
  };

  return (
    <TranslationTab
      tabType="guidebooks"
      scanButtonLabel="buttons.scanGuidebooks"
      scanningLabel="buttons.scanning"
      progressLabel="progress.translatingGuidebooks"
      noItemsSelectedError="errors.noGuidebooksSelected"
      noItemsFoundLabel="tables.noGuidebooksFound"
      scanningForItemsLabel="tables.scanningForGuidebooks"
      filterPlaceholder="filters.filterGuidebooks"
      tableColumns={[
        { key: "name", label: "tables.guidebookName" },
        { key: "id", label: "tables.modId" },
        { 
          key: "relativePath", 
          label: "tables.path", 
          className: "truncate max-w-[300px]",
          render: (target) => target.relativePath || target.path
        }
      ]}
      config={config}
      translationTargets={guidebookTranslationTargets}
      setTranslationTargets={setGuidebookTranslationTargets}
      updateTranslationTarget={updateGuidebookTranslationTarget}
      isTranslating={isTranslating}
      progress={progress}
      wholeProgress={wholeProgress}
      setTranslating={setTranslating}
      setProgress={setProgress}
      setWholeProgress={setWholeProgress}
      setTotalChunks={setTotalChunks}
      setCompletedChunks={setCompletedChunks}
      incrementCompletedChunks={incrementCompletedChunks}
      addTranslationResult={addTranslationResult}
      error={error}
      setError={setError}
      currentJobId={currentJobId}
      setCurrentJobId={setCurrentJobId}
      onScan={handleScan}
      onTranslate={handleTranslate}
    />
  );
}
