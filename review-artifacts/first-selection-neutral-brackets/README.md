# Review evidence: neutral selection brackets

Review evidence only. These files are not application assets and are not to be merged with the CSS change.

The CSS change is the separate commit `style: use neutral brackets for place-value selection` (`apps/desktop/src/app/workspaces/place-value-bench.css`).

## Images (all 720×480)

Each pair is the same state captured before (`-baseline`, HEAD `cca267d`) and after (`-after`) the CSS change.

| State | Light | Dark |
|---|---|---|
| Position 2 selected (bits 1011, total 11) | `light-720x480-pos2-selected-{baseline,after}.png` | `dark-720x480-pos2-selected-{baseline,after}.png` |
| Prediction revealed after flipping Position 2 (bits 1111, total 15; selection and last-changed both on Position 2) | `light-720x480-prediction-revealed-{baseline,after}.png` | `dark-720x480-prediction-revealed-{baseline,after}.png` |

Only these 4 pairs are published. The full 20-image sets (five states, 720×480 and 1100×720, both themes) remain local in `~/ele-visual-system-stage-0/` and `~/ele-visual-system-first-selection/`.

## Capture environment and limitations

- Production Angular build (`ng build`) served by a local Node server, with the Tauri IPC stubbed to return one lab.
- Headless Firefox 160 screenshots. Theme forced by Firefox profile prefs (`ui.systemUsesDarkTheme` for dark, `layout.css.prefers-color-scheme.content-override` for light) and checked per capture with `matchMedia` and the body background. Viewport checked via `innerWidth`/`innerHeight`.
- States driven by scripted clicks on the real controls.
- Not covered: WebKitGTK (the desktop engine), real Tauri IPC, CSP, window chrome, real keyboard input and the focus ring. No real-keyboard check was done.
