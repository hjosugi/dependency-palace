# Real-World Corpus

Dependency Palace keeps third-party source outside the repository. The corpus script checks out upstream projects into `.dependency-palace/real-world`, scans selected subtrees, and writes generated graph artifacts under `artifacts/real-world`.

Run:

```bash
npm run scan:real-world
```

Run one target:

```bash
npm run scan:real-world -- haskell-text
npm run scan:real-world -- apache-commons-lang
```

## Targets

| ID | Source | License | Scanned subtree | Expected highlights |
| --- | --- | --- | --- | --- |
| `haskell-text` | `https://github.com/haskell/text` | BSD-2-Clause | `src` | Haskell modules, imports, datatypes, top-level functions, and source ranges. |
| `apache-commons-lang` | `https://github.com/apache/commons-lang` | Apache-2.0 | `src/main/java` | Java packages, classes, interfaces, fields, methods, inheritance, and composition hints. |

The Haskell source license is declared in `text.cabal` as BSD-2-Clause. The Apache Commons Lang repository carries Apache License 2.0 in `LICENSE.txt`.

Latest local verification:

| ID | Files | Nodes | Links |
| --- | ---: | ---: | ---: |
| `haskell-text` | 55 | 857 | 3,190 |
| `apache-commons-lang` | 238 | 564 | 3,090 |

## Outputs

Each target writes:

- `artifacts/real-world/<id>.graph.json`
- `artifacts/real-world/<id>.graph.dpg`
- `artifacts/real-world/<id>.diagnostics.json`

Load the JSON or `.dpg` graph from the app's File button, or copy one into `public/dependency-palace.graph.json` / `public/dependency-palace.graph.dpg` for automatic dev-server loading.

## Notes

- The script uses sparse checkouts where possible.
- Artifacts and checkouts are ignored by git.
- This corpus is for scanner/viewer behavior, not upstream correctness claims.
