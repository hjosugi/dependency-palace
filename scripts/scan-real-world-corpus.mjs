import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const workspace = path.resolve(".dependency-palace", "real-world");
const outputDir = path.resolve("artifacts", "real-world");

const corpus = [
  {
    id: "haskell-text",
    title: "Haskell text core",
    repo: "https://github.com/haskell/text.git",
    branch: "master",
    license: "BSD-2-Clause",
    sourcePath: "src",
    moduleDepth: 2,
    highlights: ["modules", "datatypes", "top-level functions", "imports"]
  },
  {
    id: "apache-commons-lang",
    title: "Apache Commons Lang",
    repo: "https://github.com/apache/commons-lang.git",
    branch: "master",
    license: "Apache-2.0",
    sourcePath: "src/main/java",
    moduleDepth: 4,
    highlights: ["packages", "classes", "interfaces", "fields", "methods", "inheritance"]
  }
];

async function run(command, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    maxBuffer: 20 * 1024 * 1024,
    ...options
  });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
}

async function ensureCheckout(item) {
  const checkout = path.join(workspace, item.id);
  if (!existsSync(checkout)) {
    await mkdir(workspace, { recursive: true });
    await run("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", "--branch", item.branch, item.repo, checkout]);
  } else {
    await run("git", ["fetch", "--depth", "1", "origin", item.branch], { cwd: checkout });
    await run("git", ["checkout", item.branch], { cwd: checkout });
    await run("git", ["pull", "--ff-only"], { cwd: checkout });
  }
  await run("git", ["sparse-checkout", "set", "--skip-checks", item.sourcePath, "LICENSE", "LICENSE.txt", "NOTICE", "README.md"], {
    cwd: checkout
  });
  return checkout;
}

async function scan(item) {
  const checkout = await ensureCheckout(item);
  const sourceRoot = path.join(checkout, item.sourcePath);
  const out = path.join(outputDir, `${item.id}.graph.json`);
  const diagnosticsOut = path.join(outputDir, `${item.id}.diagnostics.json`);
  await mkdir(outputDir, { recursive: true });
  await run("tsx", [
    "src/cli/scan.ts",
    sourceRoot,
    "--out",
    out,
    "--diagnostics-out",
    diagnosticsOut,
    "--module-depth",
    String(item.moduleDepth),
    "--format",
    "both",
    "--compact-out",
    path.join(outputDir, `${item.id}.graph.dpg`)
  ]);
  return { item, out, diagnosticsOut };
}

async function main() {
  const selected = new Set(process.argv.slice(2));
  const targets = selected.size ? corpus.filter((item) => selected.has(item.id)) : corpus;
  if (targets.length === 0) throw new Error(`No matching corpus id. Known ids: ${corpus.map((item) => item.id).join(", ")}`);

  const results = [];
  for (const item of targets) results.push(await scan(item));
  console.log(
    JSON.stringify(
      {
        outputDir,
        results: results.map(({ item, out, diagnosticsOut }) => ({
          id: item.id,
          title: item.title,
          repo: item.repo,
          license: item.license,
          sourcePath: item.sourcePath,
          highlights: item.highlights,
          graph: out,
          diagnostics: diagnosticsOut
        }))
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
