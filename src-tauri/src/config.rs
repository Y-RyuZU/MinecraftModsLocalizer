use crate::filesystem::serialize_json_sorted;
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::PathBuf;
use thiserror::Error;

/// Configuration errors
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Config error: {0}")]
    Config(String),
}

// Type alias for internal Result with ConfigError
type Result<T, E = ConfigError> = std::result::Result<T, E>;

/// Application configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
    /// LLM provider configuration
    pub llm: LLMProviderConfig,
    /// Translation configuration
    pub translation: TranslationConfig,
    /// UI configuration
    pub ui: UIConfig,
    /// File paths configuration
    pub paths: PathsConfig,
}

/// LLM provider configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LLMProviderConfig {
    /// Provider ID
    pub provider: String,
    /// API key
    pub api_key: String,
    /// Base URL (optional for some providers)
    pub base_url: Option<String>,
    /// Model to use
    pub model: Option<String>,
    /// Maximum number of retries on failure
    pub max_retries: u32,
    /// Custom prompt template
    pub prompt_template: Option<String>,
}

/// Translation configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TranslationConfig {
    /// Chunk size for mod translations
    pub mod_chunk_size: u32,
    /// Chunk size for quest translations
    pub quest_chunk_size: u32,
    /// Chunk size for guidebook translations
    pub guidebook_chunk_size: u32,
    /// Custom languages
    pub custom_languages: Vec<SupportedLanguage>,
    /// Resource pack name
    pub resource_pack_name: String,
}

/// UI configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UIConfig {
    /// Theme (light or dark)
    pub theme: String,
}

/// Paths configuration
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PathsConfig {
    /// Minecraft directory
    pub minecraft_dir: String,
    /// Mods directory
    pub mods_dir: String,
    /// Resource packs directory
    pub resource_packs_dir: String,
    /// Config directory
    pub config_dir: String,
    /// Logs directory
    pub logs_dir: String,
}

/// Supported language
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SupportedLanguage {
    /// Display name of the language
    pub name: String,
    /// Language ID (e.g., "ja_jp", "zh_cn")
    pub id: String,
    /// Optional flag emoji
    pub flag: Option<String>,
}

/// Default application configuration
pub fn default_config() -> AppConfig {
    AppConfig {
        llm: LLMProviderConfig {
            provider: "openai".to_string(),
            api_key: "".to_string(),
            base_url: None,
            model: Some("o4-mini-2025-04-16".to_string()),
            max_retries: 5,
            prompt_template: None,
        },
        translation: TranslationConfig {
            mod_chunk_size: 50,
            quest_chunk_size: 1,
            guidebook_chunk_size: 1,
            custom_languages: vec![],
            resource_pack_name: "MinecraftModsLocalizer".to_string(),
        },
        ui: UIConfig {
            theme: "system".to_string(),
        },
        paths: PathsConfig {
            minecraft_dir: "".to_string(),
            mods_dir: "".to_string(),
            resource_packs_dir: "".to_string(),
            config_dir: "".to_string(),
            logs_dir: "".to_string(),
        },
    }
}

/// Get the config file path
fn get_config_path() -> Result<PathBuf> {
    // For Tauri 2.x, we'll use a simpler approach
    let app_dir = dirs::config_dir()
        .ok_or_else(|| ConfigError::Config("Failed to get config directory".to_string()))?
        .join("MinecraftModsLocalizer");

    // Create the directory if it doesn't exist
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }

    Ok(app_dir.join("config.json"))
}

/// Load configuration
#[tauri::command]
pub fn load_config() -> std::result::Result<String, String> {
    info!("Loading configuration");

    // Get the config file path
    let config_path = match get_config_path() {
        Ok(path) => path,
        Err(e) => return Err(format!("Failed to get config path: {e}")),
    };

    // Check if the config file exists
    if !config_path.exists() {
        // Create a default config
        let default_config = default_config();

        // Serialize the default config with sorted keys
        let config_json = match serialize_json_sorted(&default_config) {
            Ok(json) => json,
            Err(e) => return Err(format!("Failed to serialize default config: {e}")),
        };

        // Create the config file
        let mut config_file = match File::create(&config_path) {
            Ok(file) => file,
            Err(e) => return Err(format!("Failed to create config file: {e}")),
        };

        // Write the default config
        if let Err(e) = config_file.write_all(config_json.as_bytes()) {
            return Err(format!("Failed to write default config: {e}"));
        }

        return Ok(config_json);
    }

    // Open the config file
    let mut config_file = match File::open(&config_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Failed to open config file: {e}")),
    };

    // Read the config file
    let mut config_json = String::new();
    if let Err(e) = config_file.read_to_string(&mut config_json) {
        return Err(format!("Failed to read config file: {e}"));
    }

    // Parse the config
    let config: AppConfig = match serde_json::from_str(&config_json) {
        Ok(config) => config,
        Err(e) => return Err(format!("Failed to parse config: {e}")),
    };

    // TODO: Update the config with any missing fields from default_config()

    // Serialize the updated config with sorted keys
    let updated_config_json = match serialize_json_sorted(&config) {
        Ok(json) => json,
        Err(e) => return Err(format!("Failed to serialize updated config: {e}")),
    };

    Ok(updated_config_json)
}

/// Save configuration
#[tauri::command]
pub fn save_config(config_json: &str) -> std::result::Result<bool, String> {
    info!("Saving configuration");

    // Parse the config
    let config: AppConfig = match serde_json::from_str(config_json) {
        Ok(config) => config,
        Err(e) => return Err(format!("Failed to parse config: {e}")),
    };

    // Get the config file path
    let config_path = match get_config_path() {
        Ok(path) => path,
        Err(e) => return Err(format!("Failed to get config path: {e}")),
    };

    // Create the config file
    let mut config_file = match File::create(&config_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Failed to create config file: {e}")),
    };

    // Serialize the config with sorted keys
    let config_json = match serialize_json_sorted(&config) {
        Ok(json) => json,
        Err(e) => return Err(format!("Failed to serialize config: {e}")),
    };

    // Write the config
    if let Err(e) = config_file.write_all(config_json.as_bytes()) {
        return Err(format!("Failed to write config: {e}"));
    }

    Ok(true)
}
