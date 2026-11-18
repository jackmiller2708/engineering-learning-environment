# Stage 4, Step 7: Minimum window and small-window verification (Task 3.23)

Result: **configuration done; verification partly performed, with one FAIL found and not fixed; the light theme was not verified.** Nothing is committed. Step 8 is not started.

## 1. Requirements used (and where they come from)
- IMPLEMENTATION_BRIEF row 7: set `minWidth` and `minHeight` in `src-tauri/tauri.conf.json` only; the edit is **flagged for owner confirmation**; then run DESIGN_SPEC 8.1 against the built app in light and dark; record results and screenshots; a failure is reported, not adjusted away.
- DESIGN_SPEC 8 / 8.1: minimum 720 × 480; procedure and pass criteria (primary navigation reachable, important content reachable by scroll and Tab, keyboard operation, overflow is vertical scrolling only with no horizontal overflow, long and mixed-direction names do not overflow horizontally, both themes).
- No requirement was taken from general responsive-design practice.

## 2. Initial state
Window config had `width 1100`, `height 720`, no minimum. All of `apps/`, `packages/` and the workspace files are untracked in this repository (nothing committed).

## 3. Change
`apps/desktop/src-tauri/tauri.conf.json`: added `"minWidth": 720,` and `"minHeight": 480,` after `"height": 720,`. No Rust, capability, CSP, domain, dependency, style or Angular change. Flagged for owner confirmation at the time; **since approved and locked as LE-021 (Task 3.24)**.
Build: `pnpm tauri build --debug --no-bundle` (native config changed). No code changed, so no unit tests or Angular build were run for Step 7.

## 4. Environment and limits
Real built debug app on an isolated nested Xwayland (`:99`, root 1280 × 692), **no window manager**, throwaway XDG dirs, input by XTEST. Consequences:
- No decorations exist, so the inner size equals the X window size. Window-manager enforcement of the minimum and decoration effects were **not testable**.
- Minimum enforcement: the app sets `WM_NORMAL_HINTS` min size 720 × 480. A request to resize to 600 × 400 produced a **720 × 480** window (GTK clamp, no window manager). A request for 720 × 480 gave Width 720, Height 480.
- **Light theme not verified.** `GTK_THEME=Adwaita:light`, a `gtk-3.0/settings.ini`, and a private D-Bus session were each tried; the webview rendered dark every time. All results below are **dark only**.
- Bad address, unopenable and unreadable lab states have no entry point in the real app (no address entry; Worlds does not link unopenable entries), so they were **not verified in the real app**.

## 5. Observations at exactly 720 × 480, dark (evidence in `design-stage-4/step7-evidence/`, each image is the 1280 × 692 display, window at top left 720 × 480)
| State | Result |
|---|---|
| Worlds with 6 labs (long, Arabic, CJK, duplicate names), `…-worlds-labs-top.png`, `…-labs-end-unopenable-group.png` | Bar visible; rail 232 px and content fit; content scrolls vertically (scrollbar seen); scrolled to the end, the last row and the unopenable group are reachable and fully visible; no horizontal scrollbar. Long names are cut with an ellipsis in a narrow Name column; whether a full-name `title` exists was not checked. |
| Worlds empty (`…-worlds-empty.png`) | Fits, no scroll needed. |
| Validation error (`…-worlds-validation-error.png`) | Message and focused input visible. |
| List error and launch list failure (`…-worlds-list-error.png`, `…-launch-list-failed.png`), Try again (`…-after-retry.png`) | Panel and "Try again" visible; retry restored the list. |
| Launch recovery notice (`…-launch-recovery-notice.png`) | Notice, form and first row visible. |
| Lab ready, normal name (`…-lab-ready.png`) | Bar, breadcrumb with name and id, lab bar, bench text and facts strip all visible and unclipped. |
| Lab not found, failed read (`…-lab-not-found.png`, `…-lab-failed-read*.png`) | Panel, "Try again" with focus ring, and "Go to Worlds" visible. |
| Lab, Arabic name (`…-lab-arabic.png`) | Fits; name right-aligned in the facts strip. |
| **Lab, 64 wide characters (`…-lab-64-wide-chars.png`) — FAIL** | The breadcrumb and lab-bar names run past the right edge and are cut off; the facts strip is pushed to the right edge so the Lab, Created and ID **values are not visible**; no way to reach them was seen. Violates "long names do not cause horizontal overflow" and "no clipped text without a reachable full version". |
| **Lab, long CJK name (`…-lab-cjk.png`) — FAIL (partial)** | Breadcrumb id and the right edge of the facts strip are cut at the window edge. The lab name itself is readable in the lab bar and wraps in the strip. |

Keyboard (`…-kbd-*.png`): Tab reached the Create button; Tab reached the last list row and the page scrolled it into view with a visible focus ring, not hidden behind the bar; Enter opened that lab (focus moved to the heading); Shift+Tab reached the breadcrumb "Worlds" link and the skip link ("Skip to main content", visible with ring); Enter on "Worlds" returned to the Worlds screen. Empty submit with Enter showed the error with focus in the input. Tab order through the unopenable group, and the list-error "Try again" by keyboard only, were not exercised.

## 6. Deferred / not done
- **Fix for the long-name overflow on the lab screen** (breadcrumb, lab bar, facts strip): not fixed; Step 7 requires verification, not restyling. Owner to decide whether it is fixed before Step 8 or in it.
- Light theme at 720 × 480; window-manager enforcement and decorations; bad address, unopenable and unreadable states in the real app; Name-column full-name access; text scaling and zoom (DESIGN_SPEC 8 note); assistive technology.

## Task 3.24: minimum locked (LE-021), resize re-check
The minimum 720 × 480 logical pixels is approved and locked as LE-021 in the canonical decisions. `tauri.conf.json` was verified unchanged (`minWidth` 720, `minHeight` 480); no other enforcement was added. The sections above are unchanged historical evidence and keep their limits.

Rebuilt with `pnpm tauri build --debug --no-bundle` (finished). Environment: Linux, nested Xwayland `:99`, **no window manager**, WebKitGTK debug app, 2026-11-18. `WM_NORMAL_HINTS`: minimum 720 by 480. Each attempt started from 900 × 600 (XResizeWindow request):

| Requested | Observed |
|---|---|
| 600 × 400 | 720 × 480 |
| 720 × 400 | 720 × 480 |
| 600 × 480 | 720 × 480 |
| 720 × 480 | 720 × 480 (permitted) |

(An earlier attempt in this task passed the sizes incorrectly, so no resize happened; it was discarded and rerun.)
Limits: one Linux environment, no window manager (the clamp seen is the toolkit's, not a window manager's), X11 backend only, a debug build, logical equals physical pixels here. Not verified: any window manager or compositor, native Wayland, scaling above 1×, macOS, Windows, and release builds. Tauri documents the minimum as logical size, but that was not tested here beyond 1×.
