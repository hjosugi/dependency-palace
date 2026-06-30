# Mental Model

Dependency Palace should not be a 3D hairball. A dependency graph only says "A touches B"; it does not say what the code means.

The target image is the structure that appears in your head after you understand a codebase:

- Interfaces are contracts above or in front of implementations.
- Classes are bodies that hold state and behavior.
- Fields are owned state, close to the class that contains them.
- Methods are behavior ports, close to the class but facing collaborators.
- Inheritance is a vertical structural relation.
- Calls and creations are behavioral routes.
- Imports and type references are weaker knowledge routes.
- Packages and modules are districts, not just folders.
- Haskell typeclasses are contracts; instances are implementations of those contracts.
- Haskell `data`/`newtype`/records are data bodies with composition edges to field types.
- Functional composition is a visible pipeline, not just another call edge.

## Spatial Rules

Focus view should use a stable semantic layout:

| Code concept | 3D placement |
| --- | --- |
| Selected class | Center body |
| Fields/properties | Left/lower state cluster |
| Methods/constructors | Right/upper behavior cluster |
| Implemented interfaces | Above/front contract surfaces |
| Base classes | Below/back structural chain |
| Typeclass constraints | Above/front contract surfaces |
| Function composition | Curved behavior pipeline between functions |
| Outgoing dependencies | Right side |
| Incoming dependencies | Left side |
| Far context | Outer orbit |

## Visual Rules

| Concept | Shape |
| --- | --- |
| Package | Flat district block |
| Class | Solid body |
| Interface | Thin contract plane |
| Enum | Small facet tower |
| Field/property | Small state particle |
| Method/constructor | Small behavior disk |
| External type | Neutral polyhedron |

## Product Rule

The first useful screen should answer:

1. What is this type?
2. What state does it own?
3. What behavior does it expose?
4. What contract does it satisfy?
5. Who does it call or create?
6. Who depends on it?

If the view only answers "how many edges exist", it is not good enough.

The right panel's Signal block is the compact textual version of this. It gives the selected symbol a voice: contract surface, data body, behavior pipeline, boundary, adapter, or state holder, plus its local relation pressure.

Different metaphors are documented in [metaphors.md](metaphors.md). They are not skins; they are different projections of the same code understanding.
