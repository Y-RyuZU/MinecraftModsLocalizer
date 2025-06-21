
// Modules
pub mod minecraft;
pub mod filesystem;
pub mod config;
pub mod logging;

use minecraft::{analyze_mod_jar, extract_lang_files, extract_patchouli_books, write_patchouli_book};
use filesystem::{
    get_mod_files, get_ftb_quest_files, get_better_quest_files, get_files_with_extension,
    read_text_file, write_text_file, create_directory, open_directory_dialog,
    create_resource_pack, write_lang_file, open_external_url
};
use config::{load_config, save_config};
use logging::{init_logger, log_translation_process, log_error, log_file_operation, log_api_request, get_logs, clear_logs, create_logs_directory, create_temp_directory, create_logs_directory_with_session, create_temp_directory_with_session, generate_session_id};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Initialize the logger
  let logger = init_logger();
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
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
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
      
      // External URL operations
      open_external_url,
      
      // Configuration operations
      load_config,
      save_config,
      
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
