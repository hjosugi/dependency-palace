# Issue Backlog

This directory mirrors GitHub Issue-ready work items.

Use the `DP-###` prefix in GitHub titles so local docs and remote issues stay aligned.

## Priority Order

| ID | Priority | Title | Status |
| --- | --- | --- | --- |
| DP-000 | P0 | Roadmap: Native Source Adapters For Major Languages | planned |
| DP-001 | P0 | Adapter Contract, Fixtures, And Diagnostics | planned |
| DP-002 | P0 | Native Adapter: Haskell | planned |
| DP-003 | P0 | Native Adapter: Java/JVM | planned |
| DP-014 | P0 | Startup And Example Payload Performance | open |
| DP-015 | P0 | Worker-Owned Graph Model And View Budgets | open |
| DP-016 | P0 | Haskell/Java Quality Gates | open |
| DP-017 | P1 | Semantic Signal Panel Next Steps | open |
| DP-018 | P1 | Real-World Example Corpus | open |
| DP-019 | P1 | Visual Regression Matrix | open |
| DP-020 | P1 | Source Ranges And Open-In-Editor Workflow | open |
| DP-021 | P1 | Binary Graph Format For Large Repositories | open |
| DP-022 | P1 | Edge Bundling, LOD, And Density Controls | open |
| DP-023 | P2 | GitHub Issue Sync Workflow | open |

## GitHub Creation

Recommended title format:

```text
[DP-014] Startup And Example Payload Performance
```

Recommended labels:

- `priority:P0`, `priority:P1`, or `priority:P2`
- area labels such as `performance`, `viewer`, `adapters`, `haskell`, `java`, `testing`
- `status:ready`

The issue files are intentionally self-contained so they can be pasted into GitHub issues or synced by script later.

## Sync Commands

```bash
npm run issues:dry-run
npm run issues:sync
```

The sync script matches existing issues by `[DP-###]` title prefix and creates missing labels/issues.
