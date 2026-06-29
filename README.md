# Dependency Palace

Dependency Palace is an interactive 3D class-dependency viewer for codebases that are too dense for a flat UML diagram.

The app is built for thousands of classes:

- Package overview mode collapses classes into package nodes.
- Class mode renders every visible class as a GPU-instanced mesh.
- Focus mode expands the selected type into state, behavior, contracts, inheritance, callers, and callees.
- Edges are packed into a single WebGL line geometry.
- The layout is deterministic, clustered by module/package, and does not run a force simulation in the render loop.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL.

## Build

```bash
npm run build
```

## Scan Source Code

Point the scanner at a repository or subtree:

```bash
npm run scan -- /path/to/repo
npm run dev
```

By default this writes `public/dependency-palace.graph.json`, and the app loads it automatically on startup.

You can still write an explicit JSON file and upload it manually:

```bash
npm run scan -- /path/to/repo --out dependency-palace.graph.json
```

The first-pass scanner supports Java, Kotlin, Scala, C#, TypeScript, JavaScript, Go, Rust, Python, Ruby, PHP, Swift, C, and C++. See [docs/adapters.md](docs/adapters.md).

## Input Format

Load a JSON file from the left panel. The minimal shape is:

```json
{
  "nodes": [
    {
      "id": "orders.checkout.PaymentService",
      "label": "PaymentService",
      "module": "orders",
      "package": "orders.checkout",
      "kind": "class",
      "loc": 420,
      "complexity": 12,
      "layer": 2
    }
  ],
  "links": [
    {
      "source": "orders.checkout.PaymentService",
      "target": "billing.invoice.InvoiceRepository",
      "type": "uses",
      "weight": 1
    }
  ],
  "meta": {
    "name": "My service",
    "language": "Java"
  }
}
```

See [docs/input-schema.md](docs/input-schema.md) for the full schema notes.

## Design Notes

The mental model is in [docs/mental-model.md](docs/mental-model.md), the research target list is in [docs/research-targets.md](docs/research-targets.md), and the analysis notes are in [docs/research.md](docs/research.md). The short version:

- Borrow orientation from CodeCity: modules/packages act like districts.
- Borrow navigation from Sourcetrail and NDepend: search, hubs, caller/callee focus, and collapse/expand.
- Borrow rendering discipline from large WebGL graph tools: minimize draw calls and avoid per-node React/DOM elements.
- Avoid an always-on force simulation for the main view; large class graphs should stay stable and navigable.
- Avoid the hairball. The focus view must show state, behavior, contracts, and dependency reasons.

## Current Limits

This now includes a first-pass source scanner. The next step is compiler/tree-sitter/language-server native adapters for high-accuracy extraction. The issue plan is in [docs/issues](docs/issues).
