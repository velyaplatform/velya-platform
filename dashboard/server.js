import { createServer } from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");

const config = {
  host: process.env.HOST ?? process.env.VELYA_DASHBOARD_HOST ?? "0.0.0.0",
  port: Number.parseInt(
    process.env.PORT ?? process.env.VELYA_DASHBOARD_PORT ?? "3000",
    10,
  ),
  snapshotMode: process.env.OPENSQUAD_SNAPSHOT_MODE ?? "github",
  snapshotFile:
    process.env.OPENSQUAD_SNAPSHOT_FILE ??
    path.join(__dirname, "state", "opensquad", "dashboard-snapshot.json"),
  githubOwner: process.env.OPENSQUAD_GITHUB_OWNER ?? "velyaplatform",
  githubRepo: process.env.OPENSQUAD_GITHUB_REPO ?? "velya-platform",
  githubBranch: process.env.OPENSQUAD_GITHUB_BRANCH ?? "autopilot-state",
  githubPath:
    process.env.OPENSQUAD_GITHUB_PATH ??
    "state/opensquad/dashboard-snapshot.json",
  githubToken:
    process.env.GH_TOKEN ??
    process.env.GITHUB_TOKEN ??
    process.env.OPENSQUAD_GITHUB_TOKEN ??
    "",
  pollMs: Number.parseInt(
    process.env.OPENSQUAD_SNAPSHOT_POLL_MS ?? "10000",
    10,
  ),
  staleAfterMs: Number.parseInt(
    process.env.OPENSQUAD_SNAPSHOT_STALE_AFTER_MS ?? "180000",
    10,
  ),
};

const state = {
  snapshot: null,
  snapshotSerialized: "",
  source: null,
  revision: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  refreshTotal: 0,
  refreshErrors: 0,
  githubEtag: null,
  broadcastsTotal: 0,
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function log(message, extra = "") {
  const suffix = extra ? ` ${extra}` : "";
  process.stdout.write(`[opensquad-dashboard] ${message}${suffix}\n`);
}

function isSnapshotMessage(value) {
  return (
    value &&
    typeof value === "object" &&
    value.type === "SNAPSHOT" &&
    Array.isArray(value.squads) &&
    value.activeStates &&
    typeof value.activeStates === "object"
  );
}

function snapshotGeneratedAt(snapshot) {
  return snapshot?.sync?.snapshotGeneratedAt ?? null;
}

function snapshotAgeMs(snapshot) {
  const generatedAt = snapshotGeneratedAt(snapshot);
  if (!generatedAt) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(generatedAt);
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - parsed);
}

function healthSnapshot() {
  const ageMs = snapshotAgeMs(state.snapshot);
  const hasSnapshot = !!state.snapshot;
  const stale = hasSnapshot ? ageMs > config.staleAfterMs : true;

  return {
    ok: hasSnapshot && !stale,
    status: !hasSnapshot ? "missing" : stale ? "stale" : state.lastError ? "degraded" : "ok",
    ageMs: Number.isFinite(ageMs) ? ageMs : null,
    snapshotGeneratedAt: snapshotGeneratedAt(state.snapshot),
    source: state.source,
    revision: state.revision,
    lastAttemptAt: state.lastAttemptAt,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.lastError,
    refreshTotal: state.refreshTotal,
    refreshErrors: state.refreshErrors,
    wsClients: wss.clients.size,
    pollMs: config.pollMs,
    staleAfterMs: config.staleAfterMs,
    mode: config.snapshotMode,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function sendText(res, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });
  res.end(payload);
}

async function readFileSource() {
  const stat = await fsp.stat(config.snapshotFile);
  const text = await fsp.readFile(config.snapshotFile, "utf8");
  return {
    text,
    revision: `file:${stat.mtimeMs}:${stat.size}`,
    source: config.snapshotFile,
  };
}

function encodeGitHubPath(filePath) {
  return filePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function readGitHubSource() {
  const url =
    `https://api.github.com/repos/${encodeURIComponent(config.githubOwner)}` +
    `/${encodeURIComponent(config.githubRepo)}/contents/${encodeGitHubPath(config.githubPath)}` +
    `?ref=${encodeURIComponent(config.githubBranch)}`;

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "opensquad-dashboard/1.0",
  };
  if (config.githubToken) {
    headers.Authorization = `Bearer ${config.githubToken}`;
  }
  if (state.githubEtag) {
    headers["If-None-Match"] = state.githubEtag;
  }

  const response = await fetch(url, { headers });
  if (response.status === 304) {
    return { notModified: true };
  }
  if (!response.ok) {
    throw new Error(`GitHub snapshot fetch failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const content =
    payload.encoding === "base64"
      ? Buffer.from(String(payload.content ?? "").replace(/\n/g, ""), "base64").toString("utf8")
      : String(payload.content ?? "");

  return {
    text: content,
    revision: payload.sha ?? response.headers.get("etag") ?? new Date().toISOString(),
    source: url,
    etag: response.headers.get("etag"),
  };
}

async function loadSnapshotSource() {
  if (config.snapshotMode === "file") {
    return readFileSource();
  }
  if (config.snapshotMode === "github") {
    return readGitHubSource();
  }
  throw new Error(
    `Unsupported OPENSQUAD_SNAPSHOT_MODE=${config.snapshotMode}. Use "github" or "file".`,
  );
}

function broadcastSnapshot(snapshot) {
  const data = JSON.stringify(snapshot);
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    try {
      client.send(data);
    } catch {
      // ws will clean broken connections.
    }
  }
  state.broadcastsTotal += 1;
}

async function refreshSnapshot(reason = "poll") {
  state.lastAttemptAt = new Date().toISOString();
  state.refreshTotal += 1;

  try {
    const loaded = await loadSnapshotSource();
    if (loaded?.notModified) {
      state.lastError = null;
      return false;
    }

    const parsed = JSON.parse(loaded.text);
    if (!isSnapshotMessage(parsed)) {
      throw new Error("Snapshot payload does not match the expected WsMessage shape.");
    }

    const serialized = JSON.stringify(parsed);
    const changed = serialized !== state.snapshotSerialized;

    state.snapshot = parsed;
    state.snapshotSerialized = serialized;
    state.source = loaded.source;
    state.revision = loaded.revision;
    state.lastSuccessAt = new Date().toISOString();
    state.lastError = null;
    if (loaded.etag) {
      state.githubEtag = loaded.etag;
    }

    if (changed) {
      log(`snapshot refreshed (${reason})`, `revision=${String(state.revision)}`);
      broadcastSnapshot(parsed);
    }

    return changed;
  } catch (error) {
    state.refreshErrors += 1;
    state.lastError =
      error instanceof Error ? error.stack ?? error.message : String(error);
    log(`snapshot refresh failed (${reason})`, state.lastError);
    return false;
  }
}

function metricLine(name, value, labels = null) {
  const labelText = labels
    ? `{${Object.entries(labels)
        .map(([key, entry]) => `${key}="${String(entry).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
        .join(",")}}`
    : "";
  return `${name}${labelText} ${value}`;
}

function buildMetrics() {
  const health = healthSnapshot();
  const ageSeconds =
    health.ageMs == null ? -1 : Math.round((health.ageMs / 1000) * 1000) / 1000;
  const lastSuccessUnix = health.lastSuccessAt
    ? Math.floor(Date.parse(health.lastSuccessAt) / 1000)
    : 0;

  return [
    "# HELP opensquad_dashboard_up Whether the dashboard has a fresh snapshot loaded.",
    "# TYPE opensquad_dashboard_up gauge",
    metricLine("opensquad_dashboard_up", health.ok ? 1 : 0),
    "# HELP opensquad_dashboard_snapshot_age_seconds Age of the currently loaded snapshot.",
    "# TYPE opensquad_dashboard_snapshot_age_seconds gauge",
    metricLine("opensquad_dashboard_snapshot_age_seconds", ageSeconds),
    "# HELP opensquad_dashboard_snapshot_refresh_total Total snapshot refresh attempts.",
    "# TYPE opensquad_dashboard_snapshot_refresh_total counter",
    metricLine("opensquad_dashboard_snapshot_refresh_total", state.refreshTotal),
    "# HELP opensquad_dashboard_snapshot_refresh_errors_total Total failed snapshot refresh attempts.",
    "# TYPE opensquad_dashboard_snapshot_refresh_errors_total counter",
    metricLine("opensquad_dashboard_snapshot_refresh_errors_total", state.refreshErrors),
    "# HELP opensquad_dashboard_snapshot_last_success_unixtime Unix timestamp of the last successful refresh.",
    "# TYPE opensquad_dashboard_snapshot_last_success_unixtime gauge",
    metricLine("opensquad_dashboard_snapshot_last_success_unixtime", lastSuccessUnix),
    "# HELP opensquad_dashboard_ws_clients Active dashboard websocket clients.",
    "# TYPE opensquad_dashboard_ws_clients gauge",
    metricLine("opensquad_dashboard_ws_clients", wss.clients.size),
    "# HELP opensquad_dashboard_snapshot_source_info Static info about the snapshot source.",
    "# TYPE opensquad_dashboard_snapshot_source_info gauge",
    metricLine("opensquad_dashboard_snapshot_source_info", 1, {
      mode: config.snapshotMode,
      branch: config.githubBranch,
      path: config.githubPath,
    }),
    "",
  ].join("\n");
}

function sanitizeRelativePath(requestPath) {
  const cleaned = requestPath.split("?")[0].split("#")[0];
  const decoded = decodeURIComponent(cleaned);
  const normalized = path.posix.normalize(decoded);
  if (normalized.startsWith("../")) return null;
  return normalized;
}

async function serveStatic(requestPath, res) {
  const relativePath = sanitizeRelativePath(requestPath);
  if (relativePath == null) {
    sendText(res, 400, "Bad Request");
    return;
  }

  const desiredPath =
    relativePath === "/" ? "/index.html" : relativePath;
  const candidate = path.join(distDir, desiredPath);
  const safePath = path.resolve(candidate);
  if (!safePath.startsWith(path.resolve(distDir))) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let filePath = safePath;
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    filePath = path.join(distDir, "index.html");
  }

  try {
    await fsp.access(filePath, fs.constants.R_OK);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Cache-Control": filePath.endsWith("index.html")
        ? "no-store"
        : "public, max-age=31536000, immutable",
      "Content-Type": mimeTypes[ext] ?? "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    sendText(res, 404, "Not Found");
  }
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method Not Allowed");
    return;
  }

  if (url.startsWith("/api/snapshot")) {
    if (!state.snapshot) {
      await refreshSnapshot("http");
    }
    if (!state.snapshot) {
      sendJson(res, 503, { ok: false, error: state.lastError ?? "No snapshot loaded" });
      return;
    }
    sendJson(res, 200, state.snapshot);
    return;
  }

  if (url.startsWith("/api/health")) {
    const health = healthSnapshot();
    sendJson(res, health.ok ? 200 : 503, health);
    return;
  }

  if (url.startsWith("/metrics")) {
    sendText(res, 200, buildMetrics(), "text/plain; version=0.0.4; charset=utf-8");
    return;
  }

  await serveStatic(url, res);
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/__squads_ws") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async (ws) => {
  if (!state.snapshot) {
    await refreshSnapshot("ws-connect");
  }

  if (state.snapshot && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(state.snapshot));
  }
});

await refreshSnapshot("startup");
setInterval(() => {
  void refreshSnapshot("poll");
}, config.pollMs).unref();

server.listen(config.port, config.host, () => {
  log(
    `listening on http://${config.host}:${config.port}`,
    `mode=${config.snapshotMode}`,
  );
});
