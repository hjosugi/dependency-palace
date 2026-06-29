# Viewer Workflow: Scan, Open, Refresh

Labels: `viewer`, `workflow`, `developer-experience`

## Problem

The user should not have to manually load JSON after scanning forever. The viewer should support a smooth local workflow.

## Scope

- Default scan output path.
- Viewer can load graph JSON from URL or local dev endpoint.
- Auto-refresh graph after scan/watch updates.
- Show adapter diagnostics in the UI.
- Show source file paths and symbol ranges in detail panel.

## Acceptance Criteria

- `npm run scan -- ./repo` writes to a default location.
- `npm run dev` opens the latest graph automatically when present.
- Watch mode refreshes the viewer without losing selected node when possible.
- Diagnostics panel shows skipped files and unresolved edges.
