# GitHub Issue Sync Workflow

Labels: `github`, `workflow`, `maintenance`, `priority:P2`, `status:ready`

## Problem

Local Markdown issue files and GitHub Issues can drift apart.

## Goal

Create a simple sync workflow so `docs/issues` can seed or update GitHub Issues.

## Scope

- Parse issue files with title and labels.
- Use `DP-###` title prefixes as stable keys.
- Dry-run mode prints create/update operations.
- Create missing labels if needed.
- Create missing GitHub Issues from local files.
- Optionally update issue bodies when local files change.

## Acceptance Criteria

- `npm run issues:dry-run` lists intended GitHub changes.
- `npm run issues:sync` creates missing issues safely.
- Existing issues are matched by `DP-###` prefix.
- The workflow never creates duplicates for already-synced issues.
