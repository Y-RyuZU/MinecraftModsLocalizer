"use client";

import { useAppStore } from "@/lib/store";
import { ModInfo, LangFile, TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";

export function ModsTab() {
  const { 
    config, 
    modTranslationTargets, 
    setModTranslationTargets, 
    updateModTranslationTarget,
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

  // Scan for mods
  const handleScan = async (directory: string) => {
    // Get mods directory
    const modsDirectory = directory + "/mods";

    // Get mod files
    const modFiles = await FileService.getModFiles(modsDirectory);

    // Create translation targets
    const targets: TranslationTarget[] = [];
    
    for (const modFile of modFiles) {
      try {
        const modInfo = await FileService.invoke<ModInfo>("analyze_mod_jar", { jarPath: modFile });

        if (modInfo.langFiles && modInfo.langFiles.length > 0) {
          // Calculate relative path by removing the selected directory part
          const relativePath = modFile.startsWith(modsDirectory)
            ? modFile.substring(modsDirectory.length).replace(/^[/\\]+/, '') 
            : modFile;
            
          targets.push({
            type: "mod",
            id: modInfo.id,
            name: modInfo.name,
            path: modFile, // Keep the full path for internal use
            relativePath: relativePath, // Add relative path for display
            selected: true
          });
        }
      } catch (error) {
        console.error(`Failed to analyze mod: ${modFile}`, error);
      }
    }

    setModTranslationTargets(targets);
  };

  // Translate mods
  const handleTranslate = async (
    selectedTargets: TranslationTarget[], 
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void
  ) => {
    // Check if resource packs directory is set
    if (!config.paths.resourcePacksDir) {
      const selected = await FileService.openDirectoryDialog("Select Minecraft Resource Packs Directory");
      
      if (!selected) {
        return;
      }
      
      // Update config with selected directory
      config.paths.resourcePacksDir = selected;
    }
    
    // Create resource pack
    const resourcePackDir = await FileService.createResourcePack(
      config.translation.resourcePackName,
      targetLanguage,
      config.paths.resourcePacksDir
    );
    
    // Reset whole progress tracking
    setCompletedChunks(0);
    setWholeProgress(0);
    
    // Count total chunks across all mods to track whole progress
    let totalChunksCount = 0;
    
    // First pass: count total chunks for all mods
    for (const target of selectedTargets) {
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
        
        // Count the number of entries in the source file
        const entriesCount = Object.keys(sourceFile.content).length;
        
        // Calculate number of chunks based on chunk size
        const chunksCount = Math.ceil(entriesCount / config.translation.modChunkSize);
        totalChunksCount += chunksCount;
      } catch (error) {
        console.error(`Failed to analyze mod for chunk counting: ${target.name}`, error);
      }
    }
    
    // Set total chunks for whole progress tracking
    setTotalChunks(totalChunksCount);
    
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
        
        // Write translated file to resource pack
        await FileService.writeLangFile(
          target.id,
          targetLanguage,
          translatedContent,
          resourcePackDir
        );
        
        // Add translation result
        addTranslationResult({
          type: "mod",
          id: target.id,
          sourceLanguage: config.translation.sourceLanguage,
          targetLanguage: targetLanguage,
          content: translatedContent,
          outputPath: resourcePackDir
        });
      } catch (error) {
        console.error(`Failed to translate mod: ${target.name}`, error);
      }
    }
    
    // Clear the job ID
    setCurrentJobId(null);
  };

  return (
    <TranslationTab
      tabType="mods"
      scanButtonLabel="buttons.scanMods"
      scanningLabel="buttons.scanning"
      progressLabel="progress.translatingMods"
      noItemsSelectedError="errors.noModsSelected"
      noItemsFoundLabel="tables.noModsFound"
      scanningForItemsLabel="tables.scanningForMods"
      filterPlaceholder="filters.filterMods"
      tableColumns={[
        { key: "name", label: "tables.modName" },
        { key: "id", label: "tables.modId" },
        { 
          key: "relativePath", 
          label: "tables.path", 
          className: "truncate max-w-[300px]",
          render: (target) => target.relativePath || target.path
        }
      ]}
      config={config}
      translationTargets={modTranslationTargets}
      setTranslationTargets={setModTranslationTargets}
      updateTranslationTarget={updateModTranslationTarget}
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
