#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function getArg(name, fallback) {
  const inline = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const baseUrl = getArg("url", process.env.OPENSQUAD_DASHBOARD_URL ?? "http://127.0.0.1:3000");
const outDir = path.resolve(getArg("out", path.join(process.cwd(), "artifacts", "opensquad-validation")));

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function capture() {
  await ensureDir(outDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 960 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.locator(".agents-table__row").first().waitFor({ timeout: 20_000 });
  await page.screenshot({
    path: path.join(outDir, "agents-page.png"),
    fullPage: true,
  });

  await page.locator(".agents-table__row").first().click();
  await page.locator(".agent-drawer").waitFor({ timeout: 10_000 });
  await page.screenshot({
    path: path.join(outDir, "agent-drawer.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.locator(".agent-drawer").waitFor({ state: "hidden", timeout: 10_000 });

  await page.getByRole("button", { name: "Alas ao Vivo", exact: true }).click();
  await page.locator(".live-alas, .dashboard-empty").first().waitFor({ timeout: 10_000 });
  await page.screenshot({
    path: path.join(outDir, "live-alas.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Escritório 2D", exact: true }).click();
  await page.locator(".office-view__canvas").waitFor({ timeout: 10_000 });
  await page.screenshot({
    path: path.join(outDir, "office-2d.png"),
    fullPage: true,
  });

  await browser.close();

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      baseUrl,
      outDir,
      files: [
        "agents-page.png",
        "agent-drawer.png",
        "live-alas.png",
        "office-2d.png",
      ],
    })}\n`,
  );
}

capture().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exit(1);
});
