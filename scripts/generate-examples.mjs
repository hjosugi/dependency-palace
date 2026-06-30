import { mkdir, writeFile } from "node:fs/promises";

const outDir = new URL("../public/examples/", import.meta.url);
const generatedAt = "2026-06-30T00:00:00.000Z";

const specs = [
  {
    id: "tiny-haskell-core",
    title: "Tiny Haskell Core",
    complexity: "tiny",
    language: "Haskell",
    style: "haskell",
    nodes: 18,
    fanOut: 2,
    cycles: 0,
    description: "records, typeclasses, instances, deriving, and small FP pipelines",
    recommended: { view: "focus", form: "atomic", focusDepth: 1, minDegree: 0, module: "all" }
  },
  {
    id: "tiny-java-service",
    title: "Tiny Java Service",
    complexity: "tiny",
    language: "Java",
    style: "java",
    nodes: 24,
    fanOut: 2,
    cycles: 1,
    description: "controller, service, repository, DTO, and interface contracts",
    recommended: { view: "focus", form: "blocks", focusDepth: 1, minDegree: 0, module: "all" }
  },
  {
    id: "small-fp-pipeline",
    title: "Small FP Pipeline",
    complexity: "small",
    language: "Haskell",
    style: "haskell",
    nodes: 64,
    fanOut: 3,
    cycles: 1,
    description: "function composition, constraints, data bodies, and typeclass instances",
    recommended: { view: "focus", form: "space", focusDepth: 2, minDegree: 0, module: "all" }
  },
  {
    id: "small-clean-architecture",
    title: "Small Clean Architecture",
    complexity: "small",
    language: "Java",
    style: "java",
    nodes: 96,
    fanOut: 3,
    cycles: 2,
    description: "ports, adapters, entities, use cases, and boundary classes",
    recommended: { view: "focus", form: "tree", focusDepth: 2, minDegree: 0, module: "all" }
  },
  {
    id: "medium-haskell-platform",
    title: "Medium Haskell Platform",
    complexity: "medium",
    language: "Haskell",
    style: "haskell",
    nodes: 180,
    fanOut: 4,
    cycles: 3,
    description: "larger algebra/typeclass graph with validation and persistence pipelines",
    recommended: { view: "focus", form: "atomic", focusDepth: 2, minDegree: 1, module: "all" }
  },
  {
    id: "medium-polyglot-services",
    title: "Medium Polyglot Services",
    complexity: "medium",
    language: "Java, Haskell, Go, Rust, TypeScript",
    style: "polyglot",
    nodes: 320,
    fanOut: 4,
    cycles: 6,
    description: "mixed services, SDKs, adapters, contracts, workers, and DTOs",
    recommended: { view: "overview", form: "palace", focusDepth: 1, minDegree: 1, module: "all" }
  },
  {
    id: "large-modular-monolith",
    title: "Large Modular Monolith",
    complexity: "large",
    language: "Java",
    style: "java",
    nodes: 750,
    fanOut: 5,
    cycles: 14,
    description: "bounded contexts with dense service/repository/entity relationships",
    recommended: { view: "overview", form: "blocks", focusDepth: 1, minDegree: 2, module: "all" }
  },
  {
    id: "large-fp-event-system",
    title: "Large FP Event System",
    complexity: "large",
    language: "Haskell",
    style: "haskell",
    nodes: 1100,
    fanOut: 5,
    cycles: 12,
    description: "event-sourced FP system with algebras, interpreters, and composition",
    recommended: { view: "overview", form: "space", focusDepth: 1, minDegree: 2, module: "all" }
  },
  {
    id: "xlarge-enterprise-platform",
    title: "XL Enterprise Platform",
    complexity: "xlarge",
    language: "Java, Haskell, Go, Rust, TypeScript, Python",
    style: "polyglot",
    nodes: 1800,
    fanOut: 6,
    cycles: 32,
    description: "large product platform with cross-module contracts and hot hubs",
    recommended: { view: "overview", form: "palace", focusDepth: 1, minDegree: 3, module: "all" }
  },
  {
    id: "stress-dense-cycles",
    title: "Stress Dense Cycles",
    complexity: "stress",
    language: "Polyglot",
    style: "polyglot",
    nodes: 2600,
    fanOut: 8,
    cycles: 70,
    description: "dense cyclic dependency stress case for filtering, focus, and rendering",
    recommended: { view: "overview", form: "atomic", focusDepth: 1, minDegree: 5, module: "all" }
  }
];

const domainModules = [
  { name: "identity", layer: 1, areas: ["users", "auth", "roles", "session"] },
  { name: "catalog", layer: 1, areas: ["product", "pricing", "inventory", "media"] },
  { name: "orders", layer: 2, areas: ["cart", "checkout", "returns", "workflow"] },
  { name: "billing", layer: 2, areas: ["invoice", "payment", "tax", "ledger"] },
  { name: "fulfillment", layer: 3, areas: ["warehouse", "routing", "shipment", "tracking"] },
  { name: "analytics", layer: 4, areas: ["events", "cohorts", "reporting", "export"] },
  { name: "platform", layer: 0, areas: ["config", "logging", "events", "time"] },
  { name: "api", layer: 5, areas: ["rest", "graphql", "gateway", "dto"] }
];

const nouns = [
  "Account",
  "Address",
  "Allocation",
  "Audit",
  "Catalog",
  "Charge",
  "Checkout",
  "Context",
  "Customer",
  "Document",
  "Event",
  "Gateway",
  "History",
  "Invoice",
  "Ledger",
  "Message",
  "Order",
  "Payment",
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

const javaSuffixes = [
  "Adapter",
  "Controller",
  "Entity",
  "Factory",
  "Gateway",
  "Handler",
  "Model",
  "Policy",
  "Port",
  "Projection",
  "Repository",
  "Resolver",
  "Service",
  "Strategy",
  "Validator",
  "View"
];

const haskellDataSuffixes = ["Command", "Event", "Request", "Response", "State", "Config", "Snapshot", "Error"];
const haskellFunctionPrefixes = ["validate", "authorize", "persist", "project", "hydrate", "publish", "compose", "fold"];
const haskellTypeclassSuffixes = ["Algebra", "Store", "Codec", "Policy", "Monad", "Repository"];
const verbs = ["load", "resolve", "validate", "apply", "publish", "hydrate", "persist", "project", "authorize", "compose"];
const edgeKinds = ["imports", "uses", "calls", "creates"];
const languages = ["java", "haskell", "go", "rust", "typescript", "python"];

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick(items, rand) {
  return items[Math.floor(rand() * items.length)] ?? items[0];
}

function lowerFirst(value) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function uniqueLabel(base, index) {
  return `${base}${index.toString(36)}`;
}

function addLink(links, seen, source, target, type, via, reason, weight = 1) {
  if (!source || !target || source === target) return;
  const key = `${source}\u0000${target}\u0000${type}\u0000${via ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  links.push({ source, target, type, via, reason, weight });
}

function javaMembers(label, complexity, rand, kind) {
  if (kind === "interface") {
    return {
      fields: [],
      methods: Array.from({ length: Math.min(8, 2 + Math.floor(complexity / 4)) }, (_, index) => {
        const name = `${pick(verbs, rand)}${label.replace(/Port$/u, "")}${index ? index + 1 : ""}`;
        return {
          name: lowerFirst(name),
          kind: "method",
          visibility: "public",
          abstract: true,
          signature: `${lowerFirst(name)}(request: Request): Result`
        };
      })
    };
  }

  const fieldCount = Math.min(12, 2 + Math.floor(rand() * 4) + Math.floor(complexity / 8));
  const methodCount = Math.min(16, 3 + Math.floor(rand() * 6) + Math.floor(complexity / 6));
  return {
    fields: Array.from({ length: fieldCount }, (_, index) => ({
      name: `${pick(["primary", "cached", "pending", "current", "audit"], rand)}${pick(nouns, rand)}${index ? index + 1 : ""}`,
      kind: "field",
      type: pick(["Clock", "EventBus", "Repository", "Money", "UUID", "Policy", "Client", "Cache", "Config"], rand),
      visibility: pick(["private", "protected", "package"], rand)
    })),
    methods: Array.from({ length: methodCount }, (_, index) => {
      const name = lowerFirst(`${pick(verbs, rand)}${label.replace(/(Service|Repository|Controller|Entity|Adapter)$/u, "")}${index ? index + 1 : ""}`);
      return {
        name,
        kind: index === 0 && rand() < 0.36 ? "constructor" : "method",
        visibility: pick(["public", "protected", "private", "package"], rand),
        signature: `${name}(${rand() < 0.5 ? "context: Context" : "input: Request"}): ${rand() < 0.5 ? "Result" : "void"}`
      };
    })
  };
}

function haskellMembers(label, complexity, rand, kind) {
  if (kind === "typeclass") {
    return {
      fields: [],
      methods: Array.from({ length: Math.min(7, 2 + Math.floor(complexity / 5)) }, (_, index) => {
        const name = `${pick(haskellFunctionPrefixes, rand)}${label.replace(/(Algebra|Store|Codec|Policy|Monad|Repository)$/u, "")}${index ? index + 1 : ""}`;
        return {
          name: lowerFirst(name),
          kind: "method",
          visibility: "public",
          abstract: true,
          signature: `${lowerFirst(name)} :: m a -> m b`
        };
      })
    };
  }

  if (kind === "function") {
    return {
      fields: [],
      methods: [
        {
          name: label,
          kind: "method",
          visibility: "public",
          signature: `${label} :: (Monad m, HasCallStack) => input -> m output`
        }
      ]
    };
  }

  const fieldCount = Math.min(10, 2 + Math.floor(rand() * 4) + Math.floor(complexity / 9));
  return {
    fields: Array.from({ length: fieldCount }, (_, index) => ({
      name: `${lowerFirst(pick(nouns, rand))}${index ? index + 1 : ""}`,
      kind: "field",
      type: pick(["Text", "Money", "UUID", "Natural", "UTCTime", "NonEmpty Event", "Map Text Value"], rand),
      visibility: "public"
    })),
    methods: []
  };
}

function makeNode(spec, index, rand) {
  const module = domainModules[index % domainModules.length];
  const area = module.areas[(index + Math.floor(rand() * module.areas.length)) % module.areas.length];
  const language = spec.style === "polyglot" ? languages[index % languages.length] : spec.style;
  const noun = nouns[(index + Math.floor(rand() * nouns.length)) % nouns.length];
  const packageName = `${language}.${module.name}.${area}`;
  const baseComplexity = spec.complexity === "tiny" ? 4 : spec.complexity === "small" ? 8 : spec.complexity === "medium" ? 13 : spec.complexity === "large" ? 20 : 28;
  const complexity = Math.max(1, Math.round(baseComplexity * (0.55 + rand() * 1.15)));
  const loc = Math.round(20 + complexity * (language === "haskell" ? 7 : 18) + rand() * 240);
  let kind = "class";
  let label = "";

  if (language === "haskell") {
    const roll = rand();
    if (roll < 0.18) {
      kind = "typeclass";
      label = uniqueLabel(`${noun}${pick(haskellTypeclassSuffixes, rand)}`, index);
    } else if (roll < 0.58) {
      kind = "datatype";
      label = uniqueLabel(`${noun}${pick(haskellDataSuffixes, rand)}`, index);
    } else {
      kind = "function";
      label = `${pick(haskellFunctionPrefixes, rand)}${noun}${index.toString(36)}`;
    }
    const members = haskellMembers(label, complexity, rand, kind);
    return {
      id: `${packageName}.${label}`,
      label,
      module: module.name,
      package: packageName,
      kind,
      loc,
      complexity,
      layer: module.layer,
      fields: members.fields,
      methods: members.methods,
      language
    };
  }

  const roll = rand();
  if (roll < 0.11) kind = "interface";
  else if (roll < 0.14) kind = "enum";
  else if (language === "rust" || language === "go") kind = roll < 0.32 ? "datatype" : "class";
  const suffix = kind === "interface" ? "Port" : kind === "enum" ? "State" : pick(javaSuffixes, rand);
  label = uniqueLabel(`${noun}${suffix}`, index);
  const members = javaMembers(label, complexity, rand, kind);
  return {
    id: `${packageName}.${label}`,
    label,
    module: module.name,
    package: packageName,
    kind,
    loc,
    complexity,
    layer: module.layer,
    fields: members.fields,
    methods: members.methods,
    language
  };
}

function trimMembersForScale(node, spec, index) {
  if (spec.nodes < 700) return node;

  const richInterval = spec.nodes >= 1800 ? 17 : 11;
  const keepRich = index % richInterval === 0;
  const fieldLimit = keepRich ? 6 : spec.nodes >= 1800 ? 2 : 3;
  const methodLimit = keepRich ? 8 : spec.nodes >= 1800 ? 3 : 4;

  return {
    ...node,
    fields: (node.fields ?? []).slice(0, fieldLimit),
    methods: (node.methods ?? []).slice(0, methodLimit)
  };
}

function bucketNodes(nodes) {
  const buckets = {
    all: nodes,
    javaLike: nodes.filter((node) => node.language !== "haskell"),
    haskell: nodes.filter((node) => node.language === "haskell"),
    classes: nodes.filter((node) => node.kind === "class"),
    datatypes: nodes.filter((node) => node.kind === "datatype"),
    functions: nodes.filter((node) => node.kind === "function"),
    contracts: nodes.filter((node) => node.kind === "interface" || node.kind === "typeclass")
  };
  return buckets;
}

function connectGraph(spec, nodes, rand) {
  const links = [];
  const seen = new Set();
  const buckets = bucketNodes(nodes);
  const byPackage = new Map();
  const byModule = new Map();

  for (const node of nodes) {
    if (!byPackage.has(node.package)) byPackage.set(node.package, []);
    if (!byModule.has(node.module)) byModule.set(node.module, []);
    byPackage.get(node.package).push(node);
    byModule.get(node.module).push(node);
  }

  const targetFor = (source, preferred) => {
    const samePackage = byPackage.get(source.package) ?? [];
    const sameModule = byModule.get(source.module) ?? [];
    const pool = preferred?.length ? preferred : rand() < 0.58 ? samePackage : rand() < 0.82 ? sameModule : nodes;
    return pick(pool.length > 1 ? pool.filter((node) => node.id !== source.id) : nodes, rand);
  };

  for (const source of nodes) {
    const localFanout = Math.max(1, spec.fanOut + Math.floor(rand() * 2) - 1);

    if (source.language === "haskell") {
      if (source.kind === "datatype") {
        for (const contract of ["base.Eq", "base.Show", "base.Generic"].slice(0, 1 + Math.floor(rand() * 3))) {
          addLink(links, seen, source.id, contract, "derives", "deriving", "derived behavior");
        }
        const typeclass = targetFor(source, buckets.contracts.filter((node) => node.kind === "typeclass"));
        addLink(links, seen, source.id, typeclass.id, "instance", source.label, "datatype implements typeclass");
      }
      if (source.kind === "function") {
        for (let index = 0; index < localFanout; index += 1) {
          const target =
            index % 3 === 0
              ? targetFor(source, buckets.functions)
              : index % 3 === 1
                ? targetFor(source, buckets.datatypes)
                : targetFor(source, buckets.contracts);
          const type = target.kind === "function" ? "composes" : target.kind === "typeclass" ? "constrains" : "uses";
          addLink(links, seen, source.id, target.id, type, source.label, type === "composes" ? "function composition pipeline" : "function signature type reference");
        }
      }
      if (source.kind === "typeclass") {
        const parent = targetFor(source, buckets.contracts.filter((node) => node.id !== source.id));
        addLink(links, seen, source.id, parent.id, "constrains", undefined, "superclass or capability constraint");
      }
      continue;
    }

    if (source.kind === "class") {
      const contract = targetFor(source, buckets.contracts.filter((node) => node.kind === "interface"));
      if (contract) addLink(links, seen, source.id, contract.id, "implements", "class declaration", "fulfills contract");
      if (rand() < 0.14) {
        const parent = targetFor(source, buckets.classes);
        addLink(links, seen, source.id, parent.id, "inherits", "extends", "inherits behavior");
      }
    }

    for (let index = 0; index < localFanout; index += 1) {
      const target = targetFor(source);
      const type = source.kind === "interface" && target.kind === "interface" ? "inherits" : pick(edgeKinds, rand);
      const via = pick([...(source.methods ?? []), ...(source.fields ?? [])], rand)?.name;
      addLink(
        links,
        seen,
        source.id,
        target.id,
        type,
        via,
        type === "calls" ? "behavior calls collaborator" : type === "creates" ? "constructs collaborator" : "state/type reference",
        type === "calls" ? 2 : 1
      );
      if ((source.fields ?? []).length && rand() < 0.28) {
        addLink(links, seen, source.id, target.id, "contains", pick(source.fields, rand).name, "field composition");
      }
    }
  }

  for (let index = 0; index < spec.cycles; index += 1) {
    const a = nodes[(index * 37 + Math.floor(rand() * nodes.length)) % nodes.length];
    const b = targetFor(a);
    const c = targetFor(b);
    const type = a.language === "haskell" && b.language === "haskell" ? "composes" : "uses";
    addLink(links, seen, a.id, b.id, type, "cycleA", "intentional example cycle");
    addLink(links, seen, b.id, c.id, type, "cycleB", "intentional example cycle");
    addLink(links, seen, c.id, a.id, type, "cycleC", "intentional example cycle");
  }

  if (spec.style === "haskell" || spec.style === "polyglot") {
    for (const node of nodes.filter((item) => item.language === "haskell" && item.kind === "datatype").slice(0, Math.min(80, nodes.length))) {
      const fieldTarget = targetFor(node, buckets.datatypes.filter((item) => item.id !== node.id));
      addLink(links, seen, node.id, fieldTarget.id, "contains", "record field", "record field composition");
    }
  }

  return links;
}

function buildGraph(spec) {
  const rand = mulberry32(hashString(spec.id));
  const nodes = [];

  if (spec.style === "haskell" || spec.style === "polyglot") {
    for (const contract of ["Eq", "Show", "Generic", "Functor", "Applicative", "Monad"]) {
      nodes.push({
        id: `base.${contract}`,
        label: contract,
        module: "base",
        package: "base",
        kind: "typeclass",
        loc: 1,
        complexity: 1,
        layer: 0,
        fields: [],
        methods: [{ name: lowerFirst(contract), kind: "method", visibility: "public", abstract: true, signature: `${lowerFirst(contract)} :: a -> a` }],
        language: "haskell"
      });
    }
  }

  while (nodes.length < spec.nodes) {
    nodes.push(trimMembersForScale(makeNode(spec, nodes.length, rand), spec, nodes.length));
  }

  const links = connectGraph(spec, nodes, rand);
  return {
    nodes: nodes.map(({ language, ...node }) => node),
    links,
    meta: {
      name: spec.title,
      generatedAt,
      language: spec.language
    }
  };
}

await mkdir(outDir, { recursive: true });

const index = [];
for (const spec of specs) {
  const graph = buildGraph(spec);
  const file = `${spec.id}.json`;
  await writeFile(new URL(file, outDir), `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  index.push({
    id: spec.id,
    title: spec.title,
    file: `/examples/${file}`,
    nodes: graph.nodes.length,
    links: graph.links.length,
    complexity: spec.complexity,
    language: spec.language,
    description: spec.description,
    recommended: spec.recommended
  });
}

await writeFile(new URL("index.json", outDir), `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log(`Generated ${index.length} examples in ${outDir.pathname}`);
for (const item of index) {
  console.log(`${item.id}: ${item.nodes} nodes, ${item.links} links, ${item.complexity}`);
}
