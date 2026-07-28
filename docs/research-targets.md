<!-- i18n: language-switcher -->
[English](research-targets.md) | [日本語](research-targets.ja.md)

# Research Targets

Organises the subjects worth studying closely for this project, in a form that is easy to turn into implementation decisions.

## Evaluation criteria

- Scale: does it hold up from thousands to tens of thousands of nodes?
- Legibility: can it give a better overview of the whole than 2D UML?
- Explorability: how easy are search, focus, expand/collapse, and caller/callee navigation?
- Stability: do positions stay put between runs, so the user can build spatial memory?
- Implementation fit: is it easy to embed as a web app, and can it exploit the GPU?
- Data fit: does it handle class/package/module/edge type/cycle/metric comfortably?

## Primary Targets

| Subject | Kind | Why study it | What to look at | Ideas worth adopting |
| --- | --- | --- | --- | --- |
| [3d-force-graph](https://github.com/vasturiano/3d-force-graph) | 3D graph renderer | The most important Three.js-based 3D graph implementation. | Drawing strategy under high node counts, interaction, camera control, the limits of force layout. | Three.js/WebGL, orbit controls, raycast picking. |
| [react-force-graph](https://github.com/vasturiano/react-force-graph) | React graph renderer | The representative way to drive 3D/2D/VR/AR graphs from React. | The React integration API, node representation, labels, update cost. | A reference for API design. The renderer itself is controlled at a lower level. |
| [CodeCity](https://wettel.github.io/codecity.html) | 3D software visualization | The classic approach of showing classes and packages as a city. | How treating packages as districts and classes as buildings builds spatial memory. | Place modules/packages as stable "districts". |
| [CodeCity paper](https://dl.acm.org/doi/10.1145/1370175.1370188) | Paper | Confirms the design rationale for 3D software visualization. | How metrics are mapped to height, area, and colour. | Use LOC, complexity, and degree as visual attributes. |
| [Sourcetrail](https://github.com/CoatiSoftware/Sourcetrail) | Source explorer | Its idea of exploring a huge codebase through local context is close to ours. | Search-first, centring on the selected node, dependency neighbourhood. | Make focus mode and neighbourhood exploration the main path. |
| [NDepend dependency graph](https://www.ndepend.com/docs/visual-studio-dependency-graph) | Dependency analysis tool | Rich in practical features for visualising dependencies in large .NET code. | Expand/collapse, caller/callee, real-time search, cycle discovery. | Package overview, hub list, cycle/SCC metrics. |

## Secondary Targets

| Subject | Kind | Why study it | What to look at | Where it applies |
| --- | --- | --- | --- | --- |
| [dependency-cruiser](https://www.npmjs.com/package/dependency-cruiser) | JS/TS dependency extractor | A strong candidate as the source of JS/TS dependency extraction. | JSON export, rules, module/file graph. | A future TypeScript extractor candidate. |
| [Sigma.js](https://www.sigmajs.org/) | WebGL 2D graph renderer | To study WebGL design for drawing large graphs. | Draw-call reduction, label strategy, camera/LOD. | A reference for performance design rather than 3D. |
| [Cytoscape.js](https://js.cytoscape.org/) | Graph analysis/view library | Rich in graph algorithms and visualization APIs. | Layout, filter, style, analysis API. | A reference for some algorithms and interaction models. |
| [Gephi](https://gephi.org/) | Desktop graph analysis | Its UI for large-scale network analysis is mature. | Clustering, filters, metrics, layout exploration. | A reference for analysis UI and metric design. |
| [Graphology](https://graphology.github.io/) | Graph data structure | The foundation for graph algorithms in JS. | Graph data model, algorithm integration. | A candidate analysis foundation on the Web Worker side. |
| [Graphviz](https://graphviz.org/) | Graph layout engine | The reference point for dependency graph layout. | Hierarchical layout, edge routing, the DOT representation. | For 2D output and comparison. Not used directly in the 3D renderer. |
| [AWS Labs Palace](https://awslabs.github.io/palace/stable/) | 3D FEM/HPC simulator | Not a class dependency viewer, but a reference for large-scale 3D data processing and GPU/parallel design. | Mesh/field output, ParaView integration, GPU support, profiling discipline. | Narrow the render set in preprocessing, keep output formats separate, measure the GPU explicitly. |

## Source Code Extractor Candidates

| Language/environment | Candidates | Why study it | Information we want out |
| --- | --- | --- | --- |
| Java/Kotlin | JDT, IntelliJ PSI, bytecode analysis | We want class/interface/inheritance/call relations extracted accurately. | FQCN, package, imports, inherits, implements, uses, calls. |
| TypeScript | TypeScript Compiler API, dependency-cruiser | We want class-level information, not only module dependencies. | class, interface, imports, extends, implements, constructor usage. |
| C#/.NET | Roslyn, NDepend export | Large business codebases are a likely target. | namespace, type, method call, inheritance, assembly/module. |
| Python | ast, importlib metadata, pydeps | Its dynamic nature means we have to take this in stages. | module/class, imports, inheritance, best-effort call edges. |

## Subjects deferred for now

| Subject | Reason |
| --- | --- |
| General-purpose UML editors | Centred on the 2D UML drawing experience, which does not suit an overview of thousands of classes. |
| Viewers built entirely around force simulation | They look natural, but positions are hard to keep stable on a huge dependency graph. |
| DOM/SVG-centred graph renderers | Drawing cost climbs quickly at thousands of nodes and edges. |
| VR/AR graph viewers | Interesting, but the practical exploration experience on desktop web comes first. |
| The physics solver part of Palace | An electromagnetic FEM solver serves a different purpose from dependency graph visualization, so it is not adopted directly. |

## Conclusions to carry into the implementation

- The point of going 3D is not appearance; it is separating the module/package/class hierarchy spatially.
- The initial view is a package overview, not every class.
- Drawing every class stays possible, but search and focus are the primary way to narrow down.
- Layout is stable between runs, and force simulation stays an auxiliary exploration feature.
- WebGPU-first with a WebGL fallback. Nodes are instanced and edges are batched into buffers.
- Circular dependencies are detected as SCCs and made prominent through colour, size, and the detail pane.
- The extractor is separate from the viewer, normalising to JSON per language.
- Multiple 3D metaphors -- palace, tree, blocks, organism, universe, atom -- can be switched between as projections of the same semantic graph.
