# Worker-Owned Graph Model And View Budgets

Labels: `performance`, `worker`, `graph-model`, `priority:P0`, `status:ready`

## Problem

Normalization, SCC analysis, filtering, focus expansion, and view budgeting currently run on the main thread. That is acceptable for small examples but risky for real repositories.

## Goal

Move graph model work to a Web Worker and make view budgets explicit, measured, and testable.

## Scope

- Move `normalizeGraph`, `analyzeGraph`, `buildViewGraph`, and layout preparation into a worker boundary.
- Use transferable typed arrays or compact JSON messages for render-ready output.
- Preserve deterministic output.
- Report worker timings: parse, normalize, SCC, filter, layout, transfer.
- Keep current main-thread path as fallback during migration.

## Acceptance Criteria

- Loading a 2k+ node stress graph keeps UI controls responsive.
- Worker returns the same node/link counts as current main-thread model for fixtures.
- View budgets are configurable constants or options, not hidden magic.
- Focus view always keeps the selected node and direct semantic relations when possible.
- Playwright verification passes with worker enabled.

## Notes

This is the concrete next step after the current view-budget guard.
