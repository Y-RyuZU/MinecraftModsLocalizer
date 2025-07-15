// Modules
pub mod backup;
pub mod config;
pub mod filesystem;
pub mod logging;
pub mod minecraft;

#[cfg(test)]
mod tests;

use backup::{
    create_backup, delete_backup, get_backup_info, get_backup_storage_size, list_backups,
    prune_old_backups, restore_backup,
};
use config::{load_config, save_config};
use filesystem::{
    create_directory, create_resource_pack, get_better_quest_files, get_files_with_extension,
    get_ftb_quest_files, get_mod_files, open_directory_dialog, open_external_url, read_text_file,
    write_lang_file, write_text_file,
};
use logging::{
    clear_logs, create_logs_directory, create_logs_directory_with_session, create_temp_directory,
    create_temp_directory_with_session, generate_session_id, get_logs, init_logger,
    log_api_request, log_error, log_file_operation, log_file_progress, log_performance_metrics,
    log_translation_completion, log_translation_process, log_translation_start,
    log_translation_statistics,
};
use minecraft::{
    analyze_mod_jar, extract_lang_files, extract_patchouli_books, write_patchouli_book,
};

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
            .plugin(tauri_plugin_shell::init())
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
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
    };

    builder
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
            generate_session_id,
            // Enhanced translation logging
            log_translation_start,
            log_translation_statistics,
            log_file_progress,
            log_translation_completion,
            log_performance_metrics,
            // Backup operations
            create_backup,
            list_backups,
            restore_backup,
            delete_backup,
            prune_old_backups,
            get_backup_info,
            get_backup_storage_size
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
