# Step 6 report: copy sweep and per-route `document.title`

Date: 2026-11-18. Status: **implemented, with the limits in section 6. Stopped. Nothing was committed, pushed, tagged or staged.** Plan: [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md) section 8, row 6. Decisions: owner decisions of Task 3.21, DESIGN_SPEC 7.10 (updated to match), LE-DECISIONS (read, not modified).

## 1. Titles implemented
| Route or state | `document.title` |
|---|---|
| `/` | `Engineering Learning Environment` |
| `/worlds` | `Worlds — Engineering Learning Environment` |
| Ready lab | `<lab name> — Computer Foundations — Engineering Learning Environment` |
| Not found / Bad address / Unopenable / Unreadable / Failed read | `Lab not found` / `Not a lab address` / `This lab cannot be opened` / `This lab could not be read` / `This lab could not be loaded`, each ` — Engineering Learning Environment` |

Mechanism: Angular's route `title` for `/`, `/worlds` and (generic) `/workspace/:id`, through the default title strategy. `LabFrame` then sets the lab-specific title with Angular's `Title` service, because the lab name is known only after resolution. Problem titles are `describeLabState(state).heading`, so the title and the screen's `h1` are the same words from one source. `page-title.ts` holds `pageTitle(...parts)`.
- **Arrival** (a new address, including one lab to another with the component reused): the generic title is set immediately, so a previous lab's name never shows while another resolves. The route's own generic title covers the gap before the component runs.
- **Try again:** no title is written while loading, so the current error title stays. A success writes the lab title, a failure the resulting error title.
- **Stale answers:** a title is written only after the `resolveSeq` check, so an answer for a lab that was left cannot set the title.
- **Leaving a lab** needs no code: the next route's title replaces it.
- **Native window title:** not touched (no Tauri, Rust or capability change).

## 2. Copy: found and corrected
- **Skip link:** "Skip to content" became "Skip to main content" (owner decision, matches DESIGN_SPEC 7.4). `app.html`, the test in `app.spec.ts`.
- **No other violation was found.** The sweep rendered every state and found none of the banned terms in text, `document.title`, or the `title`, `aria-label`, `placeholder` and `alt` attributes. The `/workspace/:id` address, `routerLink` targets, identifiers and folder names are not learner-visible and were not changed.

## 3. Banned list (as the owner defined it; now canonical in DESIGN_SPEC section 2)
`workspace` (any case), `manifest`, `workspace.json`, internal data-folder paths (`/home/`, `/.local/share`, Windows paths, `~/`, the application identifier), and the raw host message. Ordinary words such as "file" and "path" are not banned (a test asserts this).

## 4. Tests (`page-title.spec.ts` new, 34 cases; `app.spec.ts` one assertion)
- Titles: `/` (launch pending), `/worlds`, ready lab, restore from launch, all five lab states (title equals the `h1`), generic while loading and never the previous lab's name, no title from a lab that was left before it resolved, Lab to Worlds and back, retry: error to ready (title retained while loading), error to a different error, error to the same error.
- Copy sweep: Worlds loading, empty, populated with every unopenable kind (and one unknown), list failures; the recovery notices after launch (absent, invalid, unreadable, failed listing); creation feedback (success and every failure kind plus an unknown one); every lab state, including all entry kinds. Host messages in the fixtures are filled with a path and `workspace.json`, so a leak would be caught.
- **Not vacuous:** the scanner is tested against representative violations (eight samples, each must be named), an ordinary sentence must pass, a check shows it reads the real page (title, text, attributes), and it finds a violation injected into a rendered page. Each state asserts that something real was rendered.
- Mutations (each reverted): no generic title on arrival (1 failed), a retry that resets the title (1), no problem title (8), no stale guard (1), "workspace" in the lab list (3), "manifest" in a sentence (2).

## 5. Results
- Focused spec: 34/34. Whole suite once, because the routes and shell text are shared: **299 passed, 0 failed** (12 files). `ng build` and `tauri build --debug --no-bundle` succeeded.
- **Built application, runtime observations from the implementation session (isolated display, throwaway data, `TZ=America/New_York`, dark theme). The compliance review did not repeat them, and no screenshots or logs of them were archived:** `document.title` was read from the accessibility tree of the running WebKit page (its document node is named by the page title) over AT-SPI, which is a read, not a screen reader session.
  - restored lab: `Half adder — Computer Foundations — Engineering Learning Environment`
  - Worlds: `Worlds — Engineering Learning Environment`
  - second lab: `Adder bench — Computer Foundations — …`
  - lab folder missing: `Lab not found — …`
  - labs directory unreadable: `This lab could not be loaded — …`
  - Try again after restoring: `Half adder — Computer Foundations — …`
- **Native window title unchanged (manual observation only; there is no automated test of it):** the window's `WM_NAME` and `_NET_WM_NAME` stayed `Engineering Learning Environment` across all of the above (X properties, and the AT-SPI frame node).

## 6. Not verified
- Bad address and unopenable, unreadable titles in the built app: not reachable there (unit tests only). The launch title was not observed in the app (it flashes).
- No screen reader was used. Whether a screen reader announces a title change is unknown.
- The light theme, the screenshot comparison, 720 × 480 (Step 7), the responsive and accessibility pass (Step 8), and G1 to G4, G6a, G6c, G8 are as in earlier reports.
- The skip link's target and behaviour were not changed or re-examined.
- DESIGN_SPEC 7.10 listed four error titles. It now lists five, and the loading rule (owner decisions).

## 7. Files (`apps/desktop/`)
`src/app/page-title.ts` (new), `app.routes.ts`, `workspaces/lab-frame.ts`, `app.html`, `app.spec.ts`, `page-title.spec.ts` (new); docs: `DESIGN_SPEC.md` 7.10, `IMPLEMENTATION_BRIEF.md`, this report. Not touched: Rust, Tauri configuration and capabilities, `@ele/domain`, dependencies, other repositories.

## D1 correction: a lab left before it is ready can no longer apply its late result

**Defect (found in the Step 6 compliance review).** `LabFrame`'s `resolveSeq` guard only stops an older `resolve()` call from overtaking a newer one on the same component. A component that was destroyed (the learner went to Worlds while the listing was pending) kept its sequence number, so its late result passed the guard. It could overwrite the destination screen's `document.title` and write the last-active pointer for a lab the learner never reached.

**Path checked before the change.** In `resolve()` every effect of the pending result comes after the single guard `if (seq !== this.resolveSeq) return;` that follows the `await`: the `problem()` calls (the view and the title), the ready view, the ready title, and `pointer.write`. `ActiveLab` and the status text are driven by effects on the view, so they change only if the view changes. Everything before the `await` runs synchronously at arrival. One guard therefore covers all of them.

**Correction.** One line in the destroy hook: `this.resolveSeq++;`, with a comment. No new service or abstraction.

**Now invalidated for a destroyed screen:** the title (error and ready), the pointer write, the view change (so the `ActiveLab` and breadcrumb effects and the status text), and the focus mode. Behaviour for a lab that reaches ready is unchanged.

**Regression test** (`app.spec.ts`, "a lab that is left before it is ready (D1)", with the shell mounted): the pointer starts as another lab; a lab is opened with its listing pending and is seen loading ("Opening lab…", `aria-busy`); the learner goes to Worlds; the old listing then completes. Asserted unchanged: the Worlds title, the pointer (still the other lab, not the abandoned one and not cleared), the bar text (no abandoned lab in the breadcrumb), the status text, the whole page text, the URL, and no lab screen in the page.

**Validation.** Mutation: removing the increment makes this test fail (`expected 'Abandoned lab — Computer Foundations …' to be 'Worlds — Engineering Learning Environment'`), 1 failed of 128. Restored, focused run of `app.spec.ts`, `page-title.spec.ts`, `lab-frame.spec.ts` and `launch-resolver.spec.ts`: 128 passed, 0 failed. Limit: with the mutation the title assertion fails first, so the pointer, bar and page assertions were not shown to fail independently. The full suite and the builds were not rerun, as the change is one line inside one component's destroy hook and the neighbouring specs cover its lifecycle.

## Task 3.22: test hardening (T1 to T3) and documentation reconciliation

**T1, the shell was not scanned.** The scanner moved to `copy-scan.testing.ts` (shared, one implementation: the banned list, `violations`, and `rendered`, which reads text, `document.title` and the `title`, `aria-label`, `placeholder` and `alt` attributes). New tests in `page-title.spec.ts` mount the real `App` shell and scan the whole application element: the skip link, brand, breadcrumb (world and active lab with its short id), the "You are here" label, the routed screen, and the shell status messages "Opening lab…" and "Opening your last lab…". They also run the failed, unopenable and unreadable states through the shell with raw host messages. Prohibited terms injected into the skip link, brand, a breadcrumb label, the world breadcrumb item and the status message are each detected by the whole-shell scan and are **not** detected by a scan of the routed screen alone. No production string was added or changed.

**T2, host-message detection overlapped the path rule.** The fixture host message is now `HOST_SENTINEL`, which has no path and no banned word, so only the raw-host-message rule can catch it. A separate `HOST_PATH_MESSAGE` is caught by the path rule alone. Tests: the sentinel yields exactly the host-message violation, the path message exactly the path violation, and with either rule removed its own sample goes unnoticed by every other rule. **Limit:** the host-message rule recognises only the messages the tests supply (`KNOWN_HOST_MESSAGES`). It shows that those are not displayed, not that no other host message could be.

**T3, the constant-only native-title test was removed.** It asserted that a constant equals a string. Nothing replaced it: no automated test of the native window title is supported by the existing architecture (specs are bundled for the browser and cannot read `tauri.conf.json`), and no framework was added. A comment in the spec says so. The native window title is **manual evidence only** (section 5). `document.title` is covered by the application tests.

**Mutation evidence (each reverted; files restored byte-identical, then 48/48 again):**

| Mutation | Result |
|---|---|
| shell tests scan only the routed screen | 9 failed |
| raw-host-message rule removed | 5 failed |
| internal-path rule removed | 6 failed |
| (production) "workspace" in the skip link | 11 failed |

**Run:** `pnpm exec ng test --watch=false --include src/app/page-title.spec.ts`: 48 passed, 0 failed (34 before this task). **Not run:** the full suite (only tests and a test helper changed, no production code), `ng build`, the Tauri build, any runtime check.

**Compliance-review facts folded in.** The skip link's target is unchanged: `app.ts` `skip()` focuses the first `main` (read, not run). The D1 note above stands: 128/128 focused tests, no full suite, build or runtime check for that correction. The 299-test figure in section 5 is the end-of-step-6 full run and has not been repeated.

**Documentation reconciled in this task:** DESIGN_SPEC (status, section 2 banned list and the "Return"/"Go" note, 7.4 note, section 10 scope), DESIGN_DIRECTION and IMPLEMENTATION_BRIEF (stale "nothing is implemented" statements, the Step 4 and Step 6 status blocks, the G1 to G8 note, stale screenshots), REVISION_REPORT and REVIEW_HANDOFF (status lines marked as superseded), STEP4_REPORT (update note on the description line), and this report. LE-DECISIONS was not modified.
