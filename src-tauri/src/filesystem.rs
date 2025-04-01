use std::fs::{File, create_dir_all};
use std::io::{self, Read, Write};
use std::path::Path;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use log::{debug, error, info};
use thiserror::Error;

/// File system errors
#[derive(Error, Debug)]
pub enum FileSystemError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
    
    #[error("Path error: {0}")]
    Path(String),
    
    #[error("File not found: {0}")]
    NotFound(String),
    
    #[error("Invalid file type: {0}")]
    InvalidFileType(String),
    
    #[error("Dialog error: {0}")]
    Dialog(String),
}

// Type alias for internal Result with FileSystemError
type FileResult<T> = std::result::Result<T, FileSystemError>;

/// Resource pack manifest (pack.mcmeta)
#[derive(Serialize, Deserialize)]
struct ResourcePackManifest {
    pack: ResourcePackInfo,
}

/// Resource pack information
#[derive(Serialize, Deserialize)]
struct ResourcePackInfo {
    description: String,
    pack_format: i32,
}

/// Get mod files from a directory
#[tauri::command]
pub fn get_mod_files(dir: &str) -> std::result::Result<Vec<String>, String> {
    info!("Getting mod files from {}", dir);
    
    let path = Path::new(dir);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }
    
    let mut mod_files = Vec::new();
    
    // Walk through the directory and find all JAR files
    for entry in WalkDir::new(path).max_depth(1).into_iter().filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        
        // Check if the file is a JAR file
        if entry_path.is_file() && entry_path.extension().map_or(false, |ext| ext == "jar") {
            if let Some(path_str) = entry_path.to_str() {
                mod_files.push(path_str.to_string());
            }
        }
    }
    
    debug!("Found {} mod files", mod_files.len());
    Ok(mod_files)
}

/// Get FTB quest files from a directory
#[tauri::command]
pub fn get_ftb_quest_files(dir: &str) -> std::result::Result<Vec<String>, String> {
    info!("Getting FTB quest files from {}", dir);
    
    let path = Path::new(dir);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }
    
    let mut quest_files = Vec::new();
    
    // Look for FTB quests in the ftbquests directory
    let ftb_quests_dir = path.join("ftbquests");
    if ftb_quests_dir.exists() && ftb_quests_dir.is_dir() {
        // Walk through the directory and find all SNBT files
        for entry in WalkDir::new(ftb_quests_dir).into_iter().filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            
            // Check if the file is an SNBT file
            if entry_path.is_file() && entry_path.extension().map_or(false, |ext| ext == "snbt") {
                if let Some(path_str) = entry_path.to_str() {
                    quest_files.push(path_str.to_string());
                }
            }
        }
    }
    
    debug!("Found {} FTB quest files", quest_files.len());
    Ok(quest_files)
}

/// Get Better Quests files from a directory
#[tauri::command]
pub fn get_better_quest_files(dir: &str) -> std::result::Result<Vec<String>, String> {
    info!("Getting Better Quests files from {}", dir);
    
    let path = Path::new(dir);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }
    
    let mut quest_files = Vec::new();
    
    // Look for Better Quests in the betterquesting directory
    let better_quests_dir = path.join("betterquesting");
    if better_quests_dir.exists() && better_quests_dir.is_dir() {
        // Walk through the directory and find all JSON files
        for entry in WalkDir::new(better_quests_dir).into_iter().filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            
            // Check if the file is a JSON file
            if entry_path.is_file() && entry_path.extension().map_or(false, |ext| ext == "json") {
                if let Some(path_str) = entry_path.to_str() {
                    quest_files.push(path_str.to_string());
                }
            }
        }
    }
    
    debug!("Found {} Better Quests files", quest_files.len());
    Ok(quest_files)
}

/// Get files with a specific extension from a directory
#[tauri::command]
pub fn get_files_with_extension(dir: &str, extension: &str) -> std::result::Result<Vec<String>, String> {
    info!("Getting files with extension {} from {}", extension, dir);
    
    let path = Path::new(dir);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }
    
    let mut files = Vec::new();
    
    // Walk through the directory and find all files with the specified extension
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        let entry_path = entry.path();
        
        // Check if the file has the specified extension
        if entry_path.is_file() && entry_path.extension().map_or(false, |ext| ext.to_string_lossy() == extension.trim_start_matches('.')) {
            if let Some(path_str) = entry_path.to_str() {
                files.push(path_str.to_string());
            }
        }
    }
    
    debug!("Found {} files with extension {}", files.len(), extension);
    Ok(files)
}

/// Read a text file
#[tauri::command]
pub fn read_text_file(path: &str) -> std::result::Result<String, String> {
    info!("Reading text file {}", path);
    
    let file_path = Path::new(path);
    if !file_path.exists() || !file_path.is_file() {
        return Err(format!("File not found: {}", path));
    }
    
    // Open the file
    let mut file = match File::open(file_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Failed to open file: {}", e)),
    };
    
    // Read the file content
    let mut content = String::new();
    if let Err(e) = file.read_to_string(&mut content) {
        return Err(format!("Failed to read file: {}", e));
    }
    
    Ok(content)
}

/// Write a text file
#[tauri::command]
pub fn write_text_file(path: &str, content: &str) -> std::result::Result<bool, String> {
    info!("Writing text file {}", path);
    
    let file_path = Path::new(path);
    
    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            if let Err(e) = create_dir_all(parent) {
                return Err(format!("Failed to create parent directories: {}", e));
            }
        }
    }
    
    // Open the file for writing
    let mut file = match File::create(file_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Failed to create file: {}", e)),
    };
    
    // Write the content
    if let Err(e) = file.write_all(content.as_bytes()) {
        return Err(format!("Failed to write file: {}", e));
    }
    
    Ok(true)
}

/// Create a directory
#[tauri::command]
pub fn create_directory(path: &str) -> std::result::Result<bool, String> {
    info!("Creating directory {}", path);
    
    let dir_path = Path::new(path);
    
    // Create the directory and all parent directories
    if let Err(e) = create_dir_all(dir_path) {
        return Err(format!("Failed to create directory: {}", e));
    }
    
    Ok(true)
}

/// Open a directory dialog
/// 
/// Note: In a real implementation, this would use the Tauri dialog API.
/// However, for simplicity, we'll just return a mock path.
#[tauri::command]
pub async fn open_directory_dialog(title: &str) -> std::result::Result<Option<String>, String> {
    info!("Opening directory dialog with title: {}", title);
    
    // In a real implementation, this would use the Tauri dialog API.
    // For now, we'll just return a mock path based on the title.
    match title {
        "Select Minecraft Mods Directory" => Ok(Some("/mock/minecraft/mods".to_string())),
        "Select Minecraft Resource Packs Directory" => Ok(Some("/mock/minecraft/resourcepacks".to_string())),
        "Select Minecraft Config Directory" => Ok(Some("/mock/minecraft/config".to_string())),
        "Select Directory with JSON/SNBT Files" => Ok(Some("/mock/minecraft/custom".to_string())),
        _ => Ok(Some("/mock/path".to_string())),
    }
}

/// Create a resource pack
#[tauri::command]
pub fn create_resource_pack(name: &str, language: &str, dir: &str) -> std::result::Result<String, String> {
    info!("Creating resource pack {} for {} in {}", name, language, dir);
    
    let dir_path = Path::new(dir);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }
    
    // Create resource pack directory
    let resource_pack_dir = dir_path.join(name);
    if let Err(e) = create_dir_all(&resource_pack_dir) {
        return Err(format!("Failed to create resource pack directory: {}", e));
    }
    
    // Create pack.mcmeta file
    let pack_mcmeta = ResourcePackManifest {
        pack: ResourcePackInfo {
            description: format!("Translated resources for {}", language),
            pack_format: 9, // Minecraft 1.19+ pack format
        },
    };
    
    let pack_mcmeta_json = match serde_json::to_string_pretty(&pack_mcmeta) {
        Ok(json) => json,
        Err(e) => return Err(format!("Failed to serialize pack.mcmeta: {}", e)),
    };
    
    let pack_mcmeta_path = resource_pack_dir.join("pack.mcmeta");
    let mut pack_mcmeta_file = match File::create(pack_mcmeta_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Failed to create pack.mcmeta: {}", e)),
    };
    
    if let Err(e) = pack_mcmeta_file.write_all(pack_mcmeta_json.as_bytes()) {
        return Err(format!("Failed to write pack.mcmeta: {}", e));
    }
    
    // Create assets directory
    let assets_dir = resource_pack_dir.join("assets");
    if let Err(e) = create_dir_all(&assets_dir) {
        return Err(format!("Failed to create assets directory: {}", e));
    }
    
    if let Some(resource_pack_path) = resource_pack_dir.to_str() {
        Ok(resource_pack_path.to_string())
    } else {
        Err("Invalid resource pack path".to_string())
    }
}

/// Write a language file to a resource pack
#[tauri::command]
pub fn write_lang_file(mod_id: &str, language: &str, content: &str, dir: &str) -> std::result::Result<bool, String> {
    info!("Writing lang file for {} in {} to {}", mod_id, language, dir);
    
    let dir_path = Path::new(dir);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }
    
    // Create mod assets directory
    let mod_assets_dir = dir_path.join("assets").join(mod_id).join("lang");
    if let Err(e) = create_dir_all(&mod_assets_dir) {
        return Err(format!("Failed to create mod assets directory: {}", e));
    }
    
    // Parse content
    let content_map: std::collections::HashMap<String, String> = match serde_json::from_str(content) {
        Ok(map) => map,
        Err(e) => return Err(format!("Failed to parse content JSON: {}", e)),
    };
    
    // Serialize content
    let content_json = match serde_json::to_string_pretty(&content_map) {
        Ok(json) => json,
        Err(e) => return Err(format!("Failed to serialize content: {}", e)),
    };
    
    // Write language file
    let lang_file_path = mod_assets_dir.join(format!("{}.json", language));
    let mut lang_file = match File::create(lang_file_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Failed to create language file: {}", e)),
    };
    
    if let Err(e) = lang_file.write_all(content_json.as_bytes()) {
        return Err(format!("Failed to write language file: {}", e));
    }
    
    Ok(true)
}
