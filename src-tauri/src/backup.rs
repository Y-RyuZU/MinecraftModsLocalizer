use crate::logging::AppLogger;
/**
 * Backup module for managing translation file backups
 * Integrates with existing logging infrastructure to store backups in session directories
 */
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;

/// Backup metadata structure matching TypeScript interface
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupMetadata {
    /// Unique backup identifier
    pub id: String,
    /// Backup creation timestamp
    pub timestamp: String,
    /// Type of content backed up
    pub r#type: String,
    /// Name of the source file/mod
    pub source_name: String,
    /// Target language code
    pub target_language: String,
    /// Session ID this backup belongs to
    pub session_id: String,
    /// Translation statistics
    pub statistics: BackupStatistics,
    /// Original file paths that were backed up
    pub original_paths: Vec<String>,
}

/// Backup statistics structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStatistics {
    pub total_keys: u32,
    pub successful_translations: u32,
    pub file_size: u64,
}

/// Backup information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    /// Backup metadata
    pub metadata: BackupMetadata,
    /// Full path to backup directory
    pub backup_path: String,
    /// Whether this backup can be restored
    pub can_restore: bool,
}

/// Create a backup of files before translation
#[tauri::command]
pub fn create_backup(
    metadata: BackupMetadata,
    file_paths: Vec<String>,
    logger: State<Arc<AppLogger>>,
) -> Result<String, String> {
    logger.info(&format!("Creating backup: {}", metadata.id), Some("BACKUP"));

    // Construct backup path using session structure: logs/localizer/{session_id}/backups/{backup_id}
    let backup_dir = PathBuf::from("logs")
        .join("localizer")
        .join(&metadata.session_id)
        .join("backups")
        .join(&metadata.id);

    // Create backup directory
    if let Err(e) = fs::create_dir_all(&backup_dir) {
        let error_msg = format!("Failed to create backup directory: {e}");
        logger.error(&error_msg, Some("BACKUP"));
        return Err(error_msg);
    }

    // Create original_files subdirectory
    let original_files_dir = backup_dir.join("original_files");
    if let Err(e) = fs::create_dir_all(&original_files_dir) {
        let error_msg = format!("Failed to create original files directory: {e}");
        logger.error(&error_msg, Some("BACKUP"));
        return Err(error_msg);
    }

    // Copy files to backup location
    let mut backed_up_files = Vec::new();
    for file_path in &file_paths {
        let source_path = Path::new(file_path);

        if source_path.exists() {
            // Create destination path maintaining relative structure
            let file_name = source_path
                .file_name()
                .ok_or_else(|| format!("Invalid file path: {file_path}"))?;
            let dest_path = original_files_dir.join(file_name);

            // Copy file
            if let Err(e) = fs::copy(source_path, &dest_path) {
                logger.warning(
                    &format!("Failed to backup file {file_path}: {e}"),
                    Some("BACKUP"),
                );
            } else {
                backed_up_files.push(dest_path.to_string_lossy().to_string());
                logger.debug(
                    &format!("Backed up file: {} -> {}", file_path, dest_path.display()),
                    Some("BACKUP"),
                );
            }
        } else {
            logger.warning(
                &format!("Source file not found for backup: {file_path}"),
                Some("BACKUP"),
            );
        }
    }

    // Save metadata
    let metadata_path = backup_dir.join("metadata.json");
    let metadata_json = serde_json::to_string_pretty(&metadata)
        .map_err(|e| format!("Failed to serialize backup metadata: {e}"))?;

    fs::write(&metadata_path, metadata_json)
        .map_err(|e| format!("Failed to write backup metadata: {e}"))?;

    let backup_path = backup_dir.to_string_lossy().to_string();
    logger.info(
        &format!(
            "Backup created successfully: {} ({} files)",
            backup_path,
            backed_up_files.len()
        ),
        Some("BACKUP"),
    );

    Ok(backup_path)
}

/// List available backups with optional filtering
#[tauri::command]
pub fn list_backups(
    r#type: Option<String>,
    session_id: Option<String>,
    limit: Option<usize>,
    logger: State<Arc<AppLogger>>,
) -> Result<Vec<BackupInfo>, String> {
    logger.debug("Listing backups", Some("BACKUP"));

    let logs_dir = PathBuf::from("logs").join("localizer");

    if !logs_dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();

    // Iterate through session directories
    let session_dirs =
        fs::read_dir(&logs_dir).map_err(|e| format!("Failed to read logs directory: {e}"))?;

    for session_entry in session_dirs {
        let session_entry =
            session_entry.map_err(|e| format!("Failed to read session directory entry: {e}"))?;

        let session_path = session_entry.path();
        if !session_path.is_dir() {
            continue;
        }

        let session_name = session_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();

        // Filter by session ID if specified
        if let Some(ref filter_session) = session_id {
            if session_name != filter_session {
                continue;
            }
        }

        // Check for backups directory in this session
        let backups_dir = session_path.join("backups");
        if !backups_dir.exists() {
            continue;
        }

        // Iterate through backup directories
        let backup_entries = fs::read_dir(&backups_dir)
            .map_err(|e| format!("Failed to read backups directory: {e}"))?;

        for backup_entry in backup_entries {
            let backup_entry =
                backup_entry.map_err(|e| format!("Failed to read backup entry: {e}"))?;

            let backup_path = backup_entry.path();
            if !backup_path.is_dir() {
                continue;
            }

            // Read metadata
            let metadata_path = backup_path.join("metadata.json");
            if !metadata_path.exists() {
                continue;
            }

            let metadata_content = fs::read_to_string(&metadata_path)
                .map_err(|e| format!("Failed to read backup metadata: {e}"))?;

            let metadata: BackupMetadata = serde_json::from_str(&metadata_content)
                .map_err(|e| format!("Failed to parse backup metadata: {e}"))?;

            // Filter by type if specified
            if let Some(ref filter_type) = r#type {
                if &metadata.r#type != filter_type {
                    continue;
                }
            }

            // Check if backup can be restored (original files exist)
            let original_files_dir = backup_path.join("original_files");
            let can_restore = original_files_dir.exists()
                && original_files_dir
                    .read_dir()
                    .map(|mut entries| entries.next().is_some())
                    .unwrap_or(false);

            let backup_info = BackupInfo {
                metadata,
                backup_path: backup_path.to_string_lossy().to_string(),
                can_restore,
            };

            backups.push(backup_info);
        }
    }

    // Sort by timestamp (newest first)
    backups.sort_by(|a, b| b.metadata.timestamp.cmp(&a.metadata.timestamp));

    // Apply limit if specified
    if let Some(limit) = limit {
        backups.truncate(limit);
    }

    logger.info(&format!("Found {} backups", backups.len()), Some("BACKUP"));
    Ok(backups)
}

/// Restore files from a backup
#[tauri::command]
pub fn restore_backup(
    backup_id: String,
    target_path: String,
    logger: State<Arc<AppLogger>>,
) -> Result<(), String> {
    logger.info(
        &format!("Restoring backup: {backup_id} to {target_path}"),
        Some("BACKUP"),
    );

    // Find the backup by ID
    let backups = list_backups(None, None, None, logger.clone())?;
    let backup = backups
        .iter()
        .find(|b| b.metadata.id == backup_id)
        .ok_or_else(|| format!("Backup not found: {backup_id}"))?;

    let backup_path = Path::new(&backup.backup_path);
    let original_files_dir = backup_path.join("original_files");

    if !original_files_dir.exists() {
        return Err("Backup original files not found".to_string());
    }

    let target_dir = Path::new(&target_path);

    // Create target directory if it doesn't exist
    if let Err(e) = fs::create_dir_all(target_dir) {
        let error_msg = format!("Failed to create target directory: {e}");
        logger.error(&error_msg, Some("BACKUP"));
        return Err(error_msg);
    }

    // Copy files from backup to target
    let backup_files = fs::read_dir(&original_files_dir)
        .map_err(|e| format!("Failed to read backup files: {e}"))?;

    let mut restored_count = 0;
    for backup_file in backup_files {
        let backup_file =
            backup_file.map_err(|e| format!("Failed to read backup file entry: {e}"))?;

        let source_path = backup_file.path();
        let file_name = source_path
            .file_name()
            .ok_or_else(|| "Invalid backup file name".to_string())?;
        let dest_path = target_dir.join(file_name);

        if let Err(e) = fs::copy(&source_path, &dest_path) {
            logger.warning(
                &format!("Failed to restore file {}: {}", source_path.display(), e),
                Some("BACKUP"),
            );
        } else {
            restored_count += 1;
            logger.debug(
                &format!(
                    "Restored file: {} -> {}",
                    source_path.display(),
                    dest_path.display()
                ),
                Some("BACKUP"),
            );
        }
    }

    logger.info(
        &format!("Backup restoration completed: {restored_count} files restored"),
        Some("BACKUP"),
    );
    Ok(())
}

/// Delete a specific backup
#[tauri::command]
pub fn delete_backup(backup_id: String, logger: State<Arc<AppLogger>>) -> Result<(), String> {
    logger.info(&format!("Deleting backup: {backup_id}"), Some("BACKUP"));

    // Find the backup by ID
    let backups = list_backups(None, None, None, logger.clone())?;
    let backup = backups
        .iter()
        .find(|b| b.metadata.id == backup_id)
        .ok_or_else(|| format!("Backup not found: {backup_id}"))?;

    let backup_path = Path::new(&backup.backup_path);

    if backup_path.exists() {
        fs::remove_dir_all(backup_path)
            .map_err(|e| format!("Failed to delete backup directory: {e}"))?;

        logger.info(
            &format!("Backup deleted successfully: {backup_id}"),
            Some("BACKUP"),
        );
    } else {
        logger.warning(
            &format!("Backup directory not found for deletion: {backup_id}"),
            Some("BACKUP"),
        );
    }

    Ok(())
}

/// Prune old backups based on retention policy
#[tauri::command]
pub fn prune_old_backups(
    retention_days: u32,
    logger: State<Arc<AppLogger>>,
) -> Result<u32, String> {
    logger.info(
        &format!("Pruning backups older than {retention_days} days"),
        Some("BACKUP"),
    );

    let cutoff_time = chrono::Utc::now() - chrono::Duration::days(retention_days as i64);
    let backups = list_backups(None, None, None, logger.clone())?;

    let mut deleted_count = 0;
    for backup in backups {
        // Parse backup timestamp
        if let Ok(backup_time) = chrono::DateTime::parse_from_rfc3339(&backup.metadata.timestamp) {
            if backup_time.with_timezone(&chrono::Utc) < cutoff_time {
                if let Ok(()) = delete_backup(backup.metadata.id.clone(), logger.clone()) {
                    deleted_count += 1;
                    logger.debug(
                        &format!("Pruned old backup: {}", backup.metadata.id),
                        Some("BACKUP"),
                    );
                }
            }
        }
    }

    logger.info(
        &format!("Backup pruning completed: {deleted_count} backups removed"),
        Some("BACKUP"),
    );
    Ok(deleted_count)
}

/// Get backup information by ID
#[tauri::command]
pub fn get_backup_info(
    backup_id: String,
    logger: State<Arc<AppLogger>>,
) -> Result<Option<BackupInfo>, String> {
    let backups = list_backups(None, None, None, logger)?;
    Ok(backups.into_iter().find(|b| b.metadata.id == backup_id))
}

/// Get total backup storage size
#[tauri::command]
pub fn get_backup_storage_size(logger: State<Arc<AppLogger>>) -> Result<u64, String> {
    let logs_dir = PathBuf::from("logs").join("localizer");

    if !logs_dir.exists() {
        return Ok(0);
    }

    let mut total_size = 0u64;

    // Calculate size recursively for all backup directories
    fn calculate_dir_size(dir: &Path) -> Result<u64, std::io::Error> {
        let mut size = 0u64;
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                size += calculate_dir_size(&path)?;
            } else {
                size += entry.metadata()?.len();
            }
        }
        Ok(size)
    }

    // Iterate through session directories looking for backup subdirectories
    let session_dirs =
        fs::read_dir(&logs_dir).map_err(|e| format!("Failed to read logs directory: {e}"))?;

    for session_entry in session_dirs {
        let session_entry =
            session_entry.map_err(|e| format!("Failed to read session directory: {e}"))?;

        let backups_dir = session_entry.path().join("backups");
        if backups_dir.exists() {
            total_size += calculate_dir_size(&backups_dir)
                .map_err(|e| format!("Failed to calculate backup size: {e}"))?;
        }
    }

    logger.debug(
        &format!("Total backup storage size: {total_size} bytes"),
        Some("BACKUP"),
    );
    Ok(total_size)
}
