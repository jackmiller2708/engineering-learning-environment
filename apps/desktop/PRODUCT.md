# Product

<!-- impeccable:product-schema 1 -->

Canonical product definition and decisions live in the knowledge repository: [LE-PRODUCT.md](../../../../../../../engineering-knowledge/project/learning-environment/LE-PRODUCT.md), [LE-DECISIONS.md](../../../../../../../engineering-knowledge/project/learning-environment/LE-DECISIONS.md) (LE-005 to LE-012), [LE-DESIGN.md](../../../../../../../engineering-knowledge/project/learning-environment/LE-DESIGN.md). This file is the short record design work reads. If they differ, those documents win. The links work only in the current workspace layout.

## Platform

web

## Users

One known learner: the owner. They build and investigate engineering systems to understand how they work. Whether anyone else will use it is undecided.

## Product Purpose

A persistent engineering environment where the learner builds, connects, manipulates and observes systems, and learns by understanding and extending what they have built. The first world is Computer Foundations: bits and Boolean operations, logic gates, adders, and later toward a computer. Success is the learner understanding why a system works and where it fails, not completing lessons.

## Positioning

A lab, not a lesson sequence. The learner builds a persistent, growing system and inspects its internal behavior, instead of working through exercises that hide it.

## Operating Context

A local-first Tauri 2 desktop application on Linux: an Angular interface shown in the system webview inside a native window, with a Rust host. It is not a browser-based product and is not served from the web. Work is saved on the learner's machine, and the learner returns to the same environment over many sessions.

The Platform value above is `web` only because Impeccable's schema offers `web`, `ios`, `android` and `adaptive`, with no desktop value. It records the interface technology, not a deployment target.

## Capabilities and Constraints

- Vocabulary: **World** (an engineering domain), **Lab** (the learner's persistent environment in a world), **Bench** (the construction and investigation surface). "Workspace" is internal and never shown to the learner.
- Capabilities grow by building. The learner starts with primitives, builds components and keeps them for reuse. Nothing is refused because a step is incomplete.
- Knowledge is in context by default with a reference area as a secondary route. The bench works without knowledge content. The curriculum is canonical in the knowledge repository and is linked, not copied.
- Selection inspection is the default investigation route. Hierarchical entry, probes and overlays complement it.
- Fixed workbench regions around a central bench. No docking or floating windows initially.
- A persistent world switcher in the application bar. The active lab is always identifiable. Returning to the Worlds screen never destroys work. A world normally has one primary lab but may contain several; how the learner chooses among them is undecided.
- Undecided: the experimentation model (branching and comparison), what a lab contains beyond today's stored record, how the initial lab is created, keyboard operation of the bench.
- Implemented today: the workspace lifecycle only (list, create, select, restore by address). No bench, worlds, labs or learning content exist yet.

## Brand Commitments

The name is Engineering Learning Environment. The learner stated these as binding:
- Feels like an engineering laboratory. References: a circuit or logic simulator and a lab workbench, with a sandbox game's sense of owning a persistent system. An IDE is secondary.
- Must not feel like a course platform or LMS (lessons, completion percentages, quizzes, locked modules), nor like a generic dashboard or productivity app.
- Dense and information-rich by default, progressively layered.
- No rewards, resource grinding or decorative gamification.

## Evidence on Hand

The owner has been interviewed (2026-11-17), and the answers are recorded as LE-005 to LE-012. No external user research has been conducted. There are no real components, no learning content and no screens beyond the existing Workspace Home and empty workspace environment (internal names). Do not invent any of these.

## Product Principles

1. Build to understand. Making it work is not enough.
2. Touch everything. Experimentation is expected and carries no penalty.
3. It is the learner's, and it persists.
4. Expose behavior. Do not hide it.
5. Guide ambition and never enforce obedience.
