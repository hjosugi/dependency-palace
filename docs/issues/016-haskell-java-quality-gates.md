# Haskell/Java Quality Gates

Labels: `haskell`, `java`, `adapters`, `testing`, `priority:P0`, `status:ready`

## Problem

Haskell and Java are the most important languages. They need quality gates beyond best-effort extraction so regressions are caught early.

## Goal

Create fixture-driven acceptance tests for Haskell and Java semantics.

## Scope

- Haskell fixture coverage:
  - modules/imports
  - `data`, `newtype`, records
  - typeclasses and superclass constraints
  - instances
  - deriving
  - top-level functions
  - function composition
- Java fixture coverage:
  - packages/imports
  - classes/interfaces/enums
  - extends/implements
  - fields and field composition
  - methods/constructors
  - best-effort call/create relations
- Snapshot expected `RawGraph` output.
- Add scanner tests that fail on missing key relations.

## Acceptance Criteria

- `npm test` or an equivalent script validates Haskell and Java fixtures.
- Each P0 relation type has at least one positive fixture assertion.
- Fixture failures print readable missing-node/missing-edge diagnostics.
- Docs identify known first-pass limitations separately from test failures.
