// Global test setup for Bun tests
// This file mocks the Tauri window object to prevent "window is not defined" errors

// Define global window object if it doesn't exist
if (typeof global.window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window = {} as Window;
}

// Mock Tauri internals
global.window.__TAURI_INTERNALS__ = {
  invoke: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
    // Mock implementation for Tauri commands used in tests
    console.log(`[Mock Tauri] ${cmd}:`, args);
    
    // Return appropriate responses for different commands
    switch (cmd) {
      case 'log_translation_process':
      case 'log_api_request':
      case 'log_file_operation':
      case 'log_error':
      case 'log_file_progress':
      case 'log_performance_metrics':
      case 'log_translation_start':
      case 'log_translation_statistics':
      case 'log_translation_completion':
      case 'clear_logs':
        return undefined as T; // Logging commands don't return anything
        
      case 'generate_session_id':
        return `test_session_${Date.now()}` as T;
        
      case 'create_logs_directory_with_session':
        return `/test/logs/localizer/${args?.sessionId}` as T;
        
      case 'create_temp_directory_with_session':
        return `/test/logs/localizer/${args?.sessionId}/tmp` as T;
        
      case 'get_logs':
        return [] as T;
        
      default:
        console.warn(`Unmocked Tauri command: ${cmd}`);
        return undefined as T;
    }
  }
};