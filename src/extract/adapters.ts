import path from "node:path";
import type { CodeMember, DependencyKind, ExtractContext, ExtractedFile, LanguageAdapter, NodeKind, RawLink, RawNode, SourceFile, SourceLanguage } from "./types";
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
  stripComments,
  visibilityFromLine
} from "./utils";

interface BraceLanguageOptions {
  language: SourceLanguage;
  extensions: string[];
  namespacePatterns: RegExp[];
  importPatterns: RegExp[];
  typePattern: RegExp;
  kindMap: Record<string, NodeKind>;
  inheritance?: (match: RegExpMatchArray) => { inherits?: string[]; implements?: string[] };
}

function splitTypeList(value: string | undefined) {
  return (value ?? "")
    .split(/[,|&]/)
    .map((item) => simpleTypeName(item.trim()))
    .filter(Boolean) as string[];
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
    language: options.language,
    extensions: options.extensions,
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
        const members = extractMembersFromBraceBody(body);
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
          methods: members.methods
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

        for (const imported of imports) {
          const importedName = simpleTypeName(imported);
          if (!importedName) continue;
          if (body.includes(importedName)) {
            addLink(links, seenLinks, id, imported, "uses", importedName, "type reference in body");
          }
        }
      }

      return { nodes, links };
    }
  };
}

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

  const imports = importTargets(text, [/^\s*from\s+([\w.]+)\s+import\s+/gm, /^\s*import\s+([\w.]+)/gm]);
  for (const target of imports) addLink(links, seenLinks, fileNode.id, target, "imports", undefined, "python import");

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
      methods
    });
    addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares class");
    for (const target of splitTypeList(match[2])) addLink(links, seenLinks, id, target, "inherits", undefined, "python base class");
    for (const imported of imports) {
      const importedName = simpleTypeName(imported);
      if (importedName && body.includes(importedName)) addLink(links, seenLinks, id, imported, "uses", importedName, "type/name reference");
    }
  }

  return { nodes, links };
}

function extractGo(file: SourceFile, context: ExtractContext): ExtractedFile {
  const text = stripComments(file.text);
  const packageName = text.match(/^package\s+([A-Za-z_]\w*)/m)?.[1] ?? packageFromPath(file.relativePath);
  const namespace = packageName;
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
      const field = line.match(/^([A-Za-z_]\w*)\s+([\w.[\]*]+)/);
      if (field) fields.push({ name: field[1], kind: "field", type: field[2], visibility: /^[A-Z]/.test(field[1]) ? "public" : "private" });
      const method = line.match(/^([A-Za-z_]\w*)\s*\(([^)]*)\)/);
      if (method) methods.push({ name: method[1], kind: "method", visibility: /^[A-Z]/.test(method[1]) ? "public" : "private", signature: line });
    }
    const node: RawNode = {
      id: qualifiedName(namespace, name),
      label: name,
      module,
      package: namespace,
      kind,
      loc: countLoc(body),
      complexity: simpleComplexity(body),
      fields,
      methods
    };
    nodeByName.set(name, node);
    addNode(nodes, seenNodes, node);
    addLink(links, seenLinks, fileNode.id, node.id, "uses", undefined, "declares go type");
  }

  for (const match of text.matchAll(/\bfunc\s+\(\s*\w+\s+\*?([A-Za-z_]\w*)\s*\)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g)) {
    const owner = nodeByName.get(match[1]);
    if (!owner) continue;
    const methods = owner.methods ?? [];
    methods.push({ name: match[2], kind: "method", visibility: /^[A-Z]/.test(match[2]) ? "public" : "private", signature: `func (${match[1]}) ${match[2]}(${match[3]})` });
    owner.methods = methods;
  }

  for (const node of nodeByName.values()) {
    const haystack = text;
    for (const imported of imports) {
      const importedName = simpleTypeName(imported);
      if (importedName && haystack.includes(importedName)) addLink(links, seenLinks, node.id, imported, "uses", importedName, "package reference");
    }
  }

  return { nodes, links };
}

function extractRust(file: SourceFile, context: ExtractContext): ExtractedFile {
  const text = stripComments(file.text);
  const namespace = packageFromPath(file.relativePath);
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
      id: qualifiedName(namespace, name),
      label: name,
      module,
      package: namespace,
      kind: rawKind === "trait" ? "interface" : rawKind === "enum" ? "enum" : "class",
      loc: countLoc(body || text),
      complexity: simpleComplexity(body || text),
      fields,
      methods
    };
    nodeByName.set(name, node);
    addNode(nodes, seenNodes, node);
    addLink(links, seenLinks, fileNode.id, node.id, "uses", undefined, "declares rust item");
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
      if (trait) addLink(links, seenLinks, owner.id, trait, "implements", undefined, "rust impl trait");
    }
  }

  return { nodes, links };
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
      methods
    });
    addLink(links, seenLinks, fileNode.id, id, "uses", undefined, "declares ruby constant");
    if (match[3]) addLink(links, seenLinks, id, match[3], "inherits", undefined, "ruby superclass");
  }

  return { nodes, links };
}

function extractPhp(file: SourceFile, context: ExtractContext): ExtractedFile {
  return braceLanguageAdapter({
    language: "php",
    extensions: [".php"],
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
  }).extract(file, context);
}

const adapters: LanguageAdapter[] = [
  braceLanguageAdapter({
    language: "java",
    extensions: [".java"],
    namespacePatterns: [/^\s*package\s+([\w.]+)\s*;/m],
    importPatterns: [/^\s*import\s+(?:static\s+)?([\w.*]+)\s*;/gm],
    typePattern: /\b(class|interface|enum)\s+([A-Za-z_$][\w$]*)[^{;]*\{/g,
    kindMap: { class: "class", interface: "interface", enum: "enum" },
    inheritance(match) {
      const header = match[0];
      return {
        inherits: splitTypeList(header.match(/\bextends\s+([A-Za-z_$][\w$.[\]<>?]*)/)?.[1]),
        implements: splitTypeList(header.match(/\bimplements\s+([^{]+)/)?.[1])
      };
    }
  }),
  braceLanguageAdapter({
    language: "kotlin",
    extensions: [".kt", ".kts"],
    namespacePatterns: [/^\s*package\s+([\w.]+)/m],
    importPatterns: [/^\s*import\s+([\w.*]+)\s*$/gm],
    typePattern: /\b(class|interface|object|enum\s+class)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", interface: "interface", object: "class", "enum class": "enum" },
    inheritance(match) {
      return { implements: splitTypeList(match[0].match(/:\s*([^{]+)/)?.[1]) };
    }
  }),
  braceLanguageAdapter({
    language: "scala",
    extensions: [".scala"],
    namespacePatterns: [/^\s*package\s+([\w.]+)/m],
    importPatterns: [/^\s*import\s+([\w.{}, _]+)$/gm],
    typePattern: /\b(class|trait|object|enum)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", trait: "interface", object: "class", enum: "enum" },
    inheritance(match) {
      return { inherits: splitTypeList(match[0].match(/\bextends\s+([^{]+)/)?.[1]) };
    }
  }),
  braceLanguageAdapter({
    language: "csharp",
    extensions: [".cs"],
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
  braceLanguageAdapter({
    language: "typescript",
    extensions: [".ts", ".tsx"],
    namespacePatterns: [/^\s*(?:export\s+)?namespace\s+([\w.]+)/m],
    importPatterns: [/^\s*import(?:\s+type)?[\s\S]*?\s+from\s+["']([^"']+)["']/gm, /^\s*import\s+["']([^"']+)["']/gm],
    typePattern: /\b(class|interface|enum|type)\s+([A-Za-z_$][\w$]*)[^{;=]*\{/g,
    kindMap: { class: "class", interface: "interface", enum: "enum", type: "interface" },
    inheritance(match) {
      const header = match[0];
      return {
        inherits: splitTypeList(header.match(/\bextends\s+([A-Za-z_$][\w$.[\]<>?]*)/)?.[1]),
        implements: splitTypeList(header.match(/\bimplements\s+([^{]+)/)?.[1])
      };
    }
  }),
  braceLanguageAdapter({
    language: "javascript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    namespacePatterns: [],
    importPatterns: [/^\s*import[\s\S]*?\s+from\s+["']([^"']+)["']/gm, /^\s*(?:const|let|var)\s+\w+\s*=\s*require\(["']([^"']+)["']\)/gm],
    typePattern: /\b(class)\s+([A-Za-z_$][\w$]*)[^{;]*\{/g,
    kindMap: { class: "class" },
    inheritance(match) {
      return { inherits: splitTypeList(match[0].match(/\bextends\s+([A-Za-z_$][\w$]*)/)?.[1]) };
    }
  }),
  { language: "go", extensions: [".go"], extract: extractGo },
  { language: "rust", extensions: [".rs"], extract: extractRust },
  { language: "python", extensions: [".py"], extract: extractPython },
  { language: "ruby", extensions: [".rb"], extract: extractRuby },
  { language: "php", extensions: [".php"], extract: extractPhp },
  braceLanguageAdapter({
    language: "swift",
    extensions: [".swift"],
    namespacePatterns: [],
    importPatterns: [/^\s*import\s+([A-Za-z_]\w*)/gm],
    typePattern: /\b(class|struct|protocol|enum)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", struct: "class", protocol: "interface", enum: "enum" },
    inheritance(match) {
      return { implements: splitTypeList(match[0].match(/:\s*([^{]+)/)?.[1]) };
    }
  }),
  braceLanguageAdapter({
    language: "cpp",
    extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".h"],
    namespacePatterns: [/^\s*namespace\s+([A-Za-z_]\w*)\s*\{/m],
    importPatterns: [/^\s*#include\s+[<"]([^>"]+)[>"]/gm],
    typePattern: /\b(class|struct|enum)\s+([A-Za-z_]\w*)[^{;]*\{/g,
    kindMap: { class: "class", struct: "class", enum: "enum" },
    inheritance(match) {
      return { inherits: splitTypeList(match[0].match(/:\s*(?:public|private|protected)?\s*([^{]+)/)?.[1]) };
    }
  }),
  braceLanguageAdapter({
    language: "c",
    extensions: [".c"],
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
    language: adapter.language,
    extensions: adapter.extensions
  }));
}
