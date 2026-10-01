use log::{debug, error};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use zip::ZipArchive;

/// Minecraft file handling errors
#[derive(Error, Debug)]
pub enum MinecraftError {
  #[error("IO error: {0}")]
  Io(#[from] io::Error),

  #[error("ZIP error: {0}")]
  Zip(#[from] zip::result::ZipError),

  #[error("JSON error: {0}")]
  Json(#[from] serde_json::Error),

  #[error("Path error: {0}")]
  Path(String),

  #[error("Mod error: {0}")]
  Mod(String),

  #[error("Lang file error: {0}")]
  LangFile(String),

  #[error("Patchouli error: {0}")]
  Patchouli(String),
}

// Type alias for internal Result with MinecraftError
type Result<T, E = MinecraftError> = std::result::Result<T, E>;

/// Mod information
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModInfo {
  /// Mod ID
  pub id: String,

  /// Mod name
  pub name: String,

  /// Mod version
  pub version: String,

  /// Path to the mod JAR file
  pub jar_path: String,

  /// Language files in the mod
  pub lang_files: Vec<LangFile>,

  /// Language codes already present in the mod archive
  pub available_languages: Vec<String>,

  /// Languages present in each namespace that contains an English language file
  pub available_languages_by_namespace: HashMap<String, Vec<String>>,

  /// Languages present for each English asset namespace and language-file format
  pub available_languages_by_namespace_and_format: HashMap<String, HashMap<String, Vec<String>>>,

  /// Patchouli books in the mod
  pub patchouli_books: Vec<PatchouliBook>,
}

/// Language file
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LangFile {
  /// Language code (e.g., "en_us")
  pub language: String,

  /// Path to the file within the JAR
  pub path: String,

  /// Content of the file
  pub content: HashMap<String, String>,

  /// Original non-string JSON values that contain translatable text components.
  #[serde(default, skip_serializing_if = "HashMap::is_empty")]
  pub structured_content: HashMap<String, Value>,
}

/// Patchouli book
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PatchouliBook {
  /// Book ID
  pub id: String,

  /// Mod ID
  pub mod_id: String,

  /// Book name
  pub name: String,

  /// Path to the book directory within the JAR
  pub path: String,

  /// Language files in the book
  pub lang_files: Vec<LangFile>,

  /// Language codes already present in this book
  pub available_languages: Vec<String>,
}

/// Analyze a mod JAR file
#[tauri::command]
pub fn analyze_mod_jar(jar_path: &str) -> std::result::Result<ModInfo, String> {
  let jar_path = PathBuf::from(jar_path);

  // Open the JAR file
  let file = match File::open(&jar_path) {
    Ok(f) => f,
    Err(e) => return Err(e.to_string()),
  };

  let mut archive = match ZipArchive::new(file) {
    Ok(a) => a,
    Err(e) => return Err(e.to_string()),
  };

  // Extract mod ID and name from fabric.mod.json or mods.toml
  let (mod_id, mod_name, mod_version) = match extract_mod_info(&mut archive) {
    Ok(info) => info,
    Err(e) => return Err(e.to_string()),
  };

  let available_languages = match get_available_languages(&mut archive) {
    Ok(languages) => languages,
    Err(e) => return Err(e.to_string()),
  };

  let available_languages_by_namespace = match get_available_languages_by_namespace(&mut archive) {
    Ok(languages) => languages,
    Err(e) => return Err(e.to_string()),
  };

  let available_languages_by_namespace_and_format = match get_available_languages_by_namespace_and_format(&mut archive)
  {
    Ok(languages) => languages,
    Err(e) => return Err(e.to_string()),
  };

  // Extract language files (defaulting to en_us)
  let lang_files = match extract_lang_files_from_archive(&mut archive, &mod_id, "en_us") {
    Ok(files) => files,
    Err(e) => return Err(e.to_string()),
  };

  // Extract Patchouli books
  let patchouli_books = match extract_patchouli_books_from_archive(&mut archive, &mod_id) {
    Ok(books) => books,
    Err(e) => return Err(e.to_string()),
  };

  // Create ModInfo
  let mod_info = ModInfo {
    id: mod_id,
    name: mod_name,
    version: mod_version,
    jar_path: jar_path.to_string_lossy().to_string(),
    lang_files,
    available_languages,
    available_languages_by_namespace,
    available_languages_by_namespace_and_format,
    patchouli_books,
  };

  Ok(mod_info)
}

/// List language codes without loading or returning every localized file's content.
fn get_available_languages(archive: &mut ZipArchive<File>) -> Result<Vec<String>> {
  let mut languages = HashSet::new();
  for index in 0..archive.len() {
    let file = archive.by_index(index)?;
    let path = file.name();
    let parts: Vec<&str> = path.split('/').collect();
    let Some(lang_index) = parts.iter().position(|part| *part == "lang") else {
      continue;
    };
    if lang_index != 0 && parts.first().copied() != Some("assets") {
      continue;
    }
    let Some(filename) = parts.get(lang_index + 1) else {
      continue;
    };
    let Some((language, extension)) = filename.rsplit_once('.') else {
      continue;
    };
    if matches!(extension.to_ascii_lowercase().as_str(), "json" | "lang") {
      languages.insert(language.to_ascii_lowercase());
    }
  }
  let mut languages: Vec<String> = languages.into_iter().collect();
  languages.sort();
  Ok(languages)
}

fn get_available_languages_by_namespace(archive: &mut ZipArchive<File>) -> Result<HashMap<String, Vec<String>>> {
  let by_format = get_available_languages_by_namespace_and_format(archive)?;
  Ok(
    by_format
      .into_iter()
      .map(|(namespace, formats)| {
        let mut languages = HashSet::new();
        for format_languages in formats.into_values() {
          languages.extend(format_languages);
        }
        let mut languages: Vec<_> = languages.into_iter().collect();
        languages.sort();
        (namespace, languages)
      })
      .collect(),
  )
}

fn get_available_languages_by_namespace_and_format(
  archive: &mut ZipArchive<File>,
) -> Result<HashMap<String, HashMap<String, Vec<String>>>> {
  let mut languages: HashMap<String, HashMap<String, HashSet<String>>> = HashMap::new();
  for index in 0..archive.len() {
    let file = archive.by_index(index)?;
    let mut parts = file.name().split('/');
    if parts.position(|part| part == "assets").is_none() {
      continue;
    }
    let Some(namespace) = parts.next() else { continue };
    if parts.next() != Some("lang") {
      continue;
    }
    let Some(filename) = parts.next() else { continue };
    if parts.next().is_some() {
      continue;
    }
    let Some((language, extension)) = filename.rsplit_once('.') else {
      continue;
    };
    if !matches!(extension.to_ascii_lowercase().as_str(), "json" | "lang") {
      continue;
    }
    languages
      .entry(namespace.to_string())
      .or_default()
      .entry(extension.to_ascii_lowercase())
      .or_default()
      .insert(language.to_ascii_lowercase());
  }

  Ok(
    languages
      .into_iter()
      .filter_map(|(namespace, formats)| {
        let english_formats: HashMap<_, _> = formats
          .into_iter()
          .filter(|(_, available)| available.contains("en_us"))
          .map(|(extension, available)| {
            let mut available: Vec<_> = available.into_iter().collect();
            available.sort();
            (extension, available)
          })
          .collect();
        (!english_formats.is_empty()).then_some((namespace, english_formats))
      })
      .collect(),
  )
}

/// Extract language files from a mod JAR
#[tauri::command]
pub fn extract_lang_files(jar_path: &str, _temp_dir: &str) -> std::result::Result<Vec<LangFile>, String> {
  let jar_path = PathBuf::from(jar_path);

  // Open the JAR file
  let file = match File::open(&jar_path) {
    Ok(f) => f,
    Err(e) => return Err(e.to_string()),
  };

  let mut archive = match ZipArchive::new(file) {
    Ok(a) => a,
    Err(e) => return Err(e.to_string()),
  };

  // Extract mod ID from fabric.mod.json or mods.toml
  let (mod_id, _, _) = match extract_mod_info(&mut archive) {
    Ok(info) => info,
    Err(e) => return Err(e.to_string()),
  };

  // Extract language files (defaulting to en_us)
  let lang_files = match extract_lang_files_from_archive(&mut archive, &mod_id, "en_us") {
    Ok(files) => files,
    Err(e) => return Err(e.to_string()),
  };

  Ok(lang_files)
}

/// Extract Patchouli books from a mod JAR
#[tauri::command]
pub fn extract_patchouli_books(
  jar_path: &str,
  _temp_dir: &str,
  logger: tauri::State<std::sync::Arc<crate::logging::AppLogger>>,
) -> std::result::Result<Vec<PatchouliBook>, String> {
  logger.info(
    &format!("Starting Patchouli book extraction from: {}", jar_path),
    Some("GUIDEBOOK_SCAN"),
  );

  let jar_path = PathBuf::from(jar_path);

  // Open the JAR file
  let file = match File::open(&jar_path) {
    Ok(f) => f,
    Err(e) => {
      logger.error(
        &format!("Failed to open JAR file {}: {}", jar_path.display(), e),
        Some("GUIDEBOOK_SCAN"),
      );
      return Err(format!("Failed to open JAR file: {}", e));
    }
  };

  let mut archive = match ZipArchive::new(file) {
    Ok(a) => a,
    Err(e) => {
      logger.error(
        &format!("Failed to read JAR {} as ZIP: {}", jar_path.display(), e),
        Some("GUIDEBOOK_SCAN"),
      );
      return Err(format!("Failed to read JAR as ZIP: {}", e));
    }
  };

  // Extract mod ID from fabric.mod.json or mods.toml
  let (mod_id, _mod_name, _) = match extract_mod_info(&mut archive) {
    Ok(info) => {
      logger.debug(
        &format!("Extracted mod info: id={}, name={}", info.0, info.1),
        Some("GUIDEBOOK_SCAN"),
      );
      info
    }
    Err(e) => {
      logger.error(
        &format!("Failed to extract mod info from {}: {}", jar_path.display(), e),
        Some("GUIDEBOOK_SCAN"),
      );
      return Err(format!("Failed to extract mod info: {}", e));
    }
  };

  // Extract Patchouli books
  let patchouli_books = match extract_patchouli_books_from_archive(&mut archive, &mod_id) {
    Ok(books) => {
      logger.info(
        &format!("Found {} Patchouli books in {}", books.len(), jar_path.display()),
        Some("GUIDEBOOK_SCAN"),
      );
      books
    }
    Err(e) => {
      logger.error(
        &format!("Failed to extract Patchouli books from {}: {}", jar_path.display(), e),
        Some("GUIDEBOOK_SCAN"),
      );
      return Err(format!("Failed to extract Patchouli books: {}", e));
    }
  };

  Ok(patchouli_books)
}

/// Write a Patchouli book to a mod JAR
#[tauri::command]
pub fn write_patchouli_book(
  jar_path: &str,
  book_id: &str,
  mod_id: &str,
  language: &str,
  source_paths: Vec<String>,
  content: &str,
) -> std::result::Result<bool, String> {
  let jar_path = PathBuf::from(jar_path);
  let content_map = serde_json::from_str::<HashMap<String, String>>(content)
    .map_err(|e| format!("Failed to parse content JSON: {e}"))?;
  write_patchouli_translation(&jar_path, book_id, mod_id, language, &source_paths, &content_map)
    .map_err(|e| e.to_string())
}

fn write_patchouli_translation(
  jar_path: &PathBuf,
  book_id: &str,
  mod_id: &str,
  language: &str,
  source_paths: &[String],
  content_map: &HashMap<String, String>,
) -> Result<bool> {
  if !is_safe_path_segment(mod_id) || !is_safe_path_segment(book_id) || !is_safe_path_segment(language) {
    return Err(MinecraftError::Patchouli(
      "Invalid mod, book, or language identifier".into(),
    ));
  }
  if source_paths.is_empty() {
    return Err(MinecraftError::Patchouli(
      "No Patchouli source files were supplied".into(),
    ));
  }
  let source_prefix = format!("assets/{mod_id}/patchouli_books/{book_id}/en_us/");
  let mut source_archive = ZipArchive::new(File::open(jar_path)?)?;
  let mut source_jsons = Vec::new();
  let mut expected_content = HashMap::new();
  let mut target_paths = HashSet::new();
  for (index, source_path) in source_paths.iter().enumerate() {
    let relative_path = source_path
      .strip_prefix(&source_prefix)
      .ok_or_else(|| MinecraftError::Patchouli("Source path is outside the selected English book".into()))?;
    if relative_path.is_empty()
      || relative_path
        .split('/')
        .any(|part| part.is_empty() || part == "." || part == "..")
      || !relative_path.ends_with(".json")
    {
      return Err(MinecraftError::Patchouli("Invalid Patchouli source file path".into()));
    }
    let target_path = format!("assets/{mod_id}/patchouli_books/{book_id}/{language}/{relative_path}");
    if !target_paths.insert(target_path.clone()) {
      return Err(MinecraftError::Patchouli("Duplicate Patchouli source path".into()));
    }

    let mut source_file = source_archive
      .by_name(source_path)
      .map_err(|e| MinecraftError::Patchouli(format!("English source file is missing: {e}")))?;
    let mut source_bytes = Vec::new();
    source_file.read_to_end(&mut source_bytes)?;
    drop(source_file);
    let source_json = relaxed_json_parse(&String::from_utf8_lossy(&source_bytes))?;
    let mut file_content = HashMap::new();
    collect_patchouli_text(&source_json, "", &mut file_content);
    let key_prefix = format!("file_{index}::");
    expected_content.extend(
      file_content
        .into_iter()
        .map(|(key, value)| (format!("{key_prefix}{key}"), value)),
    );
    source_jsons.push((target_path, source_json));
  }

  let missing: Vec<_> = expected_content
    .keys()
    .filter(|key| !content_map.contains_key(*key))
    .cloned()
    .collect();
  let extra: Vec<_> = content_map
    .keys()
    .filter(|key| !expected_content.contains_key(*key))
    .cloned()
    .collect();
  if !missing.is_empty() || !extra.is_empty() {
    return Err(MinecraftError::Patchouli(format!(
      "Translation key mismatch (missing: {}; extra: {})",
      missing.join(", "),
      extra.join(", ")
    )));
  }

  let mut localized_files = Vec::with_capacity(source_jsons.len());
  for (index, (target_path, source_json)) in source_jsons.into_iter().enumerate() {
    let key_prefix = format!("file_{index}::");
    let file_translations = content_map
      .iter()
      .filter_map(|(key, value)| {
        key
          .strip_prefix(&key_prefix)
          .map(|pointer| (pointer.to_string(), value.clone()))
      })
      .collect();
    let localized_json = apply_patchouli_translations(&source_json, &file_translations)?;
    localized_files.push((target_path, serde_json::to_vec_pretty(&localized_json)?));
  }

  let nonce = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_nanos();
  let temp_path = jar_path.with_file_name(format!(
    "{}.mml-{nonce}.tmp",
    jar_path.file_name().unwrap_or_default().to_string_lossy()
  ));
  let temp_file = fs::OpenOptions::new().write(true).create_new(true).open(&temp_path)?;
  let mut output_archive = zip::ZipWriter::new(temp_file);
  let mut original_archive = ZipArchive::new(File::open(jar_path)?)?;
  for index in 0..original_archive.len() {
    let entry = original_archive.by_index(index)?;
    let name = entry.name().to_string();
    if target_paths.contains(&name) || is_jar_signature_file(&name) {
      continue;
    }
    output_archive.raw_copy_file(entry)?;
  }
  for (target_path, localized_bytes) in localized_files {
    output_archive.start_file(
      target_path,
      zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated),
    )?;
    output_archive.write_all(&localized_bytes)?;
  }
  output_archive.finish()?.sync_all()?;

  let backup_path = jar_path.with_file_name(format!(
    "{}.mml-original.bak",
    jar_path.file_name().unwrap_or_default().to_string_lossy()
  ));
  if !backup_path.exists() {
    fs::copy(jar_path, &backup_path)?;
  }
  let staging_path = jar_path.with_file_name(format!(
    "{}.mml-{nonce}.bak",
    jar_path.file_name().unwrap_or_default().to_string_lossy()
  ));
  fs::rename(jar_path, &staging_path)?;
  if let Err(error) = fs::rename(&temp_path, jar_path) {
    if let Err(restore_error) = fs::rename(&staging_path, jar_path) {
      return Err(MinecraftError::Patchouli(format!(
        "Could not install translated JAR ({error}); original is recoverable at {} ({restore_error})",
        staging_path.display()
      )));
    }
    let _ = fs::remove_file(&temp_path);
    return Err(MinecraftError::Io(error));
  }
  fs::remove_file(staging_path)?;
  Ok(true)
}

fn is_safe_path_segment(value: &str) -> bool {
  !value.is_empty() && value != "." && value != ".." && !value.contains('/') && !value.contains('\\')
}

fn is_jar_signature_file(path: &str) -> bool {
  let upper = path.to_ascii_uppercase();
  if !upper.starts_with("META-INF/") {
    return false;
  }
  let Some(name) = upper.strip_prefix("META-INF/") else {
    return false;
  };
  if name.contains('/') {
    return false;
  }
  name.starts_with("SIG-")
    || [".SF", ".RSA", ".DSA", ".EC"]
      .iter()
      .any(|suffix| name.ends_with(suffix))
}

fn apply_patchouli_translations(source: &Value, translated: &HashMap<String, String>) -> Result<Value> {
  let mut expected = HashMap::new();
  collect_patchouli_text(source, "", &mut expected);
  let missing: Vec<_> = expected
    .keys()
    .filter(|key| !translated.contains_key(*key))
    .cloned()
    .collect();
  let extra: Vec<_> = translated
    .keys()
    .filter(|key| !expected.contains_key(*key))
    .cloned()
    .collect();
  if !missing.is_empty() || !extra.is_empty() {
    return Err(MinecraftError::Patchouli(format!(
      "Translation key mismatch (missing: {}; extra: {})",
      missing.join(", "),
      extra.join(", ")
    )));
  }
  let mut result = source.clone();
  replace_patchouli_text(&mut result, "", translated);
  Ok(result)
}

fn collect_patchouli_text(value: &Value, pointer: &str, output: &mut HashMap<String, String>) {
  match value {
    Value::Object(object) => {
      for (key, child) in object {
        let escaped = key.replace('~', "~0").replace('/', "~1");
        let child_pointer = format!("{pointer}/{escaped}");
        if matches!(key.as_str(), "name" | "description" | "title" | "text") {
          if let Some(text) = child.as_str() {
            output.insert(child_pointer, text.to_string());
            continue;
          }
        }
        collect_patchouli_text(child, &child_pointer, output);
      }
    }
    Value::Array(array) => {
      for (index, child) in array.iter().enumerate() {
        collect_patchouli_text(child, &format!("{pointer}/{index}"), output);
      }
    }
    _ => {}
  }
}

fn replace_patchouli_text(value: &mut Value, pointer: &str, translated: &HashMap<String, String>) {
  match value {
    Value::Object(object) => {
      for (key, child) in object {
        let escaped = key.replace('~', "~0").replace('/', "~1");
        let child_pointer = format!("{pointer}/{escaped}");
        if matches!(key.as_str(), "name" | "description" | "title" | "text") && child.is_string() {
          if let Some(text) = translated.get(&child_pointer) {
            *child = Value::String(text.clone());
          }
        } else {
          replace_patchouli_text(child, &child_pointer, translated);
        }
      }
    }
    Value::Array(array) => {
      for (index, child) in array.iter_mut().enumerate() {
        replace_patchouli_text(child, &format!("{pointer}/{index}"), translated);
      }
    }
    _ => {}
  }
}

/// Extract mod information from a JAR archive
fn extract_mod_info(archive: &mut ZipArchive<File>) -> Result<(String, String, String)> {
  // Try to extract from fabric.mod.json
  if let Ok(mut file) = archive.by_name("fabric.mod.json") {
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)?;

    // Try to convert to UTF-8, handling invalid sequences
    let content = String::from_utf8_lossy(&buffer).to_string();

    // Clean the JSON content
    let cleaned_content = clean_json_string(&content);

    debug!(
      "Attempting to parse fabric.mod.json. Content snippet: {}",
      cleaned_content.chars().take(100).collect::<String>()
    ); // Log content snippet

    // Try relaxed parsing first
    let json: serde_json::Value = match relaxed_json_parse(&cleaned_content) {
      Ok(value) => value,
      Err(e) => {
        error!("Failed to parse fabric.mod.json: {}", e);
        return Err(MinecraftError::Json(e));
      }
    };

    if let (Some(id), Some(name), Some(version)) =
      (json["id"].as_str(), json["name"].as_str(), json["version"].as_str())
    {
      return Ok((id.to_string(), name.to_string(), version.to_string()));
    }
  }

  // NeoForge uses neoforge.mods.toml; older Forge versions use mods.toml.
  for metadata_path in ["META-INF/neoforge.mods.toml", "META-INF/mods.toml"] {
    if let Ok(mut file) = archive.by_name(metadata_path) {
      let mut buffer = Vec::new();
      file.read_to_end(&mut buffer)?;

      // Try to convert to UTF-8, handling invalid sequences
      let content = String::from_utf8_lossy(&buffer).to_string();

      // Parse TOML using the toml crate
      let parsed_toml = content
        .parse::<toml::Value>()
        .map_err(|e| MinecraftError::Mod(format!("Failed to parse {}: {}", metadata_path, e)))?;

      // Extract values from the parsed TOML
      // モッドセクションを探す（"mods" 配列の最初の要素）
      let mods = parsed_toml
        .get("mods")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| MinecraftError::Mod("Failed to find mods section in mods.toml".to_string()))?;

      // 必要な情報を抽出
      let mod_id = mods
        .get("modId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| MinecraftError::Mod("Failed to extract mod ID from mods.toml".to_string()))?;

      let mod_name = mods
        .get("displayName")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| mod_id.clone());

      let mod_version = mods
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "unknown".to_string());

      return Ok((mod_id, mod_name, mod_version));
    }
  }

  // Try to extract from META-INF/MANIFEST.MF
  if archive.by_name("META-INF/MANIFEST.MF").is_ok() {
    // Use a default mod ID
    let jar_name = "unknown".to_string();

    return Ok((jar_name.clone(), jar_name, "unknown".to_string()));
  }

  // Fallback: use a default mod ID
  Err(MinecraftError::Mod("Failed to extract mod information".to_string()))
}

/// Extract language files from a JAR archive for a specific language
fn extract_lang_files_from_archive(
  archive: &mut ZipArchive<File>,
  _mod_id: &str,
  target_language: &str,
) -> Result<Vec<LangFile>> {
  let mut lang_files = Vec::new();

  // Find all language files
  for i in 0..archive.len() {
    let mut file = archive.by_index(i)?;
    let name = file.name().to_string();

    // Check if the file is a language file (.json or .lang)
    if name.contains("/lang/") && (name.ends_with(".json") || name.ends_with(".lang")) {
      // Extract language code from the file name
      let parts: Vec<&str> = name.split('/').collect();
      let filename = parts.last().unwrap_or(&"unknown.json");
      let language = if filename.ends_with(".json") {
        filename.trim_end_matches(".json").to_lowercase()
      } else if filename.ends_with(".lang") {
        filename.trim_end_matches(".lang").to_lowercase()
      } else {
        filename.to_lowercase()
      };

      // Only process the target language file (case-insensitive)
      if language == target_language.to_lowercase() {
        // Read the file content
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;

        // Try to convert to UTF-8, handling invalid sequences
        let content_str = String::from_utf8_lossy(&buffer).to_string();
        debug!(
          "Attempting to parse lang file: {}. Content snippet: {}",
          name,
          content_str.chars().take(100).collect::<String>()
        ); // Log file path and content snippet

        // Parse content based on extension
        let mut structured_content = HashMap::new();
        let content: HashMap<String, String> = if name.ends_with(".json") {
          // Strip _comment lines before parsing
          let clean_content_str = strip_json_comments(&content_str);
          match serde_json::from_str::<Value>(&clean_content_str) {
            Ok(Value::Object(values)) => {
              let mut content = HashMap::new();
              for (key, value) in values {
                if let Some(text) = value.as_str() {
                  content.insert(key, text.to_string());
                  continue;
                }

                let mut component_text = HashMap::new();
                collect_component_text(&value, &key, &mut Vec::new(), &mut component_text);
                if !component_text.is_empty() {
                  structured_content.insert(key, value);
                  content.extend(component_text);
                }
              }
              content
            }
            Ok(_) => {
              error!(
                "Language file '{}' must contain a JSON object. Skipping this file.",
                name
              );
              continue;
            }
            Err(e) => {
              error!("Failed to parse lang file '{}': {}. Skipping this file.", name, e);
              // Skip this file instead of failing the entire mod
              continue;
            }
          }
        } else {
          // .lang legacy format: key=value per line
          let mut map = HashMap::new();
          for line in content_str.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
              continue;
            }
            if let Some((key, value)) = trimmed.split_once('=') {
              map.insert(key.trim().to_string(), value.trim().to_string());
            }
          }
          map
        };

        // Create LangFile
        lang_files.push(LangFile {
          language,
          path: name,
          content,
          structured_content,
        });
      }
    }
  }

  Ok(lang_files)
}

/// Clean a JSON string by removing control characters and other problematic content
fn clean_json_string(json: &str) -> String {
  // Remove BOM if present
  let json = json.trim_start_matches('\u{feff}');

  // Remove control characters but preserve structure
  json
    .chars()
    .map(|c| {
      let code = c as u32;
      // Replace control characters (except tab, newline, CR) with spaces
      if code < 0x20 && code != 0x09 && code != 0x0A && code != 0x0D {
        ' '
      } else {
        c
      }
    })
    .collect()
}

/// Remove lines with "_comment" keys from a JSON string and fix common issues.
/// This is a workaround for Minecraft lang files that use "_comment" keys and have other issues.
fn strip_json_comments(json: &str) -> String {
  // Clean the JSON first (removes BOM and control characters)
  let cleaned_json = clean_json_string(json);

  // First, try to parse as-is to check if it's valid JSON
  if serde_json::from_str::<serde_json::Value>(&cleaned_json).is_ok() {
    return cleaned_json;
  }

  // If not valid, try to fix it
  // Try to parse as serde_json::Value to get more lenient parsing
  if let Ok(value) = relaxed_json_parse(&cleaned_json) {
    // Successfully parsed with relaxed parser, serialize back to valid JSON
    if let Ok(fixed_json) = serde_json::to_string(&value) {
      return fixed_json;
    }
  }

  // If relaxed parsing failed, try line-by-line cleanup
  // Remove lines with "_comment" keys and blank lines
  let mut lines: Vec<&str> = cleaned_json
    .lines()
    .filter(|line| {
      let trimmed = line.trim_start();
      !trimmed.starts_with("\"_comment\"") && !trimmed.starts_with("//") && !trimmed.is_empty()
    })
    .collect();

  // Remove trailing comma before the closing }
  if let Some(last_line) = lines.iter().rposition(|line| line.contains('}')) {
    if last_line > 0 {
      let prev_line = lines[last_line - 1].trim_end();
      if prev_line.ends_with(',') {
        // Remove the trailing comma
        lines[last_line - 1] = prev_line.trim_end_matches(',').trim_end();
      }
    }
  }

  let result = lines.join("\n");

  // Try to parse the result and provide more detailed error info if it fails
  if let Err(e) = serde_json::from_str::<serde_json::Value>(&result) {
    debug!("JSON still invalid after cleanup. Error: {}", e);
    let col = e.column();
    let line_no = e.line();
    debug!("Error at line {}, column {}", line_no, col);
    // Try to show the problematic line
    if let Some(problematic_line) = result.lines().nth(line_no.saturating_sub(1)) {
      debug!("Problematic line: {}", problematic_line);
    }
  }

  result
}

/// Attempt to parse JSON with common Minecraft mod JSON issues fixed
fn relaxed_json_parse(json: &str) -> Result<serde_json::Value, serde_json::Error> {
  // Create a temporary fixed version
  let mut fixed = String::new();
  let mut in_string = false;
  let mut escape_next = false;
  let mut chars = json.chars().peekable();

  while let Some(ch) = chars.next() {
    if escape_next {
      // Handle escape sequences
      match ch {
        '\\' | '"' | '/' | 'b' | 'f' | 'n' | 'r' | 't' => {
          fixed.push('\\');
          fixed.push(ch);
        }
        'u' => {
          fixed.push('\\');
          fixed.push('u');
          // Copy the next 4 hex digits
          for _ in 0..4 {
            if let Some(hex_ch) = chars.next() {
              fixed.push(hex_ch);
            }
          }
        }
        // For any other escaped character, just include the character itself
        _ => {
          fixed.push(ch);
        }
      }
      escape_next = false;
    } else if ch == '\\' && in_string {
      escape_next = true;
    } else if ch == '"' && !escape_next {
      in_string = !in_string;
      fixed.push(ch);
    } else {
      // Filter out control characters when inside strings
      let code = ch as u32;
      if in_string && code < 0x20 && code != 0x09 && code != 0x0A && code != 0x0D {
        // Skip control characters in strings, or replace with space
        fixed.push(' ');
      } else {
        fixed.push(ch);
      }
    }
  }

  serde_json::from_str(&fixed)
}

/// Extract Patchouli books from a JAR archive
fn extract_patchouli_books_from_archive(archive: &mut ZipArchive<File>, _mod_id: &str) -> Result<Vec<PatchouliBook>> {
  let mut patchouli_books = Vec::new();
  let book_json_re = Regex::new(r"^assets/([^/]+)/patchouli_books/([^/]+)/([^/]+)/(.+\.json)$").unwrap();
  let mut books_map: HashMap<String, (String, String, Vec<LangFile>, HashSet<String>)> = HashMap::new();

  for i in 0..archive.len() {
    let mut file = archive.by_index(i)?;
    let name = file.name().to_string();
    if let Some(caps) = book_json_re.captures(&name) {
      let book_mod_id = caps.get(1).unwrap().as_str().to_string();
      let book_id = caps.get(2).unwrap().as_str().to_string();
      let language = caps.get(3).unwrap().as_str().to_ascii_lowercase();
      let book_key = format!("{}:{}", book_mod_id, book_id);
      let book = books_map
        .entry(book_key)
        .or_insert_with(|| (book_mod_id.clone(), book_id.clone(), Vec::new(), HashSet::new()));
      book.3.insert(language.clone());
      if language != "en_us" {
        continue;
      }
      let mut buffer = Vec::new();
      file.read_to_end(&mut buffer)?;
      let source_json = relaxed_json_parse(&String::from_utf8_lossy(&buffer))?;
      let mut extracted = HashMap::new();
      collect_patchouli_text(&source_json, "", &mut extracted);
      if extracted.is_empty() {
        continue;
      }
      let lang_file = LangFile {
        language: "en_us".to_string(),
        path: name.clone(),
        content: extracted,
        structured_content: HashMap::new(),
      };
      book.2.push(lang_file);
    }
  }

  for (_book_key, (book_mod_id, book_id, mut lang_files, available_languages)) in books_map {
    if lang_files.is_empty() {
      continue;
    }
    lang_files.sort_by(|left, right| left.path.cmp(&right.path));
    let mut available_languages: Vec<_> = available_languages.into_iter().collect();
    available_languages.sort();
    let path = lang_files
      .first()
      .map(|lf| lf.path.clone())
      .unwrap_or_else(|| "".to_string());

    let book = PatchouliBook {
      id: book_id.clone(),
      mod_id: book_mod_id.clone(),
      name: book_id.clone(),
      path,
      lang_files,
      available_languages,
    };
    patchouli_books.push(book);
  }

  Ok(patchouli_books)
}

const COMPONENT_TRANSLATION_KEY_PREFIX: &str = "__mml_component__";

fn component_translation_key(root_key: &str, path: &[Value]) -> String {
  format!(
    "{}{}",
    COMPONENT_TRANSLATION_KEY_PREFIX,
    serde_json::to_string(&(root_key, path)).expect("component translation keys are JSON-safe")
  )
}

fn collect_component_text(value: &Value, root_key: &str, path: &mut Vec<Value>, output: &mut HashMap<String, String>) {
  match value {
    Value::Array(items) => {
      for (index, item) in items.iter().enumerate() {
        path.push(Value::from(index));
        if let Some(text) = item.as_str() {
          if text.chars().any(char::is_alphabetic) {
            output.insert(component_translation_key(root_key, path), text.to_string());
          }
        } else {
          collect_component_text(item, root_key, path, output);
        }
        path.pop();
      }
    }
    Value::Object(object) => {
      for key in ["text", "extra"] {
        let Some(child) = object.get(key) else { continue };
        path.push(Value::String(key.to_string()));
        if key == "text" {
          if let Some(text) = child.as_str() {
            if text.chars().any(char::is_alphabetic) {
              output.insert(component_translation_key(root_key, path), text.to_string());
            }
          } else {
            collect_component_text(child, root_key, path, output);
          }
        } else if child.is_array() || child.is_object() {
          collect_component_text(child, root_key, path, output);
        }
        path.pop();
      }
    }
    _ => {}
  }
}

#[cfg(test)]
mod patchouli_archive_tests {
  use super::{
    collect_patchouli_text, component_translation_key, extract_lang_files_from_archive, extract_mod_info,
    extract_patchouli_books_from_archive, get_available_languages_by_namespace,
    get_available_languages_by_namespace_and_format, write_patchouli_translation,
  };
  use serde_json::Value;
  use std::collections::HashMap;
  use std::fs::{self, File};
  use std::io::{Read, Write};
  use std::path::PathBuf;
  use std::time::{SystemTime, UNIX_EPOCH};
  use zip::write::FileOptions;
  use zip::{ZipArchive, ZipWriter};

  const SOURCE_PATH: &str = "assets/demo/patchouli_books/guide/en_us/entries/start.json";
  const SOURCE_PATH_2: &str = "assets/demo/patchouli_books/guide/en_us/entries/second.json";
  const TARGET_PATH: &str = "assets/demo/patchouli_books/guide/ja_jp/entries/start.json";
  const TARGET_PATH_2: &str = "assets/demo/patchouli_books/guide/ja_jp/entries/second.json";
  const SOURCE_JSON: &str = r#"{"name":"Start","text":"Top level","pages":[{"type":"text","text":"Nested page","anchor":"keep"}],"enabled":true}"#;
  const SOURCE_JSON_2: &str =
    r#"{"name":"Second file","text":"Different top level","pages":[{"type":"text","text":"Different nested page"}]}"#;

  fn temp_jar() -> (PathBuf, PathBuf) {
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let root = std::env::temp_dir().join(format!("mml-patchouli-{}-{nonce}", std::process::id()));
    fs::create_dir_all(&root).unwrap();
    (root.join("fixture.jar"), root)
  }

  fn fixture_jar(path: &PathBuf) {
    let mut writer = ZipWriter::new(File::create(path).unwrap());
    for (name, content) in [
      (SOURCE_PATH, SOURCE_JSON),
      (SOURCE_PATH_2, SOURCE_JSON_2),
      (TARGET_PATH, r#"{"name":"Old translation"}"#),
      (TARGET_PATH_2, r#"{"name":"Old second translation"}"#),
      ("META-INF/MANIFEST.MF", "Manifest-Version: 1.0\n"),
      ("META-INF/TEST.SF", "signature"),
      ("assets/demo/keep.txt", "keep"),
    ] {
      writer.start_file(name, FileOptions::default()).unwrap();
      writer.write_all(content.as_bytes()).unwrap();
    }
    writer.finish().unwrap();
  }

  #[test]
  fn extracts_text_from_owo_rich_json_without_sending_style_metadata() {
    let (jar, root) = temp_jar();
    let source = r#"{"text.owo.enabled":"Enabled","text.owo.component":[{"index":0},{"text":"Select one","color":"gray"},{"text":">","color":"gray"}]}"#;
    let mut writer = ZipWriter::new(File::create(&jar).unwrap());
    writer
      .start_file("assets/owo/lang/en_us.json", FileOptions::default())
      .unwrap();
    writer.write_all(source.as_bytes()).unwrap();
    writer.finish().unwrap();

    let mut archive = ZipArchive::new(File::open(&jar).unwrap()).unwrap();
    let files = extract_lang_files_from_archive(&mut archive, "owo", "en_us").unwrap();
    assert_eq!(files.len(), 1);
    let file = &files[0];
    let component_key = component_translation_key(
      "text.owo.component",
      &[Value::from(1), Value::String("text".to_string())],
    );

    assert_eq!(file.content["text.owo.enabled"], "Enabled");
    assert_eq!(file.content[&component_key], "Select one");
    assert!(!file.content.values().any(|value| value == ">" || value == "gray"));
    assert_eq!(file.structured_content["text.owo.component"][2]["color"], "gray");
    fs::remove_dir_all(root).unwrap();
  }

  #[test]
  fn extracts_mod_id_from_neoforge_metadata_instead_of_falling_back_to_unknown() {
    let (jar, root) = temp_jar();
    let mut writer = ZipWriter::new(File::create(&jar).unwrap());
    writer
      .start_file("META-INF/neoforge.mods.toml", FileOptions::default())
      .unwrap();
    writer
      .write_all(b"[[mods]]\nmodId = \"ars_ocultas\"\ndisplayName = \"Ars Ocultas\"\nversion = \"2.6.1\"\n")
      .unwrap();
    writer
      .start_file("META-INF/MANIFEST.MF", FileOptions::default())
      .unwrap();
    writer.write_all(b"Manifest-Version: 1.0\n").unwrap();
    writer.finish().unwrap();

    let mut archive = ZipArchive::new(File::open(&jar).unwrap()).unwrap();
    assert_eq!(
      extract_mod_info(&mut archive).unwrap(),
      ("ars_ocultas".into(), "Ars Ocultas".into(), "2.6.1".into())
    );
    fs::remove_dir_all(root).unwrap();
  }

  #[test]
  fn reports_existing_languages_for_each_english_resource_namespace() {
    let (jar, root) = temp_jar();
    let mut writer = ZipWriter::new(File::create(&jar).unwrap());
    for (path, content) in [
      ("assets/create_enchantment_industry/lang/en_us.json", "{}"),
      ("assets/create_enchantment_industry/lang/ja_jp.json", "{}"),
      ("assets/create_enchantment_industry/lang/en_us.lang", "key=English"),
      (
        "data/templates/assets/nested_namespace/lang/en_us.lang",
        "nested=English",
      ),
      ("assets/create_dragons_plus/lang/en_us.json", "{}"),
      ("assets/unrelated/lang/ja_jp.json", "{}"),
    ] {
      writer.start_file(path, FileOptions::default()).unwrap();
      writer.write_all(content.as_bytes()).unwrap();
    }
    writer.finish().unwrap();

    let mut archive = ZipArchive::new(File::open(&jar).unwrap()).unwrap();
    let languages = get_available_languages_by_namespace(&mut archive).unwrap();
    assert_eq!(languages["create_enchantment_industry"], ["en_us", "ja_jp"]);
    assert_eq!(languages["create_dragons_plus"], ["en_us"]);
    assert!(!languages.contains_key("unrelated"));
    let formats = get_available_languages_by_namespace_and_format(&mut archive).unwrap();
    assert_eq!(formats["create_enchantment_industry"]["json"], ["en_us", "ja_jp"]);
    assert_eq!(formats["create_enchantment_industry"]["lang"], ["en_us"]);
    assert_eq!(formats["nested_namespace"]["lang"], ["en_us"]);
    fs::remove_dir_all(root).unwrap();
  }

  #[test]
  fn extracts_legacy_lang_and_json_files_from_all_asset_namespaces() {
    let (jar, root) = temp_jar();
    let mut writer = ZipWriter::new(File::create(&jar).unwrap());
    for (path, content) in [
      (
        "assets/legacy/lang/en_us.lang",
        "# old Minecraft language format\nitem.example=Old English\nmessage.value=Has=equals\n",
      ),
      ("assets/second/lang/en_us.json", r#"{"block.example":"Modern English"}"#),
    ] {
      writer.start_file(path, FileOptions::default()).unwrap();
      writer.write_all(content.as_bytes()).unwrap();
    }
    writer.finish().unwrap();

    let mut archive = ZipArchive::new(File::open(&jar).unwrap()).unwrap();
    let files = extract_lang_files_from_archive(&mut archive, "legacy", "en_us").unwrap();
    assert_eq!(files.len(), 2);
    let legacy = files.iter().find(|file| file.path.ends_with(".lang")).unwrap();
    assert_eq!(legacy.content["item.example"], "Old English");
    assert_eq!(legacy.content["message.value"], "Has=equals");
    let modern = files.iter().find(|file| file.path.ends_with(".json")).unwrap();
    assert_eq!(modern.content["block.example"], "Modern English");
    fs::remove_dir_all(root).unwrap();
  }

  fn read_zip_text(archive: &mut ZipArchive<File>, path: &str) -> String {
    let mut text = String::new();
    archive.by_name(path).unwrap().read_to_string(&mut text).unwrap();
    text
  }

  #[test]
  fn extraction_keeps_each_json_file_and_nested_text_key_separate() {
    let (jar, root) = temp_jar();
    fixture_jar(&jar);
    let mut archive = ZipArchive::new(File::open(&jar).unwrap()).unwrap();
    let books = extract_patchouli_books_from_archive(&mut archive, "demo").unwrap();
    assert_eq!(books.len(), 1);
    assert_eq!(books[0].lang_files.len(), 2);
    assert_eq!(books[0].available_languages, vec!["en_us", "ja_jp"]);
    let first = books[0]
      .lang_files
      .iter()
      .find(|file| file.path == SOURCE_PATH)
      .unwrap();
    let second = books[0]
      .lang_files
      .iter()
      .find(|file| file.path == SOURCE_PATH_2)
      .unwrap();
    assert_eq!(first.content["/name"], "Start");
    assert_eq!(first.content["/pages/0/text"], "Nested page");
    assert_eq!(second.content["/name"], "Second file");
    assert_eq!(second.content["/pages/0/text"], "Different nested page");
    fs::remove_dir_all(root).unwrap();
  }

  #[test]
  fn writer_replaces_locale_file_in_place_and_preserves_source_and_metadata() {
    let (jar, root) = temp_jar();
    fixture_jar(&jar);
    let mut translated = HashMap::new();
    for (index, source_text) in [SOURCE_JSON, SOURCE_JSON_2].iter().enumerate() {
      let source: serde_json::Value = serde_json::from_str(source_text).unwrap();
      let mut file_content = HashMap::new();
      collect_patchouli_text(&source, "", &mut file_content);
      translated.extend(
        file_content
          .into_iter()
          .map(|(key, value)| (format!("file_{index}::{key}"), value)),
      );
    }
    translated.insert("file_0::/name".into(), "開始".into());
    translated.insert("file_0::/text".into(), "上部".into());
    translated.insert("file_0::/pages/0/text".into(), "ネストされたページ".into());
    translated.insert("file_1::/name".into(), "二つ目のファイル".into());
    translated.insert("file_1::/text".into(), "別の最上位テキスト".into());
    translated.insert("file_1::/pages/0/text".into(), "別のネストページ".into());

    write_patchouli_translation(
      &jar,
      "guide",
      "demo",
      "ja_jp",
      &[SOURCE_PATH.into(), SOURCE_PATH_2.into()],
      &translated,
    )
    .unwrap();
    let backup = jar.with_file_name("fixture.jar.mml-original.bak");
    assert!(backup.exists());
    let mut archive = ZipArchive::new(File::open(&jar).unwrap()).unwrap();
    assert_eq!(archive.file_names().filter(|name| *name == TARGET_PATH).count(), 1);
    assert_eq!(archive.file_names().filter(|name| *name == TARGET_PATH_2).count(), 1);
    let source_after: serde_json::Value = serde_json::from_str(&read_zip_text(&mut archive, SOURCE_PATH)).unwrap();
    assert_eq!(source_after["name"], "Start");
    assert_eq!(source_after["pages"][0]["text"], "Nested page");
    let translated_after: serde_json::Value = serde_json::from_str(&read_zip_text(&mut archive, TARGET_PATH)).unwrap();
    assert_eq!(translated_after["name"], "開始");
    assert_eq!(translated_after["pages"][0]["text"], "ネストされたページ");
    assert_eq!(translated_after["pages"][0]["anchor"], "keep");
    assert_eq!(translated_after["enabled"], true);
    let translated_second: serde_json::Value =
      serde_json::from_str(&read_zip_text(&mut archive, TARGET_PATH_2)).unwrap();
    assert_eq!(translated_second["name"], "二つ目のファイル");
    assert_eq!(translated_second["pages"][0]["text"], "別のネストページ");
    assert_eq!(read_zip_text(&mut archive, "assets/demo/keep.txt"), "keep");
    assert!(archive.by_name("META-INF/TEST.SF").is_err());

    let mut original_archive = ZipArchive::new(File::open(backup).unwrap()).unwrap();
    let original_target = read_zip_text(&mut original_archive, TARGET_PATH);
    assert!(original_target.contains("Old translation"));
    fs::remove_dir_all(root).unwrap();
  }

  #[test]
  fn malformed_translation_does_not_change_the_jar() {
    let (jar, root) = temp_jar();
    fixture_jar(&jar);
    let before = fs::read(&jar).unwrap();
    let invalid = HashMap::from([(String::from("file_0::/name"), String::from("開始"))]);
    assert!(write_patchouli_translation(
      &jar,
      "guide",
      "demo",
      "ja_jp",
      &[SOURCE_PATH.into(), SOURCE_PATH_2.into()],
      &invalid
    )
    .is_err());
    assert_eq!(fs::read(&jar).unwrap(), before);
    assert!(!jar.with_file_name("fixture.jar.mml-original.bak").exists());
    fs::remove_dir_all(root).unwrap();
  }
}
