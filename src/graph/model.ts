import type {
  CodeMember,
  DependencyKind,
  GraphAnalysis,
  GraphData,
  GraphLink,
  GraphNode,
  NodeKind,
  RawGraph,
  RawLink,
  RawNode,
  ViewGraph,
  ViewMode
} from "../types";

export interface BuildViewOptions {
  mode: ViewMode;
  query: string;
  module: string;
  minDegree: number;
  selectedId: string | null;
  focusDepth: number;
  edgeTypes: Set<DependencyKind>;
}

const nodeKinds: NodeKind[] = ["class", "interface", "enum", "module", "package", "external"];
const dependencyKinds: DependencyKind[] = [
  "imports",
  "inherits",
  "implements",
  "uses",
  "calls",
  "creates",
  "tests",
  "unknown"
];

function normalizeNodeKind(kind: string | undefined): NodeKind {
  const lower = kind?.toLowerCase();
  if (lower && nodeKinds.includes(lower as NodeKind)) return lower as NodeKind;
  if (lower?.includes("interface")) return "interface";
  if (lower?.includes("enum")) return "enum";
  return "class";
}

function normalizeDependencyKind(kind: string | undefined): DependencyKind {
  const lower = kind?.toLowerCase();
  if (lower && dependencyKinds.includes(lower as DependencyKind)) return lower as DependencyKind;
  if (lower === "extends") return "inherits";
  if (lower === "references") return "uses";
  if (lower === "depends_on" || lower === "dependency") return "imports";
  return "unknown";
}

function labelFromId(id: string) {
  return id.split(/[/.#$]/).filter(Boolean).at(-1) ?? id;
}

function packageFromNode(node: RawNode) {
  if (node.package) return node.package;
  if (node.namespace) return node.namespace;
  const parts = node.id.split(".");
  if (parts.length > 1) return parts.slice(0, -1).join(".");
  const slashParts = node.id.split("/");
  if (slashParts.length > 1) return slashParts.slice(0, -1).join(".");
  return node.module ?? "app";
}

function moduleFromPackage(packageName: string, node: RawNode) {
  if (node.module) return node.module;
  return packageName.split(/[./]/).filter(Boolean)[0] ?? "app";
}

function layerFromModule(moduleName: string, explicit?: number) {
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
  const weighted = Array.from(moduleName).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return weighted % 5;
}

function endpointId(endpoint: RawLink["source"]) {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function normalizeMember(member: CodeMember): CodeMember {
  return {
    ...member,
    kind: member.kind ?? "method",
    visibility: member.visibility ?? "public"
  };
}

function membersFromNode(rawNode: RawNode) {
  const members = (rawNode.members ?? []).map(normalizeMember);
  const explicitFields = (rawNode.fields ?? []).map(normalizeMember);
  const explicitMethods = (rawNode.methods ?? []).map(normalizeMember);
  const fields = [...explicitFields, ...members.filter((member) => member.kind === "field" || member.kind === "property")];
  const methods = [
    ...explicitMethods,
    ...members.filter((member) => member.kind === "method" || member.kind === "constructor")
  ];

  return { fields, methods };
}

function roleFromNode(rawNode: RawNode, kind: NodeKind) {
  const haystack = `${rawNode.id} ${rawNode.label ?? ""} ${rawNode.name ?? ""}`.toLowerCase();
  if (kind === "interface") return "contract";
  if (haystack.includes("controller") || haystack.includes("resolver") || haystack.includes("gateway")) return "boundary";
  if (haystack.includes("adapter") || haystack.includes("mapper")) return "adapter";
  if (haystack.includes("entity") || haystack.includes("model") || haystack.includes("state")) return "state";
  if (haystack.includes("dto") || haystack.includes("request") || haystack.includes("response")) return "data";
  if (haystack.includes("test") || haystack.includes("spec")) return "test";
  if (haystack.includes("service") || haystack.includes("handler") || haystack.includes("worker")) return "behavior";
  return "unknown";
}

function computeSccSizes(nodes: GraphNode[], links: GraphLink[]) {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const link of links) adjacency.get(link.source)?.push(link.target);

  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const sccSizes = new Map<string, number>();
  let sccCount = 0;
  let cyclicNodeCount = 0;
  let largestScc = 1;

  function strongConnect(nodeId: string) {
    indices.set(nodeId, index);
    lowLinks.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const next of adjacency.get(nodeId) ?? []) {
      if (!indices.has(next)) {
        strongConnect(next);
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId) ?? 0, lowLinks.get(next) ?? 0));
      } else if (onStack.has(next)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId) ?? 0, indices.get(next) ?? 0));
      }
    }

    if (lowLinks.get(nodeId) === indices.get(nodeId)) {
      const component: string[] = [];
      let current: string | undefined;
      do {
        current = stack.pop();
        if (!current) break;
        onStack.delete(current);
        component.push(current);
      } while (current !== nodeId);

      sccCount += 1;
      largestScc = Math.max(largestScc, component.length);
      if (component.length > 1) cyclicNodeCount += component.length;
      for (const id of component) sccSizes.set(id, component.length);
    }
  }

  for (const node of nodes) {
    if (!indices.has(node.id)) strongConnect(node.id);
  }

  return { sccSizes, sccCount, cyclicNodeCount, largestScc };
}

export function normalizeGraph(raw: RawGraph): GraphData {
  const incomingNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const nodeMap = new Map<string, GraphNode>();

  for (const rawNode of incomingNodes) {
    if (!rawNode.id) continue;
    const packageName = packageFromNode(rawNode);
    const module = moduleFromPackage(packageName, rawNode);
    const kind = normalizeNodeKind(rawNode.kind);
    const members = membersFromNode(rawNode);
    nodeMap.set(rawNode.id, {
      id: rawNode.id,
      label: rawNode.label ?? rawNode.name ?? labelFromId(rawNode.id),
      module,
      packageName,
      kind,
      loc: Math.max(1, Math.round(rawNode.loc ?? 100)),
      complexity: Math.max(1, Math.round(rawNode.complexity ?? 1)),
      layer: layerFromModule(module, rawNode.layer),
      inbound: 0,
      outbound: 0,
      degree: 0,
      sccSize: 1,
      fields: members.fields,
      methods: members.methods,
      role: roleFromNode(rawNode, kind)
    });
  }

  const rawLinks = raw.links ?? raw.edges ?? [];
  const linkMap = new Map<string, GraphLink>();

  for (const rawLink of rawLinks) {
    const source = endpointId(rawLink.source);
    const target = endpointId(rawLink.target);
    if (!source || !target || source === target) continue;

    for (const id of [source, target]) {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label: labelFromId(id),
          module: "external",
          packageName: "external",
          kind: "external",
          loc: 1,
          complexity: 1,
          layer: 5,
          inbound: 0,
          outbound: 0,
          degree: 0,
          sccSize: 1,
          fields: [],
          methods: [],
          role: "unknown"
        });
      }
    }

    const type = normalizeDependencyKind(rawLink.type ?? rawLink.kind);
    const key = `${source}\u0000${target}\u0000${type}`;
    const existing = linkMap.get(key);
    if (existing) {
      existing.weight += Math.max(1, rawLink.weight ?? 1);
    } else {
      linkMap.set(key, {
        id: key,
        source,
        target,
        type,
        weight: Math.max(1, rawLink.weight ?? 1),
        via: rawLink.via,
        reason: rawLink.reason
      });
    }
  }

  const nodes = Array.from(nodeMap.values());
  const links = Array.from(linkMap.values());
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const link of links) {
    const source = byId.get(link.source);
    const target = byId.get(link.target);
    if (!source || !target) continue;
    source.outbound += 1;
    target.inbound += 1;
  }

  const scc = computeSccSizes(nodes, links);
  for (const node of nodes) {
    node.degree = node.inbound + node.outbound;
    node.sccSize = scc.sccSizes.get(node.id) ?? 1;
  }

  return {
    nodes,
    links,
    meta: {
      name: raw.meta?.name ?? "Dependency graph",
      generatedAt: raw.meta?.generatedAt ?? new Date().toISOString(),
      language: raw.meta?.language ?? "unknown"
    }
  };
}

export function analyzeGraph(graph: GraphData): GraphAnalysis {
  const scc = computeSccSizes(graph.nodes, graph.links);
  const kinds = graph.nodes.reduce(
    (counts, node) => {
      counts[node.kind] += 1;
      return counts;
    },
    { class: 0, interface: 0, enum: 0, module: 0, package: 0, external: 0 }
  );
  return {
    modules: Array.from(new Set(graph.nodes.map((node) => node.module))).sort(),
    packages: Array.from(new Set(graph.nodes.map((node) => node.packageName))).sort(),
    edgeTypes: Array.from(new Set(graph.links.map((link) => link.type))).sort(),
    sccCount: scc.sccCount,
    cyclicNodeCount: scc.cyclicNodeCount,
    largestScc: scc.largestScc,
    totalFields: graph.nodes.reduce((sum, node) => sum + node.fields.length, 0),
    totalMethods: graph.nodes.reduce((sum, node) => sum + node.methods.length, 0),
    kinds,
    topHubs: [...graph.nodes].sort((a, b) => b.degree - a.degree).slice(0, 8)
  };
}

function filteredLinks(graph: GraphData, edgeTypes: Set<DependencyKind>) {
  return graph.links.filter((link) => edgeTypes.size === 0 || edgeTypes.has(link.type));
}

function buildSubgraph(nodes: GraphNode[], links: GraphLink[], mode: ViewMode, title: string): ViewGraph {
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    links: links.filter((link) => nodeIds.has(link.source) && nodeIds.has(link.target)),
    mode,
    title
  };
}

function aggregateByPackage(graph: GraphData, links: GraphLink[], allowedNodeIds?: Set<string>): ViewGraph {
  const packages = new Map<string, GraphNode>();
  const sourceNodes = allowedNodeIds ? graph.nodes.filter((node) => allowedNodeIds.has(node.id)) : graph.nodes;

  for (const node of sourceNodes) {
    const id = `pkg:${node.packageName}`;
    const existing = packages.get(id);
    if (existing) {
      existing.loc += node.loc;
      existing.complexity += node.complexity;
      existing.layer = Math.round((existing.layer + node.layer) / 2);
      existing.childCount = (existing.childCount ?? 0) + 1;
      existing.sccSize = Math.max(existing.sccSize, node.sccSize);
    } else {
      packages.set(id, {
        id,
        label: node.packageName.split(".").at(-1) ?? node.packageName,
        module: node.module,
        packageName: node.packageName,
        kind: "package",
        loc: node.loc,
        complexity: node.complexity,
        layer: node.layer,
        inbound: 0,
        outbound: 0,
        degree: 0,
        sccSize: node.sccSize,
        fields: [],
        methods: [],
        role: "unknown",
        childCount: 1
      });
    }
  }

  const nodeToPackage = new Map(sourceNodes.map((node) => [node.id, `pkg:${node.packageName}`]));
  const aggregateLinks = new Map<string, GraphLink>();
  const typeWeights = new Map<string, Map<DependencyKind, number>>();

  for (const link of links) {
    const source = nodeToPackage.get(link.source);
    const target = nodeToPackage.get(link.target);
    if (!source || !target || source === target) continue;
    const key = `${source}\u0000${target}`;
    const existing = aggregateLinks.get(key);
    if (existing) {
      existing.weight += link.weight;
    } else {
      aggregateLinks.set(key, { ...link, id: key, source, target });
    }

    if (!typeWeights.has(key)) typeWeights.set(key, new Map());
    const weights = typeWeights.get(key);
    if (weights) weights.set(link.type, (weights.get(link.type) ?? 0) + link.weight);
  }

  for (const [key, link] of aggregateLinks) {
    const weights = typeWeights.get(key);
    const strongestType = Array.from(weights?.entries() ?? []).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (strongestType) link.type = strongestType;
  }

  const visibleLinkIds = new Set<string>();
  const bySource = new Map<string, GraphLink[]>();
  for (const link of aggregateLinks.values()) {
    if (!bySource.has(link.source)) bySource.set(link.source, []);
    bySource.get(link.source)?.push(link);
  }

  for (const sourceLinks of bySource.values()) {
    sourceLinks
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
      .forEach((link) => visibleLinkIds.add(link.id));
  }

  const visibleLinks = Array.from(aggregateLinks.values())
    .filter((link) => visibleLinkIds.has(link.id))
    .sort((a, b) => b.weight - a.weight);

  const packageNodes = Array.from(packages.values());
  const byId = new Map(packageNodes.map((node) => [node.id, node]));
  for (const link of visibleLinks) {
    const source = byId.get(link.source);
    const target = byId.get(link.target);
    if (!source || !target) continue;
    source.outbound += 1;
    target.inbound += 1;
  }
  for (const node of packageNodes) node.degree = node.inbound + node.outbound;

  return {
    nodes: packageNodes.sort((a, b) => a.packageName.localeCompare(b.packageName)),
    links: visibleLinks,
    mode: "overview",
    title: "Package overview"
  };
}

function idsMatchingQuery(graph: GraphData, links: GraphLink[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return new Set<string>();

  const matching = new Set(
    graph.nodes
      .filter((node) =>
        [node.id, node.label, node.module, node.packageName].some((value) =>
          value.toLowerCase().includes(normalized)
        ) ||
        node.fields.some((member) => member.name.toLowerCase().includes(normalized)) ||
        node.methods.some((member) => member.name.toLowerCase().includes(normalized))
      )
      .map((node) => node.id)
  );

  for (const link of links) {
    if (matching.has(link.source) || matching.has(link.target)) {
      matching.add(link.source);
      matching.add(link.target);
    }
  }

  return matching;
}

function focusIds(selectedId: string, links: GraphLink[], depth: number) {
  const adjacency = new Map<string, string[]>();
  for (const link of links) {
    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
    if (!adjacency.has(link.target)) adjacency.set(link.target, []);
    adjacency.get(link.source)?.push(link.target);
    adjacency.get(link.target)?.push(link.source);
  }

  const visited = new Set([selectedId]);
  let frontier = new Set([selectedId]);
  for (let currentDepth = 0; currentDepth < depth; currentDepth += 1) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        next.add(neighbor);
      }
    }
    frontier = next;
  }
  return visited;
}

export function buildViewGraph(graph: GraphData, options: BuildViewOptions): ViewGraph {
  const links = filteredLinks(graph, options.edgeTypes);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const queryIds = idsMatchingQuery(graph, links, options.query);

  let allowed = new Set<string>();
  for (const node of graph.nodes) {
    if (options.module !== "all" && node.module !== options.module) continue;
    if (node.degree < options.minDegree) continue;
    if (queryIds.size > 0 && !queryIds.has(node.id)) continue;
    allowed.add(node.id);
  }

  if (options.mode === "overview") {
    return aggregateByPackage(graph, links, allowed);
  }

  if (options.mode === "focus" && options.selectedId && byId.has(options.selectedId)) {
    const focused = focusIds(options.selectedId, links, options.focusDepth);
    allowed = new Set(Array.from(allowed).filter((id) => focused.has(id)));
    if (!allowed.has(options.selectedId)) allowed.add(options.selectedId);
  }

  const nodes = graph.nodes.filter((node) => allowed.has(node.id));
  return buildSubgraph(nodes, links, options.mode, options.mode === "focus" ? "Focused neighborhood" : "Class graph");
}
