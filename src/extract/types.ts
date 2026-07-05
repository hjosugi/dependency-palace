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
  extract(file: SourceFile, context: ExtractContext): ExtractedFile;
}

export interface ScanOptions {
  root: string;
  out: string;
  diagnosticsOut: string;
  configPath?: string;
  include: string[];
  exclude: string[];
  moduleDepth: number;
  maxFileBytes: number;
}

export interface ScanConfig {
  include?: string[];
  exclude?: string[];
  moduleDepth?: number;
  maxFileBytes?: number;
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
  nodes: number;
  links: number;
}

export interface ScanDiagnostics {
  root: string;
  generatedAt: string;
  filesScanned: number;
  filesSkipped: number;
  nodesEmitted: number;
  linksEmitted: number;
  unresolvedEdges: number;
  languages: Partial<Record<SourceLanguage, LanguageScanDiagnostics>>;
  skipped: SkippedFile[];
  warnings: AdapterWarning[];
}

export type { CodeMember, DependencyKind, NodeKind, RawGraph, RawLink, RawNode, SourceLocation };
