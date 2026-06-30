# Adapter Contract, Golden Fixtures, And Diagnostics

Labels: `adapters`, `testing`, `developer-experience`, `priority:P0`, `status:ready`

## Problem

Native adapters will become impossible to compare unless they share a strict contract, fixture format, and diagnostic output.

## Scope

- Define a stable `LanguageAdapter` interface.
- Add adapter diagnostics: files scanned, files skipped, symbols emitted, unresolved edges, warnings.
- Add golden fixtures for every supported language.
- Add snapshot tests that compare normalized graph output.
- Add schema validation for adapter output.

## Acceptance Criteria

- Every adapter can be run against a fixture directory.
- Snapshot output is deterministic.
- Diagnostics are printed in human-readable form and saved in machine-readable JSON.
- Invalid adapter output fails CI.
- Fixture coverage includes class/interface/field/method/inheritance/import/call examples.

## Notes

The first-pass implementation exists in `src/extract`. This issue should harden it before native adapters become numerous.
