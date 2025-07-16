"use client";

import { useAppStore } from "@/lib/store";
import { ModInfo, LangFile, TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { getRelativePath } from "@/lib/utils/path-utils";

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
    // Mod-level progress tracking
    setTotalMods,
    setCompletedMods,
    addTranslationResult,
    error,
    setError,
    currentJobId,
    setCurrentJobId,
    isCompletionDialogOpen,
    setCompletionDialogOpen,
    setLogDialogOpen,
    resetTranslationState,
    // Scanning state
    setScanning,
    // Scan progress state
    scanProgress,
    setScanProgress,
    resetScanProgress
  } = useAppStore();

  // Listen for scan progress events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupScanProgressListener = async () => {
      try {
        const unlisten = await listen<{
          currentFile: string;
          processedCount: number;
          totalCount?: number;
          scanType: string;
          completed: boolean;
        }>('scan_progress', (event) => {
          const progress = event.payload;
          
          // Only process events for mods scan
          if (progress.scanType === 'mods') {
            setScanProgress({
              currentFile: progress.currentFile,
              processedCount: progress.processedCount,
              totalCount: progress.totalCount,
              scanType: progress.scanType,
            });
            
            // Reset progress after completion
            if (progress.completed) {
              setTimeout(() => resetScanProgress(), 500);
            }
          }
        });
        
        return unlisten;
      } catch (error) {
        console.error('Failed to set up scan progress listener:', error);
        return () => {};
      }
    };

    const unlistenPromise = setupScanProgressListener();
    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [setScanProgress, resetScanProgress]);

  // Scan for mods
  const handleScan = async (directory: string) => {
    try {
      setScanning(true);
      
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
          // Calculate relative path (cross-platform)
          const relativePath = getRelativePath(modFile, modsDirectory);
            
          targets.push({
            type: "mod",
            id: modInfo.id,
            name: modInfo.name,
            path: modFile, // Keep the full path for internal use
            relativePath: relativePath, // Add relative path for display
            selected: true,
            langFormat: modInfo.langFormat || "json" // Store the language file format
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to analyze mod: ${modFile}`, error);
        
        // Handle specific Tauri command errors gracefully
        if (errorMessage.includes("Lang file error") || errorMessage.includes("invalid escape")) {
          console.warn(`Skipping mod due to JSON parsing error: ${modFile}`);
          try {
            await invoke('log_error', { 
              message: `Skipped mod with JSON parsing error: ${modFile} - ${errorMessage}`, 
              processType: "SCAN" 
            });
          } catch {
            // Ignore logging errors
          }
        } else if (errorMessage.includes("IO error") || errorMessage.includes("not contain valid UTF-8")) {
          console.warn(`Skipping mod due to encoding error: ${modFile}`);
          try {
            await invoke('log_error', { 
              message: `Skipped mod with UTF-8 encoding error: ${modFile} - ${errorMessage}`, 
              processType: "SCAN" 
            });
          } catch {
            // Ignore logging errors
          }
        } else {
          // Log other unexpected errors
          try {
            await invoke('log_error', { 
              message: `Failed to analyze mod: ${modFile} - ${errorMessage}`, 
              processType: "SCAN" 
            });
          } catch {
            // Ignore logging errors
          }
        }
      }
    }

    setModTranslationTargets(targets);
    } finally {
      setScanning(false);
    }
  };

  // Translate mods
  const handleTranslate = async (
    selectedTargets: TranslationTarget[],
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void,
    selectedDirectory: string
  ) => {
    // Sort targets alphabetically by name for predictable processing order
    const sortedTargets = [...selectedTargets].sort((a, b) => a.name.localeCompare(b.name));
    // Always set resource packs directory to <selectedDirectory>/resourcepacks
    const resourcePacksDir = selectedDirectory.replace(/[/\\]+$/, "") + "/resourcepacks";

    // Ensure resource pack name is always set
    const resourcePackName = config.translation.resourcePackName || "MinecraftModsLocalizer";
    // Create resource pack
    const resourcePackDir = await FileService.createResourcePack(
      resourcePackName,
      targetLanguage,
      resourcePacksDir
    );

    // Reset progress tracking
    setCompletedMods(0);
    setCompletedChunks(0);
    setWholeProgress(0);
    setCurrentJobId(null);

    // Prepare jobs and count total chunks (using sorted targets)
    let totalChunksCount = 0;
    const jobs = [];
    let skippedCount = 0;
    
    for (const target of sortedTargets) {
      try {
        // Check if translation already exists when skipExistingTranslations is enabled
        if (config.translation.skipExistingTranslations ?? true) {
          const exists = await FileService.invoke<boolean>("check_mod_translation_exists", {
            modPath: target.path,
            modId: target.id,
            targetLanguage: targetLanguage
          });
          
          if (exists) {
            console.log(`Skipping mod ${target.name} (${target.id}) - translation already exists`);
            try {
              await invoke('log_translation_process', { 
                message: `Skipped: ${target.name} (${target.id}) - translation already exists`, 
                processType: "TRANSLATION" 
              });
            } catch {
              // ignore logging errors
            }
            skippedCount++;
            continue;
          }
        }
        
        // Extract language files
        const langFiles = await FileService.invoke<LangFile[]>("extract_lang_files", {
          jarPath: target.path,
          tempDir: ""
        });

        // Find source language file (default to en_us)
        const sourceFile = langFiles.find((file) =>
          file.language === "en_us"
        );

        if (!sourceFile) {
          console.warn(`Source language file not found for mod: ${target.name}`);
          try {
            await invoke('log_error', { message: `Source language file not found for mod: ${target.name} (${target.id})`, processType: "TRANSLATION" });
          } catch {
            // ignore logging errors
          }
          continue;
        }

        // Count the number of entries in the source file
        const entriesCount = Object.keys(sourceFile.content).length;

        // Calculate number of chunks based on chunk size
        const chunksCount = Math.ceil(entriesCount / config.translation.modChunkSize);
        totalChunksCount += chunksCount;

        // Create a translation job
        const job: import("@/lib/types/minecraft").ModTranslationJob = {
          ...translationService.createJob(
            sourceFile.content,
            targetLanguage,
            target.name
          ),
          modId: target.id
        };
        jobs.push(job);
      } catch (error) {
        console.error(`Failed to analyze mod for chunk counting: ${target.name}`, error);
      }
    }

    // Use mod-level progress tracking: denominator = total mods, numerator = completed mods
    setTotalMods(sortedTargets.length);
    
    // Set chunk tracking for progress calculation
    setTotalChunks(totalChunksCount);

    // Set currentJobId to the first job's ID immediately (enables cancel button promptly)
    if (jobs.length > 0) {
      setCurrentJobId(jobs[0].id);
    }
    
    // Generate session ID for this translation
    const sessionId = await invoke<string>('generate_session_id');
    
    // Create logs directory with session ID  
    const minecraftDir = selectedDirectory;
    const sessionPath = await invoke<string>('create_logs_directory_with_session', {
      minecraftDir: minecraftDir,
      sessionId: sessionId
    });

    // Use the shared translation runner
    const { runTranslationJobs } = await import("@/lib/services/translation-runner");
    try {
      await runTranslationJobs<import("@/lib/types/minecraft").ModTranslationJob>({
        jobs,
        translationService,
        setCurrentJobId,
        setProgress,
        incrementCompletedChunks: useAppStore.getState().incrementCompletedChunks, // Track chunk-level progress
        incrementWholeProgress: useAppStore.getState().incrementCompletedMods, // Track mod-level progress
        targetLanguage,
        type: "mod",
        sessionId,
        getOutputPath: () => resourcePackDir,
        getResultContent: (job) => translationService.getCombinedTranslatedContent(job.id),
        writeOutput: async (job, outputPath, content) => {
          // Find the target to get the langFormat
          const target = sortedTargets.find(t => t.id === job.modId);
          const format = target?.langFormat || 'json';
          
          await FileService.writeLangFile(
            job.modId,
            targetLanguage,
            content,
            outputPath,
            format
          );
        },
        onResult: addTranslationResult,
        onJobStart: async (job, i) => {
          const target = sortedTargets[i];
          try {
            await invoke('log_translation_process', { message: `Starting translation for mod: ${target.name} (${target.id})` });
          } catch {}
        },
        onJobComplete: async (job, i) => {
          const target = sortedTargets[i];
          try {
            await invoke('log_translation_process', { message: `Finished translation for mod: ${target.name} (${target.id})` });
          } catch {}
        },
        onJobInterrupted: async (job, i) => {
          const target = sortedTargets[i];
          try {
            await invoke('log_translation_process', { message: `Translation cancelled by user during mod: ${target.name} (${target.id})` });
          } catch {}
        }
      });
      
      // Backup the generated resource pack after successful translation
      try {
        await invoke('backup_resource_pack', {
          packPath: resourcePackDir,
          sessionPath: sessionPath
        });
      } catch (error) {
        console.error('Failed to backup resource pack:', error);
        // Don't fail the translation if backup fails
      }
      
      // Log skipped items summary
      if (skippedCount > 0) {
        try {
          await invoke('log_translation_process', { 
            message: `Translation completed. Skipped ${skippedCount} mods that already have translations.`, 
            processType: "TRANSLATION" 
          });
        } catch {
          // ignore logging errors
        }
      }
    } finally {
      setTranslating(false);
    }
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
          render: (target) => target.relativePath || target.path
        },
        {
          key: "langFormat",
          label: "Format",
          className: "w-20",
          render: (target) => (
            <span className={`px-2 py-1 text-xs rounded ${
              target.langFormat === 'lang' 
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            }`}>
              {target.langFormat?.toUpperCase() || 'JSON'}
            </span>
          )
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
      addTranslationResult={addTranslationResult}
      error={error}
      setError={setError}
      currentJobId={currentJobId}
      setCurrentJobId={setCurrentJobId}
      isCompletionDialogOpen={isCompletionDialogOpen}
      setCompletionDialogOpen={setCompletionDialogOpen}
      setLogDialogOpen={setLogDialogOpen}
      resetTranslationState={resetTranslationState}
      scanProgress={scanProgress}
      onScan={handleScan}
      onTranslate={handleTranslate}
    />
  );
}
