# Step 3 report: tokens and shell

Date: 2026-11-18. Status: **implemented, provisionally accepted by the owner. Stopped. Nothing was committed, pushed or staged.** Plan: [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md) section 8, row 3. Earlier: [STEP2_REPORT.md](STEP2_REPORT.md).

## 1. Scope (from the brief and DESIGN_SPEC 3 and 4)
Replace the tokens in `styles.css`; restyle the shell: 40 px bar, breadcrumb with the world as plain text, skip link. System fonts only. No Rust, Tauri configuration, capability, domain or dependency change.

## 2. Source of truth for LE-020
Canonical file: `/home/jackmiller/Projects/engineering-knowledge/project/learning-environment/LE-DECISIONS.md` (a sibling of the workspace root, not inside `engineering/`; the brief's relative link resolves to it). LE-020 reads: *"Deleting and repairing unopenable entries stay out of scope. Such entries remain visible and non-interactive."* LE-017: *"newest-created first, using existing record metadata."*
**Caveat:** in that repository LE-013 to LE-020 are **uncommitted working-tree changes** (`HEAD` `aaf1430` has no LE-020; the file shows +170 lines, and `LE-DESIGN.md`, `LE-PRODUCT.md` are untracked). The decisions exist on disk only.

## 3. Changes (`apps/desktop/src/`)
- `styles.css`: DESIGN_SPEC 3 tokens (OKLCH, `light-dark()`); old names mapped (`--bg`→`--ground`, `--line`→`--rule`, `--line-strong`→`--edge`); body 14 px, `h1` 20 px, `--mono`, `--focus` for the focus ring.
- `app.ts`, `app.html`, `app.css`: bar, breadcrumb (`nav` "You are here"; Worlds is the current page on `/worlds`; in a lab, Worlds is a link, the world is plain text, the lab carries `aria-current="page"` with its short id), skip link, content area as the only scroller.
- `active-lab.ts` (new) and `workspaces/workspace-environment.ts` (hook, `DestroyRef` clear, one CSS variable renamed): see section 4.
- `workspaces/lab-order.ts`: **corrected to comply with LE-020.** Returns every entry: valid labs newest first (equal times by id ascending), then unopenable entries by id ascending. Nothing is removed. Unopenable entries have no `createdAt`, so placing them after the labs is a presentation decision from DESIGN_SPEC 5.5, not stated in LE-017 or LE-020.
- Tests: `app.spec.ts` (8 shell tests), `lab-order.spec.ts` (unopenable kept, never dropped, entries returned unchanged).

## 4. ActiveLab
`ActiveLab` holds `{id, name} | null` in a signal. It is memory only, never persisted, and is not the last-lab pointer (`LastLabPointer`/`localStorage`, unchanged). Writer: `WorkspaceEnvironment` only, from its `view`: set when the view is `ready` (the host listed the lab as valid), `null` for loading, bad address, not found, unopenable and failed, and `null` on destroy. Reader: the shell, which shows the lab only if `activeLab.id === id in the address`, otherwise the breadcrumb ends at the world. A stale resolve cannot write (`resolveSeq` guard, unchanged).
Two independent guards therefore stop a stale name (component clears when not ready; shell compares ids). Mutation checks: removing either one alone leaves the new test passing, removing both fails it. **Clear-on-destroy has no test of its own** and is redundant with the two guards. I did not simplify it.
Simpler alternative: none without moving the host lookup out of the lab screen (for example a route resolver). That is a larger change than the helper, so it was not made.

## 5. Evidence
| Item | Result |
|---|---|
| Whole suite at the end of Step 3 | 176 passed, 0 failed (`ng test --watch=false`) |
| After the ActiveLab review | `app.spec.ts` only, 8 passed. The full suite was not rerun, and only test code changed |
| `ng build`, `tauri build --debug --no-bundle` | succeeded |
| Tests written first | `lab-order.spec.ts`: 3 failed against the old code. `app.spec.ts`: 5 failed before the shell existed. Both then passed |
| Defect found by a test | Angular dropped the space between lab name and id ("Adder bench0a1b2c3d" for a reader). Fixed |
| Built app, **dark** theme, nested X display, throwaway XDG dirs | Breadcrumb `Worlds / Computer Foundations / Adder bench 23efbe08`; on Worlds "Worlds" only; skip link is the first Tab stop with a visible ring, and activating it then Tab reaches the first control in the page; lab restored after a clean `WM_DELETE_WINDOW` close and reopen |
| `localOffsetLabel` expressions in WebKitGTK 2.52.6 (`WebKit2 4.1` binding, not inside the app) | `shortOffset` works: `GMT+7`, `GMT+5:30`, `GMT-5` winter and `GMT-4` summer; UTC gives `GMT` (Node: `GMT+0`, both accepted). No screen uses the function yet |

## 6. Verification gaps
- **Light theme: not verified** in the real app (could not make WebKit report light here).
- **Visual comparison with `artifacts/screenshots/`: not done.**
- **720 × 480: not verified.** It stays in step 7 as the brief specifies. The test display was 640 × 480, cropping the window.
- **Assistive technology and screen-reader behaviour: not verified.**
- Step 1 gates G1 to G8 were not rerun. Restore was only a regression check.
- The old screens still say "Workspaces", and the lab screen keeps its own back link beside the breadcrumb (steps 4 to 6).
- **This report does not claim the design specification has passed.**
