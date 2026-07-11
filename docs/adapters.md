<!-- i18n: language-switcher -->
[English](adapters.md) | [日本語](adapters.ja.md)

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
  "native": true,
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
- `native`: enable native tool/project probing. When a configured tool or project marker is unavailable, the scanner records the reason and uses the first-pass extractor.
- `watchIntervalMs`: polling interval for `--watch`.
- `--diagnostics-out`: explicit diagnostics JSON destination.
- `--clear-cache`: delete cache before a scan.
- `--no-cache`: run without reading or writing cache.
- `--no-native`: skip native probing and use first-pass adapters only.

## Adapter Contract

Every language adapter implements the same contract:

- stable adapter id and version;
- supported extensions and optional native backend declarations;
- async extraction returning `nodes`, `links`, warnings, and provenance;
- deterministic first-pass fallback when native tooling is missing or fails;
- validation before output is merged into the graph.

The scanner adds provenance to every emitted node and link:

```json
{
  "adapterId": "java-adapter",
  "adapterVersion": "native-adapter-v0.2.0",
  "language": "java",
  "backendId": "first-pass",
  "backendKind": "first-pass",
  "backendName": "First-pass structural parser",
  "path": "src/main/java/com/acme/OrderService.java",
  "confidence": "medium",
  "source": "fallback"
}
```

Cached extraction is also provenance-tagged with `"source": "cache"` on the second and later unchanged scans.

## Supported Adapters

The current scanner remains dependency-light and is meant to make a repository visible immediately. Native backend entries probe local ecosystem tools and project markers, collect availability/version diagnostics, and fall back to deterministic source extractors when a backend is unavailable or metadata-only.

| Language | Extensions | Extracts now |
| --- | --- | --- |
| Java | `.java` | package, imports, classes, interfaces, enums, fields, methods, extends, implements |
| Haskell | `.hs`, `.lhs` | modules, imports, data/newtype/type, record fields, typeclasses, instances, top-level functions, function composition |
| Kotlin | `.kt`, `.kts` | package, imports, classes, interfaces, objects, enum classes, constructor/type relations |
| Scala | `.scala` | package, imports, classes, traits, objects, enums, extends |
| C# | `.cs` | namespace, using, classes, interfaces, enums, structs, records, fields, methods, base types |
| TypeScript | `.ts`, `.tsx` | TypeScript Compiler API syntax parse, type-only/runtime imports, classes, interfaces, enums, type aliases, members, extends, implements, simple call/create edges |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` | TypeScript JavaScript parser, imports/requires where parseable, classes, methods, extends, simple call/create edges |
| Go | `.go` | `go.mod`-aware package ids, imports, structs, interfaces, fields, embedded fields, receiver methods |
| Rust | `.rs` | `Cargo.toml`-aware crate ids, `use`, structs, enums, traits, fields, trait methods, impl methods, trait implementation edges |
| Python | `.py` | Python `ast` when `python3` is available; imports, classes, base classes, dataclass-style fields, `self` fields, methods, best-effort dynamic call edges; regex fallback with syntax diagnostics |
| Ruby | `.rb` | require, classes, modules, superclass, instance fields, methods |
| PHP | `.php` | namespace, use, classes, interfaces, traits, enums, fields, methods |
| Swift | `.swift` | imports, classes, structs, protocols, enums |
| C/C++ | `.c`, `.h`, `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh`, `.hxx` | includes, structs/classes/enums, simple members, compile database/CMake marker diagnostics |

## Native Probe Model

Adapters can declare native backend candidates:

- `native`: compiler, AST, or ecosystem-native parser.
- `lsp`: language server or index-based metadata.
- `compiler-metadata`: project/compiler discovery used to guide future semantic extractors.

The runner probes markers such as `Cargo.toml`, `go.mod`, `tsconfig.json`, `pom.xml`, `compile_commands.json`, and matching tools such as `cargo`, `go`, `tsc`, `javac`, `dotnet`, `clang`, `swift`, `ruby`, and `php`. Marker probing searches polyglot subdirectories as well as the scan root. If markers or tools are missing, the scan continues and records the fallback reason in diagnostics, for example `project marker not found`, `required tool unavailable`, or `native metadata collected; graph extraction uses fallback parser`.

The shared runner lives in [src/extract/framework.ts](../src/extract/framework.ts). Adapter declarations and fallback extractors are in [src/extract/adapters.ts](../src/extract/adapters.ts). Native adapter implementation issues are tracked in [docs/issues](issues).

## Diagnostics And Quality Gates

Every scan writes machine-readable diagnostics with:

- files scanned and skipped;
- per-language file/node/link counts;
- per-language backend counts and warning counts;
- per-adapter aggregate counts, backend usage, and probed tool versions/errors;
- per-file adapter run records with cache/native/fallback status;
- emitted node and link totals;
- unresolved edge count;
- output paths and byte sizes;
- cache hits, misses, writes, and adapter contract version;
- native probing enabled state, native backend runs, and fallback runs;
- total scan duration;
- adapter warnings.

The CLI also prints a short human-readable diagnostics line after each scan.

Run the fixture contract check with:

```bash
npm test
```

This scans [fixtures/polyglot](../fixtures/polyglot), validates the emitted graph
shape, checks node/link provenance, runs the scan twice to verify cache reuse,
checks adapter diagnostics consistency, and asserts the P0 Haskell/Java semantic
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
