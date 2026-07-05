import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type {
  AdapterProvenance,
  CodeMember,
  DependencyKind,
  ExtractContext,
  ExtractedFile,
  LanguageAdapter,
  NativeAdapterBackend,
  NodeKind,
  RawLink,
  RawNode,
  SourceFile,
  SourceLanguage,
  Visibility
} from "./types";
import {
  addLink,
  addNode,
  countLoc,
  createFileNode,
  extractBraceBody,
  extractMembersFromBraceBody,
  importTargets,
  moduleFromPath,
  packageFromPath,
  qualifiedName,
  simpleComplexity,
  simpleTypeName,
  sourceLocation,
  stripComments,
  visibilityFromLine
} from "./utils";

interface BraceLanguageOptions {
  id?: string;
  language: SourceLanguage;
  extensions: string[];
  nativeBackends?: NativeAdapterBackend[];
  namespacePatterns: RegExp[];
  importPatterns: RegExp[];
  typePattern: RegExp;
  kindMap: Record<string, NodeKind>;
  inheritance?: (match: RegExpMatchArray) => { inherits?: string[]; implements?: string[] };
}

const adapterVersion = "native-adapter-v0.2.0";

function languageAdapterId(language: SourceLanguage) {
  return `${language}-adapter`;
}

function fileProvenance(
  file: SourceFile,
  backendId: string,
  backendName: string,
  backendKind: AdapterProvenance["backendKind"],
  confidence: AdapterProvenance["confidence"],
  source: AdapterProvenance["source"],
  notes?: string[]
): AdapterProvenance {
  return {
    adapterId: languageAdapterId(file.language),
    adapterVersion,
    language: file.language,
    backendId,
    backendKind,
    backendName,
    path: file.relativePath,
    confidence,
    source,
    notes
  };
}

function nativeBackends(language: SourceLanguage): NativeAdapterBackend[] {
  const backendMap: Partial<Record<SourceLanguage, NativeAdapterBackend[]>> = {
    haskell: [
      {
        id: "ghc-api",
        name: "GHC API / HLS symbols",
        kind: "native",
        confidence: "high",
        tools: [{ name: "GHC", command: "ghc" }, { name: "Haskell Language Server", command: "haskell-language-server" }],
        markers: ["*.cabal", "stack.yaml", "hie.yaml"]
      }
    ],
    java: [
      {
        id: "javac",
        name: "javac compiler APIs",
        kind: "native",
        confidence: "high",
        tools: [{ name: "javac", command: "javac" }],
        markers: ["pom.xml", "build.gradle", "build.gradle.kts"]
      }
    ],
    rust: [
      {
        id: "rust-analyzer",
        name: "rust-analyzer / cargo metadata",
        kind: "lsp",
        confidence: "high",
        tools: [{ name: "cargo", command: "cargo" }, { name: "rust-analyzer", command: "rust-analyzer" }],
        markers: ["Cargo.toml"]
      }
    ],
    go: [
      {
        id: "go-packages",
        name: "go/packages / go list",
        kind: "native",
        confidence: "high",
        tools: [{ name: "go", command: "go" }],
        markers: ["go.mod", "go.work"]
      }
    ],
    typescript: [
      {
        id: "typescript-compiler-api",
        name: "TypeScript Compiler API",
        kind: "native",
        confidence: "medium",
        tools: [{ name: "tsc", command: "tsc" }],
        markers: ["tsconfig.json", "jsconfig.json", "package.json"]
      }
    ],
    javascript: [
      {
        id: "typescript-js-parser",
        name: "TypeScript JavaScript parser",
        kind: "native",
        confidence: "medium",
        tools: [{ name: "node", command: "node" }],
        markers: ["jsconfig.json", "package.json"]
      }
    ],
    python: [
      {
        id: "python-ast",
        name: "Python ast",
        kind: "native",
        confidence: "medium",
        tools: [{ name: "python3", command: "python3" }],
        markers: ["pyproject.toml", "setup.cfg", "setup.py"]
      }
    ],
    csharp: [
      {
        id: "roslyn",
        name: "Roslyn / dotnet",
        kind: "native",
        confidence: "high",
        tools: [{ name: "dotnet", command: "dotnet" }],
        markers: ["*.sln", "*.csproj"]
      }
    ],
    cpp: [
      {
        id: "clang",
        name: "clangd / compile_commands",
        kind: "native",
        confidence: "high",
        tools: [{ name: "clang++", command: "clang++" }],
        markers: ["compile_commands.json", "CMakeLists.txt"]
      }
    ],
    c: [
      {
        id: "clang-c",
        name: "clang / compile_commands",
        kind: "native",
        confidence: "high",
        tools: [{ name: "clang", command: "clang" }],
        markers: ["compile_commands.json", "CMakeLists.txt"]
      }
    ],
    kotlin: [
      {
        id: "kotlin-compiler",
        name: "Kotlin compiler frontend",
        kind: "native",
        confidence: "high",
        tools: [{ name: "kotlinc", command: "kotlinc" }],
        markers: ["build.gradle.kts", "settings.gradle.kts"]
      }
    ],
    scala: [
      {
        id: "semanticdb",
        name: "Metals / SemanticDB",
        kind: "native",
        confidence: "high",
        tools: [{ name: "scalac", command: "scalac" }],
        markers: ["build.sbt", "metals.sbt"]
      }
    ],
    swift: [
      {
        id: "sourcekit",
        name: "SourceKit",
        kind: "lsp",
        confidence: "high",
        tools: [{ name: "swift", command: "swift" }],
        markers: ["Package.swift"]
      }
    ],
    ruby: [
      {
        id: "ripper",
        name: "Ruby Ripper / Prism",
        kind: "native",
        confidence: "medium",
        tools: [{ name: "ruby", command: "ruby" }],
        markers: ["Gemfile", "*.gemspec"]
      }
    ],
    php: [
      {
        id: "php-parser",
        name: "PHP parser / Composer",
        kind: "native",
        confidence: "medium",
        tools: [{ name: "php", command: "php" }],
        markers: ["composer.json"]
      }
    ]
  };
  return backendMap[language] ?? [];
}

function splitTypeList(value: string | undefined) {
  return (value ?? "")
    .split(/[,|&]/)
    .map((item) => simpleTypeName(item.trim()))
    .filter(Boolean) as string[];
}

function typeWords(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .match(/\b[A-Z][A-Za-z0-9_'.]*/g)
        ?.map((item) => item.replace(/^:+|:+$/g, ""))
        .filter((item) => !["IO", "Maybe", "Either", "List", "String", "Int", "Integer", "Bool", "Double", "Float"].includes(item)) ?? []
    )
  );
}

function resolveImportedType(simpleName: string, imports: string[], namespace: string) {
  return imports.find((imported) => simpleTypeName(imported) === simpleName) ?? qualifiedName(namespace, simpleName);
}

function namespaceFor(file: SourceFile, patterns: RegExp[], fallbackDepth: number) {
  for (const pattern of patterns) {
    const match = file.text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/;$/u, "");
  }
  return packageFromPath(file.relativePath);
}

function inferModule(file: SourceFile, context: ExtractContext) {
  return moduleFromPath(file.relativePath, context.moduleDepth);
}

function braceLanguageAdapter(options: BraceLanguageOptions): LanguageAdapter {
  return {
    id: options.id ?? languageAdapterId(options.language),
    language: options.language,
    extensions: options.extensions,
    version: adapterVersion,
    level: "first-pass",
    nativeBackends: options.nativeBackends ?? nativeBackends(options.language),
    extract(file, context) {
      const text = stripComments(file.text);
      const namespace = namespaceFor(file, options.namespacePatterns, context.moduleDepth);
      const module = inferModule(file, context);
      const nodes: RawNode[] = [];
      const links: RawLink[] = [];
      const seenNodes = new Set<string>();
      const seenLinks = new Set<string>();
      const fileNode = createFileNode(file, context.moduleDepth);
      addNode(nodes, seenNodes, fileNode);

      const imports = importTargets(text, options.importPatterns);
      for (const target of imports) {
        addLink(links, seenLinks, fileNode.id, target, "imports", undefined, "file import");
      }

      for (const match of text.matchAll(options.typePattern)) {
        const rawKind = match[1];
        const name = match[2];
        if (!name) continue;
        const openIndex = text.indexOf("{", match.index ?? 0);
        const body = extractBraceBody(text, openIndex);
        const declarationEnd = openIndex >= 0 ? openIndex + body.length + 2 : (match.index ?? 0) + match[0].length;
        const members = extractMembersFromBraceBody(body);
        const fieldTypes = new Map(members.fields.map((field) => [field.name, field.type]).filter((entry): entry is [string, string] => Boolean(entry[1])));
        const id = qualifiedName(namespace, name);
        const kind = options.kindMap[rawKind] ?? "class";
        const node: RawNode = {
          id,
          label: name,
          module,
          package: namespace,
          kind,
          loc: countLoc(body || text),
          complexity: simpleComplexity(body || text),
          fields: members.fields,
          methods: members.methods,
          source: sourceLocation(file, match.index ?? 0, declarationEnd)
        };
        addNode(nodes, seenNodes, node);
        addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares type");

        const inheritance = options.inheritance?.(match);
        for (const target of inheritance?.inherits ?? []) {
          addLink(links, seenLinks, id, target, "inherits", undefined, "declared inheritance");
        }
        for (const target of inheritance?.implements ?? []) {
          addLink(links, seenLinks, id, target, "implements", undefined, "declared implementation");
        }

        for (const field of members.fields) {
          for (const targetType of typeWords(field.type)) {
            addLink(
              links,
              seenLinks,
              id,
              resolveImportedType(targetType, imports, namespace),
              "contains",
              field.name,
              "field composition"
            );
          }
        }

        for (const imported of imports) {
          const importedName = simpleTypeName(imported);
          if (!importedName) continue;
          if (body.includes(importedName)) {
            addLink(links, seenLinks, id, imported, "uses", importedName, "type reference in body");
          }
        }

        for (const creation of body.matchAll(/\bnew\s+([A-Z][A-Za-z0-9_$]*)\s*[<(]/g)) {
          addLink(links, seenLinks, id, resolveImportedType(creation[1], imports, namespace), "creates", creation[1], "constructor call");
        }
        for (const call of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
          const ownerType = fieldTypes.get(call[1]);
          if (ownerType) {
            addLink(links, seenLinks, id, resolveImportedType(simpleTypeName(ownerType) ?? ownerType, imports, namespace), "calls", `${call[1]}.${call[2]}`, "field method call");
          }
        }
      }

      return {
        nodes,
        links,
        provenance: fileProvenance(file, "first-pass", "deterministic structural scanner", "first-pass", "low", "fallback", [
          "Native backend metadata is exposed in diagnostics; extraction uses the deterministic source scanner unless a language adapter has a concrete parser."
        ])
      };
    }
  };
}

function stripHaskellComments(text: string) {
  return text.replace(/\{-[\s\S]*?-\}/g, " ").replace(/--.*$/gm, " ");
}

function extractHaskell(file: SourceFile, context: ExtractContext): ExtractedFile {
  const text = stripHaskellComments(file.text);
  const moduleName = text.match(/^\s*module\s+([A-Z][\w'.]*(?:\.[A-Z][\w'.]*)*)/m)?.[1] ?? packageFromPath(file.relativePath);
  const module = inferModule(file, context);
  const namespace = moduleName;
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];
  const seenNodes = new Set<string>();
  const seenLinks = new Set<string>();
  const fileNode = createFileNode(file, context.moduleDepth);
  addNode(nodes, seenNodes, { ...fileNode, package: namespace, module });

  const imports = importTargets(text, [
    /^\s*import\s+(?:qualified\s+)?([A-Z][\w'.]*(?:\.[A-Z][\w'.]*)*)/gm
  ]);
  for (const target of imports) addLink(links, seenLinks, fileNode.id, target, "imports", undefined, "haskell import");

  const signatures = new Map<string, string>();
  for (const sig of text.matchAll(/^([a-z_][\w']*)\s*::\s*(.+)$/gm)) {
    signatures.set(sig[1], sig[2].trim());
  }

  function addTypeRefs(sourceId: string, signature: string | undefined, via: string, reason: string) {
    for (const typeName of typeWords(signature)) {
      addLink(links, seenLinks, sourceId, resolveImportedType(typeName, imports, namespace), "uses", via, reason);
    }
  }

  function addConstraints(sourceId: string, signature: string | undefined, via: string) {
    const constraintMatch = signature?.match(/^(?:\(([^)]+)\)|([A-Z][\w'.]*\s+[a-z]))\s*=>/);
    const constraints = constraintMatch?.[1] ?? constraintMatch?.[2];
    for (const constraint of typeWords(constraints)) {
      addLink(links, seenLinks, sourceId, resolveImportedType(constraint, imports, namespace), "constrains", via, "typeclass constraint");
    }
  }

  function declarationSpan(start: number) {
    const leading = text.slice(start).match(/^\s*/)?.[0].length ?? 0;
    const declarationStart = start + leading;
    const currentLineEnd = text.indexOf("\n", declarationStart);
    const searchStart = currentLineEnd >= 0 ? currentLineEnd + 1 : declarationStart + 1;
    const next = text.slice(searchStart).search(/^(?:(?:data|newtype|type|class|instance)\b|[a-z_][\w']*\s*::)/m);
    return next >= 0 ? text.slice(declarationStart, searchStart + next) : text.slice(declarationStart);
  }

  for (const match of text.matchAll(/^\s*(data|newtype)\s+([A-Z][\w']*)\b([^\n=]*)(?:=\s*([^\n]+))?/gm)) {
    const rawKind = match[1];
    const name = match[2];
    const declaration = declarationSpan(match.index ?? 0);
    const body = declaration.split("=").slice(1).join("=").split(/\bderiving\b/)[0] ?? "";
    const fields: CodeMember[] = [];
    const recordBody = declaration.match(/\{([\s\S]*?)\}/)?.[1];
    if (recordBody) {
      for (const field of recordBody.matchAll(/(?:^|,)\s*([a-z_][\w']*)\s*::\s*([^,}]+)/g)) {
        fields.push({ name: field[1], kind: "field", type: field[2].trim(), visibility: "public" });
      }
    } else {
      typeWords(body)
        .filter((typeName) => typeName !== name)
        .forEach((typeName, index) => {
        fields.push({ name: `_${index + 1}`, kind: "field", type: typeName, visibility: "public" });
      });
    }
    const id = qualifiedName(namespace, name);
    const start = match.index ?? 0;
    const end = start + declaration.length;
    addNode(nodes, seenNodes, {
      id,
      label: name,
      module,
      package: namespace,
      kind: "datatype",
      loc: countLoc(declaration),
      complexity: simpleComplexity(declaration),
      fields,
      methods: [],
      source: sourceLocation(file, start, end)
    });
    addLink(links, seenLinks, fileNode.id, id, "contains", undefined, `declares ${rawKind}`);
    for (const field of fields) {
      for (const typeName of typeWords(field.type)) {
        addLink(links, seenLinks, id, resolveImportedType(typeName, imports, namespace), "contains", field.name, "record field composition");
      }
    }
    for (const derived of typeWords(declaration.match(/\bderiving\s+(?:stock\s+|newtype\s+|anyclass\s+)?(.+)$/m)?.[1])) {
      addLink(links, seenLinks, id, resolveImportedType(derived, imports, namespace), "derives", undefined, "deriving clause");
    }
  }

  for (const match of text.matchAll(/^\s*type\s+([A-Z][\w']*)\b[^\n=]*=\s*(.+)$/gm)) {
    const name = match[1];
    const id = qualifiedName(namespace, name);
    const start = match.index ?? 0;
    const aliased = match[2].trim();
    addNode(nodes, seenNodes, {
      id,
      label: name,
      module,
      package: namespace,
      kind: "datatype",
      loc: 1,
      complexity: 1,
      fields: [{ name: "alias", kind: "field", type: aliased, visibility: "public" }],
      methods: [],
      source: sourceLocation(file, start, start + match[0].length)
    });
    addLink(links, seenLinks, fileNode.id, id, "contains", undefined, "declares type alias");
    addTypeRefs(id, aliased, "alias", "type alias target");
  }

  for (const match of text.matchAll(/^\s*class\s+(.+?)\s+where\s*$/gm)) {
    const header = match[1].trim();
    const name = header.match(/([A-Z][\w']*)\s+(?:[a-z_]\w*)?$/)?.[1] ?? header.match(/([A-Z][\w']*)/)?.[1];
    if (!name) continue;
    const body = declarationSpan(match.index ?? 0);
    const methods = Array.from(body.matchAll(/^\s+([a-z_][\w']*)\s*::\s*(.+)$/gm)).map(
      (method): CodeMember => ({
        name: method[1],
        kind: "method",
        visibility: "public",
        abstract: true,
        signature: `${method[1]} :: ${method[2].trim()}`
      })
    );
    const id = qualifiedName(namespace, name);
    const start = match.index ?? 0;
    addNode(nodes, seenNodes, {
      id,
      label: name,
      module,
      package: namespace,
      kind: "typeclass",
      loc: countLoc(body),
      complexity: simpleComplexity(body),
      fields: [],
      methods,
      source: sourceLocation(file, start, start + body.length)
    });
    addLink(links, seenLinks, fileNode.id, id, "contains", undefined, "declares typeclass");
    const superclassPart = header.includes("=>") ? header.split("=>")[0] : undefined;
    for (const superclass of typeWords(superclassPart)) {
      if (superclass !== name) addLink(links, seenLinks, id, resolveImportedType(superclass, imports, namespace), "constrains", undefined, "superclass constraint");
    }
  }

  for (const match of text.matchAll(/^\s*instance\s+(.+?)\s+where\s*$/gm)) {
    const header = match[1].trim();
    const classAndType = header.match(/([A-Z][\w'.]*)\s+(.+)$/);
    if (!classAndType) continue;
    const className = simpleTypeName(classAndType[1]);
    const targetType = typeWords(classAndType[2])[0] ?? simpleTypeName(classAndType[2]);
    if (!className || !targetType) continue;
    addLink(
      links,
      seenLinks,
      resolveImportedType(targetType, imports, namespace),
      resolveImportedType(className, imports, namespace),
      "instance",
      undefined,
      "haskell typeclass instance"
    );
  }

  for (const [name, signature] of signatures) {
    const id = qualifiedName(namespace, name);
    const definition = text.match(new RegExp(`^\\s*${name}(?!\\s*::)\\b[^=\\n]*=\\s*(.+)$`, "m"))?.[1] ?? "";
    addNode(nodes, seenNodes, {
      id,
      label: name,
      module,
      package: namespace,
      kind: "function",
      loc: 1,
      complexity: simpleComplexity(definition),
      fields: [],
      methods: [{ name, kind: "method", visibility: "public", signature: `${name} :: ${signature}` }],
      source: sourceLocation(file, text.indexOf(`${name} ::`), text.indexOf(`${name} ::`) + `${name} :: ${signature}`.length)
    });
    addLink(links, seenLinks, fileNode.id, id, "contains", name, "declares top-level function");
    addTypeRefs(id, signature, name, "function signature type reference");
    addConstraints(id, signature, name);

    const composedNames = new Set<string>();
    for (const composition of definition.matchAll(/(?:\.|>=>|<=<|<\$>|<\*>|>>=|=<<)\s*([a-z_][\w']*)/g)) {
      composedNames.add(composition[1]);
    }
    for (const composition of definition.matchAll(/([a-z_][\w']*)\s*(?:\.|>=>|<=<|<\$>|<\*>|>>=|=<<)/g)) {
      composedNames.add(composition[1]);
    }
    for (const target of composedNames) {
      if (target !== name) addLink(links, seenLinks, id, qualifiedName(namespace, target), "composes", name, "function composition pipeline");
    }
  }

  return {
    nodes,
    links,
    provenance: fileProvenance(file, "first-pass-haskell", "Haskell structural scanner", "first-pass", "medium", "fallback", [
      "Recognizes modules, ADTs, records, typeclasses, instances, deriving clauses, constraints, and common FP composition operators."
    ])
  };
}

interface PythonAstClass {
  name: string;
  bases: string[];
  decorators: string[];
  lineno: number;
  end_lineno?: number;
  fields: Array<{ name: string; type?: string; line: number }>;
  methods: Array<{ name: string; signature: string; line: number; calls: string[] }>;
}

interface PythonAstResult {
  ok: boolean;
  imports: string[];
  classes: PythonAstClass[];
  error?: string;
  line?: number;
}

const pythonAstExtractor = String.raw`
import ast, json, sys
text = sys.stdin.read()
def unparse(node):
    try:
        return ast.unparse(node)
    except Exception:
        return ""
def target_name(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = target_name(node.value)
        return (base + "." if base else "") + node.attr
    return unparse(node)
try:
    tree = ast.parse(text)
except SyntaxError as exc:
    print(json.dumps({"ok": False, "error": exc.msg, "line": exc.lineno}))
    raise SystemExit(0)
imports = []
classes = []
for node in tree.body:
    if isinstance(node, ast.Import):
        imports.extend(alias.name for alias in node.names)
    elif isinstance(node, ast.ImportFrom):
        prefix = "." * node.level + (node.module or "")
        imports.append(prefix)
    elif isinstance(node, ast.ClassDef):
        fields = {}
        methods = []
        for item in node.body:
            if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                fields[item.target.id] = {"name": item.target.id, "type": unparse(item.annotation), "line": item.lineno}
            elif isinstance(item, ast.Assign):
                for target in item.targets:
                    if isinstance(target, ast.Name):
                        fields[target.id] = {"name": target.id, "line": target.lineno}
            elif isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                args = [arg.arg for arg in item.args.args]
                arg_types = {arg.arg: unparse(arg.annotation) for arg in item.args.args if getattr(arg, "annotation", None) is not None}
                calls = []
                for child in ast.walk(item):
                    if isinstance(child, ast.Assign):
                        for target in child.targets:
                            if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == "self":
                                inferred_type = target_name(child.value)
                                field_type = arg_types.get(inferred_type, "")
                                fields[target.attr] = {"name": target.attr, "type": field_type, "line": child.lineno}
                    elif isinstance(child, ast.AnnAssign):
                        target = child.target
                        if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == "self":
                            fields[target.attr] = {"name": target.attr, "type": unparse(child.annotation), "line": child.lineno}
                    elif isinstance(child, ast.Call):
                        name = target_name(child.func)
                        if name:
                            calls.append(name)
                methods.append({"name": item.name, "signature": f"def {item.name}({', '.join(args)})", "line": item.lineno, "calls": sorted(set(calls))})
        classes.append({
            "name": node.name,
            "bases": [unparse(base) for base in node.bases],
            "decorators": [unparse(decorator) for decorator in node.decorator_list],
            "lineno": node.lineno,
            "end_lineno": getattr(node, "end_lineno", node.lineno),
            "fields": list(fields.values()),
            "methods": methods
        })
print(json.dumps({"ok": True, "imports": sorted(set(imports)), "classes": classes}))
`;

function extractPython(file: SourceFile, context: ExtractContext): ExtractedFile {
  const text = file.text;
  const module = inferModule(file, context);
  const namespace = packageFromPath(file.relativePath);
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];
  const seenNodes = new Set<string>();
  const seenLinks = new Set<string>();
  const fileNode = createFileNode(file, context.moduleDepth);
  addNode(nodes, seenNodes, fileNode);

  const ast = spawnSync("python3", ["-c", pythonAstExtractor], {
    input: text,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024
  });
  const warnings = [];
  let parsed: PythonAstResult | undefined;
  if (ast.status === 0 && ast.stdout.trim()) {
    try {
      parsed = JSON.parse(ast.stdout) as PythonAstResult;
    } catch {
      warnings.push({
        path: file.relativePath,
        language: file.language,
        adapterId: languageAdapterId(file.language),
        backendId: "python-ast",
        message: "python3 ast backend returned non-JSON output; using regex fallback"
      });
    }
  } else {
    warnings.push({
      path: file.relativePath,
      language: file.language,
      adapterId: languageAdapterId(file.language),
      backendId: "python-ast",
      message: "python3 ast backend unavailable or failed; using regex fallback"
    });
  }

  if (parsed && !parsed.ok) {
    warnings.push({
      path: file.relativePath,
      language: file.language,
      adapterId: languageAdapterId(file.language),
      backendId: "python-ast",
      message: `python syntax error: ${parsed.error ?? "unknown syntax error"}`,
      line: parsed.line
    });
  }

  const imports = parsed?.ok
    ? parsed.imports.filter(Boolean)
    : importTargets(text, [/^\s*from\s+([\w.]+)\s+import\s+/gm, /^\s*import\s+([\w.]+)/gm]);
  for (const target of imports) addLink(links, seenLinks, fileNode.id, target, "imports", undefined, "python import");

  if (parsed?.ok) {
    for (const klass of parsed.classes) {
      const id = qualifiedName(namespace, klass.name);
      const body = text.split(/\r?\n/).slice(klass.lineno - 1, klass.end_lineno).join("\n");
      const fields = klass.fields.map((field): CodeMember => ({
        name: field.name,
        kind: klass.decorators.some((decorator) => /\b(dataclass|attrs\.define|pydantic\.dataclasses\.dataclass)\b/.test(decorator)) ? "property" : "field",
        type: field.type,
        visibility: field.name.startsWith("_") ? "private" : "public",
        source: { path: file.relativePath, startLine: field.line }
      }));
      const methods = klass.methods.map((method): CodeMember => ({
        name: method.name,
        kind: "method",
        visibility: method.name.startsWith("_") ? "private" : "public",
        signature: method.signature,
        calls: method.calls,
        source: { path: file.relativePath, startLine: method.line }
      }));
      addNode(nodes, seenNodes, {
        id,
        label: klass.name,
        module,
        package: namespace,
        kind: "class",
        loc: countLoc(body),
        complexity: simpleComplexity(body),
        fields,
        methods,
        source: { path: file.relativePath, startLine: klass.lineno, endLine: klass.end_lineno }
      });
      addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares class");
      for (const target of klass.bases.map((base) => simpleTypeName(base)).filter(Boolean) as string[]) {
        addLink(links, seenLinks, id, target, "inherits", undefined, "python base class");
      }
      const fieldTypeByName = new Map(fields.map((field) => [field.name, field.type]).filter((entry): entry is [string, string] => Boolean(entry[1])));
      for (const field of fields) {
        for (const typeName of typeWords(field.type)) {
          addLink(links, seenLinks, id, resolveImportedType(typeName, imports, namespace), "contains", field.name, "python field annotation");
        }
      }
      for (const method of klass.methods) {
        for (const call of method.calls) {
          const selfField = call.match(/^self\.([A-Za-z_]\w*)\./)?.[1];
          const targetType = selfField ? fieldTypeByName.get(selfField) : undefined;
          if (targetType) addLink(links, seenLinks, id, resolveImportedType(simpleTypeName(targetType) ?? targetType, imports, namespace), "calls", call, "best-effort dynamic call");
        }
      }
    }
  } else {
    const classPattern = /^class\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?:/gm;
    for (const match of text.matchAll(classPattern)) {
      const name = match[1];
      const start = match.index ?? 0;
      const next = text.slice(start + 1).search(/^class\s+[A-Za-z_]\w*/m);
      const body = next >= 0 ? text.slice(start, start + 1 + next) : text.slice(start);
      const methods: CodeMember[] = [];
      const fields = new Map<string, CodeMember>();

      for (const method of body.matchAll(/^\s+def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/gm)) {
        methods.push({ name: method[1], kind: "method", visibility: method[1].startsWith("_") ? "private" : "public", signature: `def ${method[1]}(${method[2]})` });
      }
      for (const field of body.matchAll(/\bself\.([A-Za-z_]\w*)\s*(?::\s*([A-Za-z_][\w.[\]]*))?\s*=/g)) {
        fields.set(field[1], { name: field[1], kind: "field", type: field[2], visibility: field[1].startsWith("_") ? "private" : "public" });
      }

      const id = qualifiedName(namespace, name);
      addNode(nodes, seenNodes, {
        id,
        label: name,
        module,
        package: namespace,
        kind: "class",
        loc: countLoc(body),
        complexity: simpleComplexity(body),
        fields: Array.from(fields.values()),
        methods,
        source: sourceLocation(file, start, start + body.length)
      });
      addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares class");
      for (const target of splitTypeList(match[2])) addLink(links, seenLinks, id, target, "inherits", undefined, "python base class");
      for (const imported of imports) {
        const importedName = simpleTypeName(imported);
        if (importedName && body.includes(importedName)) addLink(links, seenLinks, id, imported, "uses", importedName, "type/name reference");
      }
    }
  }

  return {
    nodes,
    links,
    warnings,
    provenance: fileProvenance(
      file,
      parsed?.ok ? "python-ast" : "python-regex-fallback",
      parsed?.ok ? "Python ast" : "Python regex fallback",
      parsed?.ok ? "native" : "first-pass",
      parsed?.ok ? "medium" : "low",
      parsed?.ok ? "native" : "fallback",
      parsed?.ok ? ["Used python3 ast for classes, bases, fields, methods, calls, and syntax diagnostics."] : ["python3 ast unavailable or invalid; used deterministic regex fallback."]
    )
  };
}

function modifierVisibility(node: ts.Node): Visibility {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)) return "private";
  if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ProtectedKeyword)) return "protected";
  if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PublicKeyword || modifier.kind === ts.SyntaxKind.ExportKeyword)) return "public";
  return "package";
}

function hasStaticModifier(node: ts.Node) {
  return ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword);
}

function extractTsJs(file: SourceFile, context: ExtractContext): ExtractedFile {
  const scriptKind =
    file.language === "javascript"
      ? file.relativePath.endsWith(".jsx")
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.JS
      : file.relativePath.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file.relativePath, file.text, ts.ScriptTarget.Latest, true, scriptKind);
  const namespace =
    source.statements
      .find((statement): statement is ts.ModuleDeclaration => ts.isModuleDeclaration(statement) && ts.isIdentifier(statement.name))
      ?.name.text ?? packageFromPath(file.relativePath);
  const module = inferModule(file, context);
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];
  const seenNodes = new Set<string>();
  const seenLinks = new Set<string>();
  const fileNode = createFileNode(file, context.moduleDepth);
  const importedBindings = new Map<string, { module: string; typeOnly: boolean }>();
  const localTypes = new Set<string>();

  addNode(nodes, seenNodes, fileNode);

  function nodeSource(node: ts.Node) {
    return sourceLocation(file, node.getStart(source), node.end);
  }

  function expressionName(expression: ts.ExpressionWithTypeArguments | ts.Expression | ts.TypeNode | undefined) {
    return expression ? simpleTypeName(expression.getText(source)) : undefined;
  }

  function resolveTsType(name: string | undefined) {
    if (!name) return undefined;
    const simple = simpleTypeName(name);
    if (!simple) return undefined;
    const imported = importedBindings.get(simple);
    if (imported) return `${imported.module}.${simple}`;
    if (localTypes.has(simple)) return qualifiedName(namespace, simple);
    return simple;
  }

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const target = statement.moduleSpecifier.text;
    const typeOnly = Boolean(statement.importClause?.isTypeOnly);
    addLink(links, seenLinks, fileNode.id, target, "imports", undefined, typeOnly ? "type-only import" : "runtime import");
    const importClause = statement.importClause;
    if (importClause?.name) importedBindings.set(importClause.name.text, { module: target, typeOnly });
    const bindings = importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) importedBindings.set(bindings.name.text, { module: target, typeOnly });
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) importedBindings.set(element.name.text, { module: target, typeOnly: typeOnly || element.isTypeOnly });
    }
  }

  for (const statement of source.statements) {
    if (
      (ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isEnumDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      statement.name
    ) {
      localTypes.add(statement.name.text);
    }
  }

  function addHeritage(ownerId: string, clauses: ts.NodeArray<ts.HeritageClause> | undefined) {
    for (const clause of clauses ?? []) {
      const kind = clause.token === ts.SyntaxKind.ExtendsKeyword ? "inherits" : "implements";
      for (const typeNode of clause.types) {
        const target = resolveTsType(expressionName(typeNode));
        if (target) addLink(links, seenLinks, ownerId, target, kind, undefined, `typescript ${kind}`);
      }
    }
  }

  function visitCalls(ownerId: string, methodName: string, root: ts.Node, fieldTypes: Map<string, string>) {
    function visit(node: ts.Node) {
      if (ts.isNewExpression(node)) {
        const target = resolveTsType(expressionName(node.expression));
        if (target) addLink(links, seenLinks, ownerId, target, "creates", methodName, "constructor call");
      } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const receiver = node.expression.expression.getText(source).replace(/^this\./u, "");
        const targetType = fieldTypes.get(receiver);
        if (targetType) {
          const target = resolveTsType(targetType);
          if (target) addLink(links, seenLinks, ownerId, target, "calls", `${receiver}.${node.expression.name.text}`, "field method call");
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(root);
  }

  for (const statement of source.statements) {
    if (ts.isClassDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const id = qualifiedName(namespace, name);
      const fields: CodeMember[] = [];
      const methods: CodeMember[] = [];
      const fieldTypes = new Map<string, string>();
      for (const member of statement.members) {
        const accessor = ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member);
        if ((ts.isPropertyDeclaration(member) || accessor) && member.name && ts.isIdentifier(member.name)) {
          const type = member.type?.getText(source);
          fields.push({ name: member.name.text, kind: accessor ? "property" : "field", type, visibility: modifierVisibility(member), static: hasStaticModifier(member), source: nodeSource(member) });
          if (type) fieldTypes.set(member.name.text, type);
        } else if ((ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) && member.name) {
          const nameText = ts.isConstructorDeclaration(member) ? "constructor" : member.name.getText(source);
          methods.push({
            name: nameText,
            kind: ts.isConstructorDeclaration(member) ? "constructor" : "method",
            visibility: modifierVisibility(member),
            static: hasStaticModifier(member),
            signature: member.getText(source).split("{")[0].replace(/\s+/g, " ").trim(),
            source: nodeSource(member)
          });
          addHeritage(id, undefined);
          if (member.body) visitCalls(id, nameText, member.body, fieldTypes);
          for (const parameter of member.parameters) {
            if (parameter.name && ts.isIdentifier(parameter.name) && parameter.type) {
              const target = resolveTsType(parameter.type.getText(source));
              if (target && ts.isConstructorDeclaration(member)) addLink(links, seenLinks, id, target, "contains", parameter.name.text, "constructor parameter dependency");
            }
          }
        }
      }
      addNode(nodes, seenNodes, {
        id,
        label: name,
        module,
        package: namespace,
        kind: "class",
        loc: countLoc(statement.getText(source)),
        complexity: simpleComplexity(statement.getText(source)),
        fields,
        methods,
        source: nodeSource(statement)
      });
      addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares class");
      addHeritage(id, statement.heritageClauses);
      for (const field of fields) {
        for (const typeName of typeWords(field.type)) {
          const target = resolveTsType(typeName);
          if (target) addLink(links, seenLinks, id, target, "contains", field.name, "field composition");
        }
      }
    } else if (ts.isInterfaceDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const id = qualifiedName(namespace, name);
      const methods: CodeMember[] = [];
      const fields: CodeMember[] = [];
      for (const member of statement.members) {
        if (ts.isMethodSignature(member) && member.name) methods.push({ name: member.name.getText(source), kind: "method", visibility: "public", abstract: true, signature: member.getText(source), source: nodeSource(member) });
        if (ts.isPropertySignature(member) && member.name) fields.push({ name: member.name.getText(source), kind: "property", type: member.type?.getText(source), visibility: "public", source: nodeSource(member) });
      }
      addNode(nodes, seenNodes, { id, label: name, module, package: namespace, kind: "interface", loc: countLoc(statement.getText(source)), complexity: 1, fields, methods, source: nodeSource(statement) });
      addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares interface");
      addHeritage(id, statement.heritageClauses);
    } else if (ts.isEnumDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const id = qualifiedName(namespace, name);
      addNode(nodes, seenNodes, { id, label: name, module, package: namespace, kind: "enum", loc: countLoc(statement.getText(source)), complexity: 1, fields: [], methods: [], source: nodeSource(statement) });
      addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares enum");
    } else if (ts.isTypeAliasDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      const id = qualifiedName(namespace, name);
      addNode(nodes, seenNodes, {
        id,
        label: name,
        module,
        package: namespace,
        kind: "datatype",
        loc: countLoc(statement.getText(source)),
        complexity: 1,
        fields: [{ name: "alias", kind: "property", type: statement.type.getText(source), visibility: "public" }],
        methods: [],
        source: nodeSource(statement)
      });
      addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares type alias");
    }
  }

  return {
    nodes,
    links,
    warnings: ((source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []).map((diagnostic) => ({
      path: file.relativePath,
      language: file.language,
      adapterId: languageAdapterId(file.language),
      backendId: file.language === "javascript" ? "typescript-js-parser" : "typescript-compiler-api",
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
      line: diagnostic.start === undefined ? undefined : source.getLineAndCharacterOfPosition(diagnostic.start).line + 1
    })),
    provenance: fileProvenance(
      file,
      file.language === "javascript" ? "typescript-js-parser" : "typescript-compiler-api",
      file.language === "javascript" ? "TypeScript JavaScript parser" : "TypeScript Compiler API",
      "native",
      "medium",
      "native",
      ["Parsed syntax with the TypeScript Compiler API; symbol resolution is best-effort without a checker program."]
    )
  };
}

function findNearestUpward(startFile: string, marker: string, stopAt: string) {
  let current = path.dirname(startFile);
  const stop = path.resolve(stopAt);
  while (current.startsWith(stop)) {
    const candidate = path.join(current, marker);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return undefined;
}

function goNamespace(file: SourceFile, root: string, packageName: string) {
  const goMod = findNearestUpward(file.absolutePath, "go.mod", root);
  if (!goMod) return packageName;
  const modulePath = readFileSync(goMod, "utf8").match(/^\s*module\s+(\S+)/m)?.[1];
  if (!modulePath) return packageName;
  const relativeDirectory = path.relative(path.dirname(goMod), path.dirname(file.absolutePath)).replaceAll("\\", "/");
  return relativeDirectory && relativeDirectory !== "." ? `${modulePath}/${relativeDirectory}` : modulePath;
}

function rustNamespace(file: SourceFile, root: string) {
  const cargo = findNearestUpward(file.absolutePath, "Cargo.toml", root);
  const crateName = cargo
    ? readFileSync(cargo, "utf8")
        .match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1]
        ?.replace(/-/g, "_")
    : undefined;
  const base = crateName ?? "crate";
  const stem = path.basename(file.relativePath, path.extname(file.relativePath));
  const directoryParts = path.dirname(file.relativePath).split(/[\\/]/).filter((part) => part && part !== "." && !["src"].includes(part));
  const moduleParts = stem === "lib" || stem === "main" || stem === "mod" ? directoryParts : [...directoryParts, stem];
  return [base, ...moduleParts].filter(Boolean).join("::");
}

function rustQualified(namespace: string, name: string) {
  return namespace ? `${namespace}::${name}` : name;
}

function extractGo(file: SourceFile, context: ExtractContext): ExtractedFile {
  const text = stripComments(file.text);
  const packageName = text.match(/^package\s+([A-Za-z_]\w*)/m)?.[1] ?? packageFromPath(file.relativePath);
  const namespace = goNamespace(file, context.root, packageName);
  const module = inferModule(file, context);
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];
  const seenNodes = new Set<string>();
  const seenLinks = new Set<string>();
  const fileNode = createFileNode(file, context.moduleDepth);
  addNode(nodes, seenNodes, fileNode);

  const imports = importTargets(text, [/^\s*import\s+"([^"]+)"/gm, /"([^"]+)"/g]);
  for (const target of imports) addLink(links, seenLinks, fileNode.id, target, "imports", undefined, "go import");

  const nodeByName = new Map<string, RawNode>();
  for (const match of text.matchAll(/\btype\s+([A-Za-z_]\w*)\s+(struct|interface)\s*\{/g)) {
    const name = match[1];
    const kind = match[2] === "interface" ? "interface" : "class";
    const body = extractBraceBody(text, text.indexOf("{", match.index ?? 0));
    const fields: CodeMember[] = [];
    const methods: CodeMember[] = [];
    for (const line of body.split(/\r?\n/).map((item) => item.trim())) {
      const embedded = line.match(/^(\*?(?:[A-Za-z_]\w*\.)?[A-Za-z_]\w*)$/);
      if (embedded && kind === "class") {
        fields.push({ name: simpleTypeName(embedded[1]) ?? embedded[1], kind: "field", type: embedded[1], visibility: "public" });
      }
      const field = line.match(/^([A-Za-z_]\w*)\s+([\w.[\]*]+)/);
      if (field) fields.push({ name: field[1], kind: "field", type: field[2], visibility: /^[A-Z]/.test(field[1]) ? "public" : "private" });
      const method = line.match(/^([A-Za-z_]\w*)\s*\(([^)]*)\)/);
      if (method) methods.push({ name: method[1], kind: "method", visibility: /^[A-Z]/.test(method[1]) ? "public" : "private", signature: line });
    }
    const node: RawNode = {
      id: `${namespace}.${name}`,
      label: name,
      module,
      package: namespace,
      kind,
      loc: countLoc(body),
      complexity: simpleComplexity(body),
      fields,
      methods,
      source: sourceLocation(file, match.index ?? 0, (match.index ?? 0) + match[0].length + body.length)
    };
    nodeByName.set(name, node);
    addNode(nodes, seenNodes, node);
    addLink(links, seenLinks, fileNode.id, node.id, "uses", undefined, "declares go type");
    for (const field of fields) {
      if (!field.type) continue;
      const targetType = simpleTypeName(field.type);
      if (targetType && /^[A-Z]/.test(targetType)) addLink(links, seenLinks, node.id, `${namespace}.${targetType}`, "contains", field.name, "go struct field composition");
    }
  }

  for (const match of text.matchAll(/\bfunc\s+\(\s*\w+\s+\*?([A-Za-z_]\w*)\s*\)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g)) {
    const ownerName = match[1];
    const methodName = match[2];
    const params = match[3];
    const owner = nodeByName.get(ownerName);
    if (!owner) continue;
    const methods = owner.methods ?? [];
    methods.push({ name: methodName, kind: "method", visibility: /^[A-Z]/.test(methodName) ? "public" : "private", signature: `func (${ownerName}) ${methodName}(${params})` });
    owner.methods = methods;
  }

  for (const node of nodeByName.values()) {
    const haystack = text;
    for (const imported of imports) {
      const importedName = simpleTypeName(imported);
      if (importedName && haystack.includes(importedName)) addLink(links, seenLinks, node.id, imported, "uses", importedName, "package reference");
    }
  }

  return {
    nodes,
    links,
    provenance: fileProvenance(file, "go-source-fallback", "Go source scanner", "first-pass", "medium", "fallback", [
      "Uses go.mod for stable package ids when present; receiver methods are attached by source scan without go/packages type checking."
    ])
  };
}

function extractRust(file: SourceFile, context: ExtractContext): ExtractedFile {
  const text = stripComments(file.text);
  const namespace = rustNamespace(file, context.root);
  const module = inferModule(file, context);
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];
  const seenNodes = new Set<string>();
  const seenLinks = new Set<string>();
  const fileNode = createFileNode(file, context.moduleDepth);
  addNode(nodes, seenNodes, fileNode);

  const imports = importTargets(text, [/^\s*use\s+([^;]+);/gm]);
  for (const target of imports) addLink(links, seenLinks, fileNode.id, target, "imports", undefined, "rust use");

  const nodeByName = new Map<string, RawNode>();
  for (const match of text.matchAll(/\b(pub\s+)?(struct|enum|trait)\s+([A-Za-z_]\w*)/g)) {
    const rawKind = match[2];
    const name = match[3];
    const openIndex = text.indexOf("{", match.index ?? 0);
    const body = extractBraceBody(text, openIndex);
    const fields: CodeMember[] = [];
    const methods: CodeMember[] = [];
    if (rawKind === "struct") {
      for (const field of body.matchAll(/(?:pub\s+)?([A-Za-z_]\w*)\s*:\s*([^,\n]+)/g)) {
        fields.push({ name: field[1], kind: "field", type: field[2].trim(), visibility: field[0].includes("pub") ? "public" : "private" });
      }
    }
    if (rawKind === "trait") {
      for (const method of body.matchAll(/\bfn\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g)) {
        methods.push({ name: method[1], kind: "method", visibility: "public", abstract: true, signature: `fn ${method[1]}(${method[2]})` });
      }
    }
    const node: RawNode = {
      id: rustQualified(namespace, name),
      label: name,
      module,
      package: namespace,
      kind: rawKind === "trait" ? "interface" : rawKind === "enum" ? "enum" : "class",
      loc: countLoc(body || text),
      complexity: simpleComplexity(body || text),
      fields,
      methods,
      source: sourceLocation(file, match.index ?? 0, openIndex >= 0 ? openIndex + body.length + 2 : (match.index ?? 0) + match[0].length)
    };
    nodeByName.set(name, node);
    addNode(nodes, seenNodes, node);
    addLink(links, seenLinks, fileNode.id, node.id, "uses", undefined, "declares rust item");
    for (const field of fields) {
      if (!field.type) continue;
      const targetType = simpleTypeName(field.type);
      if (targetType && /^[A-Z]/.test(targetType)) addLink(links, seenLinks, node.id, rustQualified(namespace, targetType), "contains", field.name, "rust struct field composition");
    }
  }

  for (const impl of text.matchAll(/\bimpl(?:\s*<[^>]+>)?\s+(?:(\w+)\s+for\s+)?([A-Za-z_]\w*)\s*\{/g)) {
    const trait = impl[1];
    const ownerName = impl[2];
    const owner = nodeByName.get(ownerName);
    const body = extractBraceBody(text, text.indexOf("{", impl.index ?? 0));
    if (owner) {
      owner.methods = [
        ...(owner.methods ?? []),
        ...Array.from(body.matchAll(/\bfn\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g)).map((method): CodeMember => ({
          name: method[1],
          kind: "method",
          visibility: method[0].includes("pub") ? "public" : "private",
          signature: `fn ${method[1]}(${method[2]})`
        }))
      ];
      if (trait) addLink(links, seenLinks, owner.id, rustQualified(namespace, trait), "implements", undefined, "rust impl trait");
    }
  }

  return {
    nodes,
    links,
    provenance: fileProvenance(file, "rust-source-fallback", "Rust source scanner", "first-pass", "medium", "fallback", [
      "Uses Cargo.toml for crate ids when present; macro expansion and full name resolution require rust-analyzer."
    ])
  };
}

function extractRuby(file: SourceFile, context: ExtractContext): ExtractedFile {
  const text = file.text;
  const namespace = packageFromPath(file.relativePath);
  const module = inferModule(file, context);
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];
  const seenNodes = new Set<string>();
  const seenLinks = new Set<string>();
  const fileNode = createFileNode(file, context.moduleDepth);
  addNode(nodes, seenNodes, fileNode);

  const imports = importTargets(text, [/^\s*require(?:_relative)?\s+["']([^"']+)["']/gm]);
  for (const target of imports) addLink(links, seenLinks, fileNode.id, target, "imports", undefined, "ruby require");

  for (const match of text.matchAll(/^\s*(class|module)\s+([A-Z]\w*(?:::[A-Z]\w*)*)(?:\s*<\s*([A-Z]\w*(?:::[A-Z]\w*)*))?/gm)) {
    const rawKind = match[1];
    const name = match[2].split("::").at(-1) ?? match[2];
    const start = match.index ?? 0;
    const next = text.slice(start + 1).search(/^\s*(class|module)\s+[A-Z]/m);
    const body = next >= 0 ? text.slice(start, start + 1 + next) : text.slice(start);
    const methods = Array.from(body.matchAll(/^\s*def\s+(?:self\.)?([A-Za-z_]\w*[!?=]?)/gm)).map((method): CodeMember => ({
      name: method[1],
      kind: "method",
      visibility: "public"
    }));
    const fields = Array.from(new Set(Array.from(body.matchAll(/@([A-Za-z_]\w*)/g)).map((field) => field[1]))).map(
      (name): CodeMember => ({ name, kind: "field", visibility: "private" })
    );
    const id = qualifiedName(namespace, name);
    addNode(nodes, seenNodes, {
      id,
      label: name,
      module,
      package: namespace,
      kind: rawKind === "module" ? "interface" : "class",
      loc: countLoc(body),
      complexity: simpleComplexity(body),
      fields,
      methods,
      source: sourceLocation(file, start, start + body.length)
    });
    addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares ruby constant");
    if (match[3]) addLink(links, seenLinks, id, match[3], "inherits", undefined, "ruby superclass");
  }

  return {
    nodes,
    links,
    provenance: fileProvenance(file, "ruby-source-fallback", "Ruby source scanner", "first-pass", "low", "fallback", [
      "Captures require, classes/modules, superclass, instance variables, and methods; Sorbet/RBS resolution is not invoked."
    ])
  };
}

function extractPhp(file: SourceFile, context: ExtractContext): ExtractedFile {
  return braceLanguageAdapter({
    id: "php-first-pass",
    language: "php",
    extensions: [".php"],
    nativeBackends: nativeBackendsByLanguage.php,
    namespacePatterns: [/^\s*namespace\s+([^;]+);/m],
    importPatterns: [/^\s*use\s+([^;]+);/gm],
    typePattern: /\b(class|interface|trait|enum)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", interface: "interface", trait: "interface", enum: "enum" },
    inheritance(match) {
      const header = match[0];
      return {
        inherits: splitTypeList(header.match(/\bextends\s+([A-Za-z_\\][\w\\]*)/)?.[1]),
        implements: splitTypeList(header.match(/\bimplements\s+([^{]+)/)?.[1])
      };
    }
  }).extract(file, context) as ExtractedFile;
}

const nativeBackendsByLanguage: Partial<Record<SourceLanguage, NativeAdapterBackend[]>> = {
  haskell: [
    {
      id: "ghc-metadata",
      name: "GHC / Haskell project metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["*.cabal", "stack.yaml", "hie.yaml"],
      tools: [{ name: "ghc", command: "ghc", args: ["--version"] }]
    }
  ],
  java: [
    {
      id: "javac-project-metadata",
      name: "javac project metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"],
      tools: [{ name: "javac", command: "javac", args: ["-version"] }]
    }
  ],
  rust: [
    {
      id: "cargo-metadata",
      name: "cargo metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["Cargo.toml"],
      tools: [{ name: "cargo", command: "cargo", args: ["--version"] }]
    }
  ],
  go: [
    {
      id: "go-list-metadata",
      name: "go list metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["go.mod", "go.work"],
      tools: [{ name: "go", command: "go", args: ["version"] }]
    }
  ],
  typescript: [
    {
      id: "typescript-compiler-metadata",
      name: "TypeScript compiler metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["tsconfig.json", "jsconfig.json"],
      tools: [{ name: "tsc", command: "tsc", args: ["--version"] }]
    }
  ],
  javascript: [
    {
      id: "node-module-metadata",
      name: "Node.js module metadata",
      kind: "compiler-metadata",
      confidence: "medium",
      markers: ["package.json", "jsconfig.json"],
      tools: [{ name: "node", command: "node", args: ["--version"] }]
    }
  ],
  python: [
    {
      id: "python-ast-metadata",
      name: "Python AST metadata",
      kind: "compiler-metadata",
      confidence: "medium",
      markers: ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt"],
      tools: [{ name: "python3", command: "python3", args: ["--version"] }]
    }
  ],
  csharp: [
    {
      id: "dotnet-roslyn-metadata",
      name: ".NET Roslyn metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["*.sln", "*.csproj", "global.json", "Directory.Build.props", "Directory.Packages.props"],
      tools: [{ name: "dotnet", command: "dotnet", args: ["--version"] }]
    }
  ],
  cpp: [
    {
      id: "clang-compile-commands",
      name: "clang compile commands metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["compile_commands.json", "CMakeLists.txt"],
      tools: [{ name: "clang", command: "clang", args: ["--version"] }]
    }
  ],
  c: [
    {
      id: "clang-c-metadata",
      name: "clang C metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["compile_commands.json", "CMakeLists.txt"],
      tools: [{ name: "clang", command: "clang", args: ["--version"] }]
    }
  ],
  kotlin: [
    {
      id: "kotlin-gradle-metadata",
      name: "Kotlin Gradle metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["build.gradle.kts", "settings.gradle.kts"],
      tools: [{ name: "gradle", command: "gradle", args: ["--version"] }]
    }
  ],
  scala: [
    {
      id: "scala-sbt-metadata",
      name: "Scala sbt metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["build.sbt"],
      tools: [{ name: "sbt", command: "sbt", args: ["--version"] }]
    }
  ],
  swift: [
    {
      id: "swiftpm-metadata",
      name: "Swift Package Manager metadata",
      kind: "compiler-metadata",
      confidence: "high",
      markers: ["Package.swift"],
      tools: [{ name: "swift", command: "swift", args: ["--version"] }]
    }
  ],
  ruby: [
    {
      id: "ruby-parser-metadata",
      name: "Ruby parser metadata",
      kind: "compiler-metadata",
      confidence: "medium",
      markers: ["Gemfile", ".ruby-version"],
      tools: [{ name: "ruby", command: "ruby", args: ["--version"] }]
    }
  ],
  php: [
    {
      id: "php-parser-metadata",
      name: "PHP parser metadata",
      kind: "compiler-metadata",
      confidence: "medium",
      markers: ["composer.json"],
      tools: [{ name: "php", command: "php", args: ["--version"] }]
    }
  ]
};

const adapters: LanguageAdapter[] = [
  {
    id: "haskell-first-pass",
    language: "haskell",
    extensions: [".hs", ".lhs"],
    version: adapterVersion,
    level: "first-pass",
    nativeBackends: nativeBackendsByLanguage.haskell,
    extract: extractHaskell
  },
  braceLanguageAdapter({
    id: "java-first-pass",
    language: "java",
    extensions: [".java"],
    nativeBackends: nativeBackendsByLanguage.java,
    namespacePatterns: [/^\s*package\s+([\w.]+)\s*;/m],
    importPatterns: [/^\s*import\s+(?:static\s+)?([\w.*]+)\s*;/gm],
    typePattern: /\b(class|interface|enum|record)\s+([A-Za-z_$][\w$]*)[^{;]*\{/g,
    kindMap: { class: "class", interface: "interface", enum: "enum", record: "datatype" },
    inheritance(match) {
      const header = match[0];
      return {
        inherits: splitTypeList(header.match(/\bextends\s+([A-Za-z_$][\w$.[\]<>?]*)/)?.[1]),
        implements: splitTypeList(header.match(/\bimplements\s+([^{]+)/)?.[1])
      };
    }
  }),
  braceLanguageAdapter({
    id: "kotlin-first-pass",
    language: "kotlin",
    extensions: [".kt", ".kts"],
    nativeBackends: nativeBackendsByLanguage.kotlin,
    namespacePatterns: [/^\s*package\s+([\w.]+)/m],
    importPatterns: [/^\s*import\s+([\w.*]+)\s*$/gm],
    typePattern: /\b(class|interface|object|enum\s+class)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", interface: "interface", object: "class", "enum class": "enum" },
    inheritance(match) {
      return { implements: splitTypeList(match[0].match(/:\s*([^{]+)/)?.[1]) };
    }
  }),
  braceLanguageAdapter({
    id: "scala-first-pass",
    language: "scala",
    extensions: [".scala"],
    nativeBackends: nativeBackendsByLanguage.scala,
    namespacePatterns: [/^\s*package\s+([\w.]+)/m],
    importPatterns: [/^\s*import\s+([\w.{}, _]+)$/gm],
    typePattern: /\b(class|trait|object|enum)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", trait: "interface", object: "class", enum: "enum" },
    inheritance(match) {
      return { inherits: splitTypeList(match[0].match(/\bextends\s+([^{]+)/)?.[1]) };
    }
  }),
  braceLanguageAdapter({
    id: "csharp-first-pass",
    language: "csharp",
    extensions: [".cs"],
    nativeBackends: nativeBackendsByLanguage.csharp,
    namespacePatterns: [/^\s*namespace\s+([\w.]+)\s*[;{]/m],
    importPatterns: [/^\s*using\s+([\w.]+)\s*;/gm],
    typePattern: /\b(class|interface|enum|struct|record)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", interface: "interface", enum: "enum", struct: "class", record: "class" },
    inheritance(match) {
      const bases = splitTypeList(match[0].match(/:\s*([^{]+)/)?.[1]);
      return {
        inherits: bases.filter((item) => !item.startsWith("I")).slice(0, 1),
        implements: bases.filter((item) => item.startsWith("I"))
      };
    }
  }),
  {
    id: "typescript-compiler-api",
    language: "typescript",
    extensions: [".ts", ".tsx"],
    version: adapterVersion,
    level: "native",
    nativeBackends: nativeBackendsByLanguage.typescript,
    extract: extractTsJs
  },
  {
    id: "javascript-typescript-parser",
    language: "javascript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    version: adapterVersion,
    level: "native",
    nativeBackends: nativeBackendsByLanguage.javascript,
    extract: extractTsJs
  },
  {
    id: "go-first-pass",
    language: "go",
    extensions: [".go"],
    version: adapterVersion,
    level: "first-pass",
    nativeBackends: nativeBackendsByLanguage.go,
    extract: extractGo
  },
  {
    id: "rust-first-pass",
    language: "rust",
    extensions: [".rs"],
    version: adapterVersion,
    level: "first-pass",
    nativeBackends: nativeBackendsByLanguage.rust,
    extract: extractRust
  },
  {
    id: "python-first-pass",
    language: "python",
    extensions: [".py"],
    version: adapterVersion,
    level: "native",
    nativeBackends: nativeBackendsByLanguage.python,
    extract: extractPython
  },
  {
    id: "ruby-first-pass",
    language: "ruby",
    extensions: [".rb"],
    version: adapterVersion,
    level: "first-pass",
    nativeBackends: nativeBackendsByLanguage.ruby,
    extract: extractRuby
  },
  {
    id: "php-first-pass",
    language: "php",
    extensions: [".php"],
    version: adapterVersion,
    level: "first-pass",
    nativeBackends: nativeBackendsByLanguage.php,
    extract: extractPhp
  },
  braceLanguageAdapter({
    id: "swift-first-pass",
    language: "swift",
    extensions: [".swift"],
    nativeBackends: nativeBackendsByLanguage.swift,
    namespacePatterns: [],
    importPatterns: [/^\s*import\s+([A-Za-z_]\w*)/gm],
    typePattern: /\b(class|struct|protocol|enum)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", struct: "class", protocol: "interface", enum: "enum" },
    inheritance(match) {
      return { implements: splitTypeList(match[0].match(/:\s*([^{]+)/)?.[1]) };
    }
  }),
  braceLanguageAdapter({
    id: "cpp-first-pass",
    language: "cpp",
    extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".h"],
    nativeBackends: nativeBackendsByLanguage.cpp,
    namespacePatterns: [/^\s*namespace\s+([A-Za-z_]\w*)\s*\{/m],
    importPatterns: [/^\s*#include\s+[<"]([^>"]+)[>"]/gm],
    typePattern: /\b(class|struct|enum)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", struct: "class", enum: "enum" },
    inheritance(match) {
      return { inherits: splitTypeList(match[0].match(/:\s*(?:public|private|protected)?\s*([^{]+)/)?.[1]) };
    }
  }),
  braceLanguageAdapter({
    id: "c-first-pass",
    language: "c",
    extensions: [".c"],
    nativeBackends: nativeBackendsByLanguage.c,
    namespacePatterns: [],
    importPatterns: [/^\s*#include\s+[<"]([^>"]+)[>"]/gm],
    typePattern: /\b(struct|enum)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { struct: "class", enum: "enum" }
  })
];

const extensionToAdapter = new Map<string, LanguageAdapter>();
for (const adapter of adapters) {
  for (const extension of adapter.extensions) extensionToAdapter.set(extension, adapter);
}

export function adapterForPath(filePath: string) {
  return extensionToAdapter.get(path.extname(filePath).toLowerCase());
}

export function supportedLanguages() {
  return adapters.map((adapter) => ({
    adapterId: adapter.id,
    language: adapter.language,
    extensions: adapter.extensions,
    level: adapter.level ?? "first-pass",
    version: adapter.version,
    nativeBackends: adapter.nativeBackends?.map((backend) => ({
      id: backend.id,
      name: backend.name,
      kind: backend.kind,
      markers: backend.markers ?? [],
      tools: backend.tools.map((tool) => tool.name)
    })) ?? []
  }));
}
