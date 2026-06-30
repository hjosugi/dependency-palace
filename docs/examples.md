# Example Graphs

Dependency Palace includes generated example graphs under [public/examples](../public/examples).

They are intentionally varied: some are small enough to understand by inspection, while the larger ones are meant to test filtering, focus mode, edge density, and metaphor switching.

## Examples

| Example | Complexity | Nodes | Links | Recommended View | Purpose |
| --- | --- | ---: | ---: | --- | --- |
| Tiny Haskell Core | tiny | 18 | 40 | Focus / Atomic | Records, typeclasses, instances, deriving, and small FP pipelines. |
| Tiny Java Service | tiny | 24 | 72 | Focus / Blocks | Controller, service, repository, DTO, and interface contracts. |
| Small FP Pipeline | small | 64 | 152 | Focus / Space | Function composition, constraints, data bodies, and typeclass instances. |
| Small Clean Architecture | small | 96 | 387 | Focus / Tree | Ports, adapters, entities, use cases, and boundaries. |
| Medium Haskell Platform | medium | 180 | 601 | Focus / Atomic | Larger algebra/typeclass graph with validation and persistence pipelines. |
| Medium Polyglot Services | medium | 320 | 1,548 | Map / Palace | Mixed services, SDKs, adapters, contracts, workers, and DTOs. |
| Large Modular Monolith | large | 750 | 4,988 | Map / Blocks | Bounded contexts with dense service/repository/entity relationships. |
| Large FP Event System | large | 1,100 | 3,619 | Map / Space | Event-sourced FP system with algebras, interpreters, and composition. |
| XL Enterprise Platform | xlarge | 1,800 | 12,829 | Map / Palace | Large platform with cross-module contracts and hot hubs. |
| Stress Dense Cycles | stress | 2,600 | 24,285 | Map / Atomic | Dense cyclic dependency stress case for filtering, focus, and rendering. |

## Regenerate

```bash
npm run generate:examples
```

The generator is [scripts/generate-examples.mjs](../scripts/generate-examples.mjs).

Large examples keep the graph structure dense but trim per-node member payload for most nodes. That keeps thousands of nodes and many edges available without making every example load like a full source index.

It writes:

- `public/examples/index.json`
- one graph JSON file per example

The app loads the index automatically and shows the examples in the left panel.

Each example also carries a recommended starting view, form, focus depth, and degree filter. Loading an example should put the viewer into a useful first pose immediately.

The recommendations are intentionally opinionated:

- Haskell-local examples open in Atomic or Space so typeclasses, records, and composition remain close to the selected symbol.
- Java architecture examples open in Blocks or Tree so contracts, inheritance, and containment read as structure.
- Large and stress examples open in Map first so the package/module shape appears before individual class detail.

## Design Notes

- Haskell examples emphasize typeclasses, instances, constraints, deriving, `data` records, and function composition.
- Java examples emphasize interfaces, implementations, inheritance, field composition, controllers, services, repositories, and DTOs.
- Polyglot examples mix Java-like OO, Haskell-like FP, service adapters, worker nodes, SDK boundaries, and cross-module contracts.
- Large examples are not meant to be read node-by-node at first. They are for search, focus, package overview, edge filtering, and alternate 3D forms.
