#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const runOnce = hasFlag("once");
const intervalSeconds = Number.parseInt(getArg("interval", "60"), 10);
const sourceUrl =
  getArg("source-url", null) ??
  process.env.VELYA_OPENSQUAD_SNAPSHOT_SOURCE_URL ??
  `http://127.0.0.1:${process.env.VELYA_DASHBOARD_PORT ?? "5173"}/api/snapshot`;
const stateRoot =
  process.env.VELYA_AUTOPILOT_STATE_DIR ??
  path.join(os.homedir(), ".local", "state", "velya", "autopilot");
const checkoutDir = path.resolve(
  getArg("checkout-dir", path.join(stateRoot, "publishers", "opensquad-autopilot-state")),
);
const healthFile = getArg(
  "health-file",
  path.join(stateRoot, "services", "opensquad-snapshot-publisher.last.json"),
);
const remoteBranch = getArg("branch", "autopilot-state");
const snapshotPath = getArg("snapshot-path", "state/opensquad/dashboard-snapshot.json");
const metadataPath = getArg("metadata-path", "state/opensquad/dashboard-snapshot.meta.json");
const generatedAtPath = getArg("generated-at-path", "state/opensquad/last-generated-at.txt");
const remoteUrlOverride = process.env.VELYA_AUTOPILOT_REMOTE_URL ?? null;
const gitToken = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";

function normalizeRemoteUrl(remoteUrl) {
  if (remoteUrl.startsWith("git@github.com:")) {
    return `https://github.com/${remoteUrl.slice("git@github.com:".length)}`;
  }
  if (remoteUrl.startsWith("ssh://git@github.com/")) {
    return `https://github.com/${remoteUrl.slice("ssh://git@github.com/".length)}`;
  }
  return remoteUrl;
}

function runGit(gitArgs, options = {}) {
  const commandArgs = [];
  if (gitToken) {
    commandArgs.push("-c", `http.extraheader=AUTHORIZATION: bearer ${gitToken}`);
  }
  commandArgs.push(...gitArgs);

  const result = spawnSync("git", commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.captureOutput === false ? "inherit" : ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const errorMessage =
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      `git ${gitArgs.join(" ")} failed with exit ${result.status}`;
    throw new Error(errorMessage);
  }

  return (result.stdout ?? "").trim();
}

function detectRemoteUrl() {
  if (remoteUrlOverride) return normalizeRemoteUrl(remoteUrlOverride);
  const raw = runGit(["config", "--get", "remote.origin.url"]);
  if (!raw) {
    throw new Error("No git remote.origin.url configured in the main repository.");
  }
  return normalizeRemoteUrl(raw);
}

async function ensureCheckout() {
  await fsp.mkdir(checkoutDir, { recursive: true });

  if (!fs.existsSync(path.join(checkoutDir, ".git"))) {
    runGit(["init"], { cwd: checkoutDir });
  }

  const remoteUrl = detectRemoteUrl();
  let existingRemote = "";
  try {
    existingRemote = runGit(
      ["remote", "get-url", "origin"],
      { cwd: checkoutDir, captureOutput: true },
    );
  } catch {
    existingRemote = "";
  }
  if (!existingRemote) {
    runGit(["remote", "add", "origin", remoteUrl], { cwd: checkoutDir });
  } else if (existingRemote !== remoteUrl) {
    runGit(["remote", "set-url", "origin", remoteUrl], { cwd: checkoutDir });
  }

  runGit(["config", "user.name", "autopilot-bot"], { cwd: checkoutDir });
  runGit(["config", "user.email", "autopilot-bot@velya.io"], { cwd: checkoutDir });

  let branchExists = false;
  try {
    runGit(["ls-remote", "--exit-code", "--heads", "origin", remoteBranch], {
      cwd: checkoutDir,
    });
    branchExists = true;
  } catch {
    branchExists = false;
  }

  if (branchExists) {
    runGit(["fetch", "--depth", "1", "origin", remoteBranch], { cwd: checkoutDir });
    runGit(["checkout", "-B", remoteBranch, "FETCH_HEAD"], { cwd: checkoutDir });
  } else {
    runGit(["checkout", "--orphan", remoteBranch], { cwd: checkoutDir });
    const readmePath = path.join(checkoutDir, "README.md");
    if (!fs.existsSync(readmePath)) {
      await fsp.writeFile(
        readmePath,
        [
          "# autopilot-state",
          "",
          "Operational state for opensquad/autopilot consumers.",
          "",
          "Published artifacts:",
          `- \`${snapshotPath}\``,
          `- \`${metadataPath}\``,
          `- \`${generatedAtPath}\``,
          "",
        ].join("\n"),
        "utf8",
      );
      runGit(["add", "README.md"], { cwd: checkoutDir });
      runGit(
        ["commit", "-m", "chore(autopilot-state): initialize opensquad publisher"],
        { cwd: checkoutDir },
      );
    }
  }
}

async function fetchSnapshot() {
  const response = await fetch(sourceUrl, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Snapshot source returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.type !== "SNAPSHOT" ||
    !Array.isArray(payload.squads)
  ) {
    throw new Error("Snapshot source did not return a valid dashboard payload.");
  }
  return payload;
}

async function writeJson(targetPath, payload) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function writeText(targetPath, payload) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, payload, "utf8");
}

async function commitSnapshot(snapshot) {
  await ensureCheckout();

  const snapshotFile = path.join(checkoutDir, snapshotPath);
  const metadataFile = path.join(checkoutDir, metadataPath);
  const generatedAtFile = path.join(checkoutDir, generatedAtPath);
  const publishedAt = new Date().toISOString();

  await writeJson(snapshotFile, snapshot);
  await writeJson(metadataFile, {
    publishedAt,
    sourceUrl,
    snapshotGeneratedAt: snapshot?.sync?.snapshotGeneratedAt ?? null,
    squads: snapshot.squads.length,
    activeSquads: Object.keys(snapshot.activeStates ?? {}).length,
    delegations: Array.isArray(snapshot.delegations) ? snapshot.delegations.length : 0,
    handoffs: Array.isArray(snapshot.handoffs) ? snapshot.handoffs.length : 0,
  });
  await writeText(
    generatedAtFile,
    `${snapshot?.sync?.snapshotGeneratedAt ?? publishedAt}\n`,
  );

  runGit(["add", snapshotPath, metadataPath, generatedAtPath], { cwd: checkoutDir });

  let changed = true;
  try {
    runGit(["diff", "--cached", "--quiet"], { cwd: checkoutDir });
    changed = false;
  } catch {
    changed = true;
  }

  if (!changed) {
    return {
      changed: false,
      publishedAt,
      commitSha: runGit(["rev-parse", "HEAD"], { cwd: checkoutDir }),
    };
  }

  const summary = snapshot?.sync?.snapshotGeneratedAt ?? publishedAt;
  runGit(
    [
      "commit",
      "-m",
      `chore(autopilot-state): refresh opensquad snapshot at ${summary}`,
    ],
    { cwd: checkoutDir },
  );
  runGit(["push", "origin", `HEAD:${remoteBranch}`], { cwd: checkoutDir });

  return {
    changed: true,
    publishedAt,
    commitSha: runGit(["rev-parse", "HEAD"], { cwd: checkoutDir }),
  };
}

async function writeHealth(payload) {
  if (!healthFile) return;
  await writeJson(path.resolve(healthFile), payload);
}

async function syncOnce() {
  const startedAt = new Date().toISOString();
  try {
    const snapshot = await fetchSnapshot();
    const commitResult = await commitSnapshot(snapshot);
    const summary = {
      ok: true,
      startedAt,
      generatedAt: snapshot?.sync?.snapshotGeneratedAt ?? null,
      publishedAt: commitResult.publishedAt,
      changed: commitResult.changed,
      commitSha: commitResult.commitSha,
      sourceUrl,
      checkoutDir,
      branch: remoteBranch,
      snapshotPath,
      delegations: Array.isArray(snapshot.delegations) ? snapshot.delegations.length : 0,
      wsType: snapshot.type,
    };
    await writeHealth(summary);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } catch (error) {
    const summary = {
      ok: false,
      startedAt,
      failedAt: new Date().toISOString(),
      sourceUrl,
      checkoutDir,
      branch: remoteBranch,
      snapshotPath,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    };
    await writeHealth(summary);
    process.stderr.write(`${JSON.stringify(summary)}\n`);
    if (runOnce) {
      throw error;
    }
  }
}

async function main() {
  if (runOnce) {
    await syncOnce();
    return;
  }

  while (true) {
    await syncOnce();
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  process.exit(1);
});
