# @ele/domain

Pure TypeScript domain logic. No browser, Node, clock, random or filesystem access.

## Workspace name rules (M1)

Contract fixtures (language-neutral, for the later Rust implementation):

| File | Contents |
|---|---|
| `fixtures/workspace-name.json` | Validation, stored-name, comparison and key cases, each with an explicit expected outcome |
| `fixtures/casefold-unicode-18.0.0.json` | All 1606 Default Case Folding mappings (statuses C and F), generated from the official `CaseFolding.txt` 18.0.0 (sha256 in the file) |

Rules: trim Unicode White_Space (explicit list in the fixture, not `trim()`), reject Cc, max 64 scalar values, reject unpaired surrogates, preserve spelling and case, no normalization. Check order: malformed UTF-16, trim, empty, control character, too long.

Duplicate comparison key: Unicode Default Case Folding (C+F, non-Turkic) of the stored name. No `toLowerCase`, no locale, no normalization.

## Dependency decision: case folding

| | |
|---|---|
| TypeScript | `unicode-case-folding` **1.1.2**, pinned exactly (MIT, ESM, no dependencies) |
| Unicode data | **18.0.0**. The package does not state its version, so the test `matches Unicode 18.0.0 CaseFolding.txt` checks all code points against the committed fixture |
| Rust counterpart | `icu_casemap` 2.4.0 (ICU4X, Unicode 18.0.0, CLDR 49) with `CaseMapper::fold_string` (default, non-Turkic). Not yet added |

Rejected:

- `caseless` (Rust) bundles Unicode 16.0.0, which differs from 18.0.0.
- `icu` (ICU4X WASM for TypeScript) would match Rust exactly but needs WebAssembly and a looser CSP (`wasm-unsafe-eval`).
- A hand-written table: forbidden by the brief.

Upgrading Unicode: regenerate `casefold-unicode-*.json` from the new official file, update the library, and the exhaustive test shows any difference. Upgrade the Rust crate in the same change.

## Workspace manifest (schema version 1)

`fixtures/workspace-manifest.json` holds 148 cases (JSON text in, expected outcome out). The TypeScript decoder is the behavioural reference and `src/manifest.fixture.test.ts` runs it. The Rust decoder (`apps/desktop/src-tauri/src/workspace_manifest.rs`) runs the same file.

Error shape: `{code}`, `{field, code}` or `{code, version}`. Order: JSON syntax, root object, schema version, `id`, `name`, `createdAt`. A JSON number is a double, as in JavaScript: `1.0` and `1e0` are version 1.

**Known Rust deviation (one case, `unknown-key-lone-surrogate`):** an object *key* containing an unpaired surrogate escape (for example `{"\ud800":1}`) is ignored by TypeScript but is `malformed_json` in Rust, because `serde_json` cannot read such a key. Unpaired surrogates in *values* behave identically (name -> `malformed_utf16`, id -> `invalid_id`, createdAt -> `invalid_timestamp`, unknown properties -> accepted). Rust is the stricter side. The fixture states the deviation explicitly, and the Rust test requires exactly that outcome.

Scalar-value accounting for the case-fold test: 1,112,064 scalar values = 1,111,999 checked + 65 Cc values (never part of a valid name; the fixture maps none of them).
