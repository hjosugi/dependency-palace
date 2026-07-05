import { layoutViewGraph } from "./layout";
import { analyzeGraph, buildViewGraph, normalizeGraph, type BuildViewOptions } from "./model";
import type {
  DependencyKind,
  DisplayLink,
  DisplayNode,
  GraphAnalysis,
  GraphData,
  GraphWorkerTimings,
  RawGraph,
  VisualizationMetaphor,
  ViewGraph
} from "../types";

interface GraphWorkerRequest {
  id: number;
  rawGraph: RawGraph;
  options: Omit<BuildViewOptions, "edgeTypes"> & {
    edgeTypes: string[];
  };
  metaphor: VisualizationMetaphor;
}

interface GraphWorkerResponse {
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

function now() {
  return performance.now();
}

self.onmessage = (event: MessageEvent<GraphWorkerRequest>) => {
  const started = now();
  const normalizeStart = now();
  const graph = normalizeGraph(event.data.rawGraph);
  const normalizeMs = now() - normalizeStart;

  const analyzeStart = now();
  const analysis = analyzeGraph(graph);
  const analyzeMs = now() - analyzeStart;

  const filterStart = now();
  const view = buildViewGraph(graph, {
    ...event.data.options,
    edgeTypes: new Set(event.data.options.edgeTypes as DependencyKind[])
  });
  const filterMs = now() - filterStart;

  const layoutStart = now();
  const displayGraph = layoutViewGraph(view, event.data.options.selectedId, event.data.metaphor);
  const layoutMs = now() - layoutStart;

  const response: GraphWorkerResponse = {
    id: event.data.id,
    graph,
    analysis,
    view,
    displayGraph,
    timings: {
      normalizeMs: Math.round(normalizeMs),
      analyzeMs: Math.round(analyzeMs),
      filterMs: Math.round(filterMs),
      layoutMs: Math.round(layoutMs),
      totalMs: Math.round(now() - started)
    }
  };

  self.postMessage(response);
};
