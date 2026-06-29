import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { adapterForPath, supportedLanguages } from "../extract/adapters";
import type { RawGraph, RawLink, RawNode, ScanConfig, ScanOptions } from "../extract/types";

const defaultExclude = [
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "target",
  ".next",
  ".nuxt",
  ".venv",
  "venv",
  "__pycache__",
  ".gradle",
  ".idea",
  ".vscode",
  "vendor",
  "coverage",
  ".terraform"
];

function help() {
  return `Dependency Palace scanner

Usage:
  npm run scan -- <path> --out graph.json
  npm run scan -- --root ./src --out ./dependency-palace.json --module-depth 2

Options:
  --root <path>          Directory to scan. Defaults to first positional argument or current directory.
  --out <path>           Output JSON path. Defaults to dependency-palace.graph.json.
  --config <path>        Optional config JSON. Defaults to dependency-palace.config.json when present.
  --include <pattern>    Include path substring/glob-ish pattern. Repeatable.
  --exclude <pattern>    Exclude path substring/glob-ish pattern. Repeatable.
  --module-depth <n>     Number of path segments used as module. Defaults to 1.
  --max-file-bytes <n>   Skip larger files. Defaults to 1500000.
  --languages            Print supported languages.
  --help                 Print this message.
`;
}

function readArgs(argv: string[]) {
  const args = [...argv];
  const values = new Map<string, string[]>();
  const positionals: string[] = [];

  while (args.length) {
    const item = args.shift();
    if (!item) continue;
    if (!item.startsWith("--")) {
      positionals.push(item);
      continue;
    }
    const key = item.slice(2);
    if (key === "help" || key === "languages") {
      values.set(key, ["true"]);
      continue;
    }
    const value = args.shift();
    if (!value) throw new Error(`Missing value for --${key}`);
    values.set(key, [...(values.get(key) ?? []), value]);
  }

  return { values, positionals };
}

async function loadConfig(configPath: string | undefined): Promise<ScanConfig> {
  const resolved = configPath ?? "dependency-palace.config.json";
  if (!existsSync(resolved)) return {};
  const text = await readFile(resolved, "utf8");
  return JSON.parse(text) as ScanConfig;
}

function globishMatch(pattern: string, relativePath: string) {
  const normalizedPattern = pattern.replaceAll("\\", "/");
  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (normalizedPattern === "**/*" || normalizedPattern === "*") return true;
  if (!normalizedPattern.includes("*")) return normalizedPath.includes(normalizedPattern);
  const escaped = normalizedPattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("\\*\\*", ".*")
    .replaceAll("\\*", "[^/]*");
  return new RegExp(`^${escaped}$`).test(normalizedPath);
}

function shouldInclude(relativePath: string, options: ScanOptions) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (options.exclude.some((pattern) => globishMatch(pattern, normalized))) return false;
  if (options.include.length === 0) return true;
  return options.include.some((pattern) => globishMatch(pattern, normalized));
}

async function walk(root: string, options: ScanOptions, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute);
    if (!shouldInclude(relative, options)) continue;

    if (entry.isDirectory()) {
      files.push(...(await walk(root, options, absolute)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!adapterForPath(absolute)) continue;
    const stats = await stat(absolute);
    if (stats.size > options.maxFileBytes) continue;
    files.push(absolute);
  }

  return files;
}

function mergeGraph(nodes: RawNode[], links: RawLink[]) {
  const nodeMap = new Map<string, RawNode>();
  const linkMap = new Map<string, RawLink>();

  for (const node of nodes) {
    const existing = nodeMap.get(node.id);
    if (!existing) {
      nodeMap.set(node.id, node);
      continue;
    }
    existing.fields = [...(existing.fields ?? []), ...(node.fields ?? [])];
    existing.methods = [...(existing.methods ?? []), ...(node.methods ?? [])];
    existing.loc = Math.max(existing.loc ?? 0, node.loc ?? 0);
    existing.complexity = Math.max(existing.complexity ?? 1, node.complexity ?? 1);
  }

  for (const link of links) {
    const source = typeof link.source === "string" ? link.source : link.source.id;
    const target = typeof link.target === "string" ? link.target : link.target.id;
    const key = `${source}\u0000${target}\u0000${link.type ?? link.kind ?? "unknown"}\u0000${link.via ?? ""}`;
    const existing = linkMap.get(key);
    if (existing) existing.weight = (existing.weight ?? 1) + (link.weight ?? 1);
    else linkMap.set(key, link);
  }

  return { nodes: Array.from(nodeMap.values()), links: Array.from(linkMap.values()) };
}

function optionsFromArgs(values: Map<string, string[]>, positionals: string[], config: ScanConfig): ScanOptions {
  const root = path.resolve(values.get("root")?.at(-1) ?? positionals[0] ?? ".");
  const out = path.resolve(values.get("out")?.at(-1) ?? "dependency-palace.graph.json");
  return {
    root,
    out,
    configPath: values.get("config")?.at(-1),
    include: [...(config.include ?? []), ...(values.get("include") ?? [])],
    exclude: [...defaultExclude, ...(config.exclude ?? []), ...(values.get("exclude") ?? [])],
    moduleDepth: Number(values.get("module-depth")?.at(-1) ?? config.moduleDepth ?? 1),
    maxFileBytes: Number(values.get("max-file-bytes")?.at(-1) ?? config.maxFileBytes ?? 1_500_000)
  };
}

async function main() {
  const { values, positionals } = readArgs(process.argv.slice(2));
  if (values.has("help")) {
    console.log(help());
    return;
  }
  if (values.has("languages")) {
    console.log(JSON.stringify(supportedLanguages(), null, 2));
    return;
  }

  const config = await loadConfig(values.get("config")?.at(-1));
  const options = optionsFromArgs(values, positionals, config);
  if (!existsSync(options.root)) throw new Error(`Scan root does not exist: ${options.root}`);

  const files = await walk(options.root, options);
  const allNodes: RawNode[] = [];
  const allLinks: RawLink[] = [];
  const languages = new Set<string>();

  for (const absolutePath of files) {
    const adapter = adapterForPath(absolutePath);
    if (!adapter) continue;
    const text = await readFile(absolutePath, "utf8");
    const relativePath = path.relative(options.root, absolutePath);
    languages.add(adapter.language);
    const extracted = adapter.extract(
      {
        absolutePath,
        relativePath,
        language: adapter.language,
        text
      },
      { root: options.root, moduleDepth: options.moduleDepth }
    );
    allNodes.push(...extracted.nodes);
    allLinks.push(...extracted.links);
  }

  const merged = mergeGraph(allNodes, allLinks);
  const graph: RawGraph = {
    nodes: merged.nodes,
    links: merged.links,
    meta: {
      name: path.basename(options.root),
      generatedAt: new Date().toISOString(),
      language: Array.from(languages).sort().join(", ") || "unknown"
    }
  };

  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(options.out, `${JSON.stringify(graph, null, 2)}\n`, "utf8");

  console.log(
    `Scanned ${files.length} files, wrote ${graph.nodes.length} nodes and ${(graph.links ?? []).length} links to ${options.out}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
