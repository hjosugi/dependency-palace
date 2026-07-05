import type { CodeMember, DependencyKind, NodeKind, RawGraph, RawLink, RawNode, SourceLocation, Visibility } from "../types";

export type SourceLanguage =
  | "c"
  | "cpp"
  | "csharp"
  | "go"
  | "haskell"
  | "java"
  | "javascript"
  | "kotlin"
  | "php"
  | "python"
  | "ruby"
  | "rust"
  | "scala"
  | "swift"
  | "typescript";

export interface SourceFile {
  absolutePath: string;
  relativePath: string;
  language: SourceLanguage;
  text: string;
  contentHash?: string;
}

export type AdapterBackendKind = "first-pass" | "native" | "lsp" | "compiler-metadata" | "external";

export interface AdapterToolProbe {
  name: string;
  command: string;
  args?: string[];
  available: boolean;
  version?: string;
  error?: string;
}

export interface AdapterProvenance {
  adapterId: string;
  adapterVersion: string;
  language: SourceLanguage;
  backendId: string;
  backendKind: AdapterBackendKind;
  backendName: string;
  path: string;
  confidence: "high" | "medium" | "low";
  source: "native" | "fallback" | "cache";
  tools?: AdapterToolProbe[];
  notes?: string[];
}

export interface AdapterWarning {
  path: string;
  language?: SourceLanguage;
  adapterId?: string;
  backendId?: string;
  message: string;
  line?: number;
}

export interface ExtractedFile {
  nodes: RawNode[];
  links: RawLink[];
  warnings?: AdapterWarning[];
  provenance?: AdapterProvenance;
  projectMetadata?: Record<string, unknown>;
}

export interface ExtractContext {
  root: string;
  moduleDepth: number;
  native: boolean;
}

export type MaybePromise<T> = T | Promise<T>;

export interface NativeAdapterBackend {
  id: string;
  name: string;
  kind: Exclude<AdapterBackendKind, "first-pass">;
  confidence: AdapterProvenance["confidence"];
  tools: Array<{
    name: string;
    command: string;
    args?: string[];
  }>;
  markers?: string[];
  collectMetadata?: (file: SourceFile, context: ExtractContext) => MaybePromise<Record<string, unknown>>;
  extract?: (file: SourceFile, context: ExtractContext) => MaybePromise<ExtractedFile>;
}

export interface LanguageAdapter {
  id: string;
  language: SourceLanguage;
  extensions: string[];
  version: string;
  level?: AdapterBackendKind;
  limitations?: string[];
  nativeBackends?: NativeAdapterBackend[];
  extract(file: SourceFile, context: ExtractContext): MaybePromise<ExtractedFile>;
}

export interface ScanOptions {
  root: string;
  out: string;
  diagnosticsOut: string;
  compactOut: string;
  configPath?: string;
  include: string[];
  exclude: string[];
  moduleDepth: number;
  maxFileBytes: number;
  cache: boolean;
  cacheDir: string;
  clearCache: boolean;
  native: boolean;
  format: "json" | "compact" | "both";
  watch: boolean;
  watchIntervalMs: number;
}

export interface ScanConfig {
  include?: string[];
  exclude?: string[];
  moduleDepth?: number;
  maxFileBytes?: number;
  cache?: boolean;
  cacheDir?: string;
  native?: boolean;
  watchIntervalMs?: number;
}

export interface SkippedFile {
  path: string;
  reason: string;
  bytes?: number;
}

export interface LanguageScanDiagnostics {
  files: number;
  cached: number;
  nodes: number;
  links: number;
  warnings: number;
  backends: Record<string, number>;
}

export interface AdapterFileDiagnostics {
  path: string;
  language: SourceLanguage;
  adapterId: string;
  adapterVersion: string;
  backendId: string;
  backendKind: AdapterBackendKind;
  backendName: string;
  cached: boolean;
  durationMs: number;
  nodes: number;
  links: number;
  warnings: number;
  tools: AdapterToolProbe[];
  fallbackReason?: string;
}

export interface AdapterScanDiagnostics {
  adapterId: string;
  language: SourceLanguage;
  version: string;
  files: number;
  cached: number;
  nodes: number;
  links: number;
  warnings: number;
  backends: Record<string, number>;
  tools: AdapterToolProbe[];
}

export interface ScanDiagnostics {
  schemaVersion: 1;
  root: string;
  generatedAt: string;
  durationMs: number;
  filesScanned: number;
  filesSkipped: number;
  nodesEmitted: number;
  linksEmitted: number;
  unresolvedEdges: number;
  outputs: {
    json?: string;
    compact?: string;
    diagnostics: string;
  };
  bytes: {
    json?: number;
    compact?: number;
  };
  cache: {
    enabled: boolean;
    dir?: string;
    adapterVersion: string;
    hits: number;
    misses: number;
    writes: number;
  };
  native: {
    enabled: boolean;
    availableBackends: number;
    fallbackRuns: number;
  };
  languages: Partial<Record<SourceLanguage, LanguageScanDiagnostics>>;
  adapters: Record<string, AdapterScanDiagnostics>;
  adapterRuns: AdapterFileDiagnostics[];
  skipped: SkippedFile[];
  warnings: AdapterWarning[];
}

export type { CodeMember, DependencyKind, NodeKind, RawGraph, RawLink, RawNode, SourceLocation, Visibility };
