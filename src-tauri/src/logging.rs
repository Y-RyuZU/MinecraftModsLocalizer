use serde::{Serialize, Deserialize};
use tauri::AppHandle;
use tauri::Manager;
use tauri::Emitter;
use log::{debug, error, info, warn, LevelFilter, Log, Metadata, Record};
use std::sync::{Arc, Mutex};
use std::collections::VecDeque;
use chrono::Local;

/// Maximum number of log entries to keep in memory
const MAX_LOG_ENTRIES: usize = 1000;

/// Log entry structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// Timestamp of the log entry
    pub timestamp: String,
    /// Log level
    pub level: String,
    /// Log message
    pub message: String,
    /// Source of the log (module path)
    pub source: Option<String>,
    /// Process type (translation, file operation, etc.)
    pub process_type: Option<String>,
}

/// Logger implementation
pub struct TauriLogger {
    /// App handle for emitting events
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    /// In-memory log buffer
    log_buffer: Arc<Mutex<VecDeque<LogEntry>>>,
}

impl TauriLogger {
    /// Create a new logger
    pub fn new() -> Self {
        Self {
            app_handle: Arc::new(Mutex::new(None)),
            log_buffer: Arc::new(Mutex::new(VecDeque::with_capacity(MAX_LOG_ENTRIES))),
        }
    }

    /// Set the app handle
    pub fn set_app_handle(&self, app_handle: AppHandle) {
        let mut handle = self.app_handle.lock().unwrap();
        *handle = Some(app_handle);
    }

    /// Get the log buffer
    pub fn get_log_buffer(&self) -> Vec<LogEntry> {
        let buffer = self.log_buffer.lock().unwrap();
        buffer.iter().cloned().collect()
    }

    /// Clear the log buffer
    pub fn clear_log_buffer(&self) {
        let mut buffer = self.log_buffer.lock().unwrap();
        buffer.clear();
    }

    /// Add a log entry
    fn add_log_entry(&self, entry: LogEntry) {
        // Add to buffer
        {
            let mut buffer = self.log_buffer.lock().unwrap();
            buffer.push_back(entry.clone());
            
            // Remove oldest entries if buffer is full
            while buffer.len() > MAX_LOG_ENTRIES {
                buffer.pop_front();
            }
        }
        
        // Emit event
        if let Some(app_handle) = self.app_handle.lock().unwrap().as_ref() {
            // In Tauri v2, we use the event API differently
            let _ = app_handle.emit("log", &entry);
        }
    }
}

impl Log for TauriLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= log::max_level()
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
            let level = record.level().to_string();
            let message = format!("{}", record.args());
            let source = record.module_path().map(|s| s.to_string());
            
            // Extract process type from message if it contains a specific format
            let process_type = if message.contains("[PROCESS:") {
                let start = message.find("[PROCESS:").unwrap() + 9;
                let end = message[start..].find("]").map(|pos| start + pos).unwrap_or(message.len());
                Some(message[start..end].trim().to_string())
            } else {
                None
            };
            
            let entry = LogEntry {
                timestamp,
                level,
                message,
                source,
                process_type,
            };
            
            self.add_log_entry(entry);
        }
    }

    fn flush(&self) {}
}

/// Initialize the logger
pub fn init_logger(level: LevelFilter) -> Arc<TauriLogger> {
    let logger = Arc::new(TauriLogger::new());
    let logger_clone = logger.clone();
    
    log::set_boxed_logger(Box::new(logger_clone)).unwrap();
    log::set_max_level(level);
    
    logger
}

/// Log a translation process message
#[tauri::command]
pub fn log_translation_process(message: &str) {
    info!("[PROCESS:TRANSLATION] {}", message);
}

/// Get all log entries
#[tauri::command]
pub fn get_logs(logger: tauri::State<Arc<TauriLogger>>) -> Vec<LogEntry> {
    logger.get_log_buffer()
}

/// Clear all log entries
#[tauri::command]
pub fn clear_logs(logger: tauri::State<Arc<TauriLogger>>) -> bool {
    logger.clear_log_buffer();
    true
}
