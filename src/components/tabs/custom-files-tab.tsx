"use client";

import { useAppStore } from "@/lib/store";
import { TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { isFtbQuestSourcePath } from "@/lib/services/custom-files";
import { TranslationService } from "@/lib/services/translation-service";
import { applyCustomJsonTranslations, extractCustomJsonText } from "@/lib/services/custom-json";
import { applyQuestTranslations, extractQuestText } from "@/lib/services/quest-text";
import { addToTranslationBatch, createTranslationBatch, restoreBatchedTranslations } from "@/lib/services/translation-batch";
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
    
    const translatedDirectory = `${directory.replace(/[\\/]+$/, "")}/translated`.replace(/\\/g, "/").toLowerCase();
    const allFiles = [...jsonFiles, ...snbtFiles].filter((filePath) => {
      const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();
      return !normalizedPath.startsWith(`${translatedDirectory}/`)
        && !isFtbQuestSourcePath(filePath);
    });
    
    // Create translation targets
    const targets: TranslationTarget[] = [];
    
    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i];
      try {
        // Get file name
        const fileName = filePath.split(/[\\/]/).pop() || "unknown";
        
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
    selectedDirectory: string
  ) => {
    const separator = selectedDirectory.includes("\\") ? "\\" : "/";
    const rootDirectory = selectedDirectory.replace(/[\\/]+$/, "");
    const outputDir = `${rootDirectory}${separator}translated`;
    setCompletedChunks(0);
    setWholeProgress(0);

    type PreparedFile = {
      target: TranslationTarget;
      outputPath: string;
      sourceContent: Record<string, string>;
      batchKeyByLocalKey: Record<string, string | null>;
      render: (translated: Record<string, string>) => string;
    };
    const batch = createTranslationBatch();
    const prepared: PreparedFile[] = [];

    for (const target of selectedTargets) {
      const relativeSegments = (target.relativePath || target.name)
        .split(/[\\/]/)
        .filter((segment) => segment && segment !== "." && segment !== "..");
      const fileName = relativeSegments.pop() || target.name;
      const outputPath = [...[outputDir, ...relativeSegments], `${targetLanguage}_${fileName}`].join(separator);

      try {
        const content = await FileService.readTextFile(target.path);
        let sourceContent: Record<string, string>;
        let render: PreparedFile["render"];

        if (target.path.toLowerCase().endsWith(".json")) {
          const jsonData: unknown = JSON.parse(content);
          const bundle = extractCustomJsonText(jsonData);
          sourceContent = bundle.content;
          render = (translated) => JSON.stringify(applyCustomJsonTranslations(jsonData, bundle, translated), null, 2);
        } else if (target.path.toLowerCase().endsWith(".snbt")) {
          const bundle = extractQuestText(content);
          const isStructuredQuest = bundle.spans.length > 0;
          sourceContent = isStructuredQuest ? bundle.content : { content };
          render = (translated) => {
            if (isStructuredQuest) return applyQuestTranslations(content, bundle, translated);
            const translatedText = translated.content;
            if (typeof translatedText !== "string") throw new Error("The model returned no complete SNBT translation");
            return translatedText;
          };
        } else {
          throw new Error(`Unsupported file type: ${target.path}`);
        }

        prepared.push({
          target,
          outputPath,
          sourceContent,
          batchKeyByLocalKey: addToTranslationBatch(batch, sourceContent),
          render,
        });
      } catch (error) {
        console.error(`Failed to prepare custom file: ${target.path}`, error);
        addTranslationResult({ type: "custom", id: target.id, targetLanguage, content: {}, outputPath, success: false });
      }
    }

    let translatedBatch: Record<string, string> = {};
    if (Object.keys(batch.content).length > 0) {
      const job = translationService.createJob(batch.content, targetLanguage, `${selectedTargets.length} custom files`);
      setCurrentJobId(job.id);
      setTotalChunks(job.chunks.length);
      try {
        await translationService.startJob(job.id);
        translatedBatch = translationService.getCombinedTranslatedContent(job.id);
      } catch (error) {
        console.error("Failed to translate the shared custom-file batch", error);
      }
      setCompletedChunks(job.chunks.filter((chunk) => chunk.status === "completed").length);
    } else {
      setTotalChunks(0);
    }

    for (let index = 0; index < prepared.length; index++) {
      const file = prepared[index];
      setProgress(Math.round((index / Math.max(1, prepared.length)) * 100));
      try {
        const localTranslations = restoreBatchedTranslations(
          file.sourceContent,
          file.batchKeyByLocalKey,
          translatedBatch
        );
        const translatedContent = file.render(localTranslations);
        const outputDirectory = file.outputPath.slice(0, file.outputPath.lastIndexOf(separator));
        await FileService.createDirectory(outputDirectory);
        await FileService.writeTextFile(file.outputPath, translatedContent);
        addTranslationResult({
          type: "custom",
          id: file.target.id,
          targetLanguage,
          content: { [file.target.id]: translatedContent },
          outputPath: file.outputPath,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to render or write custom file: ${file.target.path}`, error);
        addTranslationResult({
          type: "custom",
          id: file.target.id,
          targetLanguage,
          content: {},
          outputPath: file.outputPath,
          success: false,
        });
      }
      setWholeProgress(Math.round(((index + 1) / Math.max(1, prepared.length)) * 100));
    }

    setProgress(100);
    setCurrentJobId(null);
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
