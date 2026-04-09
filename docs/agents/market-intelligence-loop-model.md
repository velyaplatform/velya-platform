# Loop de Market Intelligence Controlado — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Office:** Market Intelligence Office  
**Namespace:** velya-dev-agents  
**Última revisão:** 2026-04-08

---

## 1. Propósito e Limites do Market Intelligence

O Market Intelligence Office existe para garantir que a Velya não opere em uma bolha tecnológica, ignorando avanços relevantes no ecossistema de tecnologias que utiliza. Ao mesmo tempo, o office existe com limites rígidos: não é um pipeline de modismos, não consome recursos ilimitados e não propaga recomendações sem evidência sólida.

**O que o Market Intelligence Loop FAZ:**

- Monitora documentação oficial de tecnologias que a Velya já usa ou planeja usar
- Identifica vulnerabilidades críticas e atualizações de segurança
- Detecta padrões emergentes de arquitetura comprovados por comunidades técnicas
- Sinaliza riscos de obsolescência de componentes atuais
- Cuida da boas práticas de AI agents e orchestration patterns

**O que o Market Intelligence Loop NÃO FAZ:**

- Não monitora redes sociais, blogs de opinião ou "tendências" sem evidência
- Não recomenda adoção de tecnologias baseada em hype ou popularidade
- Não gera relatórios sobre tecnologias que a Velya não usa e não planeja usar
- Não propaga recomendações sem revisão do Knowledge Office
- Não executa ações ou mudanças — apenas informa

---

## 2. Fontes Aprovadas de Inteligência

### 2.1 Documentação Oficial de Tecnologias Velya

Fontes de prioridade máxima (monitoramento semanal):

| Tecnologia    | URL de monitoramento                             | Tipo de conteúdo                       |
| ------------- | ------------------------------------------------ | -------------------------------------- |
| Kubernetes    | kubernetes.io/blog + CHANGELOG                   | Release notes, deprecations, security  |
| Temporal      | docs.temporal.io + community.temporal.io         | Breaking changes, best practices       |
| NATS          | docs.nats.io + nats.io/blog                      | JetStream updates, security patches    |
| KEDA          | keda.sh/blog + github.com/kedacore/keda/releases | Novos triggers, bugs críticos          |
| Prometheus    | prometheus.io/blog                               | Alerting improvements, storage changes |
| Grafana       | grafana.com/blog (tech posts only)               | Dashboard improvements, data sources   |
| Loki          | grafana.com/loki/changelog                       | Ingestão changes, query improvements   |
| Tempo         | grafana.com/tempo/changelog                      | Tracing improvements                   |
| ArgoCD        | argo-cd.readthedocs.io/CHANGELOG                 | GitOps improvements, security          |
| NATS Operator | github.com/nats-io/k8s/releases                  | K8s integration updates                |
| Anthropic     | docs.anthropic.com/changelog                     | Claude API changes, model updates      |
| OpenAI        | platform.openai.com/docs/changelog               | API changes, model deprecations        |

### 2.2 Comunidades Técnicas Curadas

Fontes de prioridade média (monitoramento quinzenal):

| Comunidade/Fonte | URL                  | Filtro                                               |
| ---------------- | -------------------- | ---------------------------------------------------- |
| CNCF Blog        | cncf.io/blog         | Tags: kubernetes, observability, security            |
| CNCF Landscape   | landscape.cncf.io    | Mudanças em categorias relevantes                    |
| Hacker News      | news.ycombinator.com | Apenas posts com score > 200 sobre tecnologias Velya |
| GitHub trending  | github.com/trending  | Apenas repos relacionados a K8s, agents, workflows   |
| Papers With Code | paperswithcode.com   | Apenas papers sobre AI agents e orchestration        |

### 2.3 Boas Práticas de AI Agents

Fontes específicas para AI agent development (monitoramento quinzenal):

| Fonte              | URL                                      | Foco                                            |
| ------------------ | ---------------------------------------- | ----------------------------------------------- |
| Anthropic Cookbook | github.com/anthropics/anthropic-cookbook | Patterns de agentes Claude                      |
| LangChain Blog     | blog.langchain.dev                       | Patterns de multi-agent (avaliar com ceticismo) |
| CrewAI Docs        | docs.crewai.com                          | Patterns de coordination de agents              |
| Microsoft AutoGen  | microsoft.github.io/autogen              | Patterns de multi-agent                         |
| Semantic Kernel    | learn.microsoft.com/semantic-kernel      | Orchestration patterns                          |

### 2.4 UX/OPS Trends (Saúde Digital)

Fontes específicas para contexto de saúde digital (monitoramento mensal):

| Fonte               | URL                    | Foco                           |
| ------------------- | ---------------------- | ------------------------------ |
| HIMSS Blog          | himss.org/news         | Tendências de HIS e EHR        |
| Health IT Analytics | healthitanalytics.com  | AI em saúde, casos de uso      |
| ONC Blog            | healthit.gov/buzz-blog | Regulação e interoperabilidade |
| HL7                 | hl7.org/news           | Updates do padrão FHIR         |

---

## 3. Regras de Curadoria

### 3.1 Regra de Relevância

Antes de qualquer item ser incluído no relatório de inteligência, deve passar pelo teste de relevância:

```python
def is_relevant_for_velya(item: IntelligenceItem) -> tuple[bool, str]:
    """
    Avalia se um item de inteligência é relevante para a Velya.
    Retorna (is_relevant, reason).
    """

    # Tecnologia diretamente utilizada pela Velya
    velya_technologies = {
        "kubernetes", "k8s", "temporal", "nats", "nats-jetstream", "keda",
        "prometheus", "grafana", "loki", "tempo", "argocd", "opentofu",
        "typescript", "nodejs", "postgresql", "medplum", "fhir",
        "anthropic", "claude", "openai", "gpt", "llm", "ai-agents",
        "aws-eks", "karpenter", "external-secrets", "cert-manager"
    }

    # Verificar overlap de tecnologias
    item_technologies = extract_technologies(item.content)
    overlap = velya_technologies & item_technologies

    if not overlap:
        return False, f"Nenhuma tecnologia Velya mencionada"

    # Verificar se é acionável
    if item.item_type in ["security_vulnerability", "deprecation_notice", "breaking_change"]:
        return True, f"Acionável: {item.item_type} em tecnologia {overlap}"

    if item.item_type == "best_practice" and item.evidence_strength >= 0.7:
        return True, f"Boa prática com evidência forte: {overlap}"

    # Verificar se não é modismo
    if item.evidence_strength < 0.6 and item.item_type == "trend":
        return False, "Trend sem evidência suficiente (< 0.6)"

    return len(overlap) > 0, f"Tecnologia {overlap} mencionada"
```

### 3.2 Regra de Deduplicação

Antes de incluir qualquer item no relatório, verificar se já foi reportado:

```python
def is_duplicate(item: IntelligenceItem, knowledge_base: KnowledgeBase) -> bool:
    """
    Verifica se o item já está na base de conhecimento.
    Usa embedding similarity para deduplicação semântica.
    """

    # Verificar por ID de fonte (URL, CVE ID, etc.)
    if knowledge_base.exists_by_source_id(item.source_id):
        return True

    # Verificar por similaridade semântica
    item_embedding = embed(item.title + " " + item.summary)
    similar_items = knowledge_base.search(
        embedding=item_embedding,
        threshold=0.90,  # 90% de similaridade = duplicata
        days_back=90
    )

    return len(similar_items) > 0
```

### 3.3 Regra Anti-Modismo

Um item é classificado como modismo e rejeitado se:

- Fonte: blog pessoal, newsletter de opinião, rede social (sem peer review)
- Evidence strength < 0.5: sem casos de uso comprovados em produção
- Adoção: < 3 empresas documentadas usando em produção de escala similar à Velya
- Maturidade: produto com < 6 meses de existência (exceto vulnerabilidades críticas)

```python
MODISMO_REJECTION_CRITERIA = {
    "evidence_strength_threshold": 0.60,
    "min_production_users": 3,
    "min_age_months": 6,
    "allowed_exceptions": ["security_vulnerability", "deprecation_notice"]
}

def is_modismo(item: IntelligenceItem) -> bool:
    if item.item_type in MODISMO_REJECTION_CRITERIA["allowed_exceptions"]:
        return False

    if item.evidence_strength < MODISMO_REJECTION_CRITERIA["evidence_strength_threshold"]:
        return True

    if item.production_users_documented < MODISMO_REJECTION_CRITERIA["min_production_users"]:
        return True

    if item.technology_age_months < MODISMO_REJECTION_CRITERIA["min_age_months"]:
        return True

    return False
```

---

## 4. Cost Budget e Throttling

### 4.1 Budget do Market Intelligence Office

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: market-intel-budget
  namespace: velya-dev-agents
data:
  # Budget de inferência LLM por sweep
  llm_tokens_per_sweep_max: '50000'
  llm_cost_per_sweep_max_usd: '0.50'

  # Budget de rede (chamadas a fontes externas)
  http_requests_per_sweep_max: '200'
  max_sources_per_sweep: '15'

  # Budget de tempo
  max_sweep_duration_hours: '4'

  # Budget mensal
  monthly_llm_budget_usd: '8.00'
  monthly_alert_if_above_percent: '75'
```

### 4.2 Throttling de Fontes Externas

```python
class IntelligenceScraper:
    """
    Scraper com throttling rigoroso para respeitar fontes externas
    e o budget de inferência da Velya.
    """

    # Rate limits por domínio (requisições por minuto)
    RATE_LIMITS = {
        "kubernetes.io": 5,
        "docs.temporal.io": 5,
        "docs.nats.io": 5,
        "github.com": 10,  # GitHub API rate limit: 60/hora sem auth
        "cncf.io": 3,
        "docs.anthropic.com": 5,
        "default": 2
    }

    # Delay mínimo entre requisições (segundos)
    MIN_DELAY_BETWEEN_REQUESTS = 5

    async def fetch_source(self, url: str) -> str:
        domain = urlparse(url).netloc
        rate_limit = self.RATE_LIMITS.get(domain, self.RATE_LIMITS["default"])

        # Respeitar rate limit
        await self.rate_limiter.acquire(domain, rate_limit)

        # Delay mínimo independente do rate limit
        await asyncio.sleep(self.MIN_DELAY_BETWEEN_REQUESTS)

        # User-agent identifica a Velya como bot respeitoso
        headers = {
            "User-Agent": "Velya-Platform-Intelligence-Bot/1.0 (internal research; respectful crawler)"
        }

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=30) as response:
                if response.status == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    await asyncio.sleep(retry_after)
                    return await self.fetch_source(url)  # Uma re-tentativa

                if response.status != 200:
                    return None

                return await response.text()
```

---

## 5. CronJob Semanal

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: market-intelligence-sweep
  namespace: velya-dev-agents
  labels:
    velya.io/agent-class: Market
    velya.io/office: intelligence
spec:
  schedule: '0 3 * * 1' # Segunda-feira 3h UTC
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 4
  failedJobsHistoryLimit: 4
  jobTemplate:
    spec:
      activeDeadlineSeconds: 14400 # 4 horas máximo
      backoffLimit: 1
      template:
        spec:
          restartPolicy: Never
          serviceAccountName: market-intel-sa
          containers:
            - name: market-intel
              image: velya/market-intel:1.0.0
              env:
                - name: NATS_URL
                  valueFrom:
                    secretKeyRef:
                      name: nats-credentials
                      key: url
                - name: OPENAI_API_KEY
                  valueFrom:
                    secretKeyRef:
                      name: ai-gateway-credentials
                      key: openai-key
                - name: SWEEP_WEEK
                  value: '$(date +%Y-W%V)'
                - name: OUTPUT_SUBJECT
                  value: 'velya.intelligence.weekly-report'
                - name: LLM_MODEL
                  value: 'gpt-4o-mini' # Modelo mais econômico para análise
                - name: MAX_TOKENS_PER_ITEM
                  value: '500'
                - name: MAX_ITEMS_PER_SWEEP
                  value: '50'
              envFrom:
                - configMapRef:
                    name: market-intel-config
              resources:
                requests:
                  cpu: 200m
                  memory: 512Mi
                limits:
                  cpu: 1000m
                  memory: 1Gi
              securityContext:
                runAsNonRoot: true
                runAsUser: 1000
                readOnlyRootFilesystem: true
                capabilities:
                  drop: ['ALL']
```

---

## 6. Fluxo Completo do Loop Semanal

```
SEGUNDA-FEIRA 03:00 UTC
         │
         ▼
CronJob dispara market-intelligence-sweep
         │
         ▼ (duração: ~2-3 horas)
Market Intelligence Agent executa:

  FASE 1: Fetch de fontes (1h)
    ├── Fetch de todas as fontes aprovadas
    ├── Throttling por domínio
    ├── Filtragem de conteúdo novo (vs. última semana)
    └── Extração de items candidatos

  FASE 2: Análise e curadoria (1h)
    ├── Classificação de tipo de item (security/best-practice/deprecation/trend)
    ├── Score de relevância para Velya (0.0 - 1.0)
    ├── Score de evidência (0.0 - 1.0)
    ├── Detecção de modismo (rejeitar se true)
    ├── Deduplicação vs. base de conhecimento
    └── Priorização por impacto e urgência

  FASE 3: Geração de relatório (30min)
    ├── Estruturar relatório semanal
    ├── Categorizar por: security/deprecation/best-practice/opportunity
    ├── Calcular estimativa de esforço de implementação
    └── Gerar resumo executivo

         │
         ▼
Relatório publicado em velya.intelligence.weekly-report
         │
         ▼ (TERÇA-FEIRA manhã)
Knowledge Office Agent processa relatório:
    ├── Ingestão na base de conhecimento
    ├── Priorização por urgência
    ├── Criação de tarefas para review
    └── Notificação para arquitetos relevantes

         │
         ▼ (TERÇA-FEIRA a QUINTA-FEIRA)
Human Review (Architecture Review Office):
    ├── Revisão de itens de segurança (prioridade máxima)
    ├── Revisão de deprecations que afetam a Velya
    ├── Avaliação de best practices aplicáveis
    └── Decisão: aceitar/rejeitar/investigar mais

         │
         ▼ (após aprovação)
Itens aprovados:
    ├── Security vulns → ADR + patch plan imediato
    ├── Deprecations → ADR + migration plan
    ├── Best practices → RFC + Architecture Review
    └── Opportunities → backlog de arquitetura
```

---

## 7. Schema do Relatório Semanal

```json
{
  "report_id": "intel-2026-W15",
  "week": "2026-W15",
  "generated_at": "2026-04-08T06:00:00Z",
  "generated_by": "market-intel-agent",
  "sweep_duration_minutes": 142,
  "sources_consulted": 12,
  "items_found": 87,
  "items_relevant": 23,
  "items_after_dedup": 18,
  "items_after_modismo_filter": 15,
  "items_in_report": 15,

  "llm_cost_usd": 0.38,
  "llm_tokens_used": 38200,

  "sections": {
    "security": {
      "count": 2,
      "items": [
        {
          "id": "sec-001",
          "title": "CVE-2026-1234: NATS JetStream subject injection vulnerability",
          "source": "docs.nats.io/security",
          "severity": "HIGH",
          "affects_velya": true,
          "affected_version": "< 2.10.5",
          "velya_version": "2.10.3",
          "recommendation": "Atualizar NATS para 2.10.5 imediatamente",
          "effort_estimate": "2 horas",
          "urgency": "immediate"
        }
      ]
    },

    "deprecations": {
      "count": 1,
      "items": [
        {
          "id": "dep-001",
          "title": "Kubernetes PodDisruptionBudget v1beta1 removido no K8s 1.31",
          "source": "kubernetes.io/blog",
          "affects_velya": true,
          "migration_required_by": "2026-Q3",
          "recommendation": "Migrar para policy/v1 PodDisruptionBudget antes de upgrade do cluster",
          "effort_estimate": "4 horas"
        }
      ]
    },

    "best_practices": {
      "count": 8,
      "items": [
        {
          "id": "bp-001",
          "title": "Temporal: usar Workflow ID Reuse Policy para evitar duplicate workflows",
          "source": "docs.temporal.io/workflows/workflow-id-reuse-policy",
          "relevance_score": 0.87,
          "evidence_strength": 0.92,
          "applicable_to": ["discharge-workflow", "patient-flow-workflow"],
          "effort_estimate": "8 horas",
          "priority": "medium"
        }
      ]
    },

    "opportunities": {
      "count": 4,
      "items": [...]
    }
  },

  "rejected_items": {
    "by_modismo": 5,
    "by_irrelevance": 64,
    "by_deduplication": 3
  }
}
```

---

## 8. Risk Review de Itens de Inteligência

Antes de qualquer recomendação de adoção de nova tecnologia ser aprovada:

```yaml
# risk-review-template.yaml
item_id: 'opp-003'
technology: 'Dapr'
category: 'opportunity'
risk_review:
  technical_maturity:
    cncf_status: 'graduated' # sandbox/incubating/graduated
    production_users: ['Microsoft', 'Alibaba', 'Zeiss']
    min_version_stable: '1.12.0'
    breaking_changes_history: '2 breaking changes em 2 anos'
    assessment: 'mature'

  operational_cost:
    deployment_complexity: 'medium' # low/medium/high
    maintenance_overhead: 'medium'
    learning_curve_months: 2
    estimated_additional_infra_cost_usd_month: 0
    requires_new_expertise: true

  fit_with_velya_stack:
    replaces: 'direct NATS calls for service-to-service'
    conflicts_with: []
    integrates_with: ['kubernetes', 'nats', 'prometheus']
    assessment: 'good_fit'

  risk_factors:
    - 'Introduz nova abstração que pode ocultar problemas de rede'
    - 'Requer treinamento da equipe'

  recommendation: 'investigar_mais' # adopt/adopt_gradually/watch/reject
  recommended_next_step: 'PoC de 1 sprint com um serviço não-crítico'
```

---

## 9. Métricas do Market Intelligence Office

```
velya_intelligence_sweep_duration_seconds
velya_intelligence_items_found_total
velya_intelligence_items_relevant_total
velya_intelligence_items_rejected_modismo_total
velya_intelligence_llm_cost_usd_total
velya_intelligence_security_items_found_total
velya_intelligence_last_sweep_timestamp
velya_intelligence_recommendations_accepted_total
velya_intelligence_recommendations_rejected_total
```

**Alertas:**

```yaml
- alert: IntelligenceSweepFailed
  expr: |
    time() - velya_intelligence_last_sweep_timestamp > 604800  # 7 dias
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: 'Market intelligence sweep não executou nos últimos 7 dias'

- alert: IntelligenceSecurityItemFound
  expr: |
    velya_intelligence_security_items_found_total > 0
  for: 0m
  labels:
    severity: warning
    team: security
  annotations:
    summary: 'Market intelligence encontrou item de segurança — revisar relatório semanal'
```
