import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Braces,
  Camera,
  CircleDot,
  Crosshair,
  FileUp,
  Layers3,
  Network,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Waypoints
} from "lucide-react";
import { GraphScene, type GraphSceneHandle } from "./GraphScene";
import { createDemoGraph, demoSizes, type DemoSize } from "./data/sampleGraph";
import { analyzeGraph, buildViewGraph, normalizeGraph } from "./graph/model";
import { edgePalette, layoutViewGraph } from "./graph/layout";
import type { DependencyKind, DisplayNode, RawGraph, ViewMode } from "./types";

const numberFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function viewLabel(mode: ViewMode) {
  if (mode === "overview") return "Map";
  if (mode === "focus") return "Focus";
  return "Types";
}

export default function App() {
  const [rawGraph, setRawGraph] = useState<RawGraph>(() => createDemoGraph(2500));
  const [mode, setModeState] = useState<ViewMode>("focus");
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [minDegree, setMinDegree] = useState(0);
  const [focusDepth, setFocusDepth] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{ node: DisplayNode; point: { x: number; y: number } } | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edgeTypes, setEdgeTypes] = useState<Set<DependencyKind>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sceneRef = useRef<GraphSceneHandle | null>(null);

  const graph = useMemo(() => normalizeGraph(rawGraph), [rawGraph]);
  const analysis = useMemo(() => analyzeGraph(graph), [graph]);

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

  const view = useMemo(
    () =>
      buildViewGraph(graph, {
        mode,
        query,
        module: moduleFilter,
        minDegree,
        selectedId,
        focusDepth,
        edgeTypes
      }),
    [edgeTypes, focusDepth, graph, minDegree, mode, moduleFilter, query, selectedId]
  );

  const displayGraph = useMemo(() => layoutViewGraph(view, selectedId), [selectedId, view]);

  function setMode(nextMode: ViewMode) {
    if (nextMode === "focus" && !selectedId) {
      setSelectedId(analysis.topHubs[0]?.id ?? null);
    }
    setModeState(nextMode);
  }

  function loadDemo(size: DemoSize) {
    setRawGraph(createDemoGraph(size));
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
      const text = await file.text();
      const parsed = JSON.parse(text) as RawGraph;
      if (!Array.isArray(parsed.nodes)) throw new Error("JSON must contain a nodes array.");
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

  const density = view.nodes.length > 0 ? view.links.length / view.nodes.length : 0;

  return (
    <div className="app-shell">
      <aside className="side-panel left-panel" aria-label="Graph controls">
        <header className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Network size={22} />
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
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Braces size={16} />
            Data
          </div>
          <div className="button-row">
            <button type="button" onClick={() => fileInputRef.current?.click()} title="Load dependency JSON">
              <FileUp size={16} />
              JSON
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
            accept="application/json,.json"
            type="file"
            onChange={(event) => onFileSelected(event.target.files?.[0])}
          />
          {loadError ? <p className="error-text">{loadError}</p> : null}
        </section>
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
              <dt>Interfaces</dt>
              <dd>{formatNumber(analysis.kinds.interface)}</dd>
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
                <div>
                  <dt>members</dt>
                  <dd>{selectedNode.fields.length + selectedNode.methods.length}</dd>
                </div>
              </dl>
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
