import type { CodeMember, DependencyKind, RawGraph, RawLink, RawNode, Visibility } from "../types";

type ModuleSpec = {
  name: string;
  layer: number;
  areas: string[];
};

export type DemoSize = 750 | 2500 | 6000;

export const demoSizes: DemoSize[] = [750, 2500, 6000];

const modules: ModuleSpec[] = [
  { name: "kernel", layer: 0, areas: ["logging", "config", "events", "time"] },
  { name: "identity", layer: 1, areas: ["users", "auth", "roles", "session"] },
  { name: "catalog", layer: 1, areas: ["product", "pricing", "inventory", "media"] },
  { name: "orders", layer: 2, areas: ["cart", "checkout", "pricing", "returns"] },
  { name: "billing", layer: 2, areas: ["invoice", "payment", "tax", "ledger"] },
  { name: "fulfillment", layer: 2, areas: ["routing", "warehouse", "shipment", "tracking"] },
  { name: "analytics", layer: 3, areas: ["events", "reporting", "cohorts", "export"] },
  { name: "search", layer: 3, areas: ["index", "ranking", "query", "sync"] },
  { name: "api", layer: 4, areas: ["rest", "graphql", "gateway", "dto"] },
  { name: "admin", layer: 4, areas: ["console", "forms", "tables", "audit"] }
];

const nouns = [
  "Account",
  "Access",
  "Address",
  "Allocation",
  "Audit",
  "Catalog",
  "Charge",
  "Command",
  "Context",
  "Contract",
  "Customer",
  "Document",
  "Event",
  "Gateway",
  "History",
  "Index",
  "Invoice",
  "Job",
  "Ledger",
  "LineItem",
  "Mapper",
  "Message",
  "Order",
  "Policy",
  "Projection",
  "Receipt",
  "Registry",
  "Request",
  "Response",
  "Rule",
  "Session",
  "Snapshot",
  "Token",
  "Worker"
];

const suffixes = [
  "Adapter",
  "Builder",
  "Controller",
  "Coordinator",
  "Entity",
  "Factory",
  "Gateway",
  "Handler",
  "Index",
  "Model",
  "Port",
  "Projection",
  "Provider",
  "Repository",
  "Resolver",
  "Service",
  "Strategy",
  "Validator",
  "View"
];

const linkTypes: DependencyKind[] = ["imports", "uses", "calls", "creates"];
const visibilities: Visibility[] = ["public", "protected", "private", "package"];
const fieldTypes = [
  "Clock",
  "EventBus",
  "Repository",
  "Map<String, Rule>",
  "List<LineItem>",
  "Money",
  "UUID",
  "Policy",
  "Client",
  "Cache",
  "Config"
];
const methodVerbs = [
  "load",
  "resolve",
  "validate",
  "apply",
  "publish",
  "hydrate",
  "persist",
  "project",
  "authorize",
  "compose",
  "calculate",
  "schedule"
];

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)] ?? items[0];
}

function idOf(linkEnd: string | { id: string }) {
  return typeof linkEnd === "string" ? linkEnd : linkEnd.id;
}

function addLink(links: RawLink[], seen: Set<string>, link: RawLink) {
  const source = idOf(link.source);
  const target = idOf(link.target);
  if (source === target) return;
  const type = link.type ?? link.kind ?? "unknown";
  const key = `${source}\u0000${target}\u0000${type}`;
  if (seen.has(key)) return;
  seen.add(key);
  links.push(link);
}

function memberName(base: string, index: number, rand: () => number) {
  const trimmed = base.replace(/(Service|Repository|Controller|Resolver|Handler|Gateway|Adapter|Model|Entity|Port)$/u, "");
  const noun = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  return `${pick(methodVerbs, rand)}${noun}${index === 0 ? "" : index + 1}`;
}

function createMembers(label: string, kind: string, complexity: number, rand: () => number): { fields: CodeMember[]; methods: CodeMember[] } {
  if (kind === "interface") {
    const count = Math.min(7, 2 + Math.floor(complexity / 5));
    return {
      fields: [],
      methods: Array.from({ length: count }, (_, index) => {
        const name = memberName(label, index, rand);
        return {
          name,
          kind: "method",
          visibility: "public",
          abstract: true,
          signature: `${name}(request: Request): Result`
        };
      })
    };
  }

  if (kind === "enum") {
    return {
      fields: [
        { name: "code", kind: "field", type: "String", visibility: "private" },
        { name: "terminal", kind: "field", type: "boolean", visibility: "private" }
      ],
      methods: [{ name: "fromCode", kind: "method", type: label, visibility: "public", static: true }]
    };
  }

  const fieldCount = Math.min(10, 2 + Math.floor(rand() * 5) + Math.floor(complexity / 9));
  const methodCount = Math.min(14, 3 + Math.floor(rand() * 6) + Math.floor(complexity / 6));

  return {
    fields: Array.from({ length: fieldCount }, (_, index) => ({
      name: `${pick(["primary", "cached", "pending", "current", "default", "audit"], rand)}${pick(nouns, rand)}`,
      kind: "field",
      type: pick(fieldTypes, rand),
      visibility: pick(visibilities, rand),
      static: rand() < 0.08
    })),
    methods: Array.from({ length: methodCount }, (_, index) => {
      const name = memberName(label, index, rand);
      return {
        name,
        kind: index === 0 && rand() < 0.45 ? "constructor" : "method",
        visibility: pick(visibilities, rand),
        signature: `${name}(${rand() < 0.5 ? "context: Context" : "input: Request"}): ${rand() < 0.45 ? "Result" : "void"}`
      };
    })
  };
}

export function createDemoGraph(classCount: DemoSize = 2500): RawGraph {
  const rand = mulberry32(classCount * 13 + 91);
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];
  const seenLinks = new Set<string>();
  const packageToNodeIds = new Map<string, string[]>();
  const moduleToNodeIds = new Map<string, string[]>();

  const packagesPerModule = classCount >= 6000 ? 10 : classCount >= 2500 ? 7 : 4;
  const packageNames = modules.flatMap((module) =>
    Array.from({ length: packagesPerModule }, (_, index) => {
      const area = module.areas[index % module.areas.length];
      return `${module.name}.${area}.${index + 1}`;
    })
  );

  for (let index = 0; index < classCount; index += 1) {
    const module = modules[index % modules.length];
    const packageName = packageNames[index % packageNames.length];
    const noun = nouns[(index + Math.floor(rand() * nouns.length)) % nouns.length];
    const suffix = suffixes[(index * 7 + Math.floor(rand() * suffixes.length)) % suffixes.length];
    const kindRoll = rand();
    const kind = kindRoll < 0.09 ? "interface" : kindRoll < 0.12 ? "enum" : "class";
    const label =
      kind === "interface"
        ? `${noun}${suffix}Port`
        : kind === "enum"
          ? `${noun}State`
          : `${noun}${suffix}`;
    const id = `${packageName}.${label}${index.toString(36)}`;
    const loc = Math.round(60 + rand() * 900 + (module.layer + 1) * rand() * 80);
    const complexity = Math.round(1 + rand() * 20 + (kind === "interface" ? -2 : 0));
    const members = createMembers(`${label}${index.toString(36)}`, kind, complexity, rand);

    nodes.push({
      id,
      label: `${label}${index.toString(36)}`,
      module: module.name,
      package: packageName,
      kind,
      loc,
      complexity,
      layer: module.layer,
      fields: members.fields,
      methods: members.methods
    });

    if (!packageToNodeIds.has(packageName)) packageToNodeIds.set(packageName, []);
    if (!moduleToNodeIds.has(module.name)) moduleToNodeIds.set(module.name, []);
    packageToNodeIds.get(packageName)?.push(id);
    moduleToNodeIds.get(module.name)?.push(id);
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  function chooseTarget(source: RawNode): RawNode | undefined {
    const roll = rand();
    const samePackage = packageToNodeIds.get(source.package ?? "") ?? [];

    if (roll < 0.62 && samePackage.length > 1) {
      return nodeById.get(pick(samePackage, rand));
    }

    const sourceModule = modules.find((module) => module.name === source.module) ?? modules[0];
    const candidateModules =
      roll < 0.9
        ? modules.filter((module) => module.layer <= sourceModule.layer && module.name !== source.module)
        : modules.filter((module) => module.name !== source.module);
    const targetModule = pick(candidateModules.length ? candidateModules : modules, rand);
    const ids = moduleToNodeIds.get(targetModule.name) ?? [];
    return nodeById.get(pick(ids, rand));
  }

  for (const source of nodes) {
    const fanOut = 2 + Math.floor(rand() * (classCount >= 6000 ? 5 : 4));
    for (let index = 0; index < fanOut; index += 1) {
      const target = chooseTarget(source);
      if (!target || target.id === source.id) continue;
      let type: DependencyKind = pick(linkTypes, rand);
      if (target.kind === "interface" && source.kind === "class") type = "implements";
      if (target.kind === "class" && rand() < 0.06) type = "inherits";
      addLink(links, seenLinks, {
        source: source.id,
        target: target.id,
        type,
        weight: type === "calls" ? 2 : 1,
        via: pick([...(source.methods ?? []), ...(source.fields ?? [])], rand)?.name,
        reason:
          type === "implements"
            ? "fulfills contract"
            : type === "inherits"
              ? "inherits behavior"
              : type === "creates"
                ? "constructs collaborator"
                : type === "calls"
                  ? "behavior calls collaborator"
                  : "state/type reference"
      });
    }
  }

  for (const ids of packageToNodeIds.values()) {
    if (ids.length < 6 || rand() > 0.42) continue;
    const start = Math.floor(rand() * (ids.length - 3));
    addLink(links, seenLinks, { source: ids[start], target: ids[start + 1], type: "uses", weight: 1 });
    addLink(links, seenLinks, { source: ids[start + 1], target: ids[start + 2], type: "uses", weight: 1 });
    addLink(links, seenLinks, { source: ids[start + 2], target: ids[start], type: "uses", weight: 1 });
  }

  return {
    nodes,
    links,
    meta: {
      name: `Demo estate (${classCount.toLocaleString()} classes)`,
      generatedAt: new Date().toISOString(),
      language: "mixed JVM/TypeScript style sample"
    }
  };
}
