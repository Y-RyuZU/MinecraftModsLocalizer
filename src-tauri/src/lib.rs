// Modules
pub mod minecraft;
pub mod filesystem;
pub mod config;

use minecraft::{analyze_mod_jar, extract_lang_files, extract_patchouli_books, write_patchouli_book};
use filesystem::{
    get_mod_files, get_ftb_quest_files, get_better_quest_files, get_files_with_extension,
    read_text_file, write_text_file, create_directory, open_directory_dialog,
    create_resource_pack, write_lang_file
};
use config::{load_config, save_config};

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
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      // Minecraft mod operations
      analyze_mod_jar,
      extract_lang_files,
      extract_patchouli_books,
      write_patchouli_book,
      
      // File system operations
      get_mod_files,
      get_ftb_quest_files,
      get_better_quest_files,
      get_files_with_extension,
      read_text_file,
      write_text_file,
      create_directory,
      open_directory_dialog,
      
      // Resource pack operations
      create_resource_pack,
      write_lang_file,
      
      // Configuration operations
      load_config,
      save_config
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
