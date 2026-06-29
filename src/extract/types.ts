import type { CodeMember, DependencyKind, NodeKind, RawGraph, RawLink, RawNode } from "../types";

export type SourceLanguage =
  | "c"
  | "cpp"
  | "csharp"
  | "go"
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

export type { CodeMember, DependencyKind, NodeKind, RawGraph, RawLink, RawNode };
