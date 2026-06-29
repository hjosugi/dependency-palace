# Native Adapter: C And C++

Labels: `adapter`, `c`, `cpp`

## Problem

C/C++ structure depends on translation units, headers, macros, templates, namespaces, and build flags. Accurate extraction needs compiler tooling.

## Candidate Backends

- `clangd` index.
- `libclang`.
- `compile_commands.json`.
- CMake/Bazel discovery.

## Required Extraction

- Translation units and headers.
- Namespaces.
- Classes, structs, enums, unions.
- Fields, methods, constructors, destructors.
- Inheritance.
- Includes.
- Function calls and object creation where available.
- Macro-generated symbol diagnostics.

## Acceptance Criteria

- Uses `compile_commands.json` when present.
- Falls back to header/source scan when compile DB is missing.
- Emits template names stably.
- Reports skipped translation units with reason.
