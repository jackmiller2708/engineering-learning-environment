//! Filesystem store for workspaces. Independent of Angular and Tauri; every path stays in here.
//!
//! ```text
//! <app-data-dir>/workspaces/<workspace-id>/workspace.json
//! <app-data-dir>/workspaces/.staging-<workspace-id>/        (implementation detail, never listed)
//! ```
//!
//! See the individual methods for behaviour and limitations.

use crate::workspace_manifest::{
    create_workspace, decode_manifest, encode_manifest, is_uuid_v4, ManifestError, NewWorkspaceError, TimestampError, Workspace,
};
use crate::workspace_name::NameError;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

/// Strict upper bound for `workspace.json`, checked before any JSON decoding.
pub const MAX_MANIFEST_BYTES: u64 = 64 * 1024;

const MANIFEST_FILE: &str = "workspace.json";
const STAGING_PREFIX: &str = ".staging-";

/// The operating system could not supply random bytes. There is no weaker fallback.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IdUnavailable;

/// Why the clock could not supply a usable time.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClockError {
    /// The system time is before 1970-01-01T00:00:00Z.
    BeforeUnixEpoch,
    /// The system time does not fit in a signed 64-bit count of seconds.
    OutOfRange,
}

/// Supplies new workspace ids (canonical lowercase UUID v4). Randomness lives behind this boundary.
pub trait IdSource {
    fn next_id(&mut self) -> Result<String, IdUnavailable>;
}

/// Supplies the current time as Unix seconds (UTC). The clock lives behind this boundary.
pub trait Clock {
    fn now_unix_seconds(&self) -> Result<i64, ClockError>;
}

/// One directory under `workspaces/` whose name is a canonical UUID v4.
#[derive(Debug, Clone, PartialEq)]
pub enum WorkspaceEntry {
    Valid(Workspace),
    Invalid { id: String, problem: EntryProblem },
}

impl WorkspaceEntry {
    pub fn id(&self) -> &str {
        match self {
            Self::Valid(w) => &w.id,
            Self::Invalid { id, .. } => id,
        }
    }
}

/// Why one entry is not a usable workspace. Carries no paths.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EntryProblem {
    /// The UUID-named entry is a symbolic link. It is never followed.
    Symlink,
    ManifestMissing,
    /// `workspace.json` is a symlink, a directory or another non-regular file. Never followed.
    ManifestNotARegularFile,
    /// `workspace.json` is larger than `MAX_MANIFEST_BYTES`. It was not decoded.
    ManifestTooLarge,
    ManifestNotUtf8,
    ManifestInvalid(ManifestError),
    /// The manifest is valid but its `id` differs from the directory name.
    IdMismatch,
    Io(io::ErrorKind),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ListError {
    /// The `workspaces` directory exists but cannot be enumerated.
    Root(io::ErrorKind),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CreateError {
    /// The id source failed (no randomness available).
    IdUnavailable,
    /// The clock failed (before 1970, or out of range).
    Clock(ClockError),
    /// The id source returned something that is not a canonical UUID v4.
    InvalidId,
    InvalidName(NameError),
    InvalidTimestamp(TimestampError),
    /// The `workspaces` directory cannot be created or inspected.
    RootUnavailable(io::ErrorKind),
    /// A workspace directory with this id already exists. Nothing was changed.
    IdCollision,
    StagingCreation(io::ErrorKind),
    ManifestWrite(io::ErrorKind),
    /// The staging directory could not be renamed to its final name. It is left in place.
    Publication(io::ErrorKind),
}

#[derive(Debug, Clone)]
pub struct WorkspaceStore {
    root: PathBuf,
}

impl WorkspaceStore {
    /// `app_data_dir` is the application's data directory; workspaces live in its `workspaces` subdirectory.
    pub fn new(app_data_dir: &Path) -> Self {
        Self { root: app_data_dir.join("workspaces") }
    }

    /// Lists the UUID-named directories under `workspaces/`, sorted by id.
    ///
    /// * A missing `workspaces` directory (first run) is an empty list; any other failure to
    ///   enumerate it is `ListError::Root`.
    /// * Names that are not canonical lowercase UUID v4, staging directories and non-directory
    ///   files are ignored. A UUID-named symlink is reported as `Symlink` and never followed.
    /// * Each entry is read independently: one bad entry never hides the others.
    /// * Nothing is repaired, deleted, migrated or rewritten.
    pub fn list(&self) -> Result<Vec<WorkspaceEntry>, ListError> {
        let dir = match std::fs::read_dir(&self.root) {
            Ok(dir) => dir,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(ListError::Root(e.kind())),
        };
        let mut entries = Vec::new();
        for item in dir {
            let item = item.map_err(|e| ListError::Root(e.kind()))?;
            let Some(id) = item.file_name().to_str().filter(|n| is_uuid_v4(n)).map(str::to_owned) else {
                continue;
            };
            match item.file_type() {
                // `DirEntry::file_type` does not follow symlinks.
                Ok(t) if t.is_symlink() => entries.push(WorkspaceEntry::Invalid { id, problem: EntryProblem::Symlink }),
                Ok(t) if t.is_dir() => entries.push(self.read_entry(id)),
                Ok(_) => {}
                Err(e) => entries.push(WorkspaceEntry::Invalid { id, problem: EntryProblem::Io(e.kind()) }),
            }
        }
        entries.sort_by(|a, b| a.id().cmp(b.id()));
        Ok(entries)
    }

    fn read_entry(&self, id: String) -> WorkspaceEntry {
        match self.read_manifest(&id) {
            Ok(w) if w.id == id => WorkspaceEntry::Valid(w),
            Ok(_) => WorkspaceEntry::Invalid { id, problem: EntryProblem::IdMismatch },
            Err(problem) => WorkspaceEntry::Invalid { id, problem },
        }
    }

    /// Reads `workspace.json` without following symlinks, bounded by `MAX_MANIFEST_BYTES`.
    fn read_manifest(&self, id: &str) -> Result<Workspace, EntryProblem> {
        let path = self.root.join(id).join(MANIFEST_FILE);
        let io_problem = |e: io::Error| match e.kind() {
            io::ErrorKind::NotFound => EntryProblem::ManifestMissing,
            kind => EntryProblem::Io(kind),
        };
        let meta = std::fs::symlink_metadata(&path).map_err(io_problem)?;
        if !meta.is_file() {
            return Err(EntryProblem::ManifestNotARegularFile); // symlink, directory, device ...
        }
        let file = std::fs::File::open(&path).map_err(io_problem)?;
        let bytes = read_limited(file, meta.len())?;
        let text = String::from_utf8(bytes).map_err(|_| EntryProblem::ManifestNotUtf8)?;
        decode_manifest(&text).map_err(EntryProblem::ManifestInvalid)
    }

    pub fn create(&self, name: &str, ids: &mut dyn IdSource, clock: &dyn Clock) -> Result<Workspace, CreateError> {
        let id = ids.next_id().map_err(|IdUnavailable| CreateError::IdUnavailable)?;
        let now = clock.now_unix_seconds().map_err(CreateError::Clock)?;
        let workspace = create_workspace(&id, name, now).map_err(|e| match e {
            NewWorkspaceError::InvalidId => CreateError::InvalidId,
            NewWorkspaceError::InvalidName(n) => CreateError::InvalidName(n),
            NewWorkspaceError::InvalidTimestamp(t) => CreateError::InvalidTimestamp(t),
        })?;
        self.publish(&workspace, &write_new_file, &rename_no_replace)?;
        Ok(workspace)
    }

    /// Validates the name, takes an id and the time from the injected boundaries, then publishes.
    /// Success is returned only after the final directory exists.
    ///
    /// Publication: create `.staging-<id>` next to the final directory (same filesystem), write
    /// and flush `workspace.json` into it, then publish it with `rename_no_replace`. An existing
    /// `<id>` entry of any kind is an `IdCollision` and is never replaced, including one that
    /// appears after the early existence check below. Failures leave the staging directory in
    /// place; nothing cleans it up automatically.
    ///
    /// `write` and `rename` are private test seams; production passes `write_new_file` and
    /// `rename_no_replace`.
    fn publish(
        &self,
        workspace: &Workspace,
        write: &dyn Fn(&Path, &[u8]) -> io::Result<()>,
        rename: &dyn Fn(&Path, &Path) -> Result<(), RenameError>,
    ) -> Result<(), CreateError> {
        let final_dir = self.root.join(&workspace.id);
        let staging = self.root.join(format!("{STAGING_PREFIX}{}", workspace.id));
        std::fs::create_dir_all(&self.root).map_err(|e| CreateError::RootUnavailable(e.kind()))?;
        // Early exit that avoids creating staging for a known collision. The guarantee itself
        // comes from `rename_no_replace`, which also covers a destination created after this check.
        match std::fs::symlink_metadata(&final_dir) {
            Ok(_) => return Err(CreateError::IdCollision),
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(CreateError::RootUnavailable(e.kind())),
        }
        std::fs::create_dir(&staging).map_err(|e| CreateError::StagingCreation(e.kind()))?;
        write(&staging.join(MANIFEST_FILE), encode_manifest(workspace).as_bytes()).map_err(|e| CreateError::ManifestWrite(e.kind()))?;
        rename(&staging, &final_dir).map_err(|e| match e {
            RenameError::Exists => CreateError::IdCollision,
            RenameError::Failed(kind) => CreateError::Publication(kind),
        })
    }
}

/// Reads a manifest of at most `MAX_MANIFEST_BYTES`. `declared_len` is the size reported by the
/// file's metadata, which can be stale by the time of reading, so the limit is enforced by the
/// read itself:
///
/// 1. a declared size over the limit is rejected without reading;
/// 2. at most `MAX_MANIFEST_BYTES + 1` bytes are ever requested from `reader`;
/// 3. more than `MAX_MANIFEST_BYTES` bytes actually read is rejected.
///
/// The caller decodes only what this returns.
fn read_limited(reader: impl Read, declared_len: u64) -> Result<Vec<u8>, EntryProblem> {
    if declared_len > MAX_MANIFEST_BYTES {
        return Err(EntryProblem::ManifestTooLarge);
    }
    let mut bytes = Vec::new();
    reader.take(MAX_MANIFEST_BYTES + 1).read_to_end(&mut bytes).map_err(|e| EntryProblem::Io(e.kind()))?;
    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err(EntryProblem::ManifestTooLarge);
    }
    Ok(bytes)
}

/// Outcome of `rename_no_replace`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RenameError {
    /// Something already exists at the destination. It was not touched.
    Exists,
    Failed(io::ErrorKind),
}

/// Atomically renames `from` to `to`, failing instead of replacing anything at `to`.
///
/// Linux: `renameat2(RENAME_NOREPLACE)`, a single kernel operation. If anything exists at `to`
/// (empty or non-empty directory, file, symlink, dangling symlink) it fails with `EEXIST` and
/// changes nothing; a symlink at `to` is neither followed nor replaced. Plain `rename` is NOT
/// used: it replaces an empty destination directory.
///
/// A filesystem that does not support the flag makes the call fail (`EINVAL`) and that is
/// reported as `Failed(Unsupported)`. There is no fallback to a weaker rename.
#[cfg(target_os = "linux")]
fn rename_no_replace(from: &Path, to: &Path) -> Result<(), RenameError> {
    use rustix::fs::{renameat_with, RenameFlags, CWD};
    rename_no_replace_with(from, to, |from, to| renameat_with(CWD, from, CWD, to, RenameFlags::NOREPLACE))
}

/// One no-replacement kernel call, then error classification. Nothing else: there is no second
/// attempt. `syscall` is a private test seam so that "the kernel does not support this" can be
/// simulated; production passes the `renameat2` call above.
#[cfg(target_os = "linux")]
fn rename_no_replace_with(
    from: &Path,
    to: &Path,
    syscall: impl FnOnce(&Path, &Path) -> rustix::io::Result<()>,
) -> Result<(), RenameError> {
    syscall(from, to).map_err(classify_rename_error)
}

#[cfg(target_os = "linux")]
fn classify_rename_error(errno: rustix::io::Errno) -> RenameError {
    use rustix::io::Errno;
    match errno {
        Errno::EXIST => RenameError::Exists,
        Errno::INVAL | Errno::NOSYS => RenameError::Failed(io::ErrorKind::Unsupported),
        other => RenameError::Failed(io::Error::from(other).kind()),
    }
}

/// Other platforms have no implementation of the no-replace guarantee yet, so publication fails
/// explicitly instead of silently using a weaker operation.
#[cfg(not(target_os = "linux"))]
fn rename_no_replace(_from: &Path, _to: &Path) -> Result<(), RenameError> {
    Err(RenameError::Failed(io::ErrorKind::Unsupported))
}

/// Creates `path` (must not exist), writes everything, flushes it to disk and closes it.
fn write_new_file(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    const A: &str = "0a1b2c3d-1111-4222-8333-444455556666";
    const B: &str = "4f525f09-3c12-449f-872b-c148c25e63ba";
    const C: &str = "d0d0d0d0-2222-4333-9444-555566667777";
    const T0: i64 = 1_794_899_109; // 2026-11-17T07:05:09Z

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
    struct NoRandomness;
    impl IdSource for NoRandomness {
        fn next_id(&mut self) -> Result<String, IdUnavailable> {
            Err(IdUnavailable)
        }
    }
    struct BrokenClock(ClockError);
    impl Clock for BrokenClock {
        fn now_unix_seconds(&self) -> Result<i64, ClockError> {
            Err(self.0)
        }
    }

    fn setup() -> (TempDir, WorkspaceStore) {
        let dir = TempDir::new().unwrap();
        let store = WorkspaceStore::new(dir.path());
        (dir, store)
    }

    fn root(dir: &TempDir) -> PathBuf {
        dir.path().join("workspaces")
    }

    fn create(store: &WorkspaceStore, id: &'static str, name: &str) -> Result<Workspace, CreateError> {
        store.create(name, &mut Ids(vec![id]), &Fixed(T0))
    }

    /// Writes a workspace directory by hand, the way a valid store would have.
    fn put_manifest(dir: &TempDir, id: &str, text: &str) {
        let d = root(dir).join(id);
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join(MANIFEST_FILE), text).unwrap();
    }

    fn valid_text(id: &str, name: &str) -> String {
        encode_manifest(&create_workspace(id, name, T0).unwrap())
    }

    fn problem(entries: &[WorkspaceEntry], id: &str) -> EntryProblem {
        match entries.iter().find(|e| e.id() == id) {
            Some(WorkspaceEntry::Invalid { problem, .. }) => *problem,
            other => panic!("expected an invalid entry for {id}, got {other:?}"),
        }
    }

    // ---- listing -------------------------------------------------------------------------

    #[test]
    fn a_missing_root_is_an_empty_list() {
        let (_d, store) = setup();
        assert_eq!(store.list(), Ok(vec![]));
    }

    #[test]
    fn an_empty_root_is_an_empty_list() {
        let (d, store) = setup();
        fs::create_dir_all(root(&d)).unwrap();
        assert_eq!(store.list(), Ok(vec![]));
    }

    #[test]
    fn a_root_that_cannot_be_enumerated_is_a_list_error() {
        let (d, store) = setup();
        fs::write(root(&d), "not a directory").unwrap();
        assert!(matches!(store.list(), Err(ListError::Root(_))));
    }

    #[test]
    fn lists_valid_workspaces_sorted_by_id_regardless_of_creation_order() {
        let (d, store) = setup();
        put_manifest(&d, C, &valid_text(C, "Gamma"));
        put_manifest(&d, A, &valid_text(A, "Alpha"));
        put_manifest(&d, B, &valid_text(B, "Beta"));
        let entries = store.list().unwrap();
        assert_eq!(entries.iter().map(WorkspaceEntry::id).collect::<Vec<_>>(), [A, B, C]);
        match &entries[1] {
            WorkspaceEntry::Valid(w) => assert_eq!((w.name.as_str(), w.created_at.as_str()), ("Beta", "2026-11-17T07:05:09Z")),
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn an_invalid_manifest_does_not_hide_the_valid_ones() {
        let (d, store) = setup();
        put_manifest(&d, A, &valid_text(A, "Alpha"));
        put_manifest(&d, B, "{ not json");
        put_manifest(&d, C, &valid_text(C, "Gamma"));
        let entries = store.list().unwrap();
        assert_eq!(entries.len(), 3);
        assert!(matches!(entries[0], WorkspaceEntry::Valid(_)));
        assert_eq!(problem(&entries, B), EntryProblem::ManifestInvalid(ManifestError::MalformedJson));
        assert!(matches!(entries[2], WorkspaceEntry::Valid(_)));
    }

    #[test]
    fn a_schema_violation_names_the_field() {
        let (d, store) = setup();
        put_manifest(&d, A, &format!(r#"{{"schemaVersion":1,"id":"{A}","name":" padded ","createdAt":"2026-11-17T07:05:09Z"}}"#));
        let p = problem(&store.list().unwrap(), A);
        assert_eq!(p, EntryProblem::ManifestInvalid(ManifestError::Name(crate::workspace_manifest::NameFieldError::Invalid(NameError::NotTrimmed))));
    }

    #[test]
    fn a_missing_manifest_is_an_invalid_entry() {
        let (d, store) = setup();
        fs::create_dir_all(root(&d).join(A)).unwrap();
        assert_eq!(problem(&store.list().unwrap(), A), EntryProblem::ManifestMissing);
    }

    #[test]
    fn a_manifest_that_is_a_directory_is_not_a_regular_file() {
        let (d, store) = setup();
        fs::create_dir_all(root(&d).join(A).join(MANIFEST_FILE)).unwrap();
        assert_eq!(problem(&store.list().unwrap(), A), EntryProblem::ManifestNotARegularFile);
    }

    #[test]
    fn a_manifest_that_is_not_utf8_is_invalid() {
        let (d, store) = setup();
        let dir = root(&d).join(A);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(MANIFEST_FILE), [0xff, 0xfe, b'{', b'}']).unwrap();
        assert_eq!(problem(&store.list().unwrap(), A), EntryProblem::ManifestNotUtf8);
    }

    #[test]
    fn a_manifest_whose_id_differs_from_its_directory_is_invalid() {
        let (d, store) = setup();
        put_manifest(&d, A, &valid_text(B, "Beta"));
        assert_eq!(problem(&store.list().unwrap(), A), EntryProblem::IdMismatch);
    }

    #[test]
    fn an_oversized_manifest_is_rejected_before_decoding() {
        let (d, store) = setup();
        // Valid JSON that the decoder would accept (unknown padding is ignored), one byte over the limit.
        let base = valid_text(A, "Alpha");
        let head = base.trim_end().trim_end_matches('}').to_string();
        let filler = |total: u64| {
            let overhead = head.len() + r#","pad":"""#.len() + 1; // closing brace
            format!("{head},\"pad\":\"{}\"}}", "x".repeat(total as usize - overhead))
        };
        let at_limit = filler(MAX_MANIFEST_BYTES);
        let over = filler(MAX_MANIFEST_BYTES + 1);
        assert_eq!((at_limit.len() as u64, over.len() as u64), (MAX_MANIFEST_BYTES, MAX_MANIFEST_BYTES + 1));
        assert!(decode_manifest(&over).is_ok(), "the decoder alone would accept the oversized text");

        put_manifest(&d, A, &over);
        put_manifest(&d, B, &at_limit.replace(A, B));
        let entries = store.list().unwrap();
        assert_eq!(problem(&entries, A), EntryProblem::ManifestTooLarge);
        assert!(matches!(entries.iter().find(|e| e.id() == B), Some(WorkspaceEntry::Valid(_))), "exactly 64 KiB is accepted");
    }

    #[test]
    fn non_uuid_names_staging_directories_and_files_are_ignored() {
        let (d, store) = setup();
        let r = root(&d);
        put_manifest(&d, A, &valid_text(A, "Alpha"));
        for ignored in ["notes", "Workspace", &A.to_uppercase(), "0a1b2c3d-1111-1222-8333-444455556666" /* version 1 */, &format!("{STAGING_PREFIX}{B}")] {
            put_manifest(&d, ignored, &valid_text(B, "Ignored")); // directories with a plausible manifest
        }
        fs::write(r.join(B), "a file named like a workspace id").unwrap();
        fs::write(r.join("README.txt"), "x").unwrap();
        let entries = store.list().unwrap();
        assert_eq!(entries.iter().map(WorkspaceEntry::id).collect::<Vec<_>>(), [A]);
    }

    #[cfg(unix)]
    #[test]
    fn a_symlinked_workspace_directory_is_reported_and_not_followed() {
        let (d, store) = setup();
        let elsewhere = TempDir::new().unwrap();
        fs::write(elsewhere.path().join(MANIFEST_FILE), valid_text(B, "Outside")).unwrap();
        fs::create_dir_all(root(&d)).unwrap();
        std::os::unix::fs::symlink(elsewhere.path(), root(&d).join(B)).unwrap();
        let entries = store.list().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(problem(&entries, B), EntryProblem::Symlink);
    }

    #[cfg(unix)]
    #[test]
    fn a_dangling_workspace_symlink_is_reported() {
        let (d, store) = setup();
        fs::create_dir_all(root(&d)).unwrap();
        std::os::unix::fs::symlink(d.path().join("gone"), root(&d).join(B)).unwrap();
        assert_eq!(problem(&store.list().unwrap(), B), EntryProblem::Symlink);
    }

    #[cfg(unix)]
    #[test]
    fn a_symlinked_manifest_is_not_followed() {
        let (d, store) = setup();
        let elsewhere = TempDir::new().unwrap();
        let target = elsewhere.path().join("real.json");
        fs::write(&target, valid_text(A, "Outside")).unwrap();
        fs::create_dir_all(root(&d).join(A)).unwrap();
        std::os::unix::fs::symlink(&target, root(&d).join(A).join(MANIFEST_FILE)).unwrap();
        assert_eq!(problem(&store.list().unwrap(), A), EntryProblem::ManifestNotARegularFile);
    }

    // ---- creation ------------------------------------------------------------------------

    #[test]
    fn creates_a_workspace_that_lists_and_decodes_again() {
        let (d, store) = setup();
        let ws = create(&store, B, "  My Workspace ").unwrap();
        assert_eq!((ws.id.as_str(), ws.name.as_str(), ws.created_at.as_str()), (B, "My Workspace", "2026-11-17T07:05:09Z"));
        // The published directory holds exactly the manifest; the staging directory is gone.
        let names: Vec<_> = fs::read_dir(root(&d)).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        assert_eq!(names, [B]);
        let files: Vec<_> = fs::read_dir(root(&d).join(B)).unwrap().map(|e| e.unwrap().file_name().into_string().unwrap()).collect();
        assert_eq!(files, [MANIFEST_FILE]);
        let text = fs::read_to_string(root(&d).join(B).join(MANIFEST_FILE)).unwrap();
        assert_eq!(text, encode_manifest(&ws));
        assert_eq!(decode_manifest(&text), Ok(ws.clone()));
        assert_eq!(store.list().unwrap(), [WorkspaceEntry::Valid(ws)]);
    }

    #[test]
    fn creates_the_workspaces_directory_when_missing() {
        let (d, store) = setup();
        assert!(!root(&d).exists());
        create(&store, A, "Alpha").unwrap();
        assert!(root(&d).is_dir());
    }

    #[test]
    fn an_invalid_name_creates_nothing_on_disk() {
        let (d, store) = setup();
        for (name, want) in [("", NameError::Empty), ("   ", NameError::Empty), ("a\tb", NameError::ControlCharacter), (&"x".repeat(65), NameError::TooLong)] {
            assert_eq!(create(&store, A, name), Err(CreateError::InvalidName(want)), "{name:?}");
        }
        assert!(!root(&d).exists(), "not even the workspaces directory was created");
    }

    #[test]
    fn a_failing_id_source_is_reported_and_creates_nothing() {
        let (d, store) = setup();
        assert_eq!(store.create("Alpha", &mut NoRandomness, &Fixed(T0)), Err(CreateError::IdUnavailable));
        assert!(!root(&d).exists());
    }

    #[test]
    fn a_failing_clock_is_reported_with_its_reason_and_creates_nothing() {
        let (d, store) = setup();
        for reason in [ClockError::BeforeUnixEpoch, ClockError::OutOfRange] {
            assert_eq!(store.create("Alpha", &mut Ids(vec![A]), &BrokenClock(reason)), Err(CreateError::Clock(reason)));
        }
        assert!(!root(&d).exists());
    }

    #[test]
    fn an_invalid_id_or_time_creates_nothing_on_disk() {
        let (d, store) = setup();
        assert_eq!(store.create("Alpha", &mut Ids(vec!["not-a-uuid"]), &Fixed(T0)), Err(CreateError::InvalidId));
        assert_eq!(store.create("Alpha", &mut Ids(vec![A]), &Fixed(-1)), Err(CreateError::InvalidTimestamp(TimestampError::OutOfRange)));
        assert!(!root(&d).exists());
    }

    #[test]
    fn an_existing_workspace_is_never_overwritten() {
        let (d, store) = setup();
        let first = create(&store, A, "Original").unwrap();
        let path = root(&d).join(A).join(MANIFEST_FILE);
        let before = fs::read(&path).unwrap();
        assert_eq!(create(&store, A, "Replacement"), Err(CreateError::IdCollision));
        assert_eq!(fs::read(&path).unwrap(), before);
        assert_eq!(store.list().unwrap(), [WorkspaceEntry::Valid(first)]);
        assert!(!root(&d).join(format!("{STAGING_PREFIX}{A}")).exists(), "a collision leaves no staging directory");
    }

    #[test]
    fn an_empty_directory_with_the_same_id_is_also_a_collision() {
        // `rename` would silently replace an empty directory, so the store checks first.
        let (d, store) = setup();
        fs::create_dir_all(root(&d).join(A)).unwrap();
        assert_eq!(create(&store, A, "Alpha"), Err(CreateError::IdCollision));
        assert_eq!(fs::read_dir(root(&d).join(A)).unwrap().count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn a_symlink_with_the_same_id_is_a_collision() {
        let (d, store) = setup();
        let elsewhere = TempDir::new().unwrap();
        fs::create_dir_all(root(&d)).unwrap();
        std::os::unix::fs::symlink(elsewhere.path(), root(&d).join(A)).unwrap();
        assert_eq!(create(&store, A, "Alpha"), Err(CreateError::IdCollision));
        assert_eq!(fs::read_dir(elsewhere.path()).unwrap().count(), 0, "nothing was written through the link");
    }

    #[test]
    fn an_abandoned_staging_directory_blocks_creation_and_is_left_alone() {
        let (d, store) = setup();
        let staging = root(&d).join(format!("{STAGING_PREFIX}{A}"));
        fs::create_dir_all(&staging).unwrap();
        fs::write(staging.join("leftover"), "x").unwrap();
        assert_eq!(create(&store, A, "Alpha"), Err(CreateError::StagingCreation(io::ErrorKind::AlreadyExists)));
        assert!(staging.join("leftover").exists(), "no automatic cleanup");
        assert!(!root(&d).join(A).exists());
    }

    #[test]
    fn a_failed_manifest_write_publishes_nothing() {
        let (d, store) = setup();
        let ws = create_workspace(A, "Alpha", T0).unwrap();
        // A writer that really writes half the manifest to the staging directory, then fails.
        let failing = |path: &Path, bytes: &[u8]| -> io::Result<()> {
            fs::write(path, &bytes[..bytes.len() / 2])?;
            Err(io::Error::new(io::ErrorKind::StorageFull, "disk full"))
        };
        assert_eq!(store.publish(&ws, &failing, &rename_no_replace), Err(CreateError::ManifestWrite(io::ErrorKind::StorageFull)));
        assert!(!root(&d).join(A).exists(), "no final directory");
        assert!(root(&d).join(format!("{STAGING_PREFIX}{A}")).join(MANIFEST_FILE).exists(), "the partial staging directory is left, not cleaned up");
        assert_eq!(store.list(), Ok(vec![]), "a staging directory is never listed");
    }

    #[test]
    fn a_destination_that_appears_after_the_check_is_a_collision_and_is_not_replaced() {
        let (d, store) = setup();
        let ws = create_workspace(A, "Alpha", T0).unwrap();
        let root_dir = root(&d);
        // The writer plants an EMPTY directory at the final name after the existence check passed.
        let saboteur = |path: &Path, bytes: &[u8]| -> io::Result<()> {
            write_new_file(path, bytes)?;
            fs::create_dir(root_dir.join(A))
        };
        assert_eq!(store.publish(&ws, &saboteur, &rename_no_replace), Err(CreateError::IdCollision));
        assert_eq!(fs::read_dir(root(&d).join(A)).unwrap().count(), 0, "the planted directory was not replaced");
        assert!(root(&d).join(format!("{STAGING_PREFIX}{A}")).join(MANIFEST_FILE).exists(), "staging is left in place");
    }

    #[test]
    fn a_failed_publication_is_reported_and_leaves_no_final_directory() {
        let (d, store) = setup();
        let ws = create_workspace(A, "Alpha", T0).unwrap();
        let staging = root(&d).join(format!("{STAGING_PREFIX}{A}"));
        // The writer removes the staging directory, so the rename has nothing to publish.
        let saboteur = |path: &Path, bytes: &[u8]| -> io::Result<()> {
            write_new_file(path, bytes)?;
            fs::remove_dir_all(&staging)
        };
        assert_eq!(store.publish(&ws, &saboteur, &rename_no_replace), Err(CreateError::Publication(io::ErrorKind::NotFound)));
        assert!(!root(&d).join(A).exists());
    }

    #[test]
    fn a_manifest_written_by_the_store_is_within_the_size_limit() {
        let ws = create_workspace(A, &"\u{1F600}".repeat(64), T0).unwrap();
        assert!((encode_manifest(&ws).len() as u64) < MAX_MANIFEST_BYTES / 100);
    }

    // ---- no-replace publication (real filesystem, real primitive) ------------------------

    /// A staging-like directory holding one marker file.
    fn dir_with_marker(parent: &Path, name: &str, marker: &str) -> PathBuf {
        let d = parent.join(name);
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("marker"), marker).unwrap();
        d
    }

    fn marker(dir: &Path) -> String {
        fs::read_to_string(dir.join("marker")).unwrap()
    }

    #[test]
    fn rename_no_replace_publishes_when_the_destination_is_absent() {
        let tmp = TempDir::new().unwrap();
        let from = dir_with_marker(tmp.path(), "from", "new");
        let to = tmp.path().join("to");
        assert_eq!(rename_no_replace(&from, &to), Ok(()));
        assert_eq!(marker(&to), "new");
        assert!(!from.exists(), "the source moved");
    }

    #[test]
    fn rename_no_replace_never_replaces_an_empty_directory() {
        let tmp = TempDir::new().unwrap();
        let from = dir_with_marker(tmp.path(), "from", "new");
        let to = tmp.path().join("to");
        fs::create_dir(&to).unwrap();
        assert_eq!(rename_no_replace(&from, &to), Err(RenameError::Exists));
        assert_eq!(fs::read_dir(&to).unwrap().count(), 0, "the empty destination is unchanged");
        assert_eq!(marker(&from), "new", "the source is unchanged");
    }

    #[test]
    fn rename_no_replace_never_replaces_a_non_empty_directory() {
        let tmp = TempDir::new().unwrap();
        let from = dir_with_marker(tmp.path(), "from", "new");
        let to = dir_with_marker(tmp.path(), "to", "old");
        assert_eq!(rename_no_replace(&from, &to), Err(RenameError::Exists));
        assert_eq!(marker(&to), "old");
        assert_eq!(fs::read_dir(&to).unwrap().count(), 1);
        assert_eq!(marker(&from), "new");
    }

    #[test]
    fn rename_no_replace_never_replaces_a_file() {
        let tmp = TempDir::new().unwrap();
        let from = dir_with_marker(tmp.path(), "from", "new");
        let to = tmp.path().join("to");
        fs::write(&to, "squatter").unwrap();
        assert_eq!(rename_no_replace(&from, &to), Err(RenameError::Exists));
        assert_eq!(fs::read_to_string(&to).unwrap(), "squatter");
    }

    #[cfg(unix)]
    #[test]
    fn rename_no_replace_never_follows_or_replaces_a_symlink() {
        let tmp = TempDir::new().unwrap();
        let from = dir_with_marker(tmp.path(), "from", "new");
        let target = dir_with_marker(tmp.path(), "target", "target-content");
        let to = tmp.path().join("to");
        std::os::unix::fs::symlink(&target, &to).unwrap();
        assert_eq!(rename_no_replace(&from, &to), Err(RenameError::Exists));
        assert_eq!(fs::read_link(&to).unwrap(), target, "the link is unchanged");
        assert_eq!(fs::read_dir(&target).unwrap().count(), 1, "nothing was moved into the target");
        assert_eq!(marker(&target), "target-content");
        assert_eq!(marker(&from), "new");
    }

    #[cfg(unix)]
    #[test]
    fn rename_no_replace_never_replaces_a_dangling_symlink() {
        let tmp = TempDir::new().unwrap();
        let from = dir_with_marker(tmp.path(), "from", "new");
        let to = tmp.path().join("to");
        std::os::unix::fs::symlink(tmp.path().join("nowhere"), &to).unwrap();
        assert_eq!(rename_no_replace(&from, &to), Err(RenameError::Exists));
        assert!(fs::symlink_metadata(&to).unwrap().file_type().is_symlink());
        assert!(!tmp.path().join("nowhere").exists());
    }

    #[test]
    fn rename_no_replace_reports_other_failures_with_their_kind() {
        let tmp = TempDir::new().unwrap();
        let err = rename_no_replace(&tmp.path().join("missing"), &tmp.path().join("to")).unwrap_err();
        assert_eq!(err, RenameError::Failed(io::ErrorKind::NotFound));
    }

    #[test]
    fn competing_renames_let_at_most_one_win_and_the_winner_is_never_replaced() {
        use std::sync::{Arc, Barrier};
        for round in 0..50 {
            let tmp = TempDir::new().unwrap();
            let to = tmp.path().join("to");
            let contenders = 8;
            let barrier = Arc::new(Barrier::new(contenders));
            let handles: Vec<_> = (0..contenders)
                .map(|i| {
                    let from = dir_with_marker(tmp.path(), &format!("from-{i}"), &format!("contender-{i}"));
                    let (to, barrier) = (to.clone(), barrier.clone());
                    std::thread::spawn(move || {
                        barrier.wait();
                        (i, rename_no_replace(&from, &to))
                    })
                })
                .collect();
            let results: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();
            let winners: Vec<_> = results.iter().filter(|(_, r)| r.is_ok()).map(|(i, _)| *i).collect();
            assert_eq!(winners.len(), 1, "round {round}: {results:?}");
            assert!(results.iter().filter(|(_, r)| r.is_err()).all(|(_, r)| *r == Err(RenameError::Exists)), "round {round}: {results:?}");
            assert_eq!(marker(&to), format!("contender-{}", winners[0]), "round {round}: the winner's content survives");
            for (i, r) in &results {
                if r.is_err() {
                    assert_eq!(marker(&tmp.path().join(format!("from-{i}"))), format!("contender-{i}"), "a loser keeps its own directory");
                }
            }
        }
    }

    #[test]
    fn concurrent_creation_with_the_same_id_publishes_exactly_one_workspace() {
        use std::sync::{Arc, Barrier};
        for round in 0..25 {
            let (d, store) = setup();
            let contenders = 8;
            let barrier = Arc::new(Barrier::new(contenders));
            let handles: Vec<_> = (0..contenders)
                .map(|i| {
                    let (store, barrier) = (store.clone(), barrier.clone());
                    std::thread::spawn(move || {
                        barrier.wait();
                        (i, store.create(&format!("Contender {i}"), &mut Ids(vec![A]), &Fixed(T0)))
                    })
                })
                .collect();
            let results: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();
            let winners: Vec<_> = results.iter().filter_map(|(_, r)| r.as_ref().ok()).collect();
            assert_eq!(winners.len(), 1, "round {round}: {results:?}");
            for (_, r) in &results {
                if let Err(e) = r {
                    assert!(matches!(e, CreateError::IdCollision | CreateError::StagingCreation(io::ErrorKind::AlreadyExists)), "round {round}: {e:?}");
                }
            }
            assert_eq!(store.list().unwrap(), [WorkspaceEntry::Valid(winners[0].clone())], "round {round}");
            assert_eq!(fs::read_to_string(root(&d).join(A).join(MANIFEST_FILE)).unwrap(), encode_manifest(winners[0]));
        }
    }

    // ---- manifest read limit ---------------------------------------------------------------

    /// Counts the bytes handed out and fails the test (instead of hanging) if far too many are requested.
    struct Counting<R> {
        inner: R,
        served: u64,
    }
    impl<R: Read> Read for Counting<R> {
        fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
            assert!(self.served <= 2 * MAX_MANIFEST_BYTES, "the reader was drained past the limit: {} bytes served", self.served);
            let n = self.inner.read(buf)?;
            self.served += n as u64;
            Ok(n)
        }
    }

    #[test]
    fn the_limit_is_65536_bytes() {
        assert_eq!(MAX_MANIFEST_BYTES, 65_536);
    }

    #[test]
    fn exactly_the_limit_is_read_in_full() {
        let bytes = vec![b'x'; MAX_MANIFEST_BYTES as usize];
        assert_eq!(read_limited(&bytes[..], MAX_MANIFEST_BYTES), Ok(bytes.clone()));
    }

    #[test]
    fn one_byte_over_the_limit_is_rejected() {
        let bytes = vec![b'x'; MAX_MANIFEST_BYTES as usize + 1];
        assert_eq!(read_limited(&bytes[..], MAX_MANIFEST_BYTES + 1), Err(EntryProblem::ManifestTooLarge));
    }

    #[test]
    fn a_file_that_grew_after_the_metadata_check_cannot_bypass_the_limit() {
        // Metadata said 10 bytes; by the time of reading the file holds 70,000.
        let grown = vec![b'x'; 70_000];
        assert_eq!(read_limited(&grown[..], 10), Err(EntryProblem::ManifestTooLarge));
        // Same with a real file whose metadata was taken before it was appended to.
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join(MANIFEST_FILE);
        fs::write(&path, "{}").unwrap();
        let stale_len = fs::symlink_metadata(&path).unwrap().len();
        fs::write(&path, vec![b'x'; MAX_MANIFEST_BYTES as usize + 500]).unwrap();
        assert_eq!(read_limited(fs::File::open(&path).unwrap(), stale_len), Err(EntryProblem::ManifestTooLarge));
    }

    #[test]
    fn an_endless_source_is_never_read_past_the_limit_plus_one() {
        let mut endless = Counting { inner: io::repeat(b'x'), served: 0 };
        assert_eq!(read_limited(&mut endless, 0), Err(EntryProblem::ManifestTooLarge));
        assert_eq!(endless.served, MAX_MANIFEST_BYTES + 1, "exactly limit + 1 bytes were requested, no more");
    }

    #[test]
    fn a_declared_size_over_the_limit_is_rejected_without_reading() {
        struct MustNotRead;
        impl Read for MustNotRead {
            fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
                panic!("the file was read although its declared size is over the limit");
            }
        }
        assert_eq!(read_limited(MustNotRead, MAX_MANIFEST_BYTES + 1), Err(EntryProblem::ManifestTooLarge));
    }

    #[test]
    fn read_errors_are_reported_with_their_kind() {
        struct Broken;
        impl Read for Broken {
            fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
                Err(io::Error::from(io::ErrorKind::PermissionDenied))
            }
        }
        assert_eq!(read_limited(Broken, 0), Err(EntryProblem::Io(io::ErrorKind::PermissionDenied)));
    }

    #[test]
    fn oversized_text_never_reaches_the_decoder() {
        // Valid manifest JSON plus padding: the decoder alone would accept it (checked in the
        // listing test above). Through the store it must come back as TooLarge, not as Valid.
        let (d, store) = setup();
        let head = valid_text(A, "Alpha");
        let head = head.trim_end().trim_end_matches('}');
        let over = format!("{head},\"pad\":\"{}\"}}", "x".repeat(MAX_MANIFEST_BYTES as usize));
        assert!(over.len() as u64 > MAX_MANIFEST_BYTES && decode_manifest(&over).is_ok());
        put_manifest(&d, A, &over);
        assert_eq!(problem(&store.list().unwrap(), A), EntryProblem::ManifestTooLarge);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn rename_errors_are_classified_without_any_fallback() {
        use rustix::io::Errno;
        assert_eq!(classify_rename_error(Errno::EXIST), RenameError::Exists);
        // A destination that exists is `EEXIST` for files, symlinks and empty or non-empty directories alike.
        assert_eq!(classify_rename_error(Errno::INVAL), RenameError::Failed(io::ErrorKind::Unsupported));
        assert_eq!(classify_rename_error(Errno::NOSYS), RenameError::Failed(io::ErrorKind::Unsupported));
        assert_eq!(classify_rename_error(Errno::NOENT), RenameError::Failed(io::ErrorKind::NotFound));
        assert_eq!(classify_rename_error(Errno::ACCESS), RenameError::Failed(io::ErrorKind::PermissionDenied));
        // `ENOTEMPTY` is what plain `rename` reports for a non-empty directory. Not an overwrite signal here.
        assert_eq!(classify_rename_error(Errno::NOTEMPTY), RenameError::Failed(io::ErrorKind::DirectoryNotEmpty));
    }

    // ---- regression coverage (Task 3.5.2) ----------------------------------------------------

    #[test]
    fn publishing_over_a_non_empty_destination_is_a_collision_and_changes_nothing() {
        let (d, store) = setup();
        let ws = create_workspace(A, "Alpha", T0).unwrap();
        let root_dir = root(&d);
        // After the early existence check has passed, a non-empty directory appears at the final name.
        let planting_writer = |path: &Path, bytes: &[u8]| -> io::Result<()> {
            write_new_file(path, bytes)?;
            dir_with_marker(&root_dir, A, "old");
            Ok(())
        };
        assert_eq!(store.publish(&ws, &planting_writer, &rename_no_replace), Err(CreateError::IdCollision));

        let destination = root(&d).join(A);
        assert_eq!(fs::read_dir(&destination).unwrap().count(), 1, "the destination still holds exactly its own file");
        assert_eq!(marker(&destination), "old", "and that file is unchanged");
        let staging = root(&d).join(format!("{STAGING_PREFIX}{A}"));
        assert_eq!(fs::read_dir(&staging).unwrap().count(), 1, "the staging directory still holds exactly the manifest");
        assert_eq!(fs::read_to_string(staging.join(MANIFEST_FILE)).unwrap(), encode_manifest(&ws), "unchanged");
    }

    #[cfg(target_os = "linux")]
    mod unsupported {
        use super::*;
        use rustix::io::Errno;
        use std::cell::Cell;

        /// Runs `rename_no_replace_with` where the kernel call reports `errno`; returns the result
        /// and how many times the kernel call was made.
        fn run(errno: Errno, from: &Path, to: &Path) -> (Result<(), RenameError>, u32) {
            let calls = Cell::new(0);
            let result = rename_no_replace_with(from, to, |_, _| {
                calls.set(calls.get() + 1);
                Err(errno)
            });
            (result, calls.get())
        }

        #[test]
        fn an_unsupported_kernel_call_fails_and_never_falls_back_to_plain_rename() {
            for errno in [Errno::INVAL, Errno::NOSYS] {
                // Destination absent: a fallback rename would succeed and publish.
                let tmp = TempDir::new().unwrap();
                let from = dir_with_marker(tmp.path(), "from", "new");
                let to = tmp.path().join("to");
                assert_eq!(run(errno, &from, &to), (Err(RenameError::Failed(io::ErrorKind::Unsupported)), 1), "{errno:?}");
                assert_eq!(marker(&from), "new", "{errno:?}: the source is still unpublished");
                assert!(!to.exists(), "{errno:?}: nothing was published");

                // Destination is an empty directory: a fallback rename would replace it.
                let tmp = TempDir::new().unwrap();
                let from = dir_with_marker(tmp.path(), "from", "new");
                let to = tmp.path().join("to");
                fs::create_dir(&to).unwrap();
                assert_eq!(run(errno, &from, &to).0, Err(RenameError::Failed(io::ErrorKind::Unsupported)), "{errno:?}");
                assert_eq!(fs::read_dir(&to).unwrap().count(), 0, "{errno:?}: the empty destination is unchanged");
                assert_eq!(marker(&from), "new");

                // Destination is a non-empty directory.
                let tmp = TempDir::new().unwrap();
                let from = dir_with_marker(tmp.path(), "from", "new");
                let to = dir_with_marker(tmp.path(), "to", "old");
                assert_eq!(run(errno, &from, &to).0, Err(RenameError::Failed(io::ErrorKind::Unsupported)), "{errno:?}");
                assert_eq!((marker(&to), fs::read_dir(&to).unwrap().count()), ("old".to_string(), 1), "{errno:?}");
                assert_eq!(marker(&from), "new");
            }
        }

        #[test]
        fn the_real_syscall_and_the_seam_agree_on_a_collision() {
            // The same classification path is used for real kernel errors.
            let tmp = TempDir::new().unwrap();
            let from = dir_with_marker(tmp.path(), "from", "new");
            let to = dir_with_marker(tmp.path(), "to", "old");
            assert_eq!(run(Errno::EXIST, &from, &to), (Err(RenameError::Exists), 1));
            assert_eq!(rename_no_replace(&from, &to), Err(RenameError::Exists));
        }

        #[test]
        fn publication_reports_unsupported_and_publishes_nothing() {
            for destination in [None, Some(false), Some(true)] {
                // None: absent. Some(false): empty directory. Some(true): non-empty directory.
                let (d, store) = setup();
                let ws = create_workspace(A, "Alpha", T0).unwrap();
                let root_dir = root(&d);
                let writer = |path: &Path, bytes: &[u8]| -> io::Result<()> {
                    write_new_file(path, bytes)?;
                    match destination {
                        None => {}
                        Some(false) => fs::create_dir(root_dir.join(A))?,
                        Some(true) => {
                            dir_with_marker(&root_dir, A, "old");
                        }
                    }
                    Ok(())
                };
                let unsupported = |from: &Path, to: &Path| rename_no_replace_with(from, to, |_, _| Err(Errno::INVAL));
                assert_eq!(
                    store.publish(&ws, &writer, &unsupported),
                    Err(CreateError::Publication(io::ErrorKind::Unsupported)),
                    "destination {destination:?}"
                );
                let staging = root(&d).join(format!("{STAGING_PREFIX}{A}"));
                assert_eq!(fs::read_to_string(staging.join(MANIFEST_FILE)).unwrap(), encode_manifest(&ws), "the source stays unpublished");
                match destination {
                    None => assert!(!root(&d).join(A).exists(), "no final directory"),
                    Some(false) => assert_eq!(fs::read_dir(root(&d).join(A)).unwrap().count(), 0, "the empty destination is unchanged"),
                    Some(true) => assert_eq!(marker(&root(&d).join(A)), "old"),
                }
                assert!(matches!(store.list().unwrap().as_slice(), [] | [WorkspaceEntry::Invalid { .. }]), "never published as a valid workspace");
            }
        }
    }
}
