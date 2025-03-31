// Minecraft module
pub mod minecraft;

use minecraft::{analyze_mod_jar, extract_lang_files, extract_patchouli_books, write_patchouli_book};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      analyze_mod_jar,
      extract_lang_files,
      extract_patchouli_books,
      write_patchouli_book
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
