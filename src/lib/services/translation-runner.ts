import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store';
import { TranslationService, TranslationJob } from "./translation-service";
import { TranslationResult, TranslationTargetType } from "../types/minecraft";

/**
 * Shared translation runner for all tabs.
 * Processes jobs chunk-by-chunk, checks for cancellation, and reports progress/results.
 */
export interface RunTranslationJobsOptions<T extends TranslationJob = TranslationJob> {
  setProgress?: (progress: number) => void;
  incrementWholeProgress?: () => void;
  sessionId?: string;
  enableBackup?: boolean;
  jobs: T[];
  translationService: TranslationService;
  onJobStart?: (job: T, index: number) => void;
  onJobChunkComplete?: (job: T, chunkIndex: number) => void;
  onJobComplete?: (job: T, index: number) => void;
  onJobInterrupted?: (job: T, index: number) => void;
  onResult?: (result: TranslationResult) => void;
  setCurrentJobId?: (jobId: string | null) => void;
  incrementCompletedChunks?: () => void;
  incrementCompletedMods?: () => void;
  getOutputPath: (job: T) => string;
  getResultContent: (job: T) => Record<string, string>;
  writeOutput: (job: T, outputPath: string, content: Record<string, string>) => Promise<void>;
  targetLanguage: string;
  type: TranslationTargetType;
}

/**
 * Runs translation jobs with cancellation and progress support.
 */
export async function runTranslationJobs<T extends TranslationJob = TranslationJob>(options: RunTranslationJobsOptions<T>): Promise<void> {
  const {
    setProgress, incrementWholeProgress, sessionId, enableBackup = true,
    jobs,
    translationService,
    onJobStart,
    onJobChunkComplete,
    onJobComplete,
    onJobInterrupted,
    onResult,
    setCurrentJobId,
    incrementCompletedChunks,
    incrementCompletedMods,
    getOutputPath,
    getResultContent,
    writeOutput,
    targetLanguage,
    type
  } = options;

  const batchChunkCount = jobs.reduce((count, job) => count + job.chunks.length, 0);
  const useBatchApi = translationService.usesBatchApi && batchChunkCount > 0;
  if (useBatchApi) {
    // ponytail: poll this run in memory; persist batch IDs and chunk mappings if restart/resume becomes necessary.
    const chunks = jobs.flatMap((job) => job.chunks.map((chunk, chunkIndex) => ({ job, chunk, chunkIndex })));
    for (let index = 0; index < jobs.length; index++) {
      const job = jobs[index];
      onJobStart?.(job, index);
      job.status = "processing";
      job.startTime = Date.now();
    }
    for (const { chunk } of chunks) chunk.status = "processing";
    if (jobs[0]) setCurrentJobId?.(jobs[0].id);

    let progressCount = 0;
    const recordProgress = (completed: number) => {
      const bounded = Math.max(progressCount, Math.min(chunks.length, completed));
      while (progressCount < bounded) {
        progressCount++;
        incrementCompletedChunks?.();
      }
    };

    try {
      const results = await translationService.translateChunksBatch(
        chunks.map(({ job, chunk }) => ({
          content: chunk.content,
          targetLanguage: job.targetLanguage,
          jobId: job.id
        })),
        ({ completed }) => recordProgress(completed)
      );
      for (let index = 0; index < chunks.length; index++) {
        const { chunk } = chunks[index];
        const result = results[index];
        if (result?.translatedContent) {
          chunk.translatedContent = result.translatedContent;
          chunk.status = "completed";
        } else {
          chunk.status = "failed";
          chunk.error = result?.error || "Batch API did not return a translation for this chunk";
        }
      }
      recordProgress(chunks.length);
      for (const job of jobs) {
        job.progress = job.chunks.length ? Math.round(job.chunks.filter((chunk) => chunk.status === "completed").length / job.chunks.length * 100) : 0;
      }
      for (const { job, chunkIndex } of chunks) onJobChunkComplete?.(job, chunkIndex);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Translation interrupted by user/i.test(message)) {
        for (let index = 0; index < jobs.length; index++) {
          jobs[index].status = "interrupted";
          jobs[index].endTime = Date.now();
          onJobInterrupted?.(jobs[index], index);
        }
        setCurrentJobId?.(null);
        return;
      }
      for (const { chunk } of chunks) {
        chunk.status = "failed";
        chunk.error = message;
      }
      recordProgress(chunks.length);
      for (const { job, chunkIndex } of chunks) onJobChunkComplete?.(job, chunkIndex);
    }
  }

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    if (!useBatchApi) {
      if (onJobStart) onJobStart(job, i);
      if (setCurrentJobId) setCurrentJobId(job.id);

      // Start the translation job chunk-by-chunk, checking for interruption
      job.status = "processing";
      job.startTime = Date.now();

      for (let chunkIndex = 0; chunkIndex < job.chunks.length; chunkIndex++) {
        // Check for cancellation
        if (translationService.isJobInterrupted(job.id)) {
          job.status = "interrupted";
          job.endTime = Date.now();
          if (onJobInterrupted) onJobInterrupted(job, i);
          break;
        }
        const chunk = job.chunks[chunkIndex];
        chunk.status = "processing";
        try {
          const translatedContent = await translationService.translateChunk(
            chunk.content,
            job.targetLanguage,
            job.id
          );
          chunk.translatedContent = translatedContent;
          chunk.status = "completed";
        } catch (error) {
          chunk.status = "failed";
          chunk.error = error instanceof Error ? error.message : String(error);
        }
        job.progress = Math.round(((chunkIndex + 1) / job.chunks.length) * 100);
        setProgress?.(job.progress);
        // Increment chunk-level progress once per chunk (only if chunk tracking is used)
        if (incrementCompletedChunks) incrementCompletedChunks();
        if (onJobChunkComplete) onJobChunkComplete(job, chunkIndex);
      }

      // If interrupted, stop processing further jobs
      if (job.status === "interrupted" || translationService.isJobInterrupted(job.id)) {
        if (setCurrentJobId) setCurrentJobId(null);
        break;
      }
    }

    // Mark job as complete
    job.status = job.chunks.every((c: import("./translation-service").TranslationChunk) => c.status === "completed") ? "completed" : "failed";
    job.endTime = Date.now();
    if (job.status === "failed") {
      job.error = job.chunks.find((chunk) => chunk.status === "failed")?.error || "One or more translation chunks failed";
    }

    // Never write a failed or partial translation: an empty/partial ja_jp file
    // would look like a valid existing locale on the next scan.
    const outputPath = getOutputPath(job);
    const content = getResultContent(job);
    if (job.status === "completed") {
      const expectedKeys = new Set(job.chunks.flatMap((chunk) => Object.keys(chunk.content)));
      const actualKeys = Object.keys(content);
      const missing = [...expectedKeys].filter((key) => !Object.prototype.hasOwnProperty.call(content, key));
      const extra = actualKeys.filter((key) => !expectedKeys.has(key));
      const invalid = actualKeys.filter((key) => expectedKeys.has(key) && typeof content[key] !== "string");
      if (expectedKeys.size === 0 || missing.length || extra.length || invalid.length) {
        job.status = "failed";
        job.error = `Translation output validation failed (expected ${expectedKeys.size} keys, received ${actualKeys.length}; missing ${missing.length}, extra ${extra.length}, invalid ${invalid.length})`;
      }
    }

    let writeSuccess = false;
    if (job.status === "completed") {
      try {
        await writeOutput(job, outputPath, content);
        writeSuccess = true;
      } catch (error) {
        job.status = "failed";
        job.error = error instanceof Error ? error.message : String(error);
        console.error(`Failed to write output for job ${job.id}:`, error);
      }
    }
    if (onJobComplete) onJobComplete(job, i);

    // Report only results whose full key set reached disk successfully.
    if (onResult) {
      onResult({
        type,
        id: type === "mod" ? (job.currentFileName || job.id) : job.id,
        displayName: job.currentFileName || job.id,
        targetLanguage,
        content,
        outputPath,
        sessionId, enableBackup,
        success: job.status === "completed" && writeSuccess
      });
    }

    // Increment mod-level progress when entire job is complete (only if mod tracking is used)
    if (incrementCompletedMods) incrementCompletedMods();
    if (incrementWholeProgress && incrementWholeProgress !== incrementCompletedMods) incrementWholeProgress();
  }
  if (setCurrentJobId) setCurrentJobId(null);
  if (sessionId && jobs.length) {
    await invoke('batch_update_translation_summary', {
      minecraftDir: useAppStore.getState().profileDirectory, sessionId, targetLanguage,
      entries: jobs.map(job => ({ translationType: type, name: job.currentFileName || job.id,
        status: job.status === 'completed' ? 'completed' : 'failed',
        translatedKeys: job.chunks.filter(c => c.status === 'completed').reduce((n,c) => n + Object.keys(c.translatedContent || {}).length, 0),
        totalKeys: job.chunks.reduce((n,c) => n + Object.keys(c.content).length, 0) }))
    }).catch(error => console.error('Failed to update translation summary:', error));
  }

}
