import path from "node:path";
import type { CodeMember, DependencyKind, ExtractedFile, RawLink, RawNode, SourceFile } from "./types";

const visibilityPattern = "(?:public|private|protected|internal|package|pub|open|final|static|abstract|override|async|export|readonly|mut|const|let|var|val|def|func|fn|fun|virtual|sealed|partial|unsafe|extern|inline|suspend|data|case|class|struct|trait|impl|interface|enum)\\s+";

export function moduleFromPath(relativePath: string, moduleDepth: number) {
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  const moduleParts = parts.slice(0, Math.max(1, moduleDepth));
  return moduleParts.length ? moduleParts.join("/") : "app";
}

export function packageFromPath(relativePath: string) {
  const directory = path.dirname(relativePath);
  return directory === "." ? "app" : directory.split(/[\\/]/).filter(Boolean).join(".");
}

export function stripComments(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/#.*$/gm, " ");
}

export function countLoc(text: string) {
  return text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("//")).length;
}

export function simpleComplexity(text: string) {
  const matches = text.match(/\b(if|for|while|case|catch|match|switch|when|guard|else\s+if|&&|\|\|)\b/g);
  return Math.max(1, Math.min(99, (matches?.length ?? 0) + 1));
}

export function addNode(nodes: RawNode[], seen: Set<string>, node: RawNode) {
  if (seen.has(node.id)) return;
  seen.add(node.id);
  nodes.push(node);
}

export function addLink(links: RawLink[], seen: Set<string>, source: string, target: string, type: DependencyKind, via?: string, reason?: string) {
  if (!source || !target || source === target) return;
  const key = `${source}\u0000${target}\u0000${type}\u0000${via ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  links.push({ source, target, type, weight: type === "calls" ? 2 : 1, via, reason });
}

export function simpleTypeName(value: string) {
  return value
    .replace(/[<({[].*$/u, "")
    .replace(/[?*!&]+$/u, "")
    .split(/[.:/#\\]/)
    .filter(Boolean)
    .at(-1)
    ?.trim();
}

export function qualifiedName(namespace: string, name: string) {
  return namespace && namespace !== "app" ? `${namespace}.${name}` : name;
}

export function extractBraceBody(text: string, openBraceIndex: number) {
  if (openBraceIndex < 0 || text[openBraceIndex] !== "{") return "";
  let depth = 0;
  for (let index = openBraceIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return text.slice(openBraceIndex + 1, index);
  }
  return text.slice(openBraceIndex + 1);
}

export function extractMembersFromBraceBody(body: string): { fields: CodeMember[]; methods: CodeMember[] } {
  const fields: CodeMember[] = [];
  const methods: CodeMember[] = [];
  const seenFields = new Set<string>();
  const seenMethods = new Set<string>();
  const shallowLines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5000);

  const methodRegex = new RegExp(`^(?:${visibilityPattern})*(?:[\\w.$<>?[\\],:&*]+\\s+)?([A-Za-z_$][\\w$]*)\\s*\\(([^)]*)\\)\\s*(?:[:\\w\\s.$<>?[\\],&*=-]*)?(?:\\{|;|=>)?`);
  const fieldRegex = new RegExp(`^(?:${visibilityPattern})*(?:([A-Za-z_$][\\w.$<>?[\\],:&*]*)\\s+)?([A-Za-z_$][\\w$]*)\\s*(?::\\s*([A-Za-z_$][\\w.$<>?[\\],:&*]*))?\\s*(?:=|;|$)`);

  for (const line of shallowLines) {
    if (line.startsWith("@") || line.startsWith("[") || line.includes(" class ") || line.includes(" interface ")) continue;
    const methodMatch = line.match(methodRegex);
    if (methodMatch && !["if", "for", "while", "switch", "catch", "return"].includes(methodMatch[1])) {
      const name = methodMatch[1];
      if (!seenMethods.has(name)) {
        seenMethods.add(name);
        methods.push({
          name,
          kind: name === "constructor" ? "constructor" : "method",
          visibility: visibilityFromLine(line),
          signature: line.replace(/\s+/g, " ").slice(0, 180)
        });
      }
      continue;
    }

    const fieldMatch = line.match(fieldRegex);
    if (fieldMatch && !line.includes("(")) {
      const name = fieldMatch[2];
      if (name && !seenFields.has(name) && !["return", "import", "package", "using", "namespace"].includes(name)) {
        seenFields.add(name);
        fields.push({
          name,
          kind: line.includes(":") ? "property" : "field",
          type: fieldMatch[3] ?? fieldMatch[1],
          visibility: visibilityFromLine(line)
        });
      }
    }
  }

  return { fields: fields.slice(0, 80), methods: methods.slice(0, 120) };
}

export function visibilityFromLine(line: string) {
  if (/\bprivate\b/.test(line)) return "private";
  if (/\bprotected\b/.test(line)) return "protected";
  if (/\bpublic\b|\bpub\b|\bexport\b/.test(line)) return "public";
  if (/\binternal\b/.test(line)) return "internal";
  return "package";
}

export function importTargets(text: string, patterns: RegExp[]) {
  const targets = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const target = match[1]?.trim();
      if (target) targets.add(target.replace(/[;"']/g, ""));
    }
  }
  return Array.from(targets);
}

export function createFileNode(file: SourceFile, moduleDepth: number): RawNode {
  const packageName = packageFromPath(file.relativePath);
  return {
    id: `file:${file.relativePath}`,
    label: path.basename(file.relativePath),
    module: moduleFromPath(file.relativePath, moduleDepth),
    package: packageName,
    kind: "module",
    loc: countLoc(file.text),
    complexity: simpleComplexity(file.text)
  };
}

export function emptyExtraction(): ExtractedFile {
  return { nodes: [], links: [] };
}
