# Source Adapters

Dependency Palace can now scan source trees directly and emit the viewer JSON.

## Quick Start

```bash
npm run scan -- /path/to/repo
npm run dev
```

By default, the scanner writes `public/dependency-palace.graph.json`. The app fetches that file on startup and opens it automatically.

The scanner reads everything below the requested root. You can point it at a whole repository or a narrower subtree:

```bash
npm run scan -- ~/work/my-service/src/main --out my-service.graph.json --module-depth 2
```

## Config

Copy [dependency-palace.config.example.json](../dependency-palace.config.example.json) to `dependency-palace.config.json`.

```json
{
  "include": ["**/*"],
  "exclude": ["generated", "fixtures", "migrations"],
  "moduleDepth": 1,
  "maxFileBytes": 1500000
}
```

Options:

- `include`: optional glob-ish path patterns. Empty means all supported source files.
- `exclude`: path fragments or glob-ish patterns to skip.
- `moduleDepth`: how many path segments become the 3D module district.
- `maxFileBytes`: safety cap for huge generated files.

## Supported First-Pass Adapters

The current scanner is intentionally lightweight and dependency-free. It is meant to make a repository visible immediately.

| Language | Extensions | Extracts now |
| --- | --- | --- |
| Java | `.java` | package, imports, classes, interfaces, enums, fields, methods, extends, implements |
| Kotlin | `.kt`, `.kts` | package, imports, classes, interfaces, objects, enum classes, constructor/type relations |
| Scala | `.scala` | package, imports, classes, traits, objects, enums, extends |
| C# | `.cs` | namespace, using, classes, interfaces, enums, structs, records, fields, methods, base types |
| TypeScript | `.ts`, `.tsx` | imports, classes, interfaces, enums, types, members, extends, implements |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` | imports/requires, classes, methods, extends |
| Go | `.go` | package, imports, structs, interfaces, fields, receiver methods |
| Rust | `.rs` | `use`, structs, enums, traits, fields, trait methods, impl methods |
| Python | `.py` | imports, classes, base classes, `self` fields, methods |
| Ruby | `.rb` | require, classes, modules, superclass, instance fields, methods |
| PHP | `.php` | namespace, use, classes, interfaces, traits, enums, fields, methods |
| Swift | `.swift` | imports, classes, structs, protocols, enums |
| C/C++ | `.c`, `.h`, `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh`, `.hxx` | includes, structs/classes/enums, simple members |

## Accuracy Model

There are two adapter levels:

1. First-pass adapter: fast text/structure extraction so every major language becomes visible immediately.
2. Native adapter: compiler, language-server, tree-sitter, or ecosystem-native analyzer with accurate symbols, call edges, generics, overloads, macro handling, and cross-file resolution.

The first-pass adapters are in [src/extract/adapters.ts](../src/extract/adapters.ts). Native adapter implementation issues are tracked in [docs/issues](issues).

## Desired Native Adapter Behavior

Every native adapter should output the same normalized graph:

- Type nodes: class/interface/enum/struct/trait/protocol/module.
- Members: fields/properties and methods/constructors/functions.
- Relations: imports, inherits, implements, uses, calls, creates, tests.
- `via`: the member that caused the relation.
- `reason`: a short explanation extracted from source or symbol data.
- Stable ids: fully qualified names whenever the language can provide them.
- Incremental-friendly metadata: file path, package/module, symbol ranges, and content hash.

The viewer should not need to know whether data came from Java, Rust, Go, or Python.
