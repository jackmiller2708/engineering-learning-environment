# Step 5 report: the Lab frame

Date: 2026-11-18. Status: **implemented, with the limits in section 6. Stopped. Nothing was committed, pushed, tagged or staged.** Plan: [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md) section 8, row 5. Earlier: [STEP4_REPORT.md](STEP4_REPORT.md). Decisions: `~/Projects/engineering-knowledge/project/learning-environment/LE-DECISIONS.md` (read, not modified).

## 1. Scope
`LabFrame` replaces the environment screen at `/workspace/:id` (address unchanged), with the lab bar, the bench placeholder, the facts strip and every lab state. Depends on steps 2 to 4. Excluded: per-route `document.title` and the copy sweep (step 6), the minimum window size and 720 × 480 (step 7), the responsive and accessibility pass (step 8), the bench, regions, probes, simulation, a second World, and any repair or removal of labs.

The three ambiguities found when the scope was recovered were decided by the owner and applied: **(1)** the old "Workspaces" back link is removed and Worlds is reached through the shell's breadcrumb; **(2)** focus goes to the `h1` of whichever state a navigation resolves to; **(3)** the loading text lives in a status region that is already in the page. Timestamps reuse the existing formatters.

## 2. Changes (`apps/desktop/src/`)
- `app/workspaces/lab-frame.{ts,html,css}` (renamed from `workspace-environment.*`, class `LabFrame`, selector `app-lab-frame`):
  - **Ready:** lab bar (the name as `h1`, clamped, full name in `title`, `dir="auto"`; "Created 2026-07-15 08:00 (GMT-4)"), the dotted bench with "The bench is not available yet." and "This lab is saved on this computer. Nothing has been added to it.", and a facts strip at the bottom right as a description list: World, Lab, Created (local with offset, UTC beneath in monospace) and the full ID in monospace. No regions.
  - **Problem states** from `describeLabState`: bad address, not found, unopenable (reason by kind plus "The application cannot repair or remove it."), unreadable (`entry_unreadable`: Try again, no repair sentence), failed read (alert, Try again). Each has "Go to Worlds". The host's `message` is never shown.
  - **Loading:** the screen no longer owns a status region. It writes "Opening lab…" into the **shell's** one region (section 8) while loading, and clears it when loading ends or the screen is destroyed. `aria-busy` on `<main>` as before.
  - **Kept:** `parseWorkspaceId` validation (a bad address never asks the host), resolution by listing, `resolveSeq`, retry, the pointer written only on `ready`, the `ActiveLab` hook (transient, not the pointer).
- `app/status-message.ts` (new), `app/app.html`, `app/app.css`, `app/app.ts`: the shell's status region (section 8).
- `app/world.ts` (new): `WORLD_NAME`, moved out of `app.ts` so the facts strip and the shell share one constant. No behaviour change.
- `app/app.routes.ts`: points at `LabFrame`. `app/app.ts`: imports `WORLD_NAME`.
- `styles.css`: one token, `--grid`, from the prototype (the dotted substrate).
- Tests: `workspaces/lab-frame.spec.ts` (37 cases; replaces `workspace-environment.spec.ts`), one case in `app/app.spec.ts` (the shell stays visible while a lab loads).
- Documents: `DESIGN_SPEC.md` 5.2 (no description line), `artifacts/prototype/proto.js` and `proto.css` (description removed), `IMPLEMENTATION_BRIEF.md` (status), this report.
- **Not touched:** Rust, `tauri.conf.json`, capabilities, `@ele/domain`, dependencies, other repositories.

## 3. Behaviour decisions inside the owner's rules
1. **Focus after Try again.** The owner said not to "repeatedly steal focus during loading updates or retries". Focus is not moved while loading. On arrival it always moves to the heading. After Try again it moves to the heading **only if the retry left focus nowhere** (the button that had it was removed by the loading state); if the learner moved focus elsewhere while waiting, it stays there. Interpretation: this keeps a keyboard user from being dropped on the page, without taking focus from where they put it. Tested both ways.
2. **Created offset.** `localOffsetLabel(new Date(createdAt))`, so the offset is the one in force on the lab's date, and the lab bar and the facts strip show the same text. Not today's offset (a mutation that uses today's fails a test).
3. **A time the webview cannot format** falls back to the stored UTC text, then to the raw value, as the Worlds list does.
4. **Placeholder copy** is two lines (the sentence in bold, then the rest), as in the prototype. The words are exactly as specified.
5. **The facts strip is `position:absolute` over the bench**, as in the prototype, so on a very small window it can overlap the placeholder text. Not examined; belongs to steps 7 and 8.

## 4. Tests
| Run | Result |
|---|---|
| `lab-frame.spec.ts` against the old screen | 26 failed, 11 passed (behavioural red) |
| After implementation | 36 passed, 1 failed: my assertion expected a space between two block lines that `textContent` does not contain. The assertion was corrected (the words are checked per element, plus that the sentence is `display:block`), not the code |
| Mutation checks (each reverted; restored files pass) | never focus the heading (9 failed), loading region created with its text (3), retry always takes focus (1), offset from today (1), stale-resolve guard removed (1), pointer written for any found entry (2), no "Go to Worlds" (5), old back link returns (2), bench sentence not a block (1) |
| `app.spec.ts` | 9 passed |
| Whole suite (once: a rename, routing and a shared token) | **249 passed, 0 failed** (11 files) |
| `ng build`, `tauri build --debug --no-bundle` | succeeded |
| Timezone test | `vi.stubEnv('TZ', 'America/New_York')`: a January lab shows GMT-5 and a July lab GMT-4, in both places, while "now" is November. A guard in the test asserts the runtime really followed the zone |

## 5. Runtime checks (built debug app, isolated X display, throwaway XDG directories, dark theme, `TZ=America/New_York`)
- **Ready:** restored on launch and opened from a row. Lab bar, dotted bench, the placeholder, and the strip with all four facts; the full ID is shown in monospace, the heading carries the focus ring on restore.
- **Offsets in the real app (WebKitGTK):** a lab created `2026-07-15T12:00:00Z` shows `2026-07-15 08:00 (GMT-4)` in the bar and the strip, with `2026-07-15 12:00 UTC` beneath, while a lab created `2026-11-18T02:40:06Z` shows `2026-11-17 21:40 (GMT-5)`. The Worlds list header showed `Created (GMT-5)` (the machine's offset today) with each row's own time. So the date-specific offset works in the real runtime, and the header and a July row differ by an hour, as section 7.3 item 7 of STEP4_REPORT predicted.
- **Not found:** a lab folder moved aside, then its row opened: "Lab not found", the text, "Go to Worlds", the breadcrumb ending at the World. Pressing Tab then landed on "Go to Worlds", the first control after the heading, so the sequential-focus start was the heading (a focus ring is not shown after a mouse click, which is expected).
- **Failed read:** the labs directory made unreadable, then a row opened: "This lab could not be loaded", the list sentence and "Until it can…", Try again, Go to Worlds. Tab went to Try again. After the directory was restored, Try again brought the lab to ready with the heading focused.
- **Pointer:** the retry's success wrote the pointer: after closing and starting again, the lab that had failed was restored. It had not been the previous pointer.
- **Navigation:** the breadcrumb "Worlds" and "Go to Worlds" both led to Worlds. The ready state has no second link.
- **Spacing:** the first render of the failed state had "Go to Worlds" touching the panel; fixed (16 px, as in the prototype) and re-rendered.
- A frame captured with the window moved up showed an unpainted strip, so it was discarded and the window was resized instead.

## 6. Not verified, and limits
- **Light theme: not verified.** **Comparison with `artifacts/screenshots/`: not done**, and those Worlds frames still show the removed description (DESIGN_SPEC 5.2 now says so).
- **720 × 480: not verified** (step 7). The display was 1280 × 692 and the window was 1100 × 680 after a resize; no narrow layout was seen.
- **Assistive technology: not verified.** Whether "Opening lab…" is announced is unknown. Section 8 makes the region exist before the text changes, which is the requirement; it does not show that a screen reader announces it.
- **Not reachable in the real app and so seen only in unit tests:** a bad address (no way to type one), an unopenable lab and an unreadable lab (Worlds does not link them, and the restore falls back to Worlds). The loading text flashes too fast to see.
- **Not rerun:** G1 to G4, G6a, G6c, G8. G5 (restore) and the G7-like failure were exercised as above.
- The facts strip's behaviour on small windows is unexamined (3.5 above).
- The Worlds and lab frames in `artifacts/screenshots/` were not regenerated.
- This report does not claim DESIGN_SPEC has passed.

## 7. Deviations from the specification
None known that change a specified behaviour. Choices where it is silent are in section 3. Two things are worth the owner's eye: the focus-after-retry rule (3.1), and that the lab bar clamps the name to one line (the prototype's `.labbar h1`), while the facts strip shows the full name wrapped.

## 8. Correction: the initial loading status region (Task 3.18)

**Defect.** On arrival at a lab the screen was created together with its own `role="status"` element and its text, so the region did not exist before its text changed (DESIGN_SPEC 9, A-04). The retry case was already correct. Section 6 of this report had said so.

**Fix.** The shell (`App`), which exists before any route, now renders the one region, as its own grid row under the bar: `<div class="status" role="status">{{ status() }}</div>`. `StatusMessage` (`status-message.ts`, root service, one signal) carries its text. `LabFrame` writes `Opening lab…` while its view is loading and `''` otherwise (an effect over the view), and clears it when destroyed, so leaving while still loading cannot leave the message behind. The region is empty most of the time and has no height then (`:not(:empty)` padding, `auto` grid row; not `display:none`, which would remove it from the accessibility tree). `LabFrame` has no region of its own, so there is one announcement. Focus is untouched: the text change moves no focus.

**Unchanged:** focus behaviour, retry behaviour, `resolveSeq`, pointer writes, `ActiveLab`, the `LabFrame` layout, and the shell's visibility. In the built app the lab and Worlds frames sit at the same coordinates as before the change.

**Tests** (`app.spec.ts`, shell lifecycle; `lab-frame.spec.ts`, what the screen writes):
- the region exists, empty, before any lab loads, and is outside the routed screen;
- the first lab navigation writes the text into the same element (`toBe`, still connected), and finishing clears it without removing it;
- a `MutationObserver` on the region sees the text appear and then empty, so it is a change of an existing node rather than an insertion;
- a retry reuses the same element, and there is exactly one `role=status` on the lab screen at every step;
- the message is not duplicated and is not left behind when the learner leaves while loading;
- moving no focus; no region inside `app-lab-frame`, and `aria-busy` still set;
- `lab-frame.spec.ts`: the text is written while loading, cleared on ready, written again on a retry, cleared for each way a resolution ends, not written for a bad address, and cleared on leaving.

**Results.** The new shell tests were red before the change (5 failed, 2 invariants passed); both specs green after (54). Mutations, each reverted: region created only while there is text (4 failed), no clearing on destroy (2), no clearing when loading ends (6), a duplicate region inside the lab screen (4), focus taken on a status change (1). The whole suite was then run once, because the shell template is shared by every screen: **257 passed, 0 failed**. `ng build` and the debug app build succeeded, and the built app was started and its lab and Worlds frames captured to check the layout (dark theme only).

**Limits.**
- No assistive technology was used. This shows that the region exists first and that the text changes inside it. It does **not** show that any screen reader announces it, or when.
- The loading text flashes too fast to see in the real app, so the visible message was not observed there; the lifecycle is verified in the unit tests only.
- **Launch resolver: corrected afterwards** (see STEP1_REPORT, correction note). It now writes "Opening your last lab…" into the same shell region and owns none, so the earlier limit that its text was created together with its region no longer applies. The Worlds screen still has its own persistent regions inside the page (loading, create success, notice).
- Light theme, the comparison with `artifacts/screenshots/`, 720 × 480 (step 7) and gates G1 to G4, G6a, G6c and G8 remain as in section 6.
