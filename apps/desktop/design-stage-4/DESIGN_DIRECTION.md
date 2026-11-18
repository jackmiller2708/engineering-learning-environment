# Design Direction (Stage 4)

Status: **revision 2. The owner supports this direction (B); approved in principle. Implementation is in progress: steps 1 to 6 of the brief are implemented and steps 7 and 8 are not started (IMPLEMENTATION_BRIEF section 8). Implemented is not verified.** Revision 2 changes are in [design-stage-4/REVISION_REPORT.md](REVISION_REPORT.md). Companion documents: [DESIGN_SPEC.md](DESIGN_SPEC.md), [IMPLEMENTATION_BRIEF.md](IMPLEMENTATION_BRIEF.md). Inputs: [DESIGN_AUDIT.md](../DESIGN_AUDIT.md), [PRODUCT.md](../PRODUCT.md), and in the knowledge repository [LE-PRODUCT.md](../../../../../../../../engineering-knowledge/project/learning-environment/LE-PRODUCT.md), [LE-DESIGN.md](../../../../../../../../engineering-knowledge/project/learning-environment/LE-DESIGN.md) and [LE-DECISIONS.md](../../../../../../../../engineering-knowledge/project/learning-environment/LE-DECISIONS.md) (LE-005 to LE-020). If they differ, the knowledge repository wins. The links work only in the current workspace layout.

Labels used: **Required correction** (an audit defect), **Approved decision** (LE-013 to LE-020), **Recommendation** (a visual or structural proposal for the owner to confirm), **Preserve** (existing behaviour to keep), **Unresolved** (not decided, and not decided here).

## 1. What is being designed, and for whom

One known learner (the owner). Surfaces in scope: the **Worlds screen**, the **application shell**, and the **lab environment frame**. The bench, library, inspector and investigation content do not exist yet. Only the frame that will hold them is designed. Mode (Impeccable): **Operate**. The learner is completing tasks (find a lab, open it, create one, recover from a problem), so scanning speed, consistency and honest state outrank expression. Brand shows in precise details.

What the interface may claim today: the workspace lifecycle (list, create, open by address, restore). It may not imply a bench, worlds beyond Computer Foundations, curriculum, automatic provisioning, or any lab content (PRODUCT.md, "Evidence on Hand").

## 2. Method, and what was not run

Directions were derived from the audience's real scene (a learner at a desktop window, long sessions, returning daily) and from LE-009 (dense, layered, no gamification) and the brand commitments in PRODUCT.md. Impeccable's Operate rule applies: a visual world lends only type, palette, density and **one** signature move, never layout, and a tool or instrument world handed to a working screen risks becoming a costume.

**Not run:** Impeccable's `concept-seed` and its decision page. They are interactive, start a local server and write `.impeccable/` runtime state into the project, which this task forbids. The three directions below are therefore my own, not a seeded roll, and no challenger directions were dealt. The owner picks, not a script. Impeccable's detector was run on the existing source earlier and returned no findings. It does not evaluate these designs.

## 3. Three directions

The same two frames (Worlds screen, lab frame) in each direction, dark and light, are in `artifacts/exploration/`. Direction B's frames are the base prototype.

### A. Technical lab and instrumentation

- **Visual language:** monospace-forward type for everything, uppercase section labels, square corners, near-black ground with an amber accent in dark and warm paper in light, no decorative surface. Readouts look like a bench instrument.
- **Identity:** an engineer's test equipment. Most literal reading of "lab".
- **Information organisation:** flat tables and labelled fields. Hierarchy comes from case, weight and spacing.
- **Strengths:** unmistakably not an LMS. Dense by nature. Tabular values align well. Cheapest to build.
- **Weaknesses:** it is the costume Impeccable warns about. A monospace UI font hurts reading of prose (error messages, future explanations in context, LE-007), which the bench will need a lot of. Uppercase labels cost scan speed in long lists. Amber on dark reads as warning in a product where amber means notice.
- **Grows into the bench?** Partly. It suits probes and traces (Investigation) well and the construction surface poorly: nothing in it says "place and connect things".

### B. Circuit-design workbench (selected)

- **Visual language:** system sans for text, monospace reserved for identifiers, times and values. A cool slate-blue family. A deep-blue application bar. Panels are quiet, ruled and square-ish (4 to 6 px radius). The one signature move is the **dotted bench substrate**: a fine point grid that appears wherever the bench is, so the lab frame is recognisably a place to build. Teal-cyan accent in dark, deep blue in light.
- **Identity:** a schematic editor or logic simulator, the learner's named references in PRODUCT.md (circuit or logic simulator, lab workbench). The grid is the single borrowed device. Nothing else imitates an instrument.
- **Information organisation:** a breadcrumb (Worlds / world / lab) in which the world is a plain-text item for now, in a slot a real world switcher can later fill (revision 2: no switcher while one world exists). A world rail plus a lab table on the Worlds screen. A facts strip in the lab frame. The bench owns the centre, with secondary regions around it later.
- **Strengths:** the grid is both identity and function: it will be the snap grid of the bench, so it is not decoration. Sans text keeps prose readable. Contrast and boundaries can meet 3:1 without looking heavy. Familiar patterns (breadcrumb, table, form) keep the Operate surfaces predictable.
- **Weaknesses:** the least distinctive of the three on the Worlds screen, where the grid is absent. Identity concentrates in one place. Cool blue is a common "technical" palette, so differentiation rests on the substrate and on restraint, not on colour.
- **Grows into the bench?** Yes, directly. The substrate is the bench background, the facts strip generalises to the status strip, and the same tokens colour signals later (a second cue beyond colour is still required, see DESIGN_SPEC section 9).

### C. Persistent environment with strong spatial organisation

- **Visual language:** warm neutrals, larger radii, generous rail tiles, a coarser dot grid, a rust or amber accent. Worlds are presented as places (large rail tiles) and labs as regions.
- **Identity:** a place you return to. Emphasises LE-005 (a persistent environment) and the sandbox-game sense of owning a system, which the brand commitments allow only as a secondary reference.
- **Information organisation:** spatial. The Worlds screen reads like a map or a set of rooms.
- **Strengths:** speaks most directly to "this is yours and it persists". Room to grow into several worlds with distinct identities.
- **Weaknesses:** with one world and a handful of text-only labs there is nothing spatial to show. Tiles and rooms would be mostly empty, which reads as a dashboard or launcher, the thing the brand commitments rule out. Larger tiles reduce density, against LE-009. Warm palettes plus rounded zones drift toward a consumer or productivity look.
- **Grows into the bench?** Moderately. The persistence idea carries. The soft, large-radius language fights the precision a construction surface needs.

### Comparison

| | A Instrumentation | B Schematic workbench | C Spatial environment |
|---|---|---|---|
| Not an LMS or dashboard | Strong | Strong | Weak (tiles read as launcher) |
| Density (LE-009) | High | High | Medium |
| Reads prose well | Poor | Good | Good |
| Becomes the bench | Partial | Direct | Moderate |
| Costume risk (Operate rule) | High | Low (one device) | Medium |
| Distinct on the Worlds screen | High | Low | Medium |
| Build cost | Lowest | Low | Medium |
| Meets 3:1 boundaries cleanly | Yes | Yes | Yes |

## 4. Recommendation

**Direction B, with two limited borrows.** From A: monospace for identifiers, times and values only, because those are exactly the tabular readouts that benefit (the short id, the UTC time, the facts strip). From C: the Worlds screen keeps a persistent **world rail**, so "the world is a place you are in" is stated structurally, without tiles. Neither borrow brings its other clothes.

Trade-offs the owner accepts by choosing B:
- The Worlds screen is plain by design. Identity is in the lab frame and in details, not in decoration. It becomes more distinctive once real bench content exists.
- Cool blue is conventional. If the owner wants a stronger identity now, A's amber or C's warm palette can replace B's colour family without changing structure, because the tokens are separable (spec section 3).
- The substrate dots must stay faint and are never the only boundary of anything.

## 5. Visual principles

1. **Facts, not decoration.** Every element states something true: the lab's name, time, id, or the state of an operation. No illustration, no empty-state mascot, no progress theatre.
2. **One signature.** The dotted bench substrate. It appears only where the bench will be.
3. **Honest absence.** Where the bench does not exist, the frame says so plainly instead of drawing placeholder regions as if they worked. Regions are drawn only in an annotated map labelled as a diagram.
4. **Boundaries you can see.** Controls and their edges reach 3:1 against the surface behind them (audit A-01). Decorative separators may be fainter but never carry meaning.
5. **Never colour alone.** Invalid, error and notice states pair colour with an icon or a word.
6. **Dense but layered.** Information visible by default is the facts a learner scans. Detail (UTC time, full id) is one step deeper (tooltip or the frame's facts strip), not hidden.
7. **Quiet motion.** A background-colour change on hover only. Everything respects `prefers-reduced-motion`. Motion never explains state yet, because there is no bench.

## 6. Constraints the design honours

- System fonts only. The Content-Security-Policy is `font-src 'self'` and no remote assets are allowed. **Owner decision (revision 3): system fonts for the initial implementation, with no bundled typeface and no font dependency.** Reopened only if an actual rendering problem is shown in the running application.
- Plain CSS, OKLCH with `light-dark()`, the same mechanism the application uses today. No design-system dependency, no new package.
- The window is resizable with no minimum today. The design specifies behaviour down to 720 by 480 and the owner retained that as the proposed minimum. It is a configuration change made in implementation, and the exact-size runtime verification has **not** been performed (DESIGN_SPEC 8.1).
- Locked architecture (LE-001 to LE-004) is untouched. No domain model for worlds or labs is introduced.

## 7. How the audit items are accounted for

Detailed per-item treatment is in DESIGN_SPEC section 11. In this document: the direction answers V-01 (identity: the substrate, the bar, mono readouts), V-02 (typography and rhythm: one type scale, mono for data), A-01 (boundary contrast: `--edge`), and D-01 to D-09 and S-01 to S-04 at the structure level (breadcrumb shell, world rail, status strip, table with id and time columns).

## 8. Unresolved (stay unresolved here)

- **The last active lab's pointer is decided (revision 2):** frontend `localStorage`, behaviours in DESIGN_SPEC 7.2, durability limits and the unverified persistence test in IMPLEMENTATION_BRIEF section 7. Not an open question any more. Its guarantee is still unproven at runtime.
- Lab-name uniqueness (LE-018). Not decided. The design copes with duplicates and does not rely on uniqueness.
- How the learner chooses among several labs in a world beyond newest-first listing, and how labs are managed.
- A real world-selection model and a world switcher. The shell has a slot for one. No switcher is built or specified, because only one world exists (revision 2).
- A route-following native window title is deferred by the owner.
- The keyboard and screen-reader model of the bench (LE-DESIGN, open).
- Whether the LE-DESIGN region arrangement is final. Evaluated below, not adopted.

## 9. Evaluation of the LE-DESIGN region arrangement

LE-DESIGN proposes Library left, Bench centre, Inspector right, Investigation bottom. It is a recommendation, not a decision (LE-011 decided only "fixed regions around a central bench"). Evaluation, not adoption:

- **Fits:** it matches the established pattern of circuit simulators and gives the bench the centre. Responsibilities are separable and match LE-010's layers (selection inspector, investigation by probes).
- **Pressure points:** at the application's 1100 by 720 default, four regions plus the bench leave a bench narrower than comfortable unless the secondary regions collapse. The Investigation region at the bottom competes for vertical space most, since 720 px is short. Knowledge reference "opens without permanently using bench space" (LE-DESIGN) and has no home in the arrangement, so it needs a decision (spec proposes a tab in the Inspector).
- **Recommendation for the frame only:** keep the four responsibilities. Default Library and Inspector open at fixed widths (224 px and 280 px in the diagram), and Investigation as a collapsed strip that opens upward over the bench. Mark all of it as a design diagram until the bench exists. Final confirmation is deferred to when real content exists to test it against. The annotated map is `artifacts/screenshots/lab-map-*.png`.
