use super::*;
use std::fs::File;
use std::io::Write;
use tempfile::TempDir;
use zip::{write::FileOptions, ZipWriter};

/// Create a mock mod JAR file with specified language files
fn create_mock_mod_jar(
    mod_id: &str,
    languages: Vec<(&str, &str)>, // (language_code, format) e.g., ("ja_jp", "json")
) -> Result<TempDir, Box<dyn std::error::Error>> {
    let temp_dir = TempDir::new()?;
    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));
    let file = File::create(&jar_path)?;
    let mut zip = ZipWriter::new(file);

    // Add mod metadata
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Stored);

    // Add fabric.mod.json
    zip.start_file("fabric.mod.json", options)?;
    let mod_json = format!(
        r#"{{
                "schemaVersion": 1,
                "id": "{}",
                "version": "1.0.0",
                "name": "Test Mod"
            }}"#,
        mod_id
    );
    zip.write_all(mod_json.as_bytes())?;

    // Add language files
    for (lang_code, format) in &languages {
        let lang_path = format!("assets/{}/lang/{}.{}", mod_id, lang_code, format);
        zip.start_file(&lang_path, options)?;

        if *format == "json" {
            let content = format!(
                r#"{{
                        "item.{}.test": "Test Item",
                        "block.{}.test": "Test Block"
                    }}"#,
                mod_id, mod_id
            );
            zip.write_all(content.as_bytes())?;
        } else {
            let content = format!(
                "item.{}.test=Test Item\nblock.{}.test=Test Block",
                mod_id, mod_id
            );
            zip.write_all(content.as_bytes())?;
        }
    }

    // Always add en_us.json as source
    if !languages.iter().any(|(lang, _)| lang == &"en_us") {
        let lang_path = format!("assets/{}/lang/en_us.json", mod_id);
        zip.start_file(&lang_path, options)?;
        let content = format!(
            r#"{{
                    "item.{}.test": "Test Item",
                    "block.{}.test": "Test Block"
                }}"#,
            mod_id, mod_id
        );
        zip.write_all(content.as_bytes())?;
    }

    zip.finish()?;
    Ok(temp_dir)
}

#[tokio::test]
async fn test_check_mod_translation_exists_with_json() {
    let mod_id = "testmod";
    let temp_dir = create_mock_mod_jar(mod_id, vec![("en_us", "json"), ("ja_jp", "json")])
        .expect("Failed to create mock JAR");

    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));

    // Test: ja_jp translation exists
    let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "ja_jp").await;

    assert!(result.is_ok());
    assert!(result.unwrap(), "Should find ja_jp.json translation");

    // Test: zh_cn translation doesn't exist
    let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "zh_cn").await;

    assert!(result.is_ok());
    assert!(!result.unwrap(), "Should not find zh_cn translation");
}

#[tokio::test]
async fn test_check_mod_translation_exists_with_lang_format() {
    let mod_id = "legacymod";
    let temp_dir = create_mock_mod_jar(mod_id, vec![("en_us", "lang"), ("ja_jp", "lang")])
        .expect("Failed to create mock JAR");

    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));

    // Test: ja_jp.lang translation exists
    let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "ja_jp").await;

    assert!(result.is_ok());
    assert!(result.unwrap(), "Should find ja_jp.lang translation");
}

#[tokio::test]
async fn test_check_mod_translation_case_insensitive() {
    let mod_id = "casetest";
    let temp_dir =
        create_mock_mod_jar(mod_id, vec![("ja_jp", "json")]).expect("Failed to create mock JAR");

    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));

    // Test: JA_JP should find ja_jp (case insensitive)
    let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "JA_JP").await;

    assert!(result.is_ok());
    assert!(
        result.unwrap(),
        "Should find translation with case-insensitive language code"
    );

    // Test: ja_JP should also work
    let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "ja_JP").await;

    assert!(result.is_ok());
    assert!(
        result.unwrap(),
        "Should find translation with mixed case language code"
    );
}

#[tokio::test]
async fn test_check_mod_translation_mixed_formats() {
    let mod_id = "mixedmod";
    let temp_dir = create_mock_mod_jar(
        mod_id,
        vec![("en_us", "json"), ("ja_jp", "lang"), ("zh_cn", "json")],
    )
    .expect("Failed to create mock JAR");

    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));

    // Test: Both json and lang formats should be detected
    let result_ja = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "ja_jp").await;

    assert!(result_ja.is_ok());
    assert!(result_ja.unwrap(), "Should find ja_jp.lang translation");

    let result_zh = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "zh_cn").await;

    assert!(result_zh.is_ok());
    assert!(result_zh.unwrap(), "Should find zh_cn.json translation");
}

#[tokio::test]
async fn test_check_mod_translation_wrong_mod_id() {
    let mod_id = "correctmod";
    let wrong_mod_id = "wrongmod";
    let temp_dir =
        create_mock_mod_jar(mod_id, vec![("ja_jp", "json")]).expect("Failed to create mock JAR");

    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));

    // Test: Using wrong mod_id should not find translation
    let result =
        check_mod_translation_exists(jar_path.to_str().unwrap(), wrong_mod_id, "ja_jp").await;

    assert!(result.is_ok());
    assert!(
        !result.unwrap(),
        "Should not find translation with wrong mod_id"
    );
}

#[tokio::test]
async fn test_check_mod_translation_invalid_jar() {
    let temp_dir = TempDir::new().unwrap();
    let invalid_jar_path = temp_dir.path().join("invalid.jar");

    // Create an invalid file (not a ZIP)
    let mut file = File::create(&invalid_jar_path).unwrap();
    file.write_all(b"This is not a valid JAR file").unwrap();

    let result =
        check_mod_translation_exists(invalid_jar_path.to_str().unwrap(), "testmod", "ja_jp").await;

    assert!(result.is_err(), "Should return error for invalid JAR file");
}

#[tokio::test]
async fn test_check_mod_translation_nonexistent_file() {
    let result =
        check_mod_translation_exists("/path/to/nonexistent/mod.jar", "testmod", "ja_jp").await;

    assert!(result.is_err(), "Should return error for non-existent file");
}

/// Test with real-world mod structure
#[tokio::test]
async fn test_check_mod_translation_realistic_structure() {
    let mod_id = "examplemod";
    let temp_dir = TempDir::new().unwrap();
    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));
    let file = File::create(&jar_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // Add realistic mod structure
    // META-INF/
    zip.start_file("META-INF/MANIFEST.MF", options).unwrap();
    zip.write_all(b"Manifest-Version: 1.0\n").unwrap();

    // Root mod files
    zip.start_file("fabric.mod.json", options).unwrap();
    let mod_json = format!(
        r#"{{
                "schemaVersion": 1,
                "id": "{}",
                "version": "1.0.0",
                "name": "Example Mod",
                "description": "A test mod"
            }}"#,
        mod_id
    );
    zip.write_all(mod_json.as_bytes()).unwrap();

    // Assets with multiple language files
    let languages = vec![
        ("en_us", r#"{"item.examplemod.test": "Test Item"}"#),
        ("ja_jp", r#"{"item.examplemod.test": "テストアイテム"}"#),
        ("ko_kr", r#"{"item.examplemod.test": "테스트 아이템"}"#),
    ];

    for (lang, content) in languages {
        let path = format!("assets/{}/lang/{}.json", mod_id, lang);
        zip.start_file(&path, options).unwrap();
        zip.write_all(content.as_bytes()).unwrap();
    }

    // Add some other assets
    zip.start_file(format!("assets/{}/textures/item/test.png", mod_id), options)
        .unwrap();
    zip.write_all(b"PNG_DATA").unwrap();

    zip.finish().unwrap();

    // Test multiple languages
    let test_cases = vec![
        ("ja_jp", true),
        ("ko_kr", true),
        ("zh_cn", false),
        ("de_de", false),
    ];

    for (lang, expected) in test_cases {
        let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, lang).await;

        assert!(result.is_ok());
        assert_eq!(
            result.unwrap(),
            expected,
            "Language {} should be {}",
            lang,
            if expected { "found" } else { "not found" }
        );
    }
}

/// Test with special characters in mod ID
#[tokio::test]
async fn test_check_mod_translation_special_characters() {
    let mod_id = "test-mod_2";
    let temp_dir =
        create_mock_mod_jar(mod_id, vec![("ja_jp", "json")]).expect("Failed to create mock JAR");

    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));

    let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "ja_jp").await;

    assert!(result.is_ok());
    assert!(
        result.unwrap(),
        "Should handle mod IDs with special characters"
    );
}

/// Test with empty language code
#[tokio::test]
async fn test_check_mod_translation_empty_language() {
    let mod_id = "testmod";
    let temp_dir =
        create_mock_mod_jar(mod_id, vec![("ja_jp", "json")]).expect("Failed to create mock JAR");

    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));

    let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "").await;

    assert!(result.is_ok());
    assert!(!result.unwrap(), "Empty language code should return false");
}

/// Test with large JAR file containing many files
#[tokio::test]
async fn test_check_mod_translation_performance() {
    let mod_id = "largemod";
    let temp_dir = TempDir::new().unwrap();
    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));
    let file = File::create(&jar_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Stored);

    // Add many files to simulate a large mod
    for i in 0..1000 {
        let path = format!("assets/{}/textures/item/item_{}.png", mod_id, i);
        zip.start_file(&path, options).unwrap();
        zip.write_all(b"PNG_DATA").unwrap();
    }

    // Add target language file in the middle
    let lang_path = format!("assets/{}/lang/ja_jp.json", mod_id);
    zip.start_file(&lang_path, options).unwrap();
    zip.write_all(r#"{"test": "テスト"}"#.as_bytes()).unwrap();

    // Add more files after
    for i in 1000..2000 {
        let path = format!("assets/{}/models/block/block_{}.json", mod_id, i);
        zip.start_file(&path, options).unwrap();
        zip.write_all(b"MODEL_DATA").unwrap();
    }

    zip.finish().unwrap();

    // Time the operation
    let start = std::time::Instant::now();
    let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "ja_jp").await;
    let duration = start.elapsed();

    assert!(result.is_ok());
    assert!(result.unwrap(), "Should find translation in large JAR");
    assert!(
        duration.as_millis() < 1000,
        "Should complete within 1 second even for large JARs"
    );
}

/// Test with nested ZIP files (mod containing other JARs)
#[tokio::test]
async fn test_check_mod_translation_nested_jars() {
    let mod_id = "nestedmod";
    let temp_dir = TempDir::new().unwrap();
    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));
    let file = File::create(&jar_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Stored);

    // Add normal mod structure
    zip.start_file("fabric.mod.json", options).unwrap();
    let mod_json = format!(r#"{{"id": "{}"}}"#, mod_id);
    zip.write_all(mod_json.as_bytes()).unwrap();

    // Add language file
    let lang_path = format!("assets/{}/lang/ja_jp.json", mod_id);
    zip.start_file(&lang_path, options).unwrap();
    zip.write_all(r#"{"test": "テスト"}"#.as_bytes()).unwrap();

    // Add a nested JAR (common in some mod loaders)
    zip.start_file("META-INF/jars/dependency.jar", options)
        .unwrap();
    // Create a minimal JAR structure in memory
    let mut nested_jar = Vec::new();
    {
        let mut nested_zip = ZipWriter::new(std::io::Cursor::new(&mut nested_jar));
        nested_zip.start_file("test.txt", options).unwrap();
        nested_zip.write_all(b"nested content").unwrap();
        nested_zip.finish().unwrap();
    }
    zip.write_all(&nested_jar).unwrap();

    zip.finish().unwrap();

    let result = check_mod_translation_exists(jar_path.to_str().unwrap(), mod_id, "ja_jp").await;

    assert!(result.is_ok());
    assert!(result.unwrap(), "Should handle mods with nested JARs");
}

/// Test concurrent access to the same mod file
#[tokio::test]
async fn test_check_mod_translation_concurrent_access() {
    let mod_id = "concurrentmod";
    let temp_dir = create_mock_mod_jar(
        mod_id,
        vec![("ja_jp", "json"), ("zh_cn", "json"), ("ko_kr", "json")],
    )
    .expect("Failed to create mock JAR");

    let jar_path = temp_dir.path().join(format!("{}.jar", mod_id));
    let jar_path_str = jar_path.to_str().unwrap().to_string();

    // Launch multiple concurrent checks
    let mut handles = vec![];
    let languages = vec!["ja_jp", "zh_cn", "ko_kr", "de_de", "fr_fr"];

    for lang in languages {
        let path = jar_path_str.clone();
        let mod_id_clone = mod_id.to_string();
        let lang_clone = lang.to_string();

        let handle = tokio::spawn(async move {
            check_mod_translation_exists(&path, &mod_id_clone, &lang_clone).await
        });

        handles.push((lang, handle));
    }

    // Wait for all checks to complete
    for (lang, handle) in handles {
        let result = handle.await.unwrap();
        assert!(
            result.is_ok(),
            "Concurrent check for {} should succeed",
            lang
        );

        let expected = matches!(lang, "ja_jp" | "zh_cn" | "ko_kr");
        assert_eq!(
            result.unwrap(),
            expected,
            "Language {} should be {}",
            lang,
            if expected { "found" } else { "not found" }
        );
    }
}
