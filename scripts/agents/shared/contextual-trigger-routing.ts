export type TriggerActionType =
  | 'validation'
  | 'testing'
  | 'monitoring'
  | 'correction'
  | 'improvement';

export type ProductContext = 'hospitalar' | 'lince' | 'shared';

export interface TriggerRoutingRequest {
  fromAgent: string;
  actionType: TriggerActionType;
  contextTags?: string[];
  productContext?: ProductContext;
  description?: string;
  target?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
  maxDelegates?: number;
  allowCoordinatorFallback?: boolean;
}

export interface TriggerDelegate {
  agentId: string;
  actionType: TriggerActionType;
  productContext: ProductContext;
  matchedContexts: string[];
  rationale: string;
  score: number;
}

export interface TriggerRoutingPlan {
  actionType: TriggerActionType;
  routingMode: 'contextual-specialist-only';
  decision: 'direct' | 'coordinated' | 'unrouted';
  selectedAgentId?: string;
  coordinatorAgentId?: string;
  contextTags: string[];
  delegates: TriggerDelegate[];
  explanation: string;
}

interface RoutingRule {
  agentId: string;
  productContext: ProductContext;
  actions: TriggerActionType[];
  contexts: string[];
  rationale: string;
  priority: number;
}

const COORDINATOR_AGENT_ID = 'delegation-coordinator-agent';

const CONTEXT_ALIASES: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: 'aws', patterns: [/\baws\b/i, /\biam\b/i, /\bvpc\b/i, /\brds\b/i, /\bs3\b/i, /\broute53\b/i, /\bcloudfront\b/i, /\bcloudtrail\b/i, /\bsecrets manager\b/i] },
  { tag: 'eks', patterns: [/\beks\b/i] },
  { tag: 'kubernetes', patterns: [/\bkubernetes\b/i, /\bk8s\b/i, /\bcluster\b/i, /\bpod\b/i, /\bdeployment\b/i, /\bcronjob\b/i, /\bhpa\b/i, /\bkeda\b/i] },
  { tag: 'argocd', patterns: [/\bargocd\b/i, /\bgitops\b/i, /\bapplication(set)?\b/i] },
  { tag: 'helm', patterns: [/\bhelm\b/i, /\bchart\b/i] },
  { tag: 'kyverno', patterns: [/\bkyverno\b/i, /\bpolicy-as-code\b/i, /\badmission policy\b/i] },
  { tag: 'opentofu', patterns: [/\bopentofu\b/i, /\bterraform\b/i, /\biac\b/i] },
  { tag: 'terragrunt', patterns: [/\bterragrunt\b/i] },
  { tag: 'github-actions', patterns: [/\bgithub actions?\b/i, /\bworkflow\b/i, /\bci\b/i] },
  { tag: 'typescript', patterns: [/\btypescript\b/i, /\btsconfig\b/i, /\btypecheck\b/i] },
  { tag: 'zod', patterns: [/\bzod\b/i, /\bschema validation\b/i, /\binput validation\b/i] },
  { tag: 'frontend', patterns: [/\bfrontend\b/i, /\breact\b/i, /\bui\b/i] },
  { tag: 'ux', patterns: [/\bux\b/i, /\ba11y\b/i, /\bvisual\b/i, /\bdesign\b/i] },
  { tag: 'backend', patterns: [/\bbackend\b/i, /\bapi\b/i, /\bendpoint\b/i, /\bcontract\b/i] },
  { tag: 'testing', patterns: [/\btest\b/i, /\be2e\b/i, /\bintegration\b/i, /\bunit\b/i] },
  { tag: 'performance', patterns: [/\bperformance\b/i, /\blatency\b/i, /\bthroughput\b/i, /\bregression\b/i] },
  { tag: 'security', patterns: [/\bsecurity\b/i, /\bauth\b/i, /\brbac\b/i, /\bcsp\b/i, /\bcors\b/i, /\bsecret\b/i, /\bnetwork policy\b/i] },
  { tag: 'observability', patterns: [/\bobservability\b/i, /\bslo\b/i, /\bsli\b/i] },
  { tag: 'grafana', patterns: [/\bgrafana\b/i, /\bdashboard\b/i] },
  { tag: 'prometheus', patterns: [/\bprometheus\b/i, /\bpromql\b/i, /\bmetrics?\b/i, /\balertmanager\b/i] },
  { tag: 'loki', patterns: [/\bloki\b/i, /\blogs?\b/i, /\blogql\b/i] },
  { tag: 'tempo', patterns: [/\btempo\b/i] },
  { tag: 'opentelemetry', patterns: [/\bopentelemetry\b/i, /\botel\b/i, /\botlp\b/i, /\binstrumentation\b/i, /\btrace(s)?\b/i] },
  { tag: 'postgresql', patterns: [/\bpostgres(ql)?\b/i, /\bquery\b/i, /\bindex\b/i, /\bvacc?uum\b/i] },
  { tag: 'docker', patterns: [/\bdocker\b/i, /\boci\b/i, /\bimage\b/i, /\bcontainer\b/i] },
  { tag: 'fhir', patterns: [/\bfhir\b/i, /\bmedplum\b/i, /\bhl7\b/i] },
  { tag: 'dicom', patterns: [/\bdicom\b/i, /\bimaging\b/i] },
  { tag: 'telemedicine', patterns: [/\btelemedicine\b/i, /\btelemedicina\b/i] },
  { tag: 'tuss', patterns: [/\btuss\b/i, /\bglosa\b/i, /\bpreauth\b/i, /\bpre-auth\b/i] },
  { tag: 'hipaa', patterns: [/\bhipaa\b/i, /\bphi\b/i] },
  { tag: 'lgpd', patterns: [/\blgpd\b/i, /\bprivacy\b/i, /\bpii\b/i] },
  { tag: 'ans', patterns: [/\bans\b/i] },
  { tag: 'legal', patterns: [/\blegal\b/i, /\bjur[ií]d/i, /\bcontract\b/i, /\bcompliance\b/i] },
  { tag: 'dependency', patterns: [/\bdependency\b/i, /\bdependencies\b/i, /\bnpm\b/i, /\bupgrade\b/i, /\bcve\b/i] },
  { tag: 'research', patterns: [/\bresearch\b/i, /\brfc\b/i, /\bvendor\b/i, /\bdocs?\b/i] },
  { tag: 'soc', patterns: [/\bsoc\b/i, /\bsiem\b/i, /\bsecurity operations\b/i] },
  { tag: 'threat', patterns: [/\bthreat\b/i, /\bioc\b/i, /\bcti\b/i] },
  { tag: 'phishing', patterns: [/\bphishing\b/i] },
  { tag: 'malware', patterns: [/\bmalware\b/i] },
  { tag: 'forensics', patterns: [/\bforensic/i] },
  { tag: 'customer', patterns: [/\bcustomer\b/i, /\bonboarding\b/i, /\bsupport\b/i, /\bsla\b/i] },
];

const ROUTING_RULES: RoutingRule[] = [
  {
    agentId: 'aws-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'monitoring', 'correction', 'improvement'],
    contexts: ['aws', 'eks'],
    rationale: 'Especialista de cloud quando o contexto é AWS/EKS.',
    priority: 100,
  },
  {
    agentId: 'terragrunt-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'testing', 'correction', 'improvement'],
    contexts: ['terragrunt'],
    rationale: 'Especialista de composição/env graph Terragrunt.',
    priority: 98,
  },
  {
    agentId: 'opentofu-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'testing', 'correction', 'improvement'],
    contexts: ['opentofu'],
    rationale: 'Especialista de módulos/state IaC.',
    priority: 97,
  },
  {
    agentId: 'argocd-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'monitoring', 'improvement'],
    contexts: ['argocd'],
    rationale: 'Especialista funcional de ArgoCD/GitOps.',
    priority: 97,
  },
  {
    agentId: 'argocd-healer-agent',
    productContext: 'shared',
    actions: ['monitoring', 'correction'],
    contexts: ['argocd'],
    rationale: 'Healer para drift/remediação operacional de ArgoCD.',
    priority: 99,
  },
  {
    agentId: 'helm-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'testing', 'correction', 'improvement'],
    contexts: ['helm'],
    rationale: 'Especialista quando o artefato é chart/render Helm.',
    priority: 95,
  },
  {
    agentId: 'kyverno-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'monitoring', 'correction'],
    contexts: ['kyverno', 'security'],
    rationale: 'Valida policy-as-code e enforcement.',
    priority: 95,
  },
  {
    agentId: 'github-actions-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'testing', 'monitoring', 'correction'],
    contexts: ['github-actions'],
    rationale: 'Especialista de CI e runtimes de workflow.',
    priority: 96,
  },
  {
    agentId: 'typescript-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'testing', 'correction', 'improvement'],
    contexts: ['typescript'],
    rationale: 'Validação/correção de tipagem TypeScript.',
    priority: 93,
  },
  {
    agentId: 'zod-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'correction'],
    contexts: ['zod'],
    rationale: 'Schema/runtime validation específica de Zod.',
    priority: 94,
  },
  {
    agentId: 'frontend-quality-agent',
    productContext: 'shared',
    actions: ['validation', 'testing', 'improvement'],
    contexts: ['frontend', 'ux', 'testing'],
    rationale: 'Gate de qualidade de frontend e UX.',
    priority: 92,
  },
  {
    agentId: 'ui-audit-agent',
    productContext: 'shared',
    actions: ['testing', 'monitoring', 'improvement'],
    contexts: ['frontend', 'ux'],
    rationale: 'Monitor visual e regressão de interface.',
    priority: 92,
  },
  {
    agentId: 'backend-quality-agent',
    productContext: 'shared',
    actions: ['validation', 'testing', 'improvement'],
    contexts: ['backend', 'testing'],
    rationale: 'Gate de qualidade para APIs e backend.',
    priority: 92,
  },
  {
    agentId: 'test-architect',
    productContext: 'shared',
    actions: ['validation', 'testing', 'improvement'],
    contexts: ['testing', 'frontend', 'backend', 'performance'],
    rationale: 'Arquitetura de testes quando o contexto é estratégia/cobertura.',
    priority: 88,
  },
  {
    agentId: 'performance-regression-scanner-agent',
    productContext: 'shared',
    actions: ['testing', 'monitoring', 'improvement'],
    contexts: ['performance'],
    rationale: 'Especialista de regressão de desempenho.',
    priority: 91,
  },
  {
    agentId: 'k8s-troubleshooter-agent',
    productContext: 'shared',
    actions: ['testing', 'monitoring', 'correction'],
    contexts: ['kubernetes', 'eks'],
    rationale: 'Troubleshooter de cluster/workloads.',
    priority: 96,
  },
  {
    agentId: 'infra-health-agent',
    productContext: 'shared',
    actions: ['monitoring', 'improvement'],
    contexts: ['kubernetes', 'eks', 'argocd', 'observability'],
    rationale: 'Watchdog da saúde de infra e drift operacional.',
    priority: 90,
  },
  {
    agentId: 'security-reviewer',
    productContext: 'shared',
    actions: ['validation', 'monitoring'],
    contexts: ['security', 'aws', 'kubernetes', 'github-actions', 'fhir'],
    rationale: 'Validador de segurança quando há impacto em auth, segredos ou policy.',
    priority: 95,
  },
  {
    agentId: 'observability-reviewer',
    productContext: 'shared',
    actions: ['validation', 'monitoring', 'improvement'],
    contexts: ['observability', 'prometheus', 'grafana', 'loki', 'tempo', 'opentelemetry'],
    rationale: 'Revisão sistêmica da cobertura de observabilidade.',
    priority: 93,
  },
  {
    agentId: 'grafana-specialist-agent',
    productContext: 'shared',
    actions: ['monitoring', 'improvement'],
    contexts: ['grafana'],
    rationale: 'Dashboards/alerting de Grafana.',
    priority: 92,
  },
  {
    agentId: 'prometheus-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'monitoring', 'correction'],
    contexts: ['prometheus', 'observability'],
    rationale: 'Métricas, alerting rules e PromQL.',
    priority: 94,
  },
  {
    agentId: 'loki-specialist-agent',
    productContext: 'shared',
    actions: ['monitoring', 'correction', 'improvement'],
    contexts: ['loki'],
    rationale: 'Logs/LogQL e retenção.',
    priority: 92,
  },
  {
    agentId: 'tempo-specialist-agent',
    productContext: 'shared',
    actions: ['monitoring', 'correction', 'improvement'],
    contexts: ['tempo'],
    rationale: 'Traces no Tempo.',
    priority: 92,
  },
  {
    agentId: 'opentelemetry-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'monitoring', 'correction', 'improvement'],
    contexts: ['opentelemetry', 'observability'],
    rationale: 'Instrumentação OTEL/OTLP.',
    priority: 94,
  },
  {
    agentId: 'postgresql-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'monitoring', 'correction', 'improvement'],
    contexts: ['postgresql'],
    rationale: 'Tuning/integridade PostgreSQL.',
    priority: 92,
  },
  {
    agentId: 'docker-specialist-agent',
    productContext: 'shared',
    actions: ['validation', 'testing', 'correction', 'improvement'],
    contexts: ['docker'],
    rationale: 'Imagens OCI, build e runtime container.',
    priority: 90,
  },
  {
    agentId: 'medplum-fhir-specialist-agent',
    productContext: 'hospitalar',
    actions: ['validation', 'testing', 'correction', 'improvement'],
    contexts: ['fhir'],
    rationale: 'Especialista funcional FHIR/Medplum.',
    priority: 100,
  },
  {
    agentId: 'hospital-imaging-dicom-agent',
    productContext: 'hospitalar',
    actions: ['validation', 'testing', 'correction', 'improvement'],
    contexts: ['dicom'],
    rationale: 'Especialista de pipeline de imagem médica.',
    priority: 98,
  },
  {
    agentId: 'hospital-telemedicine-agent',
    productContext: 'hospitalar',
    actions: ['validation', 'monitoring', 'correction', 'improvement'],
    contexts: ['telemedicine'],
    rationale: 'Especialista de telemedicina.',
    priority: 96,
  },
  {
    agentId: 'hospital-tuss-coding-agent',
    productContext: 'hospitalar',
    actions: ['validation', 'correction', 'improvement'],
    contexts: ['tuss', 'ans'],
    rationale: 'Especialista de codificação TUSS/faturamento.',
    priority: 97,
  },
  {
    agentId: 'hipaa-compliance-agent',
    productContext: 'hospitalar',
    actions: ['validation', 'monitoring'],
    contexts: ['hipaa', 'fhir'],
    rationale: 'Compliance técnica HIPAA.',
    priority: 96,
  },
  {
    agentId: 'ans-compliance-agent',
    productContext: 'hospitalar',
    actions: ['validation', 'monitoring'],
    contexts: ['ans', 'tuss'],
    rationale: 'Compliance ANS/TUSS.',
    priority: 95,
  },
  {
    agentId: 'lgpd-compliance-agent',
    productContext: 'shared',
    actions: ['validation', 'monitoring'],
    contexts: ['lgpd', 'legal', 'security', 'fhir'],
    rationale: 'Compliance LGPD/privacidade.',
    priority: 95,
  },
  {
    agentId: 'legal-counsel-agent',
    productContext: 'shared',
    actions: ['validation', 'improvement'],
    contexts: ['legal', 'hipaa', 'lgpd', 'ans', 'telemedicine'],
    rationale: 'Parecer jurídico-operacional quando há restrição regulatória/contratual.',
    priority: 94,
  },
  {
    agentId: 'dependency-updater-agent',
    productContext: 'shared',
    actions: ['monitoring', 'improvement'],
    contexts: ['dependency'],
    rationale: 'Atualização preventiva de deps/charts/imagens.',
    priority: 89,
  },
  {
    agentId: 'web-research-agent',
    productContext: 'shared',
    actions: ['improvement'],
    contexts: ['research', 'dependency', 'security', 'observability', 'fhir'],
    rationale: 'Pesquisa externa para melhorias e novos fatos relevantes.',
    priority: 85,
  },
  {
    agentId: 'continuous-improvement-coordinator-agent',
    productContext: 'shared',
    actions: ['improvement'],
    contexts: ['research', 'frontend', 'backend', 'observability', 'security', 'dependency'],
    rationale: 'Coordena melhoria contínua quando há múltiplos specialists relevantes.',
    priority: 84,
  },
  {
    agentId: 'support-sla-tracker-agent',
    productContext: 'shared',
    actions: ['monitoring', 'improvement'],
    contexts: ['customer'],
    rationale: 'Monitoramento de SLA/espera com fornecedor ou cliente.',
    priority: 87,
  },
  {
    agentId: 'customer-success-agent',
    productContext: 'shared',
    actions: ['monitoring', 'improvement'],
    contexts: ['customer'],
    rationale: 'Escalonamento de impacto em sucesso do cliente.',
    priority: 84,
  },
  {
    agentId: 'soc-threat-hunting-agent',
    productContext: 'lince',
    actions: ['monitoring', 'improvement'],
    contexts: ['soc', 'threat'],
    rationale: 'Caça a ameaças no contexto SOC.',
    priority: 96,
  },
  {
    agentId: 'soc-detection-engineering-agent',
    productContext: 'lince',
    actions: ['validation', 'correction', 'improvement'],
    contexts: ['soc', 'threat'],
    rationale: 'Tradução de ameaça em detecção executável.',
    priority: 95,
  },
  {
    agentId: 'soc-phishing-analysis-agent',
    productContext: 'lince',
    actions: ['validation', 'monitoring', 'correction'],
    contexts: ['phishing', 'soc'],
    rationale: 'Especialista de phishing.',
    priority: 94,
  },
  {
    agentId: 'soc-malware-analysis-agent',
    productContext: 'lince',
    actions: ['validation', 'monitoring', 'correction'],
    contexts: ['malware', 'soc'],
    rationale: 'Especialista de malware.',
    priority: 94,
  },
  {
    agentId: 'soc-forensics-agent',
    productContext: 'lince',
    actions: ['validation', 'correction'],
    contexts: ['forensics', 'soc'],
    rationale: 'Especialista de forense digital.',
    priority: 94,
  },
];

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function inferContextTagsFromText(...chunks: Array<string | undefined | null>): string[] {
  const haystack = chunks.filter(Boolean).join('\n');
  if (!haystack.trim()) return [];
  const tags = new Set<string>();
  for (const alias of CONTEXT_ALIASES) {
    if (alias.patterns.some((pattern) => pattern.test(haystack))) {
      tags.add(alias.tag);
    }
  }
  return [...tags];
}

function productMatches(rule: RoutingRule, request: TriggerRoutingRequest): boolean {
  if (!request.productContext || request.productContext === 'shared') return true;
  return rule.productContext === 'shared' || rule.productContext === request.productContext;
}

export function buildTriggerRoutingPlan(
  request: TriggerRoutingRequest,
): TriggerRoutingPlan {
  const explicitTags = (request.contextTags ?? []).map(normalizeTag);
  const inferredTags = inferContextTagsFromText(
    request.description,
    request.target?.kind,
    request.target?.name,
    request.target?.namespace,
  );
  const contextTags = [...new Set([...explicitTags, ...inferredTags])];

  const maxDelegates = request.maxDelegates ?? 4;
  const allowCoordinatorFallback = request.allowCoordinatorFallback ?? true;

  const delegates = ROUTING_RULES
    .filter((rule) => rule.agentId !== request.fromAgent)
    .filter((rule) => rule.actions.includes(request.actionType))
    .filter((rule) => productMatches(rule, request))
    .map((rule) => {
      const matchedContexts = rule.contexts.filter((context) => contextTags.includes(context));
      if (matchedContexts.length === 0) return null;
      return {
        agentId: rule.agentId,
        actionType: request.actionType,
        productContext: rule.productContext,
        matchedContexts,
        rationale: rule.rationale,
        score: rule.priority + matchedContexts.length * 10,
      } satisfies TriggerDelegate;
    })
    .filter((entry): entry is TriggerDelegate => entry !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxDelegates);

  if (delegates.length === 0) {
    if (allowCoordinatorFallback) {
      return {
        actionType: request.actionType,
        routingMode: 'contextual-specialist-only',
        decision: 'coordinated',
        selectedAgentId: COORDINATOR_AGENT_ID,
        coordinatorAgentId: COORDINATOR_AGENT_ID,
        contextTags,
        delegates: [],
        explanation:
          'Nenhum specialist aderente ao contexto foi encontrado; delegação fica com o coordinator para triagem manual.',
      };
    }
    return {
      actionType: request.actionType,
      routingMode: 'contextual-specialist-only',
      decision: 'unrouted',
      contextTags,
      delegates: [],
      explanation:
        'Nenhum specialist aderente ao contexto foi encontrado e o fallback para coordinator está desligado.',
    };
  }

  if (delegates.length === 1) {
    return {
      actionType: request.actionType,
      routingMode: 'contextual-specialist-only',
      decision: 'direct',
      selectedAgentId: delegates[0]?.agentId,
      contextTags,
      delegates,
      explanation: 'Um único specialist aderente ao contexto foi encontrado; trigger direto.',
    };
  }

  const [top, second] = delegates;
  if (top && second && top.score >= second.score + 10) {
    return {
      actionType: request.actionType,
      routingMode: 'contextual-specialist-only',
      decision: 'direct',
      selectedAgentId: top.agentId,
      contextTags,
      delegates,
      explanation:
        'Existe um specialist dominante para o contexto; trigger direto preservando os demais como fallback contextual.',
    };
  }

  return {
    actionType: request.actionType,
    routingMode: 'contextual-specialist-only',
    decision: 'coordinated',
    selectedAgentId: COORDINATOR_AGENT_ID,
    coordinatorAgentId: COORDINATOR_AGENT_ID,
    contextTags,
    delegates,
    explanation:
      'Há múltiplos specialists contextualmente válidos; o coordinator decide a ordem sem fan-out indiscriminado.',
  };
}
