#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const lincesocRoot = path.resolve(repoRoot, "..", "lincesoc");
const squadCode = "lincesoc-platform-ops";
const squadDir = path.join(repoRoot, "squads", squadCode);
const statePath = path.join(squadDir, "state.json");
const statusDocPath = path.join(
  repoRoot,
  "docs",
  "orchestration",
  "lincesoc-platform-ops-status-current.md",
);
const coordinationSnapshotPath = path.join(repoRoot, "ops", "state", "agent-sync-status.json");

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
const healthFile = getArg("health-file", null);
const kubeContext = getArg("context", process.env.LINCE_KUBE_CONTEXT ?? "k3d-linceplatform-local");
const demoUserEmail = getArg("demo-user", "analista.demo@linceplatform.local");
const demoUserPassword = getArg("demo-password", process.env.LINCE_DEMO_PASSWORD ?? "LinceDemo!2026Admin");
const platformBaseUrl = getArg("platform-url", process.env.LINCE_PLATFORM_URL ?? "http://linceplatform.localtest.me");
const grafanaBaseUrl = getArg("grafana-url", process.env.LINCE_GRAFANA_URL ?? "http://grafana.linceplatform.localtest.me");
const prometheusBaseUrl = getArg("prometheus-url", process.env.LINCE_PROMETHEUS_URL ?? "http://prometheus.linceplatform.localtest.me");

const VENDOR_PATTERN =
  "\\b(OpusTech|Opus|FortiGate|Acronis|CloudStack|Gemini|OpenAI|Brevo|Slack|Telegram)\\b|outlook\\.office\\.com|hooks\\.slack\\.com|teams-webhook|alertmanager-teams|smtp-brevo";

function nowIso() {
  return new Date().toISOString();
}

async function writeJsonFile(filePath, data) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function writeTextFile(filePath, content) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, "utf8");
}

async function readJson(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function runCommand(command, commandArgs, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      cwd: options.cwd ?? repoRoot,
      maxBuffer: 1024 * 1024 * 8,
      env: options.env ?? process.env,
    });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? "").trim(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchText(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(init.timeoutMs ?? 10000),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { ok: response.ok, status: response.status, text, json };
}

async function checkVendorCutover() {
  const result = await runCommand(
    "rg",
    [
      "-n",
      "-i",
      "--pcre2",
      "--glob",
      "!**/.git/**",
      "--glob",
      "!**/node_modules/**",
      VENDOR_PATTERN,
      lincesocRoot,
    ],
    { cwd: lincesocRoot },
  );

  if (!result.ok && !result.stdout && !result.stderr) {
    return { ready: true, detail: "sem referências legadas detectadas" };
  }
  if (!result.ok && /exit code 1/i.test(result.error ?? "")) {
    return { ready: true, detail: "sem referências legadas detectadas" };
  }
  return {
    ready: false,
    detail: result.stdout.split("\n").slice(0, 3).join(" | ") || result.stderr || "resíduos encontrados",
  };
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkFrontendCutover() {
  const requiredFiles = [
    path.join(lincesocRoot, "apps/web/src/pages/ProtectionAgentsPage.jsx"),
    path.join(lincesocRoot, "apps/web/src/pages/InfrastructurePage.jsx"),
    path.join(lincesocRoot, "apps/web/src/pages/EdgeFirewallPage.jsx"),
  ];
  const exists = await Promise.all(requiredFiles.map((filePath) => fileExists(filePath)));
  return {
    ready: exists.every(Boolean),
    detail: exists.every(Boolean)
      ? "páginas locais/opensource publicadas no frontend"
      : "páginas substitutas ainda ausentes",
  };
}

async function checkBackendCutover() {
  const requiredFiles = [
    path.join(lincesocRoot, "apps/api/src/lib/platform-inspector.ts"),
    path.join(lincesocRoot, "apps/api/src/routes/platform.ts"),
    path.join(lincesocRoot, "apps/api/src/routes/internal-webhooks.ts"),
  ];
  const exists = await Promise.all(requiredFiles.map((filePath) => fileExists(filePath)));
  const manifests = await Promise.all([
    fsp.readFile(path.join(lincesocRoot, "infra/argocd/notifications.yaml"), "utf8"),
    fsp.readFile(
      path.join(lincesocRoot, "infra/kubernetes/observability/alertmanager-config.yaml"),
      "utf8",
    ),
  ]);
  const webhookReady =
    manifests[0].includes("/api/internal/webhooks/argocd/deploys") &&
    manifests[1].includes("/api/internal/webhooks/alertmanager/critical");
  return {
    ready: exists.every(Boolean) && webhookReady,
    detail:
      exists.every(Boolean) && webhookReady
        ? "rotas locais + webhooks internos habilitados"
        : "backend/manifests ainda não alinhados",
  };
}

async function checkRepoActivity() {
  const result = await runCommand("git", ["-C", lincesocRoot, "status", "--porcelain"]);
  const modified = result.ok ? result.stdout.split("\n").filter(Boolean) : [];
  return {
    dirty: modified.length > 0,
    modifiedCount: modified.length,
    detail: modified.length > 0 ? `${modified.length} arquivo(s) modificados` : "árvore limpa",
  };
}

async function kubectlJson(argsList) {
  const result = await runCommand("kubectl", ["--context", kubeContext, ...argsList]);
  if (!result.ok) {
    throw new Error(result.stderr || result.error || "kubectl_failed");
  }
  return JSON.parse(result.stdout);
}

async function checkClusterRuntime() {
  try {
    const pods = await kubectlJson(["-n", "linceplatform-prod", "get", "pods", "-o", "json"]);
    const items = Array.isArray(pods.items) ? pods.items : [];
    const requiredApps = ["linceplatform-api", "linceplatform-web", "linceplatform-postgres"];
    const summary = {};

    for (const app of requiredApps) {
      const appPods = items.filter((item) => item?.metadata?.labels?.app === app);
      const ready = appPods.length > 0 && appPods.every((item) => {
        const statuses = Array.isArray(item.status?.containerStatuses) ? item.status.containerStatuses : [];
        return item.status?.phase === "Running" && statuses.every((status) => status.ready === true);
      });
      summary[app] = { pods: appPods.length, ready };
    }

    const ready = requiredApps.every((app) => summary[app]?.ready);
    const detail = requiredApps
      .map((app) => `${app.replace("linceplatform-", "")}:${summary[app].ready ? "ok" : `${summary[app].pods} pod(s)`}`)
      .join(" · ");

    return { ready, detail };
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function demoUserExists() {
  try {
    const podJson = await kubectlJson([
      "-n",
      "linceplatform-prod",
      "get",
      "pods",
      "-l",
      "app=linceplatform-postgres",
      "-o",
      "json",
    ]);
    const podName = podJson.items?.[0]?.metadata?.name;
    if (!podName) {
      return { ready: false, detail: "pod do postgres não encontrado" };
    }

    const secret = await runCommand("kubectl", [
      "--context",
      kubeContext,
      "-n",
      "linceplatform-prod",
      "get",
      "secret",
      "linceplatform-postgres-secret",
      "-o",
      "jsonpath={.data.password}",
    ]);
    if (!secret.ok || !secret.stdout) {
      return { ready: false, detail: "senha do postgres indisponível" };
    }
    const password = Buffer.from(secret.stdout, "base64").toString("utf8");
    const query = `select count(*) from users where email = '${demoUserEmail.replace(/'/g, "''")}';`;
    const uri = `postgresql://linceplatform:${encodeURIComponent(password)}@localhost:5432/linceplatform`;
    const result = await runCommand("kubectl", [
      "--context",
      kubeContext,
      "-n",
      "linceplatform-prod",
      "exec",
      podName,
      "--",
      "psql",
      uri,
      "-tAc",
      query,
    ]);
    const count = Number.parseInt(result.stdout.trim(), 10);
    return {
      ready: Number.isFinite(count) && count > 0,
      detail:
        Number.isFinite(count) && count > 0
          ? `usuário demo presente (${demoUserEmail})`
          : "usuário demo ainda não semeado",
    };
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function checkFrontendProxy() {
  try {
    const health = await fetchText(`${platformBaseUrl}/api/health`);
    const login = await fetchText(`${platformBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: demoUserEmail, password: demoUserPassword }),
    });

    const healthReady = health.ok && health.json?.status === "ok";
    const loginReady = login.ok && Boolean(login.json?.token);

    return {
      ready: healthReady && loginReady,
      detail:
        healthReady && loginReady
          ? "proxy /api funcional e login validado pelo host do frontend"
          : `health=${health.status} login=${login.status}`,
    };
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function checkGrafanaHealth() {
  try {
    const response = await fetchText(`${grafanaBaseUrl}/api/health`);
    return {
      ready: response.ok && response.json?.database === "ok",
      detail:
        response.ok && response.json?.database === "ok"
          ? `grafana ${response.json?.version ?? "ok"} operacional`
          : `grafana retornou ${response.status}`,
    };
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function checkPrometheusHealth() {
  try {
    const response = await fetchText(`${prometheusBaseUrl}/-/ready`);
    return {
      ready: response.ok,
      detail: response.ok ? "prometheus pronto via ingress local" : `prometheus retornou ${response.status}`,
    };
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function checkWebMetrics() {
  try {
    const [upQuery, nginxQuery] = await Promise.all([
      fetchText(
        `${prometheusBaseUrl}/api/v1/query?query=${encodeURIComponent(
          'up{job="linceplatform-web",namespace="linceplatform-prod"}',
        )}`,
      ),
      fetchText(
        `${prometheusBaseUrl}/api/v1/query?query=${encodeURIComponent(
          'nginx_connections_active{job="linceplatform-web",namespace="linceplatform-prod"}',
        )}`,
      ),
    ]);

    const upValue = Number(upQuery.json?.data?.result?.[0]?.value?.[1] ?? 0);
    const activeConnections = Number(nginxQuery.json?.data?.result?.[0]?.value?.[1] ?? 0);

    return {
      ready: upQuery.ok && nginxQuery.ok && upValue >= 1,
      detail:
        upQuery.ok && nginxQuery.ok && upValue >= 1
          ? `prometheus ve o exporter nginx (up=${upValue}, active=${activeConnections})`
          : `web metrics indisponiveis (up=${upValue || 0})`,
    };
  } catch (error) {
    return { ready: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function checkCoordinationSnapshot() {
  const snapshot = await readJson(coordinationSnapshotPath);
  if (!snapshot?.generatedAt) {
    return { ready: false, detail: "snapshot de coordenação ausente", activeAgents: 0, reportingAgents: 0 };
  }
  const ageMs = Date.now() - Date.parse(snapshot.generatedAt);
  const stale = ageMs > 3 * 60 * 1000;
  const agents = Array.isArray(snapshot.agents) ? snapshot.agents : [];
  const activeAgents = agents.filter((agent) => agent?.status === "active" || agent?.status === "shadow").length;
  const reportingAgents = agents.filter((agent) => agent?.lastReportAt || agent?.status === "active" || agent?.status === "shadow").length;
  return {
    ready: !stale,
    detail: stale
      ? `snapshot stale (${Math.floor(ageMs / 1000)}s)`
      : `snapshot ativo com ${agents.length} agents (${reportingAgents} reportando, ${activeAgents} ativos)`,
    activeAgents,
    reportingAgents,
  };
}

function desk(col, row) {
  return { col, row };
}

function buildAgents(checks, repoActivity) {
  return [
    {
      id: "soc-detection-engineering-agent",
      name: "SOC Detection Engineering",
      icon: "SOC",
      status: checks.vendorCutover.ready ? "done" : "working",
      desk: desk(1, 1),
    },
    {
      id: "frontend-quality-agent",
      name: "Frontend Quality",
      icon: "FE",
      status: checks.frontendCutover.ready ? "done" : "working",
      desk: desk(2, 1),
    },
    {
      id: "backend-quality-agent",
      name: "Backend Quality",
      icon: "BE",
      status: checks.backendCutover.ready ? "done" : "working",
      desk: desk(3, 1),
    },
    {
      id: "infra-health-agent",
      name: "Infra Health",
      icon: "INF",
      status: checks.clusterRuntime.ready ? "done" : "checkpoint",
      desk: desk(4, 1),
    },
    {
      id: "frontend-proxy-agent",
      name: "Frontend Proxy",
      icon: "PROXY",
      status: checks.frontendProxy.ready ? "done" : "working",
      desk: desk(1, 2),
    },
    {
      id: "customer-onboarding-agent",
      name: "Demo Access",
      icon: "USER",
      status: checks.demoUser.ready ? "done" : "checkpoint",
      desk: desk(2, 2),
    },
    {
      id: "observability-agent",
      name: "Observability",
      icon: "OBS",
      status:
        checks.grafana.ready && checks.prometheus.ready && checks.webMetrics.ready
          ? "done"
          : "working",
      desk: desk(3, 2),
    },
    {
      id: "delegation-coordinator-agent",
      name: "Dashboard Sync",
      icon: "SYNC",
      status:
        checks.coordination.ready
          ? (repoActivity.dirty || (checks.coordination.activeAgents ?? 0) > 0 ? "working" : "done")
          : "checkpoint",
      desk: desk(4, 2),
    },
  ];
}

function currentStep(checks) {
  const ordered = [
    ["vendorCutover", "Remover referências legadas e dependências proprietárias"],
    ["frontendCutover", "Concluir substituições locais/opensource no frontend"],
    ["backendCutover", "Concluir inspeção local e webhooks internos no backend"],
    ["clusterRuntime", "Garantir runtime local completo no cluster"],
    ["frontendProxy", "Validar proxy /api e login via host do frontend"],
    ["demoUser", "Publicar acesso admin demo para validação operacional"],
    ["grafana", "Confirmar Grafana operacional com dashboards atualizados"],
    ["prometheus", "Confirmar Prometheus e consultas via ingress local"],
    ["webMetrics", "Expor métricas nginx do frontend para o Prometheus"],
    ["coordination", "Sincronizar o estado com o dashboard do OpenSquad"],
  ];
  const completed = ordered.filter(([key]) => checks[key].ready).length;
  const pending = ordered.find(([key]) => !checks[key].ready);
  return {
    current: completed,
    total: ordered.length,
    label: pending ? pending[1] : "Lincesoc sincronizado e pronto para iteração contínua",
  };
}

function buildHandoff(checks, repoActivity, updatedAt) {
  if (!checks.demoUser.ready) {
    return {
      from: "infra-health-agent",
      to: "customer-onboarding-agent",
      message: "Banco ou seed ainda não confirmou o usuário demo administrativo.",
      completedAt: updatedAt,
    };
  }
  if (!checks.frontendProxy.ready) {
    return {
      from: "frontend-quality-agent",
      to: "frontend-proxy-agent",
      message: "Frontend ainda não valida health e login pelo mesmo host do portal.",
      completedAt: updatedAt,
    };
  }
  if (!checks.grafana.ready || !checks.prometheus.ready || !checks.webMetrics.ready) {
    return {
      from: "infra-health-agent",
      to: "observability-agent",
      message: "Observabilidade ainda não confirmou Grafana, Prometheus e métricas nginx em conjunto.",
      completedAt: updatedAt,
    };
  }
  if (!checks.coordination.ready) {
    return {
      from: "backend-quality-agent",
      to: "delegation-coordinator-agent",
      message: "Ativar snapshot de coordenação para refletir tarefas e funções ao vivo no dashboard.",
      completedAt: updatedAt,
    };
  }
  return {
    from: "delegation-coordinator-agent",
    to: repoActivity.dirty ? "soc-detection-engineering-agent" : "customer-onboarding-agent",
    message: repoActivity.dirty
      ? "Squad em execução contínua; alterações locais já aparecem no OpenSquad via state.json."
      : "Runtime estável, acesso demo pronto e sincronização em tempo real ativa.",
    completedAt: updatedAt,
  };
}

function buildStatusDoc({ updatedAt, checks, step, repoActivity }) {
  return `# Lincesoc Platform Ops

- Updated at: \`${updatedAt}\`
- Host: \`${os.hostname()}\`
- Squad: \`${squadCode}\`
- Step: \`${step.current}/${step.total}\` — ${step.label}
- Repo activity: ${repoActivity.detail}

## Checks

- Vendor cutover: ${checks.vendorCutover.ready ? "OK" : "PENDENTE"} — ${checks.vendorCutover.detail}
- Frontend cutover: ${checks.frontendCutover.ready ? "OK" : "PENDENTE"} — ${checks.frontendCutover.detail}
- Backend cutover: ${checks.backendCutover.ready ? "OK" : "PENDENTE"} — ${checks.backendCutover.detail}
- Cluster runtime: ${checks.clusterRuntime.ready ? "OK" : "PENDENTE"} — ${checks.clusterRuntime.detail}
- Frontend proxy: ${checks.frontendProxy.ready ? "OK" : "PENDENTE"} — ${checks.frontendProxy.detail}
- Demo access: ${checks.demoUser.ready ? "OK" : "PENDENTE"} — ${checks.demoUser.detail}
- Grafana: ${checks.grafana.ready ? "OK" : "PENDENTE"} — ${checks.grafana.detail}
- Prometheus: ${checks.prometheus.ready ? "OK" : "PENDENTE"} — ${checks.prometheus.detail}
- Web metrics: ${checks.webMetrics.ready ? "OK" : "PENDENTE"} — ${checks.webMetrics.detail}
- Coordination snapshot: ${checks.coordination.ready ? "OK" : "PENDENTE"} — ${checks.coordination.detail}
`;
}

async function syncOnce() {
  const [
    vendorCutover,
    frontendCutover,
    backendCutover,
    clusterRuntime,
    frontendProxy,
    demoUser,
    grafana,
    prometheus,
    webMetrics,
    coordination,
    repoActivity,
  ] =
    await Promise.all([
      checkVendorCutover(),
      checkFrontendCutover(),
      checkBackendCutover(),
      checkClusterRuntime(),
      checkFrontendProxy(),
      demoUserExists(),
      checkGrafanaHealth(),
      checkPrometheusHealth(),
      checkWebMetrics(),
      checkCoordinationSnapshot(),
      checkRepoActivity(),
    ]);

  const checks = {
    vendorCutover,
    frontendCutover,
    backendCutover,
    clusterRuntime,
    frontendProxy,
    demoUser,
    grafana,
    prometheus,
    webMetrics,
    coordination,
  };
  const updatedAt = nowIso();
  const step = currentStep(checks);
  const previousState = await readJson(statePath);
  const startedAt = previousState?.startedAt ?? updatedAt;
  const allReady = Object.values(checks).every((entry) => entry.ready);
  const coordinationBusy = (checks.coordination.activeAgents ?? 0) > 0 || (checks.coordination.reportingAgents ?? 0) > 0;
  const status =
    allReady && !repoActivity.dirty && !coordinationBusy
      ? "completed"
      : checks.clusterRuntime.ready && checks.frontendProxy.ready && checks.demoUser.ready
        ? "running"
        : "checkpoint";

  const state = {
    squad: squadCode,
    status,
    step,
    agents: buildAgents(checks, repoActivity),
    handoff: buildHandoff(checks, repoActivity, updatedAt),
    startedAt,
    updatedAt,
  };

  await writeJsonFile(statePath, state);
  await writeTextFile(
    statusDocPath,
    buildStatusDoc({ updatedAt, checks, step, repoActivity }),
  );

  const summary = {
    generatedAt: updatedAt,
    squad: squadCode,
    status,
    step: `${step.current}/${step.total}`,
    clusterReady: checks.clusterRuntime.ready,
    frontendProxyReady: checks.frontendProxy.ready,
    demoUserReady: checks.demoUser.ready,
    grafanaReady: checks.grafana.ready,
    prometheusReady: checks.prometheus.ready,
    webMetricsReady: checks.webMetrics.ready,
    coordinationReady: checks.coordination.ready,
    coordinationActiveAgents: checks.coordination.activeAgents ?? 0,
    coordinationReportingAgents: checks.coordination.reportingAgents ?? 0,
    repoDirty: repoActivity.dirty,
  };

  if (healthFile) {
    await writeJsonFile(path.resolve(healthFile), summary);
  }

  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

async function main() {
  if (runOnce) {
    await syncOnce();
    return;
  }

  while (true) {
    try {
      await syncOnce();
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`[lincesoc-platform-ops] ${message}\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
