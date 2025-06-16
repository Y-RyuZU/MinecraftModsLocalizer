use log::{debug, error, info};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::PathBuf;
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
        patchouli_books,
    };

    Ok(mod_info)
}

/// Extract language files from a mod JAR
#[tauri::command]
pub fn extract_lang_files(
    jar_path: &str,
    _temp_dir: &str,
) -> std::result::Result<Vec<LangFile>, String> {
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
) -> std::result::Result<Vec<PatchouliBook>, String> {
    info!("Extracting Patchouli books from {}", jar_path);

    let jar_path = PathBuf::from(jar_path);

    // Open the JAR file
    let file = match File::open(&jar_path) {
        Ok(f) => f,
        Err(e) => {
            error!("Failed to open JAR file: {}", e);
            return Err(format!("Failed to open JAR file: {}", e));
        }
    };

    let mut archive = match ZipArchive::new(file) {
        Ok(a) => a,
        Err(e) => {
            error!("Failed to read JAR as ZIP: {}", e);
            return Err(format!("Failed to read JAR as ZIP: {}", e));
        }
    };

    // Extract mod ID from fabric.mod.json or mods.toml
    let (mod_id, _mod_name, _) = match extract_mod_info(&mut archive) {
        Ok(info) => {
            debug!("Extracted mod info: id={}, name={}", info.0, info.1);
            info
        }
        Err(e) => {
            error!("Failed to extract mod info: {}", e);
            return Err(format!("Failed to extract mod info: {}", e));
        }
    };

    // Extract Patchouli books
    let patchouli_books = match extract_patchouli_books_from_archive(&mut archive, &mod_id) {
        Ok(books) => {
            info!("Found {} Patchouli books", books.len());
            books
        }
        Err(e) => {
            error!("Failed to extract Patchouli books: {}", e);
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
    content: &str,
) -> std::result::Result<bool, String> {
    let jar_path = PathBuf::from(jar_path);

    // Parse content
    let content_map = match serde_json::from_str::<HashMap<String, String>>(content) {
        Ok(map) => map,
        Err(e) => return Err(format!("Failed to parse content JSON: {}", e)),
    };

    // Create a temporary file
    let temp_path = jar_path.with_extension("jar.tmp");

    // Copy the JAR file to the temporary file
    if let Err(e) = fs::copy(&jar_path, &temp_path) {
        return Err(format!("Failed to create temporary file: {}", e));
    }

    // Open the original JAR file for reading
    let original_file = match File::open(&jar_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Failed to open JAR file: {}", e)),
    };

    let mut original_archive = match ZipArchive::new(original_file) {
        Ok(archive) => archive,
        Err(e) => return Err(format!("Failed to read JAR as ZIP: {}", e)),
    };

    // Open the temporary file for writing
    let temp_file = match File::create(&temp_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Failed to create temporary file: {}", e)),
    };

    let mut temp_archive = zip::ZipWriter::new(temp_file);

    // Copy all files from the original archive to the temporary archive
    for i in 0..original_archive.len() {
        let mut file = match original_archive.by_index(i) {
            Ok(file) => file,
            Err(e) => return Err(format!("Failed to read file from JAR: {}", e)),
        };

        let name = file.name().to_string();

        // Read the file content
        let mut buffer = Vec::new();
        if let Err(e) = file.read_to_end(&mut buffer) {
            return Err(format!("Failed to read file content: {}", e));
        }

        // Write the file to the temporary archive
        if let Err(e) = temp_archive.start_file(name, zip::write::FileOptions::default()) {
            return Err(format!("Failed to start file in temporary archive: {}", e));
        }

        if let Err(e) = temp_archive.write_all(&buffer) {
            return Err(format!("Failed to write file content: {}", e));
        }
    }

    // Add the new language file
    let file_path = format!(
        "assets/{}/patchouli_books/{}/{}.json",
        mod_id, book_id, language
    );

    if let Err(e) = temp_archive.start_file(file_path, zip::write::FileOptions::default()) {
        return Err(format!("Failed to start language file in archive: {}", e));
    }

    let json_content = match serde_json::to_string_pretty(&content_map) {
        Ok(json) => json,
        Err(e) => return Err(format!("Failed to serialize content: {}", e)),
    };

    if let Err(e) = temp_archive.write_all(json_content.as_bytes()) {
        return Err(format!("Failed to write language file content: {}", e));
    }

    // Finish writing the temporary archive
    if let Err(e) = temp_archive.finish() {
        return Err(format!("Failed to finalize temporary archive: {}", e));
    }

    // Replace the original JAR file with the temporary file
    if let Err(e) = fs::remove_file(&jar_path) {
        return Err(format!("Failed to remove original JAR file: {}", e));
    }

    if let Err(e) = fs::rename(&temp_path, &jar_path) {
        return Err(format!("Failed to rename temporary file: {}", e));
    }

    Ok(true)
}

/// Extract mod information from a JAR archive
fn extract_mod_info(archive: &mut ZipArchive<File>) -> Result<(String, String, String)> {
    
    // Try to extract from fabric.mod.json
    if let Ok(mut file) = archive.by_name("fabric.mod.json") {
        let mut content = String::new();
        file.read_to_string(&mut content)?;
        debug!(
            "Attempting to parse fabric.mod.json. Content snippet: {}",
            content.chars().take(100).collect::<String>()
        ); // Log content snippet

        let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| {
            error!("Failed to parse fabric.mod.json: {}", e); // Log specific error
            MinecraftError::Json(e) // Keep original error type if possible, or wrap
        })?;

        if let (Some(id), Some(name), Some(version)) = (
            json["id"].as_str(),
            json["name"].as_str(),
            json["version"].as_str(),
        ) {
            return Ok((id.to_string(), name.to_string(), version.to_string()));
        }
    }

    // Try to extract from mods.toml
    if let Ok(mut file) = archive.by_name("META-INF/mods.toml") {
        let mut content = String::new();
        file.read_to_string(&mut content)?;

        // Parse TOML using the toml crate
        let parsed_toml = content
            .parse::<toml::Value>()
            .map_err(|e| MinecraftError::Mod(format!("Failed to parse mods.toml: {}", e)))?;

        // Extract values from the parsed TOML
        // モッドセクションを探す（"mods" 配列の最初の要素）
        let mods = parsed_toml
            .get("mods")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .ok_or_else(|| {
                MinecraftError::Mod("Failed to find mods section in mods.toml".to_string())
            })?;

        // 必要な情報を抽出
        let mod_id = mods
            .get("modId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| {
                MinecraftError::Mod("Failed to extract mod ID from mods.toml".to_string())
            })?;

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

    // Try to extract from META-INF/MANIFEST.MF
    if let Ok(mut file) = archive.by_name("META-INF/MANIFEST.MF") {
        let mut content = String::new();
        file.read_to_string(&mut content)?;

        // Use a default mod ID
        let jar_name = "unknown".to_string();

        return Ok((jar_name.clone(), jar_name, "unknown".to_string()));
    }

    // Fallback: use a default mod ID
    Err(MinecraftError::Mod(
        "Failed to extract mod information".to_string(),
    ))
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
                let mut content_str = String::new();
                file.read_to_string(&mut content_str)?;
                debug!(
                    "Attempting to parse lang file: {}. Content snippet: {}",
                    name,
                    content_str.chars().take(100).collect::<String>()
                ); // Log file path and content snippet

                // Parse content based on extension
                let content: HashMap<String, String> = if name.ends_with(".json") {
                    // Strip _comment lines before parsing
                    let clean_content_str = strip_json_comments(&content_str);
                    serde_json::from_str(&clean_content_str).map_err(|e| {
                        error!("Failed to parse lang file '{}': {}", name, e); // Log specific error
                        MinecraftError::LangFile(format!("Failed to parse {}: {}", name, e)) // Add file context to error
                    })?
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
                });
            }
        }
    }

    Ok(lang_files)
}

/// Remove lines with "_comment" keys from a JSON string.
/// This is a workaround for Minecraft lang files that use "_comment" keys.
fn strip_json_comments(json: &str) -> String {
    // Remove BOM if present
    let json = json.trim_start_matches('\u{feff}');
    // Remove lines with "_comment" keys and blank lines
    let mut lines: Vec<&str> = json
        .lines()
        .filter(|line| {
            let trimmed = line.trim_start();
            !trimmed.starts_with("\"_comment\"")
                && !trimmed.starts_with("//")
                && !trimmed.is_empty()
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

    lines.join("\n")
}

/// Extract Patchouli books from a JAR archive
fn extract_patchouli_books_from_archive(
    archive: &mut ZipArchive<File>,
    _mod_id: &str,
) -> Result<Vec<PatchouliBook>> {
    let mut patchouli_books = Vec::new();

    // Regex to find Patchouli book root directories
    let patchouli_book_root_re = Regex::new(r"^assets/([^/]+)/patchouli_books/([^/]+)/").unwrap();
    // Regex to match en_us/**/*.json files (サブディレクトリも含む)
    let en_us_json_re = Regex::new(r"^assets/([^/]+)/patchouli_books/([^/]+)/en_us/(.+\.json)$").unwrap();
    // Regex to extract translation strings (Rust regex does not support look-behind)
    // We'll post-process to skip escaped quotes
    let extract_re = Regex::new(r#""(name|description|title|text)"\s*:\s*"(.*?)""#).unwrap();

    // Map: book_key ("modid:bookid") -> (modid, bookid, Vec<LangFile>)
    let mut books_map: HashMap<String, (String, String, Vec<LangFile>)> = HashMap::new();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let name = file.name().to_string();

        // サブディレクトリも含めてen_us配下の全*.jsonを対象にする
        if let Some(caps) = en_us_json_re.captures(&name) {
            let book_mod_id = caps.get(1).unwrap().as_str().to_string();
            let book_id = caps.get(2).unwrap().as_str().to_string();
            let json_rel_path = caps.get(3).unwrap().as_str().to_string();

            // Read file content as string
            let mut content_str = String::new();
            file.read_to_string(&mut content_str)?;

            // Extract translation strings using regex
            let mut extracted: HashMap<String, String> = HashMap::new();
            for cap in extract_re.captures_iter(&content_str) {
                // Check if the matched quote is not escaped
                if let Some(m) = cap.get(0) {
                    let start = m.start();
                    let value = cap[2].to_string();
                    let mut is_escaped = false;
                    if start > 0 {
                        let match_str = &content_str[start..m.end()];
                        let quote_pos = match_str.rfind('"').unwrap_or(match_str.len() - 1);
                        let mut backslash_count = 0;
                        for c in match_str[..quote_pos].chars().rev() {
                            if c == '\\' {
                                backslash_count += 1;
                            } else {
                                break;
                            }
                        }
                        if backslash_count % 2 == 1 {
                            is_escaped = true;
                        }
                    }
                    if !is_escaped {
                        extracted.insert(cap[1].to_string(), value);
                    }
                }
            }

            // Add LangFile for this .json
            let lang_file = LangFile {
                language: "en_us".to_string(),
                path: name.clone(),
                content: extracted,
            };

            let book_key = format!("{}:{}", book_mod_id, book_id);
            books_map
                .entry(book_key.clone())
                .and_modify(|(_modid, _bookid, lang_files)| lang_files.push(lang_file.clone()))
                .or_insert((book_mod_id.clone(), book_id.clone(), vec![lang_file]));
        }
    }

    // Build PatchouliBook structs
    for (_book_key, (book_mod_id, book_id, lang_files)) in books_map {
        // Use book_id as name for now (could be improved if needed)
        let path = lang_files
            .get(0)
            .map(|lf| lf.path.clone())
            .unwrap_or_else(|| "".to_string());

        let book = PatchouliBook {
            id: book_id.clone(),
            mod_id: book_mod_id.clone(),
            name: book_id.clone(),
            path,
            lang_files,
        };
        patchouli_books.push(book);
    }

    Ok(patchouli_books)
}
