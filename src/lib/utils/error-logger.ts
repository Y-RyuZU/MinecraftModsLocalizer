import { invoke } from '@tauri-apps/api/core';

/**
 * Centralized error logging utility that ensures errors are properly logged
 * to both console and Tauri backend
 */
export class ErrorLogger {
  private static isLoggingError = false;

  /**
   * Log an error with context, ensuring it reaches the user
   */
  static async logError(context: string, error: unknown, processType: string = 'SYSTEM'): Promise<void> {
    // Always log to console for debugging
    console.error(`[${context}]`, error);

    // Prevent recursive logging if log_error itself fails
    if (this.isLoggingError) {
      return;
    }

    try {
      this.isLoggingError = true;
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : String(error);
      
      const fullMessage = `[${context}] ${errorMessage}`;
      
      // Try to send to Tauri backend
      await invoke('log_error', { 
        message: fullMessage,
        processType 
      });
    } catch (logError) {
      // If logging fails, at least we have console output
      console.error('[ErrorLogger] Failed to send error to backend:', logError);
    } finally {
      this.isLoggingError = false;
    }
  }

  /**
   * Log a warning with context
   */
  static async logWarning(context: string, message: string, processType: string = 'SYSTEM'): Promise<void> {
    console.warn(`[${context}] ${message}`);

    try {
      await invoke('log_translation_process', {
        message: `[WARNING] [${context}] ${message}`
      });
    } catch (error) {
      console.error('[ErrorLogger] Failed to send warning to backend:', error);
    }
  }

  /**
   * Log info message with context
   */
  static async logInfo(context: string, message: string, processType: string = 'SYSTEM'): Promise<void> {
    try {
      await invoke('log_translation_process', {
        message: `[${context}] ${message}`
      });
    } catch (error) {
      console.error('[ErrorLogger] Failed to send info to backend:', error);
    }
  }
}