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
const cacheDir = path.join(artifactDir, "cache");

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
    if (!node.provenance?.adapterId || !node.provenance.backendId) fail(`node ${node.id} is missing adapter provenance`);
    ids.add(node.id);
  }

  for (const link of graph.links ?? []) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    if (!source || !target) fail("every link needs source and target");
    if (source === target) fail(`self link is not allowed: ${source}`);
    if (!link.provenance?.adapterId || !link.provenance.backendId) fail(`link ${source} -> ${target} is missing adapter provenance`);
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
  const scanArgs = [
    "src/cli/scan.ts",
    "fixtures/polyglot",
    "--out",
    graphPath,
    "--diagnostics-out",
    diagnosticsPath,
    "--module-depth",
    "2",
    "--cache-dir",
    cacheDir
  ];

  const first = await execFileAsync(
    "tsx",
    [
      ...scanArgs,
      "--clear-cache"
    ],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  if (first.stdout.trim()) console.log(first.stdout.trim());
  if (first.stderr.trim()) console.error(first.stderr.trim());

  const firstDiagnostics = JSON.parse(await readFile(diagnosticsPath, "utf8")) as ScanDiagnostics;
  if (firstDiagnostics.cache.hits !== 0) fail(`expected first scan to have 0 cache hits, got ${firstDiagnostics.cache.hits}`);
  if (!firstDiagnostics.adapterRuns.length) fail("missing per-file adapter run diagnostics");
  if (!Object.keys(firstDiagnostics.adapters).length) fail("missing adapter aggregate diagnostics");
  if (firstDiagnostics.adapterRuns.some((run) => !run.adapterId || !run.backendId)) fail("adapter run diagnostics missing adapter/backend ids");
  if (firstDiagnostics.native.availableBackends < 1) fail("expected fixture scan to exercise at least one native metadata backend");

  const second = await execFileAsync("tsx", scanArgs, { maxBuffer: 10 * 1024 * 1024 });
  if (second.stdout.trim()) console.log(second.stdout.trim());
  if (second.stderr.trim()) console.error(second.stderr.trim());

  const graph = JSON.parse(await readFile(graphPath, "utf8")) as RawGraph;
  const diagnostics = JSON.parse(await readFile(diagnosticsPath, "utf8")) as ScanDiagnostics;
  validateGraph(graph);

  if (diagnostics.filesScanned < 20) fail(`expected broad polyglot fixture coverage, got ${diagnostics.filesScanned} scanned files`);
  if (diagnostics.cache.hits !== diagnostics.filesScanned) fail(`expected second scan to reuse every cached file, got ${diagnostics.cache.hits}/${diagnostics.filesScanned}`);
  if (diagnostics.adapterRuns.some((run) => !run.cached)) fail("expected second scan adapter runs to be cache hits");
  if (!diagnostics.native || typeof diagnostics.native.enabled !== "boolean") fail("missing native diagnostics");
  if (!diagnostics.languages.haskell?.files) fail("missing Haskell diagnostics");
  if (!diagnostics.languages.java?.files) fail("missing Java diagnostics");
  for (const language of ["rust", "go", "typescript", "javascript", "python", "csharp", "cpp", "c", "kotlin", "scala", "swift", "ruby", "php"] as const) {
    if (!diagnostics.languages[language]?.files) fail(`missing ${language} diagnostics`);
  }
  if (!diagnostics.languages.java.backends["javac-project-metadata"] && !diagnostics.languages.java.backends["first-pass"]) {
    fail("missing Java backend diagnostics");
  }
  if (!diagnostics.warnings.some((warning) => warning.message.includes("graph extraction uses fallback parser"))) {
    fail("expected deterministic fallback diagnostics for metadata-only native backends");
  }
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
  requireLink(graph, "com.acme.orders.OrderService", "com.acme.orders.OrderRepository", "calls", "repository.find");

  requireNode(graph, "polyglot_rust::rust::PaymentService", "class");
  requireNode(graph, "polyglot_rust::rust::PaymentPort", "interface");
  requireLink(graph, "polyglot_rust::rust::PaymentService", "polyglot_rust::rust::PaymentPort", "implements");

  requireNode(graph, "example.com/dependency-palace/polyglot/go/orders.PaymentService", "class");
  requireNode(graph, "example.com/dependency-palace/polyglot/go/orders.PaymentPort", "interface");

  requireNode(graph, "typescript.orders.PaymentService", "class");
  requireNode(graph, "typescript.orders.PaymentPort", "interface");
  requireLink(graph, "typescript.orders.PaymentService", "typescript.orders.PaymentPort", "implements");
  requireLink(graph, "typescript.orders.PaymentService", "../billing/invoice.InvoiceRepository", "contains", "invoices");
  requireLink(graph, "typescript.orders.PaymentService", "../billing/invoice.InvoiceRepository", "calls", "invoices.create");

  requireNode(graph, "javascript.orders.PaymentService", "class");
  requireNode(graph, "python.orders.PaymentService", "class");
  requireLink(graph, "python.orders.PaymentService", "python.orders.InvoiceRepository", "contains", "invoices");
  requireLink(graph, "python.orders.PaymentService", "python.orders.InvoiceRepository", "calls", "self.invoices.create");

  requireNode(graph, "Acme.Orders.PaymentService", "class");
  requireLink(graph, "Acme.Orders.PaymentService", "Acme.Orders.InvoiceRepository", "contains", "invoices");
  requireNode(graph, "orders.PaymentService", "class");
  requireNode(graph, "c.native.PaymentService", "class");
  requireLink(graph, "c.native.PaymentService", "c.native.PaymentReceipt", "contains", "last_receipt");

  requireNode(graph, "com.acme.kotlinorders.PaymentService", "class");
  requireNode(graph, "com.acme.scalaorders.PaymentService", "class");
  requireNode(graph, "swift.PaymentService", "class");
  requireNode(graph, "ruby.orders.PaymentService", "class");
  requireNode(graph, "Acme\\Orders.PaymentService", "class");

  console.log(
    `adapter fixtures: ok (${graph.nodes.length} nodes, ${(graph.links ?? []).length} links, ${diagnostics.unresolvedEdges} unresolved edges)`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
