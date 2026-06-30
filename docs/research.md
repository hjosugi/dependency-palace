# Research Notes

The goal is not to recreate a 2D UML canvas in 3D. The useful target is the mental model a developer builds after fully understanding the code: state, behavior, contracts, inheritance, callers, callees, and architectural districts.

The product mental model is maintained in [mental-model.md](mental-model.md).
The explicit research target list is maintained in [research-targets.md](research-targets.md).

## Similar Projects

| Project | Useful idea | Limitation for this app | What Dependency Palace uses |
| --- | --- | --- | --- |
| [3d-force-graph](https://github.com/vasturiano/3d-force-graph) | Three.js/WebGL graph rendering with force-directed 3D layout. | Force simulation and rich per-node objects can become expensive and unstable for very large dependency maps. | Three.js/WebGL, orbit navigation, direct interaction. |
| [react-force-graph](https://github.com/vasturiano/react-force-graph) | Friendly React integration for 2D/3D/VR/AR graph views. | Great for fast prototypes, but less control over draw-call budget and class-specific aggregation. | The interaction pattern, not the rendering abstraction. |
| [CodeCity](https://wettel.github.io/codecity.html) and the [ACM paper](https://dl.acm.org/doi/10.1145/1370175.1370188) | Classes as buildings, packages as districts, stable landmarks. | City views show software metrics well, but dependency edges can still become cluttered. | Package/module districts and stable spatial memory. |
| [Sourcetrail](https://github.com/CoatiSoftware/Sourcetrail) | Source explorer with indexed code, search, and local context views. | The original repository was archived; it is not a 3D large-graph renderer. | Search-first navigation and selected-neighborhood focus. |
| [NDepend dependency graph](https://www.ndepend.com/docs/visual-studio-dependency-graph) | Real-time search, expand/collapse, callers/callees exploration for large .NET codebases. | Commercial and .NET-centered; primarily 2D. | Package overview, hubs, focus mode, and real-time filtering. |
| [dependency-cruiser](https://www.npmjs.com/package/dependency-cruiser) | Mature JS/TS dependency extraction and rules. | Module/file-level by default, not class-level 3D visualization. | Good future upstream extractor for JS/TS projects. |
| [Sigma.js](https://www.sigmajs.org/) | WebGL rendering for larger 2D graphs. | 2D renderer; no direct 3D camera or depth layout. | Confirms that WebGL is the right baseline for thousands of graph elements. |
| [Cytoscape.js](https://js.cytoscape.org/) | Graph algorithms, analysis, and visualisation APIs. | Rich analysis can add overhead; large layouts still need care. | Keep graph analysis separate from draw calls. |
| [Gephi](https://gephi.org/) | Strong desktop graph analysis and layout exploration. | Not an embeddable app workflow for live code navigation. | Useful mental model for filtering, clustering, and graph metrics. |
| [AWS Labs Palace](https://awslabs.github.io/palace/stable/) | Large-scale 3D finite-element simulation with parallel and GPU support. | It is not a dependency graph or software architecture viewer. | Useful as a reference for large 3D data output, postprocessing separation, and performance profiling discipline. |

## Product Decisions

1. Overview before detail. Large codebases start in package overview so users do not begin with a hairball.
2. Stable layout over live physics. The layout is deterministic and clustered by module/package. Force layouts are useful for discovery but can move landmarks under the user.
3. Focus is a primary mode. Selecting a node and expanding 1-3 hops follows the Sourcetrail/NDepend pattern: inspect a local dependency story without losing the global map.
4. Metrics drive visibility. Degree, SCC size, LOC, complexity, and package size are available for sizing and prioritization.
5. Rendering is intentionally low-level. Nodes are one `InstancedMesh`; links are one `LineSegments`; labels live in DOM only for hover/selection.
6. A useful focus view must show class internals. Fields and methods are rendered as owned objects instead of hidden metadata.
7. Multiple 3D forms are useful when they preserve semantics: Palace for architecture, Tree for hierarchy, Blocks for construction, Life for state/behavior, Space for scale, Atomic for local internals.

## Performance Strategy

Current renderer budget:

- One draw call for visible nodes.
- One draw call for visible dependency edges.
- No per-node React components.
- No continuous layout simulation.
- Pointer picking is throttled with `requestAnimationFrame`.
- Package aggregation is the default for multi-thousand-class graphs.

Next steps for even larger graphs:

- Move layout and SCC analysis into a Web Worker.
- Add edge bundling per package pair.
- Add level-of-detail rules that fade or hide low-degree edges as camera distance increases.
- Add a binary cache format for very large extracted graphs.
- Add source extractors per language rather than parsing source text in the viewer.
- Add explicit performance traces around layout, filtering, upload-to-GPU, and render frames, inspired by HPC profiling workflows.
