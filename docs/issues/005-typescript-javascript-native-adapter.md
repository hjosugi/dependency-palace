# Native Adapter: TypeScript And JavaScript

Labels: `adapter`, `typescript`, `javascript`, `high-priority`

## Problem

TS/JS projects need compiler-aware resolution for path aliases, type-only imports, interfaces, classes, object patterns, React components, and monorepo packages.

## Candidate Backends

- TypeScript Compiler API.
- `tsserver` project service.
- `dependency-cruiser` as module graph input.
- Babel parser fallback for JS.

## Required Extraction

- `tsconfig` discovery and path aliases.
- Classes, interfaces, enums, type aliases.
- Fields, methods, constructors, access modifiers.
- Extends and implements.
- Import/export graph.
- Method calls and constructor calls where the checker resolves symbols.
- React component nodes as optional module/type nodes.

## Acceptance Criteria

- Works on TS monorepos with project references.
- Preserves type-only vs runtime imports.
- Emits class/interface members with visibility.
- Links class implements/extends accurately.
- Handles JS projects with best-effort Babel fallback.
