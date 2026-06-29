import type { CodeMember, DependencyKind, DisplayLink, DisplayNode, GraphLink, GraphNode, MemberKind, NodeKind, ViewGraph } from "../types";

const modulePalette = [
  "#69d2e7",
  "#f38630",
  "#a7db6b",
  "#e95f8b",
  "#7e9cff",
  "#ffd166",
  "#06d6a0",
  "#c77dff",
  "#f05d5e",
  "#8ac926",
  "#4cc9f0",
  "#ffb703"
];

export const edgePalette: Record<DependencyKind, string> = {
  imports: "#74c0fc",
  inherits: "#ff9f1c",
  implements: "#b197fc",
  uses: "#63e6be",
  calls: "#ffd43b",
  creates: "#ff6b6b",
  tests: "#f783ac",
  unknown: "#c5c5c5"
};

const kindPalette: Record<NodeKind | MemberKind, string> = {
  class: "#69d2e7",
  interface: "#b197fc",
  enum: "#ffd166",
  module: "#8ac926",
  package: "#f2c879",
  external: "#adb5bd",
  field: "#06d6a0",
  method: "#ffda6b",
  constructor: "#f59f00",
  property: "#63e6be"
};

const rolePalette = {
  state: "#06d6a0",
  behavior: "#ffd43b",
  contract: "#b197fc",
  data: "#74c0fc",
  boundary: "#ff922b",
  adapter: "#f783ac",
  test: "#8ce99a",
  unknown: "#69d2e7"
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableUnit(value: string) {
  return hashString(value) / 4294967295;
}

function colorForModule(module: string, modules: string[]) {
  const index = modules.indexOf(module);
  return modulePalette[(index >= 0 ? index : hashString(module)) % modulePalette.length];
}

function packageCenters(nodes: GraphNode[]) {
  const modules = Array.from(new Set(nodes.map((node) => node.module))).sort();
  const packagesByModule = new Map<string, string[]>();

  for (const node of nodes) {
    if (!packagesByModule.has(node.module)) packagesByModule.set(node.module, []);
    const packages = packagesByModule.get(node.module);
    if (packages && !packages.includes(node.packageName)) packages.push(node.packageName);
  }

  for (const packages of packagesByModule.values()) packages.sort();

  const centers = new Map<string, { x: number; y: number; z: number }>();
  const moduleCount = Math.max(1, modules.length);
  const baseRadius = moduleCount < 4 ? 230 : 340;

  for (const [moduleIndex, module] of modules.entries()) {
    const packages = packagesByModule.get(module) ?? [];
    const moduleAngle = (moduleIndex / moduleCount) * Math.PI * 2;
    const moduleLayer =
      nodes.find((node) => node.module === module)?.layer ??
      Math.round(Array.from(module).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5);

    packages.forEach((packageName, packageIndex) => {
      const ring = baseRadius + (packageIndex % 4) * 42;
      const angle = moduleAngle + (packageIndex - (packages.length - 1) / 2) * 0.075;
      const y = (moduleLayer - 2) * 92 + Math.floor(packageIndex / 4) * 38;
      centers.set(packageName, {
        x: Math.cos(angle) * ring,
        y,
        z: Math.sin(angle) * ring
      });
    });
  }

  return { centers, modules };
}

function nodeRadius(node: GraphNode, mode: ViewGraph["mode"]) {
  if (mode === "overview") {
    return Math.min(28, 4.5 + Math.log2((node.childCount ?? 1) + 1) * 3.8 + Math.log2(node.degree + 1));
  }
  const complexityBoost = Math.min(1.7, Math.log2(node.complexity + 1) * 0.18);
  return Math.min(7, 2.2 + Math.log2(node.degree + 1) * 0.34 + complexityBoost);
}

function visualKindForNode(node: GraphNode): NodeKind {
  return node.kind;
}

function colorForNode(node: GraphNode, modules: string[], dimmed: boolean) {
  if (dimmed) return "#4b4a45";
  if (node.kind === "package") return colorForModule(node.module, modules);
  if (node.kind === "interface") return kindPalette.interface;
  if (node.kind === "enum") return kindPalette.enum;
  if (node.kind === "external") return kindPalette.external;
  return rolePalette[node.role ?? "unknown"];
}

function dimensionsForNode(node: GraphNode, radius: number, mode: ViewGraph["mode"]) {
  if (node.kind === "package") {
    const width = Math.max(26, radius * 2.8);
    const depth = Math.max(18, radius * 1.8);
    return { x: width, y: Math.max(4, radius * 0.42), z: depth };
  }
  if (node.kind === "interface") return { x: radius * 2.2, y: radius * 2.2, z: radius * 0.55 };
  if (node.kind === "enum") return { x: radius * 1.8, y: radius * 2.2, z: radius * 1.8 };
  if (mode === "focus") {
    const memberLoad = Math.min(18, node.fields.length + node.methods.length);
    return { x: radius * 2.1, y: radius * (2.7 + memberLoad * 0.08), z: radius * 1.55 };
  }
  return { x: radius * 1.85, y: radius * 1.85, z: radius * 1.85 };
}

function syntheticMemberNode(owner: GraphNode, member: CodeMember, index: number, total: number, side: "field" | "method"): DisplayNode {
  const memberKind = member.kind ?? side;
  const band = total <= 1 ? 0 : index / (total - 1) - 0.5;
  const arc = band * Math.PI * 0.9;
  const radius = memberKind === "field" || memberKind === "property" ? 2.4 : 2.9;
  const xBase = side === "field" ? -72 : 72;
  const zBase = side === "field" ? -18 : 18;
  const yBase = side === "field" ? -34 : 34;

  return {
    id: `member:${owner.id}:${side}:${member.name}:${index}`,
    label: member.name,
    module: owner.module,
    packageName: owner.packageName,
    kind: owner.kind,
    loc: 1,
    complexity: 1,
    layer: owner.layer,
    inbound: 0,
    outbound: 0,
    degree: 0,
    sccSize: 1,
    fields: [],
    methods: [],
    role: side === "field" ? "state" : "behavior",
    x: xBase + Math.cos(arc) * 16,
    y: yBase + band * 58,
    z: zBase + Math.sin(arc) * 34,
    radius,
    color: kindPalette[memberKind],
    visualKind: memberKind,
    ownerId: owner.id,
    ownerLabel: owner.label,
    subtitle: `${member.visibility ?? "public"} ${member.type ?? member.kind}`,
    signature: member.signature,
    dimensions:
      memberKind === "field" || memberKind === "property"
        ? { x: radius * 1.6, y: radius * 1.6, z: radius * 1.6 }
        : { x: radius * 2.2, y: radius * 0.85, z: radius * 2.2 },
    isSynthetic: true,
    isNeighbor: true
  };
}

function semanticFocusLayout(view: ViewGraph, selectedId: string, modules: string[]): { nodes: DisplayNode[]; links: DisplayLink[] } | null {
  const selected = view.nodes.find((node) => node.id === selectedId);
  if (!selected) return null;

  const directLinks = view.links.filter((link) => link.source === selectedId || link.target === selectedId);
  const directNeighborIds = new Set(directLinks.map((link) => (link.source === selectedId ? link.target : link.source)));
  const neighborNodes = view.nodes.filter((node) => node.id !== selectedId && directNeighborIds.has(node.id));
  const otherNodes = view.nodes.filter((node) => node.id !== selectedId && !directNeighborIds.has(node.id));
  const byId = new Map(view.nodes.map((node) => [node.id, node]));

  const selectedRadius = Math.max(12, Math.min(26, 12 + Math.log2(selected.fields.length + selected.methods.length + 2) * 2.6));
  const displayNodes: DisplayNode[] = [
    {
      ...selected,
      x: 0,
      y: 0,
      z: 0,
      radius: selectedRadius,
      color: "#fff0b3",
      visualKind: selected.kind,
      subtitle: `${selected.role ?? "class"} / ${selected.fields.length} fields / ${selected.methods.length} methods`,
      dimensions: { x: selectedRadius * 2.4, y: selectedRadius * 3.2, z: selectedRadius * 1.75 },
      isSelected: true
    }
  ];

  const memberLimit = 18;
  const fields = selected.fields.slice(0, memberLimit);
  const methods = selected.methods.slice(0, memberLimit);
  const syntheticLinks: DisplayLink[] = [];

  fields.forEach((field, index) => {
    const member = syntheticMemberNode(selected, field, index, fields.length, "field");
    displayNodes.push(member);
    syntheticLinks.push({
      id: `owns:${selected.id}:${member.id}`,
      source: selected.id,
      target: member.id,
      type: "uses",
      weight: 1,
      color: kindPalette.field,
      opacity: 0.34,
      reason: "owns state"
    });
  });

  methods.forEach((method, index) => {
    const member = syntheticMemberNode(selected, method, index, methods.length, "method");
    displayNodes.push(member);
    syntheticLinks.push({
      id: `declares:${selected.id}:${member.id}`,
      source: selected.id,
      target: member.id,
      type: "calls",
      weight: 1,
      color: kindPalette.method,
      opacity: 0.38,
      reason: "declares behavior"
    });
  });

  const outgoing = neighborNodes.filter((node) => directLinks.some((link) => link.source === selectedId && link.target === node.id));
  const incoming = neighborNodes.filter((node) => directLinks.some((link) => link.target === selectedId && link.source === node.id));
  const interfaces = outgoing.filter((node) =>
    directLinks.some((link) => link.source === selectedId && link.target === node.id && link.type === "implements")
  );
  const inherited = outgoing.filter((node) =>
    directLinks.some((link) => link.source === selectedId && link.target === node.id && link.type === "inherits")
  );
  const regularOutgoing = outgoing.filter((node) => !interfaces.includes(node) && !inherited.includes(node));
  const regularIncoming = incoming.filter((node) => !regularOutgoing.includes(node));

  const placeArc = (
    node: GraphNode,
    index: number,
    total: number,
    side: "in" | "out" | "contract" | "inherit" | "far"
  ): DisplayNode => {
    const t = total <= 1 ? 0.5 : index / (total - 1);
    const centered = t - 0.5;
    const baseRadius = nodeRadius(node, "focus");
    const isInterface = node.kind === "interface";
    const isNeighbor = side !== "far";
    let x = 0;
    let y = 0;
    let z = 0;

    if (side === "contract") {
      x = centered * 82;
      y = 132 + Math.abs(centered) * 24;
      z = -48 - Math.abs(centered) * 18;
    } else if (side === "inherit") {
      x = centered * 52;
      y = -118 - index * 10;
      z = -54;
    } else if (side === "in") {
      x = -182 - Math.abs(centered) * 32;
      y = centered * 118;
      z = 32 + Math.cos(t * Math.PI) * 72;
    } else if (side === "out") {
      x = 182 + Math.abs(centered) * 32;
      y = centered * 118;
      z = 32 + Math.cos(t * Math.PI) * 72;
    } else {
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      const ring = 310 + (index % 3) * 34;
      x = Math.cos(angle) * ring;
      y = -24 + ((index % 5) - 2) * 38;
      z = Math.sin(angle) * ring;
    }

    const visualKind = visualKindForNode(node);
    const radius = baseRadius * (isInterface ? 1.35 : isNeighbor ? 1.16 : 0.84);
    return {
      ...node,
      x,
      y,
      z,
      radius,
      color: colorForNode(node, modules, side === "far"),
      visualKind,
      subtitle:
        side === "contract"
          ? "contract"
          : side === "inherit"
            ? "base type"
            : side === "in"
              ? "depends on selected"
              : side === "out"
                ? "selected depends on this"
                : "context",
      dimensions: dimensionsForNode(node, radius, "focus"),
      isNeighbor,
      isSelected: false
    };
  };

  interfaces.forEach((node, index) => displayNodes.push(placeArc(node, index, interfaces.length, "contract")));
  inherited.forEach((node, index) => displayNodes.push(placeArc(node, index, inherited.length, "inherit")));
  regularIncoming.forEach((node, index) => displayNodes.push(placeArc(node, index, regularIncoming.length, "in")));
  regularOutgoing.forEach((node, index) => displayNodes.push(placeArc(node, index, regularOutgoing.length, "out")));
  otherNodes.slice(0, 160).forEach((node, index) => displayNodes.push(placeArc(node, index, Math.min(160, otherNodes.length), "far")));

  const positionIds = new Set(displayNodes.map((node) => node.id));
  const displayLinks = view.links
    .filter((link) => positionIds.has(link.source) && positionIds.has(link.target))
    .map((link): DisplayLink => {
      const active = link.source === selectedId || link.target === selectedId;
      const target = byId.get(link.target);
      return {
        ...link,
        color: active ? edgePalette[link.type] : "#49463d",
        opacity: active ? (target?.kind === "interface" ? 0.82 : 0.68) : 0.12
      };
    });

  return { nodes: displayNodes, links: [...displayLinks, ...syntheticLinks] };
}

export function layoutViewGraph(view: ViewGraph, selectedId: string | null): { nodes: DisplayNode[]; links: DisplayLink[] } {
  const { centers, modules } = packageCenters(view.nodes);
  if (view.mode === "focus" && selectedId) {
    const semantic = semanticFocusLayout(view, selectedId, modules);
    if (semantic) return semantic;
  }

  const packageGroups = new Map<string, GraphNode[]>();
  const neighborIds = new Set<string>();

  if (selectedId) {
    for (const link of view.links) {
      if (link.source === selectedId) neighborIds.add(link.target);
      if (link.target === selectedId) neighborIds.add(link.source);
    }
  }

  for (const node of view.nodes) {
    if (!packageGroups.has(node.packageName)) packageGroups.set(node.packageName, []);
    packageGroups.get(node.packageName)?.push(node);
  }

  for (const group of packageGroups.values()) {
    group.sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label));
  }

  const displayNodes: DisplayNode[] = [];
  for (const [packageName, group] of packageGroups) {
    const center = centers.get(packageName) ?? { x: 0, y: 0, z: 0 };
    const groupSize = Math.max(1, group.length);
    const spread = view.mode === "overview" ? 0 : 18 + Math.cbrt(groupSize) * 17;

    group.forEach((node, index) => {
      const t = (index + 0.5) / groupSize;
      const theta = index * Math.PI * (3 - Math.sqrt(5));
      const phi = Math.acos(1 - 2 * t);
      const localNoise = (stableUnit(node.id) - 0.5) * 11;
      const isSelected = selectedId === node.id;
      const isNeighbor = neighborIds.has(node.id);
      const dimmed = Boolean(selectedId) && !isSelected && !isNeighbor;

      displayNodes.push({
        ...node,
        x: center.x + Math.cos(theta) * Math.sin(phi) * spread + localNoise,
        y: center.y + Math.cos(phi) * spread * 0.72 + (stableUnit(`${node.id}:y`) - 0.5) * 9,
        z: center.z + Math.sin(theta) * Math.sin(phi) * spread - localNoise,
        radius: nodeRadius(node, view.mode) * (isSelected ? 1.45 : isNeighbor ? 1.18 : 1),
        color: colorForNode(node, modules, dimmed),
        visualKind: visualKindForNode(node),
        subtitle:
          node.kind === "package"
            ? `${node.childCount ?? 0} types`
            : `${node.role ?? node.kind} / ${node.fields.length} fields / ${node.methods.length} methods`,
        dimensions: dimensionsForNode(
          node,
          nodeRadius(node, view.mode) * (isSelected ? 1.45 : isNeighbor ? 1.18 : 1),
          view.mode
        ),
        isSelected,
        isNeighbor
      });
    });
  }

  const displayLinks = view.links.map((link): DisplayLink => {
    const active = !selectedId || link.source === selectedId || link.target === selectedId;
    return {
      ...link,
      color: active ? edgePalette[link.type] : "#46443f",
      opacity: active ? Math.min(0.76, 0.24 + Math.log2(link.weight + 1) * 0.08) : 0.08
    };
  });

  return { nodes: displayNodes, links: displayLinks };
}
