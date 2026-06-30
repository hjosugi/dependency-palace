# Native Adapter: C# / .NET

Labels: `adapter`, `csharp`, `dotnet`, `priority:P2`, `status:ready`

## Problem

C# projects need Roslyn-level semantic data for namespaces, assemblies, partial classes, generics, LINQ-heavy calls, interfaces, records, and attributes.

## Candidate Backends

- Roslyn analyzer executable.
- `dotnet` solution/project discovery.
- Optional NDepend export converter.

## Required Extraction

- Solutions, projects, assemblies, namespaces.
- Classes, interfaces, records, structs, enums.
- Fields, properties, methods, constructors.
- Base classes and implemented interfaces.
- Method calls, object creation, dependency injection constructor parameters.
- Test project classification.

## Acceptance Criteria

- Works on `.sln` and `.csproj`.
- Handles partial classes.
- Emits fully qualified type ids.
- Captures properties separately from fields.
- Links DI constructor dependencies as `uses` or `creates` with `via`.
