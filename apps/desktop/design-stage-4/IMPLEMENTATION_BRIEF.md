# Implementation Brief (Stage 4)

Status: **revision 3, implementation in progress. The owner supports Direction B and has approved implementation to proceed step by step. Steps 1 to 6 are implemented (see section 8 and STEP1 to STEP6 reports); steps 7 and 8 are not started. Not everything in DESIGN_SPEC has been verified: the light theme, 720 × 480 (step 7), comparison with the design screenshots and assistive technology are open.** Nothing is committed. Revision 2 changes are in [REVISION_REPORT.md](REVISION_REPORT.md). Revision 3 (this review round) re-sequences section 8 so that the persistence gate is first, records the owner's Worlds-screen and font decisions, and is summarised in [REVIEW_HANDOFF.md](REVIEW_HANDOFF.md). Design: [DESIGN_SPEC.md](DESIGN_SPEC.md) (section numbers below refer to it) and [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md). Audit: [DESIGN_AUDIT.md](../DESIGN_AUDIT.md). Decisions: LE-013 to LE-020 in [LE-DECISIONS.md](../../../../../../../../engineering-knowledge/project/learning-environment/LE-DECISIONS.md). Architecture is locked (LE-001 to LE-004) and is not reopened.

## 1. Goal and non-goals

**Goal:** replace the current Home and environment screens with the Worlds screen, the shell and the lab frame specified in DESIGN_SPEC, restore the last lab on launch, and translate host errors, without changing the Rust host, the command contract, the domain package's public behaviour or the persistence format.

**Non-goals (out of scope for this brief):** the bench, regions, probes, components or simulation; any World or Lab persistence model; deleting, renaming or repairing labs; automatic provisioning; lab-name uniqueness; last-opened tracking or any new metadata on lab records; sorting controls; docking or resizing; a second world; a bundled typeface (decided: system fonts); a new dependency or design system.

## 2. Screens and shared components

| Unit | Kind | Route | Responsibility |
|---|---|---|---|
| `LaunchResolver` | screen (no UI beyond "Opening your last lab…") | `/` | DESIGN_SPEC 7.2. Redirects with `replaceUrl` |
| `WorldsScreen` (replaces `WorkspaceHome`) | screen | `/worlds` | Rail, title, create form, labs list, unopenable group, recovery notice |
| `LabFrame` (replaces `WorkspaceEnvironment`) | screen | `/workspace/:id` (**unchanged**) | Resolve the lab, show the frame, facts strip, failure and not-found states |
| `AppShell` (the current `App`) | shell | all | Bar with breadcrumb (the world as a plain-text item, deferred switcher), skip link, router outlet |
| `LabCreateForm` | component | inside `WorldsScreen` | Name field, hint, create state machine (7.5), error display |
| `LabList` | component | inside `WorldsScreen` | Valid entries (sorted) and unopenable group |
| `describeError(kind, ctx)` | pure function | n/a | Section 10 table. `ctx` carries the name limit |
| `sortLabsNewestFirst(entries)` | pure function | n/a | `createdAt` descending, id tie-break |
| `LastLabPointer` | small service | n/a | Read, write, clear the last active lab id in `localStorage` (section 7). Every call guarded. Validates with `parseWorkspaceId` |

No further components. The world item lives inside `AppShell`, and the facts strip inside `LabFrame`. There is no world popover or switcher (deferred). Extract more only when a second user appears.

## 3. State and behaviour responsibilities

- **Components own presentation state only** (signals, as today): loading, creating, error, created-flag. They call the existing `WORKSPACE_GATEWAY` and never `invoke` directly (**Preserve**).
- **`describeError`** is the only place host `kind` becomes learner text. Components never display `error.message`.
- **`LabCreateForm`** sends the name exactly as typed and does not validate or truncate (**Preserve**). It reads the limit from `@ele/domain` for the hint only.
- **`LastLabPointer`** is written by `LabFrame` only after the lab has successfully opened, cleared by `LaunchResolver` only on a definitive result (DESIGN_SPEC 7.2), and read by `LaunchResolver` only. A storage failure reads as no pointer and is ignored on write and clear.
- **Host and domain own** validation, id and time generation, storage and ordering of the raw list (the host sorts by id and keeps doing so). Presentation order is the frontend's.

## 4. Behaviour to preserve (regression list)

Each is an existing, tested or audited behaviour. Do not change it:
1. `createWorkspaceGateway` result shape and mapping, and the `WORKSPACE_GATEWAY` token.
2. Name sent as typed, host-authoritative validation, typed text kept after a failed submit, focus returned to the field after a failed submit.
3. Create does not navigate. The list refreshes.
4. `/workspace/:id` address, id validation through `parseWorkspaceId`, resolution by listing, restoration after refresh.
5. Focus moves to the new screen's `h1` on route entry.
6. Unopenable entries are visible and not links.
7. Light and dark follow the system through `light-dark()` tokens.
8. Retry after a failed read works, and a stale resolve cannot overwrite a newer one (`resolveSeq` in the current environment component). All six lab-screen states survive: loading, ready, bad address, not found, unopenable and failed read.
9. Strict CSP: no remote assets, no inline script, system fonts.
10. Local persistence: close and reopen restores all labs.

## 5. Frontend changes

Files are in `apps/desktop/src/app/` unless noted.
1. **Routing** (`app.routes.ts`): `''` → `LaunchResolver`, `'worlds'` → `WorldsScreen`, `'workspace/:id'` → `LabFrame`, `'**'` → `/worlds`. Per-route `title` using Angular's route `title` or a small title strategy (7.10).
2. **Styles** (`src/styles.css`): replace tokens with section 3 of the spec (`proto.css` is the reference rendering). Keep plain CSS.
3. **Shell** (`app.html`, `app.css`, `app.ts`): breadcrumb with the world as a plain-text item, skip link. No popover.
4. **Worlds screen** from the current home component and template, **Lab frame** from the current environment component. Rename files and selectors in the same step as the change, and keep behaviour identical until each step's check passes.
5. **Formatting helpers** (`workspace-format.ts`): add local-time and UTC formatting. Keep `shortId`.
6. **Copy**: no learner-visible occurrence of the terms listed in DESIGN_SPEC section 2 (a test; done in step 6).

## 6. Host and domain contract changes

**None.** Under the owner's pointer decision (Option A) no contract changes:
- **Rust:** no change. Commands remain `create_workspace` and `list_workspaces`. Error `kind` values unchanged. No new capability.
- **`@ele/domain`:** no change. `WORKSPACE_NAME_MAX_LENGTH`, `validateWorkspaceName` and `parseWorkspaceId` are used as exported. The frontend defines no name or id rule. `sortLabsNewestFirst` and `describeError` are presentation functions in the app. If the owner later prefers the sort in the domain, that is a pure addition.
- **Lab records:** no field added. The pointer is not part of a lab record.

**Timestamp ordering, verified (revision 2).** The newest-first order compares `createdAt` strings, so it is only correct if every valid entry's timestamp is fixed-width canonical UTC. Checked:
- The domain's `parseTimestamp` accepts only text matching `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$` with calendar validation and years 1970 to 9999, and "never repairs" (no offsets, fractions, lowercase or whitespace). Every valid entry went through it when the manifest was decoded.
- The Rust writer `format_timestamp` pads every field (`{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z`), and the host rejects a stored `createdAt` that is not in that form (it becomes an unopenable entry with `manifest_invalid_field`, "not a valid UTC time in the form YYYY-MM-DDTHH:MM:SSZ"). Valid entries therefore never carry another form.
- A property check outside the application (Python, 200,002 random instants including both ends of the supported range): every formatted value was 20 characters, matched the canonical pattern, and **string order equalled chronological order in every case.**

**Conclusion:** lexical ordering is safe for valid entries. Unopenable entries have no `createdAt` and are never sorted by it. This was verified by reading the code and by that property check, not by running the project's own tests. Step 2 adds a unit test that records the assumption, so a future change to the format fails it.

## 7. The last-active-lab pointer: decided, Option A (revision 2)

LE-016 requires restoring the last active lab and does not say where that is remembered. The owner chose **Option A: the webview's `localStorage`**, on the condition that the existing configuration supports the intended persistence scope. Behaviour is specified in DESIGN_SPEC 7.2. This section records the storage contract, what was checked, and the limits.

**Contract.** One key holding the lab's id string. No lab-record metadata. No new host command, no change to the Rust command contract, no new Tauri capability (`localStorage` is a web API and the CSP does not govern it). The value is validated on read with the domain's `parseWorkspaceId`. The key name is an implementation choice and should be versioned (for example `ele.lastLab.v1`) so a later change can ignore old values.

**Failure policy.** Every read, write and clear is guarded. A failure reads as "no pointer" and is ignored on write. It never blocks launch, Worlds or entering a lab. Clearing happens only on a definitive result (DESIGN_SPEC 7.2).

### What was checked (revision 2, 2026-11-17)

| Check | Result |
|---|---|
| The webview has a persistent on-disk profile rather than an in-memory one | **Observed.** Launching the built debug binary with throwaway XDG directories created `<data>/dev.engineering-learning-environment.desktop/` containing `storage/`, `hsts-storage.sqlite`, `CacheStorage/` and `WebKitCache/`. The directory is named by the application identifier in `tauri.conf.json` and is the same parent that holds the lab data (`workspaces/`) |
| The storage is keyed to the origin `tauri://localhost` | **Observed.** The origin record under `storage/` reads `tauri` and `localhost` |
| The Tauri configuration does not set an ephemeral or incognito webview, and has no storage-related setting | **Read from** `tauri.conf.json` (one window, no `incognito` or data-directory setting) and `capabilities/default.json` (only the two workspace commands). Not a runtime result |
| A value written with `localStorage.setItem` survives closing and reopening the application | **Verified in step 1 (Task 3.11), with the caveats in STEP1_REPORT.md:** a value written by the application survived a clean close and reopen in the built debug app, and was found in `localstorage/tauri_localhost_0.localstorage`. Earlier note, kept for the record: before step 1 the application never wrote to `localStorage`, so the profile held no entry |

**Conclusion.** Nothing found contradicts the intended scope: the profile is persistent, per application identifier, under the application data directory. The guarantee itself is unproven until the write, close, reopen, read test passes in the built application. **If that test fails, stop and report. Do not switch to Option B without owner approval.**

### Durability limitations (to be stated to the owner, not hidden)

1. **Clearing webview storage clears the pointer independently of the lab data.** The labs live under `workspaces/` and the pointer under the webview's `localstorage/` directory, both inside the same application data directory. Removing the webview's storage, resetting the webview profile, or removing the whole data directory loses the pointer, and only the last of those loses the labs. The effect is graceful: the application opens Worlds.
2. **The pointer is bound to the origin.** The built application's origin is `tauri://localhost`. `tauri dev` serves `http://localhost:4200`, which is a different origin, so the pointer is not shared between a development run and a built run.
3. **A different application identifier or data location starts with no pointer.**
4. **A write just before an abrupt kill may not reach disk.** WebKit flushes storage asynchronously. Not measured.
5. **It is webview state, not application data.** It is not covered by anything that backs up or copies lab data deliberately.
6. **Two running instances share the profile**, so the last one to write wins. The application has one window and no multi-instance design, so this is noted only.

## 8. Implementation sequence, in dependency order (revision 3)

This was the plan when written. Steps 1 to 6 are now implemented (status blocks below); steps 7 and 8 are not started. Paths are under `apps/desktop/` and `src/app/` unless stated. **No step changes the Rust host, a command, a command's error `kind`, a capability, the domain package or a lab record.** Each step lists what it depends on, the files it affects, any contract change, and the validation that tests the uncertainty that step introduces. Run only the checks a step names. The complete suite runs **once**, at the end of step 8.

Per-step rule: a step that changes behaviour starts with a failing test for it. A step that only restyles is verified by the existing tests that touch it plus a visual check.

### Gate: Step 1. Last-active-lab persistence in the real Tauri application

**Status (Task 3.11): implemented and the gate run. Results, evidence and deviations are in [STEP1_REPORT.md](STEP1_REPORT.md).** The text below is the plan as approved. Correction found at run time: the pointer is stored in `<data>/dev.engineering-learning-environment.desktop/localstorage/tauri_localhost_0.localstorage`, **not** under `storage/` as this brief first said. G6a was run by moving the `localstorage/` directory aside.

This is the first gate, because everything else in the plan is built on the owner's choice of `localStorage` and nothing yet shows that it survives a close and reopen. The smallest slice that makes the test possible is built first, with no visual change.

- **Depends on:** nothing.
- **Work (smallest slice):** move today's home screen to the route `/worlds` unchanged; add `LastLabPointer` (read, write, clear, guarded, validated with `parseWorkspaceId`); add `LaunchResolver` at `/` with the DESIGN_SPEC 7.2 table, including the definitive versus transient classification; write the pointer from today's environment component only once it reaches `ready`. The recovery notice text is not part of this step (it needs `describeError`, step 2). Today's screens keep their look.
- **Files affected:** `app.routes.ts`; new `launch-resolver` component and spec; new `last-lab-pointer` service and spec; `workspaces/workspace-environment.ts` and its spec (write on `ready` only); `workspaces/workspace-home.spec.ts` only if it asserts the route.
- **Contract changes:** none. No Rust, no command, no capability, no `@ele/domain` change, no lab-record field. `localStorage` is a web API in the existing webview.
- **Unit validation (written first, watched failing):** a fake gateway and a fake storage, one test per row of the DESIGN_SPEC 7.2 table. They cover: no pointer; invalid pointer; storage read throws; valid and present; absent (cleared); each definitive kind (cleared, one test per kind); `entry_unreadable` (kept); unrecognised kind (kept); list failure (kept); storage write throws (the lab still opens); storage clear throws (Worlds still shows); the pointer written only after a successful open and never for loading, bad address, not found, unopenable or failed. History: Back from the restored lab does not return to `/`.
- **Runtime validation (the gate). Environment:** the built debug binary (`tauri build --debug`, not `tauri dev`, which serves a different origin and would test the wrong storage), run on the nested X server with throwaway `XDG_DATA_HOME`, `XDG_CONFIG_HOME` and `XDG_CACHE_HOME` directories. Never the learner's real data directory. Record the commands, the observations and screenshots, and after each close the contents of the webview profile's `localstorage` file.

| # | Gate check | How it is observed | Pass when |
|---|---|---|---|
| G1 | Open an existing lab successfully | Create labs A and B through the UI. Open A by activating its row | A's lab screen is `ready` |
| G2 | The pointer is written only after a successful open | Before opening any lab: create two labs, close completely, start again. Then open A | Starting after creation only (no lab ever opened) shows Worlds, so creating and listing wrote nothing. After A opens, the profile holds a pointer equal to A's id |
| G3 | Close the application completely | Close the window. Confirm the application and its web process have exited. Wait for exit before inspecting the profile | No process remains. Record whether the profile holds the pointer |
| G4 | Reopen | Start the binary again with the same throwaway directories | The application starts |
| G5 | The same lab is restored | Observe the first screen | It is A's lab screen at `/workspace/<A's id>`, and the heading has focus. Repeat after opening B: it restores B, not A |
| G6a | A missing pointer opens Worlds | Close. Remove only the webview's `localstorage/` directory (not `storage/`). Start | Worlds opens, all labs listed, no error, labs untouched |
| G6b | A pointer to a lab that no longer exists opens Worlds and is cleared | With the pointer set to B, close, move B's folder aside, start. Close. Put B's folder back and start again | First start: Worlds. Second start: Worlds, not B, so the stale pointer was cleared |
| G6c | An invalid pointer opens Worlds | Close. Overwrite the stored value with text that is not an id by editing the webview's `localstorage` SQLite file with the application closed (test-only, and the file format is WebKit's, not ours). If that cannot be done reliably, say so and rely on the unit test | Worlds opens. Report which way it was verified, real application or unit test only |
| G7 | A transient failure does not destroy the pointer | With the pointer set to A, close. Make the throwaway labs directory unreadable (`chmod 000`). Start. Close. Restore the permissions. Start | First start: Worlds (the listing failed). Second start: A is restored, so the pointer survived the failure |
| G8 | A storage failure does not prevent normal use | Close. Make the webview's `localstorage/` directory unusable (unreadable or unwritable). Start. List labs, create a lab, open a lab | The application starts, Worlds and the lab list work, and a lab opens. Record what WebKit actually did (for example it may fall back to non-persistent storage). Restoring the next launch is not required in this case |

- **If any of G1 to G5, G6a, G6b or G7 fails: stop the implementation sequence.** Report the observed failure and the evidence. **Do not silently replace `localStorage` with another persistence mechanism. Do not introduce a Rust command, change lab records or expand host capabilities** without a separate owner decision. G6c is reported as verified in the real application or as unit-test only. A failure of G8 is also a stop, because the owner's rule is that a pointer failure must never block use.
- **Not verified until run:** all of G1 to G8. (Run against the built application in step 1, STEP1_REPORT section 1. Only G5, G6b and G7 were exercised again in later steps; the others were not rerun.) **A kill without a clean close** (power loss, `kill -9`) is outside the pass criteria: record what is observed and treat it as a durability limit (section 7), not a pass or a failure.

### Steps 2 to 8

**Step 2 status (Task 3.12): implemented. Details, evidence and limits are in [STEP2_REPORT.md](STEP2_REPORT.md).** Pure functions only, nothing wired into a screen. Names: `describeError(kind, ctx)`, `describeLaunchOutcome`, `describeLabState` and `KNOWN_KINDS` in `describe-error.ts`; `sortLabsNewestFirst` in `lab-order.ts`; `formatCreatedLocal` and `localOffsetLabel` in `workspace-format.ts` (the UTC formatter is the existing `formatCreated`). Departure from the plan below: the test that compares the host's kinds with `describeError` uses a hand-kept list, because specs are bundled for the browser and cannot read the Rust file. A new host kind is therefore **not** detected automatically (STEP2_REPORT section 6).

**Step 3 status (Task 3.13): implemented, with limits. Details, evidence and limits are in [STEP3_REPORT.md](STEP3_REPORT.md).** Scope as in the row below: tokens in `styles.css`, the 40 px bar, the breadcrumb with a plain-text world item, the skip link. Changed: `src/styles.css`, `app.ts`, `app.html`, `app.css`, `app.spec.ts`; plus, not named in the row, a new `active-lab.ts` and a three-line hook and one renamed CSS variable in `workspaces/workspace-environment.ts`, so that the breadcrumb can name the lab. Also corrected here: `sortLabsNewestFirst` now keeps unopenable entries (LE-020); the row for step 2 below describes the plan, not that behaviour. **Verified:** unit and shell tests, `ng build`, the built debug app in the **dark** theme (breadcrumb, skip link, restore after a clean close), and `Intl` offset formatting inside WebKitGTK. **Not verified:** the light theme, the visual comparison with `artifacts/screenshots/`, 720 × 480 (stays in step 7), assistive technology. This is not a claim that DESIGN_SPEC has passed.

**Step 4 status (Task 3.14): implemented, with limits. Details, evidence and limits are in [STEP4_REPORT.md](STEP4_REPORT.md).** The Worlds screen replaces the home screen at `/worlds`: rail, title, `LabCreateForm`, `LabList` (valid labs newest first, then the Cannot be opened group, which keeps its Try again for unreadable entries), the once-only launch recovery notice, and the list-failure panel (N-1 wording after a failed launch check). Files: `workspaces/workspace-home.*` renamed `worlds-screen.*`; new `lab-create-form.*`, `lab-list.*`, `launch-notice.ts`; `describe-error.ts` (+ `isUnconfirmedCreate`), `launch-resolver.ts` (hands its outcome to the screen), `app.routes.ts`; specs `worlds-screen.spec.ts` (replaces `workspace-home.spec.ts`), `lab-list.spec.ts`, `lab-create-form.spec.ts`, and four assertions in `launch-resolver.spec.ts` and `workspace-environment.spec.ts` that used the old Worlds heading as a marker. No Rust, Tauri configuration, capability, domain or dependency change. **Verified:** unit tests and mutation checks, `ng build`, the built debug app in the **dark** theme (create, validation, New tag, order, group, restore, G6b, G7). **Acceptance review (STEP4_REPORT section 7):** the Worlds loading line now stays in the page as a status region (DESIGN_SPEC 9); `LabList` and `LabCreateForm` have their own specs; the report's deviations are classified, one (the World description) as an open owner decision. **Owner decisions applied (STEP4_REPORT section 8):** the World description line is removed, and the "New" tag is transient (cleared on leaving Worlds, never stored). DESIGN_SPEC 5.2 and the prototype were updated in step 5. **The `worlds-*` frames under `artifacts/screenshots/` were rendered before the decision, still show the removed description line, and are stale as evidence; they have not been regenerated.** I have not compared the other frames with the application. **Not verified:** the light theme, comparison with `artifacts/screenshots/`, 720 × 480 (step 7), assistive technology (including announcement of the loading region); G1 to G4, G6a, G6c and G8 were not rerun.

**Step 5 status (Task 3.17): implemented, with limits. Details, evidence and limits are in [STEP5_REPORT.md](STEP5_REPORT.md).** `LabFrame` (`workspaces/lab-frame.*`, renamed from `workspace-environment.*`) shows the lab bar, the bench placeholder, the facts strip (World, Lab, Created local with the date's offset and UTC, full ID) and the five problem states from `describeLabState`, each with "Go to Worlds". The old back link is gone (the breadcrumb is the way back). Focus goes to the `h1` on arrival and after a retry only if focus was lost. The loading text is written into a persistent status region owned by the shell (`StatusMessage`; STEP5_REPORT section 8), which exists before the lab starts to load. New: `world.ts`, the `--grid` token. DESIGN_SPEC 5.2 and the prototype no longer have the World description. No Rust, Tauri configuration, capability, domain or dependency change. **Verified:** 257 tests, mutation checks, `ng build`, the built debug app in the **dark** theme (ready, not found, failed read, retry, pointer, offsets in two seasons). **Not verified:** the light theme, comparison with `artifacts/screenshots/`, 720 × 480 (step 7), assistive technology; G1 to G4, G6a, G6c and G8 were not rerun; the unopenable, unreadable and bad-address states were seen only in unit tests.

**Step 6 status (Task 3.21, with the D1 correction and Task 3.22 hardening): implemented, with limits. Details in [STEP6_REPORT.md](STEP6_REPORT.md).** Per-route and per-state `document.title` (route `title` plus `LabFrame` through `Title`; generic while loading, error title kept during a retry; a destroyed lab cannot apply a late result, D1), the skip link reads "Skip to main content", and a rendered-text copy sweep over every screen and state and the whole shell found no other violation. Banned list: DESIGN_SPEC section 2.

**Step 7 status (Task 3.23): partly done, with a failure. Details in [STEP7_REPORT.md](STEP7_REPORT.md).** `tauri.conf.json` now has `minWidth` 720 and `minHeight` 480 (approved and locked, LE-021). In the built debug app a resize to 600 × 400 gave 720 × 480. At 720 × 480 in dark the Worlds states, a lab, not found and failed read pass; the 64-wide-character and long CJK lab names overflow on the lab screen (not fixed). **Not verified:** the light theme, window-manager enforcement, bad address, unopenable and unreadable states in the real app.

**Step 8 status (Task 3.26, closed in Task 3.27, reconciled in Task 3.28): implementation Complete; verification Partial. No accessibility conformance claim is made. Details and the full verification matrix are in [STEP8_REPORT.md](STEP8_REPORT.md) (Closure, C13).** CSS fixes for the lab long-name overflow and the below-900 layout; `WorldsScreen` puts focus on the Labs heading (or the Try again button) after a retry settles when focus was lost with the button (5 tests; 319 pass in all; desktop build passed). **Verified in the built app:** long Latin, Arabic and CJK names at 720 × 480 in dark and light; the 900 px breakpoint; the unopenable group by keyboard (light); light theme in part (720 × 480, listed screens, and 899 wide). **Orca 49.4:** headings, row names, breadcrumb and skip link verified. Four announcements were not spoken: the validation message and the failed-read body are an **investigated environmental limitation** (WebKitGTK exposes `role=alert` as NOTIFICATION; Orca's web script presents only ALERT; markup unchanged); the creation status and the recovery notice are **unresolved**. **Unverified:** the plain-text World breadcrumb item with a screen reader, full-height 1100 × 720 (display 692 px high), actual webview zoom, light theme at 800 and 900 wide, lab error states and the recovery notice in light. The `GDK_DPI_SCALE=2` run is a display-scaling approximation, not a zoom test.
- **Automated tests:** 299 passed in the full suite at the end of step 6 (before D1 and Task 3.22). After D1: 128/128 in four focused specs. After Task 3.22: 48/48 in `page-title.spec.ts`. **The full suite has not been rerun since the 299 run.**
- **Builds:** `ng build` and the debug Tauri build succeeded at the end of step 6. Not rerun for D1 or Task 3.22.
- **Runtime observations (implementation session; not repeated in the compliance review; evidence not archived):** `document.title` read over AT-SPI in the built app for the restored lab, Worlds, a second lab, not found, failed read and retry; the native window title read as unchanged from its X properties.
- **Manual only:** the native window title. There is no automated test of it.
- **Not verified:** screen-reader announcement; the bad-address, unopenable and unreadable titles in the built app; the light theme; comparison with `artifacts/screenshots/`; exactly 720 × 480 (step 7); G1 to G4, G6a, G6c and G8.

| Step | Work | Depends on | Files affected | Contract changes | Validation (only what this step puts at risk) |
|---|---|---|---|---|---|
| 2 | Pure functions: `sortLabsNewestFirst`, local-time and UTC formatters, `describeError(kind, ctx)` with the full table in DESIGN_SPEC 10 | 1 passed. **The final wording needs the owner's R1 to R6 answers** | new `workspaces/lab-order.ts`, `workspaces/describe-error.ts` and specs; `workspaces/workspace-format.ts` and spec | none | Unit tests: order by `createdAt` descending with id tie-break and equal times stable (the string-ordering assumption is verified, section 6, and a test records it); a test per kind and context; a test that every kind in the Rust host's list has an entry, the list in the test compared with the host's so a new host kind fails it (it includes `manifest_not_utf8`); an unknown kind falls back; `name_too_long` interpolates the domain limit; no produced string matches a banned term; "No lab was created" appears only for the kinds DESIGN_SPEC 10 permits |
| 3 | Tokens in `styles.css` and the shell restyle: bar, breadcrumb with the plain-text world item, skip link | 1 passed | `src/styles.css`; `app.html`, `app.css`, `app.ts`, `app.spec.ts` | none | Existing component tests still pass. New shell test: "Worlds" is a link, the world is plain text (not a link, not focusable, no interactive role), the lab item is `aria-current="page"`. Visual check against `artifacts/screenshots/` in both themes. System fonts only, no `@font-face` and no font dependency |
| 4 | `WorldsScreen`, `LabCreateForm`, `LabList` replacing the home screen at `/worlds`, with the recovery notice from the resolver's outcome | 2, 3 | `workspaces/workspace-home.*` (renamed `worlds-screen.*`), new `lab-create-form`, `lab-list` files and specs | none | Existing home behaviours hold (section 4 items 2, 3, 6). New tests: the Computer Foundations World is displayed and **no lab is opened and none is created on arrival, on selecting the World, or when the list is empty** (the gateway's `createWorkspace` is not called, the router does not navigate); the hint shows the domain limit; newest first; a long name does not overflow (assert the wrapping classes and `title`); duplicate names render as distinct rows; create success shows the status link and "New" tag; each failure shows its translated message and keeps the text; an unconfirmed create refreshes the list; each recovery notice appears once; **the Worlds heading takes focus on arrival** (pre-existing gap, DESIGN_SPEC 7); at launch a listing failure shows one panel led by "Your labs couldn't be checked." whose Try again calls the listing again, keeps the pointer, and does not reopen the lab (N-1) |
| 5 | `LabFrame` replacing the environment screen, with the facts strip and every lab state | 2, 3 | `workspaces/workspace-environment.*` (renamed `lab-frame.*`) | none | Existing resolve and retry behaviours (section 4 item 8). Bad address, not found, unopenable and failed read each show their text and "Go to Worlds". The pointer is still written only on `ready` |
| 6 | Copy sweep and per-route `document.title` | 4, 5 | `app.routes.ts` (route `title`), the components' templates | none. No Tauri capability is added | A test that scans the rendered text of each screen and state for the banned terms. A test per route for `document.title` |
| 7 | Minimum window size in `tauri.conf.json`, then **verification at exactly 720 × 480** | 3 to 6 | `src-tauri/tauri.conf.json` (`minWidth` and `minHeight` only) | a configuration edit, **approved and locked (LE-021, Task 3.24)** | Run the procedure in DESIGN_SPEC 8.1 against the built application, in light and dark. Record the results and screenshots. **Not yet performed. Do not report it passed until it has been.** A failure is reported, not adjusted away |
| 8 | Responsive and accessibility pass in the running application | 3 to 7 | none expected. Fixes go to the owning step's files | none | Run the desktop build. 720 wide and 1100 wide, both themes, keyboard order and focus, zoom, screen-reader announcements. Record what was and was not verified. **Then run the complete test suite once** |

**Exact 720 × 480 verification (step 7).** The authoritative procedure and pass criteria are DESIGN_SPEC 8.1. In short: set the minimum and confirm the window cannot be made smaller, and record the inner size actually obtained. At exactly 720 × 480, in light and then dark (the system theme switched), visit Worlds (with labs, empty, list error, validation error, recovery notice), a lab, and each lab error state. Pass when: **navigation** (the bar and breadcrumb fully visible and "Worlds" operable by pointer and keyboard), **content accessibility** (every control, row, notice and error panel reachable by scrolling and by Tab, not hidden behind the bar), **scrolling** (only the content area scrolls, no horizontal scrollbar, no clipped text without a reachable full version), **keyboard operation** (the whole flow without a pointer, a visible focus ring), and **both themes**. 720 × 480 is the approved, locked minimum (LE-021); this verification checks the layout at that size and is partly done (STEP7_REPORT).

## 9. What must be tested at runtime, with assistive technology, or by the owner

- **Runtime (needs the real Tauri window):** the pointer's write, close, reopen, read persistence and the effect of removing the webview's `localstorage/` directory (the step 1 gate, G1 to G8); the exact **720 × 480** verification (step 7, **not performed**); WebKitGTK text metrics and wrapping; 200 percent zoom and text size; real minimum-size enforcement; restore after a real close and reopen; a real unreadable data directory.
- **Assistive technology:** announcements of the loading, success, notice and error regions, the whole-row link names, the plain-text world item in the breadcrumb, and focus after route changes.
- **Owner:** the review items R1 to R6 in DESIGN_SPEC 10, and the open decisions in section 11.

## 10. Requirements that cannot be fully met inside current constraints

1. **Native window title following the route:** deferred by the owner. `document.title` is in scope and needs no host change.
2. **A minimum window size:** needs a configuration change to `tauri.conf.json`, made in step 7. The design is observed only in a prototype at 720 × 480, and the runtime verification has not been performed.
3. **A bundled typeface:** a new asset and `font-src 'self'` use. **System fonts are decided by the owner (revision 3) and not reopened unless a real rendering problem is shown.**
4. **Restore without any stored fact is impossible.** The pointer is webview state with the limits in section 7. Its persistence guarantee is **unverified** until the step 1 gate passes.
5. **Distinguishing duplicate names** is mitigated, not solved. Names may stay identical (LE-018).
6. **Local time is only as correct as the webview's time zone data.** Timestamps are validated canonical text (section 6), so the raw value is only a fallback that should not occur.
7. **Full accessibility conformance cannot be established from design artifacts** (DESIGN_SPEC section 12).
8. **Host error detail cannot be shown.** Which I/O condition occurred (disk full, permission denied, read-only) is in the host's free text, not in the `kind`. The interface translates by `kind` only (LE-015), so it cannot say which. Changing that would be a contract change and is not proposed.

## 11. Decisions

**Decided by the owner and reflected here (2026-11-17, revision 2):**
1. Direction B, the circuit-design workbench, is supported. The design was approved in principle (revision 2). Implementation was approved afterwards and proceeds step by step.
2. Pointer storage: Option A, frontend `localStorage`, with the behaviours in DESIGN_SPEC 7.2, conditional on the configuration supporting the intended persistence (checked in part, section 7).
3. The one-entry world popover is deferred. The shell keeps persistent world identification, the active lab and a route back to Worlds, in a structure a real switcher can replace.
4. The proposed minimum window size of 720 × 480 is retained, with an explicit runtime verification (step 7, not performed).
5. Native window-title integration is deferred. `document.title` is in the plan.

**Decided by the owner in this review round (revision 3):**
6. Computer Foundations is shown as an available World on the Worlds screen. Showing it does not open a Lab and does not create one. Creating a Lab remains an explicit learner action (DESIGN_SPEC 5).
7. System fonts for the initial implementation, with monospace only for technical values, identifiers and timestamps. No bundled typeface and no font dependency.

**Still open for the owner (all listed with recommendations in [REVIEW_HANDOFF.md](REVIEW_HANDOFF.md)):**
1. R1 to R6, the error wording and classification questions (DESIGN_SPEC 10).
2. C-1: confirm that the Worlds screen lists the World's labs directly, with no separate "Open world" step.
3. Approval to begin implementation, starting with the step 1 gate. (Given; steps 1 to 6 are implemented.)
4. Publication: the commit and push plan (REVIEW_HANDOFF section 5).

Status (current): steps 1 to 8 are done as far as stated and nothing is committed. Step 8 implementation is complete and its verification is partial (STEP8_REPORT.md, C13 and C14); the Step 7 text that follows is historical. Step 7 set `minWidth` 720 and `minHeight` 480 (approved and locked, LE-021), verified at 720 × 480 in dark only, and found a long-name horizontal overflow on the lab screen that is not fixed; the light theme is not verified ([STEP7_REPORT.md](STEP7_REPORT.md)). Step 8 is not started.

