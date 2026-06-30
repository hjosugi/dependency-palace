# Native Adapter: Rust

Labels: `adapter`, `rust`, `priority:P1`, `status:ready`

## Problem

Rust structure is shaped by modules, traits, impl blocks, macros, features, and crates. A first-pass parser can show structs/traits, but native accuracy needs Rust tooling.

## Candidate Backends

- `rust-analyzer` analysis data.
- `cargo metadata` for workspace/crate graph.
- `syn` based parser for source fallback.

## Required Extraction

- Crates, modules, files.
- Structs, enums, traits, trait aliases.
- Fields, associated functions, methods.
- `impl Trait for Type` as implements.
- Inherent impl methods.
- `use` imports and crate dependencies.
- Function calls where available.
- Macro expansion diagnostics or best-effort macro boundaries.

## Acceptance Criteria

- Works on Cargo workspaces.
- Emits stable ids like `crate::module::Type`.
- Links trait implementations correctly.
- Captures receiver methods and associated functions.
- Reports unresolved macro-generated symbols without crashing.
