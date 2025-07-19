use super::check_mod_translation_exists;
use std::path::Path;

/// Debug function to test translation detection on a real mod file
pub async fn debug_check_translation(mod_path: &str, mod_id: &str) {
    println!("\n=== Debug Translation Check ===");
    println!("Mod Path: {mod_path}");
    println!("Mod ID: {mod_id}");
    println!("File exists: {}", Path::new(mod_path).exists());

    let test_languages = vec![
        "ja_jp", "JA_JP", "ja_JP", // Test case variations
        "zh_cn", "ko_kr", "de_de", "fr_fr", "es_es",
    ];

    println!("\nChecking translations:");
    for lang in test_languages {
        match check_mod_translation_exists(mod_path, mod_id, lang).await {
            Ok(exists) => {
                println!(
                    "  {} - {}",
                    lang,
                    if exists { "EXISTS" } else { "NOT FOUND" }
                );
            }
            Err(e) => {
                println!("  {lang} - ERROR: {e}");
            }
        }
    }

    // Additional debug: List all files in the JAR that match lang pattern
    println!("\nAttempting to list language files in JAR:");
    if let Ok(file) = std::fs::File::open(mod_path) {
        if let Ok(mut archive) = zip::ZipArchive::new(file) {
            for i in 0..archive.len() {
                if let Ok(file) = archive.by_index(i) {
                    let name = file.name();
                    if name.contains("/lang/")
                        && (name.ends_with(".json") || name.ends_with(".lang"))
                    {
                        println!("  Found: {name}");
                    }
                }
            }
        } else {
            println!("  ERROR: Failed to read as ZIP archive");
        }
    } else {
        println!("  ERROR: Failed to open file");
    }

    println!("==============================\n");
}

/// Command to run debug check from CLI
#[tauri::command]
pub async fn debug_mod_translation_check(
    mod_path: String,
    mod_id: String,
) -> Result<String, String> {
    let mut output = String::new();

    output.push_str(&format!("Debug Translation Check for: {mod_path}\n"));
    output.push_str(&format!("Mod ID: {mod_id}\n"));
    output.push_str(&format!(
        "File exists: {}\n\n",
        Path::new(&mod_path).exists()
    ));

    // Check various language codes
    let languages = vec!["ja_jp", "JA_JP", "zh_cn", "ko_kr", "en_us"];

    for lang in languages {
        match check_mod_translation_exists(&mod_path, &mod_id, lang).await {
            Ok(exists) => {
                output.push_str(&format!(
                    "{}: {}\n",
                    lang,
                    if exists { "EXISTS" } else { "NOT FOUND" }
                ));
            }
            Err(e) => {
                output.push_str(&format!("{lang}: ERROR - {e}\n"));
            }
        }
    }

    // List all language files
    output.push_str("\nLanguage files in JAR:\n");
    if let Ok(file) = std::fs::File::open(&mod_path) {
        if let Ok(mut archive) = zip::ZipArchive::new(file) {
            let mut found_any = false;
            for i in 0..archive.len() {
                if let Ok(file) = archive.by_index(i) {
                    let name = file.name();
                    if name.contains("/lang/")
                        && (name.ends_with(".json") || name.ends_with(".lang"))
                    {
                        output.push_str(&format!("  - {name}\n"));
                        found_any = true;

                        // Check if this matches the expected pattern
                        let expected_pattern = format!("assets/{mod_id}/lang/");
                        if name.starts_with(&expected_pattern) {
                            output.push_str("    ✓ Matches expected pattern\n");
                        } else {
                            output.push_str("    ✗ Does NOT match expected pattern\n");
                        }
                    }
                }
            }
            if !found_any {
                output.push_str("  No language files found\n");
            }
        } else {
            output.push_str("  ERROR: Not a valid ZIP/JAR file\n");
        }
    } else {
        output.push_str("  ERROR: File not found or cannot be opened\n");
    }

    Ok(output)
}
