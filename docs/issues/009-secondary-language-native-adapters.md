# Native Adapters: Kotlin, Scala, Swift, Ruby, PHP

Labels: `adapter`, `kotlin`, `scala`, `swift`, `ruby`, `php`

## Problem

These languages are important enough to support directly, but should come after the highest-priority adapters and shared contract are stable.

## Scope

- Kotlin: PSI or Kotlin compiler frontend, Gradle discovery.
- Scala: Metals or SemanticDB, sbt discovery.
- Swift: SourceKit/LSP, Swift Package Manager discovery.
- Ruby: Prism/Ripper plus Sorbet/RBS optional type data.
- PHP: PHP-Parser plus Composer discovery.

## Acceptance Criteria

- Each language has golden fixtures.
- Each adapter emits type/member/relation graph.
- Each adapter documents limitations.
- Scanner can combine these languages in polyglot repositories.
