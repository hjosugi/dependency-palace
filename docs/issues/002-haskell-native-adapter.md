# Native Adapter: Haskell

Labels: `adapter`, `haskell`, `functional-programming`, `priority:P0`, `status:ready`

## Problem

Haskell is a first-class target, not an afterthought. A normal OO dependency graph does not capture the important structure of Haskell code: typeclasses, instances, algebraic data types, record fields, constraints, top-level functions, and function composition pipelines.

## Goal

Build a native Haskell adapter that makes the code's mental model visible:

- `data`, `newtype`, and record fields as data bodies and composition edges.
- `class` declarations as contract/typeclass surfaces.
- `instance` declarations as implementation edges.
- Typeclass constraints as contract dependencies.
- Top-level functions as behavior nodes.
- `(.)`, `(>=>)`, `(<=<)`, `>>=`, `=<<`, `<$>`, `<*>` as composition edges.
- `deriving` clauses as generated behavior edges.

## Candidate Backends

- GHC API.
- Haskell Language Server / HIE files.
- `hiedb` for symbol and reference lookup.
- Cabal and Stack project discovery.
- Tree-sitter Haskell as fallback parser.

## Required Extraction

- Modules and imports, including qualified imports and aliases.
- Data/newtype/type declarations.
- Record fields and field types.
- Typeclasses and method signatures.
- Instances and target types.
- Deriving strategies and derived classes.
- Top-level functions and signatures.
- Typeclass constraints in signatures.
- Function composition and monadic/applicative pipelines.
- Source ranges for symbols.

## Acceptance Criteria

- Works on a plain `.hs` source tree.
- Works on Cabal and Stack projects.
- Emits stable ids such as `Module.Type`, `Module.function`, and `Module.Typeclass`.
- Captures record-field composition with `contains`.
- Captures typeclass instances with `instance`.
- Captures FP pipelines with `composes`.
- Distinguishes top-level functions from typeclass methods.
- Golden fixture includes records, typeclasses, instances, deriving, and `(>=>)` composition.

## Current First-Pass Status

The lightweight scanner already recognizes `.hs`/`.lhs`, modules, imports, `data`/`newtype`/`type`, typeclasses, record fields, top-level functions, deriving, constraints, and common composition operators. This issue is for compiler-grade accuracy.
