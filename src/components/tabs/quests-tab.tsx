"use client";

import { useAppTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { TranslationResult, TranslationTarget } from "@/lib/types/minecraft";
import { FileService } from "@/lib/services/file-service";
import { TranslationService } from "@/lib/services/translation-service";
import { TranslationTab } from "@/components/tabs/common/translation-tab";
import {
  applyBetterQuestJsonTranslations,
  applyJavaLangTranslations,
  applyJsonLangTranslations,
  applyQuestTranslations,
  extractBetterQuestJsonText,
  extractJavaLangText,
  extractJsonLangText,
  extractQuestText,
  filterExistingQuestTranslations,
  getDirectQuestBackupPath,
  getQuestOutputPath,
  getQuestSourceCacheKey,
  isDirectQuestSource,
  type QuestTextBundle
} from "@/lib/services/quest-text";

export function QuestsTab() {
  const { t } = useAppTranslation();
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
          name: `${/[\\/]config[\\/](?:ftbquests|ftb_quests)[\\/]quests[\\/]/i.test(questFile) ? "FTB Quest" : "Quest Language"} ${questNumber}: ${fileName}`,
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

    type PreparedQuest = {
      target: TranslationTarget;
      source: string;
      questText: QuestTextBundle;
      isJsonLang: boolean;
      isJavaLang: boolean;
      isBetterQuestData: boolean;
      localCacheKeys: Record<string, string>;
      jobCacheKeys: Record<string, string>;
      job: ReturnType<TranslationService["createJob"]> | null;
      error?: unknown;
    };

    // Translate split FTB locale files first, so the older flat locale file can reuse their results.
    const isFlatFtbLocale = (target: TranslationTarget) =>
      target.type === "ftb" && /[\\/]lang[\\/]en_us\.snbt(?:_merged)?$/i.test(target.path);
    const orderedTargets = [...selectedTargets].sort((left, right) =>
      Number(isFlatFtbLocale(left)) - Number(isFlatFtbLocale(right)) || left.path.localeCompare(right.path)
    );
    const plannedTranslations = new Set<string>();
    const prepared: PreparedQuest[] = [];
    let totalChunksCount = 0;
    for (const target of orderedTargets) {
      try {
        const normalizedPath = target.path.replace(/\\/g, "/").toLowerCase();
        const isBetterQuestData = target.type === "better" && /\/config\/betterquesting\/(?:defaultquests\.json|defaultquests\/.*\.json)$/.test(normalizedPath);
        const isJsonLang = target.path.toLowerCase().endsWith(".json") && !isBetterQuestData;
        const isJavaLang = target.path.toLowerCase().endsWith(".lang");
        let source = await FileService.readTextFile(target.path);
        if (isDirectQuestSource(target.path)) {
          const backupPath = getDirectQuestBackupPath(target.path);
          if (await FileService.invoke<boolean>("file_exists", { path: backupPath })) {
            source = await FileService.readTextFile(backupPath);
          }
        }
        const questText: QuestTextBundle = isBetterQuestData
          ? extractBetterQuestJsonText(source)
          : isJsonLang
            ? { content: extractJsonLangText(source), spans: [] }
            : isJavaLang
              ? extractJavaLangText(source)
              : extractQuestText(source);
        const spanByKey = new Map(questText.spans.map((span) => [span.key, span]));
        const localCacheKeys: Record<string, string> = {};
        const jobCacheKeys: Record<string, string> = {};
        const jobContent: Record<string, string> = {};
        for (const [localKey, sourceText] of Object.entries(questText.content)) {
          const cacheKey = getQuestSourceCacheKey(target.path, localKey, sourceText, spanByKey.get(localKey)?.sourceKey);
          localCacheKeys[localKey] = cacheKey;
          if (plannedTranslations.has(cacheKey)) continue;
          plannedTranslations.add(cacheKey);
          const jobKey = `entry.${Object.keys(jobContent).length}`;
          jobContent[jobKey] = sourceText;
          jobCacheKeys[jobKey] = cacheKey;
        }
        const job = Object.keys(jobContent).length > 0
          ? translationService.createJob(jobContent, targetLanguage, target.name)
          : null;
        if (job) totalChunksCount += job.chunks.length;
        prepared.push({ target, source, questText, isJsonLang, isJavaLang, isBetterQuestData, localCacheKeys, jobCacheKeys, job });
      } catch (error) {
        // Keep the target visible in progress/results even if its source cannot be read.
        totalChunksCount += 1;
        prepared.push({
          target, source: "", questText: { content: {}, spans: [] }, isJsonLang: false, isJavaLang: false, isBetterQuestData: false,
          localCacheKeys: {}, jobCacheKeys: {}, job: null, error
        });
      }
    }

    setTotalChunks(totalChunksCount);
    console.log(`QuestsTab: Set totalChunks to ${totalChunksCount} for ${prepared.length} quest files after reusing duplicate FTB keys`);

    const translatedBySource = new Map<string, string>();
    const jobs = prepared.flatMap((item) => item.job ? [item.job] : []);
    const batchChunks = jobs.flatMap((job) => job.chunks.map((chunk, chunkIndex) => ({ job, chunk, chunkIndex })));
    const useBatchApi = translationService.usesBatchApi && batchChunks.length > 0;
    if (useBatchApi) {
      setCurrentJobId(jobs[0]?.id ?? null);
      for (const job of jobs) {
        job.status = "processing";
        job.startTime = Date.now();
        for (const chunk of job.chunks) chunk.status = "processing";
      }

      let progressCount = 0;
      const recordProgress = (completed: number) => {
        const bounded = Math.max(progressCount, Math.min(batchChunks.length, completed));
        while (progressCount < bounded) {
          progressCount++;
          incrementCompletedChunks();
        }
      };

      try {
        const results = await translationService.translateChunksBatch(
          batchChunks.map(({ job, chunk }) => ({
            content: chunk.content,
            targetLanguage: job.targetLanguage,
            jobId: job.id
          })),
          ({ completed }) => recordProgress(completed)
        );
        for (let index = 0; index < batchChunks.length; index++) {
          const { chunk } = batchChunks[index];
          const result = results[index];
          if (result?.translatedContent) {
            chunk.translatedContent = result.translatedContent;
            chunk.status = "completed";
          } else {
            chunk.status = "failed";
            chunk.error = result?.error || "Batch API did not return a translation for this chunk";
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const { chunk } of batchChunks) {
          chunk.status = "failed";
          chunk.error = message;
        }
      }

      for (const job of jobs) {
        job.status = job.chunks.every((chunk) => chunk.status === "completed") ? "completed" : "failed";
        job.endTime = Date.now();
        if (job.status === "failed") {
          job.error = job.chunks.find((chunk) => chunk.status === "failed")?.error || "One or more Batch requests failed";
        }
      }
      recordProgress(batchChunks.length);
    }

    for (let i = 0; i < prepared.length; i++) {
      const { target, source, questText, isJsonLang, isJavaLang, isBetterQuestData, localCacheKeys, jobCacheKeys, job, error: preparationError } = prepared[i];
      setProgress(Math.round((i / prepared.length) * 100));

      try {
        if (preparationError) throw preparationError;
        if (Object.keys(questText.content).length === 0) {
          console.warn(`No translatable quest text found: ${target.name}`);
          continue;
        }

        let completedJob: ReturnType<TranslationService["getJob"]> | null = null;
        if (job) {
          if (useBatchApi) {
            completedJob = job;
          } else {
            setCurrentJobId(job.id);
            await translationService.startJob(job.id);
            completedJob = translationService.getJob(job.id);
            for (let chunkIndex = 0; chunkIndex < job.chunks.length; chunkIndex++) {
              incrementCompletedChunks();
            }
          }
          if (completedJob?.status !== "completed") {
            throw new Error(completedJob?.error || "Translation job did not complete; refusing to write a partial locale file");
          }
          const translatedJobContent = translationService.getCombinedTranslatedContent(job.id);
          for (const [jobKey, cacheKey] of Object.entries(jobCacheKeys)) {
            const translation = translatedJobContent[jobKey];
            if (typeof translation === "string") translatedBySource.set(cacheKey, translation);
          }
        }

        const translatedContent: Record<string, string> = {};
        for (const [localKey, cacheKey] of Object.entries(localCacheKeys)) {
          const translation = translatedBySource.get(cacheKey);
          if (translation === undefined) throw new Error(`No validated translation available for ${localKey}`);
          translatedContent[localKey] = translation;
        }
        const translatedText = isBetterQuestData
          ? applyBetterQuestJsonTranslations(source, questText, translatedContent)
          : isJsonLang
            ? applyJsonLangTranslations(source, translatedContent)
            : isJavaLang
              ? applyJavaLangTranslations(source, questText, translatedContent)
              : applyQuestTranslations(source, questText, translatedContent);

        // Write a language-specific output; never overwrite the English source.
        const outputPath = getQuestOutputPath(target.path, targetLanguage);

        if (outputPath === target.path && isDirectQuestSource(target.path)) {
          const backupPath = getDirectQuestBackupPath(target.path);
          if (!(await FileService.invoke<boolean>("file_exists", { path: backupPath }))) {
            await FileService.writeTextFile(backupPath, await FileService.readTextFile(target.path));
          }
        }
        
        await FileService.writeTextFile(outputPath, translatedText);
        
        // Add translation result with proper success determination
        addTranslationResult({
          type: target.type,
          id: target.id,
          targetLanguage: targetLanguage,
          content: translatedContent,
          outputPath,
          success: !completedJob || completedJob.status === "completed"
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
        
        if (!job) incrementCompletedChunks();
      }
    }

    // Clear the job ID
    setCurrentJobId(null);
    setProgress(100);
    setWholeProgress(100);
    setTranslating(false);
  };

  // Custom render function for the type column
  const renderQuestType = (target: TranslationTarget) => {
    if (target.type === "better") return "Better Quest";
    return /[\\/]config[\\/](?:ftbquests|ftb_quests)[\\/]quests[\\/]/i.test(target.path)
      ? "FTB Quest"
      : t("tables.questLanguage");
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
      prepareTranslationTargets={async (targets, targetLanguage) => {
        if (config.translation.skipExistingTranslations === false) return targets;
        const filteredTargets = await filterExistingQuestTranslations(
          targets,
          targetLanguage,
          (path) => FileService.invoke<boolean>("file_exists", { path })
        );
        if (filteredTargets.length !== targets.length) {
          console.info(`Skipped ${targets.length - filteredTargets.length} quest files with existing ${targetLanguage} translations`);
        }
        return filteredTargets;
      }}
      confirmBeforeTranslate={(targets) => {
        const directCount = targets.filter((target) => isDirectQuestSource(target.path)).length;
        if (directCount === 0) return true;
        return window.confirm(t('confirmation.overwriteLegacyQuests', { count: directCount }));
      }}
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
