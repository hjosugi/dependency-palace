# Roadmap: Native Source Adapters For Major Languages

Labels: `roadmap`, `adapters`, `source-indexing`, `performance`, `priority:P0`, `status:ready`

## Problem

Dependency Palace needs to work like this:

```bash
npm install
npm run scan -- /path/to/repo --out graph.json
npm run dev
```

The user should only need to point at a repository root or a subtree. The tool should discover major languages, extract semantic code structure, normalize it, and make the 3D mental model available immediately.

The current first-pass scanner makes repositories visible, but it is not compiler-accurate.

## Goal

Build native adapters for all major ecosystems while keeping one normalized viewer schema.

## Scope

- Haskell and Java/JVM are P0.
- Haskell: typeclasses, instances, records, functions, FP composition.
- Java/JVM: inheritance, interface implementation, field composition, method call graph.
- Rust.
- Go.
- TypeScript/JavaScript.
- Python.
- C#/.NET.
- C/C++.
- Swift.
- Ruby.
- PHP.

## Architecture Requirements

- Each adapter implements the same adapter contract.
- Each adapter can run independently.
- Each adapter emits normalized `RawGraph`.
- Each adapter includes golden fixtures.
- Each adapter reports confidence and extraction limitations.
- The scanner can combine multiple adapters in one polyglot repository.
- Large repositories can be indexed incrementally.

## Acceptance Criteria

- `npm run scan -- fixtures/polyglot --out graph.json` produces valid JSON.
- A real repository can be scanned by pointing only at a root directory.
- Adapter output includes fields, methods, inheritance, interface implementation, and at least best-effort type references.
- Native adapter issues are individually actionable and ordered.

## Implementation Order

1. Adapter contract, fixtures, and diagnostics.
2. Haskell native adapter.
3. Java/JVM native adapter.
4. Rust adapter.
5. Go adapter.
6. TypeScript/JavaScript adapter.
7. Python adapter.
8. C# adapter.
9. C/C++ adapter.
10. Swift/Ruby/PHP/Kotlin/Scala completion.
11. Incremental indexing and cache.
