"use client";

import { useAppStore } from "@/lib/store";
import { TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";

export function CustomFilesTab() {
  const { 
    config, 
    customFilesTranslationTargets, 
    setCustomFilesTranslationTargets, 
    updateCustomFilesTranslationTarget,
    isTranslating,
    progress,
    wholeProgress,
    setTranslating,
    setProgress,
    setWholeProgress,
    setTotalChunks,
    setCompletedChunks,
    addTranslationResult,
    error,
    setError,
    currentJobId,
    setCurrentJobId,
    isCompletionDialogOpen,
    setCompletionDialogOpen,
    setLogDialogOpen,
    resetTranslationState
  } = useAppStore();

  // Scan for custom files
  const handleScan = async (directory: string) => {
    // Get JSON and SNBT files
    const jsonFiles = await FileService.getFilesWithExtension(directory, ".json");
    const snbtFiles = await FileService.getFilesWithExtension(directory, ".snbt");
    
    // Combine files
    const allFiles = [...jsonFiles, ...snbtFiles];
    
    // Create translation targets
    const targets: TranslationTarget[] = [];
    
    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i];
      try {
        // Get file name
        const fileName = filePath.split('/').pop() || "unknown";
        
        // Calculate relative path by removing the selected directory part
        const relativePath = filePath.startsWith(directory) 
          ? filePath.substring(directory.length).replace(/^[/\\]+/, '') 
          : filePath;
        
        targets.push({
          type: "custom",
          id: `custom-file-${i + 1}`,
          name: fileName,
          path: filePath,
          relativePath: relativePath,
          selected: true
        });
      } catch (error) {
        console.error(`Failed to process file: ${filePath}`, error);
      }
    }
    
    setCustomFilesTranslationTargets(targets);
  };

  // Translate custom files
  const handleTranslate = async (
    selectedTargets: TranslationTarget[], 
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    selectedDirectory: string // for API compatibility, not used
  ) => {
    // Get the directory from the first target
    const directory = selectedTargets[0]?.path.split('/').slice(0, -1).join('/');
    
    // Create output directory
    const outputDir = `${directory}/translated`;
    await FileService.createDirectory(outputDir);
    
    // Reset whole progress tracking
    setCompletedChunks(0);
    setWholeProgress(0);
    
    // Count total chunks across all files to track whole progress
    let totalChunksCount = 0;
    
    // First pass: count total chunks for all files
    for (const target of selectedTargets) {
      try {
        // Read file content
        const content = await FileService.readTextFile(target.path);
        
        // Determine file type
        const isJson = target.path.toLowerCase().endsWith('.json');
        const isSnbt = target.path.toLowerCase().endsWith('.snbt');
        
        if (isJson) {
          try {
            const jsonData = JSON.parse(content);
            // Count chunks in JSON recursively
            const jsonChunksCount = countJsonChunks(jsonData, config.translation.modChunkSize);
            totalChunksCount += jsonChunksCount;
          } catch (error) {
            console.error(`Failed to parse JSON: ${target.path}`, error);
          }
        } else if (isSnbt) {
          // For SNBT files, we just have one chunk per file
          totalChunksCount += 1;
        }
      } catch (error) {
        console.error(`Failed to read file: ${target.path}`, error);
      }
    }
    
    // Set total chunks for whole progress tracking
    setTotalChunks(totalChunksCount);
    
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
        
        // Get file name
        const fileName = target.path.split('/').pop() || "unknown";
        
        // Create output path
        const outputPath = `${outputDir}/${targetLanguage}_${fileName}`;
        
        if (isJson) {
          // Parse JSON
          try {
            const jsonData = JSON.parse(content);
            
            // Create a translation job for the JSON content
            const translatedJson = await translateJsonRecursively(
              jsonData, 
              translationService, 
              config.translation.sourceLanguage,
              targetLanguage, 
              target.name,
              setCurrentJobId,
              () => {} // No-op since we handle progress differently
            );
            
            // Stringify JSON
            const translatedContent = JSON.stringify(translatedJson, null, 2);
            
            // Write translated file
            await FileService.writeTextFile(outputPath, translatedContent);
            
            // Add translation result
            addTranslationResult({
              type: "custom",
              id: target.id,
              sourceLanguage: config.translation.sourceLanguage,
              targetLanguage: targetLanguage,
              content: { [target.id]: translatedContent } as Record<string, string>,
              outputPath,
              success: true
            });
          } catch (error) {
            console.error(`Failed to parse JSON: ${target.path}`, error);
            // Add failed translation result
            addTranslationResult({
              type: "custom",
              id: target.id,
              sourceLanguage: config.translation.sourceLanguage,
              targetLanguage: targetLanguage,
              content: {},
              outputPath: "",
              success: false
            });
          }
        } else if (isSnbt) {
          // Create a key for the content
          const contentKey = "content";
          
          // Create a translation job for SNBT content
          const job = translationService.createJob(
            { [contentKey]: content },
            config.translation.sourceLanguage,
            targetLanguage,
            target.name
          );
          
          // Store the job ID
          setCurrentJobId(job.id);
          
          // Start the translation job
          await translationService.startJob(job.id);
          
          // Progress is handled by the translation runner
          
          // Get the translated content
          const translatedContent = translationService.getCombinedTranslatedContent(job.id);
          // Access the content using the same key, with a fallback if the key doesn't exist
          const translatedText = translatedContent && typeof translatedContent === 'object' && contentKey in translatedContent 
            ? (translatedContent as Record<string, string>)[contentKey] 
            : `[${targetLanguage}] ${content}`;
          
          // Write translated file
          await FileService.writeTextFile(outputPath, translatedText);
          
          // Add translation result
          addTranslationResult({
            type: "custom",
            id: target.id,
            sourceLanguage: config.translation.sourceLanguage,
            targetLanguage: targetLanguage,
            content: { [target.id]: translatedText } as Record<string, string>,
            outputPath,
            success: true
          });
        } else {
          console.warn(`Unsupported file type: ${target.path}`);
          // Add failed translation result for unsupported file type
          addTranslationResult({
            type: "custom",
            id: target.id,
            sourceLanguage: config.translation.sourceLanguage,
            targetLanguage: targetLanguage,
            content: {},
            outputPath: "",
            success: false
          });
        }
      } catch (error) {
        console.error(`Failed to translate file: ${target.name}`, error);
        // Add failed translation result for general error
        addTranslationResult({
          type: "custom",
          id: target.id,
          sourceLanguage: config.translation.sourceLanguage,
          targetLanguage: targetLanguage,
          content: {},
          outputPath: "",
          success: false
        });
      }
    }
    
    // Clear the job ID
    setCurrentJobId(null);
  };

  // Count chunks in JSON recursively
  const countJsonChunks = (
    json: unknown,
    chunkSize: number
  ): number => {
    if (typeof json === 'string') {
      // Each string is one chunk
      return 1;
    } else if (Array.isArray(json)) {
      // Count chunks in array items
      return json.reduce((count, item) => count + countJsonChunks(item, chunkSize), 0);
    } else if (typeof json === 'object' && json !== null) {
      // Count chunks in object properties
      return Object.values(json).reduce((count, value) => count + countJsonChunks(value, chunkSize), 0);
    } else {
      return 0;
    }
  };

  // Translate JSON recursively
  const translateJsonRecursively = async (
    json: unknown,
    translationService: TranslationService,
    sourceLanguage: string,
    targetLanguage: string,
    currentFileName?: string,
    setCurrentJobId?: (jobId: string | null) => void,
    incrementCompletedChunks?: () => void
  ): Promise<unknown> => {
    if (typeof json === 'string') {
      // Create a key for the text
      const textKey = "text";
      
      // Create a translation job with a simple key-value structure
      const job = translationService.createJob(
        { [textKey]: json },
        sourceLanguage,
        targetLanguage,
        currentFileName
      );
      
      // Store the job ID
      if (setCurrentJobId) {
        setCurrentJobId(job.id);
      }
      
      // Start the translation job
      await translationService.startJob(job.id);
      
      // Increment completed chunks for whole progress
      if (incrementCompletedChunks) {
        incrementCompletedChunks();
      }
      
      // Get the translated content
      const translatedContent = translationService.getCombinedTranslatedContent(job.id);
      // Access the content using the same key, with a fallback if the key doesn't exist
      return translatedContent && typeof translatedContent === 'object' && textKey in translatedContent 
        ? (translatedContent as Record<string, string>)[textKey] 
        : `[${targetLanguage}] ${json}`;
    } else if (Array.isArray(json)) {
      const translatedArray = [];
      for (const item of json) {
        translatedArray.push(await translateJsonRecursively(
          item, 
          translationService, 
          sourceLanguage, 
          targetLanguage, 
          currentFileName,
          setCurrentJobId,
          incrementCompletedChunks
        ));
      }
      return translatedArray;
    } else if (typeof json === 'object' && json !== null) {
      const result: Record<string, unknown> = {};
      for (const key in json) {
        result[key] = await translateJsonRecursively(
          (json as Record<string, unknown>)[key], 
          translationService, 
          sourceLanguage, 
          targetLanguage, 
          currentFileName,
          setCurrentJobId,
          incrementCompletedChunks
        );
      }
      return result;
    } else {
      return json;
    }
  };

  // Custom render function for the file type column
  const renderFileType = (target: TranslationTarget) => {
    return target.path.toLowerCase().endsWith('.json') ? "JSON" : "SNBT";
  };

  return (
    <TranslationTab
      tabType="custom-files"
      scanButtonLabel="buttons.scanFiles"
      scanningLabel="buttons.scanning"
      progressLabel="progress.translatingFiles"
      noItemsSelectedError="errors.noFilesSelected"
      noItemsFoundLabel="tables.noFilesFound"
      scanningForItemsLabel="tables.scanningForFiles"
      directorySelectLabel="buttons.selectDirectory"
      filterPlaceholder="filters.filterFiles"
      tableColumns={[
        { key: "name", label: "tables.fileName" },
        { key: "type", label: "tables.type", render: renderFileType },
        { 
          key: "relativePath", 
          label: "tables.path", 
          className: "truncate max-w-[300px]",
          render: (target) => target.relativePath || target.path
        }
      ]}
      config={config}
      translationTargets={customFilesTranslationTargets}
      setTranslationTargets={setCustomFilesTranslationTargets}
      updateTranslationTarget={updateCustomFilesTranslationTarget}
      isTranslating={isTranslating}
      progress={progress}
      wholeProgress={wholeProgress}
      setTranslating={setTranslating}
      setProgress={setProgress}
      setWholeProgress={setWholeProgress}
      setTotalChunks={setTotalChunks}
      setCompletedChunks={setCompletedChunks}
      addTranslationResult={addTranslationResult}
      error={error}
      setError={setError}
      currentJobId={currentJobId}
      setCurrentJobId={setCurrentJobId}
      isCompletionDialogOpen={isCompletionDialogOpen}
      setCompletionDialogOpen={setCompletionDialogOpen}
      setLogDialogOpen={setLogDialogOpen}
      resetTranslationState={resetTranslationState}
      onScan={handleScan}
      onTranslate={handleTranslate}
    />
  );
}
