import { TranslationService, TranslationJob } from "./translation-service";
import { TranslationResult } from "../types/minecraft";

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
      
      // Increment chunk-level progress once per chunk (only if chunk tracking is used)
      if (incrementCompletedChunks) incrementCompletedChunks();
      if (onJobChunkComplete) onJobChunkComplete(job, chunkIndex);
    }

    // If interrupted, stop processing further jobs
    if (job.status === "interrupted" || translationService.isJobInterrupted(job.id)) {
      if (setCurrentJobId) setCurrentJobId(null);
      break;
    }

    // Mark job as complete
    job.status = job.chunks.every((c: import("./translation-service").TranslationChunk) => c.status === "completed") ? "completed" : "failed";
    job.endTime = Date.now();
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
        displayName: job.targetName,
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
