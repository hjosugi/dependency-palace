# Rendering Architecture

Dependency Palace uses a WebGPU-first rendering architecture with WebGL fallback.

## Current Runtime

```text
RawGraph JSON
  -> normalizeGraph
  -> analyzeGraph
  -> buildViewGraph
  -> layoutViewGraph
  -> GraphScene
  -> WebGPURenderer when available
  -> WebGLRenderer fallback otherwise
```

The renderer is initialized in [GraphScene.tsx](../src/GraphScene.tsx):

- Try `three/webgpu` dynamically.
- Use `WebGPURenderer` when `navigator.gpu` is present and initialization succeeds.
- Fall back to `WebGLRenderer` when WebGPU is unavailable.
- Keep the same scene graph and interaction model for both backends.

The dynamic import keeps the app shell smaller and avoids loading the WebGPU backend in browsers that cannot use it.

## Why WebGPU-First

WebGPU is the right direction for this project because the target workload is not a normal 3D scene. It is a large, dynamic data visualization:

- Many nodes and links.
- Frequent filtering and focus changes.
- Large typed buffers.
- Potential layout computation.
- Future edge bundling and visibility culling.

The near-term implementation still uses Three.js scene objects, but the architecture should move toward explicit GPU buffers and worker-owned layout.

## Rendering Layers

| Layer | Responsibility |
| --- | --- |
| Adapter layer | Extract symbols and relations from source code. |
| Graph model layer | Normalize, aggregate, analyze SCCs, build focus views. |
| Layout layer | Produce stable positions and semantic placement. |
| Render data layer | Convert positioned graph into typed arrays. |
| Renderer layer | Upload buffers and draw nodes/edges. |
| Interaction layer | Picking, hover, selection, camera, search. |

## Performance Rules

- No DOM nodes per graph node.
- No React components per graph node.
- No always-on force simulation in the render loop.
- Use instancing for repeated visual forms.
- Batch edges into shared buffer geometry.
- Keep labels in UI overlays, not thousands of world-space text meshes.
- Prefer semantic filtering before GPU upload.
- Apply view budgets before layout: focus views prefer selected/direct/semantic relations; class views cap extreme link counts before GPU upload.
- Move heavy layout and analysis to Web Workers.
- Add LOD and edge visibility rules before supporting very large graphs.

## Backend Plan

### Phase 1: WebGPU-First Three.js

Done:

- `WebGPURenderer` dynamic import.
- WebGL fallback.
- Backend marker on canvas for verification.
- Existing instanced node meshes and batched edge lines.
- Focus/class view budgets in the graph model layer before layout/render upload.

### Phase 2: Worker Layout

Move these off the UI thread:

- SCC detection.
- Query filtering.
- Focus-neighborhood expansion.
- Package aggregation.
- Semantic layout.

Use transferable typed arrays for large outputs.

### Phase 3: Render Buffer Model

Introduce explicit render buffers:

- `Float32Array` node positions.
- `Float32Array` node dimensions.
- `Uint32Array` node colors or packed colors.
- `Float32Array` edge segment positions.
- `Uint8Array` edge types and flags.

This creates a stable boundary between graph semantics and GPU upload.

### Phase 4: LOD And Culling

Add:

- Camera-distance node LOD.
- Edge density caps.
- Package-pair edge bundling.
- Frustum culling for far clusters.
- Focus-first interaction for very large graphs.

### Phase 5: Compute-Assisted Layout

When WebGPU support is mature enough for this app's target users:

- Run optional force relaxation in compute shaders.
- Keep semantic layout as the stable base.
- Use compute only for local refinement, edge bundling, or collision reduction.

## References

- [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [three.js WebGPURenderer](https://threejs.org/docs/#api/en/renderers/webgpu/WebGPURenderer)
- [Chrome Developers: WebGPU](https://developer.chrome.com/docs/web-platform/webgpu)
- [Babylon.js WebGPU documentation](https://doc.babylonjs.com/features/featuresDeepDive/webGPU/)
