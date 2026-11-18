//! Static audit of what the frontend is allowed to do.
//!
//! What this proves: the *configuration* grants the main window exactly the two workspace
//! commands, registers no plugin, and installs no plugin package in the frontend. It reads the
//! checked-in configuration and sources; it does not exercise the running app (the desktop smoke
//! test does that).
//!
//! What it does not prove: the two commands are privileged host operations that read and write
//! the application data folder on the frontend's behalf. The webview also keeps ordinary browser
//! abilities (for example `<input type="file">` for user-chosen files, drag and drop). No Tauri
//! file-system plugin or API is available to it.

use serde_json::Value;
use std::collections::BTreeSet;
use std::fs;

const COMMANDS: [&str; 2] = ["create_workspace", "list_workspaces"];

fn read(rel: &str) -> String {
    let path = format!("{}/{rel}", env!("CARGO_MANIFEST_DIR"));
    fs::read_to_string(&path).unwrap_or_else(|e| panic!("cannot read {path}: {e}"))
}

fn json(rel: &str) -> Value {
    serde_json::from_str(&read(rel)).unwrap_or_else(|e| panic!("{rel} is not JSON: {e}"))
}

fn set(items: &[&str]) -> BTreeSet<String> {
    items.iter().map(|s| s.to_string()).collect()
}

#[test]
fn the_main_window_is_granted_exactly_the_two_workspace_commands() {
    let files: Vec<_> = fs::read_dir(format!("{}/capabilities", env!("CARGO_MANIFEST_DIR")))
        .unwrap()
        .map(|e| e.unwrap().file_name().into_string().unwrap())
        .collect();
    assert_eq!(files, ["default.json"], "one capability file, no others");

    let cap = json("capabilities/default.json");
    let permissions: BTreeSet<String> = cap["permissions"]
        .as_array()
        .expect("permissions array")
        .iter()
        .map(|p| p.as_str().expect("permissions must be plain identifiers, not objects with scopes").to_string())
        .collect();
    assert_eq!(permissions, set(&["allow-create-workspace", "allow-list-workspaces"]));
    assert_eq!(cap["windows"], serde_json::json!(["main"]));
    for key in ["remote", "webviews", "platforms"] {
        assert!(cap.get(key).is_none(), "capability must not set `{key}`");
    }
    assert!(permissions.iter().all(|p| !p.contains(':') && !p.contains("fs") && !p.contains("core:")), "no plugin, core or fs permission");
}

#[test]
fn only_the_two_commands_are_registered_and_declared_in_the_app_manifest() {
    let lib = read("src/lib.rs");
    let handler = lib.split("generate_handler![").nth(1).expect("generate_handler! present").split(']').next().unwrap();
    let registered: BTreeSet<String> = handler
        .split(',')
        .map(|s| s.trim().trim_start_matches("workspace_commands::").to_string())
        .filter(|s| !s.is_empty())
        .collect();
    assert_eq!(registered, set(&COMMANDS), "registered handlers");

    let build = read("build.rs");
    let declared: BTreeSet<String> = build
        .split("commands(&[")
        .nth(1)
        .expect("build.rs declares an app manifest")
        .split("])")
        .next()
        .unwrap()
        .split(',')
        .map(|s| s.trim().trim_matches('"').to_string())
        .filter(|s| !s.is_empty())
        .collect();
    assert_eq!(declared, set(&COMMANDS), "app manifest commands");
}

#[test]
fn no_tauri_plugin_is_a_dependency_or_registered() {
    let cargo = read("Cargo.toml");
    assert!(!cargo.lines().any(|l| l.trim_start().starts_with("tauri-plugin")), "a tauri-plugin crate is declared");
    let lib = read("src/lib.rs");
    assert!(!lib.contains(".plugin("), "a plugin is registered");
    assert!(!lib.contains("tauri_plugin_"), "a plugin crate is referenced");
}

#[test]
fn the_frontend_has_no_tauri_plugin_package_and_uses_only_the_core_api() {
    let package = json("../package.json");
    for section in ["dependencies", "devDependencies"] {
        for name in package[section].as_object().into_iter().flatten().map(|(k, _)| k) {
            assert!(!name.starts_with("@tauri-apps/plugin-"), "frontend plugin package {name}");
        }
    }
    assert!(package["dependencies"]["@tauri-apps/api"].is_string(), "the supported API package is a dependency");
}

#[test]
fn the_configuration_enables_no_plugin_or_global_tauri_object_or_asset_protocol() {
    let conf = json("tauri.conf.json");
    assert!(conf.get("plugins").is_none(), "no plugin configuration");
    let app = &conf["app"];
    assert!(app.get("withGlobalTauri").is_none_or(|v| v == false), "window.__TAURI__ must stay off");
    assert!(app["security"].get("assetProtocol").is_none(), "no asset protocol (it serves local files)");
    assert!(app["security"].get("dangerousDisableAssetCspModification").is_none());
    assert!(app["security"].get("pattern").is_none() || app["security"]["pattern"]["use"] == "brownfield");
}

#[test]
fn the_frontend_does_not_use_private_tauri_internals() {
    fn walk(dir: &std::path::Path, hits: &mut Vec<String>) {
        for entry in fs::read_dir(dir).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                walk(&path, hits);
            } else if path.extension().is_some_and(|e| e == "ts" || e == "html") {
                let text = fs::read_to_string(&path).unwrap();
                if text.contains("__TAURI_INTERNALS__") || text.contains("window.__TAURI__") {
                    hits.push(path.display().to_string());
                }
            }
        }
    }
    let mut hits = Vec::new();
    walk(std::path::Path::new(&format!("{}/../src", env!("CARGO_MANIFEST_DIR"))), &mut hits);
    assert!(hits.is_empty(), "private Tauri internals used in {hits:?}");
}
