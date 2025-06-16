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
    addTranslationResult: (result: TranslationResult) => void,
    selectedDirectory: string
  ) => {
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

    // Reset whole progress tracking
    setCompletedChunks(0);
    setWholeProgress(0);

    // Prepare jobs and count total chunks
    let totalChunksCount = 0;
    const jobs = [];
    for (const target of selectedTargets) {
      try {
        // Extract language files
        const langFiles = await FileService.invoke<LangFile[]>("extract_lang_files", {
          jarPath: target.path,
          tempDir: ""
        });

        // Find source language file
        const sourceFile = langFiles.find((file) =>
          file.language === config?.translation?.sourceLanguage || "en_us"
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
            config.translation.sourceLanguage,
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

    setTotalChunks(totalChunksCount);

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
        incrementCompletedChunks,
        // Use normalized source language for consistency, fallback to "en_us"
        sourceLanguage: (
          config?.translation?.sourceLanguage || "en_us"
        )
          .toLowerCase()
          .replace("-", "_"),
        targetLanguage,
        type: "mod",
        getOutputPath: (job) => resourcePackDir,
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
          const target = selectedTargets[i];
          try {
            await invoke('log_translation_process', { message: `Starting translation for mod: ${target.name} (${target.id})` });
          } catch {}
        },
        onJobComplete: async (job, i) => {
          const target = selectedTargets[i];
          try {
            await invoke('log_translation_process', { message: `Finished translation for mod: ${target.name} (${target.id})` });
          } catch {}
        },
        onJobInterrupted: async (job, i) => {
          const target = selectedTargets[i];
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
