"use client";

import { useAppStore } from "@/lib/store";
import { TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService, TranslationJob } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";
import { runTranslationJobs } from "@/lib/services/translation-runner";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { getFileName, getRelativePath, getDirectoryPath, joinPath } from "@/lib/utils/path-utils";

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
    incrementCompletedChunks,
    // Custom files-level progress tracking
    setTotalCustomFiles,
    setCompletedCustomFiles,
    incrementCompletedCustomFiles,
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
          
          // Only process events for custom-files scan
          if (progress.scanType === 'custom-files') {
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

  // Scan for custom files
  const handleScan = async (directory: string) => {
    try {
      setScanning(true);
      
      // Set initial scan progress immediately
      setScanProgress({
        currentFile: 'Initializing scan...',
        processedCount: 0,
        totalCount: undefined,
        scanType: 'custom-files',
      });
      
      // Get JSON and SNBT files
      const jsonFiles = await FileService.getFilesWithExtension(directory, ".json");
      const snbtFiles = await FileService.getFilesWithExtension(directory, ".snbt");
      
      // Combine files
      const allFiles = [...jsonFiles, ...snbtFiles];
      
      // Update progress immediately after file discovery
      setScanProgress({
        currentFile: 'Analyzing custom files...',
        processedCount: 0,
        totalCount: allFiles.length,
        scanType: 'custom-files',
      });
      
      // Create translation targets
    const targets: TranslationTarget[] = [];
    
    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i];
      try {
        // Update progress for file analysis phase
        setScanProgress({
          currentFile: filePath.split('/').pop() || filePath,
          processedCount: i + 1,
          totalCount: allFiles.length,
          scanType: 'custom-files',
        });

        // Get file name (cross-platform)
        const fileName = getFileName(filePath);
        
        // Calculate relative path (cross-platform)
        const relativePath = getRelativePath(filePath, directory);
        
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
    } finally {
      setScanning(false);
      // Reset scan progress after completion
      resetScanProgress();
    }
  };

  // Translate custom files
  const handleTranslate = async (
    selectedTargets: TranslationTarget[], 
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void,
    selectedDirectory: string,
    sessionId: string
  ) => {
    try {
      setTranslating(true);
      
      // Get the directory from the first target (cross-platform)
      const directory = selectedTargets[0] ? getDirectoryPath(selectedTargets[0].path) : '';
      
      // Create output directory (cross-platform)
      const outputDir = joinPath(directory, 'translated');
      await FileService.createDirectory(outputDir);
      
      // Sort targets alphabetically for consistent processing
      const sortedTargets = [...selectedTargets].sort((a, b) => a.name.localeCompare(b.name));
      
      // Reset progress tracking
      setCompletedChunks(0);
      setWholeProgress(0);
      setProgress(0);
      setCompletedCustomFiles(0);
      
      // Create jobs for all files
      const jobs: Array<{
        target: TranslationTarget;
        job: TranslationJob;
        fileType: 'json' | 'snbt' | 'unsupported';
        content: string;
        jsonData?: unknown;
      }> = [];
      
      for (const target of sortedTargets) {
        try {
          // Read file content
          const content = await FileService.readTextFile(target.path);
          
          // Determine file type
          const isJson = target.path.toLowerCase().endsWith('.json');
          const isSnbt = target.path.toLowerCase().endsWith('.snbt');
          
          if (isJson) {
            try {
              const jsonData = JSON.parse(content);
              // Flatten JSON to key-value pairs for translation
              const flattenedContent = flattenJson(jsonData);
              
              // Create a translation job
              const job = translationService.createJob(
                flattenedContent,
                targetLanguage,
                target.name
              );
              
              jobs.push({ target, job, fileType: 'json', content, jsonData });
            } catch (error) {
              console.error(`Failed to parse JSON: ${target.path}`, error);
              // Add failed result immediately
              addTranslationResult({
                type: "custom",
                id: target.id,
                targetLanguage: targetLanguage,
                content: {},
                outputPath: "",
                success: false
              });
              incrementCompletedChunks();
            }
          } else if (isSnbt) {
            // Create a translation job for SNBT content
            const job = translationService.createJob(
              { content },
              targetLanguage,
              target.name
            );
            
            jobs.push({ target, job, fileType: 'snbt', content });
          } else {
            console.warn(`Unsupported file type: ${target.path}`);
            // Add failed result immediately
            addTranslationResult({
              type: "custom",
              id: target.id,
              targetLanguage: targetLanguage,
              content: {},
              outputPath: "",
              success: false
            });
            incrementCompletedChunks();
          }
        } catch (error) {
          console.error(`Failed to read file: ${target.path}`, error);
          // Add failed result immediately
          addTranslationResult({
            type: "custom",
            id: target.id,
            targetLanguage: targetLanguage,
            content: {},
            outputPath: "",
            success: false
          });
          incrementCompletedChunks();
        }
      }
      
      // Set total files for progress tracking: denominator = actual jobs, numerator = completed files
      // This ensures progress reaches 100% when all translatable files are processed
      setTotalCustomFiles(jobs.length);
      setTotalChunks(jobs.length); // Track at file level
      
      // Use the session ID provided by the common translation tab
      const minecraftDir = selectedDirectory;
      const sessionPath = await invoke<string>('create_logs_directory_with_session', {
          minecraftDir: minecraftDir,
          sessionId: sessionId
      });
      console.log(`Custom files translation session created: ${sessionPath}`);
      
      // Use runTranslationJobs for consistent processing
      await runTranslationJobs({
        jobs: jobs.map(({ job }) => job),
        translationService,
        setCurrentJobId,
        incrementCompletedChunks, // Track at chunk level for real-time progress
        incrementWholeProgress: incrementCompletedCustomFiles, // Track at file level
        targetLanguage,
        type: "custom",
        sessionId,
        getOutputPath: () => outputDir,
        getResultContent: (job) => translationService.getCombinedTranslatedContent(job.id),
        writeOutput: async (job, outputPath, content) => {
          // Find the corresponding file data
          const fileData = jobs.find(j => j.job.id === job.id);
          if (!fileData) return;
          
          const fileName = getFileName(fileData.target.path);
          const outputFilePath = joinPath(outputPath, `${targetLanguage}_${fileName}`);
          
          if (fileData.fileType === 'json' && fileData.jsonData) {
            // Reconstruct JSON from flattened content
            const reconstructedJson = reconstructJson(fileData.jsonData, content);
            const translatedContent = JSON.stringify(reconstructedJson, null, 2);
            await FileService.writeTextFile(outputFilePath, translatedContent);
          } else if (fileData.fileType === 'snbt') {
            const translatedText = content.content || `[${targetLanguage}] ${fileData.content}`;
            await FileService.writeTextFile(outputFilePath, translatedText);
          }
        },
        onResult: addTranslationResult,
        onJobStart: async (job) => {
          const fileData = jobs.find(j => j.job.id === job.id);
          if (!fileData) return;
          try {
            await invoke('log_translation_process', {
              message: `Starting translation for custom file: ${fileData.target.name} (${fileData.target.id})`
            });
          } catch {}
        },
        onJobComplete: async (job) => {
          const fileData = jobs.find(j => j.job.id === job.id);
          if (!fileData) return;
          try {
            await invoke('log_translation_process', {
              message: `Completed translation for custom file: ${fileData.target.name} (${fileData.target.id})`
            });
          } catch {}
        },
        onJobInterrupted: async (job) => {
          const fileData = jobs.find(j => j.job.id === job.id);
          if (!fileData) return;
          try {
            await invoke('log_translation_process', {
              message: `Translation cancelled by user during custom file: ${fileData.target.name} (${fileData.target.id})`
            });
          } catch {}
        }
      });
    } finally {
      setTranslating(false);
    }
  };
  
  // Flatten JSON to key-value pairs
  const flattenJson = (json: unknown, prefix = ''): Record<string, string> => {
    const result: Record<string, string> = {};
    
    const flatten = (obj: unknown, currentPrefix: string) => {
      if (typeof obj === 'string') {
        result[currentPrefix] = obj;
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          flatten(item, `${currentPrefix}[${index}]`);
        });
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          const newPrefix = currentPrefix ? `${currentPrefix}.${key}` : key;
          flatten(value, newPrefix);
        });
      }
    };
    
    flatten(json, prefix);
    return result;
  };
  
  // Reconstruct JSON from flattened content
  const reconstructJson = (originalJson: unknown, translatedContent: Record<string, string>): unknown => {
    const reconstruct = (obj: unknown, prefix = ''): unknown => {
      if (typeof obj === 'string') {
        return translatedContent[prefix] || obj;
      } else if (Array.isArray(obj)) {
        return obj.map((item, index) => 
          reconstruct(item, `${prefix}[${index}]`)
        );
      } else if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        Object.entries(obj).forEach(([key, value]) => {
          const newPrefix = prefix ? `${prefix}.${key}` : key;
          result[key] = reconstruct(value, newPrefix);
        });
        return result;
      }
      return obj;
    };
    
    return reconstruct(originalJson);
  };

  // Custom render function for the file type column
  const renderFileType = (target: TranslationTarget) => {
    const isJson = target.path.toLowerCase().endsWith('.json');
    const type = isJson ? "JSON" : "SNBT";
    const className = isJson 
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
        {type}
      </span>
    );
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
      scanProgress={scanProgress}
      onScan={handleScan}
      onTranslate={handleTranslate}
    />
  );
}
