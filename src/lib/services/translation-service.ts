import { LLMAdapterFactory } from "../adapters/llm-adapter-factory";
import { LLMAdapter, LLMConfig, TranslationRequest, TranslationResponse } from "../types/llm";
import { invoke } from "@tauri-apps/api/core";

/**
 * Translation chunk
 */
export interface TranslationChunk {
  /** Unique identifier for the chunk */
  id: string;
  /** Content to translate */
  content: Record<string, string>;
  /** Status of the translation */
  status: "pending" | "processing" | "completed" | "failed";
  /** Error message if translation failed */
  error?: string;
  /** Translated content */
  translatedContent?: Record<string, string>;
}

/**
 * Translation job
 */
export interface TranslationJob {
  /** Unique identifier for the job */
  id: string;
  /** Target language */
  targetLanguage: string;
  /** Chunks to translate */
  chunks: TranslationChunk[];
  /** Status of the job */
  status: "pending" | "processing" | "completed" | "failed" | "interrupted";
  /** Progress of the job (0-100) */
  progress: number;
  /** Start time of the job */
  startTime: number;
  /** End time of the job */
  endTime?: number;
  /** Error message if job failed */
  error?: string;
  /** Current file name being processed */
  currentFileName?: string;
}

/**
 * Translation service options
 */
export interface TranslationServiceOptions {
  /** LLM configuration */
  llmConfig: LLMConfig;
  /** Chunk size */
  chunkSize?: number;
  /** Custom prompt template */
  promptTemplate?: string;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Callback for progress updates */
  onProgress?: (job: TranslationJob) => void;
  /** Callback for job completion */
  onComplete?: (job: TranslationJob) => void;
  /** Callback for job failure */
  onError?: (job: TranslationJob, error: Error) => void;
  /** Current file name being processed */
  currentFileName?: string;
}

/**
 * Translation service
 * Handles the translation of content using LLM adapters
 */
export class TranslationService {
  /** LLM adapter */
  private adapter: LLMAdapter;
  
  /** Chunk size */
  private chunkSize: number;
  
  /** Custom prompt template */
  private promptTemplate?: string;
  
  /** Maximum number of retries */
  private maxRetries: number;
  
  /** Active translation jobs */
  private activeJobs: Map<string, TranslationJob> = new Map();
  
  /** Interrupt flag for each job */
  private interruptFlags: Map<string, boolean> = new Map();
  
  /** Progress callback */
  private onProgress?: (job: TranslationJob) => void;
  
  /** Completion callback */
  private onComplete?: (job: TranslationJob) => void;
  
  /** Error callback */
  private onError?: (job: TranslationJob, error: Error) => void;

  /**
   * Constructor
   * @param options Translation service options
   */
  constructor(options: TranslationServiceOptions) {
    this.adapter = LLMAdapterFactory.getAdapter(options.llmConfig);
    this.chunkSize = options.chunkSize ?? this.adapter.getMaxChunkSize();
    this.promptTemplate = options.promptTemplate;
    this.maxRetries = options.maxRetries ?? 5;
    this.onProgress = options.onProgress;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  /**
   * Create a new translation job
   * @param content Content to translate
   * @param targetLanguage Target language
   * @param currentFileName Current file name being processed
   * @returns Translation job
   */
  public createJob(
    content: Record<string, string>,
    targetLanguage: string,
    currentFileName?: string
  ): TranslationJob {
    // Generate a unique job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Split content into chunks
    const chunks = this.splitIntoChunks(content, jobId);
    
    // Create the job
    const job: TranslationJob = {
      id: jobId,
      targetLanguage: targetLanguage,
      chunks,
      status: "pending",
      progress: 0,
      startTime: Date.now(),
      currentFileName
    };
    
    // Store the job
    this.activeJobs.set(jobId, job);
    this.interruptFlags.set(jobId, false);
    
    return job;
  }

  /**
   * Log a translation message to the backend
   * @param message Message to log
   */
  private async logTranslation(message: string): Promise<void> {
    try {
      await invoke('log_translation_process', { message });
    } catch (error) {
      console.error('Failed to log translation message:', error);
    }
  }

  /**
   * Log an API request message to the backend
   * @param message Message to log
   */
  private async logApiRequest(message: string): Promise<void> {
    try {
      await invoke('log_api_request', { message });
    } catch (error) {
      console.error('Failed to log API request message:', error);
    }
  }

  /**
   * Log a file operation message to the backend
   * @param message Message to log
   */
  private async logFileOperation(message: string): Promise<void> {
    try {
      await invoke('log_file_operation', { message });
    } catch (error) {
      console.error('Failed to log file operation message:', error);
    }
  }

  /**
   * Log an error message to the backend
   * @param message Error message
   * @param processType Process type (optional)
   */
  private async logError(message: string, processType?: string): Promise<void> {
    try {
      await invoke('log_error', { message, process_type: processType });
    } catch (error) {
      console.error('Failed to log error message:', error);
    }
  }

  /**
   * Start a translation job
   * @param jobId Job ID
   * @returns Promise that resolves when the job is complete
   */
  public async startJob(jobId: string): Promise<TranslationJob> {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    // Update job status
    job.status = "processing";
    job.startTime = Date.now();
    this.updateProgress(job);
    
    // Log job start
    await this.logTranslation(`Starting translation job ${jobId} to ${job.targetLanguage}`);
    await this.logTranslation(`Job contains ${job.chunks.length} chunks with a total of ${this.getTotalKeysCount(job)} keys`);
    
    try {
      // Process each chunk
      for (let i = 0; i < job.chunks.length; i++) {
        // Check if job should be interrupted
        if (this.interruptFlags.get(jobId)) {
          job.status = "interrupted";
          job.endTime = Date.now();
          this.updateProgress(job);
          await this.logTranslation(`Job ${jobId} was interrupted by user`);
          break;
        }
        
        const chunk = job.chunks[i];
        
        // Update chunk status
        chunk.status = "processing";
        this.updateProgress(job);
        
        // Log chunk start
        await this.logTranslation(`Processing chunk ${i+1}/${job.chunks.length} with ${Object.keys(chunk.content).length} keys`);
        
        try {
          // Translate the chunk
          const translatedContent = await this.translateChunk(
            chunk.content,
            job.targetLanguage,
            jobId
          );
          
          // Update chunk with translated content
          chunk.translatedContent = translatedContent;
          chunk.status = "completed";
          
          // Log chunk completion
          await this.logTranslation(`Completed chunk ${i+1}/${job.chunks.length} successfully`);
        } catch (error) {
          // Handle chunk error
          chunk.status = "failed";
          chunk.error = error instanceof Error ? error.message : String(error);
          
          // Log chunk error
          await this.logError(`Error in chunk ${i+1}/${job.chunks.length}: ${chunk.error}`, "TRANSLATION");
          
          // Notify error callback
          if (this.onError) {
            this.onError(job, error instanceof Error ? error : new Error(String(error)));
          }
        }
        
        // Update job progress
        this.updateProgress(job);
      }
      
      // Check if all chunks are completed
      const allCompleted = job.chunks.every(chunk => chunk.status === "completed");
      
      // Update job status
      if (job.status !== "interrupted") {
        job.status = allCompleted ? "completed" : "failed";
      }
      
      job.endTime = Date.now();
      this.updateProgress(job);
      
      // Calculate job duration
      const duration = (job.endTime - job.startTime) / 1000; // in seconds
      
      // Log job completion
      if (job.status === "completed") {
        await this.logTranslation(`Job ${jobId} completed successfully in ${duration.toFixed(2)} seconds`);
      } else if (job.status === "failed") {
        await this.logError(`Job ${jobId} failed after ${duration.toFixed(2)} seconds`, "TRANSLATION");
        if (job.error) {
          await this.logError(`Error: ${job.error}`, "TRANSLATION");
        }
      }
      
      // Notify completion callback
      if (job.status === "completed" && this.onComplete) {
        this.onComplete(job);
      }
      
      return job;
    } catch (error) {
      // Handle job error
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.endTime = Date.now();
      this.updateProgress(job);
      
      // Log job error
      await this.logError(`Job ${jobId} failed with error: ${job.error}`, "TRANSLATION");
      
      // Notify error callback
      if (this.onError) {
        this.onError(job, error instanceof Error ? error : new Error(String(error)));
      }
      
      throw error;
    }
  }

  /**
   * Interrupt a translation job
   * @param jobId Job ID
   */
  public interruptJob(jobId: string): void {
    this.interruptFlags.set(jobId, true);
  }

  /**
   * Check if a translation job has been interrupted
   * @param jobId Job ID
   * @returns true if interrupted, false otherwise
   */
  public isJobInterrupted(jobId: string): boolean {
    return this.interruptFlags.get(jobId) === true;
  }

  /**
   * Get a translation job
   * @param jobId Job ID
   * @returns Translation job
   */
  public getJob(jobId: string): TranslationJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all translation jobs
   * @returns Array of translation jobs
   */
  public getAllJobs(): TranslationJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Clear a translation job
   * @param jobId Job ID
   */
  public clearJob(jobId: string): void {
    this.activeJobs.delete(jobId);
    this.interruptFlags.delete(jobId);
  }

  /**
   * Clear all translation jobs
   */
  public clearAllJobs(): void {
    this.activeJobs.clear();
    this.interruptFlags.clear();
  }

  /**
   * Get the combined translated content from a job
   * @param jobId Job ID
   * @returns Combined translated content
   */
  public getCombinedTranslatedContent(jobId: string): Record<string, string> {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    // Combine translated content from all chunks
    const combinedContent: Record<string, string> = {};
    
    for (const chunk of job.chunks) {
      if (chunk.status === "completed" && chunk.translatedContent) {
        Object.assign(combinedContent, chunk.translatedContent);
      }
    }
    
    return combinedContent;
  }

  /**
   * Split content into chunks
   * @param content Content to split
   * @param jobId Job ID
   * @returns Array of chunks
   */
  private splitIntoChunks(content: Record<string, string>, jobId: string): TranslationChunk[] {
    const entries = Object.entries(content);
    const chunks: TranslationChunk[] = [];
    
    // Split entries into chunks of the specified size
    for (let i = 0; i < entries.length; i += this.chunkSize) {
      const chunkEntries = entries.slice(i, i + this.chunkSize);
      const chunkContent: Record<string, string> = {};
      
      // Convert entries back to an object
      for (const [key, value] of chunkEntries) {
        chunkContent[key] = value;
      }
      
      // Create the chunk
      chunks.push({
        id: `${jobId}_chunk_${chunks.length}`,
        content: chunkContent,
        status: "pending"
      });
    }
    
    return chunks;
  }

  /**
   * Get the total number of keys in a job
   * @param job Translation job
   * @returns Total number of keys
   */
  private getTotalKeysCount(job: TranslationJob): number {
    return job.chunks.reduce((total, chunk) => total + Object.keys(chunk.content).length, 0);
  }

  /**
   * Translate a chunk of content
   * @param content Content to translate
   * @param targetLanguage Target language
   * @returns Translated content
   */
  private async translateChunk(
    content: Record<string, string>,
    targetLanguage: string,
    jobId: string
  ): Promise<Record<string, string>> {
    let retries = 0;
    const keyCount = Object.keys(content).length;
    
    while (retries <= this.maxRetries) {
      // Check if job should be interrupted
      if (this.interruptFlags.get(jobId)) {
        await this.logTranslation(`Translation chunk interrupted by user`);
        throw new Error("Translation interrupted by user");
      }
      try {
        // Log translation attempt
        await this.logTranslation(`Translating ${keyCount} keys to ${targetLanguage}`);
        
        // Create translation request
        const request: TranslationRequest = {
          content,
          targetLanguage: targetLanguage,
          promptTemplate: this.promptTemplate
        };
        
        // Check if the adapter is properly configured
        if (this.adapter instanceof Object && 
            typeof this.adapter === 'object' && this.adapter !== null && 'config' in this.adapter && 
            this.adapter.config && typeof this.adapter.config === 'object' && this.adapter.config !== null && 
            'apiKey' in this.adapter.config && !this.adapter.config.apiKey) {
          throw new Error("API key is not configured. Please set your API key in the settings.");
        }
        
        // Translate using the adapter
        const response: TranslationResponse = await this.adapter.translate(request);
        
        // Validate response
        this.validateTranslationResponse(content, response.content);
        
        // Log successful translation
        await this.logTranslation(`Successfully translated ${keyCount} keys to ${targetLanguage}`);
        
        return response.content;
      } catch (error) {
        retries++;
        
        // Check if the error is related to missing API key
        if (error instanceof Error && 
            (error.message.includes("API key is not configured") || 
             error.message.includes("Incorrect API key provided: undefined"))) {
          await this.logError(`Translation failed: ${error.message}`, "TRANSLATION");
          // For API key configuration errors, don't retry
          throw new Error("API key is not configured or is invalid. Please set your API key in the settings.");
        }
        
        // Log retry attempt
        await this.logError(`Translation failed, retry ${retries}/${this.maxRetries}: ${error instanceof Error ? error.message : String(error)}`, "TRANSLATION");
        
        // If we've reached the maximum number of retries, throw the error
        if (retries > this.maxRetries) {
          await this.logError(`Maximum retries reached, giving up`, "TRANSLATION");
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
    
    // This should never happen, but TypeScript requires a return statement
    throw new Error("Failed to translate chunk after retries");
  }

  /**
   * Validate translation response
   * @param originalContent Original content
   * @param translatedContent Translated content
   */
  private validateTranslationResponse(
    originalContent: Record<string, string>,
    translatedContent: Record<string, string>
  ): void {
    // Check if all keys are present in the translated content
    const originalKeys = Object.keys(originalContent);
    const translatedKeys = Object.keys(translatedContent);
    
    if (originalKeys.length !== translatedKeys.length) {
      throw new Error(
        `Translation response has different number of keys: ${translatedKeys.length} vs ${originalKeys.length}`
      );
    }
    
    // Check if all original keys are present in the translated content
    for (const key of originalKeys) {
      if (!translatedContent[key]) {
        throw new Error(`Translation response is missing key: ${key}`);
      }
    }
  }

  /**
   * Update job progress
   * @param job Translation job
   */
  private updateProgress(job: TranslationJob): void {
    // Calculate progress
    const totalChunks = job.chunks.length;
    const completedChunks = job.chunks.filter(
      chunk => chunk.status === "completed" || chunk.status === "failed"
    ).length;
    
    job.progress = Math.round((completedChunks / totalChunks) * 100);
    
    // Notify progress callback
    if (this.onProgress) {
      this.onProgress(job);
    }
  }
}
