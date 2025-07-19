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


    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (onJobStart) onJobStart(job, i);
        if (setCurrentJobId) setCurrentJobId(job.id);

        // Start the translation job chunk-by-chunk, checking for interruption
        job.status = "processing";
        job.startTime = Date.now();
        
        // Reset individual file progress with immediate update
        if (setProgress) {
            setProgress(0);
        }
        
        // Calculate total keys for this job (for key-based progress)
        const totalKeys = job.chunks.reduce((sum, chunk) => sum + Object.keys(chunk.content).length, 0);
        let processedKeys = 0;

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
            
            // Update processed keys count
            processedKeys += Object.keys(chunk.content).length;
            
            // Update individual file progress based on processed keys
            const keyProgress = totalKeys > 0 ? Math.round((processedKeys / totalKeys) * 100) : 100;
            if (setProgress) {
                setProgress(keyProgress);
            }
            
            // Update job progress for consistency (no callback trigger to avoid double updates)
            const completedChunks = job.chunks.filter(c => c.status === "completed" || c.status === "failed").length;
            const serviceProgress = job.chunks.length > 0 ? Math.round((completedChunks / job.chunks.length) * 100) : 0;
            (job as { progress?: number }).progress = serviceProgress;
            
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
        
        // Individual job summary update removed - will be done in batch at the end

        // Ensure final progress is set to 100% for completed jobs
        if (setProgress && job.status === "completed") {
            setProgress(100);
        }
        
        // Increment mod-level progress if applicable
        if (incrementCompletedMods) {
            incrementCompletedMods();
        }
        
        // Increment whole progress (for backward compatibility with other tabs)
        if (incrementWholeProgress && incrementWholeProgress !== incrementCompletedMods) {
            incrementWholeProgress();
        }
    }

    if (setCurrentJobId) setCurrentJobId(null);

    // Update translation summary once for all jobs at the end
    if (sessionId && jobs.length > 0) {
        try {
            const profileDirectory = useAppStore.getState().profileDirectory;
            
            // Validate profileDirectory before invoking
            if (!profileDirectory) {
                throw new Error('Profile directory is not defined');
            }
            
            console.log(`[TranslationRunner] Updating batch summary for ${jobs.length} jobs: sessionId=${sessionId}, profileDirectory=${profileDirectory}`);
            
            const entries = jobs.map(job => {
                const chunks = (job as { chunks?: Array<{ status: string; translatedContent?: Record<string, unknown>; content?: Record<string, unknown> }> }).chunks || [];
                const translatedKeys = chunks.filter((c) => c.status === "completed")
                    .reduce((sum: number, chunk) => sum + Object.keys(chunk.translatedContent || {}).length, 0);
                const totalKeys = chunks.reduce((sum: number, chunk) => sum + Object.keys(chunk.content || {}).length, 0);
                
                return {
                    translationType: type,
                    name: job.currentFileName || job.id,
                    status: job.status === "completed" ? "completed" : "failed",
                    translatedKeys,
                    totalKeys
                };
            });
            
            await invoke('batch_update_translation_summary', {
                minecraftDir: profileDirectory,
                sessionId,
                targetLanguage,
                entries
            });
        } catch (error) {
            console.error('Failed to update batch translation summary:', error);
            // Add user notification for better error visibility
            await invoke('log_translation_process', {
                message: `Failed to update translation summary: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
}