import { mkdir } from "node:fs/promises";
import { PNG } from "pngjs";
import { chromium } from "playwright";

const baseUrl = process.env.VITE_URL ?? "http://127.0.0.1:5173";
const executablePath = process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable";
const outputDir = new URL("../artifacts/", import.meta.url);

const viewports = [
  { name: "desktop", width: 1440, height: 960, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true }
];

const forms = [
  { label: "Palace", id: "palace" },
  { label: "Tree", id: "tree" },
  { label: "Blocks", id: "blocks" },
  { label: "Life", id: "organism" },
  { label: "Space", id: "space" },
  { label: "Atomic", id: "atomic" }
];

const desktopExamples = [
  { title: "Tiny Haskell Core", id: "tiny-haskell-core" },
  { title: "Stress Dense Cycles", id: "stress-dense-cycles" }
];

function nonBackgroundRatio(buffer) {
  const png = PNG.sync.read(buffer);
  let sampled = 0;
  let nonBackground = 0;

  for (let y = 0; y < png.height; y += 3) {
    for (let x = 0; x < png.width; x += 3) {
      const offset = (png.width * y + x) << 2;
      const r = png.data[offset];
      const g = png.data[offset + 1];
      const b = png.data[offset + 2];
      const a = png.data[offset + 3];
      sampled += 1;

      const backgroundLike = a > 240 && r >= 12 && r <= 25 && g >= 11 && g <= 24 && b >= 10 && b <= 24;
      if (!backgroundLike) nonBackground += 1;
    }
  }

  return nonBackground / Math.max(1, sampled);
}

function differenceRatio(firstBuffer, secondBuffer) {
  const first = PNG.sync.read(firstBuffer);
  const second = PNG.sync.read(secondBuffer);
  const width = Math.min(first.width, second.width);
  const height = Math.min(first.height, second.height);
  let sampled = 0;
  let changed = 0;

  for (let y = 0; y < height; y += 5) {
    for (let x = 0; x < width; x += 5) {
      const firstOffset = (first.width * y + x) << 2;
      const secondOffset = (second.width * y + x) << 2;
      const delta =
        Math.abs(first.data[firstOffset] - second.data[secondOffset]) +
        Math.abs(first.data[firstOffset + 1] - second.data[secondOffset + 1]) +
        Math.abs(first.data[firstOffset + 2] - second.data[secondOffset + 2]);
      sampled += 1;
      if (delta > 18) changed += 1;
    }
  }

  return changed / Math.max(1, sampled);
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--ignore-gpu-blocklist", "--enable-webgl", "--use-gl=swiftshader"]
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      deviceScaleFactor: viewport.isMobile ? 2 : 1
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => {
      throw error;
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("canvas.graph-canvas", { state: "visible" });
    await page.waitForFunction(() => {
      const canvas = document.querySelector("canvas.graph-canvas");
      return canvas && canvas.width > 100 && canvas.height > 100;
    });
    await page.waitForTimeout(1200);

    const canvas = page.locator("canvas.graph-canvas");
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await canvas.boundingBox();
    if (!box) throw new Error(`Canvas was not measurable for ${viewport.name}`);

    await page.screenshot({ path: new URL(`${viewport.name}.png`, outputDir).pathname, fullPage: true });
    const canvasShot = await page.screenshot({
      path: new URL(`${viewport.name}-canvas.png`, outputDir).pathname,
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.max(1, Math.min(box.width, viewport.width - box.x)),
        height: Math.max(1, Math.min(box.height, viewport.height - box.y))
      }
    });

    const ratio = nonBackgroundRatio(canvasShot);
    if (ratio < 0.015) {
      throw new Error(`${viewport.name} canvas looked blank: non-background ratio ${ratio.toFixed(4)}`);
    }

    await page.waitForTimeout(900);
    const movedShot = await page.screenshot({
      path: new URL(`${viewport.name}-canvas-moving.png`, outputDir).pathname,
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.max(1, Math.min(box.width, viewport.width - box.x)),
        height: Math.max(1, Math.min(box.height, viewport.height - box.y))
      }
    });
    const movement = differenceRatio(canvasShot, movedShot);
    if (movement < 0.002) {
      throw new Error(`${viewport.name} canvas did not appear to move: changed ratio ${movement.toFixed(4)}`);
    }

    const metrics = await page.evaluate(() => {
      const stats = [...document.querySelectorAll(".metric-strip span")].map((node) => node.textContent?.trim());
      const canvas = document.querySelector("canvas.graph-canvas");
      return {
        stats,
        backend: canvas?.dataset.backend ?? "unknown",
        canvasWidth: canvas?.clientWidth ?? 0,
        canvasHeight: canvas?.clientHeight ?? 0
      };
    });

    console.log(
      `${viewport.name}: ${metrics.canvasWidth}x${metrics.canvasHeight}, backend=${metrics.backend}, non-background=${ratio.toFixed(3)}, moving=${movement.toFixed(3)}, ${metrics.stats.join(" | ")}`
    );

    if (!viewport.isMobile) {
      for (const form of forms) {
        await page
          .getByRole("group", { name: "Visualization metaphor" })
          .getByRole("button", { name: form.label, exact: true })
          .click();
        await page.waitForFunction(
          (id) => [...document.querySelectorAll(".metric-strip span")].some((node) => node.textContent?.trim() === `${id} form`),
          form.id
        );
        await page.waitForTimeout(250);
        const formShot = await page.screenshot({
          path: new URL(`${viewport.name}-${form.id}-canvas.png`, outputDir).pathname,
          clip: {
            x: Math.max(0, box.x),
            y: Math.max(0, box.y),
            width: Math.max(1, Math.min(box.width, viewport.width - box.x)),
            height: Math.max(1, Math.min(box.height, viewport.height - box.y))
          }
        });
        const formRatio = nonBackgroundRatio(formShot);
        if (formRatio < 0.015) {
          throw new Error(`${viewport.name} ${form.id} form looked blank: non-background ratio ${formRatio.toFixed(4)}`);
        }
      }
      console.log(`desktop forms: ${forms.map((form) => form.id).join(", ")}`);

      for (const example of desktopExamples) {
        await page.getByRole("button", { name: new RegExp(example.title) }).click();
        await page.waitForFunction(
          (title) => document.querySelector(".brand-block p")?.textContent?.trim() === title,
          example.title
        );
        await page.waitForTimeout(example.id.includes("stress") ? 1600 : 600);
        const exampleShot = await page.screenshot({
          path: new URL(`${viewport.name}-example-${example.id}-canvas.png`, outputDir).pathname,
          clip: {
            x: Math.max(0, box.x),
            y: Math.max(0, box.y),
            width: Math.max(1, Math.min(box.width, viewport.width - box.x)),
            height: Math.max(1, Math.min(box.height, viewport.height - box.y))
          }
        });
        const exampleRatio = nonBackgroundRatio(exampleShot);
        if (exampleRatio < 0.015) {
          throw new Error(`${viewport.name} ${example.id} example looked blank: non-background ratio ${exampleRatio.toFixed(4)}`);
        }
      }
      console.log(`desktop examples: ${desktopExamples.map((example) => example.id).join(", ")}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}
