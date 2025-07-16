import { TranslationService, TranslationJob } from "./translation-service";
import { TranslationResult, TranslationTargetType } from "../types/minecraft";
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/lib/store';

export interface RunTranslationJobsOptions<T extends TranslationJob = TranslationJob> {
    jobs: T[];
    translationService: TranslationService;
    onJobStart?: (job: T, index: number) => void;
    onJobChunkComplete?: (job: T, chunkIndex: number) => void;
    onJobComplete?: (job: T, index: number) => void;
    onJobInterrupted?: (job: T, index: number) => void;
    onResult?: (result: TranslationResult) => void;
    setCurrentJobId?: (jobId: string | null) => void;
    setProgress?: (progress: number) => void;
    incrementCompletedChunks?: () => void;
    incrementCompletedMods?: () => void;
    incrementWholeProgress?: () => void;
    getOutputPath: (job: T) => string;
    getResultContent: (job: T) => Record<string, string>;
    writeOutput: (job: T, outputPath: string, content: Record<string, string>) => Promise<void>;
    targetLanguage: string;
    type: TranslationTargetType;
    sessionId?: string; // Optional session ID for backup integration
    enableBackup?: boolean; // Whether to create backups (default: true)
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
        setProgress,
        incrementCompletedChunks,
        incrementCompletedMods,
        incrementWholeProgress,
        getOutputPath,
        getResultContent,
        writeOutput,
        targetLanguage,
        type,
        sessionId,
        enableBackup = true
    } = options;

    console.log(`[TranslationRunner] Starting ${jobs.length} jobs`);
    console.log(`[TranslationRunner] setProgress function exists: ${!!setProgress}`);
    console.log(`[TranslationRunner] incrementCompletedMods function exists: ${!!incrementCompletedMods}`);

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (onJobStart) onJobStart(job, i);
        if (setCurrentJobId) setCurrentJobId(job.id);

        // Start the translation job chunk-by-chunk, checking for interruption
        job.status = "processing";
        job.startTime = Date.now();
        
        // Reset individual file progress
        if (setProgress) {
            console.log(`[Job ${i + 1}/${jobs.length}] Starting job with ${job.chunks.length} chunks`);
            setProgress(0);
        }
        const jobTotalChunks = job.chunks.length;

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
            
            // Update individual file progress
            const fileProgress = Math.round(((chunkIndex + 1) / jobTotalChunks) * 100);
            if (setProgress) {
                console.log(`[Job ${i + 1}/${jobs.length}] Chunk ${chunkIndex + 1}/${jobTotalChunks} completed, progress: ${fileProgress}%`);
                setProgress(fileProgress);
            }
            
            // Manually update TranslationService job progress to trigger onProgress callback
            const completedChunks = job.chunks.filter(c => c.status === "completed" || c.status === "failed").length;
            const serviceProgress = Math.round((completedChunks / job.chunks.length) * 100);
            (job as any).progress = serviceProgress;
            
            // Trigger the onProgress callback manually if it exists
            if ((translationService as any).onProgress) {
                console.log(`[Job ${i + 1}/${jobs.length}] Triggering onProgress callback with ${serviceProgress}%`);
                (translationService as any).onProgress(job);
            }
            
            // Increment overall chunk-level progress
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
                displayName: job.currentFileName || job.id,
                targetLanguage,
                content,
                outputPath,
                success: writeSuccess && job.status === "completed",
                sessionId,
                enableBackup
            });
        }
        
        // Update translation summary if session ID is provided
        if (sessionId) {
            try {
                const chunks = (job as any).chunks || [];
                const translatedKeys = chunks.filter((c: any) => c.status === "completed")
                    .reduce((sum: number, chunk: any) => sum + Object.keys(chunk.translatedContent || {}).length, 0);
                const totalKeys = Object.keys((job as any).sourceContent || {}).length;
                
                const config = useAppStore.getState().config;
                
                await invoke('update_translation_summary', {
                    minecraftDir: config.paths.minecraftDir || '',
                    sessionId,
                    translationType: type,
                    name: job.currentFileName || job.id,
                    status: job.status === "completed" ? "completed" : "failed",
                    translatedKeys,
                    totalKeys,
                    targetLanguage
                });
            } catch (error) {
                console.error('Failed to update translation summary:', error);
                // Don't fail the translation if summary update fails
            }
        }

        // Increment mod-level progress if applicable
        if (incrementCompletedMods) {
            console.log(`[Job ${i + 1}/${jobs.length}] Job completed, incrementing mod progress`);
            incrementCompletedMods();
        }
        
        // Increment whole progress (for backward compatibility with other tabs)
        if (incrementWholeProgress && incrementWholeProgress !== incrementCompletedMods) {
            console.log(`[Job ${i + 1}/${jobs.length}] Job completed, incrementing whole progress`);
            incrementWholeProgress();
        }
    }

    if (setCurrentJobId) setCurrentJobId(null);
}