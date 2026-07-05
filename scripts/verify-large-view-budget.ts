import { layoutViewGraph } from "../src/graph/layout";
import { analyzeGraph, buildViewGraph, normalizeGraph } from "../src/graph/model";
import type { RawGraph, RawLink, RawNode } from "../src/types";

const nodeCount = Number(process.argv[2] ?? 10_000);
const linkCount = Number(process.argv[3] ?? 100_000);

function fail(message: string): never {
  throw new Error(message);
}

function createLargeGraph(): RawGraph {
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];
  const kinds = ["class", "interface", "datatype", "function"] as const;
  const edgeTypes = ["imports", "uses", "calls", "contains", "implements", "inherits"] as const;

  for (let index = 0; index < nodeCount; index += 1) {
    const module = `module-${index % 40}`;
    const packageName = `${module}.pkg-${Math.floor(index / 40) % 80}`;
    nodes.push({
      id: `${packageName}.Type${index}`,
      label: `Type${index}`,
      module,
      package: packageName,
      kind: kinds[index % kinds.length],
      loc: 10 + (index % 300),
      complexity: 1 + (index % 25),
      fields: index % 3 === 0 ? [{ name: `field${index % 11}`, kind: "field", type: "Value", visibility: "private" }] : [],
      methods: index % 2 === 0 ? [{ name: `method${index % 17}`, kind: "method", visibility: "public" }] : []
    });
  }

  for (let index = 0; index < linkCount; index += 1) {
    const source = (index * 37) % nodeCount;
    const target = (index * 91 + 17) % nodeCount;
    if (source === target) continue;
    links.push({
      source: nodes[source].id,
      target: nodes[target].id,
      type: edgeTypes[index % edgeTypes.length],
      weight: 1 + (index % 5),
      via: index % 7 === 0 ? `method${index % 17}` : undefined
    });
  }

  return {
    nodes,
    links,
    meta: {
      name: `synthetic-${nodeCount}-${linkCount}`,
      language: "synthetic"
    }
  };
}

function time<T>(label: string, fn: () => T) {
  const started = performance.now();
  const value = fn();
  return { label, value, ms: Math.round(performance.now() - started) };
}

const raw = createLargeGraph();
const normalized = time("normalize", () => normalizeGraph(raw));
const analysis = time("analyze", () => analyzeGraph(normalized.value));
const selectedId = analysis.value.topHubs[0]?.id ?? raw.nodes[0]?.id ?? null;

const overview = time("overview", () =>
  buildViewGraph(normalized.value, {
    mode: "overview",
    query: "",
    module: "all",
    minDegree: 0,
    selectedId,
    focusDepth: 1,
    edgeTypes: new Set(),
    edgeDensity: "balanced"
  })
);
const focused = time("focus", () =>
  buildViewGraph(normalized.value, {
    mode: "focus",
    query: "",
    module: "all",
    minDegree: 0,
    selectedId,
    focusDepth: 1,
    edgeTypes: new Set(),
    edgeDensity: "quiet"
  })
);
const layout = time("layout", () => layoutViewGraph(focused.value, selectedId, "palace"));

if (overview.value.links.length > 900) fail(`overview exceeded link budget: ${overview.value.links.length}`);
if (focused.value.nodes.length > 260) fail(`focus exceeded node budget: ${focused.value.nodes.length}`);
if (!selectedId || !focused.value.nodes.some((node) => node.id === selectedId)) fail("focus view lost selected node");
if (layout.value.nodes.length === 0) fail("layout produced no nodes");

console.log(
  JSON.stringify(
    {
      raw: { nodes: raw.nodes.length, links: raw.links?.length ?? 0 },
      normalized: { nodes: normalized.value.nodes.length, links: normalized.value.links.length, ms: normalized.ms },
      analyzeMs: analysis.ms,
      overview: {
        nodes: overview.value.nodes.length,
        links: overview.value.links.length,
        hiddenLinks: overview.value.hiddenLinks,
        ms: overview.ms
      },
      focus: {
        nodes: focused.value.nodes.length,
        links: focused.value.links.length,
        hiddenLinks: focused.value.hiddenLinks,
        selectedId,
        ms: focused.ms
      },
      layout: {
        nodes: layout.value.nodes.length,
        links: layout.value.links.length,
        ms: layout.ms
      }
    },
    null,
    2
  )
);
