# Input Schema

Dependency Palace expects a JSON object with `nodes`, `links` or `edges`, and optional `meta`.

## Nodes

```ts
type Node = {
  id: string;
  label?: string;
  name?: string;
  module?: string;
  package?: string;
  namespace?: string;
  kind?: "class" | "interface" | "typeclass" | "datatype" | "function" | "enum" | "external";
  loc?: number;
  complexity?: number;
  layer?: number;
  fields?: CodeMember[];
  methods?: CodeMember[];
  members?: CodeMember[];
};

type CodeMember = {
  name: string;
  kind: "field" | "method" | "constructor" | "property";
  type?: string;
  visibility?: "public" | "protected" | "private" | "package" | "internal";
  static?: boolean;
  abstract?: boolean;
  signature?: string;
  calls?: string[];
  uses?: string[];
};
```

Notes:

- `id` must be globally unique. A fully qualified class name works well.
- `module` controls the large radial sectors.
- `package` or `namespace` controls local clustering.
- `layer` is optional. Use low numbers for core/domain code and higher numbers for API/UI edges.
- `fields`, `methods`, or `members` make focus view semantic instead of just structural.
- Unknown link endpoints are added as `external` nodes.

## Links

```ts
type Link = {
  source: string | { id: string };
  target: string | { id: string };
  type?:
    | "imports"
    | "inherits"
    | "implements"
    | "instance"
    | "contains"
    | "composes"
    | "constrains"
    | "derives"
    | "uses"
    | "calls"
    | "creates"
    | "tests"
    | "unknown";
  weight?: number;
  via?: string;
  reason?: string;
};
```

Direction is `source depends on target`.
Use `via` for the member that causes the dependency, and `reason` for a short extracted explanation.

Recommended mapping:

- `imports`: file or namespace import.
- `contains`: structural ownership or has-a composition, such as Java fields or Haskell record fields.
- `composes`: function/pipeline composition, especially FP chains such as Haskell `(.)`, `(>=>)`, `<$>`, or `<*>`.
- `constrains`: typeclass or generic constraints.
- `derives`: derived/generated behavior such as Haskell `deriving`.
- `instance`: typeclass/protocol/trait instance relation.
- `uses`: field, parameter, annotation, or generic type reference.
- `calls`: method call or constructor call.
- `creates`: direct construction.
- `inherits`: class inheritance.
- `implements`: interface implementation.
- `tests`: test-only dependency.

## Practical Export Strategy

Keep extraction language-specific and normalize afterward:

- Java/Kotlin: use compiler/JDT/PSI or a bytecode analyzer, then export fully qualified class names.
- TypeScript: dependency-cruiser can export module-level JSON; a class-level extractor can then enrich it with AST data.
- C#/.NET: Roslyn or NDepend-style data can be converted into the same `nodes` and `links` shape.

The viewer is deliberately schema-first so the analysis pipeline can evolve without changing the rendering layer.
