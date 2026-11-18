# Design Specification (Stage 4)

Status: **revision 3. The owner supports Direction B and has approved implementation to proceed step by step. Steps 1 to 6 of the brief are implemented (STEP1 to STEP6 reports); steps 7 and 8 are not started. Implemented does not mean verified: the light theme, exactly 720 × 480, comparison with the screenshots and assistive technology are open (IMPLEMENTATION_BRIEF section 8 and the step reports). This document does not claim that the application conforms to it.** Revision 2 changes are listed in [REVISION_REPORT.md](REVISION_REPORT.md). Revision 3 (this review round) is limited to: Worlds-screen wording (sections 1 and 5), the system-font decision (section 3), and the pending state of the error-wording review (section 10). It is listed in [REVIEW_HANDOFF.md](REVIEW_HANDOFF.md), which also holds the full R1 to R6 decision questions. Direction and rationale: [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md). Build order and contracts: [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md). Findings referenced by ID (S-, D-, A-, V-, O-) are in [DESIGN_AUDIT.md](../DESIGN_AUDIT.md). Decisions LE-013 to LE-020 are in [LE-DECISIONS.md](../../../../../../../../engineering-knowledge/project/learning-environment/LE-DECISIONS.md).

Visual artifacts: `artifacts/screenshots/` (rendered frames, both themes) and `artifacts/prototype/` (a static HTML rendering of this specification, query-driven, system fonts, not application code). **All lab names, times and ids in the artifacts are synthetic test data.** The `Created (GMT+7)` column header in the artifacts hard-codes the offset of the machine that rendered them. The application must show the learner's actual local offset.

Labels: **Required correction**, **Approved decision**, **Recommendation**, **Preserve**, **Unresolved**.

## 1. Approved decisions and where they land

| Audit | Decision | Owner approval, 2026-11-17 | Specified in |
|---|---|---|---|
| O-01 | LE-013 | Home becomes the Worlds screen, initially Computer Foundations. Existing records unchanged. Revision 3 (owner): Computer Foundations is shown as an available World. Showing a World does not open a Lab and does not create one. Creating a Lab stays an explicit learner action. | 5, 7.1 |
| O-02 | LE-014 | Explicit "Create new lab" stays. No automatic provisioning. | 5.3, 7.5 |
| O-03 | LE-015 | Host error kinds translated at the frontend presentation boundary. | 10 |
| O-04 | LE-016 | Restore the last active lab on launch. Else Worlds. If it cannot be opened, Worlds with a recovery message. Pointer stored in frontend `localStorage` (owner decision, revision 2). | 7.2, 7.7 |
| O-05 | LE-020 | Deleting or repairing unopenable entries stays out of scope. | 5.5 |
| O-06 | LE-017 | Newest-created first, using existing metadata. | 5.4 |
| O-07 | LE-018 | Name uniqueness stays unresolved. Current behaviour preserved. | 5.4, 7.9 |
| O-08 | LE-019 | Show the name limit before submission from the shared domain definition. | 5.3 |

The LE numbers are sequential in the order the decisions were recorded, not in the order of the audit's O-numbers.

## 2. Vocabulary and copy rules (LE-005)

Learner-facing words: **World**, **Lab**, **Bench**. Actions: Open lab, Create new lab, Go to Worlds. Not used: restart, branch, save slot, instance.

**Learner-visible restrictions (owner-approved in Step 6; this is the one definition).** What a learner can read or hear (text, `document.title`, and the `title`, `aria-label`, `placeholder` and `alt` attributes) never contains:
- `workspace`, in any case;
- `manifest`;
- `workspace.json`;
- an internal data-folder path;
- a raw host error message (the host's `message` is never shown, section 10).

Ordinary words such as "file" and "path" are **not** banned. The wider list in section 10 is a narrower-scope rule for the translated host-error sentences only. The addresses (`/workspace/:id`), code identifiers and folder names are not learner-visible and are not covered. Enforced by `page-title.spec.ts` through `copy-scan.testing.ts`, over every screen and state and the whole shell. The raw-host-message rule recognises only the messages the tests supply, so it shows that those are not displayed, not that no other message could be.

**"Return" and "Go".** LE-005 records the vocabulary as "Return to worlds" (a requirement for the route back to Worlds). The literal copy is "Go to Worlds" on the lab problem states and the breadcrumb link "Worlds" (owner decision, Step 5). "Return to Worlds" is not shown to the learner, and the decision record is left as written.

Copy is plain and states what is true. It never implies automatic provisioning ("Create one to start", not "We set one up for you"), a bench, or other worlds. Messages say what happened and what the learner can do.

## 3. Tokens

Defined in `artifacts/prototype/proto.css` as OKLCH with `light-dark()`, the mechanism the application already uses. They are separable: replacing the colour family does not change structure.

| Role | Token | Notes |
|---|---|---|
| Page, panel, raised, bench | `--ground --panel --raised --bench` | Four surface steps |
| Text, muted | `--text --muted` | |
| Control and boundary lines | `--edge` | 3:1 or better against its surface (A-01) |
| Decorative separators | `--rule` | May be faint. Never the only boundary of a control or state. About 1.4:1 by design (A-02) |
| Accent, on-accent | `--accent --on-accent` | Links, primary button, "New" tag |
| Focus | `--focus`, `--focus-bar` | 2 px outline, 2 px offset. A separate light value on the dark bar |
| Danger, notice | `--danger(-tint)`, `--notice(-tint)` | Always paired with an icon or a word |
| Application bar | `--bar --on-bar --on-bar-2` | |

Contrast computed from the tokens by `artifacts/contrast.py`: every listed text pair at least 4.5:1 and every listed control, focus and boundary pair at least 3:1, in both themes (lowest text pair 6.5:1, lowest boundary pair 4.97:1). **This is a numeric check of design tokens. It is not a WCAG conformance claim.** It does not cover hover or disabled states, text over the dot substrate, the translucent menu shadow, or rendered anti-aliasing.

**Fonts: decided by the owner (revision 3): system fonts for the initial implementation.** No bundled typeface and no font dependency. Not reopened unless an actual rendering problem is demonstrated in the running application.

Type: system sans (`system-ui` stack) for text. Monospace (`ui-monospace` stack) only for identifiers, times in the facts strip, and values. One scale: 12 (secondary), 14 (body), 16 (lab title), 20 (screen title). Tabular numerals on. Sizes of 12 are secondary information only (V-02, a density decision).

Spacing: 4 px base. Rows 44 px minimum height. Interactive targets at least 36 px high.

## 4. Application shell

A 40 px bar at the top, then the screen. **Required** (S-03, LE-011): the current world is always identified, the active lab is always identifiable, and the Worlds screen is always reachable.

- **Bar content:** product name (secondary, hidden below 900 px), then a breadcrumb `Worlds / Computer Foundations / Adder bench 497cb045`. On the Worlds screen the breadcrumb is `Worlds` only, and the world is identified there by the rail and the screen title.
- **Breadcrumb semantics:** a `nav` labelled "You are here" holding an ordered list. "Worlds" is a link. The world item is **plain text: not a link, not a button, not focusable**. The last item, the lab, carries `aria-current="page"`. Where the lab is not known (loading, not found, failed, bad address), the breadcrumb ends at the world item and nothing carries `aria-current`.
- **One world, so no switcher yet (revision 2, owner decision).** A one-entry popover would be a redundant interaction: it would offer only the world the learner is already in, plus a link that "Worlds" already provides. It is deferred until a second world exists. LE-011 is not weakened: the world stays persistently identified, the active lab stays identifiable, and the route back to Worlds is one link in the bar.
- **Switcher-ready structure:** the world item is its own list item between "Worlds" and the lab. A real world switcher later replaces that item's content with a control. The bar, the breadcrumb, the routes and the screens do not change. Nothing about the switcher's form is specified here.
- **Long names:** the lab item truncates with an ellipsis. The full name is in `title` and in the lab heading, and the short id is always visible.
- **No actions in the bar.** Create, open and retry live in the screens. The bar is global navigation only (LE-011).

## 5. Worlds screen

Route `/worlds`. Layout (1100 by 720): a 232 px world rail, then a content column that scrolls independently.

1. **Rail:** heading "Worlds", one item "Computer Foundations", marked current (`aria-current="page"`). Rail items are links. (O-01: Computer Foundations is the first world, not a commitment to world selection.) **Showing a World is not entering a Lab (owner decision, revision 3).** Computer Foundations is displayed as an available World, and its labs are listed on this screen. No Lab is opened and no Lab is created by arriving here, by selecting the World, or by the list being empty. A Lab opens only when the learner activates a lab row, and a Lab is created only when the learner activates "Create new lab". The one place the application opens a Lab without a click is the launch restore of a previously opened Lab (7.2, LE-016), which is not provisioning. **Interpretation to confirm (REVIEW_HANDOFF C-1):** this design shows the world's lab list directly on the Worlds screen with no separate "Open world" step. If the owner wants a step between the rail item and the lab list, it is an addition to this screen, not a change to anything else.
2. **Title block:** an `h1` with the world name, and nothing else. **No description line (owner decision, Task 3.16):** a line such as "Binary representation, logic gates and adders." would describe content that does not exist yet, and copy states what is true. Earlier revisions of this spec and the prototype showed one. That is superseded. The Worlds frames under `artifacts/screenshots/` were rendered before the decision and **still show the superseded line; they have not been regenerated**.
3. **Create new lab (LE-014, LE-019), placed above the list:** a labelled field "Name", a hint "Up to 64 characters." and a primary "Create new lab" button on one line. The hint number is `WORKSPACE_NAME_MAX_LENGTH` from `@ele/domain`, and the frontend must not copy the constant or any rule. The field has no `maxlength` attribute, because truncating silently would hide a rule. The host stays authoritative. Placed first so creation is findable without scrolling when the list is long.
4. **Labs list (LE-017, LE-018):** a section "Labs" with a count. A table-like list with columns Name, Created, ID, and an "Open lab" affordance. **Newest created first**, by existing `createdAt`, with the lab id as a stable tie-break so equal times keep a deterministic order. The whole row is one link to `/workspace/:id` (**Preserve**). Duplicate names are shown as they are. The Created time and short id distinguish them (D-03 mitigation, not a resolution of uniqueness).
   - Created shows local time (`title` and the lab frame give UTC). The header states the offset (D-04, Recommendation).
   - Name wraps to at most two lines and then clamps, with the full name in `title`. It never forces horizontal scrolling (D-01, **Required correction**). `dir="auto"` is set on names so mixed-direction text displays correctly.
5. **Cannot be opened group (LE-020):** a separate list "Cannot be opened" after the labs. Each entry shows a no-entry icon, "Cannot be opened", the short id, and a one-line reason translated from `kind` (section 10). Entries are visible, **not links**, and have no actions. Removal and repair are out of scope and nothing in the interface suggests they are coming.
6. **Created feedback (D-05):** after a successful create, a status line inside the form card "Created “Adder bench”." with an "Open lab" link, the new row carries a "New" tag, and the field is cleared. The tag stays until the next create or reload (no timer, no animation).

Empty state: bordered dashed box "You have no labs in this world yet." and "Create one to start. It is saved on this computer." No illustration and no claim that anything was set up.

## 6. Lab environment frame

Route `/workspace/:id` (**Preserve**, internal name unchanged). The frame holds the future bench and shows only what exists.

- **Lab bar** under the shell: `h1` lab name (clamped, `title` for the full text) and "Created …" in secondary text.
- **Bench substrate:** the remaining area, with the dotted grid (the one signature). A plain statement: "The bench is not available yet." and "This lab is saved on this computer. Nothing has been added to it."
- **Facts strip** (bottom right, over the substrate): World, Lab, Created (local and UTC), ID (the full id, in monospace). Real facts only. This is the only place the full id appears (D-08: de-emphasised, still reachable). The strip is a description list.
- **No regions are drawn in the real frame.** `lab-map-*.png` is an annotated diagram labelled as such.

**Region arrangement (evaluation, not adoption):** see DESIGN_DIRECTION section 9. When the bench is built, the recommended default is Library 224 px left, Inspector 280 px right, Investigation as a collapsed strip that opens upward, and the knowledge reference as a tab in the Inspector. This is a recommendation to confirm against real content, and it is not an LE-011 decision.

## 7. Interaction and state specification

Route changes move focus to the destination's `h1` (`tabindex="-1"`). **Today this is true for the lab screen only.** The current home screen has no focusable heading and does not move focus on arrival (found in the Task 3.12 closure checks: from a lab, "Workspaces" lands on the list, and the next Tab reaches the name field). That is a pre-existing gap, not a Step 1 regression, and it is a **required addition in step 4** for the Worlds screen. Loading states are announced politely. Errors are announced assertively. Learner-facing text is in section 10.

### 7.1 Open world
From the rail or the bar. `/worlds` shows the title and the list in its loading state, then the list or its error.

*Loading:* `Loading labs…`, a polite status. No spinner is needed. The create form is already usable while the list loads (as today).

### 7.2 Launch and restore (LE-016, revision 2)

`/` is a **launch resolver**, not a screen. It decides once per launch, then replaces itself in history so Back never returns to it. It shows "Opening your last lab…" (polite status inside the shell) only while it waits.

**The pointer (owner decision: Option A).** The last active lab is remembered as one value in the webview's `localStorage`: the lab's id and nothing else. It is not lab-record metadata and no host command is involved. It is read and validated with the domain's `parseWorkspaceId`, so the frontend holds no id rule of its own. Its durability limits are in IMPLEMENTATION_BRIEF section 7.

**Rules:**
1. The pointer is **written only after a lab has successfully opened**: the lab screen resolved the id and the entry is valid. It is not written while loading, and not for a bad address, a lab that is not found, an unopenable lab or a failed read.
2. Every storage read, write or clear is wrapped. **A storage failure is treated as "no pointer" for reads and ignored for writes and clears.** It never blocks the application, the Worlds screen or entering a lab.
3. The pointer is a convenience, never a source of truth. Losing it only means the application opens Worlds.

| Situation at launch | Result | Pointer |
|---|---|---|
| No pointer | Worlds, no message | none |
| Pointer present but not a valid id | Worlds, no message (**Recommendation**: there is nothing the learner can act on) | cleared |
| Storage cannot be read | Same as no pointer | unchanged |
| Pointer valid, listing succeeds, lab present and valid | Open the lab | rewritten after it opens |
| Listing succeeds and the id is **absent** | Worlds, notice "no longer available" | **cleared** |
| Listing succeeds and the entry is invalid with a **definitive** kind | Worlds, notice with the short id and reason | **cleared** |
| Listing succeeds and the entry is invalid with `entry_unreadable` or an unrecognised kind | Worlds, notice "could not be read" | **kept** |
| Listing fails (any error) | Worlds, with **one** list-failure panel whose lead line is "Your labs couldn't be checked." and a **Try again** button that re-reads the list (N-1, owner) | **kept** |

**Definitive** means the lab is confirmed missing or confirmed unopenable: absent from a successful listing, or an invalid entry whose kind is one of `entry_symlink`, `manifest_missing`, `manifest_not_a_file`, `manifest_too_large`, `manifest_not_utf8`, `manifest_malformed`, `manifest_invalid_field`, `manifest_id_mismatch`, `manifest_unsupported_version`. **Transient or unknown** means a failure to list, or `entry_unreadable` (the host raises it for an I/O failure and the interface cannot tell whether it is permanent), or any kind the frontend does not recognise. The rule is: clear on definitive, keep otherwise. **Owner review R1:** the classification of `entry_unreadable` and of `manifest_unsupported_version` (section 10).

A recovery notice appears once, on the Worlds screen, and is not stored.

### 7.3 Enter lab
Activating a row (click, Enter) navigates to `/workspace/:id`. The lab screen resolves the id by listing, as today. While it resolves: "Opening lab…" with the shell visible. On success the heading is focused and the pointer is written (7.2 rule 1). The breadcrumb shows the world and the lab together.

States of the lab screen, all existing today and all to be **preserved**: loading, ready, bad address, not found, unopenable (the entry exists and is invalid), failed read. The last four show a link "Go to Worlds" and never write the pointer.

### 7.4 Return to Worlds
(The requirement's name. The literal copy is the breadcrumb link "Worlds" and "Go to Worlds"; see section 2.)

"Worlds" in the breadcrumb goes to `/worlds`. Returning never changes saved work (LE-011, **Preserve**). Switching worlds is not specified: there is one world and the switcher is deferred (section 4).

### 7.5 Create lab (LE-014)
States: idle, creating, succeeded, failed.
- **Idle:** the button is enabled with the field empty or not. The host rejects an empty name with `name_empty`, and the frontend does not pre-validate (**Preserve**).
- **Creating:** the button reads "Creating…" and is disabled. The field keeps focus and its text. A second submit is impossible.
- **Succeeded:** field cleared, focus stays in the field, status line and "New" tag as in 5.6. The list refreshes. There is no automatic navigation (**Preserve**).
- **Failed:** the translated message (section 10) appears under the field, linked with `aria-describedby`, `aria-invalid="true"` on the field, announced as an alert. The typed text is kept and focus returns to the field (**Preserve**).
- **Unconfirmed result** (`internal_error`, `unexpected_error`, unrecognised kind): the message says the application cannot confirm whether the lab was created, and the list is refreshed so the learner sees what exists (**Recommendation**, owner review R5).

### 7.6 Validation feedback (LE-019)
Before submission: the hint "Up to 64 characters." is always visible and tied to the field with `aria-describedby`. After a failed attempt: the translated message joins the hint. The limit is never typed into the frontend as a literal. It comes from the domain constant, for the hint and for the `name_too_long` message.

### 7.7 Unopenable lab, and launch recovery (LE-016, LE-020)
- **Recovery notice on Worlds** (shown only after launch recovery, text in section 10): above the form, a status region with a bold sentence and one explanatory sentence. It names the lab by **short id only**, because an invalid entry carries no name and the pointer holds only the id. Text plus a word, never colour alone. It has no dismiss control and no timer: it disappears when the learner navigates away.
- **Unopenable entries in the list:** see 5.5.
- **Unopenable or missing lab by address:** the lab screen states in 7.3, each with "Go to Worlds".

### 7.8 Unreadable data directory
Listing fails:
- On `/worlds`: the "Labs" area shows a problem panel with the list-failure text and a "Try again" button. The create form stays visible. Retry re-lists and, on success, replaces the panel with the list.
- On `/workspace/:id`: heading "This lab could not be loaded" (the failure is reading the list, not the lab), the list-failure text, a sentence that the application cannot tell whether the lab exists until it can read the list, a "Try again" button and a "Go to Worlds" link (D-09).
- At launch (7.2): Worlds with the same panel, led by "Your labs couldn't be checked." instead of "Your labs could not be loaded.". There is no separate notice, so the learner sees one message and one **Try again**. Try again re-reads the list, and nothing else: on success the list replaces the panel, the learner stays on Worlds (launch does not run again and the lab is not opened for them), and the last-lab pointer is neither cleared nor rewritten by the failure or by the retry. The wording does not say the failure is temporary, does not name a cause and does not suggest restarting.

### 7.9 Long and duplicate names
Long names: see 5.4 and 4. Row at 720 px wide: name on the first line (clamped to two), time and short id stacked under it, "Open lab" at the right. Duplicates: shown as separate rows. The short id (monospace) and the created time are the distinguishing facts, and the lab frame shows the full id. No uniqueness is enforced or implied (LE-018).

### 7.10 Document titles (D-07, in scope)
`document.title` per route, set from the route and, for a lab, from the loaded lab name. No host contract is involved. Angular's own title mechanism is enough:
- `/worlds`: `Worlds — Engineering Learning Environment`
- a lab: `<lab name> — Computer Foundations — Engineering Learning Environment`
- lab error states: `Lab not found`, `Not a lab address`, `This lab cannot be opened`, `This lab could not be read` (an unreadable entry; owner decision, Task 3.21), `This lab could not be loaded`, each followed by ` — Engineering Learning Environment`
- while a lab resolves: the product name alone, never a previous lab's name. During Try again the current error title stays until the retry resolves.
- launch: the product name alone.

**Deferred (owner decision):** making the **native window title** follow the route. It stays "Engineering Learning Environment". No Tauri capability is added.

## 8. Layout and responsive

- **Default 1100 by 720.** All frames in `artifacts/screenshots/` are at this size unless named `-720w` (720 wide) or `-720x480`.
- **At least 900 px wide:** rail plus content. Content centred with a 1040 px maximum so lines stay readable. The rail does not collapse.
- **Below 900 px:** the rail becomes a strip above the content, the product name leaves the bar, the list becomes two lines per row, and the create form wraps its button under the field.
- **Minimum size: 720 by 480 logical pixels (approved and locked, LE-021).** `tauri.conf.json` sets `minWidth` 720 and `minHeight` 480; neither dimension may be reduced independently. Below 720 by 480 the layout is not designed. Resize behaviour was checked on one Linux environment only (STEP7_REPORT, Task 3.24 section).
- **Only the content area scrolls.** The bar (and below 900 px the rail strip) stays in place. The page itself never scrolls, and nothing may require horizontal scrolling at default text size.
- **Larger windows:** content stays at its 1040 px maximum. The lab frame fills the area, and the bench substrate scales with it.
- **Text scaling and zoom:** text uses rem and px is for borders and the grid. Behaviour at 200 percent text size and at 200 percent zoom is **not verified**. At 200 percent zoom a 720 px window shows 360 CSS px, which is below the designed minimum, so zoom needs its own check.

### 8.1 Verification at exactly 720 × 480

**Status (Task 3.23): PARTLY PERFORMED, dark only, one failure.** Run in the built app at exactly 720 × 480 on a nested X display with no window manager. The light theme could not be rendered and is **not verified**. The 64-wide-character and long CJK lab names overflow horizontally on the lab screen (FAIL, not fixed). Details and screenshots: [STEP7_REPORT.md](STEP7_REPORT.md). **Step 8 (Task 3.26) fixed the long-name overflow and re-observed it in the built app at 720 × 480 in dark, with the below-900 layout of section 8 implemented; **Step 8 implementation is Complete and its verification is Partial.** The light theme was verified in Task 3.27 at 720 × 480 for Worlds, validation, the unopenable group and the long-name labs (and 899 wide), but **not** at 800 or 900 wide or for the lab error states and recovery notice; the plain-text breadcrumb item with a screen reader, full-height 1100 × 720 and actual webview zoom remain **unverified**, and four Orca announcements were not spoken (two investigated environmental limitation, two unresolved). No accessibility conformance claim is made** ([STEP8_REPORT.md](STEP8_REPORT.md), C13 and C14). Nothing not listed in those reports may be reported as passed.

Procedure, in the running Tauri application, in light and in dark (the system theme switched, not a style override):
1. Set the minimum size and confirm the window cannot be resized below it. Record the inner size actually obtained, since window decorations differ from the outer size.
2. At exactly 720 × 480, visit: Worlds (with labs, empty, list error, validation error, launch recovery notice), a lab, and each lab error state (not found, bad address, unopenable, failed read).
3. Pass criteria:
   - **Primary navigation reachable:** the bar and breadcrumb are fully visible on every screen, "Worlds" can be activated by pointer and by keyboard, and the lab's name and id are visible on the lab screen.
   - **Important content not inaccessible:** the create form, every list row, the unopenable group, every notice, every error panel with its "Try again", and the lab facts strip can each be reached by scrolling and by Tab (a focused control is scrolled into view and not hidden behind the bar).
   - **Keyboard operation:** with no pointer, the skip link, the breadcrumb "Worlds" link, the create form (type, submit with Enter, failure message and focus return), a lab row (Enter opens it) and each "Try again" can be reached and operated, in a logical order, with a visible focus ring, and nothing focusable is hidden behind the bar or clipped.
   - **Overflow is scrolling:** only the content area scrolls vertically. No horizontal scrollbar. No clipped text without a reachable full version (`title`, heading or facts strip).
   - **Long and mixed-direction names** (64 wide characters, Arabic and CJK) do not cause horizontal overflow.
   - **Both themes:** the same checks pass in light and in dark, the focus ring is visible, and text and boundaries are legible.
4. Record what was checked, the observed result, and the screenshots. A failure is reported, not adjusted away.

**What has been done instead (a design-level observation, not this verification):** the prototype was rendered at exactly 720 × 480 in both themes with headless Firefox, with the content area scrolled to its end where it overflows (`artifacts/screenshots/*-720x480*.png`). In those frames the bar and breadcrumb are fully visible, the content area is the only part that overflows, the end of the Worlds page (including the unopenable group and the error panel's "Try again") is reached by scrolling, and no horizontal overflow is visible. Not covered by this observation: the real WebKitGTK webview, keyboard and focus behaviour, hover, text scaling, window decorations and the real minimum-size enforcement.

## 9. Accessibility requirements

Requirements to build to. **None of this is a conformance claim.**

- **Keyboard:** every control reachable and operable. Order follows reading order: bar, rail, form, list, unopenable group. A "Skip to main content" link first in the page (Recommendation).
- **Focus:** a 2 px outline with a 2 px offset in `--focus`, and `--focus-bar` on the dark bar. Never removed. Row links use an inset outline so it is not clipped.
- **Landmarks:** `header`/banner, `nav` (breadcrumb), `nav` (Worlds rail), one `main`, one `h1` per screen. Lists are real lists. The facts strip is a description list.
- **Status and alerts:** loading and success use a status region that exists in the page **before** its text changes (A-04: a region inserted together with its content may not be announced). Failures use an alert.
- **Not colour alone:** unopenable and error states carry an icon and the words "Cannot be opened" or a sentence. The "New" tag is a word. Current world and current page use `aria-current` and weight, not colour.
- **Targets:** at least 36 px high for controls and rows. The breadcrumb links are 28 px high with spacing around them (A-03: no neighbouring target problem, but the 24 px minimum of WCAG 2.5.8 is met by size, not only by the spacing exception).
- **Motion:** only a background-colour transition on hover and focus-adjacent surfaces, under `prefers-reduced-motion: no-preference`. No other motion exists.
- **Bidirectional text:** `dir="auto"` on lab names, `unicode-bidi: plaintext` on the clamped name.
- **Unknown, and needing its own design:** the keyboard and screen-reader model of the bench (LE-DESIGN, open). Nothing here addresses it.

## 10. Host error translation (LE-015, revision 2)

Presentation boundary: a pure function from the host's `kind` (and the context it arrived in) to a learner-facing sentence, in the vocabulary of section 2. Host `kind` values are unchanged and no contract changes. The host's `message` is **never** shown, because it contains internal terms (S-02).

**Scope:** the stricter rules below apply to the translated host-error sentences in this section and are enforced by `describe-error.spec.ts`. The learner-visible restrictions for everything else are in section 2.

**Rules for every message:** it says what happened. It says what the learner can do next only when there is something they can do (otherwise it says nothing about a next step). It contains none of: file or folder paths, "data folder", "file", "record", "JSON", "link", "shortcut", "staging", "publish", "schema", "manifest", "workspace". It says **"No lab was created"** only for kinds where the host states that nothing was created, changed or published.

Several kinds deliberately share one sentence. The host's detail (disk full, permission denied, read-only) is not in the `kind` and is not shown, so the interface cannot say which it was and does not guess.

The host kinds are those in `workspace_commands.rs` plus the gateway's `unexpected_error`. Revision 2 added `manifest_not_utf8`, which the first version of this table omitted.

### Create (`createWorkspace` failed)

| Kind | Learner-facing text |
|---|---|
| `name_empty` | Enter a name for the lab. |
| `name_control_character` | The name contains a character that cannot be used. Remove it and try again. |
| `name_too_long` | The name is longer than {limit} characters. Use a shorter name. |
| `id_collision`, `id_unavailable` | The application could not set up a new lab. No lab was created. Try again. |
| `clock_before_epoch`, `clock_out_of_range` | This computer’s clock is set to a date the application cannot use. Correct the date and time, then try again. |
| `storage_unavailable`, `storage_write_failed`, `storage_publish_failed` | The lab could not be saved. No lab was created. Try again. |
| `storage_unsupported` | This computer cannot save labs safely, so no lab was created. |
| `internal_error`, `unexpected_error`, any unrecognised kind | Something went wrong inside the application, and it cannot confirm whether the lab was created. Check the list below before trying again. |

`{limit}` is `WORKSPACE_NAME_MAX_LENGTH` from `@ele/domain`. The clock messages do not say "no lab was created" because the host does not say so for those kinds. `internal_error` also covers a host worker that did not finish ("Nothing was changed that could be confirmed"), which is why it carries no "no lab was created" claim.

### List, open and launch check (`listWorkspaces` failed)

| Kind | Learner-facing text |
|---|---|
| `storage_unavailable` | The application could not read your labs. Try again. |
| `internal_error`, `unexpected_error`, any unrecognised kind | Something went wrong inside the application while loading your labs. Try again. |

### Unopenable entries (an entry returned with `status: invalid`)

| Kind | Learner-facing reason |
|---|---|
| `entry_symlink` | The application does not open this lab because of how it is stored on this computer. |
| `manifest_missing` | This lab is missing information the application needs to open it. |
| `manifest_not_a_file`, `manifest_too_large`, `manifest_not_utf8`, `manifest_malformed`, `manifest_invalid_field`, `manifest_id_mismatch` | The information saved for this lab cannot be read or is not valid. |
| `manifest_unsupported_version` | This lab was saved in a form this version of the application cannot open. |
| `entry_unreadable` | This lab could not be read. The group offers **Try again** for this kind only (it re-reads the list). |
| any unrecognised kind | This lab cannot be opened. |

The heading of every unopenable entry is "Cannot be opened". The group carries one line: "The application cannot repair or remove these labs." (LE-020: a statement of what is true, not of what is planned.)

### Launch recovery notices (Worlds screen, once)

| Situation | Notice |
|---|---|
| Lab absent from a successful listing | **Your last lab is no longer available.** It is not in your list of labs, so Worlds is open instead. |
| Definitive invalid entry | **Your last lab (3f2b8c1e) cannot be opened.** {entry reason} It is listed below under Cannot be opened, and Worlds is open instead. |
| `entry_unreadable` | **Your last lab (3f2b8c1e) could not be read.** Worlds is open instead. |
| Listing failed (N-1) | **Your labs couldn't be checked.** Not a separate notice: it is the lead line of the list-failure panel, followed by the list sentence above and **Try again**. |

`3f2b8c1e` is the short id from the pointer. The lab's name is not known to the interface in the invalid cases.

### Lab screen states

| State | Heading and text |
|---|---|
| Bad address | **Not a lab address.** This address does not point to a lab. |
| Not found | **Lab not found.** This lab is not in your list of labs. |
| Unopenable (every kind except `entry_unreadable`) | **This lab cannot be opened.** {entry reason} The application cannot repair or remove it. |
| Unreadable (`entry_unreadable`, R6b) | **This lab could not be read.** A **Try again** button re-reads the list, and **Go to Worlds**. No repair or removal sentence, because the host does not say the lab is broken. |
| Failed read | **This lab could not be loaded.** {list failure text} Until it can, the application cannot tell whether this lab exists. |

### Owner review (genuinely ambiguous, not decided here)

**Status (Task 3.11): decided by the owner and applied to the tables above.** R1: `entry_unreadable` has no "just now", keeps the pointer and allows retry; `manifest_unsupported_version` is definitive and the wording never says newer or older. R2: `entry_symlink` stays deliberately vague. R3: merged sentences stay, including `manifest_not_utf8` in the six-kind group. R4: "restart the application" removed, "Try again" kept. R5: "cannot confirm" wording and the automatic re-list kept, and `internal_error` never claims no lab was created. R6: "identifier" replaced in the two address messages. R6b: applied as the "Unreadable" row. The notes below are the original questions, kept as the record. **N-1 (Task 3.12, owner):** "could not be checked just now" is removed everywhere. The launch listing-failure message is "Your labs couldn't be checked." with a Try again that re-reads the list.

- **R1. `entry_unreadable`:** the host raises it for an I/O failure on one entry and does not say whether the cause is temporary. This table treats it as not definitive (the launch pointer is kept) and says only "just now". Confirm, or say it is permanent. Likewise `manifest_unsupported_version`, which the host raises both for "no usable version" and for "a different version": it is treated as definitive and the wording avoids saying newer or older.
- **R2. `entry_symlink`:** the real cause is that the entry is a link, which the host does not follow. The text is deliberately vague because "link" and "shortcut" are implementation terms. Confirm the vagueness is acceptable.
- **R3. Shared sentences:** merging kinds (for example the three storage kinds on create, or six manifest kinds) loses distinctions the host makes. Confirm that the learner needs none of them.
- **R4. "restart the application":** generic advice, not tied to a known cause. Confirm it, or remove it.
- **R5. Unconfirmed create:** the wording, and the recommended re-list after it.
- **R6. "identifier"** appears in two address messages (bad address, not found). It is the least learner-facing word left. These screens are reached only by a stale or malformed address, which the learner cannot type in the desktop window.

## 11. Audit items: how each is treated

| Item | Treatment | Class |
|---|---|---|
| S-01 | Worlds screen replaces the empty list plus form. Create stays explicit. The interface does not claim automatic provisioning | Approved (LE-013, LE-014) |
| S-02 | Vocabulary rules (2). Host text is not shown (10) | Required correction, approved (LE-015) |
| S-03 | Breadcrumb shell: current world always shown (plain text), active lab always shown, one link back to Worlds. World switcher deferred while one world exists (4) | Required, LE-011 |
| S-04 | Lab frame with substrate and facts strip. Regions only in a diagram (6) | Recommendation |
| S-05 | Launch resolver (7.2) | Approved (LE-016) |
| S-06 | Unopenable entries stay visible and non-interactive (5.5) | Approved scope (LE-020) |
| D-01 | Wrapping, clamping, `overflow-wrap`, `dir="auto"` (5.4, 7.9) | Required correction |
| D-02 | Newest first with id tie-break (5.4) | Approved (LE-017) |
| D-03 | Duplicates shown, distinguished by time and short id (5.4, 7.9). Uniqueness unresolved | Unresolved (LE-018) |
| D-04 | Local time, UTC in `title` and in the lab frame (5.4, 6) | Recommendation |
| D-05 | Status line with "Open lab" link plus "New" tag (5.6) | Recommendation |
| D-06 | Hint from the domain constant (5.3, 7.6) | Approved (LE-019) |
| D-07 | Per-route `document.title` (7.10). Native window title deferred | Recommendation |
| D-08 | Full id only in the lab facts strip (6) | Recommendation |
| D-09 | Wording for a failed read versus a missing lab (7.3, 7.8, 10) | Required correction |
| A-01 | `--edge` at 4.97:1 or better (3) | Required correction (token level) |
| A-02 | Row and list separators remain decorative. Rows are whole-row links with a visible "Open lab" affordance and hover fill (3, 5.4) | Recommendation |
| A-03 | Breadcrumb target sizes and spacing (9). Verify against 2.5.8 in the running app | Needs runtime check |
| A-04 | Status regions pre-exist their text (9). Needs screen-reader testing | Needs AT testing |
| V-01 | Direction B: substrate, deep-blue bar, monospace data (DESIGN_DIRECTION) | Recommendation |
| V-02 | One scale. 12 px only for secondary information (3) | Recommendation |

**Preserve** (from the audit): lifecycle behaviour and route restoration, keyboard order and focus management, the error and retry pattern, typed-text retention, unopenable entries visible and non-clickable, both themes following the system, token-based colours, the gateway boundary, backend-authoritative validation, and local persistence.

## 12. What the artifacts cannot show

Needs the running application: real fonts on the target system, focus behaviour and order, announcements, 200 percent zoom and text-size, high-contrast modes, hover and pressed states, window chrome and title, and behaviour with real data directories. Needs assistive-technology testing: every status and alert region, the reading of whole-row link names (the row's accessible name is its name, time and id, with the visual "Open lab" hidden from assistive technology), and the reading of the breadcrumb. The frames were rendered with headless Firefox 160, not with the application's WebKitGTK webview, so text metrics and wrapping can differ.
