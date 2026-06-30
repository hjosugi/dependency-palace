# Source Ranges And Open-In-Editor Workflow

Labels: `viewer`, `scanner`, `developer-experience`, `priority:P1`, `status:ready`

## Problem

The viewer shows symbols but does not yet let users jump back to source. For code understanding, the 3D model must connect to real files and ranges.

## Goal

Carry source location metadata from adapters into the viewer and expose an open-in-editor workflow.

## Scope

- Extend schema with source file path and symbol ranges.
- Add member-level ranges where adapters can provide them.
- Show source file/range in selected panel.
- Add copy path and optional editor URL command.
- Keep paths relative to scan root where possible.

## Acceptance Criteria

- Scanner emits source metadata for Haskell and Java fixtures.
- Selected panel shows file path and line range when available.
- User can copy source location.
- Missing source metadata is handled gracefully.
