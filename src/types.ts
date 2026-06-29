export type DependencyKind =
  | "imports"
  | "inherits"
  | "implements"
  | "uses"
  | "calls"
  | "creates"
  | "tests"
  | "unknown";

export type NodeKind = "class" | "interface" | "enum" | "module" | "package" | "external";

export type MemberKind = "field" | "method" | "constructor" | "property";

export type Visibility = "public" | "protected" | "private" | "package" | "internal";

export interface CodeMember {
  name: string;
  kind: MemberKind;
  type?: string;
  visibility?: Visibility | string;
  static?: boolean;
  abstract?: boolean;
  signature?: string;
  calls?: string[];
  uses?: string[];
}

export interface RawNode {
  id: string;
  label?: string;
  name?: string;
  module?: string;
  package?: string;
  namespace?: string;
  kind?: NodeKind | string;
  loc?: number;
  complexity?: number;
  layer?: number;
  fields?: CodeMember[];
  methods?: CodeMember[];
  members?: CodeMember[];
}

export interface RawLink {
  source: string | { id: string };
  target: string | { id: string };
  type?: DependencyKind | string;
  kind?: DependencyKind | string;
  weight?: number;
  via?: string;
  reason?: string;
}

export interface RawGraph {
  nodes: RawNode[];
  links?: RawLink[];
  edges?: RawLink[];
  meta?: {
    name?: string;
    generatedAt?: string;
    language?: string;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  module: string;
  packageName: string;
  kind: NodeKind;
  loc: number;
  complexity: number;
  layer: number;
  inbound: number;
  outbound: number;
  degree: number;
  sccSize: number;
  fields: CodeMember[];
  methods: CodeMember[];
  childCount?: number;
  role?: "state" | "behavior" | "contract" | "data" | "boundary" | "adapter" | "test" | "unknown";
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: DependencyKind;
  weight: number;
  via?: string;
  reason?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  meta: {
    name: string;
    generatedAt: string;
    language: string;
  };
}

export interface DisplayNode extends GraphNode {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  visualKind: NodeKind | MemberKind;
  ownerId?: string;
  ownerLabel?: string;
  subtitle?: string;
  signature?: string;
  dimensions?: {
    x: number;
    y: number;
    z: number;
  };
  isSelected?: boolean;
  isNeighbor?: boolean;
  isSynthetic?: boolean;
}

export interface DisplayLink extends GraphLink {
  color: string;
  opacity: number;
}

export type ViewMode = "overview" | "classes" | "focus";

export interface ViewGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  mode: ViewMode;
  title: string;
}

export interface GraphAnalysis {
  modules: string[];
  packages: string[];
  edgeTypes: DependencyKind[];
  sccCount: number;
  cyclicNodeCount: number;
  largestScc: number;
  totalFields: number;
  totalMethods: number;
  kinds: Record<NodeKind, number>;
  topHubs: GraphNode[];
}
