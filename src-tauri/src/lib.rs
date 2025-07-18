// Modules
pub mod backup;
pub mod config;
pub mod filesystem;
pub mod logging;
pub mod minecraft;

#[cfg(test)]
mod tests;

use backup::{
    backup_resource_pack, backup_snbt_files, batch_update_translation_summary, create_backup,
    get_translation_summary, list_translation_sessions, update_translation_summary,
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
    log_translation_statistics, read_session_log,
};
use minecraft::{
    analyze_mod_jar, check_guidebook_translation_exists, check_mod_translation_exists,
    check_quest_translation_exists, detect_snbt_content_type, extract_lang_files,
    extract_patchouli_books, write_patchouli_book,
};

#[cfg(debug_assertions)]
use minecraft::debug_translation_check::debug_mod_translation_check;

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
            check_mod_translation_exists,
            check_quest_translation_exists,
            check_guidebook_translation_exists,
            detect_snbt_content_type,
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
            read_session_log,
            // Backup operations
            create_backup,
            backup_snbt_files,
            backup_resource_pack,
            // Translation history operations
            list_translation_sessions,
            get_translation_summary,
            update_translation_summary,
            batch_update_translation_summary,
            // Debug commands (only in debug builds)
            #[cfg(debug_assertions)]
            debug_mod_translation_check
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
