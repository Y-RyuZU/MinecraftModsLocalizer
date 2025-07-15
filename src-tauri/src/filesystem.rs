use log::{debug, error, info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tauri_plugin_shell::ShellExt;
use thiserror::Error;
use walkdir::WalkDir;

/// File system errors
#[derive(Error, Debug)]
pub enum FileSystemError {
    #[error("IO error: {0}")]
    Io(String),

    #[error("Path error: {0}")]
    Path(String),

    #[error("File not found: {0}")]
    NotFound(String),

    #[error("Invalid file type: {0}")]
    InvalidFileType(String),

    #[error("Dialog error: {0}")]
    Dialog(String),

    #[error("Tauri FS error: {0}")]
    TauriFs(String),
}

// We'll use std::result::Result directly instead of a type alias

/// Resource pack manifest (pack.mcmeta)
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResourcePackManifest {
    pack: ResourcePackInfo,
}

/// Resource pack information
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResourcePackInfo {
    description: String,
    pack_format: i32,
}

/// Get mod files from a directory
#[tauri::command]
pub async fn get_mod_files(
    _app_handle: tauri::AppHandle,
    dir: &str,
) -> std::result::Result<Vec<String>, String> {
    info!("Getting mod files from {}", dir);

    let path = Path::new(dir);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }

    let mut mod_files = Vec::new();

    // Check if mods directory exists in the profile directory
    let mods_dir = path.join("mods");
    let target_dir = if mods_dir.exists() && mods_dir.is_dir() {
        info!("Found mods directory: {}", mods_dir.display());
        mods_dir
    } else {
        info!(
            "No mods directory found, using profile directory: {}",
            path.display()
        );
        path.to_path_buf()
    };

    // Walk through the directory and find all JAR files
    for entry in WalkDir::new(target_dir)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();

        // Check if the file is a JAR file
        if entry_path.is_file() && entry_path.extension().is_some_and(|ext| ext == "jar") {
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
pub async fn get_ftb_quest_files(
    _app_handle: tauri::AppHandle,
    dir: &str,
) -> std::result::Result<Vec<String>, String> {
    info!("Getting FTB quest files from {}", dir);

    // Validate and canonicalize the path to prevent directory traversal attacks
    let path = match Path::new(dir).canonicalize() {
        Ok(canonical_path) => {
            // Ensure the path is actually a directory
            if !canonical_path.is_dir() {
                return Err(format!("Path is not a directory: {}", dir));
            }
            canonical_path
        }
        Err(e) => {
            error!("Failed to canonicalize path {}: {}", dir, e);
            return Err(format!("Invalid directory path: {}", dir));
        }
    };

    let mut quest_files = Vec::new();

    // First, check for KubeJS lang files - if they exist, use them exclusively
    let kubejs_dir = path.join("kubejs");
    let kubejs_assets_dir = kubejs_dir.join("assets").join("kubejs").join("lang");
    let kubejs_en_us_file = kubejs_assets_dir.join("en_us.json");

    if kubejs_en_us_file.exists() && kubejs_en_us_file.is_file() {
        info!("Found KubeJS en_us.json file - using KubeJS lang file translation method");

        if kubejs_assets_dir.exists() && kubejs_assets_dir.is_dir() {
            info!(
                "Scanning kubejs lang directory: {}",
                kubejs_assets_dir.display()
            );
            // Walk through the directory and find all JSON files
            for entry in WalkDir::new(kubejs_assets_dir).max_depth(1).into_iter() {
                match entry {
                    Ok(entry) => {
                        let entry_path = entry.path();

                        // Check if the file is a JSON file and not already translated
                        if entry_path.is_file()
                            && entry_path.extension().is_some_and(|ext| ext == "json")
                        {
                            // Skip files that already have language suffixes
                            if let Some(file_name) = entry_path.file_name().and_then(|n| n.to_str())
                            {
                                if file_name.contains(".ja_jp.")
                                    || file_name.contains(".zh_cn.")
                                    || file_name.contains(".ko_kr.")
                                    || file_name.contains(".de_de.")
                                    || file_name.contains(".fr_fr.")
                                    || file_name.contains(".es_es.")
                                    || file_name.contains(".it_it.")
                                    || file_name.contains(".pt_br.")
                                    || file_name.contains(".ru_ru.")
                                {
                                    debug!("Skipping already translated file: {}", file_name);
                                    continue;
                                }
                            }

                            match entry_path.to_str() {
                                Some(path_str) => quest_files.push(path_str.to_string()),
                                None => {
                                    error!(
                                        "Failed to convert path to string: {}",
                                        entry_path.display()
                                    );
                                    return Err(format!(
                                        "Invalid path encoding: {}",
                                        entry_path.display()
                                    ));
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!("Error reading KubeJS lang directory entry: {}", e);
                        return Err(format!("Failed to read KubeJS lang directory: {}", e));
                    }
                }
            }
        } else {
            return Err(format!(
                "KubeJS lang directory not accessible: {}",
                kubejs_assets_dir.display()
            ));
        }
    } else {
        info!("No KubeJS en_us.json found - falling back to SNBT file translation method");

        // Look for FTB quests in multiple possible directories
        let config_dir = path.join("config");
        let quest_roots = vec![
            config_dir.join("ftbquests").join("quests"), // Standard path
            config_dir.join("ftbquests").join("normal"), // FTB Interactions Remastered path
            config_dir.join("ftbquests"),                // Fallback to root directory
        ];

        let mut quest_dir_found = false;
        for quest_root in quest_roots {
            if quest_root.exists() && quest_root.is_dir() {
                info!("Scanning FTB quests directory: {}", quest_root.display());
                quest_dir_found = true;

                // Walk through the directory and find all SNBT files
                for entry in WalkDir::new(&quest_root).into_iter() {
                    match entry {
                        Ok(entry) => {
                            let entry_path = entry.path();

                            // Check if the file is an SNBT file and not already translated
                            if entry_path.is_file()
                                && entry_path.extension().is_some_and(|ext| ext == "snbt")
                            {
                                // Skip files that already have language suffixes (e.g., filename.ja_jp.snbt)
                                if let Some(file_name) =
                                    entry_path.file_name().and_then(|n| n.to_str())
                                {
                                    // Pattern to match language suffixes like .ja_jp.snbt, .zh_cn.snbt, etc.
                                    if file_name.contains(".ja_jp.")
                                        || file_name.contains(".zh_cn.")
                                        || file_name.contains(".ko_kr.")
                                        || file_name.contains(".de_de.")
                                        || file_name.contains(".fr_fr.")
                                        || file_name.contains(".es_es.")
                                        || file_name.contains(".it_it.")
                                        || file_name.contains(".pt_br.")
                                        || file_name.contains(".ru_ru.")
                                    {
                                        debug!("Skipping already translated file: {}", file_name);
                                        continue;
                                    }
                                }

                                match entry_path.to_str() {
                                    Some(path_str) => quest_files.push(path_str.to_string()),
                                    None => {
                                        error!(
                                            "Failed to convert SNBT path to string: {}",
                                            entry_path.display()
                                        );
                                        return Err(format!(
                                            "Invalid SNBT path encoding: {}",
                                            entry_path.display()
                                        ));
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            error!("Error reading FTB quests directory entry: {}", e);
                            return Err(format!("Failed to read FTB quests directory: {}", e));
                        }
                    }
                }
            }
        }

        if !quest_dir_found {
            info!("No FTB quests directory found in standard locations");
            return Err("No FTB quests directory found. Checked: config/ftbquests/quests/, config/ftbquests/normal/, and config/ftbquests/".to_string());
        }
    }

    debug!(
        "Found {} FTB quest files using conditional logic",
        quest_files.len()
    );
    Ok(quest_files)
}

/// Get Better Quests files from a directory
#[tauri::command]
pub async fn get_better_quest_files(
    _app_handle: tauri::AppHandle,
    dir: &str,
) -> std::result::Result<Vec<String>, String> {
    info!("Getting Better Quests files from {}", dir);

    let path = Path::new(dir);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }

    let mut quest_files = Vec::new();

    // Check both standard and direct locations for BetterQuesting files
    // 1. Standard location: resources/betterquesting/lang/*.json
    let resources_dir = path.join("resources");
    let better_quests_dir = resources_dir.join("betterquesting").join("lang");

    if better_quests_dir.exists() && better_quests_dir.is_dir() {
        info!(
            "Found Better Quests directory (standard): {}",
            better_quests_dir.display()
        );
        // Walk through the directory and find all JSON files
        for entry in WalkDir::new(better_quests_dir)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let entry_path = entry.path();

            // Check if the file is a JSON file and not already translated
            if entry_path.is_file() && entry_path.extension().is_some_and(|ext| ext == "json") {
                // Skip files that already have language suffixes
                if let Some(file_name) = entry_path.file_name().and_then(|n| n.to_str()) {
                    if file_name.contains(".ja_jp.")
                        || file_name.contains(".zh_cn.")
                        || file_name.contains(".ko_kr.")
                        || file_name.contains(".de_de.")
                        || file_name.contains(".fr_fr.")
                        || file_name.contains(".es_es.")
                        || file_name.contains(".it_it.")
                        || file_name.contains(".pt_br.")
                        || file_name.contains(".ru_ru.")
                    {
                        debug!("Skipping already translated file: {}", file_name);
                        continue;
                    }
                }

                if let Some(path_str) = entry_path.to_str() {
                    quest_files.push(path_str.to_string());
                }
            }
        }
    } else {
        info!(
            "No Better Quests directory found at standard location: {}",
            better_quests_dir.display()
        );
    }

    // 2. Direct location: config/betterquesting/DefaultQuests.lang
    let config_dir = path.join("config");
    let better_questing_config_dir = config_dir.join("betterquesting");
    let default_quests_file = better_questing_config_dir.join("DefaultQuests.lang");

    if default_quests_file.exists() && default_quests_file.is_file() {
        info!(
            "Found DefaultQuests.lang file (direct): {}",
            default_quests_file.display()
        );
        if let Some(path_str) = default_quests_file.to_str() {
            quest_files.push(path_str.to_string());
        }
    } else {
        info!(
            "No DefaultQuests.lang found at direct location: {}",
            default_quests_file.display()
        );
    }

    debug!(
        "Found {} Better Quests files (standard + direct)",
        quest_files.len()
    );
    Ok(quest_files)
}

/// Get files with a specific extension from a directory
#[tauri::command]
pub async fn get_files_with_extension(
    _app_handle: tauri::AppHandle,
    dir: &str,
    extension: &str,
) -> std::result::Result<Vec<String>, String> {
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
        if entry_path.is_file()
            && entry_path
                .extension()
                .is_some_and(|ext| ext.to_string_lossy() == extension.trim_start_matches('.'))
        {
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
pub async fn read_text_file(
    _app_handle: tauri::AppHandle,
    path: &str,
) -> std::result::Result<String, String> {
    info!("Reading text file {}", path);

    let file_path = Path::new(path);
    if !file_path.exists() || !file_path.is_file() {
        return Err(format!("File not found: {}", path));
    }

    // Read the file content using standard Rust file operations
    match std::fs::read_to_string(path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

/// Write a text file
#[tauri::command]
pub async fn write_text_file(
    _app_handle: tauri::AppHandle,
    path: &str,
    content: &str,
) -> std::result::Result<bool, String> {
    info!("Writing text file {}", path);

    let file_path = Path::new(path);

    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            // Create directories using standard Rust file operations
            if let Err(e) = std::fs::create_dir_all(parent) {
                return Err(format!("Failed to create parent directories: {}", e));
            }
        }
    }

    // Write the content using standard Rust file operations
    match std::fs::write(path, content) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Failed to write file: {}", e)),
    }
}

/// Create a directory
#[tauri::command]
pub async fn create_directory(
    _app_handle: tauri::AppHandle,
    path: &str,
) -> std::result::Result<bool, String> {
    info!("Creating directory {}", path);

    // Create the directory and all parent directories using standard Rust file operations
    match std::fs::create_dir_all(path) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Failed to create directory: {}", e)),
    }
}

/// Open a directory dialog using the rfd crate
#[tauri::command]
pub async fn open_directory_dialog(
    _app_handle: tauri::AppHandle,
    title: &str,
) -> std::result::Result<Option<String>, String> {
    info!("RUST: Opening directory dialog with title: {}", title);

    // Use the rfd crate to open a directory selection dialog
    let folder = rfd::FileDialog::new().set_title(title).pick_folder();

    let folder = match folder {
        Some(path) => path,
        None => {
            info!("RUST: No directory selected");
            return Ok(None);
        }
    };

    if let Some(path_str) = folder.to_str() {
        info!("RUST: Selected directory: {}", path_str);
        // Add a prefix to indicate that this is from the native dialog
        let result = format!("NATIVE_DIALOG:{}", path_str);
        info!("RUST: Returning result: {}", result);
        Ok(Some(result))
    } else {
        error!("RUST: Invalid directory path");
        Err("Invalid directory path".to_string())
    }
}

/// Create a resource pack
#[tauri::command]
pub async fn create_resource_pack(
    _app_handle: tauri::AppHandle,
    name: &str,
    language: &str,
    dir: &str,
) -> std::result::Result<String, String> {
    info!(
        "Creating resource pack {} for {} in {}",
        name, language, dir
    );

    let dir_path = Path::new(dir);
    if !dir_path.exists() || !dir_path.is_dir() {
        // Try to create the parent directory if it does not exist
        if let Err(e) = std::fs::create_dir_all(dir_path) {
            return Err(format!(
                "Failed to create parent directory: {} ({})",
                dir, e
            ));
        }
    }

    // Create resource pack directory
    let resource_pack_dir = dir_path.join(name);
    let _resource_pack_dir_str = resource_pack_dir.to_string_lossy().to_string();

    if let Err(e) = std::fs::create_dir_all(&resource_pack_dir) {
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
    let _pack_mcmeta_path_str = pack_mcmeta_path.to_string_lossy().to_string();

    if let Err(e) = std::fs::write(&pack_mcmeta_path, pack_mcmeta_json) {
        return Err(format!("Failed to write pack.mcmeta: {}", e));
    }

    // Create assets directory
    let assets_dir = resource_pack_dir.join("assets");
    let _assets_dir_str = assets_dir.to_string_lossy().to_string();

    if let Err(e) = std::fs::create_dir_all(&assets_dir) {
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
pub async fn write_lang_file(
    _app_handle: tauri::AppHandle,
    mod_id: &str,
    language: &str,
    content: &str,
    dir: &str,
    format: Option<&str>,
) -> std::result::Result<bool, String> {
    info!(
        "Writing lang file for {} in {} to {} with format {:?}",
        mod_id, language, dir, format
    );

    let dir_path = Path::new(dir);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory not found: {}", dir));
    }

    // Create mod assets directory
    let mod_assets_dir = dir_path.join("assets").join(mod_id).join("lang");
    let _mod_assets_dir_str = mod_assets_dir.to_string_lossy().to_string();

    if let Err(e) = std::fs::create_dir_all(&mod_assets_dir) {
        return Err(format!("Failed to create mod assets directory: {}", e));
    }

    // Parse content
    let content_map: HashMap<String, String> = match serde_json::from_str(content) {
        Ok(map) => map,
        Err(e) => return Err(format!("Failed to parse content JSON: {}", e)),
    };

    // Determine file format based on optional parameter, defaulting to json
    let file_format = format.unwrap_or("json");

    match file_format {
        "lang" => {
            // Legacy .lang format: key=value per line
            let mut lines: Vec<String> = content_map
                .iter()
                .map(|(k, v)| format!("{}={}", k, v))
                .collect();
            // Sort lines for consistent output
            lines.sort();
            let lang_content = lines.join("\n");

            // Write language file with .lang extension
            let lang_file_path = mod_assets_dir.join(format!("{}.lang", language));
            let _lang_file_path_str = lang_file_path.to_string_lossy().to_string();

            if let Err(e) = std::fs::write(&lang_file_path, lang_content) {
                return Err(format!("Failed to write language file: {}", e));
            }
        }
        _ => {
            // Default to JSON format
            // Serialize content
            let content_json = match serde_json::to_string_pretty(&content_map) {
                Ok(json) => json,
                Err(e) => return Err(format!("Failed to serialize content: {}", e)),
            };

            // Write language file with .json extension
            let lang_file_path = mod_assets_dir.join(format!("{}.json", language));
            let _lang_file_path_str = lang_file_path.to_string_lossy().to_string();

            if let Err(e) = std::fs::write(&lang_file_path, content_json) {
                return Err(format!("Failed to write language file: {}", e));
            }
        }
    }

    Ok(true)
}

/// Open an external URL in the default browser
#[tauri::command]
pub async fn open_external_url(
    app_handle: tauri::AppHandle,
    url: &str,
) -> std::result::Result<bool, String> {
    info!("Opening external URL: {}", url);

    // Validate URL
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Invalid URL: must start with http:// or https://".to_string());
    }

    // Use Tauri's shell plugin to open the URL
    let shell = app_handle.shell();
    #[allow(deprecated)]
    match shell.open(url, None) {
        Ok(_) => {
            info!("Successfully opened URL: {}", url);
            Ok(true)
        }
        Err(e) => {
            error!("Failed to open URL {}: {}", url, e);
            Err(format!("Failed to open URL: {}", e))
        }
    }
}
