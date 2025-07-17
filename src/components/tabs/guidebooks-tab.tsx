"use client";

import { useAppStore } from "@/lib/store";
import { LangFile, PatchouliBook, TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { getRelativePath } from "@/lib/utils/path-utils";

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
    // Guidebook-level progress tracking
    setTotalGuidebooks,
    setCompletedGuidebooks,
    incrementCompletedGuidebooks,
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
          
          // Only process events for guidebooks scan
          if (progress.scanType === 'guidebooks') {
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

  // Scan for guidebooks
  const handleScan = async (directory: string) => {
    try {
      setScanning(true);
      
      // Set initial scan progress immediately
      setScanProgress({
        currentFile: 'Initializing scan...',
        processedCount: 0,
        totalCount: undefined,
        scanType: 'guidebooks',
      });
      
      // Get mods directory
      const modsDirectory = directory + "/mods";
      // Get mod files
      const modFiles = await FileService.getModFiles(modsDirectory);

      // Update progress immediately after file discovery
      setScanProgress({
        currentFile: 'Analyzing mod files...',
        processedCount: 0,
        totalCount: modFiles.length,
        scanType: 'guidebooks',
      });

      // Create translation targets
      const targets: TranslationTarget[] = [];

    for (let i = 0; i < modFiles.length; i++) {
      const modFile = modFiles[i];
      try {
        // Update progress for mod analysis phase
        setScanProgress({
          currentFile: modFile.split('/').pop() || modFile,
          processedCount: i + 1,
          totalCount: modFiles.length,
          scanType: 'guidebooks',
        });

        // Extract Patchouli books
        const books = await FileService.invoke<PatchouliBook[]>("extract_patchouli_books", {
          jarPath: modFile,
          tempDir: ""
        });

        if (books.length > 0) {
          // Calculate relative path (cross-platform)
          let relativePath = getRelativePath(modFile, directory);
          
          // Remove common "mods/" prefix if present
          if (relativePath.startsWith('mods/') || relativePath.startsWith('mods\\')) {
            relativePath = relativePath.substring(5);
          }

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
    } finally {
      setScanning(false);
      // Reset scan progress after completion
      resetScanProgress();
    }
  };

  // Translate guidebooks (refactored to match mods/custom-files/quests pattern)
  const handleTranslate = async (
    selectedTargets: TranslationTarget[],
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void,
    selectedDirectory: string,
    sessionId: string
  ) => {
    // Sort targets alphabetically for consistent processing
    const sortedTargets = [...selectedTargets].sort((a, b) => a.name.localeCompare(b.name));
    
    // Reset whole progress tracking
    setCompletedChunks(0);
    setWholeProgress(0);
    setCompletedGuidebooks(0);
    
    // Set total guidebooks for progress tracking
    setTotalGuidebooks(sortedTargets.length);

    // Prepare jobs and count total chunks
    let totalChunksCount = 0;
    const jobs = [];
    let skippedCount = 0;
    
    for (const target of selectedTargets) {
      try {
        // Extract Patchouli books first to get mod ID
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
        
        // Check if translation already exists when skipExistingTranslations is enabled
        if (config.translation.skipExistingTranslations ?? true) {
          const exists = await FileService.invoke<boolean>("check_guidebook_translation_exists", {
            guidebookPath: target.path,
            modId: book.modId,
            bookId: target.id,
            targetLanguage: targetLanguage
          });
          
          if (exists) {
            console.log(`Skipping guidebook ${target.name} (${target.id}) - translation already exists`);
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

        // Find source language file (default to en_us)
        const sourceFile = book.langFiles.find((file: LangFile) =>
          file.language === "en_us"
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

    // Ensure totalChunks is set correctly, fallback to jobs.length if calculation failed
    const finalTotalChunks = totalChunksCount > 0 ? totalChunksCount : jobs.length;
    setTotalChunks(finalTotalChunks);

    // Set currentJobId to the first job's ID immediately (enables cancel button promptly)
    if (jobs.length > 0) {
      setCurrentJobId(jobs[0].id);
    }

    // Use the session ID provided by the common translation tab
    const minecraftDir = selectedDirectory;
    const sessionPath = await invoke<string>('create_logs_directory_with_session', {
        minecraftDir: minecraftDir,
        sessionId: sessionId
    });
    console.log(`Guidebooks translation session created: ${sessionPath}`);

    // Use the shared translation runner
    const { runTranslationJobs } = await import("@/lib/services/translation-runner");
    try {
      await runTranslationJobs({
        jobs,
        translationService,
        setCurrentJobId,
        incrementCompletedChunks, // Connect to store for overall progress tracking
        incrementWholeProgress: incrementCompletedGuidebooks, // Track at guidebook level
        targetLanguage,
        type: "patchouli",
        sessionId,
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
      
      // Log skipped items summary
      if (skippedCount > 0) {
        try {
          await invoke('log_translation_process', { 
            message: `Translation completed. Skipped ${skippedCount} guidebooks that already have translations.`, 
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
      scanProgress={scanProgress}
      onScan={handleScan}
      onTranslate={handleTranslate}
    />
  );
}
