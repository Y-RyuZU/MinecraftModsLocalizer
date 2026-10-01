use log::{debug, error, info};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;
use tauri_plugin_opener::OpenerExt;
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

/// Get mod files from a directory
#[tauri::command]
pub async fn get_mod_files(_app_handle: tauri::AppHandle, dir: &str) -> std::result::Result<Vec<String>, String> {
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
    info!("No mods directory found, using profile directory: {}", path.display());
    path.to_path_buf()
  };

  // Walk through the directory and find all JAR files
  for entry in WalkDir::new(target_dir).max_depth(1).into_iter().filter_map(|e| e.ok()) {
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
pub async fn get_ftb_quest_files(_app_handle: tauri::AppHandle, dir: &str) -> std::result::Result<Vec<String>, String> {
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

  find_ftb_quest_files(&path)
}

fn find_ftb_quest_files(path: &Path) -> std::result::Result<Vec<String>, String> {
  let mut quest_files = Vec::new();

  // Quest-related translations may be shipped as KubeJS assets or a pack's resources tree.
  collect_english_lang_files(&path.join("kubejs").join("assets"), &mut quest_files)?;
  let resources = path.join("resources");
  if resources.is_dir() {
    for entry in WalkDir::new(&resources).into_iter() {
      let entry = entry.map_err(|e| format!("Failed to scan resource languages: {}", e))?;
      let entry_path = entry.path();
      let in_better_quest_namespace = entry_path
        .strip_prefix(&resources)
        .ok()
        .and_then(|relative| relative.components().next())
        .map(|component| {
          component
            .as_os_str()
            .to_string_lossy()
            .eq_ignore_ascii_case("betterquesting")
        })
        .unwrap_or(false);
      if !in_better_quest_namespace && is_english_lang_file(entry_path) {
        quest_files.push(path_string(entry_path, "resource language")?);
      }
    }
  }

  // FTB has legacy inline SNBT, flat locale SNBT, and split locale files.
  // Accept the underscore spelling reported by older packs/issues as well as the current path.
  let config = path.join("config");
  for folder in ["ftbquests", "ftb_quests"] {
    let ftb_quests_dir = config.join(folder).join("quests");
    if !ftb_quests_dir.is_dir() {
      continue;
    }

    let localized_source_dir = ftb_quests_dir.join("lang").join("en_us");
    let localized_source_files = [
      ftb_quests_dir.join("lang").join("en_us.snbt"),
      ftb_quests_dir.join("lang").join("en_us.snbt_merged"),
    ];
    if localized_source_dir.is_dir() {
      for entry in WalkDir::new(&localized_source_dir).into_iter() {
        let entry = entry.map_err(|e| format!("Failed to scan FTB quests: {}", e))?;
        if entry.path().is_file() && is_ftb_snbt_file(entry.path()) {
          quest_files.push(path_string(entry.path(), "FTB quest")?);
        }
      }
    }
    for source_file in localized_source_files {
      if source_file.is_file() {
        quest_files.push(path_string(&source_file, "FTB quest")?);
      }
    }

    // Packs can mix locale files with older quests that still embed text inline.
    // Scan both layouts; extraction filters out SNBT fields that are not translatable.
    for entry in WalkDir::new(&ftb_quests_dir).into_iter() {
      let entry = entry.map_err(|e| format!("Failed to scan FTB quests: {}", e))?;
      let entry_path = entry.path();
      let in_language_tree = entry_path
        .strip_prefix(&ftb_quests_dir)
        .map(|relative| {
          relative.components().any(|component| {
            component
              .as_os_str()
              .to_str()
              .map(|part| part.eq_ignore_ascii_case("lang"))
              .unwrap_or(false)
          })
        })
        .unwrap_or(false);
      if entry_path.is_file() && !in_language_tree && is_ftb_snbt_file(entry_path) {
        quest_files.push(path_string(entry_path, "FTB quest")?);
      }
    }
  }

  quest_files.sort();
  quest_files.dedup();
  debug!(
    "Found {} KubeJS, resource, and FTB quest localization files",
    quest_files.len()
  );
  Ok(quest_files)
}

fn find_better_quest_files(path: &Path) -> std::result::Result<Vec<String>, String> {
  let mut files = Vec::new();
  let language_dir = path.join("resources").join("betterquesting").join("lang");
  if language_dir.is_dir() {
    for entry in WalkDir::new(&language_dir).max_depth(1).into_iter() {
      let entry = entry.map_err(|e| format!("Failed to scan BetterQuesting languages: {}", e))?;
      if entry.path().is_file() && is_english_lang_file(entry.path()) {
        files.push(path_string(entry.path(), "BetterQuesting language")?);
      }
    }
  }

  let config_dir = path.join("config").join("betterquesting");
  let default_lang = config_dir.join("DefaultQuests.lang");
  let default_json = config_dir.join("DefaultQuests.json");
  for candidate in [&default_lang, &default_json] {
    if candidate.is_file() {
      files.push(path_string(candidate, "BetterQuesting default quest")?);
    }
  }
  let default_folder = config_dir.join("DefaultQuests");
  if default_folder.is_dir() {
    for entry in WalkDir::new(&default_folder).into_iter() {
      let entry = entry.map_err(|e| format!("Failed to scan BetterQuesting defaults: {}", e))?;
      if entry.path().is_file()
        && entry
          .path()
          .extension()
          .and_then(|ext| ext.to_str())
          .map(|ext| ext.eq_ignore_ascii_case("json"))
          .unwrap_or(false)
      {
        files.push(path_string(entry.path(), "BetterQuesting default quest")?);
      }
    }
  }
  files.sort();
  files.dedup();
  Ok(files)
}

fn collect_english_lang_files(root: &Path, files: &mut Vec<String>) -> std::result::Result<(), String> {
  if !root.is_dir() {
    return Ok(());
  }
  for entry in WalkDir::new(root).into_iter() {
    let entry = entry.map_err(|e| format!("Failed to scan language files: {}", e))?;
    if is_english_lang_file(entry.path()) {
      files.push(path_string(entry.path(), "language")?);
    }
  }
  Ok(())
}

fn is_english_lang_file(path: &Path) -> bool {
  path.is_file()
    && path
      .parent()
      .and_then(Path::file_name)
      .and_then(|name| name.to_str())
      .map(|name| name.eq_ignore_ascii_case("lang"))
      .unwrap_or(false)
    && path
      .file_name()
      .and_then(|name| name.to_str())
      .map(|name| {
        let name = name.to_ascii_lowercase();
        name == "en_us.json" || name == "en_us.lang"
      })
      .unwrap_or(false)
}

fn path_string(path: &Path, kind: &str) -> std::result::Result<String, String> {
  path
    .to_str()
    .map(str::to_string)
    .ok_or_else(|| format!("Invalid {} path encoding: {}", kind, path.display()))
}

fn is_ftb_snbt_file(path: &Path) -> bool {
  path
    .file_name()
    .and_then(|name| name.to_str())
    .map(|name| {
      let name = name.to_ascii_lowercase();
      name.ends_with(".snbt") || name.ends_with(".snbt_merged")
    })
    .unwrap_or(false)
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

  let files = find_better_quest_files(path)?;
  debug!("Found {} Better Quest language/default files", files.len());
  Ok(files)
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
pub async fn read_text_file(_app_handle: tauri::AppHandle, path: &str) -> std::result::Result<String, String> {
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

/// Check whether a localized output file already exists before writing it.
#[tauri::command]
pub async fn file_exists(_app_handle: tauri::AppHandle, path: &str) -> std::result::Result<bool, String> {
  Ok(Path::new(path).is_file())
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
pub async fn create_directory(_app_handle: tauri::AppHandle, path: &str) -> std::result::Result<bool, String> {
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
    Ok(Some(path_str.to_owned()))
  } else {
    error!("RUST: Invalid directory path");
    Err("Invalid directory path".to_string())
  }
}

/// Open the directory containing a translation output.
#[tauri::command]
pub fn open_output_directory(path: String) -> std::result::Result<(), String> {
  let output = Path::new(&path);
  let directory = if output.is_dir() {
    output
  } else {
    output.parent().ok_or("Output has no parent directory")?
  };
  if !directory.is_dir() {
    return Err("Output directory does not exist".into());
  }
  tauri_plugin_opener::open_path(directory, None::<&str>).map_err(|error| error.to_string())
}

/// Create a resource pack
#[tauri::command]
pub async fn create_resource_pack(
  _app_handle: tauri::AppHandle,
  name: &str,
  language: &str,
  dir: &str,
) -> std::result::Result<String, String> {
  info!("Creating resource pack {} for {} in {}", name, language, dir);

  let minecraft_version = find_minecraft_version(Path::new(dir));
  let pack_manifest = resource_pack_manifest(language, minecraft_version.as_deref())?;

  let dir_path = Path::new(dir);
  if !dir_path.exists() || !dir_path.is_dir() {
    // Try to create the parent directory if it does not exist
    if let Err(e) = std::fs::create_dir_all(dir_path) {
      return Err(format!("Failed to create parent directory: {} ({})", dir, e));
    }
  }

  // Create resource pack directory
  let resource_pack_dir = dir_path.join(name);
  let _resource_pack_dir_str = resource_pack_dir.to_string_lossy().to_string();

  if let Err(e) = std::fs::create_dir_all(&resource_pack_dir) {
    return Err(format!("Failed to create resource pack directory: {}", e));
  }

  // Create pack.mcmeta file
  let pack_mcmeta_json = match serde_json::to_string_pretty(&pack_manifest) {
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
  file_extension: Option<String>,
) -> std::result::Result<bool, String> {
  info!("Writing lang file for {} in {} to {}", mod_id, language, dir);

  let file_extension = file_extension.as_deref().unwrap_or("json");
  let valid_path_part = |value: &str| {
    !value.is_empty()
      && value
        .chars()
        .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit() || "_.-".contains(character))
  };
  if !valid_path_part(mod_id) || !valid_path_part(language) {
    return Err("Invalid resource namespace or language identifier".to_string());
  }
  if !matches!(file_extension, "json" | "lang") {
    return Err("Unsupported language file extension".to_string());
  }

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

  // Write in the source format so legacy Minecraft clients can load the locale.
  let lang_file_path = mod_assets_dir.join(format!("{}.{}", language, file_extension));
  let _lang_file_path_str = lang_file_path.to_string_lossy().to_string();
  let existing_content = if lang_file_path.exists() {
    Some(std::fs::read_to_string(&lang_file_path).map_err(|e| format!("Failed to read existing language file: {}", e))?)
  } else {
    None
  };
  let serialized = match file_extension {
    "json" => {
      let content_map: HashMap<String, Value> =
        serde_json::from_str(content).map_err(|e| format!("Failed to parse content JSON: {}", e))?;
      merge_json_language_content(existing_content.as_deref(), content_map)?
    }
    "lang" => {
      let content_map: HashMap<String, String> =
        serde_json::from_str(content).map_err(|e| format!("Failed to parse content JSON: {}", e))?;
      merge_language_content(existing_content.as_deref(), content_map, file_extension)?
    }
    _ => return Err("Unsupported language file extension".to_string()),
  };

  if existing_content.as_deref() == Some(serialized.as_str()) {
    return Ok(true);
  }
  if existing_content.is_some() {
    backup_existing_locale(&lang_file_path).map_err(|e| format!("Failed to back up existing language file: {}", e))?;
  }

  if let Err(e) = std::fs::write(&lang_file_path, serialized) {
    return Err(format!("Failed to write language file: {}", e));
  }

  Ok(true)
}

fn backup_existing_locale(path: &Path) -> std::io::Result<()> {
  let backup_path = path.with_file_name(format!(
    "{}.mml-original.bak",
    path.file_name().unwrap_or_default().to_string_lossy()
  ));
  if !backup_path.exists() {
    std::fs::copy(path, backup_path)?;
  }
  Ok(())
}

/// Open an external URL in the default browser
#[tauri::command]
pub async fn open_external_url(app_handle: tauri::AppHandle, url: &str) -> std::result::Result<bool, String> {
  info!("Opening external URL: {}", url);

  // Validate URL
  if !url.starts_with("http://") && !url.starts_with("https://") {
    return Err("Invalid URL: must start with http:// or https://".to_string());
  }

  // Use Tauri's opener plugin to open the URL
  match app_handle.opener().open_url(url, None::<&str>) {
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

fn find_minecraft_version(directory: &Path) -> Option<String> {
  for ancestor in directory.ancestors() {
    let manifest_path = ancestor.join("mmc-pack.json");
    let Ok(manifest) = std::fs::read_to_string(manifest_path) else {
      continue;
    };
    let Ok(manifest): std::result::Result<Value, _> = serde_json::from_str(&manifest) else {
      continue;
    };
    let Some(components) = manifest.get("components").and_then(Value::as_array) else {
      continue;
    };
    if let Some(version) = components.iter().find_map(|component| {
      (component.get("uid").and_then(Value::as_str) == Some("net.minecraft"))
        .then(|| component.get("version").and_then(Value::as_str))
        .flatten()
    }) {
      return Some(version.to_string());
    }
  }
  None
}

fn resource_pack_manifest(language: &str, minecraft_version: Option<&str>) -> Result<Value, String> {
  let description = format!("Translated resources for {}", language);
  let Some(version) = minecraft_version else {
    return Ok(json!({"pack": {"description": description, "pack_format": 34}}));
  };
  let legacy_format = match version {
    "1.8" => Some(1),
    "1.12.2" => Some(3),
    "1.18.2" => Some(8),
    "1.20.1" => Some(15),
    "1.21.1" => Some(34),
    "1.21.4" => Some(46),
    "1.21.5" => Some(55),
    "1.21.6" => Some(63),
    "1.21.7" | "1.21.8" => Some(64),
    _ => None,
  };
  if let Some(pack_format) = legacy_format {
    return Ok(json!({"pack": {"description": description, "pack_format": pack_format}}));
  }
  let modern_format = match version {
    "1.21.9" => Some(69),
    "1.21.11" => Some(75),
    _ => None,
  };
  if let Some(format) = modern_format {
    return Ok(json!({
        "pack": {
            "description": description,
            "min_format": [format, 0],
            "max_format": [format, 0]
        }
    }));
  }
  Err(format!(
    "Minecraft {version} is not yet supported for resource pack metadata"
  ))
}

fn serialize_legacy_lang(content: &HashMap<String, String>) -> String {
  let mut entries: Vec<_> = content.iter().collect();
  entries.sort_by(|left, right| left.0.cmp(right.0));
  entries
    .into_iter()
    .map(|(key, value)| {
      format!(
        "{}={}\n",
        escape_legacy_lang_property(key, true),
        escape_legacy_lang_property(value, false)
      )
    })
    .collect()
}

fn merge_language_content(
  existing_content: Option<&str>,
  new_content: HashMap<String, String>,
  file_extension: &str,
) -> std::result::Result<String, String> {
  let mut merged = match (existing_content, file_extension) {
    (Some(existing), "json") => {
      return merge_json_language_content(
        Some(existing),
        new_content
          .into_iter()
          .map(|(key, value)| (key, Value::String(value)))
          .collect(),
      );
    }
    (Some(existing), "lang") => parse_legacy_lang(existing)?,
    (Some(_), _) => return Err("Unsupported language file extension".to_string()),
    (None, _) => HashMap::new(),
  };

  // Different mods can use the same resource namespace. Preserve their
  // existing entries while letting the current translation replace collisions.
  merged.extend(new_content);

  match file_extension {
    "json" => merge_json_language_content(
      None,
      merged
        .into_iter()
        .map(|(key, value)| (key, Value::String(value)))
        .collect(),
    ),
    "lang" => Ok(serialize_legacy_lang(&merged)),
    _ => Err("Unsupported language file extension".to_string()),
  }
}

fn merge_json_language_content(
  existing_content: Option<&str>,
  new_content: HashMap<String, Value>,
) -> std::result::Result<String, String> {
  let mut merged = match existing_content {
    Some(existing) => serde_json::from_str::<HashMap<String, Value>>(existing)
      .map_err(|e| format!("Failed to parse existing JSON language file: {}", e))?,
    None => HashMap::new(),
  };
  merged.extend(new_content);
  serde_json::to_string_pretty(&merged).map_err(|e| format!("Failed to serialize content: {}", e))
}

fn parse_legacy_lang(content: &str) -> std::result::Result<HashMap<String, String>, String> {
  let mut parsed = HashMap::new();
  for (line_number, line) in content.lines().enumerate() {
    let trimmed = line.trim_start();
    if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('!') {
      continue;
    }

    let mut escaped = false;
    let separator = line
      .char_indices()
      .find_map(|(index, character)| {
        if character == '=' && !escaped {
          return Some(index);
        }
        if character == '\\' {
          escaped = !escaped;
        } else {
          escaped = false;
        }
        None
      })
      .ok_or_else(|| format!("Invalid .lang entry on line {}", line_number + 1))?;

    let key = unescape_legacy_lang_property(&line[..separator])?;
    let value = unescape_legacy_lang_property(&line[separator + 1..])?;
    parsed.insert(key, value);
  }
  Ok(parsed)
}

fn unescape_legacy_lang_property(value: &str) -> std::result::Result<String, String> {
  let mut chars = value.chars();
  let mut unescaped = String::with_capacity(value.len());
  while let Some(character) = chars.next() {
    if character != '\\' {
      unescaped.push(character);
      continue;
    }

    match chars.next() {
      Some('n') => unescaped.push('\n'),
      Some('r') => unescaped.push('\r'),
      Some('t') => unescaped.push('\t'),
      Some('f') => unescaped.push('\u{000C}'),
      Some('u') => {
        let digits: String = chars.by_ref().take(4).collect();
        if digits.len() != 4 {
          return Err("Invalid Unicode escape in existing .lang file".to_string());
        }
        let code_point =
          u32::from_str_radix(&digits, 16).map_err(|_| "Invalid Unicode escape in existing .lang file".to_string())?;
        let decoded =
          char::from_u32(code_point).ok_or_else(|| "Invalid Unicode escape in existing .lang file".to_string())?;
        unescaped.push(decoded);
      }
      Some(escaped) => unescaped.push(escaped),
      None => unescaped.push('\\'),
    }
  }
  Ok(unescaped)
}

fn escape_legacy_lang_property(value: &str, is_key: bool) -> String {
  let mut escaped = String::with_capacity(value.len());
  let mut leading = true;
  for character in value.chars() {
    match character {
      '\\' => escaped.push_str("\\\\"),
      '\t' => escaped.push_str("\\t"),
      '\n' => escaped.push_str("\\n"),
      '\r' => escaped.push_str("\\r"),
      '\u{000C}' => escaped.push_str("\\f"),
      ' ' if is_key || leading => escaped.push_str("\\ "),
      '=' | ':' | '#' | '!' if is_key => {
        escaped.push('\\');
        escaped.push(character);
      }
      _ => escaped.push(character),
    }
    if character != ' ' {
      leading = false;
    }
  }
  escaped
}

#[cfg(test)]
mod quest_scan_tests {
  use super::{find_better_quest_files, find_ftb_quest_files};
  use std::fs;
  use std::path::{Path, PathBuf};
  use std::time::{SystemTime, UNIX_EPOCH};

  fn temp_root(label: &str) -> PathBuf {
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    std::env::temp_dir().join(format!("mml-{label}-{}-{nonce}", std::process::id()))
  }

  fn write_fixture(root: &Path, relative: &str) -> PathBuf {
    let path = root.join(relative);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, "{}").unwrap();
    path
  }

  fn normalized(path: &Path) -> String {
    fs::canonicalize(path).unwrap().to_string_lossy().to_string()
  }

  #[test]
  fn scans_inline_flat_split_merged_and_modpack_resource_locale_patterns() {
    let root = temp_root("quest-scan");
    let compact_machines = write_fixture(&root, "kubejs/assets/compactmachines/lang/en_us.json");
    let occultism = write_fixture(&root, "kubejs/assets/occultism/lang/en_us.lang");
    write_fixture(&root, "kubejs/assets/occultism/lang/ja_jp.json");
    let ftb = write_fixture(&root, "config/ftbquests/quests/lang/en_us/chapter.snbt");
    let merged = write_fixture(&root, "config/ftbquests/quests/lang/en_us/chapter.snbt_merged");
    let flat = write_fixture(&root, "config/ftbquests/quests/lang/en_us.snbt");
    let flat_merged = write_fixture(&root, "config/ftbquests/quests/lang/en_us.snbt_merged");
    write_fixture(&root, "config/ftbquests/quests/lang/ja_jp/chapter.snbt");
    write_fixture(&root, "config/ftbquests/quests/lang/ja_jp.snbt");
    let inline = write_fixture(&root, "config/ftb_quests/quests/chapters/main.snbt");
    let mixed_inline = write_fixture(&root, "config/ftbquests/quests/chapters/legacy_inline.snbt");
    let create_astral = write_fixture(&root, "resources/createastral/lang/en_us.json");
    let generic_lang = write_fixture(&root, "resources/packnamespace/lang/en_US.lang");
    write_fixture(&root, "resources/betterquesting/lang/en_us.lang");

    let found = find_ftb_quest_files(&root).unwrap();
    let expected = [
      normalized(&compact_machines),
      normalized(&occultism),
      normalized(&ftb),
      normalized(&merged),
      normalized(&flat),
      normalized(&flat_merged),
      normalized(&inline),
      normalized(&mixed_inline),
      normalized(&create_astral),
      normalized(&generic_lang),
    ];
    assert_eq!(found.len(), expected.len());
    for path in expected {
      assert!(
        found.iter().any(|found_path| normalized(Path::new(found_path)) == path),
        "missing expected source: {path}"
      );
    }
    fs::remove_dir_all(root).unwrap();
  }

  #[test]
  fn scans_betterquesting_language_assets_and_direct_default_data() {
    let root = temp_root("better-quest-scan");
    let lang_json = write_fixture(&root, "resources/betterquesting/lang/en_us.json");
    let lang_properties = write_fixture(&root, "resources/betterquesting/lang/en_US.lang");
    let default_properties = write_fixture(&root, "config/betterquesting/DefaultQuests.lang");
    let default_json = write_fixture(&root, "config/betterquesting/DefaultQuests.json");
    let quest_json = write_fixture(&root, "config/betterquesting/DefaultQuests/Quests/chapter/quest.json");
    write_fixture(&root, "resources/betterquesting/lang/ja_jp.lang");

    let found = find_better_quest_files(&root).unwrap();
    let expected = [lang_json, lang_properties, default_properties, default_json, quest_json];
    assert_eq!(found.len(), expected.len());
    for path in expected {
      assert!(found
        .iter()
        .any(|found_path| normalized(Path::new(found_path)) == normalized(&path)));
    }
    fs::remove_dir_all(root).unwrap();
  }

  #[test]
  fn legacy_ftb_scan_does_not_select_existing_language_files() {
    let root = temp_root("legacy-quest-scan");
    let source = write_fixture(&root, "config/ftbquests/quests/chapters/main.snbt");
    let merged = write_fixture(&root, "config/ftbquests/quests/chapters/main.snbt_merged");
    write_fixture(&root, "config/ftbquests/quests/lang/ja_jp/chapters/main.snbt");

    let found = find_ftb_quest_files(&root).unwrap();
    assert_eq!(found.len(), 2);
    assert!(found
      .iter()
      .any(|path| normalized(Path::new(path)) == normalized(&source)));
    assert!(found
      .iter()
      .any(|path| normalized(Path::new(path)) == normalized(&merged)));
    fs::remove_dir_all(root).unwrap();
  }
}

#[cfg(test)]
mod output_format_tests {
  use super::{
    backup_existing_locale, find_minecraft_version, merge_json_language_content, merge_language_content,
    parse_legacy_lang, resource_pack_manifest, serialize_legacy_lang,
  };
  use serde_json::Value;
  use std::collections::HashMap;
  use std::fs;
  use std::time::{SystemTime, UNIX_EPOCH};

  #[test]
  fn legacy_language_output_escapes_java_properties_values() {
    let source = HashMap::from([
      ("another.key".to_string(), "C:\\temp".to_string()),
      ("mod.key".to_string(), "line 1\nline 2".to_string()),
    ]);
    assert_eq!(
      serialize_legacy_lang(&source),
      "another.key=C:\\\\temp\nmod.key=line 1\\nline 2\n"
    );
  }

  #[test]
  fn merges_json_translations_without_dropping_other_mod_keys() {
    let existing = r#"{"shared.key":"old value","other.mod.key":"preserve"}"#;
    let new = HashMap::from([
      ("shared.key".to_string(), "new value".to_string()),
      ("new.mod.key".to_string(), "added".to_string()),
    ]);

    let serialized = merge_language_content(Some(existing), new, "json").unwrap();
    let merged: HashMap<String, String> = serde_json::from_str(&serialized).unwrap();

    assert_eq!(merged.get("shared.key").unwrap(), "new value");
    assert_eq!(merged.get("other.mod.key").unwrap(), "preserve");
    assert_eq!(merged.get("new.mod.key").unwrap(), "added");
  }

  #[test]
  fn merges_rich_text_json_values_without_flattening_their_structure() {
    let existing = r#"{"existing.key":"preserve"}"#;
    let new = HashMap::from([(
      "owo.component".to_string(),
      serde_json::json!([{"text":"Enabled","color":"gray"}, {"index":0}]),
    )]);

    let serialized = merge_json_language_content(Some(existing), new).unwrap();
    let merged: HashMap<String, Value> = serde_json::from_str(&serialized).unwrap();

    assert_eq!(merged["existing.key"], Value::String("preserve".to_string()));
    assert_eq!(merged["owo.component"][0]["text"], Value::String("Enabled".to_string()));
    assert_eq!(merged["owo.component"][0]["color"], Value::String("gray".to_string()));
    assert_eq!(merged["owo.component"][1]["index"], Value::from(0));
  }

  #[test]
  fn merges_legacy_language_files_and_preserves_escaped_values() {
    let existing = "shared.key=old value\npath=C:\\\\temp\n";
    let new = HashMap::from([
      ("shared.key".to_string(), "new value".to_string()),
      ("new.key".to_string(), "added".to_string()),
    ]);

    let serialized = merge_language_content(Some(existing), new, "lang").unwrap();
    let merged = parse_legacy_lang(&serialized).unwrap();

    assert_eq!(merged.get("shared.key").unwrap(), "new value");
    assert_eq!(merged.get("path").unwrap(), "C:\\temp");
    assert_eq!(merged.get("new.key").unwrap(), "added");
  }

  #[test]
  fn backs_up_existing_locale_once_before_replacement() {
    let root = std::env::temp_dir().join(format!(
      "mml-locale-backup-{}",
      SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();
    let locale = root.join("ja_jp.json");
    let backup = root.join("ja_jp.json.mml-original.bak");
    fs::write(&locale, "original locale").unwrap();

    backup_existing_locale(&locale).unwrap();
    assert_eq!(fs::read_to_string(&backup).unwrap(), "original locale");
    fs::write(&locale, "first replacement").unwrap();
    backup_existing_locale(&locale).unwrap();
    assert_eq!(fs::read_to_string(&backup).unwrap(), "original locale");

    fs::remove_dir_all(root).unwrap();
  }

  #[test]
  fn emits_resource_pack_metadata_for_the_installed_instance_version() {
    for (version, format) in [
      ("1.8", 1),
      ("1.12.2", 3),
      ("1.18.2", 8),
      ("1.20.1", 15),
      ("1.21.1", 34),
      ("1.21.4", 46),
      ("1.21.5", 55),
      ("1.21.8", 64),
    ] {
      assert_eq!(
        resource_pack_manifest("ja_jp", Some(version)).unwrap()["pack"]["pack_format"],
        format
      );
    }
    for (version, format) in [("1.21.9", 69), ("1.21.11", 75)] {
      let current = resource_pack_manifest("ja_jp", Some(version)).unwrap();
      assert_eq!(current["pack"]["min_format"], serde_json::json!([format, 0]));
      assert_eq!(current["pack"]["max_format"], serde_json::json!([format, 0]));
      assert!(current["pack"].get("pack_format").is_none());
    }
    assert!(resource_pack_manifest("ja_jp", Some("1.21.10")).is_err());
  }

  #[test]
  fn detects_the_prism_minecraft_version_from_an_ancestor_manifest() {
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let root = std::env::temp_dir().join(format!("mml-prism-version-{}-{nonce}", std::process::id()));
    let resourcepacks = root.join("minecraft").join("resourcepacks");
    fs::create_dir_all(&resourcepacks).unwrap();
    fs::write(
      root.join("mmc-pack.json"),
      r#"{"components":[{"uid":"net.minecraft","version":"1.12.2"}]}"#,
    )
    .unwrap();

    assert_eq!(find_minecraft_version(&resourcepacks), Some("1.12.2".to_string()));
    fs::remove_dir_all(root).unwrap();
  }
}

pub fn sort_json_object(value: &serde_json::Value) -> serde_json::Value {
  match value {
    serde_json::Value::Object(map) => {
      let mut sorted_map = serde_json::Map::new();
      let mut keys: Vec<_> = map.keys().collect();
      keys.sort();
      for key in keys {
        sorted_map.insert(key.clone(), sort_json_object(&map[key]));
      }
      serde_json::Value::Object(sorted_map)
    }
    serde_json::Value::Array(arr) => {
      let sorted_arr: Vec<_> = arr.iter().map(sort_json_object).collect();
      serde_json::Value::Array(sorted_arr)
    }
    _ => value.clone(),
  }
}

/// Serialize a value to JSON with sorted keys
pub fn serialize_json_sorted<T: serde::Serialize>(value: &T) -> Result<String, serde_json::Error> {
  let json_value = serde_json::to_value(value)?;
  let sorted_json = sort_json_object(&json_value);
  serde_json::to_string_pretty(&sorted_json)
}
