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

## Spatial Rules

Focus view should use a stable semantic layout:

| Code concept | 3D placement |
| --- | --- |
| Selected class | Center body |
| Fields/properties | Left/lower state cluster |
| Methods/constructors | Right/upper behavior cluster |
| Implemented interfaces | Above/front contract surfaces |
| Base classes | Below/back structural chain |
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
