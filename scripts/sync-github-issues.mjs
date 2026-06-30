import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repo = process.env.GITHUB_REPOSITORY || "hjosugi/dependency-palace";
const issueDir = new URL("../docs/issues/", import.meta.url);
const apply = process.argv.includes("--apply");

function parseIssueNumber(filename) {
  const match = filename.match(/^(\d{3})-.+\.md$/u);
  return match?.[1] ?? null;
}

function parseIssue(filename, body) {
  const number = parseIssueNumber(filename);
  if (!number) return null;
  const title = body.match(/^#\s+(.+)$/mu)?.[1]?.trim();
  if (!title) return null;
  const labelsLine = body.match(/^Labels:\s*(.+)$/mu)?.[1] ?? "";
  const labels = Array.from(labelsLine.matchAll(/`([^`]+)`/gu)).map((match) => match[1]);
  return {
    key: `DP-${number}`,
    title: `[DP-${number}] ${title}`,
    labels,
    body
  };
}

async function gh(args, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const { stdout } = await execFileAsync("gh", args, {
        maxBuffer: 10 * 1024 * 1024,
        ...options
      });
      return stdout.trim();
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

async function existingIssues() {
  const output = await gh(["api", `repos/${repo}/issues?state=all&per_page=100`]);
  const issues = JSON.parse(output || "[]");
  const byKey = new Map();
  for (const issue of issues) {
    const key = issue.title.match(/^\[(DP-\d{3})\]/u)?.[1];
    if (key) byKey.set(key, issue);
  }
  return byKey;
}

async function existingLabels() {
  const output = await gh(["label", "list", "--repo", repo, "--limit", "500", "--json", "name"]);
  return new Set(JSON.parse(output || "[]").map((label) => label.name));
}

async function ensureLabel(label, knownLabels) {
  if (knownLabels.has(label)) return;
  console.log(`${apply ? "create" : "would create"} label ${label}`);
  knownLabels.add(label);
  if (apply) {
    await gh(["label", "create", label, "--repo", repo, "--force", "--color", "ededed"]);
  }
}

async function main() {
  const files = (await readdir(issueDir))
    .filter((file) => parseIssueNumber(file))
    .sort();

  const issues = [];
  for (const file of files) {
    const body = await readFile(new URL(file, issueDir), "utf8");
    const issue = parseIssue(file, body);
    if (issue) issues.push(issue);
  }

  const knownIssues = await existingIssues();
  const knownLabels = await existingLabels();

  for (const issue of issues) {
    for (const label of issue.labels) await ensureLabel(label, knownLabels);

    const existing = knownIssues.get(issue.key);
    if (existing) {
      console.log(`exists #${existing.number} ${issue.title}`);
      continue;
    }

    console.log(`${apply ? "create" : "would create"} ${issue.title}`);
    if (apply) {
      const args = ["issue", "create", "--repo", repo, "--title", issue.title, "--body", issue.body];
      for (const label of issue.labels) args.push("--label", label);
      await gh(args);
    }
  }

  console.log(`${apply ? "synced" : "dry-run"} ${issues.length} local issues for ${repo}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
