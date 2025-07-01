import { TranslationService, TranslationJob } from "./translation-service";
import { TranslationResult } from "../types/minecraft";
import { invoke } from "@tauri-apps/api/core";

/**
 * Shared translation runner for all tabs.
 * Processes jobs chunk-by-chunk, checks for cancellation, and reports progress/results.
 */
export interface RunTranslationJobsOptions<T extends TranslationJob = TranslationJob> {
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
  type: "mod" | "ftb" | "better" | "patchouli" | "custom";
}

/**
 * Runs translation jobs with cancellation and progress support.
 */
export async function runTranslationJobs<T extends TranslationJob = TranslationJob>(options: RunTranslationJobsOptions<T>): Promise<void> {
  const {
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

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    
    // Set session information for comprehensive logging
    job.totalFiles = jobs.length;
    job.currentFileIndex = i + 1;
    
    if (onJobStart) onJobStart(job, i);
    if (setCurrentJobId) setCurrentJobId(job.id);

    // Start the translation job chunk-by-chunk, checking for interruption
    job.status = "processing";
    job.startTime = Date.now();
    
    // Log initial file progress
    await logFileProgress(
      job.currentFileName || `File ${i + 1}`,
      i + 1,
      jobs.length,
      0,
      job.chunks.length,
      0,
      getTotalKeysInJob(job)
    );

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
      
      // Increment chunk-level progress once per chunk (only if chunk tracking is used)
      if (incrementCompletedChunks) incrementCompletedChunks();
      if (onJobChunkComplete) onJobChunkComplete(job, chunkIndex);
      
      // Log updated file progress after chunk completion
      const completedChunks = job.chunks.filter(c => c.status === "completed").length;
      const completedKeys = job.chunks
        .filter(c => c.status === "completed")
        .reduce((sum, c) => sum + Object.keys(c.content).length, 0);
      
      await logFileProgress(
        job.currentFileName || `File ${i + 1}`,
        i + 1,
        jobs.length,
        completedChunks,
        job.chunks.length,
        completedKeys,
        getTotalKeysInJob(job)
      );
    }

    // If interrupted, stop processing further jobs
    if (job.status === "interrupted" || translationService.isJobInterrupted(job.id)) {
      if (setCurrentJobId) setCurrentJobId(null);
      break;
    }

    // Mark job as complete
    job.status = job.chunks.every((c: import("./translation-service").TranslationChunk) => c.status === "completed") ? "completed" : "failed";
    job.endTime = Date.now();
    
    // Log performance metrics for this job
    const jobDuration = job.endTime - job.startTime;
    const jobTotalKeys = getTotalKeysInJob(job);
    const keysPerSecond = jobTotalKeys / (jobDuration / 1000);
    
    await logPerformanceMetrics(
      `Job Translation`,
      jobDuration,
      undefined,
      `${jobTotalKeys} keys, ${keysPerSecond.toFixed(2)} keys/sec, ${job.chunks.length} chunks`
    );
    
    if (onJobComplete) onJobComplete(job, i);

    // Write output and report result
    const outputPath = getOutputPath(job);
    const content = getResultContent(job);
    let writeSuccess = true;
    
    try {
      await writeOutput(job, outputPath, content);
    } catch (error) {
      console.error(`Failed to write output for job ${job.id}:`, error);
      writeSuccess = false;
    }

    if (onResult) {
      onResult({
        type,
        id: type === "mod" ? (job.currentFileName || job.id) : job.id,
        displayName: job.currentFileName || job.id,
        targetLanguage,
        content,
        outputPath,
        success: job.status === "completed" && writeSuccess
      });
    }
    
    // Increment mod-level progress when entire job is complete (only if mod tracking is used)
    if (incrementCompletedMods) incrementCompletedMods();
  }
  if (setCurrentJobId) setCurrentJobId(null);
}

/**
 * Log file progress with detailed status
 * @param fileName Name of the file
 * @param fileIndex Current file index (1-based)
 * @param totalFiles Total number of files
 * @param chunksCompleted Chunks completed for this file
 * @param totalChunks Total chunks for this file
 * @param keysCompleted Keys completed for this file
 * @param totalKeys Total keys for this file
 */
async function logFileProgress(
  fileName: string,
  fileIndex: number,
  totalFiles: number,
  chunksCompleted: number,
  totalChunks: number,
  keysCompleted: number,
  totalKeys: number
): Promise<void> {
  try {
    await invoke('log_file_progress', {
      fileName: fileName,
      fileIndex: fileIndex,
      totalFiles: totalFiles,
      chunksCompleted: chunksCompleted,
      totalChunks: totalChunks,
      keysCompleted: keysCompleted,
      totalKeys: totalKeys
    });
  } catch (error) {
    console.error('Failed to log file progress:', error);
  }
}

/**
 * Get total number of keys in a translation job
 * @param job Translation job
 * @returns Total number of keys
 */
function getTotalKeysInJob(job: TranslationJob): number {
  return job.chunks.reduce((sum, chunk) => sum + Object.keys(chunk.content).length, 0);
}

/**
 * Log performance metrics for debugging
 * @param operation Operation name
 * @param durationMs Duration in milliseconds
 * @param memoryUsageMb Optional memory usage in MB
 * @param additionalInfo Optional additional information
 */
async function logPerformanceMetrics(
  operation: string,
  durationMs: number,
  memoryUsageMb?: number,
  additionalInfo?: string
): Promise<void> {
  try {
    await invoke('log_performance_metrics', {
      operation,
      durationMs: durationMs,
      memoryUsageMb: memoryUsageMb,
      additionalInfo: additionalInfo
    });
  } catch (error) {
    console.error('Failed to log performance metrics:', error);
  }
}
