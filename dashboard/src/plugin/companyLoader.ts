import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import type { CompanyMapData, EngineeringAgent, Office } from "../types/company";
import { autoPersonaFor } from "./autoPersona";

const OFFICE_CATALOG: Omit<Office, "agents">[] = [
  { id: "executive", name: "Executivo", description: "Fundação e decisão final. Autoriza os checkpoints críticos da operação.", hierarchy: "executive", product: "shared", reportsTo: null },
  { id: "governance-council", name: "Conselho de Governança", description: "Arbitra conflitos de política e aplica padrões da plataforma.", hierarchy: "council", product: "shared", reportsTo: "executive" },
  { id: "red-team", name: "Time Adversarial e Descoberta de Pontos Cegos", description: "Revisão adversarial independente dos dois produtos; reporta direto ao Conselho.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "agent-factory", name: "Fábrica de Agentes e Execução", description: "Cria, valida e supervisiona o ciclo de vida dos agentes nos dois produtos.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "platform-ops", name: "Plataforma e Infraestrutura", description: "Cluster EKS, ArgoCD, GitOps e observabilidade — infraestrutura comum aos dois produtos.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "security", name: "Escritório de Segurança", description: "Identidade, segredos, política de rede e resposta a incidentes internos (não confundir com Lince SOC, que atende clientes).", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "engineering-quality", name: "Qualidade de Engenharia", description: "Backend, frontend, testes, design de API e auditoria de interface nos dois produtos.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "architecture", name: "Escritório de Arquitetura", description: "Decisões arquiteturais, modelo de domínio, plataforma de IA e observabilidade transversais.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "finops", name: "Escritório Financeiro de Operações", description: "Custo por decisão de IA, explosão de custo e revisão de gastos dos dois produtos.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "market-content", name: "Mercado e Conteúdo", description: "Inteligência de mercado e redação de produto para ambos os produtos.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "legal-compliance", name: "Jurídico e Conformidade", description: "Advocacia interna. Cobertura dupla: LGPD + ANS + CFM (Hospitalar) e LGPD + ISO 27001 + Marco Civil (SOC).", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "customer-growth", name: "Cliente e Crescimento", description: "Sucesso do cliente, onboarding, analytics e suporte — contexto por cliente, nunca cruzado entre hospitais e clientes do SOC.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "bug-watch", name: "Observatório de Gaps e Bugs", description: "Descoberta proativa de bugs e análise de gaps nos dois produtos.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "developer-experience", name: "Experiência do Desenvolvedor", description: "Documentação pública, API reference, demos e onboarding técnico dos dois produtos.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "opensquad-alas", name: "Alas Operacionais e Criativas", description: "Equipes de conteúdo, notas de release e documentação — escopo não-clínico, serve aos dois produtos.", hierarchy: "squad-ala", product: "shared", reportsTo: "governance-council" },
  { id: "tool-specialists", name: "Especialistas em Ferramentas", description: "Consultores internos, um por ferramenta da stack. Não pertencem a produto — apoiam qualquer escritório que precise.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },
  { id: "continuous-learning", name: "Aprendizado Contínuo e Manutenção", description: "Meta-agents que mantêm os outros agents atualizados: pesquisa web, dependências, propagação de aprendizados, base de conhecimento organizacional.", hierarchy: "office", product: "shared", reportsTo: "governance-council" },

  // ── Exclusivos de Velya Hospitalar ──
  { id: "clinical-safety", name: "Segurança Clínica (Velya Hospitalar)", description: "Portão clínico obrigatório para qualquer agente que toque FHIR ou dados de saúde.", hierarchy: "office", product: "hospitalar", reportsTo: "governance-council" },
  { id: "hospital-ops", name: "Operações Hospitalares (Velya Hospitalar)", description: "Fluxo assistencial: agendamento, alta, farmácia, telemedicina, revisão de prontuário.", hierarchy: "office", product: "hospitalar", reportsTo: "governance-council" },
  { id: "hospital-rcm", name: "Ciclo de Receita (Velya Hospitalar)", description: "Faturamento TUSS, pré-autorização, gestão de glosa e recursos.", hierarchy: "office", product: "hospitalar", reportsTo: "governance-council" },
  { id: "hospital-clinical-intel", name: "Inteligência Clínica (Velya Hospitalar)", description: "Laboratório, imagem (DICOM), revisão de prontuário, sumários.", hierarchy: "office", product: "hospitalar", reportsTo: "governance-council" },

  // ── Exclusivos de Lince SOC ──
  { id: "soc-operations", name: "Operações do SOC (Lince)", description: "SIEM, ingestão de logs, triagem de alertas, engenharia de detecção.", hierarchy: "office", product: "lince", reportsTo: "governance-council" },
  { id: "soc-threat-intel", name: "Inteligência de Ameaças (Lince)", description: "CTI, IOCs, caça a ameaças, monitoramento de deep/dark web.", hierarchy: "office", product: "lince", reportsTo: "governance-council" },
  { id: "soc-incident-response", name: "Resposta a Incidentes (Lince)", description: "SOAR, forense digital, análise de phishing/malware, playbooks.", hierarchy: "office", product: "lince", reportsTo: "governance-council" },
  { id: "soc-vuln-mgmt", name: "Gestão de Vulnerabilidades (Lince)", description: "Pentest automatizado, gestão de CVE, misconfig scanning.", hierarchy: "office", product: "lince", reportsTo: "governance-council" },
];

function inferOffice(agentId: string): string {
  const id = agentId.toLowerCase();

  if (
    id === "governance-council" ||
    id === "meta-governance-auditor" ||
    id === "governance-failure-analyst-agent" ||
    id === "agent-governance-reviewer" ||
    id === "naming-governance-agent" ||
    id === "delegation-coordinator-agent"
  ) return "governance-council";

  if (
    id.startsWith("red-team") ||
    id.startsWith("blind-spot") ||
    id.startsWith("adversarial-") ||
    id.startsWith("prompt-injection") ||
    id.startsWith("production-readiness-breaker") ||
    id.startsWith("chaos-engineering")
  ) return "red-team";

  if (
    id.startsWith("clinical-") ||
    id.startsWith("hipaa-") ||
    id.startsWith("privacy-leak")
  ) return "clinical-safety";

  if (
    id === "agent-health-manager" ||
    id === "agent-runtime-supervisor" ||
    id === "runtime-failure-analyst-agent" ||
    id === "ci-failure-triage-agent" ||
    id === "repo-settings-auditor-agent" ||
    id === "pin-rot-agent"
  ) return "agent-factory";

  if (
    id === "eks-operator" ||
    id === "argocd-healer-agent" ||
    id === "gitops-operator" ||
    id === "k8s-troubleshooter-agent" ||
    id === "infra-health-agent" ||
    id === "infra-planner" ||
    id === "bootstrap-drift-scanner-agent"
  ) return "platform-ops";

  if (id === "security-reviewer" || id === "iam-reviewer") return "security";

  if (
    id === "backend-quality-agent" ||
    id === "frontend-quality-agent" ||
    id === "quality-gate-reviewer" ||
    id === "test-architect" ||
    id === "api-designer" ||
    id === "ui-audit-agent" ||
    id === "architecture-adr-writer"
  ) return "engineering-quality";

  if (
    id === "ai-platform-architect" ||
    id === "service-architect" ||
    id === "domain-model-reviewer" ||
    id === "observability-reviewer"
  ) return "architecture";

  if (id === "finops-reviewer" || id === "cost-explosion-hunter-agent") return "finops";

  if (id === "market-intelligence-manager" || id === "marketing-copy-agent") return "market-content";

  // Heurísticas amplas para agents novos que não tenham mapping explícito
  if (/^(web-research|agent-trainer|dependency-updater|knowledge-base-keeper|continuous-improvement)/.test(id)) return "continuous-learning";
  if (/-specialist-agent$|^grafana|^prometheus|^opentelemetry|^loki|^tempo|^kyverno|^helm|^opentofu|^terragrunt|^aws-|^nats-|^temporal-|^postgres|^medplum|^external-secrets|^github-actions|^docker-|^typescript-|^zod-|^vitest-/.test(id)) return "tool-specialists";
  if (/(^legal|advoca|counsel|lgpd|ans|cfm|compliance-lgpd|contract)/.test(id)) return "legal-compliance";
  if (/(hospital-.*sched|discharge|telemedicine|chart[-_]?review|pharmacy|reconcil)/.test(id)) return "hospital-ops";
  if (/(tuss|claim|denial|preauth|pre[-_]?auth|billing-hospital|rcm|revenue)/.test(id)) return "hospital-rcm";
  if (/(lab[-_]?result|imaging|dicom|pathology)/.test(id)) return "hospital-clinical-intel";
  if (/(soc[-_]?log|siem|alert[-_]?triage|detection[-_]?engineer|log[-_]?ingest)/.test(id)) return "soc-operations";
  if (/(threat[-_]?(hunt|intel)|\bioc\b|\bcti\b|darkweb|dark[-_]?web)/.test(id)) return "soc-threat-intel";
  if (/(soar|forens|phishing|malware|playbook|incident[-_]?response)/.test(id)) return "soc-incident-response";
  if (/(vulnerab|pentest|cve|misconfig)/.test(id)) return "soc-vuln-mgmt";
  if (/(customer[-_]?(success|onboard)|support[-_]?sla|product[-_]?analytics|growth|nps)/.test(id)) return "customer-growth";
  if (/(bug[-_]?hunter|gap[-_]?analys|proactive|future[-_]?incident)/.test(id)) return "bug-watch";
  if (/(developer[-_]?doc|api[-_]?ref|public[-_]?docs|demo|tutorial|dx)/.test(id)) return "developer-experience";
  if (/(governan|council|policy)/.test(id)) return "governance-council";
  if (/(red[-_]?team|blind[-_]?spot|adversar|chaos|injection|breaker)/.test(id)) return "red-team";
  if (/(clinical|hipaa|phi|patient|fhir|privacy[-_]?leak)/.test(id)) return "clinical-safety";
  if (/(^agent-|runtime|lifecycle|factory|ci[-_]?failure|repo[-_]?settings|pin[-_]?rot)/.test(id))
    return "agent-factory";
  if (/(eks|k8s|kube|argocd|gitops|infra|bootstrap|drift|cluster|helm|tofu|opentofu)/.test(id))
    return "platform-ops";
  if (/(security|iam|secret|vault|auth[zn]?)/.test(id)) return "security";
  if (/(backend|frontend|quality|test|api[-_]?design|ui[-_]?audit|adr|lint|review)/.test(id))
    return "engineering-quality";
  if (/(architect|domain[-_]?model|observab|telemetry|tracing)/.test(id)) return "architecture";
  if (/(finops|cost|spend|budget)/.test(id)) return "finops";
  if (/(market|marketing|copy|content|brand)/.test(id)) return "market-content";

  return "agent-factory";
}

function parseFrontmatter(raw: string): { name: string; description: string } {
  const match = /^---\s*\n([\s\S]*?)\n---/.exec(raw);
  if (!match) return { name: "", description: "" };
  const body = match[1];
  const nameMatch = /^name:\s*(.+)$/m.exec(body);
  const descMatch = /^description:\s*(.+)$/m.exec(body);
  return {
    name: nameMatch ? nameMatch[1].trim() : "",
    description: descMatch ? descMatch[1].trim() : "",
  };
}

async function loadEngineeringAgents(agentsDir: string): Promise<EngineeringAgent[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(agentsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const agents: EngineeringAgent[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(agentsDir, entry.name);
    let raw: string;
    try {
      raw = await fsp.readFile(filePath, "utf-8");
    } catch {
      continue;
    }
    const { name, description } = parseFrontmatter(raw);
    const id = entry.name.replace(/\.md$/, "");
    const auto = autoPersonaFor({ id, englishName: name || id, englishDescription: description });
    const officeId = inferOffice(id);
    agents.push({
      id,
      name: name || id,
      description,
      officeId,
      source: "engineering",
      product: productForOffice(officeId),
      displayName: `${auto.firstName} ${auto.lastName}`,
      role: auto.role,
      descriptionPtBr: auto.descriptionPtBr,
      gender: auto.gender,
      leadership: auto.leadership,
      autoGenerated: true,
    });
  }
  return agents;
}

function productForOffice(officeId: string): "hospitalar" | "lince" | "shared" {
  const o = OFFICE_CATALOG.find((c) => c.id === officeId);
  return o?.product ?? "shared";
}

function findProjectRoot(squadsDir: string): string {
  return path.dirname(squadsDir);
}

const EXECUTIVE_AGENTS: EngineeringAgent[] = [
  {
    id: "executive/ceo",
    name: "João Lucas Lima Freire",
    description:
      "CEO e fundador da empresa. Define direção dos produtos (Velya Hospitalar, Lince SOC e futuros) e autoriza decisões de risco alto.",
    officeId: "executive",
    source: "executive",
    product: "shared",
  },
];

function isSharedEngineeringAgentPath(agentPath: string): boolean {
  const normalized = agentPath.replace(/\\/g, "/");
  return normalized.includes("/.claude/agents/") || normalized.startsWith("../../.claude/agents/");
}

export async function buildCompanyMap(squadsDir: string, opensquadSquads: { code: string; name: string; icon: string; description: string; agents: string[] }[]): Promise<CompanyMapData> {
  const projectRoot = findProjectRoot(squadsDir);
  const engineeringAgents = await loadEngineeringAgents(path.join(projectRoot, ".claude", "agents"));

  const opensquadAgents: EngineeringAgent[] = opensquadSquads.flatMap((sq) =>
    (sq.agents ?? [])
      .filter((agentPath) => !isSharedEngineeringAgentPath(agentPath))
      .map((agentPath) => {
      const base = path.basename(agentPath).replace(/\.agent\.md$/, "").replace(/\.md$/, "");
      const auto = autoPersonaFor({
        id: `${sq.code}/${base}`,
        englishName: base,
        englishDescription: sq.description,
      });
      return {
        id: `${sq.code}/${base}`,
        name: `${base} (${sq.name})`,
        description: sq.description,
        officeId: "opensquad-alas",
        source: "opensquad" as const,
        product: "shared" as const,
        displayName: `${auto.firstName} ${auto.lastName}`,
        role: auto.role,
        descriptionPtBr: auto.descriptionPtBr,
        gender: auto.gender,
        leadership: auto.leadership,
      };
      })
  );

  const allAgents = [...EXECUTIVE_AGENTS, ...engineeringAgents, ...opensquadAgents];

  const offices: Office[] = OFFICE_CATALOG.map((catalog) => ({
    ...catalog,
    agents: allAgents.filter((a) => a.officeId === catalog.id),
  }));

  return {
    offices,
    updatedAt: new Date().toISOString(),
  };
}
