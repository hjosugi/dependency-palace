# Native Adapter: Python

Labels: `adapter`, `python`, `priority:P2`, `status:ready`

## Problem

Python is dynamic. A useful adapter must combine AST structure with best-effort type information and avoid pretending dynamic calls are certain.

## Candidate Backends

- Python `ast`.
- LibCST for concrete syntax and metadata.
- Pyright or Jedi for type/symbol resolution.
- `pyproject.toml` discovery.

## Required Extraction

- Packages and modules.
- Classes and base classes.
- Methods, properties, dataclass fields, `self` assignments.
- Imports and relative imports.
- Best-effort calls and constructor calls.
- Confidence metadata for dynamic edges.

## Acceptance Criteria

- Works on plain Python package roots.
- Captures dataclasses and attrs/pydantic-style fields where possible.
- Emits confidence for unresolved dynamic edges.
- Does not crash on syntax/version mismatch; reports diagnostics.
