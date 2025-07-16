import { LLMAdapterFactory } from "../adapters/llm-adapter-factory";
import { LLMAdapter, LLMConfig, TranslationRequest, TranslationResponse } from "../types/llm";
import { invoke } from "@tauri-apps/api/core";
import { estimateTokens, DEFAULT_TOKEN_CONFIG, TokenEstimationConfig } from "../utils/token-counter";
import { ErrorLogger } from "../utils/error-logger";
import { API_DEFAULTS, TRANSLATION_DEFAULTS } from "../constants/defaults";

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
  /** Session identifier for logging */
  sessionId?: string;
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
  /** Total files being processed in this session */
  totalFiles?: number;
  /** Current file index in the session */
  currentFileIndex?: number;
  /** Total API calls made */
  totalApiCalls?: number;
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
  /** Enable token-based chunking */
  useTokenBasedChunking?: boolean;
  /** Maximum tokens per chunk */
  maxTokensPerChunk?: number;
  /** Fallback to entry-based chunking if token estimation fails */
  fallbackToEntryBased?: boolean;
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

  /** Token-based chunking options */
  private useTokenBasedChunking: boolean;
  private maxTokensPerChunk: number;
  private fallbackToEntryBased: boolean;

  /**
   * Constructor
   * @param options Translation service options
   */
  constructor(options: TranslationServiceOptions) {
    this.adapter = LLMAdapterFactory.getAdapter(options.llmConfig);
    this.chunkSize = options.chunkSize ?? this.adapter.getMaxChunkSize();
    this.promptTemplate = options.promptTemplate;
    this.maxRetries = options.maxRetries ?? API_DEFAULTS.maxRetries;
    this.onProgress = options.onProgress;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    
    // Token-based chunking configuration
    this.useTokenBasedChunking = options.useTokenBasedChunking ?? false;
    this.maxTokensPerChunk = options.maxTokensPerChunk ?? TRANSLATION_DEFAULTS.maxTokensPerChunk;
    this.fallbackToEntryBased = options.fallbackToEntryBased ?? true;
    
    // Debug logging for token-based chunking (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('TranslationService Configuration:', {
        useTokenBasedChunking: this.useTokenBasedChunking,
        maxTokensPerChunk: this.maxTokensPerChunk,
        fallbackToEntryBased: this.fallbackToEntryBased,
        provider: this.adapter.id
      });
    }
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
      await ErrorLogger.logError('TranslationService.logTranslation', error, 'TRANSLATION');
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
      await ErrorLogger.logError('TranslationService.logApiRequest', error, 'API_REQUEST');
    }
  }


  /**
   * Log an error message to the backend
   * @param message Error message
   * @param processType Process type (optional)
   */
  private async logError(message: string, processType?: string): Promise<void> {
    try {
      await invoke('log_error', { message, processType: processType });
    } catch (error) {
      // Use console.error directly here to avoid infinite recursion
      console.error('[TranslationService.logError] Failed to log error message:', error);
      console.error('[TranslationService.logError] Original error message was:', message);
    }
  }

  /**
   * Log translation start with session information
   * @param sessionId Session ID
   * @param targetLanguage Target language
   * @param totalFiles Total number of files
   * @param totalContentSize Total content size
   */
  private async logTranslationStart(
    sessionId: string, 
    targetLanguage: string, 
    totalFiles: number, 
    totalContentSize: number
  ): Promise<void> {
    try {
      // Ensure sessionId is valid
      const validSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      // In Tauri v2, snake_case Rust parameters are converted to camelCase for JS
      await invoke('log_translation_start', { 
        sessionId: validSessionId,
        targetLanguage: targetLanguage,
        totalFiles: totalFiles,
        totalContentSize: totalContentSize
      });
    } catch (error) {
      console.error('Failed to log translation start:', error);
    }
  }

  /**
   * Log pre-translation statistics
   * @param totalFiles Total number of files
   * @param estimatedKeys Estimated number of keys
   * @param estimatedLines Estimated number of lines
   * @param contentTypes Array of content types
   */
  private async logTranslationStatistics(
    totalFiles: number,
    estimatedKeys: number,
    estimatedLines: number,
    contentTypes: string[]
  ): Promise<void> {
    try {
      // Ensure all parameters are valid numbers
      const validTotalFiles = Number.isFinite(totalFiles) ? totalFiles : 1;
      const validEstimatedKeys = Number.isFinite(estimatedKeys) ? estimatedKeys : 0;
      const validEstimatedLines = Number.isFinite(estimatedLines) ? estimatedLines : 0;
      const validContentTypes = Array.isArray(contentTypes) ? contentTypes : [];
      
      // In Tauri v2, snake_case Rust parameters are converted to camelCase for JS
      await invoke('log_translation_statistics', {
        totalFiles: validTotalFiles,
        estimatedKeys: validEstimatedKeys,
        estimatedLines: validEstimatedLines,
        contentTypes: validContentTypes
      });
    } catch (error) {
      console.error('Failed to log translation statistics:', error);
    }
  }


  /**
   * Log translation completion with comprehensive summary
   * @param sessionId Session ID
   * @param durationSeconds Duration in seconds
   * @param totalFilesProcessed Total files processed
   * @param successfulFiles Number of successful files
   * @param failedFiles Number of failed files
   * @param totalKeysTranslated Total keys translated
   * @param totalApiCalls Total API calls made
   */
  private async logTranslationCompletion(
    sessionId: string,
    durationSeconds: number,
    totalFilesProcessed: number,
    successfulFiles: number,
    failedFiles: number,
    totalKeysTranslated: number,
    totalApiCalls: number
  ): Promise<void> {
    try {
      await invoke('log_translation_completion', {
        sessionId: sessionId,
        durationSeconds: durationSeconds,
        totalFilesProcessed: totalFilesProcessed,
        successfulFiles: successfulFiles,
        failedFiles: failedFiles,
        totalKeysTranslated: totalKeysTranslated,
        totalApiCalls: totalApiCalls
      });
    } catch (error) {
      console.error('Failed to log translation completion:', error);
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
    
    // Initialize session ID if not set
    if (!job.sessionId) {
      job.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }
    
    // Initialize API call counter
    job.totalApiCalls = job.totalApiCalls || 0;
    
    // Update job status
    job.status = "processing";
    job.startTime = Date.now();
    this.updateProgress(job);
    
    // Enhanced logging for job start
    const totalKeys = this.getTotalKeysCount(job);
    const totalFiles = job.totalFiles ?? 1;
    
    // Log translation start with session information
    await this.logTranslationStart(
      job.sessionId!,
      job.targetLanguage,
      totalFiles,
      totalKeys
    );
    
    // Log pre-translation statistics
    const contentTypes = this.determineContentTypes(job);
    const estimatedLines = Math.ceil(totalKeys * 1.5); // Rough estimate
    
    await this.logTranslationStatistics(
      Number(totalFiles) || 1,
      totalKeys,
      estimatedLines,
      contentTypes
    );
    
    // Log legacy messages for compatibility
    await this.logTranslation(`Starting translation job ${jobId} to ${job.targetLanguage}`);
    await this.logTranslation(`Job contains ${job.chunks.length} chunks with a total of ${totalKeys} keys`);
    
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
          
          // Check if translation actually produced content
          if (!translatedContent || Object.keys(translatedContent).length === 0) {
            // Handle empty content as a failure without throwing
            chunk.status = "failed";
            chunk.error = "Translation returned empty content - possible API key issue";
            chunk.translatedContent = {};
            
            // Log chunk failure
            await this.logError(`Chunk ${i+1}/${job.chunks.length} failed: empty translation content`, "TRANSLATION");
            
            // If it's likely an API key issue, mark the entire job as failed
            if (chunk.error.includes("API key")) {
              job.status = "failed";
              job.error = chunk.error;
              await this.logError(`Job ${jobId} failed due to API key issue`, "TRANSLATION");
              break;
            }
          } else {
            // Update chunk with translated content
            chunk.translatedContent = translatedContent;
            chunk.status = "completed";
            
            // Log chunk completion
            await this.logTranslation(`Completed chunk ${i+1}/${job.chunks.length} successfully`);
          }
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
      
      // Calculate completion statistics
      const totalKeysTranslated = job.chunks
        .filter(chunk => chunk.status === "completed")
        .reduce((sum, chunk) => sum + Object.keys(chunk.content).length, 0);
      
      // Enhanced completion logging
      if (job.sessionId) {
        await this.logTranslationCompletion(
          job.sessionId,
          duration,
          job.totalFiles || 1,
          job.status === "completed" ? 1 : 0,
          job.status === "failed" ? 1 : 0,
          totalKeysTranslated,
          job.totalApiCalls || 0
        );
      }
      
      // Log job completion (legacy)
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
    
    
    if (this.useTokenBasedChunking) {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('Using token-based chunking with max tokens:', this.maxTokensPerChunk);
        }
        const tokenChunks = this.splitIntoTokenBasedChunks(entries, jobId);
        if (process.env.NODE_ENV === 'development') {
          console.log(`Token-based chunking created ${tokenChunks.length} chunks`);
        }
        return tokenChunks;
      } catch (error) {
        // Log error and fall back to entry-based chunking if enabled
        console.warn('Token-based chunking failed, falling back to entry-based:', error);
        if (this.fallbackToEntryBased) {
          const fallbackChunks = this.splitIntoEntryBasedChunks(entries, jobId);
          if (process.env.NODE_ENV === 'development') {
            console.log(`Fallback chunking created ${fallbackChunks.length} chunks`);
          }
          return fallbackChunks;
        }
        throw error;
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('Using entry-based chunking with chunk size:', this.chunkSize);
      }
      const entryChunks = this.splitIntoEntryBasedChunks(entries, jobId);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Entry-based chunking created ${entryChunks.length} chunks`);
      }
      return entryChunks;
    }
  }

  /**
   * Split content into chunks based on token estimation
   * @param entries Content entries to split
   * @param jobId Job ID
   * @returns Array of chunks
   */
  private splitIntoTokenBasedChunks(entries: [string, string][], jobId: string): TranslationChunk[] {
    const chunks: TranslationChunk[] = [];
    let currentChunk: Record<string, string> = {};
    let currentChunkTokens = 0;
    
    // Get token estimation config based on provider
    const tokenConfig = this.getTokenConfigForProvider();
    if (process.env.NODE_ENV === 'development') {
      console.log('Token config for provider:', this.adapter.id, tokenConfig);
    }
    
    for (const [key, value] of entries) {
      // Create a test chunk with the current entry added
      const testChunk = { ...currentChunk, [key]: value };
      const estimation = estimateTokens(testChunk, tokenConfig);
      
      // Log token estimation for first few entries (only in development)
      if (process.env.NODE_ENV === 'development' && chunks.length < 2 && Object.keys(currentChunk).length < 3) {
        console.log(`Entry "${key}": estimated ${estimation.totalTokens} tokens (content: ${estimation.contentTokens}, overhead: ${estimation.promptOverhead})`);
      }
      
      // If adding this entry would exceed the limit, finalize current chunk
      if (estimation.totalTokens > this.maxTokensPerChunk && Object.keys(currentChunk).length > 0) {
        chunks.push({
          id: `${jobId}_chunk_${chunks.length}`,
          content: currentChunk,
          status: "pending"
        });
        
        // Start new chunk with current entry
        currentChunk = { [key]: value };
        currentChunkTokens = estimateTokens(currentChunk, tokenConfig).totalTokens;
      } else {
        // Add entry to current chunk
        currentChunk[key] = value;
        currentChunkTokens = estimation.totalTokens;
      }
      
      // Handle case where single entry exceeds token limit
      if (currentChunkTokens > this.maxTokensPerChunk && Object.keys(currentChunk).length === 1) {
        // Try to split the content if it's very long
        const splitContent = this.trySplitLongContent(key, value);
        if (splitContent.length > 1) {
          // Add split content as separate chunks
          for (const [splitKey, splitValue] of splitContent) {
            chunks.push({
              id: `${jobId}_chunk_${chunks.length}`,
              content: { [splitKey]: splitValue },
              status: "pending"
            });
          }
          currentChunk = {};
          currentChunkTokens = 0;
        } else {
          // Content can't be split further, add as is with warning
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Entry "${key}" exceeds token limit but cannot be split further`);
          }
          chunks.push({
            id: `${jobId}_chunk_${chunks.length}`,
            content: currentChunk,
            status: "pending"
          });
          currentChunk = {};
          currentChunkTokens = 0;
        }
      }
    }
    
    // Add final chunk if it has content
    if (Object.keys(currentChunk).length > 0) {
      chunks.push({
        id: `${jobId}_chunk_${chunks.length}`,
        content: currentChunk,
        status: "pending"
      });
    }
    
    return chunks;
  }

  /**
   * Split content into chunks based on entry count (legacy method)
   * @param entries Content entries to split
   * @param jobId Job ID
   * @returns Array of chunks
   */
  private splitIntoEntryBasedChunks(entries: [string, string][], jobId: string): TranslationChunk[] {
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
   * Get token estimation config for current LLM provider
   * @returns Token estimation config
   */
  private getTokenConfigForProvider(): Partial<TokenEstimationConfig> {
    const provider = this.adapter.id;
    
    // Provider-specific configurations with increased overhead estimates
    const providerConfigs: Record<string, Partial<TokenEstimationConfig>> = {
      openai: {
        wordToTokenRatio: 1.5, // More conservative ratio
        systemPromptOverhead: 300, // Increased for longer system prompts
        userPromptOverhead: 200, // Increased for formatting overhead
      },
      anthropic: {
        wordToTokenRatio: 1.4,
        systemPromptOverhead: 250,
        userPromptOverhead: 150,
      },
      gemini: {
        wordToTokenRatio: 1.6,
        systemPromptOverhead: 350,
        userPromptOverhead: 250,
      },
    };
    
    return providerConfigs[provider] || DEFAULT_TOKEN_CONFIG;
  }

  /**
   * Try to split very long content that exceeds token limits
   * @param key Content key
   * @param value Content value
   * @returns Array of split key-value pairs
   */
  private trySplitLongContent(key: string, value: string): [string, string][] {
    // For very long values, try to split at sentence boundaries
    if (value.length > TRANSLATION_DEFAULTS.contentSplitThreshold) {
      const sentences = value.split(/[.!?]+/).filter(s => s.trim().length > 0);
      if (sentences.length > 1) {
        const result: [string, string][] = [];
        let currentPart = '';
        
        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i].trim();
          const testPart = currentPart + (currentPart ? '. ' : '') + sentence;
          
          // If adding this sentence would make the part too long, finalize current part
          if (testPart.length > TRANSLATION_DEFAULTS.splitPartMaxLength && currentPart.length > 0) {
            result.push([`${key}_part_${result.length + 1}`, currentPart]);
            currentPart = sentence;
          } else {
            currentPart = testPart;
          }
        }
        
        // Add final part
        if (currentPart.length > 0) {
          result.push([`${key}_part_${result.length + 1}`, currentPart]);
        }
        
        return result.length > 1 ? result : [[key, value]];
      }
    }
    
    // Cannot split or not worth splitting
    return [[key, value]];
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
  public async translateChunk(
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
        
        // Increment API call counter
        const job = this.activeJobs.get(jobId);
        if (job) {
          job.totalApiCalls = (job.totalApiCalls || 0) + 1;
        }
        
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
             error.message.includes("Incorrect API key provided: undefined") ||
             error.message.includes("Invalid API Key") ||
             error.message.includes("Unauthorized") ||
             error.message.includes("401"))) {
          await this.logError("API key is not configured or is invalid. Please set your API key in the settings.", "TRANSLATION");
          // For API key configuration errors, don't retry, just throw
          throw new Error("API key configuration error: " + error.message);
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
    
    // Remove onProgress callback to prevent duplicate updates
    // Progress is now handled directly by translation-runner.ts
  }

  /**
   * Determine content types from a translation job
   * @param job Translation job
   * @returns Array of content types
   */
  private determineContentTypes(job: TranslationJob): string[] {
    const contentTypes: string[] = [];
    
    // Check if we have current file name information
    if (job.currentFileName) {
      if (job.currentFileName.includes('.jar')) {
        contentTypes.push('Minecraft Mod');
      } else if (job.currentFileName.includes('quest')) {
        contentTypes.push('Quest Files');
      } else if (job.currentFileName.includes('patchouli') || job.currentFileName.includes('book')) {
        contentTypes.push('Guidebook');
      } else if (job.currentFileName.includes('.json')) {
        contentTypes.push('JSON Data');
      } else {
        contentTypes.push('Custom Files');
      }
    }
    
    // Analyze content structure for additional context
    const sampleContent = job.chunks[0]?.content;
    if (sampleContent) {
      const keys = Object.keys(sampleContent);
      
      // Check for common Minecraft mod patterns
      if (keys.some(key => key.includes('item.') || key.includes('block.') || key.includes('gui.'))) {
        if (!contentTypes.includes('Minecraft Mod')) {
          contentTypes.push('Minecraft Mod');
        }
      }
      
      // Check for quest patterns
      if (keys.some(key => key.includes('quest') || key.includes('task') || key.includes('reward'))) {
        if (!contentTypes.includes('Quest Files')) {
          contentTypes.push('Quest Files');
        }
      }
      
      // Check for Patchouli patterns
      if (keys.some(key => key.includes('page') || key.includes('entry') || key.includes('category'))) {
        if (!contentTypes.includes('Guidebook')) {
          contentTypes.push('Guidebook');
        }
      }
    }
    
    // Default to generic if no specific type identified
    if (contentTypes.length === 0) {
      contentTypes.push('Translation Content');
    }
    
    return contentTypes;
  }
}
