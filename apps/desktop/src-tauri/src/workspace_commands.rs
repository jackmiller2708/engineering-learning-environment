//! The two frontend-facing workspace commands and their DTOs.
//!
//! The frontend sends a workspace name (create) or nothing (list). It never sends or receives a
//! filesystem path, an id to create, or a timestamp to store. Internal errors stay typed in the
//! store; they are translated here into `{ kind, message }` with stable `kind` codes and messages
//! that contain no paths, no `std::io::Error` text and no user-supplied names.

use crate::system_providers::{OsIdSource, SystemClock};
use crate::workspace_manifest::{IdError, ManifestError, NameFieldError, TimestampError};
use crate::workspace_name::NameError;
use crate::workspace_store::{
    Clock, ClockError, CreateError, EntryProblem, IdSource, ListError, WorkspaceEntry, WorkspaceStore,
};
use serde::Serialize;
use std::io;
use tauri::State;

/// A workspace as the frontend sees it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDto {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

/// One directory found under the workspaces folder. `status` tells the two shapes apart.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "lowercase", rename_all_fields = "camelCase")]
pub enum EntryDto {
    Valid { id: String, name: String, created_at: String },
    Invalid { id: String, kind: &'static str, message: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ListWorkspacesResponse {
    pub entries: Vec<EntryDto>,
}

/// The error shape for every command: a stable code and a human-readable explanation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CommandError {
    pub kind: &'static str,
    pub message: String,
}

pub fn list(store: &WorkspaceStore) -> Result<ListWorkspacesResponse, CommandError> {
    let entries = store.list().map_err(list_error)?;
    Ok(ListWorkspacesResponse { entries: entries.into_iter().map(entry_dto).collect() })
}

pub fn create(store: &WorkspaceStore, name: &str, ids: &mut dyn IdSource, clock: &dyn Clock) -> Result<WorkspaceDto, CommandError> {
    let w = store.create(name, ids, clock).map_err(create_error)?;
    Ok(WorkspaceDto { id: w.id, name: w.name.as_str().to_string(), created_at: w.created_at })
}

fn entry_dto(entry: WorkspaceEntry) -> EntryDto {
    match entry {
        WorkspaceEntry::Valid(w) => EntryDto::Valid { id: w.id, name: w.name.as_str().to_string(), created_at: w.created_at },
        WorkspaceEntry::Invalid { id, problem } => {
            let (kind, message) = entry_problem(problem);
            EntryDto::Invalid { id, kind, message }
        }
    }
}

fn error(kind: &'static str, message: impl Into<String>) -> CommandError {
    CommandError { kind, message: message.into() }
}

/// A short, path-free hint for the most useful I/O failures. Never the raw `io::Error` text.
fn io_hint(kind: io::ErrorKind) -> &'static str {
    match kind {
        io::ErrorKind::PermissionDenied => " The application is not allowed to use its data folder.",
        io::ErrorKind::StorageFull => " The disk is full.",
        io::ErrorKind::ReadOnlyFilesystem => " The data folder is read-only.",
        io::ErrorKind::NotFound => " The data folder or a file in it is missing.",
        _ => "",
    }
}

pub(crate) fn create_error(e: CreateError) -> CommandError {
    match e {
        CreateError::InvalidName(NameError::Empty) => error("name_empty", "Enter a name for the workspace."),
        CreateError::InvalidName(NameError::ControlCharacter) => {
            error("name_control_character", "The name contains a control character. Remove it and try again.")
        }
        CreateError::InvalidName(NameError::TooLong) => {
            error("name_too_long", "The name is longer than 64 characters. Use a shorter name.")
        }
        // `validate_name` never reports this; it exists for stored names only.
        CreateError::InvalidName(NameError::NotTrimmed) => error("internal_error", "The name could not be checked. Nothing was created."),
        CreateError::IdCollision => error("id_collision", "Another workspace already uses the generated identifier. Nothing was changed. Try again."),
        CreateError::IdUnavailable => {
            error("id_unavailable", "The system could not provide a secure random identifier. Nothing was created.")
        }
        CreateError::Clock(ClockError::BeforeUnixEpoch) => {
            error("clock_before_epoch", "The system clock is set before 1970. Correct the date and try again.")
        }
        CreateError::Clock(ClockError::OutOfRange) | CreateError::InvalidTimestamp(_) => {
            error("clock_out_of_range", "The system clock is outside the supported range of 1970 to 9999. Correct the date and try again.")
        }
        CreateError::InvalidId => error("internal_error", "A valid workspace identifier could not be generated. Nothing was created."),
        CreateError::RootUnavailable(kind) => {
            error("storage_unavailable", format!("The workspaces folder could not be prepared. Nothing was created.{}", io_hint(kind)))
        }
        CreateError::StagingCreation(kind) => {
            error("storage_write_failed", format!("The workspace could not be started. Nothing was published.{}", io_hint(kind)))
        }
        CreateError::ManifestWrite(kind) => {
            error("storage_write_failed", format!("The workspace could not be written. Nothing was published.{}", io_hint(kind)))
        }
        CreateError::Publication(io::ErrorKind::Unsupported) => error(
            "storage_unsupported",
            "This computer or file system cannot create workspaces safely. Nothing was published.",
        ),
        CreateError::Publication(kind) => {
            error("storage_publish_failed", format!("The workspace could not be published. Nothing was published.{}", io_hint(kind)))
        }
    }
}

pub(crate) fn list_error(e: ListError) -> CommandError {
    let ListError::Root(kind) = e;
    error("storage_unavailable", format!("The list of workspaces could not be read.{}", io_hint(kind)))
}

/// The field a manifest error is about and why it was rejected, in plain words.
fn field_problem(e: &ManifestError) -> (&'static str, &'static str) {
    match e {
        ManifestError::Id(IdError::Missing) => ("id", "it is missing"),
        ManifestError::Id(IdError::NotAString) => ("id", "it is not text"),
        ManifestError::Id(IdError::Invalid) => ("id", "it is not a lowercase version 4 UUID"),
        ManifestError::Name(NameFieldError::Missing) => ("name", "it is missing"),
        ManifestError::Name(NameFieldError::NotAString) => ("name", "it is not text"),
        ManifestError::Name(NameFieldError::MalformedUtf16) => ("name", "it is not valid Unicode text"),
        ManifestError::Name(NameFieldError::Invalid(NameError::Empty)) => ("name", "it is empty"),
        ManifestError::Name(NameFieldError::Invalid(NameError::ControlCharacter)) => ("name", "it contains a control character"),
        ManifestError::Name(NameFieldError::Invalid(NameError::TooLong)) => ("name", "it is longer than 64 characters"),
        ManifestError::Name(NameFieldError::Invalid(NameError::NotTrimmed)) => ("name", "it has spaces at the start or end"),
        ManifestError::CreatedAt(TimestampError::Missing) => ("createdAt", "it is missing"),
        ManifestError::CreatedAt(TimestampError::NotAString) => ("createdAt", "it is not text"),
        ManifestError::CreatedAt(TimestampError::Invalid) => ("createdAt", "it is not a valid UTC time in the form YYYY-MM-DDTHH:MM:SSZ"),
        ManifestError::CreatedAt(TimestampError::OutOfRange) => ("createdAt", "its year is before 1970"),
        // Not field errors; handled by the caller.
        ManifestError::MalformedJson
        | ManifestError::NotAnObject
        | ManifestError::InvalidSchemaVersion
        | ManifestError::UnsupportedVersion(_) => ("", ""),
    }
}

pub(crate) fn entry_problem(p: EntryProblem) -> (&'static str, String) {
    match p {
        EntryProblem::Symlink => ("entry_symlink", "This workspace folder is a link, and links are not followed. Remove or replace it.".into()),
        EntryProblem::ManifestMissing => ("manifest_missing", "This workspace folder has no workspace.json file.".into()),
        EntryProblem::ManifestNotARegularFile => ("manifest_not_a_file", "workspace.json is not an ordinary file (it may be a link or a folder).".into()),
        EntryProblem::ManifestTooLarge => ("manifest_too_large", "workspace.json is larger than 64 KiB and was not read.".into()),
        EntryProblem::ManifestNotUtf8 => ("manifest_not_utf8", "workspace.json is not valid UTF-8 text.".into()),
        EntryProblem::IdMismatch => ("manifest_id_mismatch", "The identifier inside workspace.json does not match the workspace folder.".into()),
        EntryProblem::Io(kind) => ("entry_unreadable", format!("This workspace could not be read.{}", io_hint(kind))),
        EntryProblem::ManifestInvalid(ManifestError::MalformedJson | ManifestError::NotAnObject) => {
            ("manifest_malformed", "workspace.json is not a valid JSON object.".into())
        }
        EntryProblem::ManifestInvalid(ManifestError::InvalidSchemaVersion) => {
            ("manifest_unsupported_version", "workspace.json has no usable schema version. This app reads version 1.".into())
        }
        EntryProblem::ManifestInvalid(ManifestError::UnsupportedVersion(v)) => {
            ("manifest_unsupported_version", format!("workspace.json uses schema version {v}. This app reads version 1."))
        }
        EntryProblem::ManifestInvalid(e) => {
            let (field, why) = field_problem(&e);
            ("manifest_invalid_field", format!("The \"{field}\" field in workspace.json is not valid: {why}."))
        }
    }
}

/// Lists the workspaces. Invalid entries are included, not dropped.
#[tauri::command]
pub async fn list_workspaces(store: State<'_, WorkspaceStore>) -> Result<ListWorkspacesResponse, CommandError> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || list(&store)).await.map_err(|_| worker_failed())?
}

/// Creates a workspace with a generated id and the current time. Only the name comes from the caller.
#[tauri::command]
pub async fn create_workspace(store: State<'_, WorkspaceStore>, name: String) -> Result<WorkspaceDto, CommandError> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || create(&store, &name, &mut OsIdSource, &SystemClock))
        .await
        .map_err(|_| worker_failed())?
}

fn worker_failed() -> CommandError {
    error("internal_error", "The operation did not finish. Nothing was changed that could be confirmed.")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace_store::IdUnavailable;
    use serde_json::{json, Value};
    use std::io::ErrorKind;
    use tempfile::TempDir;

    const A: &str = "0a1b2c3d-1111-4222-8333-444455556666";
    const B: &str = "4f525f09-3c12-449f-872b-c148c25e63ba";
    const T0: i64 = 1_794_899_109;

    struct Ids(Vec<&'static str>);
    impl IdSource for Ids {
        fn next_id(&mut self) -> Result<String, IdUnavailable> {
            Ok(self.0.remove(0).to_string())
        }
    }
    struct Fixed(i64);
    impl Clock for Fixed {
        fn now_unix_seconds(&self) -> Result<i64, ClockError> {
            Ok(self.0)
        }
    }

    fn setup() -> (TempDir, WorkspaceStore) {
        let d = TempDir::new().unwrap();
        let s = WorkspaceStore::new(d.path());
        (d, s)
    }

    fn json_of(v: &impl Serialize) -> Value {
        serde_json::to_value(v).unwrap()
    }

    // ---- contracts -------------------------------------------------------------------------

    #[test]
    fn create_returns_exactly_id_name_and_created_at() {
        let (_d, store) = setup();
        let dto = create(&store, "  My Workspace ", &mut Ids(vec![B]), &Fixed(T0)).unwrap();
        assert_eq!(json_of(&dto), json!({ "id": B, "name": "My Workspace", "createdAt": "2026-11-17T07:05:09Z" }));
    }

    #[test]
    fn list_returns_valid_entries_with_exactly_id_name_and_created_at() {
        let (_d, store) = setup();
        create(&store, "Beta", &mut Ids(vec![B]), &Fixed(T0)).unwrap();
        create(&store, "Alpha", &mut Ids(vec![A]), &Fixed(T0 + 60)).unwrap();
        assert_eq!(
            json_of(&list(&store).unwrap()),
            json!({ "entries": [
                { "status": "valid", "id": A, "name": "Alpha", "createdAt": "2026-11-17T07:06:09Z" },
                { "status": "valid", "id": B, "name": "Beta", "createdAt": "2026-11-17T07:05:09Z" },
            ]})
        );
    }

    #[test]
    fn an_empty_store_lists_no_entries() {
        let (_d, store) = setup();
        assert_eq!(json_of(&list(&store).unwrap()), json!({ "entries": [] }));
    }

    #[test]
    fn invalid_entries_stay_visible_next_to_valid_ones() {
        let (d, store) = setup();
        create(&store, "Beta", &mut Ids(vec![B]), &Fixed(T0)).unwrap();
        let broken = d.path().join("workspaces").join(A);
        std::fs::create_dir_all(&broken).unwrap();
        std::fs::write(broken.join("workspace.json"), "{ nope").unwrap();
        let v = json_of(&list(&store).unwrap());
        let entries = v["entries"].as_array().unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0]["status"], "invalid");
        assert_eq!(entries[0]["id"], A);
        assert_eq!(entries[0]["kind"], "manifest_malformed");
        assert!(!entries[0]["message"].as_str().unwrap().is_empty());
        assert_eq!(entries[0].as_object().unwrap().len(), 4, "status, id, kind, message and nothing else");
        assert_eq!(entries[1]["status"], "valid");
    }

    #[test]
    fn a_root_that_cannot_be_read_is_a_structured_command_error() {
        let (d, store) = setup();
        std::fs::write(d.path().join("workspaces"), "a file, not a directory").unwrap();
        let e = list(&store).unwrap_err();
        assert_eq!(e.kind, "storage_unavailable");
        assert_eq!(json_of(&e).as_object().unwrap().keys().collect::<Vec<_>>(), ["kind", "message"]);
    }

    #[test]
    fn create_failures_are_structured_and_leave_nothing_behind() {
        let (d, store) = setup();
        let e = create(&store, "   ", &mut Ids(vec![B]), &Fixed(T0)).unwrap_err();
        assert_eq!(e.kind, "name_empty");
        let e = create(&store, "a\tb", &mut Ids(vec![B]), &Fixed(T0)).unwrap_err();
        assert_eq!(e.kind, "name_control_character");
        let e = create(&store, &"x".repeat(65), &mut Ids(vec![B]), &Fixed(T0)).unwrap_err();
        assert_eq!(e.kind, "name_too_long");
        assert!(!d.path().join("workspaces").exists());
    }

    #[test]
    fn a_collision_is_reported_distinctly() {
        let (_d, store) = setup();
        create(&store, "One", &mut Ids(vec![B]), &Fixed(T0)).unwrap();
        assert_eq!(create(&store, "Two", &mut Ids(vec![B]), &Fixed(T0)).unwrap_err().kind, "id_collision");
    }

    // ---- error mapping ---------------------------------------------------------------------

    fn all_create_errors() -> Vec<(CreateError, &'static str)> {
        vec![
            (CreateError::IdUnavailable, "id_unavailable"),
            (CreateError::Clock(ClockError::BeforeUnixEpoch), "clock_before_epoch"),
            (CreateError::Clock(ClockError::OutOfRange), "clock_out_of_range"),
            (CreateError::InvalidId, "internal_error"),
            (CreateError::InvalidName(NameError::Empty), "name_empty"),
            (CreateError::InvalidName(NameError::ControlCharacter), "name_control_character"),
            (CreateError::InvalidName(NameError::TooLong), "name_too_long"),
            (CreateError::InvalidName(NameError::NotTrimmed), "internal_error"),
            (CreateError::InvalidTimestamp(TimestampError::OutOfRange), "clock_out_of_range"),
            (CreateError::InvalidTimestamp(TimestampError::Invalid), "clock_out_of_range"),
            (CreateError::RootUnavailable(ErrorKind::PermissionDenied), "storage_unavailable"),
            (CreateError::IdCollision, "id_collision"),
            (CreateError::StagingCreation(ErrorKind::AlreadyExists), "storage_write_failed"),
            (CreateError::ManifestWrite(ErrorKind::StorageFull), "storage_write_failed"),
            (CreateError::Publication(ErrorKind::NotFound), "storage_publish_failed"),
            (CreateError::Publication(ErrorKind::Unsupported), "storage_unsupported"),
        ]
    }

    fn all_entry_problems() -> Vec<(EntryProblem, &'static str)> {
        use ManifestError as M;
        vec![
            (EntryProblem::Symlink, "entry_symlink"),
            (EntryProblem::ManifestMissing, "manifest_missing"),
            (EntryProblem::ManifestNotARegularFile, "manifest_not_a_file"),
            (EntryProblem::ManifestTooLarge, "manifest_too_large"),
            (EntryProblem::ManifestNotUtf8, "manifest_not_utf8"),
            (EntryProblem::IdMismatch, "manifest_id_mismatch"),
            (EntryProblem::Io(ErrorKind::PermissionDenied), "entry_unreadable"),
            (EntryProblem::ManifestInvalid(M::MalformedJson), "manifest_malformed"),
            (EntryProblem::ManifestInvalid(M::NotAnObject), "manifest_malformed"),
            (EntryProblem::ManifestInvalid(M::InvalidSchemaVersion), "manifest_unsupported_version"),
            (EntryProblem::ManifestInvalid(M::UnsupportedVersion(2.0)), "manifest_unsupported_version"),
            (EntryProblem::ManifestInvalid(M::Id(IdError::Missing)), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::Id(IdError::NotAString)), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::Id(IdError::Invalid)), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::Name(NameFieldError::Missing)), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::Name(NameFieldError::NotAString)), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::Name(NameFieldError::MalformedUtf16)), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::Name(NameFieldError::Invalid(NameError::NotTrimmed))), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::CreatedAt(TimestampError::Missing)), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::CreatedAt(TimestampError::NotAString)), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::CreatedAt(TimestampError::Invalid)), "manifest_invalid_field"),
            (EntryProblem::ManifestInvalid(M::CreatedAt(TimestampError::OutOfRange)), "manifest_invalid_field"),
        ]
    }

    fn assert_safe_message(kind: &str, message: &str, context: &str) {
        assert!(!message.trim().is_empty(), "{context}: empty message");
        assert!(message.ends_with('.'), "{context}: a sentence is expected: {message:?}");
        assert!(!message.contains('/') && !message.contains('\\'), "{context}: possible path in {message:?}");
        assert!(!message.contains("os error") && !message.contains("Os {") && !message.contains("Kind("), "{context}: raw io::Error text in {message:?}");
        assert!(!message.contains("::") && !message.contains('{'), "{context}: Rust internals in {message:?}");
        assert_ne!(message, kind, "{context}: the message must explain, not repeat the code");
    }

    #[test]
    fn every_create_error_maps_to_a_stable_kind_and_a_safe_message() {
        for (error, kind) in all_create_errors() {
            let dto = create_error(error);
            assert_eq!(dto.kind, kind, "{error:?}");
            assert_safe_message(dto.kind, &dto.message, &format!("{error:?}"));
        }
    }

    #[test]
    fn every_entry_problem_maps_to_a_stable_kind_and_a_safe_message() {
        for (problem, kind) in all_entry_problems() {
            let (k, message) = entry_problem(problem);
            assert_eq!(k, kind, "{problem:?}");
            assert_safe_message(k, &message, &format!("{problem:?}"));
        }
    }

    #[test]
    fn list_errors_map_for_every_kind_without_leaking_io_text() {
        for kind in [ErrorKind::PermissionDenied, ErrorKind::NotFound, ErrorKind::Other, ErrorKind::StorageFull] {
            let dto = list_error(ListError::Root(kind));
            assert_eq!(dto.kind, "storage_unavailable");
            assert_safe_message(dto.kind, &dto.message, &format!("{kind:?}"));
        }
    }

    #[test]
    fn messages_for_different_problems_differ() {
        let mut messages: Vec<String> = all_create_errors().into_iter().map(|(e, _)| create_error(e).message).collect();
        messages.extend(all_entry_problems().into_iter().map(|(p, _)| entry_problem(p).1));
        let distinct: std::collections::HashSet<_> = messages.iter().collect();
        // Variants that share a kind may share wording only where the wording is the same advice.
        assert!(distinct.len() * 10 >= messages.len() * 6, "{} distinct of {}", distinct.len(), messages.len());
    }

    #[test]
    fn the_unsupported_version_message_names_the_version() {
        let (_, m) = entry_problem(EntryProblem::ManifestInvalid(ManifestError::UnsupportedVersion(7.0)));
        assert!(m.contains('7') && m.contains('1'), "{m}");
    }

    #[test]
    fn an_invalid_field_message_names_the_field() {
        for (e, field) in [
            (ManifestError::Id(IdError::Invalid), "id"),
            (ManifestError::Name(NameFieldError::Missing), "name"),
            (ManifestError::CreatedAt(TimestampError::Invalid), "createdAt"),
        ] {
            let (_, m) = entry_problem(EntryProblem::ManifestInvalid(e));
            assert!(m.contains(field), "{m}");
        }
    }

    #[test]
    fn no_response_or_error_contains_the_data_directory_or_any_path() {
        let (d, store) = setup();
        let secret = d.path().to_str().unwrap().to_string();
        let mut texts = Vec::new();
        // Real results produced against a real directory, including failures.
        texts.push(serde_json::to_string(&create(&store, "Alpha", &mut Ids(vec![A]), &Fixed(T0)).unwrap()).unwrap());
        for name in ["", "a\tb"] {
            texts.push(serde_json::to_string(&create(&store, name, &mut Ids(vec![B]), &Fixed(T0)).unwrap_err()).unwrap());
        }
        texts.push(serde_json::to_string(&create(&store, "Dup", &mut Ids(vec![A]), &Fixed(T0)).unwrap_err()).unwrap());
        let broken = d.path().join("workspaces").join(B);
        std::fs::create_dir_all(broken.join("workspace.json")).unwrap();
        texts.push(serde_json::to_string(&list(&store).unwrap()).unwrap());
        std::fs::remove_dir_all(&broken).unwrap();
        std::fs::write(broken, "not a directory is ignored, not listed").unwrap();
        // Every mapped error, serialized.
        texts.extend(all_create_errors().into_iter().map(|(e, _)| serde_json::to_string(&create_error(e)).unwrap()));
        texts.extend(all_entry_problems().into_iter().map(|(p, _)| serde_json::to_string(&entry_problem(p).1).unwrap()));
        for t in &texts {
            assert!(!t.contains(&secret), "the data directory leaked into {t}");
            assert!(!t.contains('/') && !t.contains("\\\\"), "a path separator in {t}");
        }
        assert!(texts.len() > 40);
    }
}
