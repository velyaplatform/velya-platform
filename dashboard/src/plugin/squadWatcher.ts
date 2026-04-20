import type { Plugin, ViteDevServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import fsp from "node:fs/promises";
import { watch as chokidarWatch } from "chokidar";
import path from "node:path";
import type { WsMessage } from "../types/state";
import {
  coordinationTargetExists,
  coordinationWatchTargets,
  looksLikeCoordinationFile,
} from "./coordinationLoader";
import { buildDelegationsUpdate, buildSnapshot, isValidState, resolveSquadsDir } from "../runtime/snapshot";

function broadcast(wss: WebSocketServer, msg: WsMessage) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch {
        // Client connection dying — ws library will clean it up
      }
    }
  }
}

export function squadWatcherPlugin(): Plugin {
  return {
    name: "squad-watcher",
    configureServer(server: ViteDevServer) {
      if (!server.httpServer) {
        server.config.logger.warn("[squad-watcher] no httpServer — skipping");
        return;
      }

      const squadsDir = resolveSquadsDir();
      server.config.logger.info(`[squad-watcher] squads dir: ${squadsDir}`);

      // Create WebSocket server with noServer to avoid intercepting Vite's HMR
      const wss = new WebSocketServer({ noServer: true });
      (server.httpServer as Server).on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (req.url === "/__squads_ws") {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }
        // Let Vite handle all other upgrade requests (HMR)
      });

      // Send snapshot on new connection
      wss.on("connection", async (ws) => {
        try {
          const snap = await buildSnapshot(squadsDir);
          ws.send(JSON.stringify(snap));
        } catch {
          // Connection may have closed before snapshot was ready
        }
      });

      // Ensure squads directory exists
      fsp.mkdir(squadsDir, { recursive: true }).catch((err) => {
        server.config.logger.error(`[squad-watcher] failed to create squads dir: ${err.message}`);
      });

      // REST API fallback — serves snapshot over HTTP for polling clients
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/api/snapshot") return next();
        try {
          const snapshot = await buildSnapshot(squadsDir);
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-cache");
          res.end(JSON.stringify(snapshot));
        } catch {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      });

      // File watcher using chokidar — reliable cross-platform, handles partial writes
      const watcher = chokidarWatch(squadsDir, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
        ignored: [/(^|[/\\])\./, /node_modules/, /output[/\\]/],
        depth: 2,
      });

      function handleFileChange(filePath: string) {
        const relative = path.relative(squadsDir, filePath).replace(/\\/g, "/");
        const parts = relative.split("/");
        if (parts.length < 2) return;

        const squadName = parts[0];
        const fileName = parts[1];

        if (fileName === "state.json") {
          fsp.readFile(filePath, "utf-8").then((raw) => {
            const parsed = JSON.parse(raw);
            if (!isValidState(parsed)) return;
            broadcast(wss, { type: "SQUAD_UPDATE", squad: squadName, state: parsed });
          }).catch(() => {
            // Invalid JSON — next change event will retry
          });
        } else if (fileName === "squad.yaml") {
          buildSnapshot(squadsDir).then((snap) => broadcast(wss, snap));
        }
      }

      function handleFileRemoval(filePath: string) {
        const relative = path.relative(squadsDir, filePath).replace(/\\/g, "/");
        const parts = relative.split("/");
        if (parts.length < 2) return;

        const squadName = parts[0];
        const fileName = parts[1];

        if (fileName === "state.json") {
          broadcast(wss, { type: "SQUAD_INACTIVE", squad: squadName });
        } else if (fileName === "squad.yaml") {
          buildSnapshot(squadsDir).then((snap) => broadcast(wss, snap));
        }
      }

      watcher.on("add", handleFileChange);
      watcher.on("change", handleFileChange);
      watcher.on("unlink", handleFileRemoval);

      // Watcher dedicado do ledger de delegações
      const projectRoot = path.dirname(squadsDir);
      const ledgerPath = path.join(projectRoot, ".claude", "ledger", "delegations.jsonl");
      const ledgerWatcher = chokidarWatch(ledgerPath, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      });
      const broadcastDelegations = async () => {
        const update = await buildDelegationsUpdate(squadsDir);
        broadcast(wss, update);
      };
      ledgerWatcher.on("add", broadcastDelegations);
      ledgerWatcher.on("change", broadcastDelegations);

      const coordinationTargets = coordinationWatchTargets(projectRoot);
      const coordinationWatcher = chokidarWatch(coordinationTargets, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
        depth: 4,
      });
      const broadcastCoordination = async (filePath?: string) => {
        if (filePath && !looksLikeCoordinationFile(filePath) && coordinationTargetExists(filePath)) {
          return;
        }
        const snap = await buildSnapshot(squadsDir);
        broadcast(wss, snap);
      };
      coordinationWatcher.on("add", broadcastCoordination);
      coordinationWatcher.on("change", broadcastCoordination);
      coordinationWatcher.on("unlink", broadcastCoordination);

      // Watcher em .claude/agents/ — detecta agents novos
      const agentsDir = path.join(projectRoot, ".claude", "agents");
      const agentsWatcher = chokidarWatch(agentsDir, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      });
      const broadcastCompany = async () => {
        const snap = await buildSnapshot(squadsDir);
        broadcast(wss, snap);
      };
      agentsWatcher.on("add", broadcastCompany);
      agentsWatcher.on("change", broadcastCompany);
      agentsWatcher.on("unlink", broadcastCompany);

      server.httpServer.on("close", () => {
        watcher.close();
        ledgerWatcher.close();
        coordinationWatcher.close();
        agentsWatcher.close();
      });
    },
  };
}

