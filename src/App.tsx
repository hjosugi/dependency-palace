import { useEffect, useMemo, useRef, useState } from "react";
import {
  Atom,
  Box,
  Boxes,
  Braces,
  Building2,
  Camera,
  CircleDot,
  Crosshair,
  Dna,
  FileUp,
  Layers3,
  Network,
  Orbit,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TreePine,
  Waypoints
} from "lucide-react";
import { GraphScene, type GraphSceneHandle } from "./GraphScene";
import { createDemoGraph, createStarterGraph, demoSizes, type DemoSize } from "./data/sampleGraph";
import type { ScanDiagnostics } from "./extract/types";
import { decodeCompactGraph } from "./graph/compact";
import { analyzeGraph, buildViewGraph, normalizeGraph } from "./graph/model";
import { edgePalette, layoutViewGraph } from "./graph/layout";
import type {
  DependencyKind,
  DisplayLink,
  DisplayNode,
  EdgeDensity,
  GraphAnalysis,
  GraphData,
  GraphWorkerTimings,
  RawGraph,
  RenderStats,
  ViewGraph,
  ViewMode,
  VisualizationMetaphor
} from "./types";

const numberFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function formatBytes(value: number | undefined) {
  if (!value) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function viewLabel(mode: ViewMode) {
  if (mode === "overview") return "Map";
  if (mode === "focus") return "Focus";
  return "Types";
}

function nodeVoice(node: DisplayNode | NonNullable<ReturnType<typeof normalizeGraph>["nodes"][number]>) {
  if (node.kind === "typeclass" || node.kind === "interface") return "contract surface";
  if (node.kind === "datatype") return "data body";
  if (node.kind === "function") return "behavior pipeline";
  if (node.role === "boundary") return "boundary";
  if (node.role === "adapter") return "adapter";
  if (node.role === "state") return "state holder";
  if (node.role === "behavior") return "behavior";
  return node.kind;
}

function sourceLabel(node: DisplayNode | NonNullable<ReturnType<typeof normalizeGraph>["nodes"][number]>) {
  const source = node.source;
  if (!source) return null;
  const end = source.endLine && source.endLine !== source.startLine ? `-${source.endLine}` : "";
  return `${source.path}:${source.startLine}${end}`;
}

function relationPriorityScore(type: DependencyKind) {
  if (type === "implements" || type === "instance" || type === "constrains") return 6;
  if (type === "inherits" || type === "derives") return 5;
  if (type === "contains" || type === "composes") return 4;
  if (type === "calls") return 3;
  if (type === "creates" || type === "uses") return 2;
  if (type === "imports") return 1;
  return 0;
}

const metaphorOptions: Array<{ id: VisualizationMetaphor; label: string; icon: typeof Box }> = [
  { id: "palace", label: "Palace", icon: Box },
  { id: "tree", label: "Tree", icon: TreePine },
  { id: "blocks", label: "Blocks", icon: Boxes },
  { id: "organism", label: "Life", icon: Dna },
  { id: "space", label: "Space", icon: Orbit },
  { id: "atomic", label: "Atomic", icon: Atom },
  { id: "city", label: "City", icon: Building2 }
];

type ExampleDescriptor = {
  id: string;
  title: string;
  file: string;
  nodes: number;
  links: number;
  complexity: string;
  language: string;
  description: string;
  recommended?: {
    view?: ViewMode;
    form?: VisualizationMetaphor;
    focusDepth?: number;
    minDegree?: number;
    module?: string;
  };
};

interface GraphWorkerResult {
  id: number;
  graph: GraphData;
  analysis: GraphAnalysis;
  view: ViewGraph;
  displayGraph: {
    nodes: DisplayNode[];
    links: DisplayLink[];
  };
  timings: GraphWorkerTimings;
}

function graphFingerprint(graph: RawGraph) {
  return [
    graph.meta?.generatedAt ?? "",
    graph.meta?.name ?? "",
    graph.nodes.length,
    graph.links?.length ?? graph.edges?.length ?? 0
  ].join("|");
}

async function fetchGraphResource(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  if (url.endsWith(".dpg")) return decodeCompactGraph(await response.arrayBuffer());
  return (await response.json()) as RawGraph;
}

async function fetchGeneratedGraph() {
  return (await fetchGraphResource("/dependency-palace.graph.dpg")) ?? (await fetchGraphResource("/dependency-palace.graph.json"));
}

function computeGraphResult(
  id: number,
  rawGraph: RawGraph,
  options: {
    mode: ViewMode;
    query: string;
    module: string;
    minDegree: number;
    selectedId: string | null;
    focusDepth: number;
    edgeTypes: Set<DependencyKind>;
    edgeDensity: EdgeDensity;
  },
  metaphor: VisualizationMetaphor
): GraphWorkerResult {
  const started = performance.now();
  const normalizeStart = performance.now();
  const graph = normalizeGraph(rawGraph);
  const normalizeMs = performance.now() - normalizeStart;
  const analyzeStart = performance.now();
  const analysis = analyzeGraph(graph);
  const analyzeMs = performance.now() - analyzeStart;
  const filterStart = performance.now();
  const view = buildViewGraph(graph, options);
  const filterMs = performance.now() - filterStart;
  const layoutStart = performance.now();
  const displayGraph = layoutViewGraph(view, options.selectedId, metaphor);
  const layoutMs = performance.now() - layoutStart;

  return {
    id,
    graph,
    analysis,
    view,
    displayGraph,
    timings: {
      normalizeMs: Math.round(normalizeMs),
      analyzeMs: Math.round(analyzeMs),
      filterMs: Math.round(filterMs),
      layoutMs: Math.round(layoutMs),
      totalMs: Math.round(performance.now() - started)
    }
  };
}

export default function App() {
  const [rawGraph, setRawGraph] = useState<RawGraph>(() => createStarterGraph());
  const [mode, setModeState] = useState<ViewMode>("focus");
  const [metaphor, setMetaphor] = useState<VisualizationMetaphor>("palace");
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [minDegree, setMinDegree] = useState(0);
  const [focusDepth, setFocusDepth] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{ node: DisplayNode; point: { x: number; y: number } } | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edgeTypes, setEdgeTypes] = useState<Set<DependencyKind>>(new Set());
  const [edgeDensity, setEdgeDensity] = useState<EdgeDensity>("balanced");
  const [examples, setExamples] = useState<ExampleDescriptor[]>([]);
  const [loadingExample, setLoadingExample] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<ScanDiagnostics | null>(null);
  const [renderStats, setRenderStats] = useState<RenderStats>({
    backend: "unknown",
    nodeInstances: 0,
    links: 0,
    lineSegments: 0,
    bufferBytes: 0,
    uploadMs: 0
  });
  const [workerResult, setWorkerResult] = useState<GraphWorkerResult | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sceneRef = useRef<GraphSceneHandle | null>(null);
  const generatedFingerprintRef = useRef(graphFingerprint(rawGraph));
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const workerOptions = useMemo(
    () => ({
      mode,
      query,
      module: moduleFilter,
      minDegree,
      selectedId,
      focusDepth,
      edgeTypes,
      edgeDensity
    }),
    [edgeDensity, edgeTypes, focusDepth, minDegree, mode, moduleFilter, query, selectedId]
  );

  const syncResult = useMemo(
    () => computeGraphResult(requestIdRef.current, rawGraph, workerOptions, metaphor),
    [metaphor, rawGraph, workerOptions]
  );
  const currentResult = workerReady && workerResult ? workerResult : syncResult;
  const graph = currentResult.graph;
  const analysis = currentResult.analysis;
  const view = currentResult.view;
  const displayGraph = currentResult.displayGraph;

  useEffect(() => {
    try {
      const worker = new Worker(new URL("./graph/worker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<GraphWorkerResult>) => {
        if (event.data.id !== requestIdRef.current) return;
        setWorkerResult(event.data);
        setWorkerReady(true);
      };
      worker.onerror = () => {
        setWorkerReady(false);
        workerRef.current = null;
        worker.terminate();
      };
      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      setWorkerReady(false);
      return undefined;
    }
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) {
      setWorkerReady(false);
      return;
    }
    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    setWorkerReady(false);
    worker.postMessage({
      id,
      rawGraph,
      options: {
        ...workerOptions,
        edgeTypes: Array.from(workerOptions.edgeTypes)
      },
      metaphor
    });
  }, [metaphor, rawGraph, workerOptions]);

  useEffect(() => {
    let cancelled = false;

    async function refreshGeneratedGraph() {
      try {
        const loaded = await fetchGeneratedGraph();
        if (cancelled || !loaded?.nodes?.length) return;
        const fingerprint = graphFingerprint(loaded);
        if (fingerprint === generatedFingerprintRef.current) return;
        generatedFingerprintRef.current = fingerprint;
        setRawGraph(loaded);
        setModeState("focus");
        setSelectedId((current) => (current && loaded.nodes.some((node) => node.id === current) ? current : null));
      } catch {
        // No generated graph is present; keep the built-in demo.
      }
    }

    void refreshGeneratedGraph();
    const timer = window.setInterval(() => void refreshGeneratedGraph(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshDiagnostics() {
      try {
        const response = await fetch("/dependency-palace.graph.json.diagnostics.json", { cache: "no-store" });
        if (!response.ok) return;
        const loaded = (await response.json()) as ScanDiagnostics;
        if (!cancelled) setDiagnostics(loaded);
      } catch {
        // Diagnostics are optional until the scanner has written them.
      }
    }

    void refreshDiagnostics();
    const timer = window.setInterval(() => void refreshDiagnostics(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/examples/index.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((items: ExampleDescriptor[]) => {
        if (!cancelled && Array.isArray(items)) setExamples(items);
      })
      .catch(() => {
        // Examples are optional in development.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setEdgeTypes(new Set(analysis.edgeTypes));
  }, [analysis.edgeTypes.join("|")]);

  useEffect(() => {
    if (selectedId && !graph.nodes.some((node) => node.id === selectedId)) {
      setSelectedId(null);
    }
  }, [graph.nodes, selectedId]);

  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedId) ?? null,
    [graph.nodes, selectedId]
  );
  const selectedSource = selectedNode ? sourceLabel(selectedNode) : null;

  useEffect(() => {
    if (mode === "focus" && !selectedId && analysis.topHubs[0]) {
      setSelectedId(analysis.topHubs[0].id);
    }
  }, [analysis.topHubs, mode, selectedId]);

  const selectedRelations = useMemo(() => {
    if (!selectedId) return [];
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    return graph.links
      .filter((link) => link.source === selectedId || link.target === selectedId)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 14)
      .map((link) => ({
        link,
        direction: link.source === selectedId ? "out" : "in",
        other: byId.get(link.source === selectedId ? link.target : link.source)
      }));
  }, [graph.links, graph.nodes, selectedId]);

  const selectedSignal = useMemo(() => {
    if (!selectedNode) return null;
    const linksForNode = graph.links.filter((link) => link.source === selectedNode.id || link.target === selectedNode.id);
    const counts = new Map<DependencyKind, number>();
    for (const link of linksForNode) counts.set(link.type, (counts.get(link.type) ?? 0) + 1);
    const strongest = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const cycleText =
      selectedNode.sccSize > 1
        ? `cycle group ${formatNumber(selectedNode.sccSize)}`
        : selectedNode.degree >= 24
          ? "hot hub"
          : selectedNode.degree >= 10
            ? "busy local hub"
            : "local symbol";
    const contractPressure =
      (counts.get("implements") ?? 0) + (counts.get("instance") ?? 0) + (counts.get("constrains") ?? 0);
    const statePressure = (counts.get("contains") ?? 0) + selectedNode.fields.length;
    const behaviorPressure =
      (counts.get("calls") ?? 0) + (counts.get("composes") ?? 0) + (counts.get("creates") ?? 0) + selectedNode.methods.length;
    const cyclePressure = selectedNode.sccSize > 1 ? selectedNode.sccSize : 0;
    const incoming = linksForNode
      .filter((link) => link.target === selectedNode.id)
      .sort((a, b) => relationPriorityScore(b.type) - relationPriorityScore(a.type) || b.weight - a.weight)
      .slice(0, 3);
    const outgoing = linksForNode
      .filter((link) => link.source === selectedNode.id)
      .sort((a, b) => relationPriorityScore(b.type) - relationPriorityScore(a.type) || b.weight - a.weight)
      .slice(0, 3);
    const summary =
      selectedNode.kind === "typeclass"
        ? "typeclass contract"
        : selectedNode.kind === "datatype"
          ? "data body with field composition"
          : selectedNode.kind === "function"
            ? "function pipeline and constraints"
            : selectedNode.role === "behavior"
              ? "behavior surface with collaborators"
              : selectedNode.role === "state"
                ? "state model and owned data"
                : "local dependency role";

    return {
      voice: nodeVoice(selectedNode),
      members: `${formatNumber(selectedNode.fields.length)} state / ${formatNumber(selectedNode.methods.length)} behavior`,
      pressure: `${cycleText} / ${selectedNode.inbound} in / ${selectedNode.outbound} out`,
      strongest,
      summary,
      pressures: [
        ["contract", contractPressure],
        ["state", statePressure],
        ["behavior", behaviorPressure],
        ["cycle", cyclePressure]
      ] as Array<[string, number]>,
      incoming,
      outgoing
    };
  }, [graph.links, selectedNode]);

  function setMode(nextMode: ViewMode) {
    if (nextMode === "focus" && !selectedId) {
      setSelectedId(analysis.topHubs[0]?.id ?? null);
    }
    setModeState(nextMode);
  }

  function loadDemo(size: DemoSize) {
    const nextGraph = createDemoGraph(size);
    generatedFingerprintRef.current = graphFingerprint(nextGraph);
    setRawGraph(nextGraph);
    setSelectedId(null);
    setModeState("focus");
    setQuery("");
    setModuleFilter("all");
    setMinDegree(0);
    setLoadError(null);
  }

  function toggleEdgeType(type: DependencyKind) {
    setEdgeTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function onFileSelected(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = file.name.endsWith(".dpg")
        ? decodeCompactGraph(await file.arrayBuffer())
        : (JSON.parse(await file.text()) as RawGraph);
      if (!Array.isArray(parsed.nodes)) throw new Error("JSON must contain a nodes array.");
      generatedFingerprintRef.current = graphFingerprint(parsed);
      setRawGraph(parsed);
      setModeState("focus");
      setSelectedId(null);
      setQuery("");
      setModuleFilter("all");
      setMinDegree(0);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the JSON file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function loadExample(example: ExampleDescriptor) {
    try {
      setLoadingExample(example.id);
      const parsed = await fetchGraphResource(example.file);
      if (!parsed) throw new Error(`Could not load ${example.title}.`);
      if (!Array.isArray(parsed.nodes)) throw new Error("Example JSON must contain a nodes array.");
      const recommended = example.recommended;
      generatedFingerprintRef.current = graphFingerprint(parsed);
      setRawGraph(parsed);
      setModeState(recommended?.view ?? "focus");
      setSelectedId(null);
      setQuery("");
      setModuleFilter(recommended?.module ?? "all");
      setMinDegree(recommended?.minDegree ?? 0);
      setFocusDepth(recommended?.focusDepth ?? 1);
      setMetaphor(recommended?.form ?? "palace");
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the example.");
    } finally {
      setLoadingExample(null);
    }
  }

  const density = view.nodes.length > 0 ? view.links.length / view.nodes.length : 0;

  return (
    <div className="app-shell">
      <aside className="side-panel left-panel" aria-label="Graph controls">
        <header className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <img src="/favicon.svg" alt="" width="28" height="28" />
          </div>
          <div>
            <h1>Dependency Palace</h1>
            <p>{graph.meta.name}</p>
          </div>
        </header>

        <section className="panel-section">
          <div className="section-title">
            <Layers3 size={16} />
            View
          </div>
          <div className="segmented" role="group" aria-label="View mode">
            {(["overview", "classes", "focus"] as ViewMode[]).map((item) => (
              <button
                key={item}
                className={mode === item ? "is-active" : ""}
                type="button"
                onClick={() => setMode(item)}
              >
                {item === "overview" ? <Box size={15} /> : item === "focus" ? <Crosshair size={15} /> : <Waypoints size={15} />}
                {viewLabel(item)}
              </button>
            ))}
          </div>
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Sparkles size={16} />
            Form
          </div>
          <div className="metaphor-grid" role="group" aria-label="Visualization metaphor">
            {metaphorOptions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={metaphor === item.id ? "is-active" : ""}
                  type="button"
                  onClick={() => setMetaphor(item.id)}
                  title={`${item.label} form`}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Search size={16} />
            Search
          </div>
          <label className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="type, field, method, package"
              type="search"
            />
          </label>
          <div className="control-grid">
            <label>
              Module
              <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
                <option value="all">all</option>
                {analysis.modules.map((module) => (
                  <option key={module} value={module}>
                    {module}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Min degree
              <input
                min={0}
                max={30}
                type="number"
                value={minDegree}
                onChange={(event) => setMinDegree(Math.max(0, Number(event.target.value)))}
              />
            </label>
          </div>
        </section>

        <section className="panel-section">
          <div className="section-title">
            <SlidersHorizontal size={16} />
            Edges
          </div>
          <div className="segmented compact" role="group" aria-label="Edge density">
            {(["quiet", "balanced", "full"] as EdgeDensity[]).map((item) => (
              <button
                key={item}
                className={edgeDensity === item ? "is-active" : ""}
                type="button"
                onClick={() => setEdgeDensity(item)}
                title={`${item} edge density`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="edge-list">
            {analysis.edgeTypes.map((type) => (
              <label key={type} className="edge-toggle">
                <input checked={edgeTypes.has(type)} type="checkbox" onChange={() => toggleEdgeType(type)} />
                <span style={{ background: edgePalette[type] }} />
                {type}
              </label>
            ))}
          </div>
          <label className="range-row">
            Focus depth
            <input
              min={1}
              max={3}
              type="range"
              value={focusDepth}
              onChange={(event) => setFocusDepth(Number(event.target.value))}
            />
            <strong>{focusDepth}</strong>
          </label>
          {view.hiddenLinks ? <p className="muted-copy">{formatNumber(view.hiddenLinks)} edges hidden by density</p> : null}
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Braces size={16} />
            Data
          </div>
          <div className="button-row">
            <button type="button" onClick={() => fileInputRef.current?.click()} title="Load dependency graph">
              <FileUp size={16} />
              File
            </button>
            {demoSizes.map((size) => (
              <button key={size} type="button" onClick={() => loadDemo(size)} title={`Load ${size} class demo`}>
                <Sparkles size={15} />
                {formatNumber(size)}
              </button>
            ))}
          </div>
          <input
            ref={fileInputRef}
            className="file-input"
            accept="application/json,.json,.dpg"
            type="file"
            onChange={(event) => onFileSelected(event.target.files?.[0])}
          />
          {loadError ? <p className="error-text">{loadError}</p> : null}
        </section>

        {examples.length > 0 ? (
          <section className="panel-section">
            <div className="section-title">
              <Sparkles size={16} />
              Examples
            </div>
            <div className="example-list">
              {examples.map((example) => (
                <button
                  key={example.id}
                  className={loadingExample === example.id ? "is-loading" : ""}
                  type="button"
                  onClick={() => void loadExample(example)}
                  title={example.description}
                >
                  <span>{example.title}</span>
                  <small>
                    {example.complexity} / {formatNumber(example.nodes)} nodes / {example.recommended?.form ?? "palace"}
                  </small>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </aside>

      <main className="stage">
        <GraphScene
          ref={sceneRef}
          nodes={displayGraph.nodes}
          links={displayGraph.links}
          autoRotate={autoRotate}
          onSelect={(nodeId) => {
            setSelectedId(nodeId);
            if (nodeId && mode === "overview") setModeState("focus");
          }}
          onHover={(node, point) => setHovered(node && point ? { node, point } : null)}
          onRenderStats={setRenderStats}
        />

        <div className="stage-bar">
          <div className="metric-strip" aria-label="Current graph metrics">
            <span>
              <strong>{formatNumber(view.nodes.length)}</strong> nodes
            </span>
            <span>
              <strong>{formatNumber(view.links.length)}</strong> links
            </span>
            <span>
              <strong>{formatNumber(analysis.totalFields + analysis.totalMethods)}</strong> members
            </span>
            <span>
              <strong>{density.toFixed(1)}</strong> density
            </span>
            <span>
              <strong>{metaphor}</strong> form
            </span>
            <span>
              <strong>{renderStats.backend}</strong> renderer
            </span>
            <span>
              <strong>{currentResult.timings.totalMs}ms</strong> worker
            </span>
            <span>
              <strong>{formatBytes(renderStats.bufferBytes)}</strong> buffers
            </span>
          </div>
          <div className="stage-actions">
            <button type="button" onClick={() => setAutoRotate((value) => !value)} title="Toggle orbit">
              <RotateCcw size={17} />
            </button>
            <button type="button" onClick={() => sceneRef.current?.frameGraph()} title="Frame graph">
              <Camera size={17} />
            </button>
          </div>
        </div>

        {hovered ? (
          <div className="hover-card" style={{ left: hovered.point.x + 14, top: hovered.point.y + 14 }}>
            <strong>{hovered.node.label}</strong>
            <span>{hovered.node.subtitle ?? hovered.node.packageName}</span>
            {hovered.node.signature ? <code>{hovered.node.signature}</code> : null}
          </div>
        ) : null}
      </main>

      <aside className="side-panel right-panel" aria-label="Graph details">
        <section className="panel-section stat-section">
          <div className="section-title">
            <CircleDot size={16} />
            Snapshot
          </div>
          <dl className="stats-grid">
            <div>
              <dt>Types</dt>
              <dd>{formatNumber(graph.nodes.length)}</dd>
            </div>
            <div>
              <dt>Contracts</dt>
              <dd>{formatNumber(analysis.kinds.interface + analysis.kinds.typeclass)}</dd>
            </div>
            <div>
              <dt>Fields</dt>
              <dd>{formatNumber(analysis.totalFields)}</dd>
            </div>
            <div>
              <dt>Methods</dt>
              <dd>{formatNumber(analysis.totalMethods)}</dd>
            </div>
          </dl>
        </section>

        {diagnostics ? (
          <section className="panel-section stat-section">
            <div className="section-title">
              <Braces size={16} />
              Scan
            </div>
            <dl className="stats-grid">
              <div>
                <dt>Files</dt>
                <dd>{formatNumber(diagnostics.filesScanned)}</dd>
              </div>
              <div>
                <dt>Skipped</dt>
                <dd>{formatNumber(diagnostics.filesSkipped)}</dd>
              </div>
              <div>
                <dt>Unresolved</dt>
                <dd>{formatNumber(diagnostics.unresolvedEdges)}</dd>
              </div>
              <div>
                <dt>Cache</dt>
                <dd>{formatNumber(diagnostics.cache?.hits ?? 0)}</dd>
              </div>
            </dl>
            <div className="diagnostic-list">
              {Object.entries(diagnostics.languages).map(([language, stats]) =>
                stats ? (
                  <span key={language}>
                    {language}: {stats.files} files / {stats.nodes} nodes
                  </span>
                ) : null
              )}
            </div>
          </section>
        ) : null}

        <section className="panel-section selected-section">
          <div className="section-title">
            <Crosshair size={16} />
            Selected
          </div>
          {selectedNode ? (
            <div className="selected-node">
              <h2>{selectedNode.label}</h2>
              <p>{selectedNode.packageName}</p>
              <dl>
                <div>
                  <dt>module</dt>
                  <dd>{selectedNode.module}</dd>
                </div>
                <div>
                  <dt>kind</dt>
                  <dd>{selectedNode.kind}</dd>
                </div>
                <div>
                  <dt>in / out</dt>
                  <dd>
                    {selectedNode.inbound} / {selectedNode.outbound}
                  </dd>
                </div>
                <div>
                  <dt>loc</dt>
                  <dd>{formatNumber(selectedNode.loc)}</dd>
                </div>
                {selectedSource ? (
                  <div>
                    <dt>source</dt>
                    <dd>{selectedSource}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>members</dt>
                  <dd>{selectedNode.fields.length + selectedNode.methods.length}</dd>
                </div>
              </dl>
              {selectedSignal ? (
                <div className="signal-card">
                  <div>
                    <span>Voice</span>
                    <strong>{selectedSignal.voice}</strong>
                  </div>
                  <div>
                    <span>Shape</span>
                    <strong>{selectedSignal.members}</strong>
                  </div>
                  <div>
                    <span>Pressure</span>
                    <strong>{selectedSignal.pressure}</strong>
                  </div>
                  <div>
                    <span>Signal</span>
                    <strong>{selectedSignal.summary}</strong>
                  </div>
                  <div>
                    <span>Load</span>
                    <ul>
                      {selectedSignal.pressures.map(([label, count]) => (
                        <li key={label}>
                          <b />
                          {label} {formatNumber(count)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {selectedSignal.strongest.length > 0 ? (
                    <div>
                      <span>Edges</span>
                      <ul>
                        {selectedSignal.strongest.map(([type, count]) => (
                          <li key={type}>
                            <b style={{ background: edgePalette[type] }} />
                            {type} {count}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {selectedSignal.incoming.length > 0 ? (
                    <div>
                      <span>Incoming</span>
                      <ul>
                        {selectedSignal.incoming.map((link) => (
                          <li key={link.id}>
                            <b style={{ background: edgePalette[link.type] }} />
                            {link.type} {link.via ?? ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {selectedSignal.outgoing.length > 0 ? (
                    <div>
                      <span>Outgoing</span>
                      <ul>
                        {selectedSignal.outgoing.map((link) => (
                          <li key={link.id}>
                            <b style={{ background: edgePalette[link.type] }} />
                            {link.type} {link.via ?? ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="semantic-columns">
                <div>
                  <h3>State</h3>
                  <ul className="member-list">
                    {selectedNode.fields.slice(0, 8).map((field, index) => (
                      <li key={`${field.name}-${index}`}>
                        <span>{field.name}</span>
                        <code>{field.type ?? field.visibility ?? "field"}</code>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Behavior</h3>
                  <ul className="member-list">
                    {selectedNode.methods.slice(0, 8).map((method, index) => (
                      <li key={`${method.name}-${index}`}>
                        <span>{method.name}</span>
                        <code>{method.visibility ?? method.kind}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="relation-block">
                <h3>Relations</h3>
                <ul className="relation-list">
                  {selectedRelations.map(({ link, direction, other }) => (
                    <li key={link.id}>
                      <span className={`relation-type ${direction}`}>{link.type}</span>
                      <strong>{other?.label ?? (direction === "out" ? link.target : link.source)}</strong>
                      {link.via || link.reason ? <code>{[link.via, link.reason].filter(Boolean).join(" / ")}</code> : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => setMode("focus")}>
                  <Crosshair size={15} />
                  Focus
                </button>
                <button type="button" onClick={() => setSelectedId(null)}>
                  Clear
                </button>
                {selectedSource ? (
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(selectedSource)}>
                    Copy source
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="muted-copy">Select a node to inspect its local dependency shape.</p>
          )}
        </section>

        <section className="panel-section hubs-section">
          <div className="section-title">
            <Network size={16} />
            Hubs
          </div>
          <ol className="hub-list">
            {analysis.topHubs.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(node.id);
                    setModeState("focus");
                  }}
                >
                  <span>{node.label}</span>
                  <strong>{node.degree}</strong>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
