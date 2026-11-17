# Engineering Learning Environment

A desktop-first, persistent engineering simulation and learning environment. The first learning world is Computer Foundations.

**Status:** repository established. No application code exists yet.

## Technical direction

Angular + TypeScript, Tauri 2 with Rust, pure TypeScript domain logic, local-first persistence, modular monolith, pnpm, Linux first. Decisions and reasons: [product decisions](../../../../../engineering-knowledge/project/learning-environment/DECISIONS.md).

## Where things live

| Need | Location |
|---|---|
| Product plan and milestones | [PLAN.md](../../../../../engineering-knowledge/project/learning-environment/PLAN.md) |
| Product architecture decisions | [DECISIONS.md](../../../../../engineering-knowledge/project/learning-environment/DECISIONS.md) |
| Concepts and curriculum | [engineering-knowledge](../../../../../engineering-knowledge/README.md) |
| Knowledge Standard (canonical) | [KNOWLEDGE_STANDARD.md](../../../../../engineering-knowledge/KNOWLEDGE_STANDARD.md) |
| Standard addendum (subordinate) | [KNOWLEDGE_STANDARD_ADDENDUM.md](../../../../../engineering-knowledge/KNOWLEDGE_STANDARD_ADDENDUM.md) |
| Why this is a separate repository | [WD-005](../../../../WORKSPACE_DECISIONS.md), [D-005](../../../../../engineering-knowledge/DECISION_LOG.md) |
| Workspace rules | [GOVERNANCE.md](../../../../GOVERNANCE.md) |

The links work only inside the current workspace layout. This repository has no remote yet.

## Boundaries

| This repository owns | Does not own |
|---|---|
| Source code, tests, implementation docs | Concepts, curriculum, product plans, the Knowledge Standard |

- Link to canonical content. Do not copy it here.
- The curriculum can be read and maintained without this repository.
- Product architecture decisions go in the knowledge repository. Implementation notes go here.

## Local configuration

`.claude/settings.local.json` and `.claude/.headroom_wrap_*` are machine-specific and ignored by Git.
