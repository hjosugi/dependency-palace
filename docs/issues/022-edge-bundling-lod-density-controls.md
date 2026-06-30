# Edge Bundling, LOD, And Density Controls

Labels: `rendering`, `performance`, `ux`, `priority:P1`, `status:ready`

## Problem

Dense graphs become hard to read even when rendering is technically fast. Users need visual density controls that preserve meaning.

## Goal

Add edge bundling, level-of-detail behavior, and density controls for large maps.

## Scope

- Bundle package-to-package edges in Map view.
- Fade low-priority edges by camera distance.
- Add edge density presets.
- Keep selected-node direct edges visible.
- Prioritize semantic edge kinds over weak imports.
- Show when edges are hidden or bundled.

## Acceptance Criteria

- Stress graph Map view is readable at default zoom.
- Selecting a node restores its direct semantic edges.
- Density controls update without rebuilding the full graph when possible.
- Visual verification covers at least one dense graph.
