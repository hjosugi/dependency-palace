# Incremental Index, Cache, And Watch Mode

Labels: `performance`, `indexing`, `developer-experience`, `priority:P1`, `status:ready`

## Problem

Large repositories cannot be fully rescanned on every run. Native adapters need persistent cache and incremental updates.

## Scope

- File content hashing.
- Adapter version hashing.
- Per-file extraction cache.
- Cross-file symbol resolution cache.
- Watch mode.
- Progress and cancellation.
- Large graph chunking.

## Acceptance Criteria

- Re-running scan on an unchanged repo reuses cached extraction.
- Editing one file only invalidates affected files and symbol edges.
- Scan progress is visible.
- Cache can be disabled and cleared.
- Large output can be streamed or chunked.
