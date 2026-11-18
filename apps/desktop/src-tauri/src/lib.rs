pub mod workspace_manifest;
pub mod workspace_store;
pub mod system_providers;
pub mod workspace_commands;
pub mod workspace_name;

use tauri::Manager;
use workspace_store::WorkspaceStore;

/// Native host. It owns the workspace store (and with it the only path to the data folder) and
/// exposes two commands. No plugins are registered.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Resolved once. A failure stops start-up; there is no fallback directory.
            let data_dir = app.path().app_data_dir()?;
            app.manage(WorkspaceStore::new(&data_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            workspace_commands::create_workspace,
            workspace_commands::list_workspaces
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Engineering Learning Environment");
}
