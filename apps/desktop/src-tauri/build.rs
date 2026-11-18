fn main() {
  // Declaring the app's commands here means the frontend can call only these, and only when a
  // capability grants `allow-<command-name>`. Keep this list equal to `generate_handler!` in lib.rs
  // (tests/capability_audit.rs checks that).
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(
      tauri_build::AppManifest::new().commands(&["create_workspace", "list_workspaces"]),
    ),
  )
  .expect("failed to run tauri-build");
}
