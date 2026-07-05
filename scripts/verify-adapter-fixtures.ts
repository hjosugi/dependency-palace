import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { RawGraph, RawLink, RawNode } from "../src/types";
import type { ScanDiagnostics } from "../src/extract/types";

const execFileAsync = promisify(execFile);
const artifactDir = path.resolve("artifacts", "adapter-fixtures");
const graphPath = path.join(artifactDir, "polyglot.graph.json");
const diagnosticsPath = path.join(artifactDir, "polyglot.diagnostics.json");

function endpointId(endpoint: RawLink["source"]) {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function fail(message: string): never {
  throw new Error(message);
}

function validateGraph(graph: RawGraph) {
  if (!Array.isArray(graph.nodes)) fail("graph.nodes must be an array");
  if (graph.links && !Array.isArray(graph.links)) fail("graph.links must be an array when present");

  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id || typeof node.id !== "string") fail("every node needs a string id");
    if (ids.has(node.id)) fail(`duplicate node id: ${node.id}`);
    ids.add(node.id);
  }

  for (const link of graph.links ?? []) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    if (!source || !target) fail("every link needs source and target");
    if (source === target) fail(`self link is not allowed: ${source}`);
  }
}

function nodeById(graph: RawGraph, id: string) {
  return graph.nodes.find((node) => node.id === id);
}

function requireNode(graph: RawGraph, id: string, kind?: RawNode["kind"]) {
  const node = nodeById(graph, id) ?? fail(`missing node: ${id}`);
  if (kind && node.kind !== kind) fail(`node ${id} expected kind ${kind}, got ${node.kind}`);
  if (!node.source?.path || !node.source.startLine) fail(`node ${id} is missing source metadata`);
  return node;
}

function requireLink(graph: RawGraph, source: string, target: string, type: string, via?: string) {
  const link = (graph.links ?? []).find((item) => {
    return endpointId(item.source) === source && endpointId(item.target) === target && item.type === type && (!via || item.via === via);
  });
  if (!link) fail(`missing ${type} link: ${source} -> ${target}${via ? ` via ${via}` : ""}`);
  return link;
}

async function main() {
  await mkdir(artifactDir, { recursive: true });
  const { stdout, stderr } = await execFileAsync(
    "tsx",
    [
      "src/cli/scan.ts",
      "fixtures/polyglot",
      "--out",
      graphPath,
      "--diagnostics-out",
      diagnosticsPath,
      "--module-depth",
      "2"
    ],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());

  const graph = JSON.parse(await readFile(graphPath, "utf8")) as RawGraph;
  const diagnostics = JSON.parse(await readFile(diagnosticsPath, "utf8")) as ScanDiagnostics;
  validateGraph(graph);

  if (diagnostics.filesScanned < 2) fail(`expected at least 2 scanned files, got ${diagnostics.filesScanned}`);
  if (!diagnostics.languages.haskell?.files) fail("missing Haskell diagnostics");
  if (!diagnostics.languages.java?.files) fail("missing Java diagnostics");
  if (diagnostics.nodesEmitted !== graph.nodes.length) fail("diagnostic node count does not match graph");
  if (diagnostics.linksEmitted !== (graph.links ?? []).length) fail("diagnostic link count does not match graph");

  requireNode(graph, "Domain.Order", "datatype");
  requireNode(graph, "Domain.Repository", "typeclass");
  requireNode(graph, "Domain.validateOrder", "function");
  requireLink(graph, "Domain.Order", "Domain.Customer", "contains", "orderCustomer");
  requireLink(graph, "Domain.Order", "Domain.Amount", "contains", "orderTotal");
  requireLink(graph, "Domain.validateOrder", "Domain.Repository", "constrains", "validateOrder");
  requireLink(graph, "Domain.validateOrder", "Domain.lookupCustomer", "composes", "validateOrder");
  requireLink(graph, "Domain.validateOrder", "Domain.createReceipt", "composes", "validateOrder");
  requireLink(graph, "Domain.validateOrder", "Domain.persistReceipt", "composes", "validateOrder");

  requireNode(graph, "com.acme.orders.OrderService", "class");
  requireNode(graph, "com.acme.orders.OrderUseCase", "interface");
  requireNode(graph, "com.acme.orders.Order", "datatype");
  requireLink(graph, "com.acme.orders.OrderService", "OrderUseCase", "implements");
  requireLink(graph, "com.acme.orders.OrderService", "com.acme.orders.OrderRepository", "contains", "repository");
  requireLink(graph, "com.acme.orders.OrderService", "com.acme.orders.FraudPolicy", "contains", "fraudPolicy");

  console.log(
    `adapter fixtures: ok (${graph.nodes.length} nodes, ${(graph.links ?? []).length} links, ${diagnostics.unresolvedEdges} unresolved edges)`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
