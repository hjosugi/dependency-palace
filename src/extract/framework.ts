import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type {
  AdapterFileDiagnostics,
  AdapterProvenance,
  AdapterToolProbe,
  ExtractContext,
  ExtractedFile,
  LanguageAdapter,
  NativeAdapterBackend,
  RawLink,
  RawNode,
  SourceFile
} from "./types";

const execFileAsync = promisify(execFile);

export const adapterContractVersion = "adapter-contract-v2.0.0";

interface BackendResolution {
  backendId: string;
  backendKind: AdapterProvenance["backendKind"];
  backendName: string;
  confidence: AdapterProvenance["confidence"];
  source: AdapterProvenance["source"];
  tools: AdapterToolProbe[];
  backend?: NativeAdapterBackend;
  fallbackReason?: string;
}

interface RunState {
  resolution: BackendResolution;
  metadata?: Record<string, unknown>;
}

export interface AdapterRunResult extends ExtractedFile {
  diagnostics: AdapterFileDiagnostics;
}

const stateCache = new Map<string, Promise<RunState>>();

function endpointId(endpoint: RawLink["source"]) {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function probeKey(adapter: LanguageAdapter, context: ExtractContext) {
  return `${context.root}\u0000${adapter.id}\u0000${adapter.version}\u0000${context.native ? "native" : "fallback"}`;
}

const ignoredMarkerDirs = new Set([".git", "node_modules", "dist", "build", "target", ".venv", "venv", "__pycache__"]);

function markerNameMatches(name: string, marker: string) {
  if (marker.startsWith("*.")) return name.endsWith(marker.slice(1));
  return name === marker;
}

function markerExists(root: string, marker: string, depth = 4): boolean {
  if (existsSync(path.join(root, marker))) return true;
  if (depth <= 0) return false;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isFile() && markerNameMatches(entry.name, marker)) return true;
    if (!entry.isDirectory() || ignoredMarkerDirs.has(entry.name)) continue;
    if (markerExists(path.join(root, entry.name), marker, depth - 1)) return true;
  }
  return false;
}

function backendMarkersMatch(root: string, backend: NativeAdapterBackend) {
  if (!backend.markers?.length) return true;
  return backend.markers.some((marker) => markerExists(root, marker));
}

function normalizeToolOutput(stdout: string, stderr: string) {
  return `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

async function probeTool(tool: NativeAdapterBackend["tools"][number], root: string): Promise<AdapterToolProbe> {
  try {
    const { stdout, stderr } = await execFileAsync(tool.command, tool.args ?? ["--version"], {
      cwd: root,
      timeout: 2500,
      maxBuffer: 512 * 1024
    });
    return {
      name: tool.name,
      command: tool.command,
      args: tool.args,
      available: true,
      version: normalizeToolOutput(stdout, stderr) || undefined
    };
  } catch (error) {
    return {
      name: tool.name,
      command: tool.command,
      args: tool.args,
      available: false,
      error: error instanceof Error ? error.message.split(/\r?\n/)[0] : String(error)
    };
  }
}

async function resolveBackend(adapter: LanguageAdapter, file: SourceFile, context: ExtractContext): Promise<RunState> {
  if (!context.native || !adapter.nativeBackends?.length) {
    return {
      resolution: {
        backendId: "first-pass",
        backendKind: "first-pass",
        backendName: "First-pass structural parser",
        confidence: "medium",
        source: "fallback",
        tools: [],
        fallbackReason: context.native ? undefined : "native probing disabled"
      }
    };
  }

  const skippedBackends: string[] = [];
  for (const backend of adapter.nativeBackends) {
    if (!backendMarkersMatch(context.root, backend)) {
      skippedBackends.push(`${backend.name}: project marker not found`);
      continue;
    }

    const tools = await Promise.all(backend.tools.map((tool) => probeTool(tool, context.root)));
    if (tools.some((tool) => !tool.available)) {
      skippedBackends.push(`${backend.name}: required tool unavailable`);
      continue;
    }

    let metadata: Record<string, unknown> | undefined;
    if (backend.collectMetadata) {
      try {
        metadata = await backend.collectMetadata(file, context);
      } catch (error) {
        skippedBackends.push(
          `${backend.name}: metadata failed (${error instanceof Error ? error.message.split(/\r?\n/)[0] : String(error)})`
        );
        continue;
      }
    }

    return {
      resolution: {
        backendId: backend.id,
        backendKind: backend.kind,
        backendName: backend.name,
        confidence: backend.confidence,
        source: backend.extract ? "native" : "fallback",
        tools,
        backend,
        fallbackReason: backend.extract ? undefined : "native metadata collected; graph extraction uses fallback parser"
      },
      metadata
    };
  }

  return {
    resolution: {
      backendId: "first-pass",
      backendKind: "first-pass",
      backendName: "First-pass structural parser",
      confidence: "medium",
      source: "fallback",
      tools: [],
      fallbackReason: skippedBackends.join("; ") || "no native backend configured"
    }
  };
}

async function stateFor(adapter: LanguageAdapter, file: SourceFile, context: ExtractContext) {
  const key = probeKey(adapter, context);
  const existing = stateCache.get(key);
  if (existing) return existing;
  const created = resolveBackend(adapter, file, context);
  stateCache.set(key, created);
  return created;
}

function validateNode(node: RawNode, pathLabel: string) {
  if (!node || typeof node !== "object") throw new Error(`${pathLabel}: node must be an object`);
  if (!node.id || typeof node.id !== "string") throw new Error(`${pathLabel}: every node needs a string id`);
  if (node.fields && !Array.isArray(node.fields)) throw new Error(`${pathLabel}: node ${node.id} fields must be an array`);
  if (node.methods && !Array.isArray(node.methods)) throw new Error(`${pathLabel}: node ${node.id} methods must be an array`);
}

function validateLink(link: RawLink, pathLabel: string) {
  if (!link || typeof link !== "object") throw new Error(`${pathLabel}: link must be an object`);
  const source = endpointId(link.source);
  const target = endpointId(link.target);
  if (!source || !target) throw new Error(`${pathLabel}: every link needs source and target`);
  if (source === target) throw new Error(`${pathLabel}: self link is not allowed: ${source}`);
}

export function validateExtractedFile(extracted: ExtractedFile, pathLabel: string) {
  if (!Array.isArray(extracted.nodes)) throw new Error(`${pathLabel}: extracted.nodes must be an array`);
  if (!Array.isArray(extracted.links)) throw new Error(`${pathLabel}: extracted.links must be an array`);
  for (const node of extracted.nodes) validateNode(node, pathLabel);
  for (const link of extracted.links) validateLink(link, pathLabel);
}

function withProvenance(extracted: ExtractedFile, provenance: AdapterProvenance): ExtractedFile {
  return {
    ...extracted,
    nodes: extracted.nodes.map((node) => ({ ...node, provenance })),
    links: extracted.links.map((link) => ({ ...link, provenance })),
    provenance
  };
}

function warningForFallback(file: SourceFile, adapter: LanguageAdapter, resolution: BackendResolution) {
  if (!resolution.fallbackReason) return undefined;
  return {
    path: file.relativePath,
    language: file.language,
    adapterId: adapter.id,
    backendId: resolution.backendId,
    message: resolution.fallbackReason
  };
}

export async function runLanguageAdapter(
  adapter: LanguageAdapter,
  file: SourceFile,
  context: ExtractContext,
  cached = false
): Promise<AdapterRunResult> {
  const started = performance.now();
  const { resolution, metadata } = await stateFor(adapter, file, context);
  const provenance: AdapterProvenance = {
    adapterId: adapter.id,
    adapterVersion: adapter.version,
    language: adapter.language,
    backendId: resolution.backendId,
    backendKind: resolution.backendKind,
    backendName: resolution.backendName,
    path: file.relativePath,
    confidence: resolution.confidence,
    source: cached ? "cache" : resolution.source,
    tools: resolution.tools,
    notes: resolution.fallbackReason ? [resolution.fallbackReason] : undefined
  };

  let extracted: ExtractedFile;
  if (cached) {
    extracted = { nodes: [], links: [], provenance };
  } else if (resolution.backend?.extract) {
    try {
      extracted = await resolution.backend.extract(file, context);
    } catch (error) {
      const fallback = await adapter.extract(file, context);
      extracted = {
        ...fallback,
        warnings: [
          ...(fallback.warnings ?? []),
          {
            path: file.relativePath,
            language: file.language,
            adapterId: adapter.id,
            backendId: resolution.backendId,
            message: `native extraction failed; fallback parser used: ${
              error instanceof Error ? error.message.split(/\r?\n/)[0] : String(error)
            }`
          }
        ]
      };
    }
  } else {
    extracted = await adapter.extract(file, context);
  }

  const fallbackWarning = warningForFallback(file, adapter, resolution);
  const result = withProvenance(
    {
      ...extracted,
      projectMetadata: metadata ?? extracted.projectMetadata,
      warnings: fallbackWarning ? [...(extracted.warnings ?? []), fallbackWarning] : extracted.warnings
    },
    provenance
  );

  validateExtractedFile(result, file.relativePath);

  return {
    ...result,
    diagnostics: {
      path: file.relativePath,
      language: file.language,
      adapterId: adapter.id,
      adapterVersion: adapter.version,
      backendId: provenance.backendId,
      backendKind: provenance.backendKind,
      backendName: provenance.backendName,
      cached,
      durationMs: Math.round(performance.now() - started),
      nodes: result.nodes.length,
      links: result.links.length,
      warnings: result.warnings?.length ?? 0,
      tools: resolution.tools,
      fallbackReason: resolution.fallbackReason
    }
  };
}

export function cachedAdapterResult(
  adapter: LanguageAdapter,
  file: SourceFile,
  cached: ExtractedFile & { diagnostics?: AdapterFileDiagnostics }
): AdapterRunResult {
  const provenance: AdapterProvenance =
    cached.provenance ?? {
      adapterId: adapter.id,
      adapterVersion: adapter.version,
      language: adapter.language,
      backendId: cached.diagnostics?.backendId ?? "first-pass",
      backendKind: cached.diagnostics?.backendKind ?? "first-pass",
      backendName: cached.diagnostics?.backendName ?? "First-pass structural parser",
      path: file.relativePath,
      confidence: "medium",
      source: "cache",
      tools: cached.diagnostics?.tools
    };
  const result = withProvenance({ ...cached, provenance }, { ...provenance, source: "cache" });
  validateExtractedFile(result, file.relativePath);
  return {
    ...result,
    diagnostics: {
      path: file.relativePath,
      language: file.language,
      adapterId: adapter.id,
      adapterVersion: adapter.version,
      backendId: provenance.backendId,
      backendKind: provenance.backendKind,
      backendName: provenance.backendName,
      cached: true,
      durationMs: 0,
      nodes: result.nodes.length,
      links: result.links.length,
      warnings: result.warnings?.length ?? 0,
      tools: provenance.tools ?? [],
      fallbackReason: cached.diagnostics?.fallbackReason
    }
  };
}
