# Source Adapters

Dependency Palace can now scan source trees directly and emit the viewer JSON.

## Quick Start

```bash
npm run scan -- /path/to/repo
npm run dev
```

By default, the scanner writes `public/dependency-palace.graph.json`. The app fetches that file on startup and opens it automatically.
The scanner also writes a diagnostics sidecar at
`public/dependency-palace.graph.json.diagnostics.json` unless
`--diagnostics-out` is provided.
The app polls both files in development, so `--watch` gives a scan-open-refresh loop without manual JSON uploads.

The scanner reads everything below the requested root. You can point it at a whole repository or a narrower subtree:

```bash
npm run scan -- ~/work/my-service/src/main --out my-service.graph.json --module-depth 2
```

Watch and compact output:

```bash
npm run scan -- ~/work/my-service --watch
npm run scan -- ~/work/my-service --format both
```

`--format both` writes JSON plus `public/dependency-palace.graph.dpg`, a compact string-table graph. JSON remains the portable baseline; `.dpg` is meant for large local graphs and can be loaded from the app's File button.

## Config

Copy [dependency-palace.config.example.json](../dependency-palace.config.example.json) to `dependency-palace.config.json`.

```json
{
  "include": ["**/*"],
  "exclude": ["generated", "fixtures", "migrations"],
  "moduleDepth": 1,
  "maxFileBytes": 1500000,
  "cache": true,
  "cacheDir": ".dependency-palace/cache",
  "watchIntervalMs": 1500
}
```

Options:

- `include`: optional glob-ish path patterns. Empty means all supported source files.
- `exclude`: path fragments or glob-ish patterns to skip.
- `moduleDepth`: how many path segments become the 3D module district.
- `maxFileBytes`: safety cap for huge generated files.
- `cache`: enable per-file extraction cache.
- `cacheDir`: cache location. The cache key includes adapter version, relative path, language, module depth, and content hash.
- `watchIntervalMs`: polling interval for `--watch`.
- `--diagnostics-out`: explicit diagnostics JSON destination.
- `--clear-cache`: delete cache before a scan.
- `--no-cache`: run without reading or writing cache.

## Supported First-Pass Adapters

The current scanner is intentionally lightweight and dependency-free. It is meant to make a repository visible immediately.

| Language | Extensions | Extracts now |
| --- | --- | --- |
| Java | `.java` | package, imports, classes, interfaces, enums, fields, methods, extends, implements |
| Haskell | `.hs`, `.lhs` | modules, imports, data/newtype/type, record fields, typeclasses, instances, top-level functions, function composition |
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

## Diagnostics And Quality Gates

Every scan writes machine-readable diagnostics with:

- files scanned and skipped;
- per-language file/node/link counts;
- emitted node and link totals;
- unresolved edge count;
- output paths and byte sizes;
- cache hits, misses, writes, and adapter contract version;
- total scan duration;
- adapter warnings.

The CLI also prints a short human-readable diagnostics line after each scan.

Run the fixture contract check with:

```bash
npm test
```

This scans [fixtures/polyglot](../fixtures/polyglot), validates the emitted graph
shape, checks diagnostics consistency, and asserts the P0 Haskell/Java semantic
relations: records, typeclasses, instances, FP composition, Java interfaces,
records, service fields, and implementation edges.

## Desired Native Adapter Behavior

Every native adapter should output the same normalized graph:

- Type nodes: class/interface/enum/struct/trait/protocol/module.
- Members: fields/properties and methods/constructors/functions.
- Relations: imports, inherits, implements, instance, contains, composes, constrains, derives, uses, calls, creates, tests.
- `via`: the member that caused the relation.
- `reason`: a short explanation extracted from source or symbol data.
- Stable ids: fully qualified names whenever the language can provide them.
- Incremental-friendly metadata: file path, package/module, symbol ranges, and content hash.

The viewer should not need to know whether data came from Java, Rust, Go, or Python.

## Compact Graph Benchmark

Run:

```bash
npm run benchmark:graph-format -- public/examples/stress-dense-cycles.json 5
```

On the checked-in stress graph, the compact file is about one third of the JSON size and decodes faster in the local benchmark. This benchmark is intentionally narrow: it measures graph parse/decode cost, not rendering or layout.
