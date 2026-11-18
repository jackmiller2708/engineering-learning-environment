# Step 4 report: the Worlds screen

Date: 2026-11-18. Status: **implemented, with the limits in section 6. Stopped. Nothing was committed, pushed, tagged or staged.** Plan: [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md) section 8, row 4. Earlier: [STEP3_REPORT.md](STEP3_REPORT.md). Decisions: `~/Projects/engineering-knowledge/project/learning-environment/LE-DECISIONS.md` (LE-014, 016, 017, 018, 019, 020; read, not modified).

## 1. Scope (brief row 4, DESIGN_SPEC 5, 7.1, 7.2, 7.5 to 7.9, 9, 10)
`WorldsScreen`, `LabCreateForm` and `LabList` replace the home screen at `/worlds`, with the recovery notice from the resolver's outcome. Depends on steps 2 and 3. Excluded: the lab screen (step 5), the copy sweep and `document.title` (step 6), the minimum window size and 720 × 480 (step 7), the responsive and accessibility pass (step 8), any Rust, command, capability, domain or dependency change, and any change to lab records.

## 2. Changes (`apps/desktop/src/app/`)
- `workspaces/worlds-screen.{ts,html,css}` (renamed from `workspace-home.*`): rail ("Worlds", Computer Foundations as the current link), `h1` that takes focus on arrival, the recovery notice, the form, the "Labs" section with a count, the loading status, the list-failure panel (lead "Your labs could not be loaded."; after a failed launch check, "Your labs couldn't be checked."), the empty state. Showing it opens no lab and creates none.
- `workspaces/lab-create-form.{ts,html,css}` (new): the create state machine. Name sent exactly as typed; hint "Up to {WORKSPACE_NAME_MAX_LENGTH} characters." from `@ele/domain`; no `maxlength`; messages from `describeError`, never the host's text; `aria-describedby` = error then hint; focus returns to the field; status region always present; "Created “…”." with an "Open lab" link. It emits `created` and `unconfirmed`.
- `workspaces/lab-list.{ts,html,css}` (new): `sortLabsNewestFirst` order, local Created time (UTC in `title`, offset in the header), clamped name with `title` and `dir="auto"`, "New" tag, the "Cannot be opened" group (icon, word, short id, reason by kind, not links; Try again for `entry_unreadable` only).
- `workspaces/launch-notice.ts` (new): in-memory, take-once hand-over of the launch outcome from `LaunchResolver` to the screen. Not persisted and not the last-lab pointer.
- `workspaces/launch-resolver.ts`: sets that outcome (absent, invalid, list failed). Pointer behaviour unchanged.
- `workspaces/describe-error.ts`: `isUnconfirmedCreate(kind)`, so the form knows when to refresh the list (R5).
- `app.routes.ts`: points at `WorldsScreen`.
- Tests: `worlds-screen.spec.ts` (33 cases; replaces `workspace-home.spec.ts`), a case in `describe-error.spec.ts`, and four assertions in `launch-resolver.spec.ts` / `workspace-environment.spec.ts` that used the old Worlds heading "Workspaces" as a marker for "arrived on Worlds" (now "Computer Foundations").

## 3. Decisions made where the documents are silent (change any you disagree with)
1. **The launch outcome travels in a small service,** not router state, so it cannot come back through Back or a reload. The brief's file list does not name it.
2. **List-failure panel after a failed launch check** appears only if the Worlds screen's own listing also fails. If that listing succeeds there is no panel, because "couldn't be checked" would be false.
3. **Empty state** only when the list has no entries at all. If every entry is unopenable, the screen shows "0 labs" and the group, not "You have no labs".
4. ~~**The title line** "Binary representation, logic gates and adders."~~ **Removed by owner decision (section 8).** The Worlds title block is the `h1` alone.
5. **The "New" tag** (decided by the owner, section 8): transient. It moves to the next successfully created lab and stays until then. **It is also lost when the learner leaves Worlds and returns** (the screen is rebuilt; verified in the acceptance review), which this report first omitted. DESIGN_SPEC 5.6 says "until the next create or reload". The "Created" status line clears when a new attempt starts (as before).
6. **Only unconfirmed kinds refresh the list after a failed create** (`internal_error`, `unexpected_error`, unknown). Clock and storage kinds do not.
7. **The offset in the Created header** is the machine's offset now. Each time follows its own date.
8. ~~No separate component specs.~~ **Closed in the acceptance review:** the brief's row 4 lists specs for both components, so `lab-list.spec.ts` and `lab-create-form.spec.ts` were added (8 cases).

## 4. Tests
| Run | Result |
|---|---|
| `worlds-screen.spec.ts` against the old home screen, before the components existed | 32 failed, 1 passed (behavioural red) |
| After implementation | 33 passed. One test first failed because its selector matched the form's new empty status region; the selector was fixed, not the code |
| Mutation checks (each reverted and confirmed) | no sort (3 failed), no refresh on unconfirmed (3), N-1 title ignored (1), notice not forgotten (1), no heading focus (1), resolver sets no outcome (1), host text shown (7), unopenable entry as a link (1). **My first revert missed `lab-list.html`,** which left a leftover mutation and one failing test; I found it, removed it and reran |
| Full suite (once: a rename, a resolver change and shared styles) | 4 existing tests failed on the old heading marker; fixed; then **198 passed, 0 failed** (9 files) |
| `ng build`, `tauri build --debug --no-bundle` | succeeded |

## 5. Runtime checks (built debug app, isolated X display, throwaway XDG directories, dark theme, `TZ=Asia/Bangkok`)
- Fresh start: Worlds with the rail, the title (heading focused), the form with "Up to 64 characters.", "0 labs" and the empty state.
- Empty submit: "Enter a name for the lab." under the field, field marked invalid and focused, hint still shown.
- A 70-character name: "The name is longer than 64 characters. Use a shorter name.", text kept.
- Two labs created: "Created “Adder bench”." with Open lab, "New" tag on the new row, field cleared, newest first, header "Created (GMT+7)". **This shows `Intl` `shortOffset` working inside the real app,** not only in the WebKitGTK library as in step 3.
- (The title line in the frames below was still present when these checks were run; it has since been removed, section 8, and the removal was not re-rendered in the app.)
- Opening a lab from a row, returning by the breadcrumb, and restoring it after a clean close and reopen: worked with the changed resolver (the G5 behaviour).
- **G6b:** lab folder moved aside, start: Worlds with "Your last lab is no longer available."; folder returned, start: Worlds, no notice, the lab not reopened (pointer cleared).
- **Unopenable group:** a throwaway manifest was corrupted. The entry showed in "Cannot be opened" with the icon, the short id and "The information saved for this lab cannot be read or is not valid." (not the host's text), with no controls.
- **G7:** labs directory `chmod 000`, start: one panel, "Your labs couldn't be checked." with the list sentence and Try again. Try again while still unreadable: same panel. Permissions restored and Try again: the list replaced the panel and the learner stayed on Worlds. Close and start: the lab was restored, so the pointer survived.

## 6. Not verified, and limits
- **Light theme: not verified** (still no way found to make WebKit report light here).
- **Comparison with `artifacts/screenshots/`: not done.** I looked at my frames only.
- **720 × 480: not verified**, assigned to step 7. The display was 1280 × 692 and the window 1100 × 720, so the bottom 28 px were cut off; no narrow-window layout was seen. The rail is fixed at 232 px.
- **Assistive technology and screen readers: not verified.** Whole-row link names, the notice and status announcements, and focus order are untested. **Corrected in the acceptance review (section 7):** the loading line did violate DESIGN_SPEC 9 and was fixed. The launch notice does not fall under that rule as written.
- **Keyboard flow in the real app** was not exercised for Worlds beyond the Enter-to-submit path. Long and mixed-direction names were tested only for `title`, `dir` and the clamp classes in the unit test, not rendered in WebKit.
- **G1 to G4, G6a, G6c and G8 were not rerun.** G5, G6b and G7 were, as the resolver changed.
- The old global rules in `styles.css` (`.entries`, `.unavailable`, `.empty`, `.error`) are now unused by Worlds. Left for the step 6 sweep.
- The lab screen is unchanged: it still says "Workspaces" and "This workspace is empty", and keeps its own back link (step 5).
- This report does not claim DESIGN_SPEC has passed.

## 7. Acceptance review (Task 3.15)

### 7.1 The status-region requirement
**Text:** DESIGN_SPEC section 9, "Status and alerts": *"loading and success use a status region that exists in the page **before** its text changes (A-04: a region inserted together with its content may not be announced). Failures use an alert."* Also 7.1 ("`Loading labs…`, a polite status"), 7.5 (create failure announced as an alert), 7.7 (the recovery notice is "a status region"). The brief's row 4 does not test it, and row 8 lists announcements for assistive-technology verification.

| Element | Requirement | Before review | Now |
|---|---|---|---|
| Create success line | exists before its text | met (an empty `role=status` is always in the form) | unchanged |
| Create failure | alert | met | unchanged |
| **"Loading labs…"** | exists before its text changes | **violated**: a `<p role=status>` was created with its text and destroyed afterwards | **fixed**: one `role=status` element stays in the Labs section and only its text changes. Empty, it takes no space (`:not(:empty)` padding, no `display:none`, which would remove it from the accessibility tree) |
| Launch recovery notice | 7.7: "a status region" | met as written. A-04 names *loading and success*, and this is neither. **My earlier report said otherwise and overstated it** | unchanged. The same rationale could be argued for it, but the spec does not require it, so I did not add a requirement |

Limits of the fix: on the very first render of Worlds the loading text is still present when the region is created. The correction makes every later change (Try again, any reload of the list) a change inside an existing region. Whether it is announced is **not verified**: no assistive technology was used, and the DOM and a rendered check cannot show it. The lab screen's "Opening workspace…" and the launch resolver's "Opening your last lab…" have the same shape and are outside Step 4 (steps 5 and 1).

Evidence: two new tests, red before (2 failed), green after; a mutation that puts the region back inside the `@if` fails both. Rendered in the built app: the layout is unchanged with the empty region, and the failure panel and the recovered list render as before.

### 7.2 Recovery behaviour, verified against the specification
New or strengthened tests in `worlds-screen.spec.ts` (all green; mutations: a transient failure reported as "absent" fails 2, definitive kinds no longer clearing the pointer fails 9):
- every definitive kind produces "Your last lab (…) cannot be opened." and clears the pointer; `entry_unreadable` and an unknown kind produce "could not be read" and keep it;
- a missing lab produces "no longer available"; a failed check produces neither that nor any "Your last lab" notice;
- Try again, pressed twice, never creates a lab, never navigates, and leaves the pointer as it was;
- the notice appears once, not after navigating to a lab and back, and not on a plain visit to `/worlds` even with a stale pointer (a reload does not run launch).
Not tested in a real reload: the built app has no reload control I could use. The in-memory hand-over cannot survive one by construction.

### 7.3 Classification of the documented deviations
| # | Deviation | Class |
|---|---|---|
| 1 | Launch outcome handed over by a small in-memory service | Reasonable choice where the specification is silent. 7.7 requires the notice to be unstored and gone after navigating away, which it satisfies |
| 2 | Failure panel with "Your labs couldn't be checked." only if Worlds' own listing also fails | Reasonable choice where silent. The 7.2 table says "Worlds, with one list-failure panel" and does not cover a launch check that fails when the next listing succeeds. Showing the panel then would claim a failure that no longer holds. A product question remains if the owner wants that case mentioned |
| 3 | World description "Binary representation, logic gates and adders." | **Closed by the owner: removed (section 8).** Was an unresolved product/copy decision. 5.2 requires "one line" and gives no text. The line comes from the prototype, which the owner saw, but it was not listed as a review item, and it names content that is not built yet while the spec says copy "states what is true". Needs owner confirmation |
| 4 | All entries unopenable: "0 labs" and the group, not the empty state | Reasonable choice where silent. LE-020 requires the entries to be visible; 5.5's empty state is for no labs. The form's hint still invites creation |
| 5 | "New" tag lifecycle | **Closed by the owner: transient (section 8).** Was a reasonable choice where the spec is ambiguous (5.6: "next create or reload"). The tag survives failed attempts and list refreshes and is lost on leaving the screen, which "reload" does not clearly cover. Not changed. Owner may want it kept across navigation |
| 6 | Only unconfirmed kinds refresh the list after a failed create | Permitted by the specification (7.5 asks for the refresh for exactly those kinds) |
| 7 | Created header shows the machine's current offset; each row follows its own date | Reasonable choice where silent (5.4 leaves daylight saving open). In a zone with daylight saving a row from the other season can differ from the header by an hour; the UTC time is in each row's tooltip. Only `Asia/Bangkok` was run in the app |
| 8 | No separate component specs | **Specification violation of the brief's file list** (row 4: "new `lab-create-form`, `lab-list` files and specs"). Closed by adding both specs |
| 9 | Title line, step 4 only: "Binary representation…" | see 3 (removed) |

Not a deviation but worth knowing: the form's heading is "Create new lab" and its button the same words, as in the prototype.

### 7.4 Remaining gaps
Unchanged from section 6: light theme, comparison with `artifacts/screenshots/`, 720 × 480 (step 7), assistive technology, the unrun gates G1 to G4, G6a, G6c, G8. Added: announcement of the loading region is unverified, and the lab screen still carries the old copy until step 5.

## 8. Decisions closed by the owner (Task 3.16)

**1. The World description is removed.** "Binary representation, logic gates and adders." described content that does not exist yet. The Worlds title block is now the `h1` "Computer Foundations" alone; the paragraph and its `.sub` rule are deleted (`worlds-screen.html`, `worlds-screen.css`). **DESIGN_SPEC 5.2 still says "an `h1` with the world name and one line of description" and the prototype still shows the line. I did not edit them, so they now disagree with the application. They need a one-line correction when the owner wants the spec kept authoritative.** *(Update, Step 5: DESIGN_SPEC 5.2 and the prototype were corrected. The `worlds-*` frames under `artifacts/screenshots/` still show the line and are stale.)* Test: "has no description line" (red against the old screen, green after).

**2. The "New" tag is transient, as specified by the owner:**
| Required | Behaviour | Evidence |
|---|---|---|
| Appears after a successful creation | `onCreated` sets it from the host's returned lab | existing test, unchanged |
| Remains while the learner stays on Worlds | not cleared by a failed attempt, an unconfirmed attempt (which re-reads the list), or a refresh | new test; a mutation that clears it on an unconfirmed result fails it (my first mutation targeted a path the test did not exercise and survived, so I extended the test and reran) |
| Clears when navigating away from Worlds | the screen is rebuilt on return, so the state is gone | new test: create, open the lab, return, no tag |
| Does not survive reload | held in a component signal only. No `localStorage` key, no lab-record field, no host call | new test: no storage key of any kind written; a freshly mounted screen shows no tag. A mutation that stores it in `localStorage` fails 2 tests. **A real reload in the built app was not performed** |
| Moves to the latest successfully created lab | one id, replaced on each success | new test (two creations, tag on the second row only); a mutation that keeps the first id fails it |

No application code was needed for the tag: the behaviour already held. Section 7.3 row 5 and section 3 item 5 are updated, and my earlier statement that leaving Worlds loses the tag is now the required behaviour, not a deviation. No persistent metadata and no domain or host contract change.

**Validation:** `worlds-screen.spec.ts` 53 passed, 0 failed. The rest of the suite and `ng build` are run and reported below in the task summary, not here. Light theme, comparison with the design frames, 720 × 480, assistive technology and the unrun gates remain unverified, as in sections 6 and 7.4.
