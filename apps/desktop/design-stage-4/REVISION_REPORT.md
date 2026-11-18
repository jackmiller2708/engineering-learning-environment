# Revision Report: Stage 4 design revision 2

> **Superseded in part (revision 3).** This report records revision 2 as written. The implementation step numbers it cites (for example "brief step 8") use revision 2 numbering. The current sequence, the R1 to R6 questions and the publication plan are in [REVIEW_HANDOFF.md](REVIEW_HANDOFF.md).

Date: 2026-11-17. Status (as written; superseded, steps 1 to 6 are now implemented, see IMPLEMENTATION_BRIEF section 8): **for owner review. Nothing is implemented, committed or pushed.** Revised documents: [DESIGN_SPEC.md](DESIGN_SPEC.md), [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md), [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md).

## 1. Changes made

| # | Owner instruction | Change |
|---|---|---|
| 1 | Last-active-lab pointer, Option A | Specified in DESIGN_SPEC 7.2 (behaviour table) and IMPLEMENTATION_BRIEF 7 (contract, checks, durability limits). Written only after a lab successfully opened. No pointer, invalid pointer, definitive failure (clear), transient failure (keep) and storage failure (never blocks) are each a row. No lab-record metadata, no Rust or capability change |
| 2 | Error translation | DESIGN_SPEC 10 rewritten (below) |
| 3 | One-world navigation | World popover removed from the spec, brief and prototype. The world is a plain-text breadcrumb item in its own slot, so a real switcher can replace it later. Current world, active lab and a link to Worlds remain (DESIGN_SPEC 4) |
| 4 | Minimum size 720 × 480 | Retained. DESIGN_SPEC 8.1 and brief step 8 define the exact-size runtime verification with pass criteria, marked **NOT PERFORMED** |
| 5 | Route titles | `document.title` per route is in the plan (DESIGN_SPEC 7.10, brief step 7). Native window title deferred |
| 6 | Other checks | Timestamp ordering verified (brief 6). Domain name limit and host kinds preserved. Out-of-scope list unchanged |

**Problems found in my first version and fixed:**
- The error table said "Check that there is free space" and named a "data folder". The host's `kind` does not say what the cause was, so that invented a cause, and "data folder" is implementation terminology.
- `internal_error` was given a "no lab was created" claim. The host also uses that kind when a worker did not finish ("Nothing was changed that could be confirmed"), so the claim could be false. The clock kinds were also given it, and the host does not say so for them. Both claims are removed.
- The kind `manifest_not_utf8` was missing from the table.
- The recovery notice named the lab ("Adder bench"). An invalid entry carries only an id and no name, and the pointer holds only the id. Notices now use the short id.
- The lab screen's existing states **bad address** and **unopenable by address** were missing from the spec. They are added and drawn.
- `manifest_unsupported_version` was described as "saved by a different version", but the host also raises it for "no usable version". The wording no longer says newer or older.

## 2. Decisions now reflected

Direction B supported (approved in principle, not approved for implementation). Pointer: Option A. One-entry popover deferred. 720 × 480 retained as the proposed minimum. Native window title deferred. `document.title` in plan. LE-013 to LE-020 unchanged and still represented as before (LE-018 still unresolved).

## 3. Error translation (summary)

Every learner-facing string states what happened and gives a next step only where one exists. Scan result: 0 banned terms across 24 table cells (section 5). Kinds share sentences deliberately (the host's detail is not in the `kind`). "No lab was created" appears only for the kinds whose host text says nothing was created or changed. Launch recovery notices and the lab-screen states have their own text, with the short id instead of a name.

## 4. Remaining owner questions

1. **R1:** `entry_unreadable` (I/O failure, permanence unknown) is treated as not definitive, so the pointer is kept. `manifest_unsupported_version` is treated as definitive (pointer cleared). Confirm both.
2. **R2:** `entry_symlink` wording is deliberately vague ("because of how it is stored on this computer"). Acceptable?
3. **R3:** merged sentences lose host distinctions (for example the three storage kinds on create). Acceptable?
4. **R4:** "restart the application" is generic advice, not tied to a known cause. Keep or remove?
5. **R5:** the unconfirmed-create wording, and refreshing the list after it.
6. **R6:** the word "identifier" in two address messages.
7. Whether the Worlds screen opens already in Computer Foundations (recommended) or has a separate enter step. Not addressed by the owner's review.
8. System fonts (recommended) or a bundled typeface. Not addressed.
9. Approval to implement, and the order.
10. Publication (section 7): how the uncommitted work should be committed, and whether Repository B's ten unpushed commits should go to the existing destination.

## 5. Checks performed, with results

| Check | Result |
|---|---|
| Relative links in DESIGN_DIRECTION, DESIGN_SPEC, IMPLEMENTATION_BRIEF and DESIGN_AUDIT | 0 broken |
| Banned terms in spec section 10's learner-facing cells | 24 cells, 0 hits |
| Banned terms in the prototype's copy | 9 strings matched by a simple pattern, 0 hits. This scan is partial; the prototype is not the source of truth |
| Stale statements (popover, "data folder", "saved record", "free space", "Esc closes") | none remain except the deliberate deferral note |
| LE-013 to LE-020 present in `LE-DECISIONS.md`; LE-018 still unresolved | yes |
| Timestamp sortability | Code read: `parseTimestamp` accepts only fixed-width canonical text and never repairs. Rust `format_timestamp` pads every field, and the host turns a malformed stored value into an unopenable entry. Property check outside the application: 200,002 random instants including both range ends, 20 characters each, **string order equalled chronological order in every case** |
| WebView storage scope | **Observed:** the built debug app, launched with throwaway XDG directories, created a persistent profile `<data>/dev.engineering-learning-environment.desktop/` (`storage/`, `hsts-storage.sqlite`, `CacheStorage/`, `WebKitCache/`), the same parent as the lab data. The storage origin reads `tauri://localhost`. **Read from config:** no incognito or data-directory setting in `tauri.conf.json`, and `capabilities/default.json` allows only the two workspace commands |
| Frames: 62 in `screenshots/` | Programmatic check of all 62: the right size, none blank. **Viewed by eye: 28 of them** (the dark and light 720 × 480 sets, every new state in at least one theme, and a spread of the regenerated 1100 × 720 frames). The rest were checked only programmatically. Result of the 720 × 480 design-level observation: bar and breadcrumb fully visible, only the content area overflows, the end of the Worlds page (including the unopenable group and "Try again") is reached by scrolling, no horizontal overflow visible |
| Contrast script on the (unchanged) tokens | 0 pairs below target, both themes. A numeric token check, not a WCAG claim |
| Application unchanged | Search for files under `apps` and `packages` newer than `PRODUCT.md`, excluding generated output and the Stage 3 and 4 document folders: only `DESIGN_AUDIT.md` (changed in the earlier Stage 4 step). This includes configuration files. `.impeccable/` absent. No real application data directory was created |
| Repository B | Course checker: `RESULT: OK (0 warning(s))`. No file in Repository B was modified by this revision (`LE-DECISIONS.md` was last written by the earlier step) |

## 6. Checks NOT performed

- **The exact 720 × 480 runtime verification.** It needs the implemented app. It is specified, not performed. The prototype observation above is not a substitute: it used headless Firefox, not WebKitGTK, and did not test keyboard, focus, hover, zoom or real minimum-size enforcement.
- **That `localStorage` actually survives close and reopen.** The application never writes to it, so there was nothing to read back. I tried to write a value through the debug build's inspector, and the inspector window did not open under the bare nested X server used. The scope above is consistent with persistence but is **not proof**. It is the first test of brief step 5, and a failure there must be reported, not worked around.
- Screen-reader and other assistive-technology behaviour, hover and pressed states, high-contrast modes, text scaling and zoom.
- The application's own test suite (not run, as instructed). The Rust and TypeScript kind lists were compared by reading the source, not by an automated test.
- The remote state of Repository B (nothing was fetched).

## 7. Publication readiness (nothing was committed, pushed or changed)

Four repositories were inspected. The two similarly named knowledge repositories are **different repositories with no shared history or remote**.

| Repository | Branch | Remote | Upstream | Unpushed | Working tree | Ready to publish? |
|---|---|---|---|---|---|---|
| **B** `~/Projects/engineering-knowledge` | `ccr-b573edbb-crcfsw` | `origin` `https://github.com/jackmiller2708/engineering-knowledge.git` | `origin/ccr-b573edbb-crcfsw` | **10 commits**, `aaf1430` back to `93e5a01` | `M LE-DECISIONS.md` (170 insertions), `?? LE-DESIGN.md`, `?? LE-PRODUCT.md`; `stash@{0}` | **Commits: yes. Learning-environment work: no, it is uncommitted** |
| **A** `~/Projects/engineering/repositories/engineering-knowledge` | `master`, no commits yet | none | none | none | untracked curriculum folders and files | **No.** No commits, no remote |
| `engineering-projects` | `master` | none | none | none (1 commit, `54a741e`) | clean. It ignores the nested app repository | **No.** No remote, nothing to publish |
| **App repo** `…/engineering-projects/projects/engineering-learning-environment` | `master` | none | none | none (2 commits, `3dc0223`) | untracked: `apps/`, `package.json`, `packages/`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (238 files, about 6.8 MB) | **No.** Nothing committed, no remote. **No destination exists and none was invented** |

`~/Projects/engineering-2` is not a Git repository.

**Exact destination of an existing upstream:** only Repository B has one. With `push.default` unset (Git's default `simple`) and an upstream of the same name, `git push` from `ccr-b573edbb-crcfsw` would send commits to `https://github.com/jackmiller2708/engineering-knowledge.git`, branch `ccr-b573edbb-crcfsw`. That push would send the ten commits only. The decisions and product documents (LE-005 to LE-020, `LE-PRODUCT.md`, `LE-DESIGN.md`) are not in them and would stay local until committed. The remote also has `review/final-curriculum-candidate`. The ten unpushed commits include "Curriculum candidate for independent review (proposed, not approved)", so the owner should confirm that pushing them to this branch is intended. Remote tracking refs were last updated 2026-11-17 12:18 and were not refreshed, so "0 behind" is a local view.

**Before the app repository could be published:** it needs its first commits (the owner decides the strategy) and a remote created by the owner. `.claude/settings.local.json` is present in it, is ignored and untracked, and would not be added. No machine-specific strings were found in its untracked text files. The Stage 3 and 4 screenshot folders (about 140 images in total, including the preserved originals) would be included and can be reviewed first.

## 8. Exact changed-file list

App repository, under `apps/desktop/design-stage-4/` (all untracked, so Git shows no diff):

**Modified:** `DESIGN_SPEC.md`, `IMPLEMENTATION_BRIEF.md`, `DESIGN_DIRECTION.md`, `artifacts/prototype/proto.js`, `artifacts/prototype/proto.css`.

**New:** `REVISION_REPORT.md`. `artifacts/screenshots-r1-original/` (36 files: an untouched copy of the first-review frames, kept as asked).

**`artifacts/screenshots/`** (62 files now, was 36):
- *Removed (2, still in `screenshots-r1-original/`):* `lab-menu-dark.png`, `lab-menu-light.png`.
- *Regenerated with changes (28):* `lab-default-{dark,light}`, `lab-default-{dark,light}-720w`, `lab-failed-*`, `lab-map-*`, `lab-notfound-*`, `lab-opening-*`, `worlds-created-*`, `worlds-default-*`, `worlds-default-*-720w`, `worlds-error-*`, `worlds-focus-*`, `worlds-recovery-*`, `worlds-validation-*`, `worlds-validation-*-720w` (each in dark and light).
- *Regenerated, byte-identical (6):* `worlds-empty-*`, `worlds-loading-*`, `worlds-longnames-*` (dark and light).
- *New (28):* `lab-badaddress-*`, `lab-unopenable-*`, `worlds-createfail-*`, `worlds-createunsure-*`, `worlds-recovery-missing-*`, `worlds-recovery-transient-*` (dark and light each); the 720 × 480 set `lab-default-*-720x480`, `lab-unopenable-*-720x480`, `worlds-default-*-720x480` and `-scrolled`, `worlds-recovery-transient-*-720x480` and `-scrolled`, `worlds-validation-*-720x480` and `-scrolled`.

**Not touched:** `artifacts/exploration/` (12 files, original; their lab frames still show the old breadcrumb caret and are kept as the record of the three directions), `render.py`, `contrast.py`, all application source, Rust, configuration, dependencies and tests. `artifacts/render.sh` is a stale first attempt (superseded by `render.py`) and was left in place.

**Elsewhere in the app repo:** nothing else. **Repository B:** nothing changed by this revision. **Repository A, `engineering-projects` and `~/Projects/engineering-2`:** untouched.

**Processes:** the built debug app and a nested X server were started for the storage check and stopped. They wrote only to a throwaway directory in the session scratch area.
