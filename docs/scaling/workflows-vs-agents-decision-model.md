# Modelo de Decisão: Workflows vs Agents para Hyperscalabilidade

**Versão:** 1.0  
**Domínio:** Arquitetura de Sistemas Inteligentes  
**Classificação:** Documento de Decisão Técnica  
**Data:** 2026-04-08

---

## Mandato

> **Na Velya, workflows resolvem problemas de orquestração. Agents resolvem problemas de raciocínio. Nunca use agent onde um workflow determinístico é suficiente. Nunca use workflow onde o problema exige julgamento dinâmico.**

A distinção não é sobre tecnologia — é sobre a natureza do problema:
- **Workflow**: sequência de steps conhecidos, com transições previsíveis, onde durabilidade e auditabilidade são críticas.
- **Agent**: problema onde o caminho de solução não é conhecido a priori, onde raciocínio contextual é necessário para decidir o próximo step.

---

## Árvore de Decisão Principal

```
INÍCIO: Preciso automatizar uma tarefa
│
├─► A tarefa tem um roteiro fixo de steps?
│   ├─ SIM ──► É um WORKFLOW determinístico
│   │          ├─ Tem mais de 3 steps? → Temporal
│   │          ├─ Tem 1-3 steps, sem estado? → CronJob K8s
│   │          └─ Tem DAG complexo, artefatos? → Argo Workflow
│   │
│   └─ NÃO ──► O problema exige raciocínio contextual?
│               ├─ SIM ──► Considerar AGENT
│               │          ├─ O raciocínio é sobre dados estruturados? → Workflow com LLM tool
│               │          ├─ Exige múltiplos julgamentos sequenciais? → Single Agent
│               │          ├─ Exige especialização paralela? → Multi-Agent (com justificativa)
│               │          └─ Tem impacto clínico direto? → Humano no loop OBRIGATÓRIO
│               │
│               └─ NÃO ──► É uma regra de negócio?
│                           ├─ SIM → Implementar como código, não como agent
│                           └─ NÃO → Revisar necessidade da automação
```

---

## Critérios de Classificação

### Quando usar Workflow (Temporal)

| Critério | Workflow Temporal |
|---|---|
| Steps conhecidos | Sim — roteiro fixo |
| Duração | Segundos a dias |
| Falha e retry | Exige retry com backoff e compensation |
| Auditabilidade | Histórico completo de steps obrigatório |
| Paralelismo | Atividades paralelas com join |
| Estado | Exige persistência de estado entre steps |
| Raciocínio | Não — decisões são regras codificadas |
| Custo LLM | Zero ou mínimo (apenas para síntese final) |

### Quando usar CronJob K8s

| Critério | CronJob K8s |
|---|---|
| Steps | 1 a 3, idempotente |
| Duração | Segundos a minutos |
| Falha | Tolerante — pode re-executar na próxima rodada |
| Estado | Stateless ou estado em storage externo |
| Frequência | Horária, diária, semanal |
| Raciocínio | Não — computação determinística |

### Quando usar Agent (Single)

| Critério | Agent Single |
|---|---|
| Problema | Aberto — caminho não conhecido a priori |
| Input | Texto, dados semi-estruturados, contexto clínico |
| Steps | Variáveis — agent decide o próximo step |
| Output | Síntese, recomendação, análise, draft |
| Raciocínio | Sim — julgamento contextual necessário |
| Custo LLM | Aceitável pelo valor gerado |
| Impacto clínico | Indireto, com revisão humana possível |

### Quando usar Multi-Agent

Multi-agent APENAS quando pelo menos 2 dos seguintes critérios forem atendidos:

| Critério | Justificativa |
|---|---|
| Especialização distinta | Dois domínios que um único agent confundiria |
| Paralelismo real | Tasks independentes executáveis simultaneamente com speedup > 2x |
| Separação de funções | Gerador + Crítico (checker) como função separada melhora qualidade |
| Validação cruzada | Resultado de um agent precisa ser validado por outro independente |
| Volume que justifica | Processing de 100+ itens onde paralelismo reduz latência total em 50%+ |

---

## Tabela Completa: Tarefa → Tipo → Executor → Motivo

### Serviços Clínicos

| Tarefa | Tipo | Executor Recomendado | Motivo |
|---|---|---|---|
| Orquestração de alta hospitalar | Workflow durável | **Temporal Workflow** | Multi-step (validação + notificação + documentação + confirmação), exige compensation se falhar no meio, auditabilidade legal |
| Roteamento de fluxo de paciente | Event-driven | **KEDA + Worker** | Event trigger por admissão/transferência, sem raciocínio necessário, rules-based com dados estruturados |
| Geração de resumo de alta | LLM Task | **Single Agent (discharge-summary-agent)** | Síntese de prontuário exige raciocínio contextual, output é texto clínico |
| Alerta clínico (sinais vitais fora do range) | Regra determinística | **CronJob + regra** | Threshold fixo, sem raciocínio, latência crítica — agent seria mais lento e menos confiável |
| Priorização de tarefas no inbox | Regra + LLM | **Workflow (Temporal) + LLM tool** | Regras de prioridade são fixas; LLM é usado apenas para categorizar texto livre |
| Validação de documentação de alta | Workflow + checklist | **Temporal Workflow** | Checklist de campos obrigatórios, validação determinística, sem raciocínio |
| Busca de informações em prontuário | Retrieval | **Tool Tier 0 (read-only)** | Query estruturada, sem raciocínio de agent necessário |
| Análise de risco de readmissão | Modelo + Agent | **Scheduled Job + Risk Model + Agent síntese** | Modelo ML calcula score; agent sintetiza justificativa para médico |

### Operações Clínicas

| Tarefa | Tipo | Executor Recomendado | Motivo |
|---|---|---|---|
| Report diário de ocupação | Aggregation | **CronJob (6h diário)** | Dados estruturados, SQL query, sem raciocínio |
| Digest executivo semanal | Síntese | **CronJob + Agent (síntese)** | Computação de métricas via SQL; narrativa exige LLM |
| Detecção de anomalias operacionais | Sentinel | **Continuous Sentinel (KEDA + Prometheus)** | Métricas, thresholds, alertas — sem raciocínio |
| Escalada de caso não resolvido | Workflow | **Temporal Workflow** | Steps fixos: detectar SLA breach → notificar supervisor → escalar → registrar |
| Planejamento de capacidade | Analytics + Agent | **Argo Workflow + Analysis Agent** | Computação pesada + síntese com recomendações |

### Business Intelligence e Mercado

| Tarefa | Tipo | Executor Recomendado | Motivo |
|---|---|---|---|
| Inteligência de mercado | Long-running Agent | **Batch Agent (semanal)** | Web research, análise de fontes heterogêneas, síntese — problema aberto |
| Análise de competidores | Long-running Agent | **Batch Agent** | Dados semi-estruturados, raciocínio estratégico necessário |
| Monitor de regulação | Sentinel + Agent | **CronJob (diário) + Agent (quando novo)** | Busca diária determinística; análise de impacto exige raciocínio |
| Pricing analysis | Analytics | **CronJob + SQL** | Dados estruturados, cálculo determinístico |

### Infraestrutura e Operações

| Tarefa | Tipo | Executor Recomendado | Motivo |
|---|---|---|---|
| Cost sweep | CronJob | **CronJob (diário 2h)** | Query de custo AWS, sem raciocínio, idempotente |
| Health summary horário | Aggregation | **CronJob (a cada hora)** | Métricas Prometheus, sem LLM |
| Architecture review semanal | Report + Agent | **CronJob + Agent (análise)** | Coleta de métricas determinística; insights exigem raciocínio |
| Node rightsizing | Analytics | **VPA + Goldilocks (sem agent)** | Problema de otimização com solução algorítmica |
| Incident root cause | Investigation | **Agent (incident-rca-agent)** | Análise de logs heterogêneos, correlação temporal, hipóteses — problema aberto |

---

## Exemplos Detalhados Velya

### Exemplo 1: Discharge Orchestration (Temporal Workflow)

**Por que Temporal e não Agent?**

A orquestração de alta tem um roteiro **fixo e auditável**:
1. Validar documentação completa
2. Confirmar medicamentos prescritos
3. Notificar equipe de enfermagem
4. Gerar carta de alta
5. Enviar ao paciente/familiar
6. Registrar no prontuário
7. Liberar leito

Cada step é determinístico. A "inteligência" está nos dados, não na decisão de qual step executar. Um agent que decidisse dinamicamente esses steps seria:
- Menos confiável (poderia pular steps)
- Mais caro (LLM para cada decisão)
- Menos auditável (sem histórico explícito de steps)

```python
# Temporal Workflow — discharge orchestration
@workflow.defn
class DischargeOrchestrationWorkflow:
    @workflow.run
    async def run(self, patient_id: str, discharge_data: DischargeData):
        # Step 1: Validar documentação
        validation_result = await workflow.execute_activity(
            validate_discharge_documentation,
            args=[patient_id, discharge_data],
            schedule_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3, backoff_coefficient=2.0)
        )
        
        if not validation_result.is_complete:
            # Compensation: notificar equipe e aguardar
            await workflow.execute_activity(
                notify_incomplete_discharge,
                args=[patient_id, validation_result.missing_fields],
                schedule_to_close_timeout=timedelta(hours=2)
            )
            raise ApplicationError("Documentação incompleta", validation_result.missing_fields)
        
        # Step 2: Verificar medicamentos
        await workflow.execute_activity(
            verify_discharge_medications,
            args=[patient_id],
            schedule_to_close_timeout=timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=5)
        )
        
        # Steps 3-7: paralelos onde possível
        await asyncio.gather(
            workflow.execute_activity(notify_nursing_team, args=[patient_id]),
            workflow.execute_activity(generate_discharge_letter, args=[patient_id, discharge_data])
        )
        
        await workflow.execute_activity(release_bed, args=[patient_id])
        
        return DischargeResult(status="completed", patient_id=patient_id)
```

### Exemplo 2: Patient Flow Routing (KEDA + Worker)

**Por que KEDA + Worker e não Agent?**

O roteamento de fluxo de paciente usa **regras fixas baseadas em dados estruturados**:
- Tipo de admissão → setor de destino
- Perfil do paciente → equipe responsável
- Disponibilidade de leito → alocação automática

Não há raciocínio contextual. Um agent aqui seria 100x mais lento e 1000x mais caro.

```yaml
# KEDA ScaledObject para patient-flow-workers
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: patient-flow-workers-scaler
  namespace: velya-dev-core
spec:
  scaleTargetRef:
    name: patient-flow-worker
  minReplicaCount: 2
  maxReplicaCount: 20
  pollingInterval: 15
  cooldownPeriod: 60
  triggers:
  - type: nats-jetstream
    metadata:
      natsServerMonitoringEndpoint: nats-monitoring.velya-dev-platform.svc:8222
      account: "$G"
      stream: velya.clinical.events
      consumer: patient-flow-routing-consumer
      lagThreshold: "50"
      activationLagThreshold: "10"
```

```typescript
// Patient Flow Worker — lógica determinística
async function processPatientEvent(event: ClinicalEvent): Promise<void> {
  const rules = await getRoutingRules(event.institutionId);
  
  const sector = rules.findSector(event.admissionType, event.patientProfile);
  const team = rules.findTeam(sector, event.patientProfile.specialties);
  const bed = await bedAllocationService.allocate(sector, event.priority);
  
  await patientFlowRepository.createAssignment({
    patientId: event.patientId,
    sector,
    team,
    bedId: bed.id,
    timestamp: new Date()
  });
  
  await notificationService.notifyTeam(team, event.patientId);
}
```

### Exemplo 3: Market Intelligence (Batch Agent)

**Por que Agent e não Workflow?**

A inteligência de mercado coleta informações de fontes heterogêneas e produz análise estratégica. O **caminho de investigação** não é conhecido a priori:
- Quais fontes buscar depende do que foi encontrado
- A relevância dos dados requer julgamento contextual
- A síntese exige raciocínio estratégico

```python
# Market Intelligence Agent
class MarketIntelligenceAgent:
    def __init__(self, tool_registry: ToolRegistry):
        self.tools = tool_registry
        self.model = "claude-opus-4"
        self.token_budget = 500_000  # budget por execução
    
    async def run(self, scope: IntelligenceScope) -> MarketReport:
        context = await self.build_context(scope)
        
        # Agent decide dinamicamente quais fontes explorar
        result = await self.llm.run_with_tools(
            system_prompt=MARKET_INTELLIGENCE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": context}],
            tools=[
                self.tools.web_search,      # Tier 0
                self.tools.news_api,        # Tier 0
                self.tools.competitor_db,   # Tier 0
                self.tools.regulation_search # Tier 0
            ],
            max_tokens=self.token_budget,
            stop_sequences=["<report_complete>"]
        )
        
        return MarketReport.parse(result)
```

### Exemplo 4: Cost Sweep (CronJob)

**Por que CronJob e não Agent?**

O cost sweep é pura computação determinística:
- Query de custos AWS Cost Explorer
- Comparar com budget configurado
- Gerar alerta se breach
- Salvar snapshot diário

Zero raciocínio necessário. Um agent aqui seria anti-padrão.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cost-sweep
  namespace: velya-dev-platform
spec:
  schedule: "0 2 * * *"  # 2h da manhã
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 1800  # 30 minutos max
      template:
        spec:
          priorityClassName: velya-batch
          restartPolicy: OnFailure
          serviceAccountName: cost-sweep-sa
          containers:
          - name: cost-sweep
            image: velya/cost-sweep:latest
            env:
            - name: AWS_REGION
              value: us-east-1
            - name: BUDGET_THRESHOLD_PERCENT
              value: "80"
            - name: SLACK_WEBHOOK
              valueFrom:
                secretKeyRef:
                  name: cost-sweep-secrets
                  key: slack-webhook
            resources:
              requests:
                cpu: 100m
                memory: 128Mi
              limits:
                cpu: 500m
                memory: 256Mi
```

### Exemplo 5: Report Generation (CronJob + Agent para Síntese)

**Por que híbrido?**

O report diário tem duas partes distintas:
1. **Computação de métricas**: SQL determinístico → CronJob
2. **Síntese narrativa**: transformar números em insight → Agent

```yaml
# CronJob orquestra o pipeline
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-report-generator
  namespace: velya-dev-platform
spec:
  schedule: "0 6 * * *"  # 6h da manhã
  jobTemplate:
    spec:
      template:
        spec:
          priorityClassName: velya-batch
          containers:
          - name: report-generator
            image: velya/report-generator:latest
            command: ["/bin/sh", "-c"]
            args:
            - |
              # Step 1: Computar métricas (determinístico)
              python compute_metrics.py --date yesterday --output /tmp/metrics.json
              
              # Step 2: Chamar agent de síntese (LLM)
              python synthesize_report.py \
                --metrics /tmp/metrics.json \
                --output /tmp/report.md \
                --model claude-haiku-3  # modelo mais barato para síntese
              
              # Step 3: Distribuir (determinístico)
              python distribute_report.py --report /tmp/report.md
```

### Exemplo 6: Clinical Alert (Regra Determinística — SEM Agent)

**Por que NUNCA usar Agent para alertas clínicos?**

Um alerta de sinais vitais fora do range **não pode depender de raciocínio LLM** porque:
1. LLM pode "raciocinar" que o valor está dentro do range por contexto clínico
2. Latência do LLM (1-5s) é inaceitável para alerta clínico (< 500ms)
3. Custo de tokens para cada leitura de vital é injustificável
4. Determinismo e auditabilidade são obrigatórios

```python
# CORRETO: Regra determinística pura
class ClinicalAlertRule:
    THRESHOLDS = {
        "heart_rate": {"min": 40, "max": 150},
        "systolic_bp": {"min": 70, "max": 200},
        "spo2": {"min": 90, "max": 100},
        "temperature_celsius": {"min": 35.0, "max": 40.5}
    }
    
    def evaluate(self, vital: VitalSign) -> Optional[ClinicalAlert]:
        threshold = self.THRESHOLDS.get(vital.type)
        if not threshold:
            return None
        
        if vital.value < threshold["min"] or vital.value > threshold["max"]:
            return ClinicalAlert(
                patient_id=vital.patient_id,
                alert_type=vital.type,
                value=vital.value,
                threshold=threshold,
                severity=self._calculate_severity(vital, threshold),
                timestamp=vital.timestamp
            )
        return None
```

---

## Regras de Não-Uso de Agent

### Regra 1: Não use Agent para decisões determinísticas

Se a decisão pode ser expressa como `if/else` ou lookup table, é uma regra — não um agent.

### Regra 2: Não use Agent onde latência < 1s é necessária

LLM tem latência de 1-10s dependendo do modelo e tokens. Para alertas clínicos, aprovação de admissão emergencial ou roteamento real-time, use lógica determinística.

### Regra 3: Não use Agent onde auditabilidade exige determinismo

Para compliance, processos onde o mesmo input deve sempre produzir o mesmo output são obrigatórios. LLMs não são determinísticos por natureza.

### Regra 4: Não use Multi-Agent onde Single Agent resolve

Multi-agent adiciona:
- Latência de comunicação entre agents
- Custo de tokens adicional (cada agent tem seu contexto)
- Complexidade de debugging
- Surface de falha ampliada

### Regra 5: Não use Agent para processos com impacto clínico direto sem humano no loop

```
Impacto Clínico Direto = qualquer ação que afeta:
  - Medicação do paciente
  - Decisão de alta ou internação
  - Procedimento médico
  - Dosagem ou via de administração
```

Nesses casos: Agent pode **recomendar**, humano **decide e confirma**.

---

## Métricas de Efetividade por Tipo de Executor

### Indicadores de Saúde de Workflows

| Métrica | Target | Alerta |
|---|---|---|
| Temporal workflow success rate | > 99% | < 95% |
| Workflow latência P50 | < SLA do processo | > 2x SLA |
| CronJob success rate | > 98% | < 90% |
| Retry rate por workflow | < 5% | > 20% |
| Compensation rate | < 1% | > 5% |

### Indicadores de Saúde de Agents

| Métrica | Target | Alerta |
|---|---|---|
| Agent task completion rate | > 95% | < 85% |
| Token consumption vs budget | < 80% | > 95% |
| Agent latência P95 | < SLA do caso de uso | > 3x SLA |
| Tool call error rate | < 2% | > 10% |
| Human escalation rate | < 5% | > 20% |
| Output quality score (human eval) | > 4.0/5.0 | < 3.0/5.0 |

---

## Árvore de Decisão para Adição de Novo Processo

```
Novo processo identificado
│
├─► Qual é o output esperado?
│   ├─ Dado processado / transformado → Provavelmente workflow/job
│   ├─ Decisão / recomendação → Provavelmente agent
│   └─ Alerta / notificação → Provavelmente regra
│
├─► Qual é a tolerância à latência?
│   ├─ < 500ms → Nunca agent, use regra ou cache
│   ├─ < 5s → Agent simples com modelo rápido (haiku)
│   └─ < 60s → Agent completo com modelo poderoso (sonnet/opus)
│
├─► Qual é a frequência de execução?
│   ├─ Por evento → KEDA trigger ou Temporal signal
│   ├─ Agendado → CronJob ou Temporal Schedule
│   └─ Contínuo → Deployment com loop ou sentinel
│
├─► Qual é o custo aceitável por execução?
│   ├─ $0 → Use regra determinística ou workflow
│   ├─ < $0.01 → Agent com modelo haiku
│   ├─ < $0.10 → Agent com modelo sonnet
│   └─ < $1.00 → Agent com modelo opus (justificar)
│
└─► O processo tem estado que precisa sobreviver a falhas?
    ├─ SIM → Temporal Workflow
    └─ NÃO → CronJob ou KEDA worker stateless
```

---

*Documento mantido pela equipe de Arquitetura Velya. Toda adição de novo processo automatizado deve seguir este modelo de decisão.*
