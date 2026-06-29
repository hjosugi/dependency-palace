# Roadmap: Native Source Adapters For Major Languages

Labels: `roadmap`, `adapters`, `source-indexing`, `performance`

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

- Java/JVM: Java first, then Kotlin/Scala.
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
2. Java/JVM adapter.
3. Rust adapter.
4. Go adapter.
5. TypeScript/JavaScript adapter.
6. Python adapter.
7. C# adapter.
8. C/C++ adapter.
9. Swift/Ruby/PHP/Kotlin/Scala completion.
10. Incremental indexing and cache.
