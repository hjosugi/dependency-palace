# Semantic Signal Panel Next Steps

Labels: `viewer`, `ux`, `semantic-model`, `priority:P1`, `status:ready`

## Problem

The Signal block gives the selected symbol a compact voice, but it is still derived from simple node kind, role, and edge counts.

## Goal

Make Signal explain why the code matters in a way that scales from Java classes to Haskell typeclasses and FP pipelines.

## Scope

- Add relation reason grouping.
- Distinguish contract pressure, state pressure, behavior pressure, and cycle pressure.
- Show top incoming/outgoing relation categories separately.
- Add Haskell-specific language:
  - typeclass law/contract
  - instance implementation
  - record data body
  - composition pipeline
- Add Java-specific language:
  - interface contract
  - field composition
  - inheritance chain
  - service/repository boundary

## Acceptance Criteria

- Selecting a Haskell datatype explains data body, deriving, instances, and record-field composition.
- Selecting a Haskell function explains composition and constraints.
- Selecting a Java service explains state, behavior, implemented contracts, and collaborators.
- Signal text remains compact and does not overflow on mobile.
