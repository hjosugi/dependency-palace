# Native Adapter: Java/JVM

Labels: `adapter`, `java`, `jvm`, `high-priority`

## Problem

Java is a primary target for class-heavy enterprise codebases. Regex extraction is not enough for overloads, generics, annotations, nested classes, method calls, and cross-module symbols.

## Candidate Backends

- `javac` compiler APIs.
- Eclipse JDT.
- JavaParser for lightweight parsing.
- Bytecode fallback for dependency edges.
- Gradle/Maven project discovery.

## Required Extraction

- Packages, imports, static imports.
- Classes, interfaces, records, enums, annotations.
- Fields and methods with visibility, static, abstract, annotations.
- Extends and implements.
- Constructor calls and method calls.
- Field type references and parameter/return type references.
- Test-only dependencies.
- Source ranges for symbols.

## CLI UX

```bash
npm run scan -- ./my-java-repo --out graph.json
npm run scan -- ./service/src/main/java --out graph.json --module-depth 2
```

## Acceptance Criteria

- Works on plain source folders.
- Detects Maven and Gradle roots when present.
- Emits fully qualified class names.
- Links method call edges with `via`.
- Handles inner classes and records.
- Fixture coverage includes Spring-style service/repository/controller code.
