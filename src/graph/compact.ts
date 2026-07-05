import type { CodeMember, RawGraph, RawLink, RawNode, SourceLocation } from "../types";

const magic = "DPG1\n";

type StringRef = number | undefined;

interface CompactGraphV1 {
  v: 1;
  s: string[];
  n: Array<[
    StringRef,
    StringRef,
    StringRef,
    StringRef,
    StringRef,
    StringRef,
    StringRef,
    number | undefined,
    number | undefined,
    number | undefined,
    CodeMember[] | undefined,
    CodeMember[] | undefined,
    CodeMember[] | undefined,
    SourceLocation | undefined
  ]>;
  l: Array<[
    StringRef,
    StringRef,
    StringRef,
    StringRef,
    number | undefined,
    StringRef,
    StringRef,
    SourceLocation | undefined
  ]>;
  m?: {
    name?: StringRef;
    generatedAt?: StringRef;
    language?: StringRef;
  };
}

function endpointId(endpoint: RawLink["source"]) {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function internTable() {
  const strings: string[] = [];
  const indexes = new Map<string, number>();

  function ref(value: string | undefined): StringRef {
    if (!value) return undefined;
    const existing = indexes.get(value);
    if (typeof existing === "number") return existing;
    const next = strings.length;
    strings.push(value);
    indexes.set(value, next);
    return next;
  }

  return { strings, ref };
}

function value(strings: string[], ref: StringRef) {
  return typeof ref === "number" ? strings[ref] : undefined;
}

export function encodeCompactGraph(graph: RawGraph): Uint8Array {
  const table = internTable();
  const compact: CompactGraphV1 = {
    v: 1,
    s: table.strings,
    n: graph.nodes.map((node) => [
      table.ref(node.id),
      table.ref(node.label),
      table.ref(node.name),
      table.ref(node.module),
      table.ref(node.package),
      table.ref(node.namespace),
      table.ref(typeof node.kind === "string" ? node.kind : undefined),
      node.loc,
      node.complexity,
      node.layer,
      node.fields,
      node.methods,
      node.members,
      node.source
    ]),
    l: (graph.links ?? graph.edges ?? []).map((link) => [
      table.ref(endpointId(link.source)),
      table.ref(endpointId(link.target)),
      table.ref(typeof link.type === "string" ? link.type : undefined),
      table.ref(typeof link.kind === "string" ? link.kind : undefined),
      link.weight,
      table.ref(link.via),
      table.ref(link.reason),
      link.location
    ]),
    m: {
      name: table.ref(graph.meta?.name),
      generatedAt: table.ref(graph.meta?.generatedAt),
      language: table.ref(graph.meta?.language)
    }
  };

  compact.s = table.strings;
  return new TextEncoder().encode(`${magic}${JSON.stringify(compact)}`);
}

export function decodeCompactGraph(input: ArrayBuffer | Uint8Array): RawGraph {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const text = new TextDecoder().decode(bytes);
  if (!text.startsWith(magic)) throw new Error("Unsupported Dependency Palace graph format.");
  const compact = JSON.parse(text.slice(magic.length)) as CompactGraphV1;
  if (compact.v !== 1 || !Array.isArray(compact.s)) throw new Error("Unsupported compact graph version.");
  const strings = compact.s;

  const nodes: RawNode[] = compact.n.map((item) => {
    const node: RawNode = { id: value(strings, item[0]) ?? "" };
    const label = value(strings, item[1]);
    const name = value(strings, item[2]);
    const module = value(strings, item[3]);
    const packageName = value(strings, item[4]);
    const namespace = value(strings, item[5]);
    const kind = value(strings, item[6]);
    if (label) node.label = label;
    if (name) node.name = name;
    if (module) node.module = module;
    if (packageName) node.package = packageName;
    if (namespace) node.namespace = namespace;
    if (kind) node.kind = kind;
    if (typeof item[7] === "number") node.loc = item[7];
    if (typeof item[8] === "number") node.complexity = item[8];
    if (typeof item[9] === "number") node.layer = item[9];
    if (item[10]) node.fields = item[10];
    if (item[11]) node.methods = item[11];
    if (item[12]) node.members = item[12];
    if (item[13]) node.source = item[13];
    return node;
  });

  const links: RawLink[] = compact.l.map((item) => {
    const link: RawLink = {
      source: value(strings, item[0]) ?? "",
      target: value(strings, item[1]) ?? ""
    };
    const type = value(strings, item[2]);
    const kind = value(strings, item[3]);
    const via = value(strings, item[5]);
    const reason = value(strings, item[6]);
    if (type) link.type = type;
    if (kind) link.kind = kind;
    if (typeof item[4] === "number") link.weight = item[4];
    if (via) link.via = via;
    if (reason) link.reason = reason;
    if (item[7]) link.location = item[7];
    return link;
  });

  return {
    nodes,
    links,
    meta: {
      name: value(strings, compact.m?.name),
      generatedAt: value(strings, compact.m?.generatedAt),
      language: value(strings, compact.m?.language)
    }
  };
}
