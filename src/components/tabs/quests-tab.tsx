"use client";

import { useAppStore } from "@/lib/store";
import { TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";

export function QuestsTab() {
  const { 
    config, 
    questTranslationTargets, 
    setQuestTranslationTargets, 
    updateQuestTranslationTarget,
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

  // Scan for quests
  const handleScan = async (directory: string) => {
    // Get FTB quest files
    const ftbQuestFiles = await FileService.getFTBQuestFiles(directory);
    
    // Get Better Quests files
    const betterQuestFiles = await FileService.getBetterQuestFiles(directory);
    
    // Create translation targets
    const targets: TranslationTarget[] = [];
    
    // Add FTB quests
    for (let i = 0; i < ftbQuestFiles.length; i++) {
      const questFile = ftbQuestFiles[i];
      try {
        // In a real implementation, we would parse the quest file to get more information
        // For now, we'll just use the file path
        const fileName = questFile.split('/').pop() || "unknown";
        const questNumber = i + 1;
        
        // Calculate relative path by removing the selected directory part
        const relativePath = questFile.startsWith(directory) 
          ? questFile.substring(directory.length).replace(/^[/\\]+/, '') 
          : questFile;
        
        targets.push({
          type: "ftb",
          id: `ftb-quest-${questNumber}`,
          name: `FTB Quest ${questNumber}: ${fileName}`,
          path: questFile,
          relativePath: relativePath,
          selected: true
        });
      } catch (error) {
        console.error(`Failed to analyze FTB quest: ${questFile}`, error);
      }
    }
    
    // Add Better Quests
    for (let i = 0; i < betterQuestFiles.length; i++) {
      const questFile = betterQuestFiles[i];
      try {
        // In a real implementation, we would parse the quest file to get more information
        // For now, we'll just use the file path
        const fileName = questFile.split('/').pop() || "unknown";
        const questNumber = i + 1;
        
        // Calculate relative path by removing the selected directory part
        const relativePath = questFile.startsWith(directory) 
          ? questFile.substring(directory.length).replace(/^[/\\]+/, '') 
          : questFile;
        
        targets.push({
          type: "better",
          id: `better-quest-${questNumber}`,
          name: `Better Quest ${questNumber}: ${fileName}`,
          path: questFile,
          relativePath: relativePath,
          selected: true
        });
      } catch (error) {
        console.error(`Failed to analyze Better quest: ${questFile}`, error);
      }
    }
    
    setQuestTranslationTargets(targets);
  };

  // Translate quests
  const handleTranslate = async (
    selectedTargets: TranslationTarget[], 
    targetLanguage: string,
    translationService: TranslationService,
    setCurrentJobId: (jobId: string | null) => void,
    addTranslationResult: (result: TranslationResult) => void,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    selectedDirectory: string // for API compatibility, not used
  ) => {
    // Reset whole progress tracking
    setCompletedChunks(0);
    setWholeProgress(0);
    
    // For quests, each quest file represents one logical processing unit
    // However, we need to consider the actual chunks that will be created by the translation service
    let totalChunksCount = 0;
    for (const target of selectedTargets) {
      try {
        // Read quest file to estimate chunk count
        const content = await FileService.readTextFile(target.path);
        // Create a temporary job to see how many chunks it would generate
        const tempJob = translationService.createJob(
          { content },
          targetLanguage,
          target.name
        );
        totalChunksCount += tempJob.chunks.length;
      } catch {
        // If we can't analyze the file, assume 1 chunk
        totalChunksCount += 1;
      }
    }
    
    setTotalChunks(totalChunksCount);
    console.log(`QuestsTab: Set totalChunks to ${totalChunksCount} for ${selectedTargets.length} quest files`);
    
    // Translate each quest
    for (let i = 0; i < selectedTargets.length; i++) {
      const target = selectedTargets[i];
      setProgress(Math.round((i / selectedTargets.length) * 100));
      
      try {
        // Read quest file
        const content = await FileService.readTextFile(target.path);
        
        // Create a translation job with a simple key-value structure
        const job = translationService.createJob(
          { content },
          targetLanguage,
          target.name
        );
        
        // Store the job ID
        setCurrentJobId(job.id);
        
        // Start the translation job
        await translationService.startJob(job.id);
        
        // Get the completed job to check chunk count
        const completedJob = translationService.getJob(job.id);
        
        // Increment by the actual number of chunks processed
        if (completedJob && completedJob.chunks) {
          for (let chunkIndex = 0; chunkIndex < completedJob.chunks.length; chunkIndex++) {
            incrementCompletedChunks();
          }
        } else {
          // Fallback to single increment if chunks not available
          incrementCompletedChunks();
        }
        
        // Get the translated content
        const translatedContent = translationService.getCombinedTranslatedContent(job.id);
        const translatedText = translatedContent.content || `[${targetLanguage}] ${content}`;
        
        // Write translated file
        const outputPath = target.path.replace(
          `.${target.type}`,
          `.${targetLanguage}.${target.type}`
        );
        
        await FileService.writeTextFile(outputPath, translatedText);
        
        // Add translation result with proper success determination
        addTranslationResult({
          type: target.type,
          id: target.id,
          targetLanguage: targetLanguage,
          content: { [target.id]: translatedText },
          outputPath,
          success: completedJob?.status === "completed"
        });
      } catch (error) {
        console.error(`Failed to translate quest: ${target.name}`, error);
        // Add failed translation result
        addTranslationResult({
          type: target.type,
          id: target.id,
          targetLanguage: targetLanguage,
          content: {},
          outputPath: "",
          success: false
        });
        
        // Increment completed chunks for failed quests (assume 1 chunk)
        incrementCompletedChunks();
      }
    }
    
    // Clear the job ID
    setCurrentJobId(null);
  };

  // Custom render function for the type column
  const renderQuestType = (target: TranslationTarget) => {
    return target.type === "ftb" ? "FTB Quest" : "Better Quest";
  };

  return (
    <TranslationTab
      tabType="quests"
      scanButtonLabel="buttons.scanQuests"
      scanningLabel="buttons.scanning"
      progressLabel="progress.translatingQuests"
      noItemsSelectedError="errors.noQuestsSelected"
      noItemsFoundLabel="tables.noQuestsFound"
      scanningForItemsLabel="tables.scanningForQuests"
      filterPlaceholder="filters.filterQuests"
      tableColumns={[
        { key: "name", label: "tables.questName" },
        { key: "type", label: "tables.type", render: renderQuestType },
        { 
          key: "relativePath", 
          label: "tables.path", 
          className: "truncate max-w-[300px]",
          render: (target) => target.relativePath || target.path
        }
      ]}
      config={config}
      translationTargets={questTranslationTargets}
      setTranslationTargets={setQuestTranslationTargets}
      updateTranslationTarget={updateQuestTranslationTarget}
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
