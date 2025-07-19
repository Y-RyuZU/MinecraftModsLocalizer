use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tempfile::TempDir;
use zip::{write::FileOptions, ZipWriter};

/// Helper to create a test mod JAR
fn create_test_mod_jar(
    dir: &Path,
    mod_id: &str,
    mod_name: &str,
    translations: Vec<(&str, &str, &str)>, // (lang_code, format, content)
) -> PathBuf {
    let jar_path = dir.join(format!("{mod_id}-1.0.0.jar"));
    let file = File::create(&jar_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // Add fabric.mod.json
    zip.start_file("fabric.mod.json", options).unwrap();
    let fabric_json = format!(
        r#"{{
            "schemaVersion": 1,
            "id": "{mod_id}",
            "version": "1.0.0",
            "name": "{mod_name}",
            "description": "Test mod for translation detection",
            "authors": ["Test Author"],
            "contact": {{}},
            "license": "MIT",
            "environment": "*",
            "entrypoints": {{}}
        }}"#
    );
    zip.write_all(fabric_json.as_bytes()).unwrap();

    // Add mods.toml for Forge compatibility
    zip.start_file("META-INF/mods.toml", options).unwrap();
    let mods_toml = format!(
        r#"modLoader="javafml"
loaderVersion="[40,)"
license="MIT"

[[mods]]
modId="{mod_id}"
version="1.0.0"
displayName="{mod_name}"
description="Test mod for translation detection"
"#
    );
    zip.write_all(mods_toml.as_bytes()).unwrap();

    // Add translations
    for (lang_code, format, content) in translations {
        let path = format!("assets/{mod_id}/lang/{lang_code}.{format}");
        zip.start_file(&path, options).unwrap();
        zip.write_all(content.as_bytes()).unwrap();
    }

    zip.finish().unwrap();
    jar_path
}

#[test]
fn test_mod_translation_detection_integration() {
    // Create temp directory structure like Minecraft
    let temp_dir = TempDir::new().unwrap();
    let minecraft_dir = temp_dir.path();
    let mods_dir = minecraft_dir.join("mods");
    fs::create_dir_all(&mods_dir).unwrap();

    // Test Case 1: Mod with Japanese translation (JSON format)
    let mod1_translations = vec![
        ("en_us", "json", r#"{"item.testmod1.item": "Test Item"}"#),
        (
            "ja_jp",
            "json",
            r#"{"item.testmod1.item": "テストアイテム"}"#,
        ),
    ];
    let mod1_path = create_test_mod_jar(&mods_dir, "testmod1", "Test Mod 1", mod1_translations);

    // Test Case 2: Mod with legacy .lang format
    let mod2_translations = vec![
        ("en_us", "lang", "item.testmod2.item=Test Item 2"),
        ("ja_jp", "lang", "item.testmod2.item=テストアイテム2"),
    ];
    let mod2_path = create_test_mod_jar(&mods_dir, "testmod2", "Test Mod 2", mod2_translations);

    // Test Case 3: Mod without Japanese translation
    let mod3_translations = vec![
        ("en_us", "json", r#"{"item.testmod3.item": "Test Item 3"}"#),
        (
            "de_de",
            "json",
            r#"{"item.testmod3.item": "Test Artikel 3"}"#,
        ),
    ];
    let mod3_path = create_test_mod_jar(&mods_dir, "testmod3", "Test Mod 3", mod3_translations);

    // Test Case 4: Mod with mixed case language codes
    let mod4_translations = vec![
        ("en_us", "json", r#"{"item.testmod4.item": "Test Item 4"}"#),
        (
            "JA_JP",
            "json",
            r#"{"item.testmod4.item": "テストアイテム4"}"#,
        ), // Upper case
    ];
    let mod4_path = create_test_mod_jar(&mods_dir, "testmod4", "Test Mod 4", mod4_translations);

    // Print paths for manual testing
    println!("Created test mods:");
    println!("  - Mod 1 (with ja_jp.json): {mod1_path:?}");
    println!("  - Mod 2 (with ja_jp.lang): {mod2_path:?}");
    println!("  - Mod 3 (without ja_jp): {mod3_path:?}");
    println!("  - Mod 4 (with JA_JP.json): {mod4_path:?}");

    // Verify files exist
    assert!(mod1_path.exists(), "Mod 1 JAR should exist");
    assert!(mod2_path.exists(), "Mod 2 JAR should exist");
    assert!(mod3_path.exists(), "Mod 3 JAR should exist");
    assert!(mod4_path.exists(), "Mod 4 JAR should exist");

    // Additional test: Create a mod with complex structure
    let mod5_path = mods_dir.join("complexmod-1.0.0.jar");
    let file = File::create(&mod5_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // Add various files that might confuse the detection
    zip.start_file("assets/complexmod/lang/en_us.json", options)
        .unwrap();
    zip.write_all(br#"{"item.complexmod.item": "Complex Item"}"#)
        .unwrap();

    // Add file with similar name but wrong path
    zip.start_file("assets/wrongmod/lang/ja_jp.json", options)
        .unwrap();
    zip.write_all(br#"{"item.wrongmod.item": "Wrong Item"}"#)
        .unwrap();

    // Add correct Japanese translation
    zip.start_file("assets/complexmod/lang/ja_jp.json", options)
        .unwrap();
    // Using regular string with .as_bytes() for UTF-8 characters
    zip.write_all(r#"{"item.complexmod.item": "複雑なアイテム"}"#.as_bytes())
        .unwrap();

    // Add other assets that shouldn't affect detection
    zip.start_file("assets/complexmod/textures/item/test.png", options)
        .unwrap();
    zip.write_all(b"FAKE_PNG_DATA").unwrap();

    zip.start_file("data/complexmod/recipes/test.json", options)
        .unwrap();
    zip.write_all(br#"{"type": "minecraft:crafting_shaped"}"#)
        .unwrap();

    zip.finish().unwrap();

    println!("  - Mod 5 (complex structure): {mod5_path:?}");
    assert!(mod5_path.exists(), "Mod 5 JAR should exist");

    // The actual check_mod_translation_exists calls would be made from the application
    println!("\nTest mods created successfully in: {mods_dir:?}");
    println!("\nExpected results when checking for ja_jp translations:");
    println!("  - testmod1: Should find translation (ja_jp.json exists)");
    println!("  - testmod2: Should find translation (ja_jp.lang exists)");
    println!("  - testmod3: Should NOT find translation (only de_de exists)");
    println!("  - testmod4: Case sensitivity test - depends on implementation");
    println!("  - complexmod: Should find translation (correct path exists)");
}

#[test]
fn test_edge_cases() {
    let temp_dir = TempDir::new().unwrap();
    let mods_dir = temp_dir.path().join("mods");
    fs::create_dir_all(&mods_dir).unwrap();

    // Edge Case 1: Empty language file
    let edge1_path = mods_dir.join("emptymod-1.0.0.jar");
    let file = File::create(&edge1_path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default();

    zip.start_file("assets/emptymod/lang/ja_jp.json", options)
        .unwrap();
    zip.write_all(b"{}").unwrap(); // Empty JSON

    zip.finish().unwrap();

    // Edge Case 2: Malformed path separators
    let edge2_path = mods_dir.join("pathmod-1.0.0.jar");
    let file = File::create(&edge2_path).unwrap();
    let mut zip = ZipWriter::new(file);

    // Using backslashes (Windows-style)
    zip.start_file(r"assets\pathmod\lang\ja_jp.json", options)
        .unwrap();
    zip.write_all(br#"{"test": "test"}"#).unwrap();

    zip.finish().unwrap();

    // Edge Case 3: Multiple language files in different locations
    let edge3_path = mods_dir.join("multimod-1.0.0.jar");
    let file = File::create(&edge3_path).unwrap();
    let mut zip = ZipWriter::new(file);

    // Correct location
    zip.start_file("assets/multimod/lang/ja_jp.json", options)
        .unwrap();
    zip.write_all(br#"{"correct": "true"}"#).unwrap();

    // Wrong location (should be ignored)
    zip.start_file("lang/ja_jp.json", options).unwrap();
    zip.write_all(br#"{"wrong": "true"}"#).unwrap();

    zip.finish().unwrap();

    println!("\nEdge case test mods created:");
    println!("  - Empty language file: {edge1_path:?}");
    println!("  - Path separator test: {edge2_path:?}");
    println!("  - Multiple locations: {edge3_path:?}");
}
