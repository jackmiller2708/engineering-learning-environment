# Step 2 report: Step 1 closure, N-1, and the pure functions

Date: 2026-11-17 and 2026-11-18. Status: **Part A closed with no Step 1 defect, N-1 resolved, Step 2 implemented. Stopped. Nothing was committed or pushed.** Plan: [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md) section 8. Earlier: [STEP1_REPORT.md](STEP1_REPORT.md).

> **Correction (Step 3):** where this report says unopenable entries are left out of the ordering, that was wrong and has been fixed. Section 3 states the actual behaviour. The 169-test figure below is the Step 2 figure and predates the correction.

## 1. Step 1 closure checks (built Tauri debug app)

Same method as the gate: the built debug binary, throwaway data and config directories, a nested X server, real input events, screenshots, and the stored pointer read from a copy of the webview's SQLite file. Labs Alpha, Beta, Gamma existed. No serious defect was found, and **no Step 1 code was changed**.

| # | Check | Result | Evidence ([step-1-closure-evidence/](step-1-closure-evidence/)) |
|---|---|---|---|
| 1 | Back from a restored lab | **Correct.** Sequence: launch (restored Beta), activate "Workspaces" (Worlds), then Back, Back again, Forward. Back returned to Beta. The second Back changed nothing. Forward went to **Worlds, not the lab**. If the launch address had stayed in history, the second Back would have returned to it and re-run the restore, and Forward would then have landed on the lab. **Control:** keyboard Alt+Left did nothing in this webview, so I used the mouse Back and Forward buttons (X buttons 8 and 9), which did work (Worlds went back to Beta, so the control is valid) | `a4_mouse8.png`, `a5_back2.png`, `a5_forward.png` |
| 2 | Keyboard focus after restoration | **Partly verifiable.** After restore, Shift+Tab put a clear focus ring on "Workspaces". The page has **one** focusable element, so this cannot show that focus started on the heading rather than on the document. That is covered by a new unit test (the restored lab's heading is the active element), which fails if the focus effect is removed | `a2_shifttab.png`; unit test |
| 3 | Worlds heading and navigation | Enter on the focused link opened Worlds, with no bounce back to the lab, and the pointer stayed Beta. **Worlds does not move focus to its heading**, and the next Tab reached the name field. **This is a pre-existing gap, not a Step 1 regression:** the home screen never had a focusable heading. DESIGN_SPEC 7 said route changes focus the heading "as today", which was wrong for this screen, and is now corrected and made a required step 4 item | `a3_worlds_after_enter.png`, `a3b_worlds_tab1.png` |
| 4 | Light theme | Restored lab, Worlds, focus rings on the link and the field, and the launch list-failure panel are all legible and usable in light. Focus rings are visible on both light and dark | `l1…l4_*_light.png` |
| 5 | Restored lab back to Worlds | Covered by 1 and 3: the link goes to `/worlds`, which does not re-run the restore | as above |

Two new regression tests (four cases) came out of this, in `launch-resolver.spec.ts`: heading focus after restore, and that the launch navigation uses `replaceUrl` in each of three launch outcomes. **My first history test was useless:** it passed with `replaceUrl` removed, because the mock location does not reproduce the real behaviour. I replaced it with the `replaceUrl` assertion, confirmed that it then fails without it, and left the real-window sequence in row 1 as the evidence for the whole behaviour.

Not covered: that the brief "Opening your last lab…" status looks acceptable. It flashes too fast to capture, and it renders unstyled because that component carries no CSS (cosmetic, and replaced by the shell work in step 3).

## 2. N-1

The owner's wording is used exactly: **"Your labs couldn't be checked."** It is the lead line of the Worlds list-failure panel at launch, followed by the list sentence ("The application could not read your labs. Try again.") and a **Try again** button that re-reads the list. It does not say the failure is temporary, name a cause or suggest restarting. The pointer is **not** cleared by the failure (unchanged Step 1 behaviour, re-confirmed in light by `l4_launchfail_light.png`, where the pointer file still held the lab). Host kinds and messages are unchanged. The translation is in `describe-error.ts`.

Decisions I made that you may want to change:
- **One message, not two.** I replaced the earlier design (a notice stacked on a panel) with a single panel, so the learner sees one message and one Try again.
- **Retry re-reads the list only.** On success the list replaces the panel and the learner stays on Worlds. It does **not** reopen the remembered lab, and it neither clears nor rewrites the pointer.
- **The button label is "Try again"**, the label R4 kept, not "Retry". The owner's text said "a Retry action" and I read that as the behaviour, not a new label.

Updated: DESIGN_SPEC 7.2 table, 7.8 and section 10 (launch table and status), the prototype copy and the 14 screenshots that showed the old words. The brief's step 4 row now tests this. "just now" no longer appears in any specification or prototype string (the only remaining mentions are historical records of the change).

## 3. Step 2 implementation

Pure functions only. **Nothing is wired into a screen** (that is step 4), so there is no visible change.

- **`workspaces/describe-error.ts`**
  - `describeError(kind, ctx)` for create (takes the name limit), list and unopenable-entry contexts, with R1 to R6b applied. An unrecognised kind gets the safest sentence for its context.
  - `describeLaunchOutcome(...)` for the Worlds notices (absent, invalid with the short id, list failed).
  - `describeLabState(...)` for the lab screen: bad address, not found, unopenable, failed read. An `entry_unreadable` entry is routed to "This lab could not be read", with Try again and no repair sentence, so a caller cannot show it the wrong text (R6b).
  - `KNOWN_KINDS`, so a test can compare coverage.
  - The host's `message` is never an input.
- **`workspaces/lab-order.ts`**: `sortLabsNewestFirst`: **corrected in Step 3 (see [STEP3_REPORT.md](STEP3_REPORT.md)).** As first delivered in Step 2 it *excluded* unopenable entries, which conflicted with LE-020 (unopenable entries remain visible). It now returns every entry, input not changed: valid labs first, newest created first, equal times by id ascending; then unopenable entries (they have no creation time), by id ascending. Whether an entry is interactive is the screen's concern.
- **`workspaces/workspace-format.ts`**: `formatCreatedLocal(createdAt, timeZone?)` (`2026-11-17 14:05`, following daylight saving for the lab's date, `''` for non-canonical input) and `localOffsetLabel(at, timeZone?)` (`GMT+7`). The UTC formatter is the existing `formatCreated`.
- **`workspaces/launch-resolver.ts`**: one word changed, `DEFINITIVE_KINDS` is now exported so a test can assert that the notices and the pointer rule agree. Behaviour unchanged.
- **Domain limit:** `describeError` takes the limit as an argument. The screens will pass `WORKSPACE_NAME_MAX_LENGTH`. No limit or rule is duplicated in the frontend.

**Deviations from the plan:**
1. **The host-kind comparison is a hand-kept list.** The brief wanted a test that compares `describeError` with the kinds in the Rust file, so a new host kind fails it. Specs are bundled for the browser and cannot read a file (`node:fs` failed to bundle), and reading it would need an `angular.json` loader or a Rust-side test, which are configuration or host changes I was not authorized to make. Instead, the spec holds the list and its comment says where it comes from. **I verified it against the Rust source in this session** with a script (12 create and list kinds and 10 entry kinds, `manifest_not_utf8` included, equal in both directions). **A kind added to the host later is not detected automatically.**
2. **Lab-screen headings have no trailing period** ("Not a lab address") while launch notice titles do, because the first are `h1`s and the second are sentences. The spec shows both with periods and is only loosely precise here.

## 4. Tests

| Run | Result |
|---|---|
| Whole application suite, `ng test --watch=false` (9 files, runs in about 3 seconds) | **169 passed, 0 failed** (91 at the end of step 1: +4 cases from the two closure tests, +74 for Step 2). Run again after all mutation changes were reverted |
| New: `describe-error.spec.ts` (every kind and context, exact text, R1 to R6b, N-1, banned terms across every produced string, "no lab was created" only where permitted, coverage, agreement with the resolver), `lab-order.spec.ts` (ordering, ties, input untouched, and the timestamp-ordering assumption over 2,002 random instants including both range ends), additions to `workspace-format.spec.ts` | pass |
| Mutation checks on the new code, one change at a time, each reverted and confirmed identical: clock text claims "no lab was created"; `internal_error` claims it; `entry_unreadable` says "just now"; sort reversed; list-failed adds "just now"; `manifest_not_utf8` removed; list text suggests restart; id tie-break removed | **Each failed 1 to 5 tests.** Same method as step 1: the tests were written first, but not each run red against a stub |
| `ng build` | succeeded |
| Not run | Rust tests and `@ele/domain` tests (neither touched) |

A test whose expectation was my own assumption failed once: `localOffsetLabel('UTC')` returns `GMT+0` in this runtime, not `GMT`. I allowed both in the test, because engines differ and neither is wrong.

## 5. Evidence

- Closure screenshots and the key and mouse helpers: `step-1-closure-evidence/`.
- 14 prototype screenshots regenerated (`lab-badaddress`, `lab-failed`, `lab-notfound`, `worlds-error`, `worlds-recovery-transient` and its 720 × 480 and scrolled variants, each in light and dark). I rendered all 62, **verified my render setup reproduces unchanged frames byte-for-byte**, and replaced only the frames whose pixels changed. I looked at `worlds-recovery-transient-light.png`. The others were checked for size only.

## 6. Known limitations and unverified behaviour

- No UI uses any Step 2 function yet, so none of the wording is visible in the application. Visual and interaction evidence for it will come with step 4.
- A new host error kind is not detected automatically (deviation 1).
- `localOffsetLabel` and `formatCreatedLocal` were tested in the test runtime's ICU. The real webview (WebKitGTK) was not tested for `timeZoneName: 'shortOffset'`. If it is unsupported the header would be blank.
- Heading focus on restore cannot be separated from document focus on a one-link page in the real window (only the unit test shows it).
- Back and Forward were verified with mouse buttons only. Keyboard history shortcuts do not work in this webview, so nothing was concluded about them.
- Only the dark theme was used for the gate and most of the closure runs. Light was checked for restore, focus rings, Worlds and the launch failure.
- Startup took about 26 seconds in this nested environment on every run. Not investigated.
- The prototype and spec headings now differ slightly from the code in punctuation (deviation 2).

## 7. Repositories

Nothing was committed or pushed, and nothing was staged.

| Repository | State |
|---|---|
| App | 2 local commits (`3dc0223`), all work untracked, `origin` = `https://github.com/jackmiller2708/engineering-learning-environment.git`, no upstream, **not pushed** |
| Registry | 1 commit, clean, `origin` configured, not pushed |
| A | no commits, `origin` configured, not pushed |
| B | **unchanged**: 10 unpushed commits (tip `aaf1430`, remote head `6e1b12a`), the same three uncommitted LE files, `stash@{0}` kept, the backup directory untouched |

## 8. Changed files

**Source and tests** (`apps/desktop/src/app/workspaces/`): `describe-error.ts` and `.spec.ts` (new), `lab-order.ts` and `.spec.ts` (new), `workspace-format.ts` and `.spec.ts` (additions), `launch-resolver.ts` (one `export`), `launch-resolver.spec.ts` (two closure tests). `workspace-environment.ts` was touched during mutation checks and restored, and its content is identical to Step 1.

**Documents** (`design-stage-4/`): `DESIGN_SPEC.md` (N-1, the heading-focus correction), `IMPLEMENTATION_BRIEF.md` (step 2 status, step 4 tests), `STEP1_REPORT.md` (N-1 resolved), `STEP2_REPORT.md` (new), `artifacts/prototype/proto.js` (the launch panel), 14 files under `artifacts/screenshots/`, and `step-1-closure-evidence/` (new: 11 screenshots and `xk.py`).

**Not changed:** `src-tauri/` (Rust, `tauri.conf.json`, capabilities), `packages/domain`, `package.json` files, `pnpm-lock.yaml`, `angular.json`, styles, templates, the other 48 screenshots, the exploration frames, and Repositories A and B.
