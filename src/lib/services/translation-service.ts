import { LLMAdapterFactory } from "../adapters/llm-adapter-factory";
import { LLMAdapter, LLMConfig, TranslationRequest, TranslationResponse } from "../types/llm";

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
  /** Source language */
  sourceLanguage: string;
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
  customPrompt?: string;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Callback for progress updates */
  onProgress?: (job: TranslationJob) => void;
  /** Callback for job completion */
  onComplete?: (job: TranslationJob) => void;
  /** Callback for job failure */
  onError?: (job: TranslationJob, error: Error) => void;
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
  private customPrompt?: string;
  
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
    this.customPrompt = options.customPrompt;
    this.maxRetries = options.maxRetries ?? 5;
    this.onProgress = options.onProgress;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  /**
   * Create a new translation job
   * @param content Content to translate
   * @param sourceLanguage Source language
   * @param targetLanguage Target language
   * @returns Translation job
   */
  public createJob(
    content: Record<string, string>,
    sourceLanguage: string,
    targetLanguage: string
  ): TranslationJob {
    // Generate a unique job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Split content into chunks
    const chunks = this.splitIntoChunks(content, jobId);
    
    // Create the job
    const job: TranslationJob = {
      id: jobId,
      sourceLanguage,
      targetLanguage,
      chunks,
      status: "pending",
      progress: 0,
      startTime: Date.now()
    };
    
    // Store the job
    this.activeJobs.set(jobId, job);
    this.interruptFlags.set(jobId, false);
    
    return job;
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
    
    try {
      // Process each chunk
      for (let i = 0; i < job.chunks.length; i++) {
        // Check if job should be interrupted
        if (this.interruptFlags.get(jobId)) {
          job.status = "interrupted";
          job.endTime = Date.now();
          this.updateProgress(job);
          break;
        }
        
        const chunk = job.chunks[i];
        
        // Update chunk status
        chunk.status = "processing";
        this.updateProgress(job);
        
        try {
          // Translate the chunk
          const translatedContent = await this.translateChunk(
            chunk.content,
            job.targetLanguage
          );
          
          // Update chunk with translated content
          chunk.translatedContent = translatedContent;
          chunk.status = "completed";
        } catch (error) {
          // Handle chunk error
          chunk.status = "failed";
          chunk.error = error instanceof Error ? error.message : String(error);
          
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
   * Translate a chunk of content
   * @param content Content to translate
   * @param targetLanguage Target language
   * @returns Translated content
   */
  private async translateChunk(
    content: Record<string, string>,
    targetLanguage: string
  ): Promise<Record<string, string>> {
    let retries = 0;
    
    while (retries <= this.maxRetries) {
      try {
        // Create translation request
        const request: TranslationRequest = {
          content,
          targetLanguage,
          customPrompt: this.customPrompt
        };
        
        // Translate using the adapter
        const response: TranslationResponse = await this.adapter.translate(request);
        
        // Validate response
        this.validateTranslationResponse(content, response.content);
        
        return response.content;
      } catch (error) {
        retries++;
        
        // If we've reached the maximum number of retries, throw the error
        if (retries > this.maxRetries) {
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
