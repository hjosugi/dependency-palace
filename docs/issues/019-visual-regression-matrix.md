# Visual Regression Matrix

Labels: `testing`, `visual-regression`, `viewer`, `priority:P1`, `status:ready`

## Problem

The viewer now has multiple forms, view modes, mobile/desktop layouts, and example sizes. A single smoke screenshot is not enough.

## Goal

Create a visual regression matrix that catches blank canvases, broken forms, layout overlap, and unreadable UI.

## Scope

- Test desktop and mobile.
- Test forms: Palace, Tree, Blocks, Life, Space, Atomic.
- Test views: Map, Types, Focus.
- Test examples: starter, Tiny Haskell, Tiny Java, Medium Haskell, Stress Dense Cycles.
- Keep pixel checks tolerant; avoid brittle exact-image matching initially.
- Capture metrics and backend.

## Acceptance Criteria

- `npm run verify:visual` covers the matrix or a meaningful subset with documented skips.
- Each screenshot has a stable filename.
- Canvas blankness and movement checks remain.
- UI overlap checks cover mobile top controls and right panel.
