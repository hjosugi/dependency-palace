# Visualization Metaphors

Dependency Palace supports multiple 3D metaphors because code understanding is not one shape.

The same graph can be projected into different forms:

| Form | Best For | Mapping |
| --- | --- | --- |
| Palace | Default semantic architecture view | selected type as body, state left, behavior right, contracts above, structure below |
| Tree | Inheritance, ownership, roots, branches | selected type as trunk, fields as roots, methods as branches, contracts as canopy |
| Blocks | System-building and module construction | selected type as central block, dependencies as surrounding blocks in a build grid |
| Life | Runtime organism / living system | selected type as nucleus, fields as inner state, methods as receptors, dependencies as vessels |
| Space | Large-scale orientation and orbit | selected type as star, fields/methods as planets, contracts and dependencies as orbital rings |
| Atomic | Fine-grained local structure | selected type as nucleus, members as electron shells, relations as bonds |

## Rule

Metaphors should not hide the semantic graph. They should reveal a different mental model:

- Tree emphasizes lineage and composition.
- Blocks emphasizes construction and containment.
- Life emphasizes state/behavior flow.
- Space emphasizes scale and orbiting context.
- Atomic emphasizes local internals and small-grain relations.

## Implementation

The canonical semantic layout is still the source of truth. Metaphors are transform passes over focus-layout nodes in [layout.ts](../src/graph/layout.ts).

This keeps interaction, picking, search, and relation filtering stable while letting the visual form change.

## Future Forms

These are deliberately kept as future projections, not separate data models:

- City: packages as districts, classes as buildings, metrics as height and footprint.
- Circuit: interfaces as sockets, calls as signal traces, adapters as boards.
- River: data flow and composition pipelines as streams.
- Constellation: architectural landmarks and hubs as named stars.
- Archive: modules as shelves, stable public APIs as spines, volatile internals as loose documents.
