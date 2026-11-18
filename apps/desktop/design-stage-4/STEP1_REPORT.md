# Step 1 report: `/worlds` route, last-lab pointer, launch restore, persistence gate

Date: 2026-11-17. Status: **step 1 implemented and the gate run. Stopped here. Nothing was committed or pushed.** Plan: [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md) section 8. Evidence: [step-1-evidence/](step-1-evidence/).

## 1. Gate result

**G1 to G8 were all performed against the built Tauri debug application and all passed as specified.** Every behaviour listed in the gate was observed. Caveats on how G6c, G8 and the abrupt kill were produced are in section 4.

Environment: `pnpm tauri build --debug --no-bundle` (not `tauri dev`), run on a nested X server with throwaway `XDG_DATA_HOME`, `XDG_CACHE_HOME` and `XDG_CONFIG_HOME`. No real data directory was used. "Close completely" was a real window close request (`WM_DELETE_WINDOW`, `xclose.py`), after which no application or web process remained. The stored pointer was read from a **copy** of the webview's SQLite file (`ptr.py`) so the original was never opened by the reader. Labs: Alpha `2982278d…`, Beta `e929535e…`, Gamma `04fd82b1…`, all created through the UI.

| Check | What was done | Observed | Evidence |
|---|---|---|---|
| G1 open an existing lab | Opened Alpha from the list | Alpha's screen showed | `g1.png` |
| G2 written only after a successful open | Created two labs, closed, restarted **without opening any lab** | No `localstorage` file existed and nothing in the profile held the key. The restart showed the list. After opening Alpha the table held `ele.lastLab.v1 = 2982278d-e0a9-4b0a-b764-6a2733bd0dff`, the full id and nothing else | `g2a.png`; log below |
| G3 close completely | Window close request | App exited, 0 leftover processes. The stored value was unchanged after exit | log |
| G4 reopen | Started the binary again, same directories | Started | n/a |
| G5 same lab restored | Observed the first screen | Alpha's screen at launch, no click. Then opened Beta, closed, reopened: **Beta**, not Alpha. The stored value changed to Beta's id on open | `g5a.png`, `g5b_open.png`, `g5b_restored.png` |
| G6a missing pointer | Closed, moved `localstorage/` aside, started | Worlds list with both labs, no error. No pointer file | `g6a.png` |
| G6b stale pointer | Opened Beta (pointer = Beta). Closed, moved Beta's folder out of the labs directory, started | Worlds with Alpha only, **and the table was empty afterwards (pointer cleared)**. Beta's folder was put back, closed, started: Worlds with both labs, **not Beta** | `g6b1.png`, `g6b2.png` |
| G6c invalid pointer | Opened Alpha, closed, overwrote the stored value with `not-an-id` (UTF-16, as WebKit stores it) in the throwaway profile's SQLite file, started | Worlds opened, and the table was empty afterwards (invalid value cleared) | `g6c.png` |
| G7 transient failure keeps the pointer | Pointer = Alpha. Closed, `chmod 000` on the labs directory, started | Worlds with the list-failure panel and "Try again". **The pointer was still Alpha's id.** Then permissions restored, closed, started: **Alpha restored** | `g7a.png`, `g7b.png` |
| G8 storage failure does not block use | Closed, `chmod 000` on `localstorage/`, started | The app started (a valid pointer existed on disk but could not be read, and Worlds opened, as designed). Listed three labs, **created Gamma**, **opened a lab** (Alpha's screen) | `g8a.png`, `g8b.png`, `g8c.png` |

Recorded, not part of the pass criteria: after opening Beta, `kill -9` one second later left the stored value equal to Beta's id (`k9b.png`). **One trial. It is an observation, not a durability guarantee.** A first attempt at this was invalid (the app had restored Alpha, so my click opened nothing) and was discarded.

## 2. Implementation

All under `apps/desktop/src/app/`. No Rust, `tauri.conf.json`, capability, `@ele/domain`, dependency or lab-record change (the changed-file search below confirms it).

- **`/worlds` route** (`app.routes.ts`): the existing home screen, unchanged in look and behaviour, now lives at `/worlds`. `/` is the launch resolver. The wildcard redirects to `/worlds`. The lab screen's "Workspaces" links go to `/worlds` (they previously went to `/`, which would now restore the lab again and trap the learner).
- **`workspaces/last-lab-pointer.ts`**: `LastLabPointer` with `read`, `write`, `clear`, and the injection token `LAST_LAB_STORAGE` (default: `localStorage`, or null if touching it throws). One versioned key `ele.lastLab.v1` holding the id. Reads and writes are validated with the domain's `parseWorkspaceId`, so there is no id rule in the frontend. A stored invalid value is cleared on read. Every storage call is guarded: a read failure is "no pointer", write and clear failures are ignored.
- **`workspaces/launch-resolver.ts`**: `LaunchResolver` at `/`, shows "Opening your last lab…" while it waits, then `navigate(..., { replaceUrl: true })`. No pointer or invalid: Worlds. Valid: list via the existing gateway. Listing failed: Worlds, pointer kept. Id absent: pointer cleared, Worlds. Entry invalid with a definitive kind (the nine in DESIGN_SPEC 7.2): cleared, Worlds. Invalid with `entry_unreadable` or an unrecognised kind: kept, Worlds. Valid entry: open the lab.
- **`workspaces/workspace-environment.ts`**: writes the pointer only in the `ready` branch, after the stale-resolve check. Nothing is written while loading or for bad address, not found, unopenable or failed.

## 3. Deviations from the approved design

1. **No recovery notice yet.** DESIGN_SPEC 7.2 specifies a notice on Worlds after a stale or failed launch. Its text comes from `describeError`, which is step 2, and the notice is rendered by step 4. Until then a stale pointer lands the learner on Worlds with **no message**. This was named in the brief as outside step 1.
2. **Screens keep today's look and words.** The home screen still says "Workspaces", rows are still in the host's order (by id, not newest first, visible in the evidence), and the list failure still shows the host's own message ("…not allowed to use its data folder"). The translated copy, Worlds wording, shell and tokens are steps 2 to 5.
3. **Existing tests edited, minimally:** `workspace-home.spec.ts` and `workspace-environment.spec.ts` now mount `/worlds` instead of `/`, and expect `a[href="/worlds"]`. `test-app.testing.ts` gives `mount()` an optional storage argument that defaults to an in-memory fake, so no test touches the real `localStorage`.
4. **A correction to my brief:** the pointer is stored in `<data>/<identifier>/localstorage/tauri_localhost_0.localstorage`, not under `storage/`. The brief and G6a now say so.
5. **Launch performs a second list.** The resolver lists to confirm the lab, and the lab screen lists again to resolve it. It is one extra read-only call at launch. I did not merge them, to keep the lab screen unchanged.
6. **The owner's wording decisions were applied to the spec and prototype copy** (`DESIGN_SPEC.md` section 10, `proto.js` strings), because you asked for the wording to be verified. They are not used by step 1. The prototype screenshots were **not** regenerated, so the frames for list-failure, unreadable entries and the two address screens still show the old words.

## 4. Caveats on the evidence

- **Method:** UI driven by synthetic mouse and key events on a nested X server, state read from screenshots and from the stored SQLite value. No assistive technology, no real desktop session.
- **G6c** was produced by editing WebKit's own storage file while the app was closed (test-only), and is also covered by unit tests.
- **G8** was produced by removing all permissions on the storage directory. I did not determine what WebKit did internally (for example an in-memory fallback), only that the application stayed fully usable. Other storage failure modes (a full disk, a corrupt file) were not produced.
- **G7** was produced with `chmod 000` on the labs directory. A real transient failure may differ.
- **One theme:** the runs used the dark theme only. Step 1 changes no styles.
- **Startup in this environment was slow** (about 26 seconds to the real window, the same on every start, including the first launch with no pointer). I did not investigate it, and no performance claim is made.
- **Not verified at runtime:** that Back from a restored lab does not return to `/` (the `replaceUrl` option is set in code, and the unit-test harness cannot observe history), focus placement on the restored lab's heading, keyboard operation (unchanged code paths), and anything on a different desktop or WebKitGTK build.
- **Not checked:** two instances at once; origin differences with `tauri dev` (a different origin, noted in the brief).

## 5. Tests

| Run | Result |
|---|---|
| `ng test --watch=false`, the application's whole suite (7 files, 91 tests: the new pointer and launch specs plus all existing specs) | **91 passed**, 0 failed. It runs in about 3 seconds, so I ran all of it rather than selecting files |
| Mutation checks (my own, one change at a time, then reverted and confirmed identical): no write on ready; write before the lab is confirmed; clear on a transient kind; clear on a listing failure | Each made the relevant tests fail (2, 4, 2 and 1 failures), so those tests do detect the behaviour |
| Production build (`ng build`, as part of the Tauri build) and the Rust compile | Succeeded |
| Not run | The Rust test suite, the `@ele/domain` tests (neither was touched) |

I wrote the new tests before the code but **did not run them red first**. The mutation checks are the substitute, not a replacement for it.

## 6. Repositories (nothing committed, nothing pushed)

| Repository | Remote added | Visibility | State |
|---|---|---|---|
| App `…/engineering-projects/projects/engineering-learning-environment` | `origin` = `https://github.com/jackmiller2708/engineering-learning-environment.git` | private, empty | 2 local commits, step 1 and all other work uncommitted and untracked, no upstream set |
| Registry `…/repositories/engineering-projects` | `origin` = `https://github.com/jackmiller2708/engineering-projects.git` | private, empty | 1 local commit, clean, no upstream set |
| A `…/repositories/engineering-knowledge` | `origin` = `https://github.com/jackmiller2708/engineering-knowledge-content.git` | private, empty | **no commits**, untracked content, no upstream |
| B `~/Projects/engineering-knowledge` | **unchanged**: `origin` = `https://github.com/jackmiller2708/engineering-knowledge.git`, upstream `origin/ccr-b573edbb-crcfsw` | n/a | 10 unpushed commits including the unapproved candidate. **Not published.** The same three uncommitted LE files. `stash@{0}` and the backup directory untouched |

Before creating each repository I checked that the exact name did not exist (`gh repo view`, all three returned "could not resolve"), so nothing existing was overwritten or repurposed. They were created with `gh repo create --private` and `git remote add origin`. No upstream was set and nothing was pushed.

**Remaining publication work (none of it done):**
1. **App:** commit (explicit paths, never `git add .`): `package.json pnpm-workspace.yaml pnpm-lock.yaml packages`, then `apps/desktop` (the step 1 evidence PNGs are under `design-stage-4/step-1-evidence/`, about 17 small files, and `.claude/` is ignored). Then `git push -u origin master`.
2. **Registry:** `git push -u origin master`.
3. **A:** needs a first commit (13 untracked entries), then `git push -u origin master`. It has no history to protect.
4. **B:** still held. Needs your decision on the candidate commit.

## 7. Items for the owner

- **N-1 (resolved in Task 3.12: "Your labs couldn't be checked." with a Try again that re-reads the list).** The launch notice for a failed listing says "could not be checked just now". The host does not say that failure is temporary, which is the same reason "just now" was removed from `entry_unreadable`. Remove it? (Recommended.)
- Approval to begin step 2, which needs no further wording decisions.
- Approval to commit and push the three repositories above.

## 8. Changed files

**Application source and tests** (all new or changed in this step): `src/app/app.routes.ts`, `src/app/test-app.testing.ts`, `src/app/workspaces/last-lab-pointer.ts` (new), `last-lab-pointer.spec.ts` (new), `launch-resolver.ts` (new), `launch-resolver.spec.ts` (new), `fake-storage.testing.ts` (new), `workspace-environment.ts`, `workspace-environment.html`, `workspace-environment.spec.ts`, `workspace-home.spec.ts`.

**Documents:** `design-stage-4/DESIGN_SPEC.md` (error wording per R1 to R6b, status), `design-stage-4/IMPLEMENTATION_BRIEF.md` (step 1 status, storage location correction), `design-stage-4/STEP1_REPORT.md` (new), `design-stage-4/artifacts/prototype/proto.js` (four copy strings), `design-stage-4/step-1-evidence/` (new, 15 screenshots and the two helper scripts `xclose.py` and `ptr.py`).

**Not changed:** `src-tauri/` (Rust, `tauri.conf.json`, capabilities), `packages/domain`, `package.json` files, `pnpm-lock.yaml`, the Stage 4 screenshots and exploration frames, Repositories A and B contents.

**Generated and ignored by Git:** `dist/` and `src-tauri/target/` were rebuilt.

## Correction (Task 3.19): the launch resolver uses the shell's status region

`LaunchResolver` used to render its own `<p role="status">Opening your last lab…</p>`, created together with its text, which did not meet DESIGN_SPEC 9 (A-04, a region must exist before its text changes) and differed from the shell-owned region added in Step 5 ([STEP5_REPORT.md](STEP5_REPORT.md) section 8). Now: the resolver's template is `<main aria-busy="true"></main>` and has no status region. On creation it sets `StatusMessage` to `Opening your last lab…`, and its destroy hook sets it to `''`. Every way out of the resolver (a restore, Worlds with no pointer, a failed listing, an absent or invalid lab) navigates away and so destroys it, which is what clears the text. Leaving while the listing is still pending does the same. No second service or region was added. Launch decisions, pointer rules, `replaceUrl` navigation and `DEFINITIVE_KINDS` are untouched. The resolver never had a stale-resolution guard, and none was added.

Tests: `app.spec.ts` (shell mounted: the region exists and is empty before launch, the same element receives the text and is cleared without being removed, no resolver-owned region, four ways to Worlds clear it, leaving while pending leaves no text, focus unmoved by the text and then on the restored lab's heading) and `launch-resolver.spec.ts` (the message is written, the resolver owns no region). Mutations: no clearing on destroy (1 failed), a resolver-owned region (3), never writing the text (4). A clear in `go()` was tried and removed as redundant. Full suite: 265 passed. The built app restores a lab as before. The text itself flashes too fast to see, and no assistive technology was used, so announcement is **not verified**.
