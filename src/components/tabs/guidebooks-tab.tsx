"use client";

import { useAppStore } from "@/lib/store";
import { LangFile, PatchouliBook, TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";
import { invoke } from "@tauri-apps/api/core";

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

        // Create a translation job
        const job: import("@/lib/types/minecraft").PatchouliTranslationJob = {
          ...translationService.createJob(
            sourceFile.content,
            config.translation.sourceLanguage,
            targetLanguage,
            target.name
          ),
          bookId: book.id,
          modId: book.modId,
          targetPath: target.path
        };
        jobs.push(job);
      } catch (error) {
        console.error(`Failed to analyze guidebook for chunk counting: ${target.name}`, error);
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
      await runTranslationJobs({
        jobs,
        translationService,
        setCurrentJobId,
        incrementCompletedChunks, // Connect to store for overall progress tracking
        sourceLanguage: config.translation.sourceLanguage,
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
            content: JSON.stringify(content)
          });
        },
        onResult: addTranslationResult,
        onJobStart: async (job, i) => {
          const target = selectedTargets[i];
          try {
            await invoke('log_translation_process', { message: `Starting translation for guidebook: ${target.name} (${target.id})` });
          } catch {}
        },
        onJobComplete: async (job, i) => {
          const target = selectedTargets[i];
          try {
            await invoke('log_translation_process', { message: `Finished translation for guidebook: ${target.name} (${target.id})` });
          } catch {}
        },
        onJobInterrupted: async (job, i) => {
          const target = selectedTargets[i];
          try {
            await invoke('log_translation_process', { message: `Translation cancelled by user during guidebook: ${target.name} (${target.id})` });
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
