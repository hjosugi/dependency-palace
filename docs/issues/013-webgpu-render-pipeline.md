# WebGPU Render Pipeline And Worker Layout

Labels: `rendering`, `webgpu`, `performance`, `architecture`, `priority:P0`, `status:ready`

## Problem

The current viewer renders through Three.js scene objects. That is good enough for the first product slice, but very large graphs need a more explicit render pipeline.

## Goal

Move Dependency Palace toward a modern WebGPU-first architecture:

- WebGPU renderer by default.
- WebGL fallback.
- Worker-owned layout and analysis.
- Typed-array render buffers.
- LOD and edge culling.
- Future compute-assisted layout.

## Scope

- Create a render-buffer model independent from React and graph semantics.
- Move layout/analyze work to a Web Worker.
- Transfer typed arrays from worker to main thread.
- Upload node/edge buffers incrementally.
- Add backend diagnostics to UI.
- Keep WebGL fallback path.

## Acceptance Criteria

- The app reports `webgpu` or `webgl` backend.
- Graph changes do not block the UI on large fixture data.
- Worker output is deterministic.
- Render buffers are measured by byte size and upload time.
- A 10k type / 100k edge synthetic graph can be filtered and focused without freezing the UI.
- WebGL fallback remains visually equivalent.

## Notes

Do not replace the semantic layout with a pure force-directed simulation. WebGPU compute should refine a stable mental model, not create another moving hairball.
