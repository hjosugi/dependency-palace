import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { adapterForPath, supportedLanguages } from "../extract/adapters";
import type { AdapterWarning, RawGraph, RawLink, RawNode, ScanConfig, ScanDiagnostics, ScanOptions, SkippedFile, SourceLanguage } from "../extract/types";
import { encodeCompactGraph } from "../graph/compact";

const adapterVersion = "adapter-contract-v1.1.0";

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
  --out <path>           Output JSON path. Defaults to public/dependency-palace.graph.json.
  --diagnostics-out <path>
                         Diagnostics JSON path. Defaults to <out>.diagnostics.json.
  --format <json|compact|both>
                         Output format. Defaults to json.
  --compact-out <path>   Compact graph path. Defaults to <out basename>.dpg.
  --config <path>        Optional config JSON. Defaults to dependency-palace.config.json when present.
  --include <pattern>    Include path substring/glob-ish pattern. Repeatable.
  --exclude <pattern>    Exclude path substring/glob-ish pattern. Repeatable.
  --module-depth <n>     Number of path segments used as module. Defaults to 1.
  --max-file-bytes <n>   Skip larger files. Defaults to 1500000.
  --cache-dir <path>     Per-file extraction cache. Defaults to .dependency-palace/cache.
  --no-cache             Disable extraction cache.
  --clear-cache          Delete cache before scanning.
  --watch                Rescan repeatedly so the viewer can refresh.
  --watch-interval-ms <n>
                         Watch polling interval. Defaults to 1500.
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
    if (key === "help" || key === "languages" || key === "watch" || key === "no-cache" || key === "clear-cache") {
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

async function walk(
  root: string,
  options: ScanOptions,
  current = root,
  skipped: SkippedFile[] = []
): Promise<{ files: string[]; skipped: SkippedFile[] }> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute);
    if (!shouldInclude(relative, options)) continue;

    if (entry.isDirectory()) {
      const nested = await walk(root, options, absolute, skipped);
      files.push(...nested.files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!adapterForPath(absolute)) continue;
    const stats = await stat(absolute);
    if (stats.size > options.maxFileBytes) {
      skipped.push({
        path: relative.replaceAll("\\", "/"),
        reason: `larger than maxFileBytes (${options.maxFileBytes})`,
        bytes: stats.size
      });
      continue;
    }
    files.push(absolute);
  }

  return { files, skipped };
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

function hashText(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function cachePathForFile(options: ScanOptions, relativePath: string, contentHash: string, language: SourceLanguage) {
  const key = crypto
    .createHash("sha256")
    .update([adapterVersion, language, options.moduleDepth, relativePath, contentHash].join("\u0000"))
    .digest("hex");
  return path.join(options.cacheDir, `${key}.json`);
}

function endpointId(endpoint: RawLink["source"]) {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function countUnresolvedEdges(nodes: RawNode[], links: RawLink[]) {
  const ids = new Set(nodes.map((node) => node.id));
  let count = 0;
  for (const link of links) {
    if (!ids.has(endpointId(link.source)) || !ids.has(endpointId(link.target))) count += 1;
  }
  return count;
}

function optionsFromArgs(values: Map<string, string[]>, positionals: string[], config: ScanConfig): ScanOptions {
  const root = path.resolve(values.get("root")?.at(-1) ?? positionals[0] ?? ".");
  const out = path.resolve(values.get("out")?.at(-1) ?? "public/dependency-palace.graph.json");
  const diagnosticsOut = path.resolve(values.get("diagnostics-out")?.at(-1) ?? `${out}.diagnostics.json`);
  const formatValue = values.get("format")?.at(-1) ?? "json";
  if (!["json", "compact", "both"].includes(formatValue)) throw new Error(`Unsupported --format: ${formatValue}`);
  const compactOut =
    values.get("compact-out")?.at(-1) ??
    path.join(path.dirname(out), `${path.basename(out).replace(/\.json$/u, "")}.dpg`);
  return {
    root,
    out,
    diagnosticsOut,
    compactOut: path.resolve(compactOut),
    configPath: values.get("config")?.at(-1),
    include: [...(config.include ?? []), ...(values.get("include") ?? [])],
    exclude: [...defaultExclude, ...(config.exclude ?? []), ...(values.get("exclude") ?? [])],
    moduleDepth: Number(values.get("module-depth")?.at(-1) ?? config.moduleDepth ?? 1),
    maxFileBytes: Number(values.get("max-file-bytes")?.at(-1) ?? config.maxFileBytes ?? 1_500_000),
    cache: !values.has("no-cache") && (config.cache ?? true),
    cacheDir: path.resolve(values.get("cache-dir")?.at(-1) ?? config.cacheDir ?? ".dependency-palace/cache"),
    clearCache: values.has("clear-cache"),
    format: formatValue as ScanOptions["format"],
    watch: values.has("watch"),
    watchIntervalMs: Number(values.get("watch-interval-ms")?.at(-1) ?? config.watchIntervalMs ?? 1500)
  };
}

async function extractFile(
  absolutePath: string,
  options: ScanOptions,
  languageDiagnostics: ScanDiagnostics["languages"]
) {
  const adapter = adapterForPath(absolutePath);
  if (!adapter) return null;
  const text = await readFile(absolutePath, "utf8");
  const relativePath = path.relative(options.root, absolutePath);
  const contentHash = hashText(text);
  const language = adapter.language as SourceLanguage;
  const current = languageDiagnostics[language] ?? { files: 0, cached: 0, nodes: 0, links: 0 };
  current.files += 1;
  languageDiagnostics[language] = current;

  if (options.cache) {
    const cachePath = cachePathForFile(options, relativePath, contentHash, language);
    if (existsSync(cachePath)) {
      const cached = JSON.parse(await readFile(cachePath, "utf8")) as {
        nodes: RawNode[];
        links: RawLink[];
        warnings?: AdapterWarning[];
      };
      current.cached += 1;
      current.nodes += cached.nodes.length;
      current.links += cached.links.length;
      return { ...cached, language, cacheHit: true };
    }
  }

  const extracted = adapter.extract(
    {
      absolutePath,
      relativePath,
      language,
      text,
      contentHash
    },
    { root: options.root, moduleDepth: options.moduleDepth }
  );
  current.nodes += extracted.nodes.length;
  current.links += extracted.links.length;

  if (options.cache) {
    const cachePath = cachePathForFile(options, relativePath, contentHash, language);
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify(extracted)}\n`, "utf8");
  }

  return { ...extracted, language, cacheHit: false };
}

async function scanOnce(options: ScanOptions) {
  const started = performance.now();
  const { files, skipped } = await walk(options.root, options);
  const allNodes: RawNode[] = [];
  const allLinks: RawLink[] = [];
  const languages = new Set<string>();
  const warnings: AdapterWarning[] = [];
  const languageDiagnostics: ScanDiagnostics["languages"] = {};
  let cacheHits = 0;
  let cacheMisses = 0;
  let cacheWrites = 0;

  for (const absolutePath of files) {
    const extracted = await extractFile(absolutePath, options, languageDiagnostics);
    if (!extracted) continue;
    languages.add(extracted.language);
    allNodes.push(...extracted.nodes);
    allLinks.push(...extracted.links);
    warnings.push(...(extracted.warnings ?? []));
    if (extracted.cacheHit) cacheHits += 1;
    else {
      cacheMisses += 1;
      if (options.cache) cacheWrites += 1;
    }
  }

  const merged = mergeGraph(allNodes, allLinks);
  const unresolvedEdges = countUnresolvedEdges(merged.nodes, merged.links);
  const graph: RawGraph = {
    nodes: merged.nodes,
    links: merged.links,
    meta: {
      name: path.basename(options.root),
      generatedAt: new Date().toISOString(),
      language: Array.from(languages).sort().join(", ") || "unknown"
    }
  };

  let jsonBytes: number | undefined;
  let compactBytes: number | undefined;
  if (options.format === "json" || options.format === "both") {
    const json = `${JSON.stringify(graph, null, 2)}\n`;
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, json, "utf8");
    jsonBytes = Buffer.byteLength(json);
  }
  if (options.format === "compact" || options.format === "both") {
    const compact = encodeCompactGraph(graph);
    await mkdir(path.dirname(options.compactOut), { recursive: true });
    await writeFile(options.compactOut, compact);
    compactBytes = compact.byteLength;
  }

  const diagnostics: ScanDiagnostics = {
    schemaVersion: 1,
    root: options.root,
    generatedAt: graph.meta?.generatedAt ?? new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    filesScanned: files.length,
    filesSkipped: skipped.length,
    nodesEmitted: graph.nodes.length,
    linksEmitted: (graph.links ?? []).length,
    unresolvedEdges,
    outputs: {
      json: options.format === "json" || options.format === "both" ? options.out : undefined,
      compact: options.format === "compact" || options.format === "both" ? options.compactOut : undefined,
      diagnostics: options.diagnosticsOut
    },
    bytes: {
      json: jsonBytes,
      compact: compactBytes
    },
    cache: {
      enabled: options.cache,
      dir: options.cache ? options.cacheDir : undefined,
      adapterVersion,
      hits: cacheHits,
      misses: cacheMisses,
      writes: cacheWrites
    },
    languages: languageDiagnostics,
    skipped,
    warnings
  };
  await mkdir(path.dirname(options.diagnosticsOut), { recursive: true });
  await writeFile(options.diagnosticsOut, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");

  const destinations = [diagnostics.outputs.json, diagnostics.outputs.compact].filter(Boolean).join(", ");
  console.log(`Scanned ${files.length} files, wrote ${graph.nodes.length} nodes and ${(graph.links ?? []).length} links to ${destinations}`);
  console.log(
    `Diagnostics: ${skipped.length} skipped, ${unresolvedEdges} unresolved edges, ${warnings.length} warnings, ${cacheHits} cache hits -> ${options.diagnosticsOut}`
  );
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
  if (options.clearCache && existsSync(options.cacheDir)) {
    await rm(options.cacheDir, { recursive: true, force: true });
  }

  await scanOnce(options);
  if (!options.watch) return;

  console.log(`Watching ${options.root} every ${options.watchIntervalMs}ms. Press Ctrl+C to stop.`);
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    scanOnce(options)
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        running = false;
      });
  }, options.watchIntervalMs);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
