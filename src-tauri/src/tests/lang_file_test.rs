use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tempfile::TempDir;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::write_lang_file;

    #[tokio::test]
    async fn test_write_lang_file_json_format() {
        // Create a temporary directory
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().to_str().unwrap();

        // Create test content
        let mut content = HashMap::new();
        content.insert("item.test.name".to_string(), "Test Item".to_string());
        content.insert("block.test.stone".to_string(), "Test Stone".to_string());

        let content_json = serde_json::to_string(&content).unwrap();

        // Test writing JSON format
        let result = write_lang_file(
            tauri::AppHandle::default(),
            "testmod",
            "en_us",
            &content_json,
            dir_path,
            Some("json"),
        )
        .await;

        assert!(result.is_ok());

        // Check that the file was created with correct extension
        let expected_path = Path::new(dir_path)
            .join("assets")
            .join("testmod")
            .join("lang")
            .join("en_us.json");

        assert!(expected_path.exists());

        // Verify content
        let written_content = fs::read_to_string(expected_path).unwrap();
        let parsed: HashMap<String, String> = serde_json::from_str(&written_content).unwrap();
        assert_eq!(parsed.get("item.test.name").unwrap(), "Test Item");
        assert_eq!(parsed.get("block.test.stone").unwrap(), "Test Stone");
    }

    #[tokio::test]
    async fn test_write_lang_file_lang_format() {
        // Create a temporary directory
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().to_str().unwrap();

        // Create test content
        let mut content = HashMap::new();
        content.insert("item.test.name".to_string(), "Test Item".to_string());
        content.insert("block.test.stone".to_string(), "Test Stone".to_string());

        let content_json = serde_json::to_string(&content).unwrap();

        // Test writing lang format
        let result = write_lang_file(
            tauri::AppHandle::default(),
            "testmod",
            "en_us",
            &content_json,
            dir_path,
            Some("lang"),
        )
        .await;

        assert!(result.is_ok());

        // Check that the file was created with correct extension
        let expected_path = Path::new(dir_path)
            .join("assets")
            .join("testmod")
            .join("lang")
            .join("en_us.lang");

        assert!(expected_path.exists());

        // Verify content
        let written_content = fs::read_to_string(expected_path).unwrap();
        let lines: Vec<&str> = written_content.lines().collect();

        // Content should be sorted
        assert!(lines.contains(&"block.test.stone=Test Stone"));
        assert!(lines.contains(&"item.test.name=Test Item"));
        assert_eq!(lines.len(), 2);
    }

    #[tokio::test]
    async fn test_write_lang_file_default_format() {
        // Create a temporary directory
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().to_str().unwrap();

        // Create test content
        let mut content = HashMap::new();
        content.insert("test.key".to_string(), "Test Value".to_string());

        let content_json = serde_json::to_string(&content).unwrap();

        // Test without format parameter (should default to JSON)
        let result = write_lang_file(
            tauri::AppHandle::default(),
            "testmod",
            "en_us",
            &content_json,
            dir_path,
            None,
        )
        .await;

        assert!(result.is_ok());

        // Check that JSON file was created by default
        let expected_path = Path::new(dir_path)
            .join("assets")
            .join("testmod")
            .join("lang")
            .join("en_us.json");

        assert!(expected_path.exists());
    }
}
