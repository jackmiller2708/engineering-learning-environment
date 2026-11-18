# Review handoff: Stage 4 (revision 3)

> **Update (Task 3.11):** the owner decisions in this file were answered, step 1 was implemented and the gate run. See [STEP1_REPORT.md](STEP1_REPORT.md). The publication section below predates the three new private remotes and is superseded by STEP1_REPORT section 6.

Status (as written; superseded, steps 1 to 6 are now implemented, see IMPLEMENTATION_BRIEF section 8): **awaiting owner review. Nothing is implemented, committed, pushed or published.** This file lists every outstanding owner decision, the confirmed decisions, the implementation order, the publication plan and the one next action. The detail lives in the documents it links to and is not repeated here, except R1 to R6, which are given in full.

Documents: [DESIGN_SPEC.md](DESIGN_SPEC.md) (error tables in section 10), [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md) (sequence in section 8), [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md), [REVISION_REPORT.md](REVISION_REPORT.md) (revision 2, kept as written).

## 1. Decisions confirmed in this round

| Decision | Reflected in |
|---|---|
| Computer Foundations is shown as an available World on the Worlds screen. **Showing a World is not entering a Lab.** No Lab is opened automatically and none is created automatically. Creating a Lab is an explicit learner action. | DESIGN_SPEC 1 and 5; brief step 4 (tests that arrival, selecting the World and an empty list neither navigate nor call create) |
| System fonts for the initial implementation. System sans for interface text. Monospace only for technical values, identifiers and timestamps. No bundled font and no font dependency. Reopened only if a real rendering problem is shown. | DESIGN_SPEC 3; DESIGN_DIRECTION; brief 1, 8 (step 3), 10 |
| The persistence test is the first implementation gate. | brief section 8, step 1 (G1 to G8) |
| 720 × 480 is the **approved and locked** minimum (LE-021, Task 3.24). | DESIGN_SPEC 8 and 8.1; brief step 7. Verification is partly done (STEP7_REPORT, STEP8_REPORT). |

**One interpretation to confirm (C-1).** The design shows the World's lab list directly on the Worlds screen, with no separate "Open world" step between the rail item and the list. That is one reading of "available World that does not automatically open a Lab". If you want an explicit step, it is an addition to that one screen. Recommendation: no extra step while only one World exists. Neither choice changes the Lab rules above.

## 2. Error wording: R1 to R6

Rules that apply to every item: the host `kind` values and messages are **unchanged**. The translation is a frontend function from `kind` to text, and the host `message` is never shown. A message says what happened, and what the learner can do only when there is something they can do. "No lab was created" appears only where the host itself says nothing was created or published. The proposed wording is in DESIGN_SPEC 10 and is applied nowhere until you answer.

Your list wrote `manifest_unsupported`. The host's kind is **`manifest_unsupported_version`**, and it is used below.

### What the host actually guarantees (read from `workspace_commands.rs`)

| Kind | Host message says | Guaranteed | Not guaranteed |
|---|---|---|---|
| `internal_error` (create) | Three sources: name not checkable "Nothing was created"; id not generable "Nothing was created"; **worker did not finish** "Nothing was changed that could be confirmed" | The operation failed | Whether a lab exists. The same kind covers cases that did and did not create one |
| `unexpected_error` | Added by the frontend gateway, not the host | An unrecognised failure reached the frontend | Anything about state |
| `clock_before_epoch`, `clock_out_of_range` | "The system clock is set before 1970 / outside 1970 to 9999. Correct the date and try again." `clock_out_of_range` also carries a timestamp-formatting failure | The clock value was rejected | That nothing was created. The host does not say it, so it is not claimed |
| `id_collision` | "Nothing was changed. Try again." | Nothing changed | |
| `id_unavailable` | "Nothing was created." | Nothing created | |
| `storage_unavailable` (create) | "Nothing was created." plus an optional free-text hint | Nothing created | Which condition (disk full, permission, read-only) is in free text, not in the kind |
| `storage_write_failed`, `storage_publish_failed`, `storage_unsupported` | "Nothing was published." | Nothing published, so no lab became visible | Whether partial scratch data remains |
| `storage_unavailable` (list), `internal_error` (list) | "The list of workspaces could not be read" / worker did not finish | The list was not obtained. Listing changes nothing | Whether a given lab exists |
| `entry_unreadable` | "This workspace could not be read." plus an optional hint | A read of that one entry failed with an I/O error | Whether it is temporary or permanent, or whether the data is intact |
| `manifest_unsupported_version` | Two cases: "no usable schema version", and "uses schema version N. This app reads version 1." | The stored version is not one this build reads | Whether it is older or newer |
| `entry_symlink` | "This workspace folder is a link, and links are not followed." | The entry is a link and was not opened | |
| `manifest_not_utf8` | "workspace.json is not valid UTF-8 text." | The saved information is not valid text | |
| `manifest_missing`, `manifest_not_a_file`, `manifest_too_large`, `manifest_malformed`, `manifest_invalid_field`, `manifest_id_mismatch` | each states its own specific problem | The saved information is missing, unusable or inconsistent | |

### R1. `entry_unreadable` and `manifest_unsupported_version`

- **Unresolved:** whether the application should treat these as permanent (clear the last-lab pointer) or not, and how to word them.
- **Current wording and behaviour:**
  - `entry_unreadable`: "This lab could not be read just now." The pointer is **kept**.
  - `manifest_unsupported_version`: "This lab was saved in a form this version of the application cannot open." Treated as **definitive**, so the pointer is **cleared**.
- **Defect found:** "just now" suggests a temporary cause. The host does not say that.
- **Options for `entry_unreadable`:**
  - **A. As drafted** ("just now", pointer kept).
  - **B. Drop "just now", pointer kept.** "This lab could not be read."
  - **C. Treat as definitive** (pointer cleared).
- **Consequences:** A and B keep the pointer, so if the cause persists the notice repeats at each launch until another lab is opened, which overwrites the pointer. No lab data is affected. C loses the restore if the cause was momentary, and the learner re-opens the lab by hand. B does not imply a cause. A does.
- **Options for `manifest_unsupported_version`:** **D. Definitive, as drafted.** **E. Keep the pointer**, so a later application version that can read the lab restores it. D clears a pointer that an upgrade might have made valid, and the cost is one click, since the pointer is only a convenience. E repeats the notice until another lab is opened. The wording must not say "newer" or "older", because the host raises it for both and for "no usable version".
- **Recommendation:** **B** and **D**.

### R2. `entry_symlink`

- **Unresolved:** whether vague wording is acceptable.
- **Current:** "The application does not open this lab because of how it is stored on this computer."
- **Alternatives:** name the cause ("is a shortcut"), which uses a banned implementation term and implies the learner made one; or the vague wording.
- **Guarantee:** the entry is a link and the host does not follow it. The host gives no learner action, and repair is out of scope (LE-020).
- **Consequence:** the vague text is true and tells the learner nothing they can act on, which is the actual situation. A precise cause would invite an action the application cannot support.
- **Recommendation:** keep the vague wording.

### R3. Shared sentences, including `manifest_not_utf8`

- **Unresolved:** whether merging kinds loses anything the learner needs.
- **Current groups:** create: `id_collision` + `id_unavailable`; `storage_unavailable` + `storage_write_failed` + `storage_publish_failed`. Unopenable: `manifest_not_a_file`, `manifest_too_large`, **`manifest_not_utf8`**, `manifest_malformed`, `manifest_invalid_field`, `manifest_id_mismatch` all read "The information saved for this lab cannot be read or is not valid."
- **Alternative:** one sentence per kind.
- **Consequence:** the distinctions (a file that is too large, that is not text, that has a wrong field) matter only to someone who would inspect or repair the data, and the application offers no repair (LE-020). Separate sentences would need more implementation terms or longer vague text. The storage kinds differ in the host's free-text hint, which the interface does not show and which is not part of the `kind`.
- **Recommendation:** keep the merges. `manifest_not_utf8` stays in the merged group, and is listed as definitive for the pointer.

### R4. "restart the application"

- **Where:** both list-failure messages: "Try again, and restart the application if this keeps happening."
- **Unresolved:** it is advice with no known cause behind it.
- **Alternatives:** keep; or end at "Try again."
- **Consequence:** "Try again" is a real control on every screen that shows this message. Restarting may help or may not, and the host gives no basis for it. Removing it leaves a persistent failure with no suggestion, which matches what the application can truthfully offer.
- **Recommendation:** remove "restart the application".

### R5. Unconfirmed create (`internal_error`, `unexpected_error`, unrecognised kind)

- **Current:** "Something went wrong inside the application, and it cannot confirm whether the lab was created. Check the list below before trying again." The list is refreshed automatically after this error.
- **Why it cannot say more:** the same kind covers failures where nothing was created and a worker that did not finish ("Nothing was changed that could be confirmed"). The two cannot be told apart from the kind.
- **Alternatives:** (a) as drafted; (b) the message only, without the automatic re-list; (c) the "nothing was created" claim, which would be false in the worker case.
- **Consequences:** (a) lets the learner see the truth at once, at the cost of one extra read (the list is read-only). If the re-list itself fails, the list error panel appears. No "New" tag is shown, because success is not confirmed. (b) leaves the learner to find the list stale. (c) risks a duplicate lab.
- **Recommendation:** (a).

### R6. Address states

- **R6a. "identifier"** appears in "The address does not contain a valid lab identifier." and "No lab with this identifier is in your list of labs." These states exist only because the lab route is an address. The desktop window has no address bar, so a learner reaches them only through a bug or a stale link.
  - **Alternatives:** keep "identifier"; or "This address does not point to a lab." and "This lab is not in your list of labs."
  - **Guarantee:** the first state means the id failed the domain's id check. The second means the id was absent from a successful listing.
  - **Recommendation:** the plain wording.
- **R6b. Unopenable by address (defect found in my spec, not applied).** The lab-screen row reads "This lab cannot be opened. {reason} The application cannot repair or remove it." For `entry_unreadable` that is wrong twice: it states the lab is broken when the host does not know that, and it offers no "Try again" although a retry could succeed.
  - **Alternatives:** (a) leave it; (b) for `entry_unreadable` only, use the heading "This lab could not be read.", the reason, a "Try again" button and "Go to Worlds", and omit the repair sentence.
  - **Recommendation:** (b). The other unopenable kinds keep the present text.

**Not in R1 to R6 but examined.** *Clock kinds:* keep "This computer's clock is set to a date the application cannot use. Correct the date and time, then try again." with **no** "no lab was created", since the host does not say it. Recommendation: keep. *`internal_error` on list:* "Something went wrong inside the application while loading your labs." is safe because listing changes nothing. Recommendation: keep.

## 3. Implementation order and the first gate

Full detail, with dependencies, files, contract changes and validation for every step, is in [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md) section 8.

| Step | Work | Contract change |
|---|---|---|
| **1 (gate)** | Smallest slice (route `/worlds`, `LastLabPointer`, `LaunchResolver`, write-on-ready), then **G1 to G8 in the built Tauri app** | none |
| 2 | `sortLabsNewestFirst`, formatters, `describeError` (final wording needs R1 to R6) | none |
| 3 | Tokens and shell restyle (system fonts) | none |
| 4 | Worlds screen, create form, list, recovery notice | none |
| 5 | Lab frame and states | none |
| 6 | Copy sweep, per-route `document.title` | none |
| 7 | Minimum window size config, then **exact 720 × 480 verification** | `tauri.conf.json` edit, owner-confirmed |
| 8 | Responsive and accessibility pass, then the full suite once | none. **Implementation Complete; verification Partial; no conformance claim** (STEP8_REPORT, C13 and C14) |

**Gate G1 to G8** (all **not yet run**): open an existing lab; the pointer is written only after a successful open; close completely; reopen; the same lab is restored; a missing, stale or invalid pointer opens Worlds; a transient listing failure keeps the pointer; a webview-storage failure does not stop normal use. If a required check fails, the sequence **stops** and reports the evidence. It does not switch from `localStorage`, add a Rust command, change lab records or widen capabilities without a separate decision.

**Limits of the gate, stated in advance.** G6c (an invalid stored value in the real application) may only be provable by editing WebKit's storage file, and if so it is reported as unit-test-only. An abrupt kill is recorded, not pass or fail.

**720 × 480** (step 7, procedure in DESIGN_SPEC 8.1) checks navigation, content accessibility, scrolling, keyboard operation and both themes, in the real window. This text was written before the verification; the minimum has since been approved and locked (LE-021) and the verification is partly done (STEP7_REPORT, STEP8_REPORT). The prototype frames were never a substitute for it.

## 4. Preserved boundaries

Angular and TypeScript frontend; a pure domain core; Tauri 2; narrow Rust commands (`create_workspace`, `list_workspaces`, unchanged); local-first; modular monolith; Linux first; lab records unchanged; no filesystem or shell permission added. Not in scope: the bench or simulator, learning content, persistence redesign, automatic Lab creation, delete or repair, branching, save slots, docking, a full world switcher, native window-title integration. Route `document.title` is in scope and needs no host change.

## 5. Publication plan (nothing below has been run)

Checked read-only at the time of writing, including `git ls-remote` against the one existing remote. `gh` is logged in as `jackmiller2708` with the `repo` scope. New repositories are private. No repository is made public.

| Repository (path) | Branch | Remote and upstream | Not on the remote | Working tree | Proposal |
|---|---|---|---|---|---|
| **B** `~/Projects/engineering-knowledge` | `ccr-b573edbb-crcfsw` | `origin` = `https://github.com/jackmiller2708/engineering-knowledge.git`, upstream `origin/ccr-b573edbb-crcfsw`. Remote head `6e1b12a` equals the local tracking ref | **10 commits** (`aaf1430` back to `93e5a01`) | `M LE-DECISIONS.md` (+170), `?? LE-DESIGN.md`, `?? LE-PRODUCT.md` (all under `project/learning-environment/`). `stash@{0}` exists | **Hold. Do not push.** See below |
| **App** `~/Projects/engineering/repositories/engineering-projects/projects/engineering-learning-environment` | `master` (2 commits, `3dc0223`) | none | 2 commits, no remote to compare | Untracked: `apps/`, `package.json`, `packages/`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (239 files). `.claude/` is ignored and stays out | Create `jackmiller2708/engineering-learning-environment`, private. See below |
| **Registry** `~/Projects/engineering/repositories/engineering-projects` | `master` (1 commit, `54a741e`) | none | 1 commit | clean. Ignores the nested app repo | Optional: private `jackmiller2708/engineering-projects`. Your call |
| **A** `~/Projects/engineering/repositories/engineering-knowledge` | `master`, **no commits** | none | none | 13 untracked entries | **No proposal.** See below |
| `~/Projects/engineering-2` | not a git repository | n/a | n/a | n/a | Nothing to publish |

The two knowledge repositories are different repositories with different histories. A has no commits, so it shares nothing with B. Names are not evidence of ownership or history.

**B: why it is held.** Commit `93e5a01` "Curriculum candidate for independent review (proposed, not approved)" is the *oldest* of the 10 unpushed commits. Any push of this branch, or of a branch built on it, sends it. A branch that omits it would need history rewriting, which is not allowed. So **nothing from B can be published until you approve that commit**, or choose a different route that you specify. The learning-environment documents are uncommitted and are not part of this task. Operations *after* you approve `93e5a01`, shown now so you can check them (not run):
1. `git add project/learning-environment/LE-DECISIONS.md project/learning-environment/LE-DESIGN.md project/learning-environment/LE-PRODUCT.md`
2. `git commit` with a message you approve, ending with the attribution line.
3. `git push origin ccr-b573edbb-crcfsw` (the branch already tracks that destination. `push.default` is unset, so the explicit form is used).

**App: proposed operations, after you approve the plan** (not run):
1. Name check: `gh repo view jackmiller2708/engineering-learning-environment` returned "could not resolve", so the name appears free.
2. Commits, with explicit paths and never `git add .`:
   - `git add package.json pnpm-workspace.yaml pnpm-lock.yaml packages` then commit "build: add pnpm workspace and domain package".
   - `git add apps/desktop` then commit "feat: add desktop application" (this includes `design-audit-2026-11-17/` and `design-stage-4/`; you may prefer a separate docs commit for those).
   - `git status` must then show only ignored paths.
3. `gh repo create jackmiller2708/engineering-learning-environment --private --source=. --remote=origin` (no `--push`).
4. `git push -u origin master`.

**Registry (optional):** `gh repo create jackmiller2708/engineering-projects --private --source=. --remote=origin`, then `git push -u origin master`. Needed only if you want the registry on GitHub. The app repository does not depend on it.

**A:** it has no commits and no remote, and the name `engineering-knowledge` is already B's. It needs your decision on what it is for, a first commit, and a **different** repository name. I propose no name.

## 6. What changed in this round, and why

| File | Why |
|---|---|
| `REVIEW_HANDOFF.md` (new) | The requested handoff. Holds R1 to R6 in full, the publication plan, and the next action |
| `DESIGN_SPEC.md` | Status line (revision 3). Section 1 (O-01 row) and 5 item 1: Worlds shows the World without opening or creating a Lab, plus C-1. Section 3: system fonts decided. Section 8.1: explicit keyboard-operation criterion. Section 10: R status line and the R6b defect flag on the lab-screen "Unopenable" row. Step reference 8 changed to 7 |
| `IMPLEMENTATION_BRIEF.md` | Status line. Section 8 rewritten in dependency order with the persistence gate first (G1 to G8), per-step files, contract changes and validation. Sections 1, 7, 9, 10, 11 updated for the new numbering and the two decisions |
| `DESIGN_DIRECTION.md` | Two lines: the font decision, and the removed open question |
| `REVISION_REPORT.md` | One banner added at the top: it records revision 2 as written, and its step numbers (for example "brief step 8") use revision 2's numbering, which this round changed. The body is untouched |

Not regenerated: `artifacts/screenshots/`, `artifacts/exploration/`, `artifacts/prototype/`. No documented defect required it. **The prototype still reads "restart the application" in the list-failure text and the unconfirmed-create text**, because those are open items R4 and R5, and it still contains the R1 wording "just now".

## 7. Next authorized action

None is authorized yet. To proceed, please answer:
1. **R1 to R6** (recommended: B and D, keep, keep, remove "restart", (a), plain words and (b)).
2. **C-1** (recommended: no separate "Open world" step).
3. **Publication:** whether to approve commit `93e5a01` for publication, and whether to go ahead with the App repository plan, the optional registry repository, and A's naming.
4. **Approval to begin implementation at step 1 (the gate), and only step 1.** Step 2 onward waits for the gate result and for R1 to R6.
