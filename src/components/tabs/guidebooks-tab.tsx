"use client";

import { useAppStore } from "@/lib/store";
import { LangFile, PatchouliBook, TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";
import { invoke } from "@tauri-apps/api/core";
import { shouldTranslateMod } from "@/lib/services/mod-language";

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
      setCurrentJobId,
      isCompletionDialogOpen,
      setCompletionDialogOpen,
      setLogDialogOpen,
      resetTranslationState
  } = useAppStore();

  // Scan for guidebooks
  const handleScan = async (directory: string) => {
    // Get mods directory
    const modsDirectory = directory + "/mods";
    // Get mod files
    const modFiles = await FileService.getModFiles(modsDirectory);

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
              availableLanguages: book.availableLanguages || [],
              selected: true
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to extract guidebooks from mod: ${modFile}`, error);
        
        // Log error to Tauri backend
        await FileService.invoke("log_error", {
          message: `Failed to extract guidebooks from ${modFile}: ${errorMessage}`,
          processType: "GUIDEBOOK_SCAN"
        });
      }
    }

    setGuidebookTranslationTargets(targets);
  };

  // Translate guidebooks (refactored to match mods/custom-files/quests pattern)
  const handleTranslate = async (
    selectedTargets: TranslationTarget[],
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void,
  ) => {
    // Reset whole progress tracking
    setCompletedChunks(0);
    setWholeProgress(0);

    // Prepare jobs and count total chunks
    let totalChunksCount = 0;
    const jobs = [];
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

        // Namespace each JSON-pointer key by its stable file index. This lets
        // one book use normal 50-entry batches without collisions between files.
        const sourceFiles = book.langFiles
          .filter((file: LangFile) => file.language === "en_us")
          .sort((left: LangFile, right: LangFile) => left.path.localeCompare(right.path));

        if (sourceFiles.length === 0) {
          console.warn(`Source language file not found for book: ${target.name}`);
          continue;
        }

        const combinedContent: Record<string, string> = {};
        sourceFiles.forEach((sourceFile, index) => {
          for (const [pointer, text] of Object.entries(sourceFile.content)) {
            combinedContent[`file_${index}::${pointer}`] = text;
          }
        });
        const entriesCount = Object.keys(combinedContent).length;
        if (entriesCount === 0) continue;
        totalChunksCount += Math.ceil(entriesCount / config.translation.guidebookChunkSize);

        const job: import("@/lib/types/minecraft").PatchouliTranslationJob = {
          ...translationService.createJob(
            combinedContent,
            targetLanguage,
            `${target.name} (${sourceFiles.length} files)`
          ),
          bookId: book.id,
          modId: book.modId,
          sourcePaths: sourceFiles.map((file) => file.path),
          targetPath: target.path
        };
        jobs.push(job);
      } catch (error) {
        console.error(`Failed to analyze guidebook for chunk counting: ${target.name}`, error);
      }
    }

    // Ensure totalChunks is set correctly, fallback to jobs.length if calculation failed
    const finalTotalChunks = totalChunksCount > 0 ? totalChunksCount : jobs.length;
    setTotalChunks(finalTotalChunks);
    console.log(`GuidebooksTab: Set totalChunks to ${finalTotalChunks} for ${jobs.length} jobs`);

    // Set currentJobId to the first job's ID immediately (enables cancel button promptly)
    if (jobs.length > 0) {
      setCurrentJobId(jobs[0].id);
    }

    // Use the shared translation runner
    const { runTranslationJobs } = await import("@/lib/services/translation-runner");
    try {
      await runTranslationJobs({
        jobs,
        translationService,
        setCurrentJobId,
        incrementCompletedChunks, // Connect to store for overall progress tracking
        targetLanguage,
        type: "patchouli",
        getOutputPath: (job: import("@/lib/types/minecraft").PatchouliTranslationJob) => job.targetPath,
        getResultContent: (job: import("@/lib/types/minecraft").PatchouliTranslationJob) => translationService.getCombinedTranslatedContent(job.id),
        writeOutput: async (job: import("@/lib/types/minecraft").PatchouliTranslationJob, outputPath, content) => {
          await FileService.invoke<boolean>("write_patchouli_book", {
            jarPath: outputPath,
            bookId: job.bookId,
            modId: job.modId,
            language: targetLanguage,
            sourcePaths: job.sourcePaths,
            content: JSON.stringify(content)
          });
        },
        onResult: addTranslationResult,
        onJobStart: async (job) => {
          try {
            await invoke('log_translation_process', { message: `Starting translation for guidebook: ${job.modId}:${job.bookId} (${job.sourcePaths.length} files)` });
          } catch {}
        },
        onJobComplete: async (job) => {
          try {
            await invoke('log_translation_process', { message: `Finished translation for guidebook: ${job.modId}:${job.bookId} (${job.sourcePaths.length} files)` });
          } catch {}
        },
        onJobInterrupted: async (job) => {
          try {
            await invoke('log_translation_process', { message: `Translation cancelled during guidebook: ${job.modId}:${job.bookId}` });
          } catch {}
        }
      });
    } finally {
      setTranslating(false);
    }
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
      prepareTranslationTargets={(targets, targetLanguage) => {
        const filteredTargets = targets.filter((target) => shouldTranslateMod(target, targetLanguage));
        if (filteredTargets.length !== targets.length) {
          console.info(`Skipped ${targets.length - filteredTargets.length} guidebooks with existing ${targetLanguage} translations`);
        }
        return filteredTargets;
      }}
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
