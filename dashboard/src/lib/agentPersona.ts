export type LeadershipRank =
  | "ceo"
  | "conselheiro"
  | "gerente"
  | "coordenador"
  | "supervisor"
  | null;

export type Gender = "m" | "f";

export interface Persona {
  firstName: string;
  lastName: string;
  role: string;
  descriptionPtBr: string;
  leadership?: LeadershipRank;
  gender: Gender;
}

const PERSONA_MAP: Record<string, Persona> = {
  // ── Executivo ──────────────────────────────────────────────────
  "executive/ceo": {
    firstName: "João Lucas",
    lastName: "Lima Freire",
    role: "CEO · Fundador",
    leadership: "ceo",
    gender: "m",
    descriptionPtBr:
      "Fundador da empresa. Define direção de produto, governança e prioridades entre Velya Hospitalar, Lince SOC e novos produtos em roadmap. Autoriza decisões de risco alto e checkpoints críticos.",
  },

  // ── Conselho de Governança ─────────────────────────────────────
  "governance-council": {
    firstName: "Ricardo",
    lastName: "Almeida",
    role: "Conselheiro-Chefe de Governança",
    leadership: "conselheiro",
    gender: "m",
    descriptionPtBr:
      "Agente de governança de topo. Arbitra conflitos de política, bloqueia mudanças sistêmicas inseguras e aplica padrões da plataforma.",
  },
  "meta-governance-auditor": {
    firstName: "Fernanda",
    lastName: "Teixeira",
    role: "Auditora de Meta-Governança",
    leadership: "conselheiro",
    gender: "f",
    descriptionPtBr:
      "Audita a própria governança — verifica se validadores estão validando de verdade, se auditores leem evidências e se watchdogs têm dentes.",
  },
  "governance-failure-analyst-agent": {
    firstName: "Eduardo",
    lastName: "Moraes",
    role: "Analista de Falhas de Governança",
    gender: "m",
    descriptionPtBr:
      "Investiga falhas dos processos de governança: aprovações sem evidência, chains de validação quebrados, escaladas perdidas.",
  },
  "agent-governance-reviewer": {
    firstName: "Patrícia",
    lastName: "Brandão",
    role: "Revisora de Governança de Agents",
    gender: "f",
    descriptionPtBr:
      "Revisa ciclo de vida, permissões e scorecards dos agents da plataforma para garantir operação segura.",
  },
  "naming-governance-agent": {
    firstName: "Leonardo",
    lastName: "Carvalho",
    role: "Guardião da Nomenclatura",
    gender: "m",
    descriptionPtBr:
      "Aplica o padrão de nomes da Velya: serviços `velya-{domínio}-{responsabilidade}`, agents `{office}-{role}-agent`, namespaces `velya-{env}-{domínio}`.",
  },
  "delegation-coordinator-agent": {
    firstName: "Renata",
    lastName: "Figueiredo",
    role: "Coordenadora de Delegação",
    leadership: "coordenador",
    gender: "f",
    descriptionPtBr:
      "Orquestra os agents de melhoria contínua (qualidade frontend/backend, saúde de infra, auditoria de UI, copy). Roteia achados e garante a cadeia de validação.",
  },

  // ── Red Team & Blind Spot Discovery ────────────────────────────
  "red-team-manager-agent": {
    firstName: "Marcelo",
    lastName: "Aragão",
    role: "Gerente do Red Team",
    leadership: "gerente",
    gender: "m",
    descriptionPtBr:
      "Estrategista adversarial-chefe da plataforma. Lidera exercícios de red team, testes adversariais, descoberta de blind spots e invalidação de premissas.",
  },
  "blind-spot-discovery-coordinator-agent": {
    firstName: "Bianca",
    lastName: "Mendonça",
    role: "Coordenadora de Blind Spots",
    leadership: "coordenador",
    gender: "f",
    descriptionPtBr:
      "Conduz sessões sistemáticas de descoberta de blind spots em todo o portfólio da plataforma. Reporta ao Red Team.",
  },
  "adversarial-behavior-analyst-agent": {
    firstName: "Vinícius",
    lastName: "Prado",
    role: "Analista Adversarial",
    gender: "m",
    descriptionPtBr:
      "Testa comportamento adversarial dos agents: jailbreak, desvio de escopo, excesso de autonomia, manipulação por input malicioso.",
  },
  "prompt-injection-analyst-agent": {
    firstName: "Letícia",
    lastName: "Barroso",
    role: "Analista de Prompt Injection",
    gender: "f",
    descriptionPtBr:
      "Caça vetores de prompt injection em contextos clínicos, notas FHIR, eventos NATS, documentos externos e mensagens agent-a-agent.",
  },
  "production-readiness-breaker-agent": {
    firstName: "Otávio",
    lastName: "Rangel",
    role: "Quebrador de Readiness",
    gender: "m",
    descriptionPtBr:
      "Tenta derrubar componentes antes da promoção para produção. Procura pontos frágeis que passaram pelos testes padrão.",
  },
  "chaos-engineering-agent": {
    firstName: "Débora",
    lastName: "Siqueira",
    role: "Engenheira de Caos",
    gender: "f",
    descriptionPtBr:
      "Injeta falhas controladas em dev/staging (rede, disco, CPU, latência, kill de pods) para validar resiliência antes que o cliente descubra.",
  },

  // ── Clinical Safety Office ─────────────────────────────────────
  "clinical-triage-agent": {
    firstName: "Mariana",
    lastName: "Soares",
    role: "Assistente de Triagem Clínica",
    gender: "f",
    descriptionPtBr:
      "Sugere prioridade de triagem, roteamento de tarefas e prontidão para alta com base em dados FHIR. Papel consultivo — nunca age autonomamente.",
  },
  "clinical-safety-gap-hunter-agent": {
    firstName: "Rafael",
    lastName: "Lacerda",
    role: "Caçador de Gaps Clínicos",
    gender: "m",
    descriptionPtBr:
      "Caça lacunas de segurança clínica: efeitos adversos não detectados, handoffs perdidos, alertas ignorados, vieses em recomendações clínicas.",
  },
  "hipaa-compliance-agent": {
    firstName: "Juliana",
    lastName: "Pimentel",
    role: "Analista de Conformidade HIPAA",
    gender: "f",
    descriptionPtBr:
      "Verifica conformidade com HIPAA: acesso a PHI, redação em logs, minimização de dados em prompts de IA, trilhas de auditoria.",
  },
  "privacy-leak-hunter-agent": {
    firstName: "Thiago",
    lastName: "Vasconcelos",
    role: "Caçador de Vazamentos de Privacidade",
    gender: "m",
    descriptionPtBr:
      "Varre logs, telemetria, prompts de IA e outputs externos procurando PHI, PII ou credenciais que não deveriam ter saído do domínio clínico.",
  },

  // ── Agent Factory & Runtime ────────────────────────────────────
  "agent-health-manager": {
    firstName: "Camila",
    lastName: "Botelho",
    role: "Gerente de Saúde de Agents",
    leadership: "gerente",
    gender: "f",
    descriptionPtBr:
      "Monitora scorecards de todos os agents ativos — precisão, latência, taxa de erro, drift. Move agents para probation ou quarentena quando thresholds são violados.",
  },
  "agent-runtime-supervisor": {
    firstName: "Bruno",
    lastName: "Machado",
    role: "Supervisor de Runtime",
    leadership: "supervisor",
    gender: "m",
    descriptionPtBr:
      "Supervisiona execução dos agents em produção. Garante que cada ação tem chain de validação, evidence log e respeita o kill switch.",
  },
  "runtime-failure-analyst-agent": {
    firstName: "Natália",
    lastName: "Ferraz",
    role: "Analista de Falhas de Runtime",
    gender: "f",
    descriptionPtBr:
      "Investiga falhas de runtime de agents — timeouts, loops de correção, silêncios, crashes silenciosos — e propõe correções.",
  },
  "ci-failure-triage-agent": {
    firstName: "Daniel",
    lastName: "Rocha",
    role: "Triador de Falhas de CI",
    gender: "m",
    descriptionPtBr:
      "Triagem de falhas em CI do GitHub Actions. Identifica causa raiz, categoriza (flake, regressão real, lint, teste) e comenta no PR com resumo.",
  },
  "repo-settings-auditor-agent": {
    firstName: "Gabriela",
    lastName: "Azevedo",
    role: "Auditora de Configurações do Repo",
    gender: "f",
    descriptionPtBr:
      "Audita configurações do repositório: branch protection, required reviews, secrets rotation, Actions com SHA pinned, CODEOWNERS.",
  },
  "pin-rot-agent": {
    firstName: "Henrique",
    lastName: "Diniz",
    role: "Guardião de Pins e Versões",
    gender: "m",
    descriptionPtBr:
      "Monitora se dependências, imagens de container e Actions continuam pinnadas por SHA/digest e não desviaram para tags mutáveis.",
  },

  // ── Platform & Infra Office ────────────────────────────────────
  "eks-operator": {
    firstName: "Pedro",
    lastName: "Batista",
    role: "Operador de EKS Sênior",
    gender: "m",
    descriptionPtBr:
      "Opera os clusters EKS: node management, upgrades controlados, saúde do control plane e add-ons gerenciados.",
  },
  "argocd-healer-agent": {
    firstName: "Isabela",
    lastName: "Nogueira",
    role: "Operadora de ArgoCD",
    gender: "f",
    descriptionPtBr:
      "Detecta e corrige drift no ArgoCD, diagnostica Applications em estado degraded e sugere rollback seguro.",
  },
  "gitops-operator": {
    firstName: "Felipe",
    lastName: "Ramalho",
    role: "Operador GitOps",
    gender: "m",
    descriptionPtBr:
      "Garante que todo o estado do cluster saia de Git. Bloqueia `kubectl apply` fora do ArgoCD em staging/prod.",
  },
  "k8s-troubleshooter-agent": {
    firstName: "Carolina",
    lastName: "Peixoto",
    role: "Especialista em Kubernetes",
    gender: "f",
    descriptionPtBr:
      "Diagnostica problemas de Kubernetes: pods presos, reinícios em loop, falta de memória, falha de pull de imagem, esgotamento de recursos e políticas de rede mal configuradas.",
  },
  "infra-health-agent": {
    firstName: "Gustavo",
    lastName: "Tavares",
    role: "Monitor de Saúde de Infra",
    gender: "m",
    descriptionPtBr:
      "Monitora métricas RED de infra (latência, erros, taxa) e dispara runbooks quando SLO é violado.",
  },
  "infra-planner": {
    firstName: "Beatriz",
    lastName: "Cordeiro",
    role: "Planejadora de Infra",
    gender: "f",
    descriptionPtBr:
      "Planeja mudanças de infra em OpenTofu: análise de impacto, plan review, decisão de janela de deploy, coordenação com FinOps.",
  },
  "bootstrap-drift-scanner-agent": {
    firstName: "Rodrigo",
    lastName: "Quintela",
    role: "Scanner de Drift de Bootstrap",
    gender: "m",
    descriptionPtBr:
      "Detecta drift entre estado esperado (OpenTofu state) e estado real dos recursos AWS/EKS provisionados no bootstrap.",
  },

  // ── Security Office ────────────────────────────────────────────
  "security-reviewer": {
    firstName: "Larissa",
    lastName: "Montenegro",
    role: "Revisora de Segurança",
    gender: "f",
    descriptionPtBr:
      "Revisa mudanças sensíveis: secrets, IAM, network policies, pod security, integrações externas. Trata findings como P1.",
  },
  "iam-reviewer": {
    firstName: "Augusto",
    lastName: "Sampaio",
    role: "Revisor de IAM",
    gender: "m",
    descriptionPtBr:
      "Revisa políticas IAM e Pod Identity. Aplica princípio do menor privilégio. Bloqueia wildcard `*` em Resource de produção.",
  },

  // ── Engineering Quality ────────────────────────────────────────
  "backend-quality-agent": {
    firstName: "Matheus",
    lastName: "Gusmão",
    role: "Analista de Qualidade Backend",
    gender: "m",
    descriptionPtBr:
      "Revisa código backend em TypeScript: tipos estritos, Zod nas bordas, idempotência, timeouts, structured logging.",
  },
  "frontend-quality-agent": {
    firstName: "Amanda",
    lastName: "Cerqueira",
    role: "Analista de Qualidade Frontend",
    gender: "f",
    descriptionPtBr:
      "Revisa código frontend (apps/web): a11y, performance, pixel overlap gate, sidebar resizing, fixtures de teste.",
  },
  "quality-gate-reviewer": {
    firstName: "Caio",
    lastName: "Bezerra",
    role: "Revisor de Quality Gate",
    gender: "m",
    descriptionPtBr:
      "Bloqueia merge em PRs sem lint, typecheck, unit + integration tests passando, ou sem aprovação de security-sensitive.",
  },
  "test-architect": {
    firstName: "Vanessa",
    lastName: "Delgado",
    role: "Arquiteta de Testes",
    gender: "f",
    descriptionPtBr:
      "Desenha estratégia de testes (unit, integration, e2e, agent golden), orienta cobertura e define pirâmide por serviço.",
  },
  "api-designer": {
    firstName: "Diego",
    lastName: "Fontoura",
    role: "Designer de API",
    gender: "m",
    descriptionPtBr:
      "Projeta APIs internas e externas com OpenAPI, versioning, idempotency keys, error envelope consistente.",
  },
  "ui-audit-agent": {
    firstName: "Luísa",
    lastName: "Meireles",
    role: "Auditora de UI",
    gender: "f",
    descriptionPtBr:
      "Roda o detector de overlaps pixel-a-pixel em `apps/web/**`. Bloqueia PR quando há sobreposição crítica.",
  },
  "architecture-adr-writer": {
    firstName: "Alex",
    lastName: "Bragança",
    role: "Redator de ADRs",
    gender: "m",
    descriptionPtBr:
      "Captura decisões arquiteturais em ADRs no formato `NNNN-título.md`, com Contexto, Decisão e Consequências explícitos.",
  },

  // ── Architecture Office ────────────────────────────────────────
  "ai-platform-architect": {
    firstName: "Tatiana",
    lastName: "Villela",
    role: "Arquiteta da Plataforma de IA",
    gender: "f",
    descriptionPtBr:
      "Desenha a camada `packages/ai-gateway`: routing por provedor, fallback, pinning de modelo, PHI redaction, prompt injection detection.",
  },
  "service-architect": {
    firstName: "Fábio",
    lastName: "Guimarães",
    role: "Arquiteto de Serviços",
    gender: "m",
    descriptionPtBr:
      "Define contratos entre serviços event-driven (NATS JetStream, Temporal). Evita chains síncronos longos e shared databases.",
  },
  "domain-model-reviewer": {
    firstName: "Helena",
    lastName: "Marinho",
    role: "Revisora de Modelo de Domínio",
    gender: "f",
    descriptionPtBr:
      "Revisa modelos FHIR-first. Garante que dados clínicos são representados como FHIR R4 antes de qualquer schema customizado.",
  },
  "observability-reviewer": {
    firstName: "Marco",
    lastName: "Valverde",
    role: "Revisor de Observabilidade",
    gender: "m",
    descriptionPtBr:
      "Revisa instrumentação OpenTelemetry: traces end-to-end, métricas RED, logs correlacionados, dashboards e alerts por SLO.",
  },

  // ── FinOps Office ──────────────────────────────────────────────
  "finops-reviewer": {
    firstName: "Regina",
    lastName: "Castilho",
    role: "Revisora Financeira de Operações",
    gender: "f",
    descriptionPtBr:
      "Revisa custo por decisão de IA, dimensionamento do EKS Auto Mode, tráfego de rede e armazenamento. Exige etiquetas obrigatórias em cada recurso.",
  },
  "cost-explosion-hunter-agent": {
    firstName: "Márcio",
    lastName: "Parente",
    role: "Caçador de Explosão de Custo",
    gender: "m",
    descriptionPtBr:
      "Detecta picos anômalos de custo (token burn, egress, provisioning descontrolado) e abre incidente antes do fechamento de mês.",
  },

  // ── Market & Content ───────────────────────────────────────────
  "market-intelligence-manager": {
    firstName: "Priscila",
    lastName: "Rezende",
    role: "Gerente de Inteligência de Mercado",
    leadership: "gerente",
    gender: "f",
    descriptionPtBr:
      "Monitora players de saúde e de SOC no Brasil: movimento competitivo, regulação, oportunidades de posicionamento do Velya Hospitalar e Lince.",
  },
  "marketing-copy-agent": {
    firstName: "André",
    lastName: "Coutinho",
    role: "Redator de Marketing",
    gender: "m",
    descriptionPtBr:
      "Audita e refina copy do produto — títulos, CTAs, estados vazios, mensagens de erro, labels — para o web falar português clínico consistente.",
  },

  // ── Opensquad: release-notes ───────────────────────────────────
  "release-notes/commit-collector": {
    firstName: "Joana",
    lastName: "Paiva",
    role: "Coletora de Commits",
    gender: "f",
    descriptionPtBr:
      "Lê o histórico git do monorepo, isola commits entre duas tags de release, classifica por Conventional Commits e entrega brief estruturado.",
  },
  "release-notes/release-writer": {
    firstName: "Paulo",
    lastName: "Aguiar",
    role: "Redator Sênior de Notas de Versão",
    gender: "m",
    descriptionPtBr:
      "Transforma o brief em changelog técnico e anúncio stakeholder em Pt-BR. Zero marketês, rastreabilidade por hash, foco em impacto.",
  },
  "release-notes/technical-reviewer": {
    firstName: "Clara",
    lastName: "Resende",
    role: "Revisora Técnica",
    gender: "f",
    descriptionPtBr:
      "Valida changelog e anúncio contra o brief e as regras de tom/compliance. Bloqueia se houver PHI, segredo, factualidade errada ou breaking change sem instrução.",
  },

  // ── Especialistas em Ferramentas (tool-specialists) ─────────────
  "grafana-specialist-agent": {
    firstName: "Tiago",
    lastName: "Maldonado",
    role: "Especialista em Observabilidade Grafana",
    gender: "m",
    descriptionPtBr:
      "Desenha dashboards, alerting unificado e SLO/SLI no Grafana. Dashboards-as-code, provisioning versionado, correlação com Loki, Tempo e Prometheus.",
  },
  "prometheus-specialist-agent": {
    firstName: "Sabrina",
    lastName: "Holanda",
    role: "Especialista em Métricas Prometheus",
    gender: "f",
    descriptionPtBr:
      "PromQL avançado, recording/alerting rules, service discovery Kubernetes, cardinalidade sob controle, Thanos/Mimir para escala.",
  },
  "opentelemetry-specialist-agent": {
    firstName: "Nelson",
    lastName: "Queiroz",
    role: "Especialista em OpenTelemetry",
    gender: "m",
    descriptionPtBr:
      "SDK em Node/TS, Collector agent+gateway, context propagation W3C, sampling tail-based, correlação traces ↔ logs ↔ métricas.",
  },
  "loki-specialist-agent": {
    firstName: "Mirela",
    lastName: "Escobar",
    role: "Especialista em Loki (logs)",
    gender: "f",
    descriptionPtBr:
      "Ingestão via Promtail/Agent, LogQL, labels enxutas, tiered storage (hot S3 → cold Glacier), queries performáticas.",
  },
  "tempo-specialist-agent": {
    firstName: "Rogério",
    lastName: "Sales",
    role: "Especialista em Tempo (traces)",
    gender: "m",
    descriptionPtBr:
      "Backend de traces OTLP → S3, TraceQL, metrics-generator para RED automáticos, service graph, retenção com lifecycle.",
  },
  "kyverno-specialist-agent": {
    firstName: "Adriana",
    lastName: "Benício",
    role: "Especialista em Kyverno (policy-as-code)",
    gender: "f",
    descriptionPtBr:
      "Policies validate/mutate/generate/cleanup. Audit → enforce depois de 7 dias limpos. Shift-left com kyverno-cli no PR.",
  },
  "helm-specialist-agent": {
    firstName: "Vitor",
    lastName: "Amorim",
    role: "Especialista em Helm",
    gender: "m",
    descriptionPtBr:
      "Chart authoring, values.schema.json, dependency lock, templates testados com helm unittest, renderização no CI.",
  },
  "argocd-specialist-agent": {
    firstName: "Cláudia",
    lastName: "Trindade",
    role: "Especialista em ArgoCD (GitOps avançado)",
    gender: "f",
    descriptionPtBr:
      "App of Apps, ApplicationSet, projects com RBAC, sync waves/hooks, notifications, health checks customizados via Lua.",
  },
  "aws-specialist-agent": {
    firstName: "Reinaldo",
    lastName: "Albuquerque",
    role: "Especialista AWS",
    gender: "m",
    descriptionPtBr:
      "EKS Auto Mode, VPC multi-AZ, IAM com Pod Identity, RDS, S3, GuardDuty, Security Hub. Custo sob controle (Savings Plans, Graviton).",
  },
  "opentofu-specialist-agent": {
    firstName: "Milena",
    lastName: "Drummond",
    role: "Especialista em OpenTofu",
    gender: "f",
    descriptionPtBr:
      "Módulos versionados, state em S3+DynamoDB, provider pinning rígido, moved/import blocks, checks pós-condição.",
  },
  "terragrunt-specialist-agent": {
    firstName: "Wagner",
    lastName: "Linhares",
    role: "Especialista em Terragrunt",
    gender: "m",
    descriptionPtBr:
      "Layouts DRY por ambiente, dependencies explícitas, generate de providers, run-all com aprovação em prod.",
  },
  "external-secrets-specialist-agent": {
    firstName: "Patrícia",
    lastName: "Santarém",
    role: "Especialista em External Secrets",
    gender: "f",
    descriptionPtBr:
      "ESO + AWS Secrets Manager via Pod Identity. Rotação automática, KMS CMK dedicada, auditoria CloudTrail em cada acesso.",
  },
  "nats-specialist-agent": {
    firstName: "Iago",
    lastName: "Schmitt",
    role: "Especialista em NATS JetStream",
    gender: "m",
    descriptionPtBr:
      "Streams com replicação R3, consumers pull durable, subject design hierárquico, mirror cross-cluster, DLQ para mensagens venenosas.",
  },
  "temporal-specialist-agent": {
    firstName: "Bárbara",
    lastName: "Galvão",
    role: "Especialista em Temporal",
    gender: "f",
    descriptionPtBr:
      "Workflows determinísticos, activities idempotentes com timeout explícito, signals/queries, versioning via patched(), namespaces isolados por ambiente.",
  },
  "postgresql-specialist-agent": {
    firstName: "Everton",
    lastName: "Bastos",
    role: "Especialista em PostgreSQL",
    gender: "m",
    descriptionPtBr:
      "Schema design, índices B-tree/GIN/BRIN, EXPLAIN ANALYZE, partitioning temporal, replicação streaming, expand-contract migrations.",
  },
  "medplum-fhir-specialist-agent": {
    firstName: "Cecília",
    lastName: "Cavalcante",
    role: "Especialista em Medplum e FHIR R4",
    gender: "f",
    descriptionPtBr:
      "Resources FHIR brasileiros (CID-10, TUSS, SUS), Subscriptions, Medplum Bots em TS, interoperabilidade TISS e HL7 v2.",
  },
  "docker-specialist-agent": {
    firstName: "Hélio",
    lastName: "Zambon",
    role: "Especialista em Docker e Imagens OCI",
    gender: "m",
    descriptionPtBr:
      "Dockerfile multi-stage com base distroless, BuildKit cache, SBOM com Syft+cosign, scan Trivy, assinatura por KMS.",
  },
  "github-actions-specialist-agent": {
    firstName: "Melissa",
    lastName: "Chavantes",
    role: "Especialista em GitHub Actions",
    gender: "f",
    descriptionPtBr:
      "Reusable workflows, composite actions, OIDC para AWS (zero access key), matrix builds, concurrency groups, hardening com SHA pinning.",
  },
  "typescript-specialist-agent": {
    firstName: "Anderson",
    lastName: "Espósito",
    role: "Especialista em TypeScript",
    gender: "m",
    descriptionPtBr:
      "Strict total, discriminated unions, branded types para IDs, project references no monorepo, type-level testing com tsd.",
  },
  "zod-specialist-agent": {
    firstName: "Rosângela",
    lastName: "Lacerda",
    role: "Especialista em Zod (validação runtime)",
    gender: "f",
    descriptionPtBr:
      "Schemas em toda borda (HTTP, NATS, env), z.infer para tipo derivado, refinements/transforms, error formatting pt-BR.",
  },

  // ── Aprendizado Contínuo e Manutenção (continuous-learning) ─────
  "web-research-agent": {
    firstName: "Dandara",
    lastName: "Freitas",
    role: "Pesquisadora Web e Radar Tecnológico",
    gender: "f",
    descriptionPtBr:
      "Monitora changelogs, CVEs, RFCs, docs oficiais, regulatório. Entrega briefings semanais e alertas táticos para toda a empresa.",
  },
  "agent-trainer-agent": {
    firstName: "Rômulo",
    lastName: "Seixas",
    role: "Treinador de Agentes",
    gender: "m",
    descriptionPtBr:
      "Revisa e atualiza os prompts dos outros agents. Auditoria trimestral (mensal para clínicos/legal). Propaga aprendizados de postmortems.",
  },
  "dependency-updater-agent": {
    firstName: "Eliane",
    lastName: "Bittencourt",
    role: "Atualizadora de Dependências",
    gender: "f",
    descriptionPtBr:
      "npm, Helm, providers OpenTofu, imagens, Actions. Prioriza por CVE×EPSS×exposição, abre PR com changelog resumido. Zero auto-merge em prod.",
  },
  "knowledge-base-keeper-agent": {
    firstName: "Jorge",
    lastName: "Vasquez",
    role: "Curador da Base de Conhecimento",
    gender: "m",
    descriptionPtBr:
      "Mantém .claude/knowledge/ com postmortems, ADRs, runbooks e lições aprendidas. Indexa e consulta automaticamente antes de ações críticas.",
  },
  "continuous-improvement-coordinator-agent": {
    firstName: "Yasmin",
    lastName: "Passos",
    role: "Coordenadora de Melhoria Contínua",
    gender: "f",
    leadership: "coordenador",
    descriptionPtBr:
      "Orquestra a ala de aprendizado contínuo em cadências diária/semanal/mensal/trimestral. Gera relatório semanal de saúde organizacional.",
  },
};

const FALLBACK_POOL: Persona[] = [
  {
    firstName: "Aline",
    lastName: "Costa",
    role: "Analista",
    gender: "f",
    descriptionPtBr: "Agent da Velya Platform (persona sem mapeamento explícito).",
  },
  {
    firstName: "Breno",
    lastName: "Lima",
    role: "Analista",
    gender: "m",
    descriptionPtBr: "Agent da Velya Platform (persona sem mapeamento explícito).",
  },
  {
    firstName: "Carla",
    lastName: "Nunes",
    role: "Analista",
    gender: "f",
    descriptionPtBr: "Agent da Velya Platform (persona sem mapeamento explícito).",
  },
  {
    firstName: "Davi",
    lastName: "Souza",
    role: "Analista",
    gender: "m",
    descriptionPtBr: "Agent da Velya Platform (persona sem mapeamento explícito).",
  },
  {
    firstName: "Elisa",
    lastName: "Pires",
    role: "Analista",
    gender: "f",
    descriptionPtBr: "Agent da Velya Platform (persona sem mapeamento explícito).",
  },
];

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function personaFor(agentId: string): Persona {
  const mapped = PERSONA_MAP[agentId];
  if (mapped) return mapped;
  return FALLBACK_POOL[hashString(agentId) % FALLBACK_POOL.length];
}

/** Usa dados vindos do server (autoPersona) quando não há mapping manual. */
export function personaForAgent(
  agentId: string,
  serverData?: {
    displayName?: string;
    role?: string;
    descriptionPtBr?: string;
    gender?: "m" | "f";
    leadership?: LeadershipRank;
  },
): Persona {
  const mapped = PERSONA_MAP[agentId];
  if (mapped) return mapped;
  if (serverData && serverData.displayName && serverData.role) {
    const [firstName, ...rest] = serverData.displayName.split(" ");
    return {
      firstName,
      lastName: rest.join(" ") || "Silva",
      role: serverData.role,
      descriptionPtBr: serverData.descriptionPtBr ?? "",
      gender: serverData.gender ?? "m",
      leadership: serverData.leadership ?? null,
    };
  }
  return FALLBACK_POOL[hashString(agentId) % FALLBACK_POOL.length];
}

export function fullName(p: Persona): string {
  return `${p.firstName} ${p.lastName}`;
}
