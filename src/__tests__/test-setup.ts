// Global test setup for Bun tests
// This file mocks the Tauri window object to prevent "window is not defined" errors

// Define global window object if it doesn't exist
if (typeof global.window === 'undefined') {
  global.window = {} as any;
}

// Mock Tauri internals
global.window.__TAURI_INTERNALS__ = {
  invoke: async (cmd: string, args?: any) => {
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
        return; // Logging commands don't return anything
        
      case 'generate_session_id':
        return `test_session_${Date.now()}`;
        
      case 'create_logs_directory_with_session':
        return `/test/logs/localizer/${args.sessionId}`;
        
      case 'create_temp_directory_with_session':
        return `/test/logs/localizer/${args.sessionId}/tmp`;
        
      case 'clear_logs':
        return;
        
      case 'get_logs':
        return [];
        
      default:
        console.warn(`Unmocked Tauri command: ${cmd}`);
        return;
    }
  }
};