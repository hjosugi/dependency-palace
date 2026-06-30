# Real-World Example Corpus

Labels: `examples`, `fixtures`, `research`, `priority:P1`, `status:ready`

## Problem

Generated examples are useful for scale and predictable coverage, but real code has naming, layering, generated code, tests, build folders, and dependency weirdness that synthetic data misses.

## Goal

Build a curated real-world example corpus that exercises scanner and viewer behavior.

## Scope

- Add small open-source Haskell fixture repository or excerpt.
- Add small open-source Java fixture repository or excerpt.
- Add one polyglot service fixture.
- Keep fixtures license-compatible.
- Store either source excerpts or generated graph snapshots.
- Document how each fixture should look in the viewer.

## Acceptance Criteria

- At least one Haskell and one Java real-world fixture can be scanned locally.
- Fixture output is committed or reproducible by script.
- Docs list source/license and expected semantic highlights.
- Visual verification can load at least one real-world graph.
