# Native Adapter: Go

Labels: `adapter`, `go`, `high-priority`

## Problem

Go requires package-aware symbol resolution. Structs, interfaces, receiver methods, embedded fields, and module imports need `go/packages` or equivalent tooling.

## Candidate Backends

- `golang.org/x/tools/go/packages`.
- `go/types`.
- `go list` for module/package discovery.

## Required Extraction

- Modules and packages.
- Structs and interfaces.
- Fields, embedded fields, receiver methods.
- Interface satisfaction when inferable.
- Imports and package dependencies.
- Function/method calls with `via`.
- Constructor-like composite literals.

## Acceptance Criteria

- Works on Go modules and workspaces.
- Emits ids like `module/path/pkg.Type`.
- Captures receiver methods on the owning type.
- Links interface satisfaction or marks inferred confidence.
- Handles generated files according to config.
