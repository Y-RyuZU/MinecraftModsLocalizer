"use client";

import { useAppStore } from "@/lib/store";
import { ModInfo, LangFile, TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";
import { invoke } from "@tauri-apps/api/core";

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
    // Mod-level progress tracking
    setTotalMods,
    setCompletedMods,
    incrementCompletedMods,
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to analyze mod: ${modFile}`, error);
        
        // Handle specific Tauri command errors gracefully
        if (errorMessage.includes("Lang file error") || errorMessage.includes("invalid escape")) {
          console.warn(`Skipping mod due to JSON parsing error: ${modFile}`);
          try {
            await invoke('log_error', { 
              message: `Skipped mod with JSON parsing error: ${modFile} - ${errorMessage}`, 
              process_type: "SCAN" 
            });
          } catch {
            // Ignore logging errors
          }
        } else if (errorMessage.includes("IO error") || errorMessage.includes("not contain valid UTF-8")) {
          console.warn(`Skipping mod due to encoding error: ${modFile}`);
          try {
            await invoke('log_error', { 
              message: `Skipped mod with UTF-8 encoding error: ${modFile} - ${errorMessage}`, 
              process_type: "SCAN" 
            });
          } catch {
            // Ignore logging errors
          }
        } else {
          // Log other unexpected errors
          try {
            await invoke('log_error', { 
              message: `Failed to analyze mod: ${modFile} - ${errorMessage}`, 
              process_type: "SCAN" 
            });
          } catch {
            // Ignore logging errors
          }
        }
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
    addTranslationResult: (result: TranslationResult) => void,
    selectedDirectory: string
  ) => {
    // Sort targets alphabetically by name for predictable processing order
    const sortedTargets = [...selectedTargets].sort((a, b) => a.name.localeCompare(b.name));
    console.log(`ModsTab: Processing ${sortedTargets.length} mods in alphabetical order:`, sortedTargets.map(t => t.name));
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

    // Reset progress tracking (use mod-level instead of chunk-level)
    setCompletedMods(0);
    setWholeProgress(0);

    // Prepare jobs and count total chunks (using sorted targets)
    let totalChunksCount = 0;
    const jobs = [];
    for (const target of sortedTargets) {
      try {
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
            await invoke('log_error', { message: `Source language file not found for mod: ${target.name} (${target.id})`, process_type: "TRANSLATION" });
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
    console.log(`ModsTab: Set totalMods to ${sortedTargets.length} for mod-level progress tracking`);
    
    // Keep chunk tracking for internal processing (optional)
    const extraStepsPerJob = 2;
    const finalTotalChunks = totalChunksCount > 0 ? totalChunksCount + (jobs.length * extraStepsPerJob) : jobs.length * 3;
    setTotalChunks(finalTotalChunks);
    console.log(`ModsTab: Set totalChunks to ${finalTotalChunks} (for internal tracking only)`);

    // Set currentJobId to the first job's ID immediately (enables cancel button promptly)
    if (jobs.length > 0) {
      setCurrentJobId(jobs[0].id);
    }

    // Use the shared translation runner
    const { runTranslationJobs } = await import("@/lib/services/translation-runner");
    try {
      await runTranslationJobs<import("@/lib/types/minecraft").ModTranslationJob>({
        jobs,
        translationService,
        setCurrentJobId,
        incrementCompletedMods, // Use mod-level progress instead of chunk-level
        targetLanguage,
        type: "mod",
        getOutputPath: () => resourcePackDir,
        getResultContent: (job) => translationService.getCombinedTranslatedContent(job.id),
        writeOutput: async (job, outputPath, content) => {
          await FileService.writeLangFile(
            job.modId,
            targetLanguage,
            content,
            outputPath
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
