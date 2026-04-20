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
const projectRoot = path.resolve(__dirname, "..");
const recoveryRoot = path.resolve(projectRoot, "..", "lincesoc-recovery");
const docsDir = path.join(projectRoot, "docs", "orchestration");
const squadsDir = path.join(projectRoot, "squads", "lincesoc-aws-migration");
const ledgerPath = path.join(projectRoot, ".claude", "ledger", "delegations.jsonl");
const statusCurrentPath = path.join(docsDir, "lincesoc-aws-migration-status-current.md");
const supportCasePath = path.join(
  docsDir,
  "aws-support-case-lincesoc-suspended-account-2026-04-14.md",
);
const artifactBuilderPath = path.join(
  recoveryRoot,
  "infra",
  "aws-migration",
  "bin",
  "build-auto-upgrade-artifact.sh",
);

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const profile = getArg("profile", "lince-migration");
const region = getArg("region", "us-east-1");
const intervalSeconds = Number.parseInt(getArg("interval", "60"), 10);
const runOnce = hasFlag("once");
const healthFile = getArg("health-file", null);

function cleanAwsEnv() {
  const env = { ...process.env };
  delete env.AWS_ACCESS_KEY_ID;
  delete env.AWS_SECRET_ACCESS_KEY;
  delete env.AWS_SESSION_TOKEN;
  delete env.AWS_PROFILE;
  delete env.AWS_DEFAULT_REGION;
  delete env.AWS_ENDPOINT_URL;
  delete env.LOCALSTACK_AUTH_TOKEN;
  env.AWS_REGION = region;
  env.AWS_DEFAULT_REGION = region;
  return env;
}

async function awsJson(commandArgs, allowErrorPatterns = []) {
  const finalArgs = ["--profile", profile, "--region", region, "--output", "json", ...commandArgs];
  try {
    const { stdout } = await execFileAsync("aws", finalArgs, {
      cwd: projectRoot,
      env: cleanAwsEnv(),
      maxBuffer: 1024 * 1024 * 8,
    });
    return JSON.parse(stdout);
  } catch (error) {
    const stderr = `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
    if (allowErrorPatterns.some((pattern) => stderr.includes(pattern))) {
      return null;
    }
    throw new Error(stderr.trim() || "aws command failed");
  }
}

async function awsText(commandArgs, allowErrorPatterns = []) {
  const finalArgs = ["--profile", profile, "--region", region, ...commandArgs];
  try {
    const { stdout } = await execFileAsync("aws", finalArgs, {
      cwd: projectRoot,
      env: cleanAwsEnv(),
      maxBuffer: 1024 * 1024 * 8,
    });
    return stdout.trim();
  } catch (error) {
    const stderr = `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
    if (allowErrorPatterns.some((pattern) => stderr.includes(pattern))) {
      return null;
    }
    throw new Error(stderr.trim() || "aws command failed");
  }
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeIfChanged(filePath, content) {
  let previous = null;
  try {
    previous = await fsp.readFile(filePath, "utf8");
  } catch {
    previous = null;
  }
  if (previous === content) return false;
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, "utf8");
  return true;
}

async function readSupportCaseMeta() {
  try {
    const raw = await fsp.readFile(supportCasePath, "utf8");
    const meta = {
      caseId: raw.match(/Case ID:\s*`?(\d+)`?/i)?.[1] ?? null,
      created: raw.match(/Created:\s*`?([^`\n]+)`?/i)?.[1] ?? null,
      openedBy: raw.match(/Opened by:\s*`?([^`\n]+)`?/i)?.[1] ?? null,
      category: raw.match(/Category:\s*`?([^`\n]+)`?/i)?.[1] ?? null,
      severity: raw.match(/Severity:\s*`?([^`\n]+)`?/i)?.[1] ?? null,
      statusAtOpening: raw.match(/Status at opening:\s*`?([^`\n]+)`?/i)?.[1] ?? null,
    };
    return meta;
  } catch {
    return {
      caseId: null,
      created: null,
      openedBy: null,
      category: null,
      severity: null,
      statusAtOpening: null,
    };
  }
}

async function probeSecret(secretId) {
  const result = await awsJson(
    ["secretsmanager", "get-secret-value", "--secret-id", secretId],
    ["ResourceNotFoundException", "Secrets Manager can't find the specified secret"],
  );
  if (!result) {
    return { exists: false, validLooking: false, placeholder: false };
  }
  const secretString = String(result.SecretString ?? "");
  const validLooking = /^(gh[pousr]_|github_pat_)/.test(secretString);
  const placeholder =
    !validLooking ||
    secretString.toLowerCase().includes("placeholder") ||
    secretString.toLowerCase().includes("changeme");
  return { exists: true, validLooking, placeholder };
}

async function probeLambda(name) {
  const result = await awsJson(
    ["lambda", "get-function-configuration", "--function-name", name],
    ["ResourceNotFoundException", "Function not found"],
  );
  if (!result) return null;
  return {
    name,
    state: result.State ?? null,
    lastUpdateStatus: result.LastUpdateStatus ?? null,
  };
}

function hasHealthyLambda(lambda) {
  return Boolean(
    lambda &&
      lambda.state === "Active" &&
      (lambda.lastUpdateStatus == null || lambda.lastUpdateStatus === "Successful"),
  );
}

function latestLedgerEntries(raw) {
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const latest = new Map();
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.id) latest.set(parsed.id, parsed);
    } catch {
      // ignore malformed lines
    }
  }
  return latest;
}

async function appendLedgerEntry(entry) {
  await fsp.mkdir(path.dirname(ledgerPath), { recursive: true });
  let current = "";
  try {
    current = await fsp.readFile(ledgerPath, "utf8");
  } catch {
    current = "";
  }
  const latest = latestLedgerEntries(current);
  const previous = latest.get(entry.id);
  if (
    previous &&
    previous.status === entry.status &&
    previous.context === entry.context &&
    previous.evidencePath === entry.evidencePath &&
    previous.blockReason === entry.blockReason
  ) {
    return false;
  }
  await fsp.appendFile(ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
  return true;
}

function agentStatusFromLedger(status) {
  switch (status) {
    case "in-progress":
      return "working";
    case "completed":
      return "done";
    case "blocked":
    case "pending":
      return "checkpoint";
    default:
      return "idle";
  }
}

function buildSquadYaml() {
  return `squad:
  code: lincesoc-aws-migration
  name: Lincesoc AWS Migration
  description: |
    Automatic operations squad that mirrors the real AWS migration state for
    Lincesoc into the orchestration dashboard, shared handoff, and specialist
    ledger.
  icon: "AWS"
  version: "1.0.0"
  language: "English"
  agents:
    - ../../.claude/agents/aws-specialist-agent.md
    - ../../.claude/agents/terragrunt-specialist-agent.md
    - ../../.claude/agents/support-sla-tracker-agent.md
    - ../../.claude/agents/github-actions-specialist-agent.md
`;
}

function buildSquadState(snapshot, nowIso) {
  const supportAgentStatus = agentStatusFromLedger(snapshot.ledger.support.status);
  const githubAgentStatus = agentStatusFromLedger(snapshot.ledger.github.status);
  const awsAgentStatus = agentStatusFromLedger(snapshot.ledger.aws.status);
  const terragruntAgentStatus = agentStatusFromLedger(snapshot.ledger.terragrunt.status);

  return {
    squad: "lincesoc-aws-migration",
    status: snapshot.squad.status,
    step: snapshot.squad.step,
    agents: [
      {
        id: "aws-specialist-agent",
        name: "AWS Specialist",
        icon: "AWS",
        status: awsAgentStatus,
        desk: { col: 1, row: 1 },
      },
      {
        id: "terragrunt-specialist-agent",
        name: "Terragrunt Specialist",
        icon: "TG",
        status: terragruntAgentStatus,
        desk: { col: 2, row: 1 },
      },
      {
        id: "support-sla-tracker-agent",
        name: "Support SLA Tracker",
        icon: "SUP",
        status: supportAgentStatus,
        desk: { col: 3, row: 1 },
      },
      {
        id: "github-actions-specialist-agent",
        name: "GitHub Runtime Gate",
        icon: "GH",
        status: githubAgentStatus,
        desk: { col: 4, row: 1 },
      },
    ],
    handoff: snapshot.squad.handoff,
    startedAt: snapshot.squad.startedAt,
    updatedAt: nowIso,
  };
}

function buildDegradedSquadState(message, nowIso) {
  return {
    squad: "lincesoc-aws-migration",
    status: "checkpoint",
    step: {
      current: 0,
      total: 5,
      label: `Sync degraded: ${message}`.slice(0, 140),
    },
    agents: [
      {
        id: "aws-specialist-agent",
        name: "AWS Specialist",
        icon: "AWS",
        status: "checkpoint",
        desk: { col: 1, row: 1 },
      },
      {
        id: "terragrunt-specialist-agent",
        name: "Terragrunt Specialist",
        icon: "TG",
        status: "checkpoint",
        desk: { col: 2, row: 1 },
      },
      {
        id: "support-sla-tracker-agent",
        name: "Support SLA Tracker",
        icon: "SUP",
        status: "checkpoint",
        desk: { col: 3, row: 1 },
      },
      {
        id: "github-actions-specialist-agent",
        name: "GitHub Runtime Gate",
        icon: "GH",
        status: "checkpoint",
        desk: { col: 4, row: 1 },
      },
    ],
    handoff: {
      from: "migration-sync",
      to: "aws-specialist-agent",
      message: `Recover lincesoc sync loop: ${message}`.slice(0, 180),
      completedAt: nowIso,
    },
    startedAt: nowIso,
    updatedAt: nowIso,
  };
}

function buildStatusMarkdown(snapshot) {
  const support = snapshot.support.caseId
    ? [
        `- Support case: \`${snapshot.support.caseId}\``,
        snapshot.support.created ? `- Support case created: \`${snapshot.support.created}\`` : null,
        snapshot.support.openedBy ? `- Support case opened by: \`${snapshot.support.openedBy}\`` : null,
        snapshot.support.category ? `- Support category: \`${snapshot.support.category}\`` : null,
        snapshot.support.severity ? `- Support severity: \`${snapshot.support.severity}\`` : null,
        snapshot.support.statusAtOpening
          ? `- Support status at opening: \`${snapshot.support.statusAtOpening}\``
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "- Support case not recorded locally";

  const resources = [];
  if (snapshot.autoUpgrade.ready) {
    resources.push(
      "- `auto-upgrade` resources present: `lince-upgrade-reviewer`, `lince-upgrade-audit`, `lince-upgrade-actions`, `lince-upgrade-actions-dlq`, `lince-upgrade-reviewer-webhook`",
    );
  }
  if (snapshot.costAutomation.ready) {
    resources.push(
      "- `cost-automation` resources present: `lince-rightsizer`, `lince-savings-coverage`, `lince-cost-killer`, `lince-business-hours-scheduler`, `lince-cost-actions-audit`, DLQs, EventBridge schedules, alarms",
    );
  }

  return `# Lincesoc AWS Migration Status (Current)

Generated: ${snapshot.generatedAt}

## Summary

- Management account: \`${snapshot.identity?.accountId ?? "unavailable"}\` (\`${snapshot.identity?.arn ?? "no identity"}\`)
- AWS profile: \`${profile}\`
- Organizations blocker: \`lince-prd\` is \`${snapshot.accounts.prdStatus ?? "unknown"}\`
- \`lince-hml\` present: \`${snapshot.accounts.hmlPresent ? "yes" : "no"}\`
- \`auto-upgrade\` converged: \`${snapshot.autoUpgrade.ready ? "yes" : "no"}\`
- \`cost-automation\` converged: \`${snapshot.costAutomation.ready ? "yes" : "no"}\`
- Main GitHub PAT valid-looking: \`${snapshot.runtime.githubPatValid ? "yes" : "no"}\`
- Upgrade reviewer PAT valid-looking: \`${snapshot.runtime.upgradeReviewerPatValid ? "yes" : "no"}\`

## Blockers

- \`organizations\` must remain blocked while \`lince-prd\` stays suspended
- \`lince-hml\` is still absent
- GitHub-driven runtime remains degraded until PAT secrets are populated with real values

## Automatic Mechanisms

- Persistent dashboard launcher:
  \`velya-platform/scripts/start-orchestration-dashboard.sh\`
- Persistent agent coordination sync launcher:
  \`velya-platform/scripts/start-agent-coordination-sync.sh\`
- Persistent migration sync launcher:
  \`velya-platform/scripts/start-lincesoc-aws-migration-sync.sh\`
- Local coordination snapshot:
  \`velya-platform/ops/state/agent-sync-status.json\`
- Sync engine:
  \`velya-platform/scripts/sync-lincesoc-aws-migration.mjs\`
- Agent coordination engine:
  \`velya-platform/scripts/sync-agent-coordination.mjs\`
- Live ledger helper:
  \`velya-platform/scripts/sync-agent-ledger.mjs\`
- Live squad state:
  \`velya-platform/squads/lincesoc-aws-migration/state.json\`
- Dashboard ingests the shared hub coordination snapshot when it exists and falls back to the local snapshot above
- Supporting services auto-heal on stale health files before being reported as healthy again

## Dashboard Snapshot

- Dashboard URL: \`http://localhost:5173/\`
- Snapshot API: \`http://localhost:5173/api/snapshot\`
- Coordination agents visible through synthetic \`coordination-snapshot\` delegations
- Current step: ${snapshot.squad.step.current}/${snapshot.squad.step.total} - ${snapshot.squad.step.label}
- Current squad status: \`${snapshot.squad.status}\`

## AWS Facts

- Management account active: \`${snapshot.accounts.mgmtActive ? "yes" : "no"}\`
- \`lince-prd\` status: \`${snapshot.accounts.prdStatus ?? "unknown"}\`
- \`lince-hml\` present: \`${snapshot.accounts.hmlPresent ? "yes" : "no"}\`
- Support API available for this account: \`${snapshot.support.apiAvailable ? "yes" : "no"}\`
- Artifact builder present: \`${snapshot.local.artifactBuilderPresent ? "yes" : "no"}\`

## Resources Present

${resources.join("\n") || "- Management-only resources not fully converged yet"}

## Support

${support}
- Support API automation status: \`${snapshot.support.apiAvailable ? "available" : "blocked by Basic Support"}\`

## Runtime Gates

- \`lince/github-pat\` valid-looking: \`${snapshot.runtime.githubPatValid ? "yes" : "no"}\`
- \`lince-upgrade-reviewer/github-pat\` valid-looking: \`${snapshot.runtime.upgradeReviewerPatValid ? "yes" : "no"}\`
- Monthly stale alarm in \`cost-automation\`: disabled by default because the previous CloudWatch design exceeded the one-week alarm evaluation limit

## Next Safe Step

1. Wait for AWS Support response on case \`${snapshot.support.caseId ?? "pending"}\`
2. Keep \`organizations\` blocked until \`lince-prd\` is reactivated and account creation is unblocked
3. Populate valid GitHub PAT secrets
4. After unblock, re-run \`live/mgmt/us-east-1/organizations\` and create \`lince-hml\`
`;
}

function buildLedgerSnapshot(snapshot) {
  const orgBlocked = snapshot.accounts.prdStatus === "SUSPENDED" || !snapshot.accounts.hmlPresent;
  return {
    aws: {
      id: "lincesoc-auto-aws-specialist",
      from: "migration-sync",
      to: "aws-specialist-agent",
      task: "Monitor AWS migration blocker and management rollout",
      context: orgBlocked
        ? `Management-only rollout is ready. Waiting for Organizations unblock; lince-prd=${snapshot.accounts.prdStatus ?? "unknown"}, lince-hml present=${snapshot.accounts.hmlPresent}.`
        : "Organizations blocker cleared; ready to resume workload-account migration path.",
      status: orgBlocked ? "in-progress" : "completed",
      evidencePath: "docs/orchestration/lincesoc-aws-migration-status-current.md",
    },
    terragrunt: {
      id: "lincesoc-auto-terragrunt-specialist",
      from: "migration-sync",
      to: "terragrunt-specialist-agent",
      task: "Track Terragrunt convergence of management-only stacks",
      context:
        snapshot.autoUpgrade.ready && snapshot.costAutomation.ready
          ? "auto-upgrade and cost-automation converged; organizations still intentionally blocked."
          : "Management-only Terragrunt rollout still not fully converged.",
      status:
        snapshot.autoUpgrade.ready && snapshot.costAutomation.ready
          ? "completed"
          : "in-progress",
      evidencePath: "docs/orchestration/lincesoc-aws-migration-status-current.md",
    },
    support: {
      id: "lincesoc-auto-support-sla",
      from: "migration-sync",
      to: "support-sla-tracker-agent",
      task: "Track AWS Support case for account reinstatement",
      context: snapshot.support.caseId
        ? `Support case ${snapshot.support.caseId} is open; waiting for AWS response to reactivate 706922781464 and unblock org account creation.`
        : "No support case recorded locally yet for the suspended member account.",
      status: snapshot.support.caseId ? "in-progress" : "blocked",
      evidencePath: "docs/orchestration/aws-support-case-lincesoc-suspended-account-2026-04-14.md",
      blockReason: snapshot.support.caseId
        ? undefined
        : "Support case not found in the local support case draft file.",
    },
    github: {
      id: "lincesoc-auto-github-runtime",
      from: "migration-sync",
      to: "github-actions-specialist-agent",
      task: "Track GitHub runtime gates for applied automation",
      context:
        snapshot.runtime.githubPatValid && snapshot.runtime.upgradeReviewerPatValid
          ? "GitHub PAT secrets look valid for runtime paths."
          : "Applied automation remains runtime-gated by missing or placeholder GitHub PAT secrets.",
      status:
        snapshot.runtime.githubPatValid && snapshot.runtime.upgradeReviewerPatValid
          ? "completed"
          : "blocked",
      evidencePath: "docs/orchestration/lincesoc-aws-migration-status-current.md",
      blockReason:
        snapshot.runtime.githubPatValid && snapshot.runtime.upgradeReviewerPatValid
          ? undefined
          : "GitHub PAT secrets are missing or still look like placeholders.",
    },
  };
}

async function gatherSnapshot() {
  const generatedAt = new Date().toISOString();
  let identity = null;
  let identityError = null;

  try {
    const rawIdentity = await awsJson(["sts", "get-caller-identity"]);
    identity = {
      accountId: rawIdentity.Account ?? null,
      arn: rawIdentity.Arn ?? null,
      userId: rawIdentity.UserId ?? null,
    };
  } catch (error) {
    identityError = error.message;
  }

  const accounts = { mgmtActive: false, prdStatus: null, hmlPresent: false };
  if (identity) {
    const listAccounts = await awsJson(["organizations", "list-accounts"], [
      "AWSOrganizationsNotInUseException",
    ]);
    const allAccounts = listAccounts?.Accounts ?? [];
    const mgmt = allAccounts.find((account) => account.Id === "582381607124");
    const prd = allAccounts.find((account) => account.Id === "706922781464");
    const hml = allAccounts.find(
      (account) => account.Name === "lince-hml" || account.Email?.includes("hml"),
    );
    accounts.mgmtActive = mgmt?.Status === "ACTIVE";
    accounts.prdStatus = prd?.Status ?? null;
    accounts.hmlPresent = Boolean(hml);
  }

  const [
    upgradeReviewer,
    rightsizer,
    savingsCoverage,
    costKiller,
    businessHoursScheduler,
    githubPat,
    upgradeReviewerPat,
    support,
  ] = await Promise.all([
    identity ? probeLambda("lince-upgrade-reviewer") : Promise.resolve(null),
    identity ? probeLambda("lince-rightsizer") : Promise.resolve(null),
    identity ? probeLambda("lince-savings-coverage") : Promise.resolve(null),
    identity ? probeLambda("lince-cost-killer") : Promise.resolve(null),
    identity ? probeLambda("lince-business-hours-scheduler") : Promise.resolve(null),
    identity ? probeSecret("lince/github-pat") : Promise.resolve({ exists: false, validLooking: false }),
    identity
      ? probeSecret("lince-upgrade-reviewer/github-pat")
      : Promise.resolve({ exists: false, validLooking: false }),
    readSupportCaseMeta(),
  ]);

  const autoUpgradeReady = hasHealthyLambda(upgradeReviewer);
  const costAutomationReady =
    hasHealthyLambda(rightsizer) &&
    hasHealthyLambda(savingsCoverage) &&
    hasHealthyLambda(costKiller) &&
    hasHealthyLambda(businessHoursScheduler);

  const githubPatValid = githubPat.exists && githubPat.validLooking && !githubPat.placeholder;
  const upgradeReviewerPatValid =
    upgradeReviewerPat.exists &&
    upgradeReviewerPat.validLooking &&
    !upgradeReviewerPat.placeholder;

  const supportApiAvailable = false;

  let squadStatus = "running";
  let stepCurrent = 0;
  let stepLabel = "Recover management credentials";

  if (!identity) {
    squadStatus = "checkpoint";
    stepCurrent = 0;
    stepLabel = identityError ?? "Recover management credentials";
  } else if (!autoUpgradeReady || !costAutomationReady) {
    squadStatus = "running";
    stepCurrent = 2;
    stepLabel = "Converge management-only stacks";
  } else if (accounts.prdStatus === "SUSPENDED" || !accounts.hmlPresent) {
    squadStatus = "checkpoint";
    stepCurrent = support.caseId ? 3 : 2;
    stepLabel = support.caseId
      ? `Waiting for AWS Support case ${support.caseId}`
      : "Open AWS Support case for suspended account";
  } else if (!githubPatValid || !upgradeReviewerPatValid) {
    squadStatus = "checkpoint";
    stepCurrent = 4;
    stepLabel = "Populate GitHub PAT secrets";
  } else {
    squadStatus = "completed";
    stepCurrent = 5;
    stepLabel = "Ready to resume organizations apply";
  }

  const snapshot = {
    generatedAt,
    identity,
    identityError,
    accounts,
    support: {
      ...support,
      apiAvailable: supportApiAvailable,
    },
    autoUpgrade: {
      ready: autoUpgradeReady,
      lambda: upgradeReviewer,
    },
    costAutomation: {
      ready: costAutomationReady,
      lambdas: {
        rightsizer,
        savingsCoverage,
        costKiller,
        businessHoursScheduler,
      },
    },
    runtime: {
      githubPatValid,
      upgradeReviewerPatValid,
    },
    local: {
      artifactBuilderPresent: fs.existsSync(artifactBuilderPath),
    },
    squad: {
      status: squadStatus,
      step: {
        current: stepCurrent,
        total: 5,
        label: stepLabel,
      },
      handoff:
        accounts.prdStatus === "SUSPENDED" || !accounts.hmlPresent
          ? {
              from: "aws-specialist-agent",
              to: "support-sla-tracker-agent",
              message: support.caseId
                ? `Await AWS response on case ${support.caseId}`
                : "Open AWS Support case for suspended account",
              completedAt: generatedAt,
            }
          : !githubPatValid || !upgradeReviewerPatValid
            ? {
                from: "terragrunt-specialist-agent",
                to: "github-actions-specialist-agent",
                message: "Populate GitHub PAT secrets to remove runtime gates",
                completedAt: generatedAt,
              }
            : null,
      startedAt: generatedAt,
    },
  };

  snapshot.ledger = buildLedgerSnapshot(snapshot);
  return snapshot;
}

async function syncOnce() {
  const snapshot = await gatherSnapshot();
  const now = snapshot.generatedAt;
  const datedStatusPath = path.join(
    docsDir,
    `lincesoc-aws-migration-status-${now.slice(0, 10)}.md`,
  );

  await writeIfChanged(path.join(squadsDir, "squad.yaml"), buildSquadYaml());
  await writeIfChanged(
    path.join(squadsDir, "state.json"),
    `${JSON.stringify(buildSquadState(snapshot, now), null, 2)}\n`,
  );

  const markdown = buildStatusMarkdown(snapshot);
  await writeIfChanged(statusCurrentPath, markdown);
  await writeIfChanged(datedStatusPath, markdown);

  await appendLedgerEntry({
    ...snapshot.ledger.aws,
    ts: now,
  });
  await appendLedgerEntry({
    ...snapshot.ledger.terragrunt,
    ts: now,
  });
  await appendLedgerEntry({
    ...snapshot.ledger.support,
    ts: now,
  });
  await appendLedgerEntry({
    ...snapshot.ledger.github,
    ts: now,
  });

  const summary = {
    generatedAt: now,
    squadStatus: snapshot.squad.status,
    step: snapshot.squad.step.label,
    supportCase: snapshot.support.caseId,
    prdStatus: snapshot.accounts.prdStatus,
    hmlPresent: snapshot.accounts.hmlPresent,
  };
  if (healthFile) {
    await writeIfChanged(path.resolve(healthFile), `${JSON.stringify(summary, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

async function writeDegradedState(message) {
  const now = new Date().toISOString();
  await writeIfChanged(path.join(squadsDir, "squad.yaml"), buildSquadYaml());
  await writeIfChanged(
    path.join(squadsDir, "state.json"),
    `${JSON.stringify(buildDegradedSquadState(message, now), null, 2)}\n`,
  );
  const degradedMarkdown = `# Lincesoc AWS Migration Status (Current)

Generated: ${now}

## Sync Health

- State: \`degraded\`
- Error: ${message}
- Next step: restart the lincesoc migration sync loop and revalidate AWS connectivity
`;
  await writeIfChanged(statusCurrentPath, degradedMarkdown);
  const summary = {
    generatedAt: now,
    squadStatus: "checkpoint",
    step: `Sync degraded: ${message}`.slice(0, 140),
    error: message,
  };
  if (healthFile) {
    await writeIfChanged(path.resolve(healthFile), `${JSON.stringify(summary, null, 2)}\n`);
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
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[lincesoc-sync] ${message}\n`);
      await writeDegradedState(message);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
