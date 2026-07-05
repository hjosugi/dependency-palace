import type { CodeMember, DependencyKind, NodeKind, RawGraph, RawLink, RawNode, SourceLocation } from "../types";

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

export interface ExtractedFile {
  nodes: RawNode[];
  links: RawLink[];
  warnings?: AdapterWarning[];
}

export interface ExtractContext {
  root: string;
  moduleDepth: number;
}

export interface LanguageAdapter {
  language: SourceLanguage;
  extensions: string[];
  level?: "first-pass" | "native" | "external";
  limitations?: string[];
  extract(file: SourceFile, context: ExtractContext): ExtractedFile;
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
  watchIntervalMs?: number;
}

export interface AdapterWarning {
  path: string;
  language?: SourceLanguage;
  message: string;
  line?: number;
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
  languages: Partial<Record<SourceLanguage, LanguageScanDiagnostics>>;
  skipped: SkippedFile[];
  warnings: AdapterWarning[];
}

export type { CodeMember, DependencyKind, NodeKind, RawGraph, RawLink, RawNode, SourceLocation };
