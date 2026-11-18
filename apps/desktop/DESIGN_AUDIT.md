# Design Audit: M1 Workspace Home and Workspace Environment

Date: 2026-11-17. Scope: the existing desktop application at the end of Task 3.7. Screenshots: [design-audit-2026-11-17/screenshots/](design-audit-2026-11-17/screenshots/).

Product foundation compared against (Repository B, `project/learning-environment/`): LE-PRODUCT.md, LE-DESIGN.md, LE-DECISIONS.md (LE-001 to LE-012). Their user-facing vocabulary is World, Lab, Bench. "Workspace" is internal.

## 1. Scope and environment

**In scope:** Workspace Home (`/`) and the Workspace Environment (`/workspace/:id`), as built.

**Out of scope:** Worlds, labs, the bench and learning content. None exist yet.

| Item | Value |
|---|---|
| Build audited | Debug binary rebuilt from the current source (`pnpm build`, then `tauri build --debug --no-bundle`). Source fingerprint identical before and after (the fingerprint's scope is stated in section 9; it does not cover configuration or build files). |
| Desktop capture | The real built binary, run inside an isolated nested X server (Xwayland, display `:99`, 1280x692), with its own data directory and its own D-Bus session. Frames grabbed with `ffmpeg x11grab`. Input sent as real X key events through XTEST. |
| Why nested | The host portal screenshot call answered `code 2` (cancelled) and produced no file, so the host desktop could not be captured. This is a blocker for native-Wayland capture, not for the audit. |
| Renderer | WebKitGTK (package `webkit2gtk-4.1`, library `libwebkit2gtk-4.1.so.0.21.10`; the product version was not recorded) in a 1100x720 window (the configured size). No window manager ran in the nested server, so window title bar and decorations are not captured. |
| Themes | Dark: the system setting (`prefer-dark`). Light: forced for the isolated process through a private GTK and COSMIC config. The application itself follows the system scheme in both. |
| Data | Three workspaces created through the UI. Two malformed folders added by hand to the test data directory to reach the unopenable state. Data directory is under the scratchpad. The real home directory was not used. |
| Additional DOM probe | The same built pages served locally and opened in Chrome with a stand-in `invoke`, only for measurements that need a DOM: accessibility tree, target sizes, computed colours, overflow. Marked "DOM probe" below. It is not the desktop app. |
| Skills | Impeccable 4.9.2 (`audit` workflow and the desktop-app notes in `critique`, detector), Intent 1.7.4 (`evaluate` heuristics and its Dead-Ends and Missing-Feedback entries), frontend-design 1.1.1 (its list of generic-default traits, used only as a lens). No visual direction was explored. |
| Impeccable detector | `detect --json src/app src/styles.css` returned `[]` (no mechanical findings). |

## 2. User flow and observations

All screenshots are in the dark theme unless the name ends in `-light`. The small cross in some frames is the nested server's root cursor, not part of the application.

| # | Step | Screenshot | Observation |
|---|---|---|---|
| 1 | Launch, empty data directory | [01](design-audit-2026-11-17/screenshots/01-launch-empty-dark.png) | Opens on Home. App bar shows the product name as small muted text. H1 "Workspaces", a "New workspace" field with an enabled "Create workspace" button, then "Existing workspaces" with "No workspaces yet. Name one above to create it." |
| 2 | Keyboard: Tab, Tab | [02](design-audit-2026-11-17/screenshots/02-focus-first-tab-dark.png), [03](design-audit-2026-11-17/screenshots/03-focus-second-tab-dark.png) | Order is field then button. A 2 px accent ring with an offset shows on both. |
| 3 | Enter on the empty field | [04](design-audit-2026-11-17/screenshots/04-validation-empty-submit-dark.png), [20](design-audit-2026-11-17/screenshots/20-validation-empty-submit-light.png) | Red message "Enter a name for the workspace." under the field. Border turns red. Focus is on the field. |
| 4 | Whitespace only; 65 characters | [05](design-audit-2026-11-17/screenshots/05-validation-whitespace-only-dark.png), [06](design-audit-2026-11-17/screenshots/06-validation-too-long-dark.png) | Same message for whitespace. "The name is longer than 64 characters. Use a shorter name." for 65. Typed text is kept. The limit is never shown before failing. |
| 5 | Create "Adder bench" | [07](design-audit-2026-11-17/screenshots/07-created-first-dark.png) | Field clears and keeps focus. A muted line `Created "Adder bench".` sits directly under the field. The list shows one row. |
| 6 | Create "Scratch", then "Adder bench" again | [08](design-audit-2026-11-17/screenshots/08-populated-three-dark.png) | A duplicate name is accepted. The list reads Scratch, Adder bench, Adder bench. Each row shows name, creation time as `YYYY-MM-DD HH:MM UTC`, and an 8-character id. |
| 7 | Tab to a row, Enter | [09](design-audit-2026-11-17/screenshots/09-focus-on-list-link-dark.png), [10](design-audit-2026-11-17/screenshots/10-entered-workspace-dark.png) | Row ring is inset. The environment shows a "Workspaces" back link, H1 with the name, "Created … · full UUID", and a dashed box "This workspace is empty. Nothing has been added to it yet." |
| 8 | Tab in the environment | [11](design-audit-2026-11-17/screenshots/11-environment-tab-focus-dark.png), [12](design-audit-2026-11-17/screenshots/12-environment-second-tab-dark.png) | First Tab lands on the back link. Second Tab leaves the page with no visible focus. Expected, since nothing else is focusable. |
| 9 | Close and reopen the app, same data | [13](design-audit-2026-11-17/screenshots/13-reopen-restored-list-dark.png) | All three workspaces are listed again. The app opens on Home, not on the workspace that was open when it closed. |
| 10 | Enter again after reopen | [14](design-audit-2026-11-17/screenshots/14-focus-first-list-link-after-reopen-dark.png), [15](design-audit-2026-11-17/screenshots/15-reentered-workspace-after-reopen-dark.png), [16](design-audit-2026-11-17/screenshots/16-environment-first-tab-dark.png), [17](design-audit-2026-11-17/screenshots/17-environment-second-tab-dark.png) | Same workspace, same name and id, as before closing. |
| 11 | Light theme | [18](design-audit-2026-11-17/screenshots/18-home-returned-populated-light.png), [19](design-audit-2026-11-17/screenshots/19-focus-input-light.png), [21](design-audit-2026-11-17/screenshots/21-focus-list-link-light.png), [22](design-audit-2026-11-17/screenshots/22-entered-workspace-light.png), [23](design-audit-2026-11-17/screenshots/23-environment-first-tab-light.png) | The same layout, with a near-white page and a dark-blue accent. Focus rings are visible. |
| 12 | Unopenable entries | [24](design-audit-2026-11-17/screenshots/24-home-with-unopenable-entries-light.png) | Two entries titled "Cannot be opened" in red, each with its short id and a host message ("workspace.json is not a valid JSON object." and "This workspace folder has no workspace.json file."). They have no link and are skipped by Tab. |
| 13 | Data folder not readable | [25](design-audit-2026-11-17/screenshots/25-environment-when-list-unreadable-light.png), [26](design-audit-2026-11-17/screenshots/26-environment-failure-retry-focus-light.png), [27](design-audit-2026-11-17/screenshots/27-environment-after-retry-light.png), [28](design-audit-2026-11-17/screenshots/28-home-list-unreadable-light.png) | The environment heading reads "This workspace could not be opened" over the host message and a "Try again" button. After restoring permissions, Enter on the focused button recovers the workspace. Home shows the same host message with a retry. |
| 14 | Long names (DOM probe) | [29](design-audit-2026-11-17/screenshots/29-long-names-overflow-DOM-check-with-injected-data-dark.jpg) | A 64-character name made of wide letters overflows its row. See D-01. |

**Not captured, and why:**
- **Loading and "Creating…" states:** they last well under a frame interval on a local disk, so no frame caught them.
- **Hover:** no pointer events were sent.
- **Windows narrower or wider than 1100 px in the real app:** there was no window manager to resize it. A wide viewport (1879 px) was checked in the DOM probe only.
- **Native Wayland rendering:** see section 1.

**Rejected captures:** during setup two frames (a black frame and a frame showing a stale error) were discarded and retaken. All 29 files in the folder passed a non-blank check and were each viewed.

## 3. Findings

**Classes:** **Defect** = M1 behaviour or interface is wrong or confusing. **Gap** = does not yet express the approved product. **Recommendation** = proposed improvement, not a decision. **Open** = the foundation does not settle it.

**Severity** is for this application as it stands. A gap is rated by how much it complicates the next stage.

### Structural

| ID | Sev | Class | Finding | Evidence | Why it matters | Direction | Blocks next stage? |
|---|---|---|---|---|---|---|---|
| S-01 | High | Gap | First launch is an empty list plus a free-text "New workspace" form. The learner must understand workspaces and name one before doing anything. | [01](design-audit-2026-11-17/screenshots/01-launch-empty-dark.png), `workspace-home.html` | LE-012 says the first experience is about engineering, not administration, and that creating is never a prerequisite. The automatic initial lab is only a recommendation and has no persistence design. | Redesign Home around entering a world. Whether creation stays and how an initial lab appears needs the owner (O-02). | Complicates. |
| S-02 | High | Gap | "Workspace" is the user-facing word on both screens: H1, label, button, empty text, list heading, and in the host's error messages. | [01](design-audit-2026-11-17/screenshots/01-launch-empty-dark.png), [10](design-audit-2026-11-17/screenshots/10-entered-workspace-dark.png), [24](design-audit-2026-11-17/screenshots/24-home-with-unopenable-entries-light.png), [25](design-audit-2026-11-17/screenshots/25-environment-when-list-unreadable-light.png) | LE-005: the learner never sees "workspace". Some of the wording comes from the Rust host ("workspace.json", "data folder"), so the front end cannot reword it alone. | Re-word the front end in the redesign. Decide separately whether host messages are mapped by `kind` in the front end or reworded in Rust (O-03). | Complicates. |
| S-03 | Medium | Gap | The application bar is a non-interactive text label. Nothing identifies a world or the active lab, and the only way around is a back link on the environment screen. | [10](design-audit-2026-11-17/screenshots/10-entered-workspace-dark.png), `app.html` | LE-011 specifies a persistent world switcher, an identifiable active lab and an explicit route to the Worlds screen. | Treat the shell as new work in the redesign. | No. |
| S-04 | Medium | Gap | The environment is a dashed placeholder with no regions. Layout is a single 42 rem column. | [10](design-audit-2026-11-17/screenshots/10-entered-workspace-dark.png), [29](design-audit-2026-11-17/screenshots/29-long-names-overflow-DOM-check-with-injected-data-dark.jpg) | A document-like column does not yet hold a bench with Library, Inspector and Investigation regions (LE-DESIGN, a recommendation). Wide windows leave most of the width empty. | Out of M1's remit. Decide the shell frame in the redesign without building regions. | No. |
| S-05 | Medium | Open | Reopening the app lands on Home, not in the workspace that was open. The data persists. | [13](design-audit-2026-11-17/screenshots/13-reopen-restored-list-dark.png) | Persistence across close and reopen is covered by LE-003 and held. The launch destination (Worlds or the last lab) was not settled by any decision at the time of the audit. It is now settled by the owner approval recorded in Stage 4 (LE-013 to LE-020). | O-04. | No. |
| S-06 | Low | Open | Unopenable entries are a dead end: the learner can neither remove, rename nor locate them. | [24](design-audit-2026-11-17/screenshots/24-home-with-unopenable-entries-light.png) | No decision covers deleting or repairing a lab. The foundation lists nothing about it. | O-05. Out of scope for the redesign. | No. |

### Defects and interaction

| ID | Sev | Class | Finding | Evidence | Why it matters | Direction | Blocks? |
|---|---|---|---|---|---|---|---|
| D-01 | Medium | Defect | A valid 64-character name made of wide letters overflows its list row, and on the environment screen the heading pushes the page into horizontal scrolling. | DOM probe: row `scrollWidth` 923 against `clientWidth` 591; heading right edge 1236 against its container's 1255; document `scrollWidth` exceeds the viewport. [29](design-audit-2026-11-17/screenshots/29-long-names-overflow-DOM-check-with-injected-data-dark.jpg). No `overflow-wrap` rule exists in `styles.css` or the component CSS. At 1100 px the overflow would start sooner (not measured in the real window). | The backend accepts these names. The layout should hold for every accepted value. | Correct before or with the redesign: long names must wrap or truncate with the full name still reachable. | Complicates. |
| D-02 | Medium | Defect | List order follows the workspace id, so it looks arbitrary. "Scratch", created second, sits above "Adder bench". | [08](design-audit-2026-11-17/screenshots/08-populated-three-dark.png); `workspace_store.rs:144` sorts by id on purpose, for determinism. | The order carries no meaning for the learner. | The sort key is a product question (O-06). Determinism can stay. | No. |
| D-03 | Medium | Defect | Duplicate names are accepted. The only difference between "Adder bench" rows is a short hash and a time. | [08](design-audit-2026-11-17/screenshots/08-populated-three-dark.png) | The learner cannot tell which is which by name. | Open: uniqueness is a backend and product decision (O-07). | No. |
| D-04 | Low | Defect | Times show in UTC only. The test machine's local time was 18:17 (+07) when the list showed 11:17 UTC. | [08](design-audit-2026-11-17/screenshots/08-populated-three-dark.png), `workspace-format.ts` | A learner reads local time. | Recommendation: show local time with UTC available, or a relative time. | No. |
| D-05 | Low | Defect | The success line `Created "X".` sits tight under the field, is muted, and stays until the next action. Nothing marks the new row. | [07](design-audit-2026-11-17/screenshots/07-created-first-dark.png), [08](design-audit-2026-11-17/screenshots/08-populated-three-dark.png) | Feedback is easy to miss, and in a long list the new row can be off-screen. Missing Feedback risk, mild. | Recommendation: closer link between the message and the new row. | No. |
| D-06 | Low | Defect | The 64-character limit is stated only after a failed attempt. | [06](design-audit-2026-11-17/screenshots/06-validation-too-long-dark.png) | Predictable limits are better stated before the failure. | The front end must not duplicate name rules (Task 3.7). Open (O-08). | No. |
| D-07 | Low | Defect | The window title and `document.title` are the same on every screen ("Engineering Learning Environment"). | `index.html:5`, no route titles in `app.routes.ts`; the Chrome tab title was identical on `/` and `/workspace/…`. | Screens cannot be told apart by title in a window switcher or by assistive technology. Focus is moved to the heading on entry, which softens this. | Recommendation: per-route titles. | No. |
| D-08 | Low | Defect | The environment shows the full 36-character UUID in monospace. | [10](design-audit-2026-11-17/screenshots/10-entered-workspace-dark.png) | Administrative detail with no learner use. | Recommendation: de-emphasise or remove. | No. |
| D-09 | Low | Defect | The environment heading for a failed read says "This workspace could not be opened". The failure is actually that the list could not be read. | [25](design-audit-2026-11-17/screenshots/25-environment-when-list-unreadable-light.png) | Mildly misleading, though the host message and retry are correct and recovery works. | Wording work in the redesign. | No. |

### Accessibility and visual

| ID | Sev | Class | Finding | Evidence | Direction |
|---|---|---|---|---|---|
| A-01 | Medium | Defect (risk) | The input's border contrast against the page is low: 2.1:1 (dark, measured on the rendered DOM) and 1.8:1 (light, from the tokens). | DOM probe; `styles.css` `--line-strong`. | WCAG 1.4.11 wants 3:1 where the border is what identifies a control. Whether it applies here depends on the label and position cues, so it needs a judgement. Strengthen the border in the redesign. |
| A-02 | Low | Defect (risk) | Row separators and the list border are 1.36:1 (dark) and 1.29:1 (light). | DOM probe; tokens. | Decorative, but the rows are the only links on Home. Rely less on the hairline. |
| A-03 | Low | Open | The back link is about 71 x 18 px (estimated from its focus-ring box in [23](design-audit-2026-11-17/screenshots/23-environment-first-tab-light.png)), under 24 px high. | Frame measurement. | It has no neighbouring target, so the spacing exception probably applies. Verify against WCAG 2.5.8 at implementation level. |
| A-04 | Low | Open | The `role="status"` message is inserted with its content. Some screen readers do not announce a live region created that way. | `workspace-home.html:27`. | Needs assistive-technology testing. Not inspectable here. |
| V-01 | Medium | Gap | The visual language is a generic form-and-list page: system sans, one centred column, accent-filled button, hairline-bordered rows. Nothing yet reads as a laboratory. | [01](design-audit-2026-11-17/screenshots/01-launch-empty-dark.png), [08](design-audit-2026-11-17/screenshots/08-populated-three-dark.png), [22](design-audit-2026-11-17/screenshots/22-entered-workspace-light.png) | LE-009: an engineering laboratory, dense, not a dashboard. This is the redesign's job. Not a defect in M1. |
| V-02 | Low | Defect | Several small texts are 12–13 px (app bar 12.2, meta 13.1, ids 12.2). Contrast is fine (dark 7.6:1 measured; light 6.8:1 from tokens). | DOM probe. | Size is a density decision for the redesign, given LE-009's wish for dense information. |

### What works (observed, to preserve)

- **Keyboard:** Tab order is logical, Enter submits, a failed submit returns focus to the field, and the 2 px accent focus ring is visible in both themes ([02](design-audit-2026-11-17/screenshots/02-focus-first-tab-dark.png), [19](design-audit-2026-11-17/screenshots/19-focus-input-light.png), [21](design-audit-2026-11-17/screenshots/21-focus-list-link-light.png)).
- **Entering a workspace:** focus moves to the new heading, so the first Tab reaches the back link.
- **Error recovery:** errors name the problem and the way out; retry works after a real read failure ([26](design-audit-2026-11-17/screenshots/26-environment-failure-retry-focus-light.png), [27](design-audit-2026-11-17/screenshots/27-environment-after-retry-light.png)).
- **Typed text** survives a failed submit.
- **Unopenable entries** are visible, named and not clickable.
- **Structure:** the accessibility tree has a banner, a main, one H1, a labelled form and a labelled region. The input has a label tied to it.
- **Text contrast** measured 7.6:1 to 14.7:1 in dark; the tokens give 6.6:1 to 15.3:1 in light.
- **Persistence and route restoration:** data survives a full close and reopen. A refresh at `/workspace/<id>` restores the same workspace.
- **Targets:** the field and button are 40 px high and the rows 65 px high (DOM probe).
- **Themes:** both themes render correctly and follow the system.

## 4. Accessibility limits

Nothing here is a WCAG compliance claim.

- **Observed:** keyboard order and operation, focus visibility, focus movement after submit and entry, visible error text, landmarks and the accessibility tree (through Chrome's), contrast on the rendered DOM, and target sizes.
- **Needs implementation-level review:** contrast of every state in the real app, non-text contrast, reduced-motion behaviour, text scaling and zoom, and use at narrower or larger window sizes.
- **Needs assistive-technology testing:** screen-reader announcements for the status and alert regions, the reading of the link text (the tree showed the row's link without a computed name in this tool's output), and focus handling after route changes.
- **Not tested at all:** hover and pressed states, high-contrast modes, and right-to-left or bidirectional names beyond one Arabic and CJK sample.

## 5. Comparison with the product foundation

| Foundation | Current state | Class |
|---|---|---|
| World, Lab, Bench vocabulary (LE-005) | "Workspace" everywhere | S-02 |
| World switcher and identifiable active lab (LE-011) | None | S-03 |
| First launch enters Computer Foundations with no configuration (LE-012, recommendation) | Empty list and a name form | S-01 |
| Bench regions (LE-DESIGN, recommendation) | One column and a placeholder | S-04 |
| Laboratory character, dense (LE-009) | Generic form and list page | V-01 |
| Returning to the Worlds screen never destroys work (LE-011) | Holds: navigating home and back leaves workspaces intact | Preserved |
| Nothing refused for a missing step (LE-008) | Not applicable at M1 | n/a |
| Local persistence (LE-001, LE-003) | Holds: close and reopen restored all workspaces | Preserved |

## 6. Prioritised order

1. **S-01, S-02** (High): the first experience and the vocabulary. They define Home.
2. **D-01** (Medium): the only defect that breaks layout for valid input.
3. **S-03, S-04, V-01** (Medium): the shell and the visual direction.
4. **D-02, D-03, S-05, A-01** (Medium): need a product answer or a small design change.
5. **D-04 to D-09, A-02 to A-04, V-02, S-06** (Low).

**Structural** findings are S-01 to S-06. Visual polish is V-02, D-05, D-08, and the spacing and wording notes.

## 7. Redesign readiness

**Preserve:**
- The lifecycle behaviour and route restoration.
- Keyboard order and focus management.
- The error and retry pattern, and typed-text retention.
- Unopenable entries being visible and not clickable.
- Both themes following the system, and token-based colours.
- The gateway boundary, and backend-authoritative validation.

**Correct before or with the redesign:**
- D-01 (long names).
- The wording that depends on the "workspace" term, once O-03 is answered.

**Redesign in the next stage:**
- Home as the Worlds screen.
- The application shell: app bar, world and lab identity, and the route to Worlds.
- The visual language, aimed at an engineering laboratory.
- The environment's frame and its empty state (a frame only, with no regions built).
- Copy.

**Keep out of scope:**
- Building the bench, regions, probes, components or any simulation.
- The experimentation and branching model.
- Persistence changes for labs and worlds.
- Deleting, renaming or repairing a lab.
- Automatic lab provisioning (it has no design yet).
- Docking and resizing.
- Any change to Rust or the command contract, unless O-03 chooses it.

### Questions for the owner

| ID | Question | Why it matters |
|---|---|---|
| O-01 | For the redesign, should Home become the Worlds screen with a single entry (Computer Foundations) while the existing workspace records are kept unchanged, or should the redesign only restyle and re-word the current list? | It decides whether lifecycle behaviour changes in Stage 4. |
| O-02 | May the redesign keep a "Create new lab" action on the Worlds screen even though automatic provisioning is not designed? | Creation is the only way to get a lab today. |
| O-03 | Should the learner-facing wording of host errors be mapped by error `kind` in the front end, or reworded in the Rust host? | The host messages contain internal terms. |
| O-04 | When the app launches, should it open the Worlds screen, or the last lab? | Unresolved at the time of the audit. LE-003 covers that data persists, not where launch lands. Answered afterwards (restore the last active lab; see Stage 4). |
| O-05 | Is deleting or repairing an unopenable entry in scope for any near stage? | It is a dead end today. |
| O-06 | What order should labs be listed in: most recent first, name, or last opened? | The order is currently by id. |
| O-07 | Should lab names be unique within a world? | Duplicates are accepted today. |
| O-08 | May the interface show the name limit before a failed attempt, given that the front end must not duplicate rules? | A hint would have to come from the host. |

## 8. Unknowns and blockers

- Native-Wayland capture was not possible (portal screenshot cancelled). The capture is from WebKitGTK under a nested X server and may differ in font choice and window chrome from the real session.
- Window title bar and decorations were not captured.
- Loading, creating and hover states were not captured.
- No screen-reader or high-contrast testing.
- Real-window behaviour below or above 1100 px is unknown. `tauri.conf.json` sets 1100 x 720, resizable, and no minimum.
- Contrast for the light theme comes from the tokens, not from the rendered DOM.
- The DOM probe used injected data, not the host.

## 9. Evidence

**Files created (nothing else was written to the repository):**
- `apps/desktop/DESIGN_AUDIT.md`
- `apps/desktop/design-audit-2026-11-17/screenshots/`: 29 files (28 PNG from the desktop app, 1 JPEG from the DOM probe).

**Commands and manual checks:**
1. Read `GOVERNANCE.md` and the knowledge repository's `CLAUDE.md` (the application repository has none), then Impeccable `audit.md` and the desktop notes in `critique.md`, Intent `evaluate`, and frontend-design.
2. `pnpm build` and `pnpm exec tauri build --debug --no-bundle` in `apps/desktop` to rebuild from current source. Build output directories are git-ignored.
3. `Xwayland :99` (nested, isolated). The app launched with private `XDG_DATA_HOME`, `XDG_CACHE_HOME`, `XDG_CONFIG_HOME`, `GDK_BACKEND=x11`, and a private D-Bus session for the light run.
4. Real key events through XTEST (Tab, Shift+Tab, Return, typed text, Ctrl+A), sent only to display `:99`.
5. `ffmpeg x11grab` frames, each viewed. Non-blank check (background colour and content-pixel count) on all 29 files.
6. Manual states: whitespace-only and 65-character names, three creations including a duplicate, two hand-made malformed folders, `chmod 000` on the data folder and restore, close and reopen of the app against the same data.
7. DOM probe in Chrome on the locally served build with an injected `invoke`: accessibility tree, computed contrast through a canvas, target sizes, overflow with 64-character names.
8. `impeccable detect --json src/app src/styles.css`: `[]`.
9. A source fingerprint was taken before the rebuild and after the audit: `cd97c21d4b9c64e9` both times. **Scope:** SHA-256 over the files under `apps/desktop/src`, `apps/desktop/src-tauri/src` and `packages` only (excluding `node_modules` and `target`). **Not covered:** `apps/desktop/src-tauri/tests/`, `Cargo.toml` and `Cargo.lock`, `tauri.conf.json`, `capabilities/`, `build.rs`, `package.json`, `pnpm-lock.yaml`, `angular.json` and the `tsconfig*` files, and the root workspace files.

**Working tree (application repository), at the end of the audit:**
```
?? apps/
?? package.json
?? packages/
?? pnpm-lock.yaml
?? pnpm-workspace.yaml
```
The repository has never had these files committed, so Git shows them untracked and cannot show a per-file diff. Two checks support the statement that no implementation file changed, and neither is a complete proof: (1) the fingerprint above, within its stated scope, and (2) a search for files under `apps` and `packages` newer than `apps/desktop/PRODUCT.md`, the last file written before the audit, excluding generated output (`node_modules`, `dist`, `.angular`, `target`, `gen`), this report and its screenshot folder. That search covers configuration and build files that the fingerprint does not. Neither check detects a change that restored a file's timestamp or content, and the audit session did not edit any file other than those it lists.

**Knowledge repository:** unchanged by this task. `M project/learning-environment/LE-DECISIONS.md`, `?? LE-DESIGN.md`, `?? LE-PRODUCT.md` are from the earlier documentation tasks.

**Cleanup:** the app, the nested X server and the local web server were stopped by process id. The test data directory remains under the session scratchpad only.
