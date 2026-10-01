"use client";

import { useAppStore } from "@/lib/store";
import { ModInfo, LangFile, TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";
import { invoke } from "@tauri-apps/api/core";
import { RetranslationControl } from "@/components/tabs/common/retranslation-control";
import { isRetranslationRequested } from "@/lib/services/translation-policy";
import { applyStructuredJsonTranslations, groupEnglishLangFilesByNamespace, hasNamespaceLanguage, hasResourcePackLanguage, indexResourcePackLanguageFiles, hasExistingModTranslation, shouldTranslateMod } from "@/lib/services/mod-language";

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
    incrementCompletedMods,
    incrementCompletedChunks,
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

    const resourcePackName = config.translation.resourcePackName || "MinecraftModsLocalizer";
    const resourcePackDirectory = `${directory.replace(/[/\\]+$/, "")}/resourcepacks/${resourcePackName}`;
    const hasResourcePack = await FileService.invoke<boolean>("file_exists", {
      path: `${resourcePackDirectory}/pack.mcmeta`,
    });
    const resourcePackFiles = hasResourcePack
      ? (await Promise.all([
          FileService.getFilesWithExtension(resourcePackDirectory, ".json"),
          FileService.getFilesWithExtension(resourcePackDirectory, ".lang"),
        ])).flat()
      : [];
    const resourcePackLanguages = indexResourcePackLanguageFiles(resourcePackFiles);
    const existingOutputCount = Object.values(resourcePackLanguages)
      .flatMap((formats) => Object.values(formats))
      .reduce((count, locales) => count + (locales?.length ?? 0), 0);
    if (existingOutputCount > 0) {
      try {
        await invoke("log_translation_process", {
          message: `Found ${existingOutputCount} existing locale outputs in resource pack ${resourcePackName}; completed namespace/format outputs will be skipped unless explicitly selected for retranslation.`,
        });
      } catch {}
    }

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
            availableLanguages: modInfo.availableLanguages || [],
            availableLanguagesByNamespace: modInfo.availableLanguagesByNamespace || {},
            availableLanguagesByNamespaceAndFormat: modInfo.availableLanguagesByNamespaceAndFormat || {},
            resourcePackLanguagesByNamespaceAndFormat: resourcePackLanguages,
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
  };

  // Translate mods
  const handleTranslate = async (
    selectedTargets: TranslationTarget[],
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void,
    selectedDirectory: string,
    sessionId: string
  ) => {
    // Sort targets alphabetically by name for predictable processing order
    const sortedTargets = [...selectedTargets].sort((a, b) => a.name.localeCompare(b.name));
    console.log(`ModsTab: Processing ${sortedTargets.length} mods in alphabetical order:`, sortedTargets.map(t => t.name));
    // Always set resource packs directory to <selectedDirectory>/resourcepacks
    const resourcePacksDir = selectedDirectory.replace(/[/\\]+$/, "") + "/resourcepacks";

    // Ensure resource pack name is always set
    const resourcePackName = config.translation.resourcePackName || "MinecraftModsLocalizer";
    // Reset progress tracking (use mod-level instead of chunk-level)
    setCompletedMods(0);
    setWholeProgress(0);

    // Prepare jobs and count total chunks (using sorted targets)
    let totalChunksCount = 0;
    const jobs: import("@/lib/types/minecraft").ModTranslationJob[] = [];
    for (const target of sortedTargets) {
      try {
        // Extract language files
        const langFiles = await FileService.invoke<LangFile[]>("extract_lang_files", {
          jarPath: target.path,
          tempDir: ""
        });

        const groups = groupEnglishLangFilesByNamespace(langFiles);
        if (groups.length === 0) {
          console.warn(`Source language file not found for mod: ${target.name}`);
          try {
            await invoke('log_error', { message: `Source language file not found for mod: ${target.name} (${target.id})`, processType: "TRANSLATION" });
          } catch {
            // ignore logging errors
          }
          continue;
        }

        for (const group of groups) {
          const forced = isRetranslationRequested(target, targetLanguage);
          if (!forced && (
            hasNamespaceLanguage(target, group.resourceNamespace, targetLanguage, group.fileExtension)
            || hasResourcePackLanguage(target, group.resourceNamespace, targetLanguage, group.fileExtension)
          )) continue;
          const entriesCount = Object.keys(group.content).length;
          if (entriesCount === 0) continue;

          jobs.push({
            ...translationService.createJob(
              group.content,
              targetLanguage,
              `${target.name} (${group.resourceNamespace}.${group.fileExtension})`
            ),
            resourceNamespace: group.resourceNamespace,
            modName: target.name,
            fileExtension: group.fileExtension,
            ...(group.structuredContent ? { structuredContent: group.structuredContent } : {})
          });
        }
      } catch (error) {
        console.error(`Failed to analyze mod for chunk counting: ${target.name}`, error);
      }
    }

    if (jobs.length === 0) return;
    // Create resource pack
    const resourcePackDir = await FileService.createResourcePack(
      resourcePackName,
      targetLanguage,
      resourcePacksDir
    );

    // Use mod-level progress tracking: denominator = total mods, numerator = completed mods
    setTotalMods(jobs.length);
    console.log(`ModsTab: Set translation units to ${jobs.length} for progress tracking`);

    totalChunksCount = jobs.reduce((total, job) => total + job.chunks.length, 0);
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
        sessionId,
        setProgress,
        incrementCompletedChunks,
        translationService,
        setCurrentJobId,
        incrementCompletedMods, // Use mod-level progress for whole progress display
        targetLanguage,
        type: "mod",
        getOutputPath: () => resourcePackDir,
        getResultContent: (job) => translationService.getCombinedTranslatedContent(job.id),
        writeOutput: async (job, outputPath, content) => {
          const outputContent = job.structuredContent
            ? applyStructuredJsonTranslations(job.structuredContent, content)
            : content;
          await FileService.writeLangFile(
            job.resourceNamespace,
            targetLanguage,
            outputContent,
            outputPath,
            job.fileExtension
          );
        },
        onResult: addTranslationResult,
        onJobStart: async (job) => {
          try {
            await invoke('log_translation_process', { message: `Starting translation for mod: ${job.modName} (${job.resourceNamespace}.${job.fileExtension})` });
          } catch {}
        },
        onJobComplete: async (job) => {
          try {
            const failedChunks = job.chunks.filter((chunk) => chunk.status === "failed").length;
            const result = job.status === "completed"
              ? "Translation saved"
              : `Output not written (${failedChunks} failed chunks)`;
            await invoke('log_translation_process', { message: `${result} for mod: ${job.modName} (${job.resourceNamespace}.${job.fileExtension})` });
          } catch {}
        },
        onJobInterrupted: async (job) => {
          try {
            await invoke('log_translation_process', { message: `Translation cancelled by user during mod: ${job.modName} (${job.resourceNamespace}.${job.fileExtension})` });
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
        },
        {
          key: "forceTranslation",
          label: "tables.existingTranslation",
          className: "min-w-[260px]",
          render: (target, { targetLanguage, updateTarget }) => <RetranslationControl target={target} targetLanguage={targetLanguage} updateTarget={updateTarget} disabled={isTranslating} hasExistingTranslation={hasExistingModTranslation} />
        }
      ]}
      config={config}
      translationTargets={modTranslationTargets}
      prepareTranslationTargets={(targets, targetLanguage) => {
        return config.translation.skipExistingTranslations === false
          ? targets.map(target => ({ ...target, forceTranslationLanguage: targetLanguage }))
          : targets.filter((target) => shouldTranslateMod(target, targetLanguage));
      }}
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
