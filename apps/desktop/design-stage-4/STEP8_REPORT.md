# Stage 4, Step 8: Responsive and accessibility pass (Task 3.26)

Result: **implemented and partly verified. Not a conformance claim. See "Closure (Task 3.27)" at the end, which supersedes the first-pass statements about the light theme, the missing Orca announcements and the retry focus.** **Status: implementation Complete; verification Partial** (see C14). Nothing is committed. Screenshots in `step8-evidence/` (first pass) are dark; the light and closure screenshots are in `step8-evidence/closure/`. All are the 1280 × 692 display with the window at the top left.

## 1. Implemented (CSS only; no template, TypeScript, Rust, Tauri, domain or dependency change)
| File | Change | Why |
|---|---|---|
| `src/app/app.css` | `:host` gets `grid-template-columns: minmax(0, 1fr)` | **Cause of the long-name overflow.** The shell is a grid with no column template, so its implicit column grew to the nowrap breadcrumb's content width. A long lab name widened the whole page past the window; the facts strip, anchored to the page's right edge, was pushed off-screen and the lab bar and breadcrumb were cut off. Same cause for the long CJK name. |
| `src/app/app.css` | `li:not(:last-child) { flex: none; }` | With the page no longer widened, a long name squeezed the "Computer Foundations" crumb and overlapped it. Only the lab-name item now shrinks (it ends with an ellipsis; the full name is in its `title`, the lab bar and the facts strip). |
| `workspaces/worlds-screen.css`, `lab-create-form.css`, `lab-list.css` | One `@media (max-width: 899px)` block each, ported from the approved prototype (`artifacts/prototype/proto.css`): rail becomes a strip above the content, create button wraps under the field, list rows become two lines (name; created and ID) with "Open lab" at the end, the column header row is hidden | DESIGN_SPEC 8. The existing 900 px breakpoint is kept. |

Deviations from the prototype, both to meet the spec text: rows are **two** lines (the prototype stacks name, created and ID as three), and the create form needs `flex-basis: 100%` on the field for the button to actually wrap (the prototype's `flex-wrap` alone does not wrap at 720).
The `.brand` rule at 899 px was already present and unchanged. The shell's `.content` is the only scroller, and the rail strip stays in place.

## 2. Automated tests
`pnpm test` (full suite, run once at the end): **12 files, 314 tests, all passed.** The changes are CSS only and jsdom cannot test layout, so no new test was written and no per-slice focused run was done. The Step 6 copy and title scans are in that suite and passed.
Desktop build: `pnpm tauri build --debug --no-bundle` finished (it runs the Angular build; no warnings seen).

## 3. Built-app behaviour observed (debug build, nested Xwayland, no window manager, WebKitGTK, dark)
- **720 × 480** (window 720 × 480 confirmed): Worlds shows the strip, a full-width field with the button under it, and two-line rows with full names (`d720-worlds-top.png`, `d720-worlds-mid.png`). Scrolled to the end, the last row and the unopenable group are reachable and nothing scrolls horizontally (seen in the earlier build, `step7-evidence`, and the rows in `d720-kbd-tab9.png`). Only the content area scrolls; the bar and strip stay.
- **Long names on the lab screen, 720 × 480:** the 64-wide-character lab no longer overflows. The breadcrumb ends with an ellipsis, the lab bar shows the name with an ellipsis and "Created …" in view, and the facts strip is fully on screen with the whole name wrapped (`d720-lab-64w.png`). The Arabic lab is unchanged and fits (`d720-lab-arabic-launch.png`). The CJK lab was seen fitting **before** the final breadcrumb tweak (`d720-lab-cjk-before-breadcrumb-tweak.png`) and was not re-photographed after it.
- **899, 900, 800 and 1100 wide** (`d899x560-worlds.png`, `d900x560-worlds.png`, `d800x560-worlds.png`, `d1100x720-worlds.png`): 899 and 800 use the strip layout; 900 and 1100 put the rail beside the content with the product name in the bar. The 64-wide lab at 1100 × 720 shows the full name in the lab bar and the facts strip (`d1100x720-lab-64w.png`). **The display is 692 px high, so the bottom 28 px of a 720 px window were not visible**; the facts strip at 1100 × 720 is partly below the visible area in that screenshot.
- **Keyboard at 720 × 480:** after a route change focus is on the heading; Tab goes to the name field, the create button, then each row (a visible 2 px ring, scrolled into view under the strip, not hidden by it), and past the last row focus leaves the page, then the skip link (visible, `d720-kbd-tab10.png`). With the list unreadable, Tab reached "Try again" with a visible ring and it was scrolled into view; after permissions were restored, Enter reloaded the list (`d720-kbd-listerror-tryagain-focused.png`, `d720-kbd-listerror-after-enter.png`). The button is removed on success and focus is not placed anywhere in particular afterwards (observed; no requirement found for it).
- **Not exercised:** keyboard order through the unopenable group (the one unopenable fixture has no "Try again" and nothing focusable), the Worlds Name column title tooltip (the rows now show full names at 720, but the `title` text was not hovered), and bad address, unopenable and unreadable lab pages in the real app (still no entry point; not added).

## 4. Light theme
**Not verified.** The webview rendered dark in Step 7 under every method tried (`GTK_THEME`, a GTK settings file, a private D-Bus session) and no new method was found. No light screenshot exists.

## 5. Zoom and text scale
Not WebKit page zoom: no zoom control exists in the app and none was added. `GDK_DPI_SCALE=2` was used as an approximation. It scaled the whole UI by 2 (the bar became 80 px high), which gives a layout about 360 CSS px wide (a display-scaling approximation of what 200 percent zoom would give at 720 px, not a zoom test; see C10). It is **not** the same as the webview's own zoom or a text-size-only setting.
At that scale, in the built app (`d720-dpi2-worlds.png`, `d720-dpi2-kbd-row2.png`, `d720-dpi2-lab-64w.png`):
- Worlds stays in one column, the strip, form and rows reflow, and the content scrolls vertically; the focus ring is visible on a row; no horizontal overflow was seen.
- **Lab screen: the facts strip is taller than the bench area, so it grows upward over the lab bar** and hides the lab name and "Created …"; the strip itself stays readable. This is below the supported 720 px minimum in CSS terms and was **not fixed** (no redesign below the supported size). It does not occur at 720 × 480 at 100 percent.
- Not checked at that scale: error screens, keyboard order beyond one row, and the Worlds end of list.

## 6. Assistive technology (Orca (version not recorded) on the same display, throwaway Orca settings; its speech log was read; no audio was listened to; no other screen reader)
Observed, from Orca's logged speech:
- Entering Worlds: "main content", "Computer Foundations heading 1" (focus on the heading).
- Create form: "Create new lab landmark", "Name entry", "Up to 64 characters.", then "Create new lab button".
- **Whole-row link names:** "Half adder 2026-11-17 16:40 170731f3 link." and the same pattern for the 64-W, Arabic and CJK rows ("Open lab" is hidden from assistive technology, as designed). Names read in logical order; mixed-direction text was spoken as one name.
- **Route change to a lab:** the lab name is spoken as "heading 1"; to not found: "Lab not found heading 1"; to a failed read: "This lab could not be loaded heading 1". "Go to Worlds link." and "Worlds link." were read, and Enter on them led to "Computer Foundations heading 1".
- Breadcrumb: "banner", "navigation You are here", "List with 3 items", "Worlds link.", and the skip link ("Skip to main content link.").
**Not announced in this run:** the validation message "Enter a name for the lab." (Orca said only "invalid entry"; the text exists in the accessibility tree) and the failed-read panel's body sentence (only the heading was spoken). Whether this is Orca or WebKitGTK behaviour, or a markup problem with these `role="alert"` regions, was not determined. **Not fixed**; DESIGN_SPEC 9 says failures use an alert, and the markup does.
**Not verified:** the plain-text World item in the breadcrumb (Orca arrow-key and caret navigation produced no speech here, and the item is not focusable), the loading status regions (too brief to catch), the success status ("Created …") and the launch recovery notice, and any other screen reader or platform. DOM inspection was not used as a substitute.

## 7. Not verified, and why
Light theme (cannot be rendered here); WebKit page zoom and a text-size-only setting (no mechanism); window decorations and window-manager behaviour (no window manager); 1100 × 720 in full (display is 692 px high); unopenable keyboard order; hover tooltips; the plain-text breadcrumb item, loading, success and recovery-notice announcements with Orca; other assistive technology; other platforms.

## 8. Remaining known defects and findings
1. At 200 percent-equivalent scale the lab screen's facts strip covers the lab bar (section 5).
2. The validation message and failed-read body were not spoken by Orca (section 6); cause undetermined at the time (superseded: investigated in C3 and classified in C13).
3. After a successful keyboard retry the focused "Try again" button disappears and focus is not placed anywhere (section 3).
4. Not defects, but open: gates G1 to G4, G6a, G6c, G8, owner items R1 to R6, the remaining unverified items above.

---

# Closure (Task 3.27)

This section supersedes the earlier statements it contradicts (sections 3 to 8 above are kept as the record of the first pass). Evidence is in `step8-evidence/closure/`. Every check is marked **Verified**, **Failed** or **Unverified**. None of this is a conformance claim.

## C1. State confirmed before changing anything
Step 8 CSS present (`minmax(0, 1fr)` in `app.css`); `tauri.conf.json` still has `minWidth` 720 and `minHeight` 480 (LE-021); nothing staged or committed (the ELE repository's only changes are untracked files); the previous suite result was 314 tests. `KNOWLEDGE_STANDARD.md` was read: it is a knowledge-curriculum standard (status "Proposed"); its relevant principles here are to separate fact from assumption and to preserve uncertainty. There are two identical copies (`/home/jackmiller/Projects/engineering-knowledge/` and `repositories/engineering-knowledge/docs/`).

## C2. Focus after a successful retry: **Failed, now fixed**
Trace: Try again on the Worlds screen sets the list to `loading`, which removes the failure panel (and the focused button) from the page; focus falls to `body`; when the list settles nothing moves it. The same applies to the unopenable group's "Try again" (it re-emits the same retry). The lab screen already restores focus after a retry (existing `focusMode` pattern) and was not changed.
Regression tests were written first and failed on the old code (2 of 5 failed: focus left on `body` after a successful retry, and after a failed retry the new button was not focused). Fix, local to `WorldsScreen` (`worlds-screen.ts`/`.html`): Try again sets a flag; once the list settles, if focus is on `body` it goes to the **Labs heading** (success; the heading is `tabindex="-1"` as the page heading already is) or to the new **Try again** button (failure); if the learner put focus elsewhere meanwhile it is left alone; the superseded-request guard (`loadSeq`) already stopped a stale result from writing. Tests now cover: success, failed retry, focus moved away while pending (a mutation removing that guard fails it), a superseded result, and leaving the screen mid-retry. Real app (light, 720 × 480): Tab to the unopenable "Try again", Enter after the entry became readable, focus on the "Labs 6 labs" heading with a visible ring (`light-720x480-retry-success-focus-on-labs-heading.png`). **Verified.**

## C3. The two missing Orca announcements (Orca 49.4, AT-SPI 2.58.1, WebKitGTK 2.52.6, Orca on a Wayland session driving a nested Xwayland display)
Both were investigated through the DOM, the live accessibility tree (AT-SPI) and Orca's debug log.
**Validation message ("Enter a name for the lab.")**: markup is correct and unchanged. The `<p role="alert">` is exposed as role `notification` with `live: assertive`, `atomic: true` and its text; the input has `aria-invalid` (exposed as `invalid-entry`), a `described-by` relation to both the message and the hint, and an accessible description of only "Up to 64 characters." (WebKitGTK left the alert's text out of the computed description). Orca received `children-changed:add` for the notification. Its web script presents an added object only if `AXUtilities.is_alert` is true, which tests for the AT-SPI role **ALERT**; the object's role is **NOTIFICATION** (read from Orca's source in `ax_utilities_role.py` and its log line "Passing along event to gtk script", with no "Presenting event.any_data"). So Orca did not present it. **Conclusion: not a markup defect; an Orca / WebKitGTK role-mapping limitation in this environment.** No ARIA or live region was added.
**Failed-read body**: same structure and the same result. The alert `div` is exposed as `notification`, `live: assertive`, with the body paragraph and the button as children; Orca spoke the focused heading only and again passed the event along without presenting it. Same conclusion.
**Not established:** whether a different Orca or WebKitGTK version, or a real desktop session instead of this nested display, speaks them. **Unverified** as a screen-reader pass; **markup: verified correct against the intended semantics**.

## C4. Other screen-reader observations (speech read from Orca's log; no audio listened to)
| Check | Result |
|---|---|
| Worlds heading after navigation | **Verified** ("Computer Foundations heading 1") |
| Lab heading after navigation | **Verified** (lab name "heading 1"; not found and failed read headings too) |
| Whole-row link names | **Verified** (name, created, ID; Arabic, CJK and long names as one name) |
| Breadcrumb navigation and skip link | **Verified** ("navigation You are here", "List with 3 items", "Worlds link.", "Skip to main content link.") |
| Validation message ("Enter a name for the lab.") | **Unverified as spoken.** Investigated environmental limitation: Orca/WebKitGTK role presentation behaviour (C3). Markup correct. |
| Failed-read body | **Unverified as spoken.** Investigated environmental limitation: the same role presentation behaviour (C3). Markup correct. |
| Loading announcement | **Unverified.** The text never appeared in Orca's log; the loading state is brief and was not isolated. |
| Creation status ("Created …") | **Unverified as spoken. Unresolved.** The region is exposed as a status bar and Orca received the paragraph insertion event, but no announcement was spoken; the cause was not established. |
| Recovery notice | **Unverified as spoken. Unresolved.** Not spoken in the tested environment. It is a `role="status"` element rendered together with the screen (not a region that existed beforehand) and focus goes to the page heading first; the cause was not established, and neither the design nor this run establishes that it should be announced. |
| Plain-text World breadcrumb item | **Unverified** with Orca. Orca's own browse keys (arrows, F7, H) produced no speech at all on this display, so no browse-mode navigation was possible. What the accessibility tree shows (not a screen-reader result): on a lab page it is a list item named "Computer Foundations", not focusable, not a link, with the separator "/" (aria-hidden) still present in the item's text interface; on Worlds the current item is a span with `aria-current="page"`. |

## C5. Light theme: **Verified in part** (dark and light both rendered; light checked at 720 × 480 only, for the screens listed)
New method that made the webview genuinely light: launch with **no D-Bus session** (`DBUS_SESSION_BUS_ADDRESS=disabled:`, so no desktop portal can report the host's dark preference), `GSETTINGS_BACKEND=memory`, `GTK_THEME=Adwaita:light`, `NO_AT_BRIDGE=1`. The earlier methods (a private D-Bus session) activated the portal and stayed dark. Screenshots show the light tokens (white panels, dark text, light bench) at 720 × 480: Worlds top and end, validation error, row focus ring, unopenable group, and the 64-wide, Arabic and CJK labs; plus 899 wide (strip). Focus rings were visible and text legible in every frame viewed. The same window was 720 × 480 (`xwininfo`). Not viewed in light: 800 and 900 wide, the lab not-found and failed-read pages, the recovery notice. No assistive technology was available in this light launch (no accessibility bus).

## C6. Long and mixed-direction names at 720 × 480, final CSS: **Verified** (dark and light)
64 wide Latin, Arabic and CJK, in both themes (dark: CJK and 64-wide re-taken after the final breadcrumb change; Arabic dark from the first pass `step8-evidence/d720-lab-arabic-launch.png`): no horizontal overflow, "Computer Foundations" not overlapped, lab bar inside the viewport, the full facts strip visible with the whole name wrapped; the breadcrumb and lab bar end long names with an ellipsis and the full name is in the lab bar's and breadcrumb's `title` and in the facts strip. Worlds list rows show the full names (two lines, Name column) and `title`.

## C7. 1100 × 720: **Unverified (cannot be completed here)**
The display is 692 px high (host screen 720 minus 28 of window chrome; `-geometry 1280x800` was ignored). A 1100 × 720 window was created and its upper 692 px viewed; moving it up by 28 px to see its lower part showed the page content ending at row 692 with an **unpainted band** below it (`light-1100x720-window-moved-up-28px-bottom-band-unpainted.png`). Whether that is a display limit, a GTK/WebKit surface limit or a layout fault was not determined, so no full-height pass can be claimed, and the facts strip at 1100 × 720 was not seen in full. Rail-beside-content, the create form and list, and a visible row focus ring were seen at 1100 wide in the first pass (dark, `d1100x720-worlds.png`).

## C8. Breakpoint: **Verified** (unchanged at 900 px)
Strip layout at 720, 800 and 899 (dark, first pass; 899 again in light); side-by-side rail at 900 and 1100 (dark, first pass). Not re-run in dark in this task (no layout CSS changed in it).

## C9. Unopenable group, keyboard at 720 × 480: **Verified** (light)
With an invalid entry and an unreadable entry (a lab directory made unreadable): the invalid entry has no focusable content; the unreadable entry has exactly one focus stop, "Try again", reached after the last openable row with a visible ring and scrolled into view; the next Tab leaves the page. The invalid entry stays non-interactive. Only the group with a single unreadable entry was tried; no combination of several was.

## C10. Zoom: **Unverified** (no zoom test was performed; the experiment below is display scaling)
No webview zoom mechanism exists in the app and none was added or tested, so **actual webview zoom is unverified**. The earlier `GDK_DPI_SCALE=2` run is a **display-scaling approximation**, not a 200 percent browser-zoom test and not a text-size-only test: it enlarged the whole UI (including the 40 px bar to 80 px) at a fixed 720 × 480 window, giving an effective width of about 360 CSS px. At that scale Worlds reflowed and scrolled without horizontal overflow and the lab facts strip overlapped the lab bar. That effective width is below the supported 720 × 480 minimum, so the overlap is **not recorded as a failure within the supported window constraint** and was not fixed; it is also not described as a pass.

## C11. Automated tests and build
Full suite, once at the end: **12 files, 319 tests, all passed** (five new focus tests; the earlier 314 unchanged). Desktop build (`pnpm tauri build --debug --no-bundle`, which runs the Angular build): **finished**, no warnings seen.

## C12. Remaining limitations and open items
1. Four announcements were not spoken in this environment, with two different standings: the validation message and the failed-read body are an **investigated environmental limitation** (Orca/WebKitGTK role presentation behaviour); the creation status and the recovery notice are **unresolved** (cause not established). They do not share an established cause.
2. The plain-text World breadcrumb item was not checked with a screen reader.
3. 1100 × 720 not verified in full.
4. Zoom unverified; the 360-CSS-px approximation shows the facts strip overlapping the lab bar (below the supported size, not fixed).
5. Light theme was not seen for: 800 and 900 wide, lab not found and failed read, the recovery notice. Dark was not re-photographed for the unopenable group.
6. One platform, one display, one Orca and WebKitGTK version; no window manager; debug build.


## C13. Final verification matrix and announcement classification (Task 3.28)
Each row is **Verified**, **Failed** or **Unverified**, with its exact conditions. Environment for every row: Linux, nested Xwayland display (host screen 692 px high), no window manager, debug build, WebKitGTK 2.52.6; Orca 49.4 and AT-SPI 2.58.1 where a screen reader is named. Nothing here is a conformance claim.

| Check | Result | Conditions and limits |
|---|---|---|
| Lab long-name overflow, final CSS | **Verified** | 64 wide Latin, Arabic and CJK names at 720 × 480, dark and light; no horizontal overflow, "Computer Foundations" not overlapped, lab bar and full facts strip in view |
| Below-900 px layout | **Verified** | Strip at 720, 800, 899 (dark) and 899 (light); side-by-side rail at 900 and 1100 (dark); 900 px breakpoint unchanged |
| Focus after a successful retry | **Verified** | Was a failure (focus fell to the page); fixed in `WorldsScreen`; 5 tests; confirmed in the built app, light, 720 × 480 |
| Unopenable group by keyboard | **Verified** | Light, 720 × 480; one invalid entry (not focusable) and one unreadable entry (one focus stop, "Try again"); no combination of several unreadable entries tried |
| Light theme | **Verified in part** | 720 × 480: Worlds top and end, validation error, row focus ring, unopenable group, long-name labs; 899 wide. Obtained by launching with no D-Bus session |
| Light theme at 800 and 900 wide | **Unverified** | Not viewed |
| Lab error states in light (not found, failed read) | **Unverified** | Not viewed in light; viewed in dark only |
| Recovery notice in light | **Unverified** | Not viewed in light; viewed in dark only |
| Screen reader: headings after navigation, whole-row link names, breadcrumb, skip link | **Verified** | Orca 49.4 speech log only, dark launches; no audio listened to |
| Screen reader: plain-text World breadcrumb item | **Unverified** | Orca browse keys produced no speech on this display; only the accessibility tree was inspected (not a screen-reader result) |
| Full-height 1100 × 720 | **Unverified** | The display is 692 px high; the lower 28 px could not be seen, and moving the window showed an unpainted band whose cause was not determined |
| Actual webview zoom | **Unverified** | No mechanism exists or was tested |
| 200 percent display-scaling approximation | **Observation only (not a zoom test)** | `GDK_DPI_SCALE=2`, effective width about 360 CSS px, below the supported minimum; facts strip overlapped the lab bar; not recorded as a supported-window failure |
| Full suite and desktop build | **Verified** | 12 files, 319 tests passed; `pnpm tauri build --debug --no-bundle` finished |

| Unspoken announcement | Classification |
|---|---|
| Validation message | **Investigated environmental limitation:** Orca/WebKitGTK role presentation behaviour. WebKitGTK exposes the `role="alert"` paragraph as AT-SPI role NOTIFICATION (`live: assertive`); Orca's web script presents an added object only when its role is ALERT; the log shows the event passed along and never presented |
| Failed-read body | **Investigated environmental limitation:** the same role presentation behaviour. The alert container was observed with the same role (NOTIFICATION, `live: assertive`) and only the heading was spoken. The detailed Orca event trace was examined for the validation message; for this case the role exposure and the speech result were observed, not a separate trace of the handler branch |
| Creation status | **Unresolved.** The insertion event was received; no spoken announcement; cause not established |
| Recovery notice | **Unresolved.** Not spoken in the tested environment; cause not established |

Application markup and ARIA were not changed for any of the four.

## C14. Status wording (Task 3.28)
**Step 8 implementation: Complete. Step 8 verification: Partial.** Known accessibility limitations and unverified checks remain listed above. No accessibility conformance claim is made. The first-pass sections 1 to 8 are kept as written; where they say the light theme, the Orca announcements or the retry focus were unverified or unresolved, C2 to C13 supersede them.
