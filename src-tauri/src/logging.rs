use serde::{Serialize, Deserialize};
use tauri::AppHandle;
use tauri::{Manager, Emitter};
use chrono::Local;
use std::sync::{Arc, Mutex};
use std::collections::VecDeque;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

/// Maximum number of log entries to keep in memory
const MAX_LOG_ENTRIES: usize = 1000;

/// Log levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warning => "WARNING",
            LogLevel::Error => "ERROR",
        }
    }
}

/// Log entry structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    /// Timestamp of the log entry
    pub timestamp: String,
    /// Log level
    pub level: LogLevel,
    /// Log message
    pub message: String,
    /// Process type (translation, file operation, etc.)
    pub process_type: Option<String>,
}

/// Custom logger implementation
pub struct AppLogger {
    /// App handle for emitting events
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    /// In-memory log buffer
    log_buffer: Arc<Mutex<VecDeque<LogEntry>>>,
    /// Current log file path
    log_file_path: Arc<Mutex<Option<PathBuf>>>,
}

impl AppLogger {
    /// Create a new logger
    pub fn new() -> Self {
        Self {
            app_handle: Arc::new(Mutex::new(None)),
            log_buffer: Arc::new(Mutex::new(VecDeque::with_capacity(MAX_LOG_ENTRIES))),
            log_file_path: Arc::new(Mutex::new(None)),
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

    /// Set the log file path
    pub fn set_log_file(&self, path: PathBuf) {
        let mut log_file = self.log_file_path.lock().unwrap();
        *log_file = Some(path);
    }

    /// Log a message
    pub fn log(&self, level: LogLevel, message: &str, process_type: Option<&str>) {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
        
        let entry = LogEntry {
            timestamp: timestamp.clone(),
            level: level.clone(),
            message: message.to_string(),
            process_type: process_type.map(|s| s.to_string()),
        };
        
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
            let _ = app_handle.emit("log", &entry);
        }
        
        // Write to log file
        self.write_log_to_file(&entry);
    }

    /// Debug level log
    pub fn debug(&self, message: &str, process_type: Option<&str>) {
        self.log(LogLevel::Debug, message, process_type);
    }

    /// Info level log
    pub fn info(&self, message: &str, process_type: Option<&str>) {
        self.log(LogLevel::Info, message, process_type);
    }

    /// Warning level log
    pub fn warning(&self, message: &str, process_type: Option<&str>) {
        self.log(LogLevel::Warning, message, process_type);
    }

    /// Error level log
    pub fn error(&self, message: &str, process_type: Option<&str>) {
        self.log(LogLevel::Error, message, process_type);
    }

    /// Write log entry to file
    fn write_log_to_file(&self, entry: &LogEntry) {
        // Only write to file if a log file path has been explicitly set
        let log_file_path = self.log_file_path.lock().unwrap();
        
        if let Some(log_file) = log_file_path.as_ref() {
            // Format log entry
            let log_line = format!(
                "[{}] [{}] {}{}\n",
                entry.timestamp,
                entry.level.as_str(),
                if let Some(process_type) = &entry.process_type {
                    format!("[{}] ", process_type)
                } else {
                    String::new()
                },
                entry.message
            );
            
            // Append to log file
            match fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_file)
            {
                Ok(mut file) => {
                    if let Err(e) = file.write_all(log_line.as_bytes()) {
                        eprintln!("Failed to write to log file: {}", e);
                    }
                },
                Err(e) => {
                    eprintln!("Failed to open log file: {}", e);
                }
            }
        }
    }
}

/// Initialize the logger
pub fn init_logger() -> Arc<AppLogger> {
    Arc::new(AppLogger::new())
}

/// Log a translation process message
#[tauri::command]
pub fn log_translation_process(message: &str, logger: tauri::State<Arc<AppLogger>>) {
    logger.info(message, Some("TRANSLATION"));
}

/// Log a file operation message
#[tauri::command]
pub fn log_file_operation(message: &str, logger: tauri::State<Arc<AppLogger>>) {
    logger.info(message, Some("FILE_OPERATION"));
}

/// Log an API request message
#[tauri::command]
pub fn log_api_request(message: &str, logger: tauri::State<Arc<AppLogger>>) {
    logger.info(message, Some("API_REQUEST"));
}

/// Log an error message
#[tauri::command]
pub fn log_error(message: &str, process_type: Option<String>, logger: tauri::State<Arc<AppLogger>>) {
    logger.error(message, process_type.as_deref());
}

/// Get all log entries
#[tauri::command]
pub fn get_logs(logger: tauri::State<Arc<AppLogger>>) -> Vec<LogEntry> {
    logger.get_log_buffer()
}

/// Clear all log entries
#[tauri::command]
pub fn clear_logs(logger: tauri::State<Arc<AppLogger>>) -> bool {
    logger.clear_log_buffer();
    true
}

/// Generate a unique session timestamp for consistent directory naming
fn generate_session_timestamp() -> String {
    Local::now().format("%Y-%m-%d_%H-%M-%S").to_string()
}

/// Create logs directory structure in Minecraft profile with optional session ID
#[tauri::command]
pub fn create_logs_directory(minecraft_dir: String, logger: tauri::State<Arc<AppLogger>>) -> std::result::Result<String, String> {
    // Get current timestamp with precision down to the second for unique directories
    let timestamp = generate_session_timestamp();
    
    // Create logs directory with unique timestamp: logs/localizer/{timestamp}
    let minecraft_path = PathBuf::from(&minecraft_dir);
    let logs_dir = minecraft_path.join("logs").join("localizer").join(&timestamp);
    
    // Create the directory and all parent directories
    match fs::create_dir_all(&logs_dir) {
        Ok(_) => {
            // Set the log file path
            let log_file = logs_dir.join("localizer.log");
            logger.set_log_file(log_file.clone());
            
            // Log the creation of the logs directory
            logger.info(&format!("Logs directory created: {}", logs_dir.display()), Some("SYSTEM"));
            
            // Return the path as a string
            if let Some(path_str) = logs_dir.to_str() {
                Ok(path_str.to_string())
            } else {
                Err("Invalid logs directory path".to_string())
            }
        },
        Err(e) => {
            eprintln!("Failed to create logs directory: {}", e);
            Err(format!("Failed to create logs directory: {}", e))
        }
    }
}

/// Create temporary directory for Patchouli translation (as specified in SPECIFICATION.md)
#[tauri::command]
pub fn create_temp_directory(minecraft_dir: String, logger: tauri::State<Arc<AppLogger>>) -> std::result::Result<String, String> {
    // Get current timestamp with precision down to the second for unique directories
    let timestamp = generate_session_timestamp();
    
    // Create temporary directory with unique timestamp: logs/localizer/{timestamp}/tmp
    let minecraft_path = PathBuf::from(&minecraft_dir);
    let temp_dir = minecraft_path.join("logs").join("localizer").join(&timestamp).join("tmp");
    
    // Create the directory and all parent directories
    match fs::create_dir_all(&temp_dir) {
        Ok(_) => {
            // Log the creation of the temporary directory
            logger.info(&format!("Temporary directory created: {}", temp_dir.display()), Some("SYSTEM"));
            
            // Return the path as a string
            if let Some(path_str) = temp_dir.to_str() {
                Ok(path_str.to_string())
            } else {
                Err("Invalid temporary directory path".to_string())
            }
        },
        Err(e) => {
            eprintln!("Failed to create temporary directory: {}", e);
            Err(format!("Failed to create temporary directory: {}", e))
        }
    }
}

/// Create logs directory with specific session ID for consistent directory naming across job
#[tauri::command]
pub fn create_logs_directory_with_session(minecraft_dir: String, session_id: String, logger: tauri::State<Arc<AppLogger>>) -> std::result::Result<String, String> {
    // Create logs directory with provided session ID: logs/localizer/{session_id}
    let minecraft_path = PathBuf::from(&minecraft_dir);
    let logs_dir = minecraft_path.join("logs").join("localizer").join(&session_id);
    
    // Create the directory and all parent directories
    match fs::create_dir_all(&logs_dir) {
        Ok(_) => {
            // Set the log file path
            let log_file = logs_dir.join("localizer.log");
            logger.set_log_file(log_file.clone());
            
            // Log the creation of the logs directory
            logger.info(&format!("Session logs directory created: {}", logs_dir.display()), Some("SYSTEM"));
            
            // Return the path as a string
            if let Some(path_str) = logs_dir.to_str() {
                Ok(path_str.to_string())
            } else {
                Err("Invalid logs directory path".to_string())
            }
        },
        Err(e) => {
            eprintln!("Failed to create logs directory: {}", e);
            Err(format!("Failed to create logs directory: {}", e))
        }
    }
}

/// Create temporary directory with specific session ID for consistent directory naming across job
#[tauri::command]
pub fn create_temp_directory_with_session(minecraft_dir: String, session_id: String, logger: tauri::State<Arc<AppLogger>>) -> std::result::Result<String, String> {
    // Create temporary directory with provided session ID: logs/localizer/{session_id}/tmp
    let minecraft_path = PathBuf::from(&minecraft_dir);
    let temp_dir = minecraft_path.join("logs").join("localizer").join(&session_id).join("tmp");
    
    // Create the directory and all parent directories
    match fs::create_dir_all(&temp_dir) {
        Ok(_) => {
            // Log the creation of the temporary directory
            logger.info(&format!("Session temporary directory created: {}", temp_dir.display()), Some("SYSTEM"));
            
            // Return the path as a string
            if let Some(path_str) = temp_dir.to_str() {
                Ok(path_str.to_string())
            } else {
                Err("Invalid temporary directory path".to_string())
            }
        },
        Err(e) => {
            eprintln!("Failed to create temporary directory: {}", e);
            Err(format!("Failed to create temporary directory: {}", e))
        }
    }
}

/// Generate a new session ID that can be used for consistent directory naming
#[tauri::command]
pub fn generate_session_id() -> String {
    generate_session_timestamp()
}
