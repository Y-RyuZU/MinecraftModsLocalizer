use crate::filesystem::serialize_json_sorted;
use crate::logging::AppLogger;
/**
 * Simplified backup module for translation system
 * Only handles backup creation - all management features have been removed
 * as per TX016 specification for a minimal backup system
 */
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;

/// Validate session ID format: YYYY-MM-DD_HH-MM-SS
fn validate_session_id_format(session_id: &str) -> bool {
    if session_id.len() != 19 {
        return false;
    }

    let chars: Vec<char> = session_id.chars().collect();

    // Check pattern: YYYY-MM-DD_HH-MM-SS
    chars[4] == '-'
        && chars[7] == '-'
        && chars[10] == '_'
        && chars[13] == '-'
        && chars[16] == '-'
        && chars[0..4].iter().all(|c| c.is_ascii_digit())
        && chars[5..7].iter().all(|c| c.is_ascii_digit())
        && chars[8..10].iter().all(|c| c.is_ascii_digit())
        && chars[11..13].iter().all(|c| c.is_ascii_digit())
        && chars[14..16].iter().all(|c| c.is_ascii_digit())
        && chars[17..19].iter().all(|c| c.is_ascii_digit())
}

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

    // Save metadata with sorted keys
    let metadata_path = backup_dir.join("metadata.json");
    let metadata_json = serialize_json_sorted(&metadata)
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

/// Copy directory recursively
fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.as_ref().join(entry.file_name());

        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

/// Backup original SNBT files before translation
#[tauri::command]
pub fn backup_snbt_files(
    files: Vec<String>,
    session_path: String,
    logger: State<Arc<AppLogger>>,
) -> Result<(), String> {
    logger.info(
        &format!("Backing up {} SNBT files", files.len()),
        Some("BACKUP"),
    );

    // Create backup directory: {session_path}/backup/snbt_original/
    let backup_dir = PathBuf::from(&session_path)
        .join("backup")
        .join("snbt_original");

    if let Err(e) = fs::create_dir_all(&backup_dir) {
        let error_msg = format!("Failed to create SNBT backup directory: {e}");
        logger.error(&error_msg, Some("BACKUP"));
        return Err(error_msg);
    }

    // Copy each SNBT file to backup directory
    let mut backed_up_count = 0;
    for file_path in files {
        let source = Path::new(&file_path);
        if source.exists() {
            if let Some(file_name) = source.file_name() {
                let dest = backup_dir.join(file_name);

                if let Err(e) = fs::copy(source, &dest) {
                    logger.warning(
                        &format!("Failed to backup SNBT file {file_path}: {e}"),
                        Some("BACKUP"),
                    );
                } else {
                    backed_up_count += 1;
                    logger.debug(
                        &format!("Backed up SNBT: {} -> {}", file_path, dest.display()),
                        Some("BACKUP"),
                    );
                }
            }
        } else {
            logger.warning(
                &format!("SNBT file not found for backup: {file_path}"),
                Some("BACKUP"),
            );
        }
    }

    logger.info(
        &format!("SNBT backup completed: {backed_up_count} files backed up"),
        Some("BACKUP"),
    );

    Ok(())
}

/// Backup generated resource pack after mods translation
#[tauri::command]
pub fn backup_resource_pack(
    pack_path: String,
    session_path: String,
    logger: State<Arc<AppLogger>>,
) -> Result<(), String> {
    logger.info(
        &format!("Backing up resource pack: {pack_path}"),
        Some("BACKUP"),
    );

    let source = Path::new(&pack_path);

    if !source.exists() {
        return Err(format!("Resource pack not found: {pack_path}"));
    }

    // Extract pack name from path
    let pack_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid resource pack path".to_string())?;

    // Create backup directory: {session_path}/backup/resource_pack/
    let backup_dir = PathBuf::from(&session_path)
        .join("backup")
        .join("resource_pack");

    if let Err(e) = fs::create_dir_all(&backup_dir) {
        let error_msg = format!("Failed to create resource pack backup directory: {e}");
        logger.error(&error_msg, Some("BACKUP"));
        return Err(error_msg);
    }

    // Copy entire resource pack directory
    let dest = backup_dir.join(pack_name);

    if let Err(e) = copy_dir_all(source, &dest) {
        let error_msg = format!("Failed to backup resource pack: {e}");
        logger.error(&error_msg, Some("BACKUP"));
        return Err(error_msg);
    }

    logger.info(
        &format!("Resource pack backup completed: {}", dest.display()),
        Some("BACKUP"),
    );

    Ok(())
}

/// Translation summary types for translation history
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationSummary {
    pub lang: String,
    pub translations: Vec<TranslationEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationEntry {
    #[serde(rename = "type")]
    pub translation_type: String, // "mod", "quest", "patchouli", "custom"
    pub name: String,
    pub status: String, // "completed" or "failed"
    pub keys: String,   // Format: "translated/total" e.g. "234/234"
}

/// List all translation session directories
#[tauri::command]
pub async fn list_translation_sessions(minecraft_dir: String) -> Result<Vec<String>, String> {
    let logs_path = PathBuf::from(&minecraft_dir).join("logs").join("localizer");

    if !logs_path.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();

    // Read directory entries
    let entries =
        fs::read_dir(&logs_path).map_err(|e| format!("Failed to read logs directory: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let path = entry.path();

        // Only include directories that match session ID format
        if path.is_dir() {
            if let Some(dir_name) = path.file_name() {
                if let Some(name_str) = dir_name.to_str() {
                    // Validate session ID format: YYYY-MM-DD_HH-MM-SS
                    if validate_session_id_format(name_str) {
                        sessions.push(name_str.to_string());
                    }
                }
            }
        }
    }

    // Sort sessions by name (newest first due to timestamp format)
    sessions.sort_by(|a, b| b.cmp(a));

    Ok(sessions)
}

/// Read translation summary for a specific session
#[tauri::command]
pub async fn get_translation_summary(
    minecraft_dir: String,
    session_id: String,
) -> Result<TranslationSummary, String> {
    let summary_path = PathBuf::from(&minecraft_dir)
        .join("logs")
        .join("localizer")
        .join(&session_id)
        .join("translation_summary.json");

    if !summary_path.exists() {
        // Check if the session directory exists
        let session_dir = summary_path.parent().unwrap();
        if session_dir.exists() {
            // Session exists but no translations completed yet
            // Return empty summary
            return Ok(TranslationSummary {
                lang: "unknown".to_string(),
                translations: Vec::new(),
            });
        } else {
            // Session directory doesn't exist
            return Err(format!(
                "Session not found: {session_id}"
            ));
        }
    }

    // Read and parse the JSON file
    let content = fs::read_to_string(&summary_path)
        .map_err(|e| format!("Failed to read summary file: {e}"))?;

    let summary: TranslationSummary =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse summary JSON: {e}"))?;

    Ok(summary)
}

/// Update translation summary with a new entry
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_translation_summary(
    minecraft_dir: String,
    session_id: String,
    translation_type: String,
    name: String,
    status: String,
    translated_keys: i32,
    total_keys: i32,
    target_language: String,
) -> Result<(), String> {
    let session_dir = PathBuf::from(&minecraft_dir)
        .join("logs")
        .join("localizer")
        .join(&session_id);

    // Ensure session directory exists
    fs::create_dir_all(&session_dir)
        .map_err(|e| format!("Failed to create session directory: {e}"))?;

    let summary_path = session_dir.join("translation_summary.json");

    // Read existing summary or create new one
    let mut summary = if summary_path.exists() {
        let content = fs::read_to_string(&summary_path)
            .map_err(|e| format!("Failed to read existing summary: {e}"))?;

        serde_json::from_str::<TranslationSummary>(&content)
            .map_err(|e| format!("Failed to parse existing summary: {e}"))?
    } else {
        TranslationSummary {
            lang: target_language.clone(),
            translations: Vec::new(),
        }
    };

    // Add new translation entry
    let entry = TranslationEntry {
        translation_type,
        name,
        status,
        keys: format!("{translated_keys}/{total_keys}"),
    };

    summary.translations.push(entry);

    // Write updated summary back to file with sorted keys
    let json =
        serialize_json_sorted(&summary).map_err(|e| format!("Failed to serialize summary: {e}"))?;

    fs::write(&summary_path, json).map_err(|e| format!("Failed to write summary file: {e}"))?;

    Ok(())
}
