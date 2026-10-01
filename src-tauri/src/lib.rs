// Modules
pub mod config;
pub mod filesystem;
pub mod logging;
pub mod minecraft;

use config::{get_api_key_from_environment, load_config, save_config};
use filesystem::{
  create_directory, create_resource_pack, file_exists, get_better_quest_files, get_files_with_extension,
  get_ftb_quest_files, get_mod_files, open_directory_dialog, open_external_url, read_text_file, write_lang_file,
  write_text_file,
};
use logging::{
  clear_logs, create_logs_directory, create_logs_directory_with_session, create_temp_directory,
  create_temp_directory_with_session, generate_session_id, get_logs, init_logger, log_api_request, log_error,
  log_file_operation, log_translation_process,
};
use minecraft::{analyze_mod_jar, extract_lang_files, extract_patchouli_books, write_patchouli_book};

#[tauri::command]
fn is_debug_build() -> bool {
  cfg!(debug_assertions)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Initialize the logger
  let logger = init_logger();

  #[cfg(debug_assertions)]
  let builder = {
    let logger_clone = logger.clone();
    tauri::Builder::default()
      .setup(move |app| {
        // Set the app handle for the logger
        logger_clone.set_app_handle(app.handle().clone());

        // Log application start
        logger_clone.info("Application started", Some("SYSTEM"));

        Ok(())
      })
      .manage(logger)
      .plugin(tauri_plugin_dialog::init())
      .plugin(tauri_plugin_opener::init())
  };

  #[cfg(not(debug_assertions))]
  let builder = {
    let logger_clone = logger.clone();
    tauri::Builder::default()
      .setup(move |app| {
        // Set the app handle for the logger
        logger_clone.set_app_handle(app.handle().clone());

        // Log application start
        logger_clone.info("Application started", Some("SYSTEM"));

        Ok(())
      })
      .manage(logger)
      .plugin(tauri_plugin_dialog::init())
      .plugin(tauri_plugin_opener::init())
      .plugin(tauri_plugin_updater::Builder::new().build())
  };

  builder
    .invoke_handler(tauri::generate_handler![
      is_debug_build,
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
      file_exists,
      write_text_file,
      create_directory,
      open_directory_dialog,
      // Resource pack operations
      create_resource_pack,
      write_lang_file,
      // External URL operations
      open_external_url,
      // Configuration operations
      load_config,
      save_config,
      get_api_key_from_environment,
      // Logging operations
      log_translation_process,
      log_error,
      log_file_operation,
      log_api_request,
      get_logs,
      clear_logs,
      create_logs_directory,
      create_temp_directory,
      create_logs_directory_with_session,
      create_temp_directory_with_session,
      generate_session_id
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
