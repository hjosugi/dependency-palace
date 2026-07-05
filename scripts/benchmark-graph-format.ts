import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { encodeCompactGraph, decodeCompactGraph } from "../src/graph/compact";
import type { RawGraph } from "../src/types";

const input = process.argv[2] ?? "public/examples/stress-dense-cycles.json";
const iterations = Number(process.argv[3] ?? 5);

function now() {
  return performance.now();
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

async function main() {
  const jsonText = await readFile(input, "utf8");
  const graph = JSON.parse(jsonText) as RawGraph;
  const compact = encodeCompactGraph(graph);
  const compactPath = path.join("artifacts", "benchmarks", `${path.basename(input).replace(/\.json$/u, "")}.dpg`);
  await mkdir(path.dirname(compactPath), { recursive: true });
  await writeFile(compactPath, compact);

  const jsonMs: number[] = [];
  const compactMs: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    let started = now();
    JSON.parse(jsonText);
    jsonMs.push(now() - started);

    started = now();
    decodeCompactGraph(compact);
    compactMs.push(now() - started);
  }

  console.log(
    JSON.stringify(
      {
        input,
        compactPath,
        iterations,
        jsonBytes: Buffer.byteLength(jsonText),
        compactBytes: compact.byteLength,
        jsonParseMs: Math.round(average(jsonMs)),
        compactDecodeMs: Math.round(average(compactMs))
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
