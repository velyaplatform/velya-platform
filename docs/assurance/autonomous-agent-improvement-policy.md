# Politica de Melhoria Autonoma de Agentes - Velya Platform

> Documento 19 da serie Layered Assurance + Self-Healing  
> Ultima atualizacao: 2026-04-08

---

## 1. Principio

Agentes autonomos na Velya Platform podem e devem melhorar continuamente. Porem, essa melhoria deve ser governada: transparente, rastreavel, revisavel e com blast radius controlado.

### Filosofia

```
Agentes PODEM:          Agentes NAO PODEM (sem gate forte):
- Aprender              - Alterar suas proprias permissoes
- Propor melhorias       - Expandir seu escopo
- Otimizar deteccao      - Modificar dados sensiveis
- Sugerir testes         - Executar acoes destrutivas novas
- Abrir PRs              - Auto-aprovar suas mudancas
```

---

## 2. O que Agentes PODEM Melhorar Autonomamente

### 2.1 Classificacao de Incidentes

**Permissao:** Autonomo com observacao

O agente pode refinar como classifica incidentes (severidade, categoria, subcategoria) baseado em feedback de PIRs e resolucoes anteriores.

```yaml
allowedImprovement:
  area: incident-classification
  autonomyLevel: autonomous-with-observation
  constraints:
    - 'Nao pode rebaixar severidade de P1 para P3+ sem humano'
    - 'Nao pode criar novas categorias, apenas refinar subcategorias'
    - 'Mudancas de classificacao sao logadas e auditadas'
  evidenceRequired:
    - 'Historico de 10+ classificacoes corretas para o novo criterio'
    - 'Taxa de acerto >= 95% em validacao cruzada'
  rollback: 'Reverter para tabela de classificacao anterior'
```

### 2.2 Roteamento e Handoff

**Permissao:** Autonomo com observacao

O agente pode otimizar para quem roteia alertas e incidentes baseado em disponibilidade, expertise e historico de resolucao.

```yaml
allowedImprovement:
  area: routing-handoff
  autonomyLevel: autonomous-with-observation
  constraints:
    - 'Nao pode remover pessoas da lista de plantao'
    - 'Nao pode rotear para fora da equipe responsavel'
    - 'Respeitar hierarquia de escalacao'
  evidenceRequired:
    - 'Melhoria mensuravel no tempo de resposta'
    - 'Sem aumento de escalacoes incorretas'
```

### 2.3 Criterios de Observacao

**Permissao:** Autonomo com observacao

O agente pode ajustar thresholds de monitoramento baseado em dados historicos (ex: ajustar threshold de error rate de 0.5% para 0.3% se o baseline real e 0.1%).

```yaml
allowedImprovement:
  area: observation-criteria
  autonomyLevel: autonomous-with-observation
  constraints:
    - 'Pode apenas tornar mais restritivo (reduzir thresholds)'
    - 'Nao pode relaxar thresholds sem aprovacao humana'
    - 'Mudancas limitadas a 20% por iteracao'
    - 'Cooldown de 7 dias entre ajustes do mesmo threshold'
  evidenceRequired:
    - 'Analise de baseline de 30 dias'
    - 'Simulacao mostrando impacto (falsos positivos/negativos)'
```

### 2.4 Proposicao de Novos Testes

**Permissao:** Propor via PR, humano aprova

O agente pode analisar incidentes e gaps de cobertura e propor novos testes.

```yaml
allowedImprovement:
  area: test-proposals
  autonomyLevel: propose-via-pr
  constraints:
    - 'Testes sao sempre adicionados, nunca removidos'
    - 'PR deve incluir justificativa (link para incidente/gap)'
    - 'Testes devem passar em CI antes de review'
  evidenceRequired:
    - 'Incidente ou gap que o teste teria prevenido'
    - 'Teste executavel e green em staging'
```

### 2.5 Proposicao de Novas Validacoes

**Permissao:** Propor via PR, humano aprova

O agente pode propor novas validacoes de deploy (AnalysisTemplates, gates, checks).

```yaml
allowedImprovement:
  area: validation-proposals
  autonomyLevel: propose-via-pr
  constraints:
    - 'Validacoes sao aditivas (nao remove existentes)'
    - 'Deve incluir dry-run em staging'
    - 'Nao pode aumentar tempo de deploy > 20%'
  evidenceRequired:
    - 'Cenario que a validacao teria detectado'
    - 'Resultado de dry-run em staging'
```

### 2.6 Proposicao de Policy Hardening

**Permissao:** Propor via PR, humano aprova

O agente pode propor endurecer policies (OPA/Gatekeeper, deploy gates, RBAC).

```yaml
allowedImprovement:
  area: policy-hardening
  autonomyLevel: propose-via-pr
  constraints:
    - 'Pode apenas restringir, nunca relaxar'
    - 'Deve incluir analise de impacto'
    - 'Rollback plan obrigatorio'
  evidenceRequired:
    - 'Incidente que policy mais restritiva teria prevenido'
    - 'Teste em staging mostrando que nao bloqueia operacoes legitimas'
```

### 2.7 Proposicao de Mudancas em Prompts/Skills/Playbooks

**Permissao:** Propor via PR, humano aprova

O agente pode propor melhorias em seus proprios prompts, skills e playbooks.

```yaml
allowedImprovement:
  area: prompt-skill-playbook
  autonomyLevel: propose-via-pr
  constraints:
    - 'Mudancas de prompt versionadas no Git'
    - 'Comparacao A/B com versao anterior obrigatoria'
    - 'Shadow test por 48h antes de ativacao'
  evidenceRequired:
    - 'Metricas de acuracia antes/depois em dataset de referencia'
    - 'Zero regressoes em cenarios conhecidos'
```

### 2.8 Abertura de PRs de Baixo/Medio Risco

**Permissao:** Autonomo para baixo risco, PR review para medio risco

```yaml
allowedImprovement:
  area: pr-creation
  autonomyLevel: autonomous-low-risk
  riskClassification:
    low:
      - "Atualizar documentacao"
      - "Adicionar testes"
      - "Corrigir typos em configs"
      - "Adicionar metricas/logs"
      - "Atualizar dashboards Grafana"
      maxFilesChanged: 5
      maxLinesChanged: 100
      autoMerge: false  # PR criado mas nunca auto-merged
    medium:
      - "Ajustar thresholds de alertas (mais restritivos)"
      - "Adicionar novo alerta"
      - "Atualizar AnalysisTemplate"
      - "Ajustar KEDA scaler (dentro de limites)"
      maxFilesChanged: 10
      maxLinesChanged: 300
      requiresReview: true
      minReviewers: 1
    high:
      - "Qualquer mudanca em RBAC"
      - "Qualquer mudanca em network policies"
      - "Qualquer mudanca em secrets config"
      - "Qualquer mudanca de schema de banco"
      blocked: true  # Agente NAO pode criar PRs de alto risco
```

---

## 3. O que Agentes NAO PODEM sem Gate Forte

### 3.1 Alterar Criterios Criticos de Seguranca

```yaml
blockedImprovement:
  area: security-criteria
  reason: 'Alteracao de criterios de seguranca pode expor dados de pacientes (LGPD/HIPAA)'
  examples:
    - 'Relaxar rate limiting'
    - 'Desabilitar autenticacao em qualquer endpoint'
    - 'Alterar politicas de TLS/mTLS'
    - 'Modificar regras de WAF'
    - 'Alterar politicas de auditoria'
  gateRequired:
    type: 'human-approval'
    approvers: ['security-team', 'cto']
    minApprovers: 2
    cooldown: '72h apos aprovacao para ativacao'
```

### 3.2 Expandir Permissoes

```yaml
blockedImprovement:
  area: permission-expansion
  reason: 'Expansao de permissoes viola principio de menor privilegio'
  examples:
    - 'Solicitar novo ClusterRole'
    - 'Adicionar namespaces ao escopo'
    - 'Solicitar acesso a secrets de outros servicos'
    - 'Solicitar acesso de escrita a recursos que so tem leitura'
  gateRequired:
    type: 'human-approval'
    approvers: ['platform-team', 'security-team']
    minApprovers: 2
    requiresJustification: true
    expirationPolicy: 'permissao expira em 30 dias, deve ser renovada'
```

### 3.3 Alterar Comportamento Destrutivo

```yaml
blockedImprovement:
  area: destructive-behavior
  reason: 'Acoes destrutivas podem causar perda de dados ou downtime'
  examples:
    - 'Adicionar capacidade de deletar pods/deployments/services'
    - 'Adicionar capacidade de modificar PVCs'
    - 'Adicionar capacidade de forcar rollback de servicos criticos'
    - 'Adicionar capacidade de modificar DNS/ingress'
    - 'Adicionar capacidade de escalar para 0 replicas'
  gateRequired:
    type: 'human-approval-plus-test'
    approvers: ['sre-lead', 'engineering-manager']
    minApprovers: 2
    testRequirement: 'simulacao completa em staging com blast radius assessment'
```

### 3.4 Alterar Dados Sensiveis

```yaml
blockedImprovement:
  area: sensitive-data
  reason: 'Dados de pacientes sao protegidos por LGPD e HIPAA'
  examples:
    - 'Acessar dados de pacientes para treinamento'
    - 'Logar PII/PHI para analise'
    - 'Exportar dados para servicos externos'
    - 'Modificar mascaramento de dados'
    - 'Alterar politicas de retencao'
  gateRequired:
    type: 'compliance-review'
    approvers: ['dpo', 'security-team', 'cto']
    minApprovers: 3
    requiresComplianceAssessment: true
```

### 3.5 Auto-Treinamento Opaco

```yaml
blockedImprovement:
  area: opaque-self-training
  reason: 'Treinamento nao rastreavel impede auditoria e pode introduzir bias'
  examples:
    - 'Usar dados de producao para fine-tuning'
    - 'Ajustar pesos/parametros internos sem versionamento'
    - 'Modificar comportamento sem diff rastreavel'
    - 'Aprender patterns sem dataset de validacao'
  gateRequired:
    type: 'transparency-review'
    requirements:
      - 'Todo treinamento deve ser reproduzivel'
      - 'Dataset de treinamento deve ser versionado'
      - 'Modelo antes/depois deve ser comparavel'
      - 'Metricas de qualidade devem ser publicas'
```

---

## 4. Governança de Melhoria

### Pipeline de Melhoria

```
[1. Proposta] ---> Agente identifica oportunidade de melhoria
     |
     v
[2. Evidencia] --> Agente coleta dados que justificam a melhoria
     |               - Incidentes prevenidos/nao prevenidos
     |               - Metricas de acuracia
     |               - Gaps identificados
     |
     v
[3. Classificacao] -> Classificar risco da melhoria
     |               - Baixo: doc, teste, metrica
     |               - Medio: alerta, threshold, validation
     |               - Alto: permissao, seguranca, dados
     |
     v
[4. Peer Review] --> Outro agente ou humano revisa
     |               - Consistencia com politicas
     |               - Blast radius assessment
     |               - Ausencia de regressao
     |
     v
[5. Shadow Test] --> Melhoria roda em shadow mode
     |               - Nao afeta producao
     |               - Compara resultado com versao atual
     |               - Minimo 48h para low, 7d para medium
     |
     v
[6. Aprovacao] ----> Aprovacao conforme nivel de risco
     |               - Low: auto-approve se shadow OK
     |               - Medium: 1 humano aprova
     |               - High: 2+ humanos aprovam
     |
     v
[7. Deploy] -------> Melhoria ativada em producao
     |               - Via PR merged (GitOps)
     |               - Com rollback plan
     |
     v
[8. Observacao] ---> Monitorar eficacia da melhoria
                     - 7 dias para low
                     - 14 dias para medium
                     - 30 dias para high
```

### Arvore de Decisao de Risco

```
Melhoria proposta pelo agente
    |
    v
[Altera seguranca, permissoes ou dados sensiveis?]
    |
    +-- SIM --> RISCO ALTO
    |           - Gate: 2+ humanos
    |           - Shadow: 30 dias
    |           - Compliance review obrigatorio
    |
    +-- NAO
        |
        v
    [Altera comportamento de producao?]
        |
        +-- SIM --> [Pode causar downtime ou perda de dados?]
        |               |
        |               +-- SIM --> RISCO ALTO
        |               |
        |               +-- NAO --> RISCO MEDIO
        |                           - Gate: 1 humano
        |                           - Shadow: 7 dias
        |
        +-- NAO --> RISCO BAIXO
                    - Gate: auto-approve se shadow OK
                    - Shadow: 48h
```

---

## 5. Exemplos com Claude Agent SDK

### 5.1 Proposta de Melhoria de Alerta

```typescript
import Anthropic from '@anthropic-ai/sdk';

interface ImprovementProposal {
  area: string;
  description: string;
  evidence: Evidence[];
  riskLevel: 'low' | 'medium' | 'high';
  implementation: Implementation;
}

interface Evidence {
  type: 'incident' | 'metric' | 'gap-analysis' | 'pattern';
  description: string;
  data: string;
  source: string;
}

interface Implementation {
  files: FileChange[];
  testPlan: string;
  rollbackPlan: string;
}

interface FileChange {
  path: string;
  content: string;
  changeType: 'create' | 'modify';
}

async function proposeAlertImprovement(
  client: Anthropic,
  context: {
    recentIncidents: any[];
    currentAlerts: any[];
    prometheusData: any;
  },
): Promise<ImprovementProposal> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `Voce e um agente SRE da Velya Platform (plataforma hospitalar).
Sua tarefa e analisar incidentes recentes e propor melhorias nos alertas.

Regras:
- Apenas ADICIONAR alertas ou tornar thresholds mais restritivos
- Nunca relaxar thresholds existentes
- Sempre incluir evidencia (link para incidente ou dados)
- Sempre incluir teste e rollback plan
- Formato de saida: JSON valido com schema ImprovementProposal`,
    messages: [
      {
        role: 'user',
        content: `Analise os seguintes incidentes recentes e alertas atuais.
Proponha melhorias nos alertas que teriam detectado esses incidentes mais cedo.

Incidentes recentes:
${JSON.stringify(context.recentIncidents, null, 2)}

Alertas atuais:
${JSON.stringify(context.currentAlerts, null, 2)}

Dados Prometheus (baseline):
${JSON.stringify(context.prometheusData, null, 2)}`,
      },
    ],
  });

  const proposal = JSON.parse(
    response.content[0].type === 'text' ? response.content[0].text : '',
  ) as ImprovementProposal;

  // Validar proposta contra politicas
  await validateProposal(proposal);

  return proposal;
}

async function validateProposal(proposal: ImprovementProposal): Promise<void> {
  // 1. Verificar que nao relaxa thresholds
  if (proposal.area === 'observation-criteria') {
    for (const file of proposal.implementation.files) {
      if (file.content.includes('threshold') && isRelaxation(file)) {
        throw new Error(
          'BLOQUEADO: Proposta relaxa threshold existente. ' +
            'Agentes so podem tornar thresholds mais restritivos.',
        );
      }
    }
  }

  // 2. Verificar risco
  if (proposal.riskLevel === 'high') {
    throw new Error(
      'BLOQUEADO: Proposta de alto risco requer aprovacao humana. ' +
        'Agente nao pode auto-aprovar.',
    );
  }

  // 3. Verificar evidencia
  if (proposal.evidence.length === 0) {
    throw new Error(
      'BLOQUEADO: Proposta sem evidencia. ' + 'Toda melhoria deve ter pelo menos 1 evidencia.',
    );
  }

  // 4. Verificar rollback plan
  if (!proposal.implementation.rollbackPlan) {
    throw new Error('BLOQUEADO: Proposta sem rollback plan.');
  }
}

function isRelaxation(file: FileChange): boolean {
  // Logica simplificada - em producao, compararia com versao atual
  // e verificaria se thresholds numericos aumentaram
  return false;
}
```

### 5.2 Criacao de PR Automatizada

```typescript
import Anthropic from '@anthropic-ai/sdk';

interface PRCreationContext {
  proposal: ImprovementProposal;
  repo: string;
  baseBranch: string;
}

async function createImprovementPR(client: Anthropic, context: PRCreationContext): Promise<string> {
  // 1. Classificar risco e verificar permissao
  const riskLevel = context.proposal.riskLevel;

  if (riskLevel === 'high') {
    console.log('BLOQUEADO: PR de alto risco. Escalar para humano.');
    await notifyHuman(context.proposal);
    return 'blocked:requires-human-approval';
  }

  // 2. Gerar branch name
  const branchName = `agent-improvement/${Date.now()}-${context.proposal.area}`;

  // 3. Usar Claude para gerar commit message e PR body
  const prMetadata = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `Gere titulo e descricao de PR para melhoria proposta por agente autonomo.
O PR deve ser claro sobre:
1. O que muda e por que
2. Evidencia que justifica a mudanca
3. Como testar
4. Como reverter
Formato: JSON com campos "title" (max 70 chars), "body" (markdown)`,
    messages: [
      {
        role: 'user',
        content: JSON.stringify(context.proposal),
      },
    ],
  });

  const metadata = JSON.parse(
    prMetadata.content[0].type === 'text' ? prMetadata.content[0].text : '',
  );

  // 4. Criar PR via GitHub API (usando tools do agente)
  const prBody = `${metadata.body}

---

**Metadata de Melhoria Autonoma:**
- Area: ${context.proposal.area}
- Risco: ${riskLevel}
- Evidencias: ${context.proposal.evidence.length}
- Proposto por: velya-agent
- Shadow test: ${riskLevel === 'low' ? '48h' : '7d'}

**Rollback:**
${context.proposal.implementation.rollbackPlan}

> Este PR foi gerado automaticamente por um agente autonomo da Velya Platform.
> Requer review humano antes de merge.`;

  // 5. Labels baseadas no risco
  const labels = ['agent-improvement', `risk:${riskLevel}`, context.proposal.area];
  if (riskLevel === 'medium') {
    labels.push('requires-review');
  }

  // 6. Registrar proposta para auditoria
  await logProposal({
    timestamp: new Date().toISOString(),
    agent: 'velya-sre-agent',
    proposal: context.proposal,
    prBranch: branchName,
    riskLevel,
    status: 'pr-created',
  });

  return `PR criado: ${branchName}`;
}

async function notifyHuman(proposal: ImprovementProposal): Promise<void> {
  // Notificar via Slack que melhoria de alto risco precisa de review
  console.log(`Notificando humano sobre proposta de alto risco: ${proposal.area}`);
}

async function logProposal(entry: any): Promise<void> {
  // Registrar no log de auditoria de melhorias autonomas
  console.log(`Auditoria: ${JSON.stringify(entry)}`);
}
```

### 5.3 Shadow Test de Melhoria

```typescript
import Anthropic from '@anthropic-ai/sdk';

interface ShadowTestConfig {
  proposal: ImprovementProposal;
  duration: string; // "48h" | "7d" | "30d"
  comparisonMetrics: string[];
}

interface ShadowTestResult {
  duration: string;
  startTime: string;
  endTime: string;
  currentVersion: MetricSnapshot;
  proposedVersion: MetricSnapshot;
  improvement: number; // percentual
  regressions: string[];
  verdict: 'approve' | 'reject' | 'needs-review';
}

interface MetricSnapshot {
  accuracy: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  latency: number;
  decisionsTotal: number;
}

async function runShadowTest(
  client: Anthropic,
  config: ShadowTestConfig,
): Promise<ShadowTestResult> {
  console.log(`Iniciando shadow test para: ${config.proposal.area}`);
  console.log(`Duracao: ${config.duration}`);

  // 1. Registrar inicio do shadow test
  const startTime = new Date().toISOString();

  // 2. Durante o shadow test, ambas as versoes processam os mesmos inputs
  // A versao proposta roda em modo shadow (sem afetar producao)
  // Resultados sao comparados

  // 3. Ao final, comparar metricas
  const currentMetrics: MetricSnapshot = await collectMetrics('current');
  const proposedMetrics: MetricSnapshot = await collectMetrics('proposed');

  // 4. Analisar resultados com Claude
  const analysis = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `Analise os resultados do shadow test de melhoria de agente.
Compare metricas da versao atual vs proposta.
Determine se a melhoria deve ser aprovada, rejeitada ou precisa de review humano.

Criterios de aprovacao automatica:
- Melhoria >= 5% em metrica primaria
- Zero regressoes em metricas criticas
- False positive rate nao aumentou
- False negative rate nao aumentou

Formato: JSON com campos "verdict", "reasoning", "regressions"`,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          proposal: config.proposal,
          currentMetrics,
          proposedMetrics,
        }),
      },
    ],
  });

  const verdict = JSON.parse(analysis.content[0].type === 'text' ? analysis.content[0].text : '');

  const result: ShadowTestResult = {
    duration: config.duration,
    startTime,
    endTime: new Date().toISOString(),
    currentVersion: currentMetrics,
    proposedVersion: proposedMetrics,
    improvement: calculateImprovement(currentMetrics, proposedMetrics),
    regressions: verdict.regressions || [],
    verdict: verdict.verdict,
  };

  // 5. Registrar resultado
  await logShadowTestResult(result);

  // 6. Se aprovado automaticamente (low risk), prosseguir
  if (result.verdict === 'approve' && config.proposal.riskLevel === 'low') {
    console.log('Shadow test aprovado. Prosseguindo com deploy.');
    // Merge PR automaticamente (se auto-approve permitido)
  } else if (result.verdict === 'reject') {
    console.log('Shadow test rejeitado. Proposta descartada.');
    // Fechar PR com comentario
  } else {
    console.log('Shadow test precisa de review humano.');
    // Notificar humano com resultados
  }

  return result;
}

async function collectMetrics(version: string): Promise<MetricSnapshot> {
  // Placeholder - em producao, coletaria do Prometheus
  return {
    accuracy: version === 'current' ? 0.95 : 0.97,
    falsePositiveRate: version === 'current' ? 0.03 : 0.02,
    falseNegativeRate: version === 'current' ? 0.02 : 0.01,
    latency: version === 'current' ? 150 : 145,
    decisionsTotal: 1000,
  };
}

function calculateImprovement(current: MetricSnapshot, proposed: MetricSnapshot): number {
  return ((proposed.accuracy - current.accuracy) / current.accuracy) * 100;
}

async function logShadowTestResult(result: ShadowTestResult): Promise<void> {
  console.log(`Shadow test result: ${JSON.stringify(result)}`);
}
```

---

## 6. Auditoria de Melhorias

### Registro de Auditoria

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-improvement-audit-schema
  namespace: velya-ops
data:
  schema.json: |
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "required": ["timestamp", "agentId", "area", "riskLevel", "action", "evidence"],
      "properties": {
        "timestamp": {"type": "string", "format": "date-time"},
        "agentId": {"type": "string"},
        "area": {
          "type": "string",
          "enum": [
            "incident-classification",
            "routing-handoff",
            "observation-criteria",
            "test-proposals",
            "validation-proposals",
            "policy-hardening",
            "prompt-skill-playbook",
            "pr-creation"
          ]
        },
        "riskLevel": {"type": "string", "enum": ["low", "medium", "high"]},
        "action": {
          "type": "string",
          "enum": ["propose", "shadow-start", "shadow-complete", "approve", "reject", "deploy", "rollback"]
        },
        "evidence": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": {"type": "string"},
              "description": {"type": "string"},
              "source": {"type": "string"}
            }
          },
          "minItems": 1
        },
        "outcome": {"type": "string"},
        "approvedBy": {"type": "string"},
        "prUrl": {"type": "string"},
        "shadowTestResult": {"type": "object"},
        "rollbackReason": {"type": "string"}
      }
    }
```

### CronJob de Auditoria de Melhorias

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: agent-improvement-audit
  namespace: velya-ops
spec:
  schedule: '0 9 * * 1' # toda segunda as 9h
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: improvement-auditor
          containers:
            - name: auditor
              image: velya/improvement-auditor:latest
              env:
                - name: PROMETHEUS_URL
                  value: 'http://prometheus.monitoring:9090'
                - name: GITHUB_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: github-tokens
                      key: audit-bot
                - name: SLACK_WEBHOOK
                  valueFrom:
                    secretKeyRef:
                      name: slack-webhooks
                      key: agent-governance
              command:
                - python3
                - -c
                - |
                  import requests
                  import json
                  import os

                  PROM = os.environ["PROMETHEUS_URL"]
                  SLACK = os.environ["SLACK_WEBHOOK"]

                  # 1. Melhorias propostas na ultima semana
                  r = requests.get(f"{PROM}/api/v1/query", params={
                      "query": 'sum by (area, risk_level) (increase(velya_agent_improvement_proposals_total[7d]))'
                  })
                  proposals = r.json()["data"]["result"]

                  # 2. Melhorias aprovadas vs rejeitadas
                  r = requests.get(f"{PROM}/api/v1/query", params={
                      "query": 'sum by (action) (increase(velya_agent_improvement_actions_total[7d]))'
                  })
                  actions = r.json()["data"]["result"]

                  # 3. Melhorias de alto risco tentadas
                  r = requests.get(f"{PROM}/api/v1/query", params={
                      "query": 'increase(velya_agent_improvement_proposals_total{risk_level="high"}[7d])'
                  })
                  high_risk = r.json()["data"]["result"]

                  # 4. Acoes bloqueadas
                  r = requests.get(f"{PROM}/api/v1/query", params={
                      "query": 'increase(velya_agent_blocked_actions_total[7d])'
                  })
                  blocked = r.json()["data"]["result"]

                  # 5. Eficacia de melhorias implementadas
                  r = requests.get(f"{PROM}/api/v1/query", params={
                      "query": 'velya_agent_improvement_effectiveness'
                  })
                  effectiveness = r.json()["data"]["result"]

                  report = (
                      f"*Auditoria Semanal de Melhorias Autonomas*\n\n"
                      f"*Propostas:* {sum(float(p['value'][1]) for p in proposals) if proposals else 0}\n"
                      f"*Aprovadas:* {next((float(a['value'][1]) for a in actions if a['metric'].get('action') == 'approve'), 0)}\n"
                      f"*Rejeitadas:* {next((float(a['value'][1]) for a in actions if a['metric'].get('action') == 'reject'), 0)}\n"
                      f"*Alto risco tentadas:* {sum(float(h['value'][1]) for h in high_risk) if high_risk else 0}\n"
                      f"*Acoes bloqueadas:* {sum(float(b['value'][1]) for b in blocked) if blocked else 0}\n"
                  )

                  if high_risk and any(float(h['value'][1]) > 0 for h in high_risk):
                      report += "\n:warning: *ATENCAO: Tentativas de melhoria de alto risco detectadas. Revisar logs.*\n"

                  requests.post(SLACK, json={"text": report})
          restartPolicy: OnFailure
```

---

## 7. Metricas de Governança

### Dashboard de Governança de Agentes

| Metrica                      | Query                                                   | Meta                                      |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| Propostas por semana         | `increase(velya_agent_improvement_proposals_total[7d])` | 3-10 (nem pouco nem demais)               |
| Taxa de aprovacao            | `approved / (approved + rejected)`                      | 60-90% (muito alto indica falta de rigor) |
| Acoes bloqueadas             | `velya_agent_blocked_actions_total`                     | 0 (agente respeita limites)               |
| Shadow test pass rate        | `shadow_passed / shadow_total`                          | >= 70%                                    |
| Eficacia pos-deploy          | `improvements_effective / improvements_deployed`        | >= 80%                                    |
| Rollbacks de melhorias       | `improvement_rollbacks_total`                           | < 5%                                      |
| Tempo medio proposta->deploy | `avg(deploy_time - proposal_time)`                      | < 7 dias para low                         |

### Alertas de Governança

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: agent-governance-alerts
  namespace: velya-ops
spec:
  groups:
    - name: agent-governance
      rules:
        - alert: AgentBlockedActionDetected
          expr: increase(velya_agent_blocked_actions_total[1h]) > 0
          for: 0m
          labels:
            severity: warning
            category: agent-governance
          annotations:
            summary: 'Agente tentou acao bloqueada'
            description: 'Acao bloqueada detectada. Verificar logs de auditoria.'

        - alert: AgentHighRiskProposal
          expr: increase(velya_agent_improvement_proposals_total{risk_level="high"}[1h]) > 0
          for: 0m
          labels:
            severity: warning
            category: agent-governance
          annotations:
            summary: 'Agente propôs melhoria de alto risco'
            description: 'Proposta de alto risco requer review humano imediato.'

        - alert: AgentImprovementLoopDetected
          expr: increase(velya_agent_improvement_proposals_total[1h]) > 10
          for: 5m
          labels:
            severity: warning
            category: agent-governance
          annotations:
            summary: 'Agente gerando propostas em excesso'
            description: 'Possivel loop de melhoria. Verificar e throttle se necessario.'

        - alert: AgentShadowTestFailing
          expr: |
            sum(increase(velya_agent_shadow_test_result{verdict="reject"}[7d]))
            / sum(increase(velya_agent_shadow_test_result[7d]))
            > 0.5
          for: 0m
          labels:
            severity: info
            category: agent-governance
          annotations:
            summary: 'Mais de 50% dos shadow tests falhando'
            description: 'Agente pode estar propondo melhorias de baixa qualidade.'
```

---

## 8. Kill Switch do Agente

### Mecanismo de Desativacao

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-kill-switch
  namespace: velya-ops
data:
  config.yaml: |
    # Kill switch para agentes autonomos
    # Alterando "enabled" para false desativa o agente imediatamente
    agents:
      sre-agent:
        enabled: true
        improvementsEnabled: true
        maxActionsPerHour: 20
        maxPRsPerDay: 5
        allowedRiskLevels: ["low", "medium"]

      incident-classifier:
        enabled: true
        improvementsEnabled: true
        maxActionsPerHour: 50
        maxPRsPerDay: 0
        allowedRiskLevels: ["low"]

      watchdog-agent:
        enabled: true
        improvementsEnabled: false
        maxActionsPerHour: 100
        maxPRsPerDay: 0
        allowedRiskLevels: []

    # Emergencia: desativa TODOS os agentes
    globalKillSwitch: false
```

### Como Ativar o Kill Switch

```bash
# Desativar agente especifico
kubectl patch configmap agent-kill-switch -n velya-ops \
  --type merge \
  -p '{"data":{"config.yaml":"agents:\n  sre-agent:\n    enabled: false"}}'

# Desativar TODOS os agentes (emergencia)
kubectl patch configmap agent-kill-switch -n velya-ops \
  --type merge \
  -p '{"data":{"config.yaml":"globalKillSwitch: true"}}'

# O agente verifica o kill switch a cada 30 segundos
# e encerra gracefully se desativado
```

---

## 9. Resumo de Permissoes

| Acao                                | Autonomo | PR (review humano) | Gate forte | Bloqueado |
| ----------------------------------- | -------- | ------------------ | ---------- | --------- |
| Refinar classificacao de incidentes | X        |                    |            |           |
| Otimizar roteamento                 | X        |                    |            |           |
| Tornar thresholds mais restritivos  | X        |                    |            |           |
| Propor novos testes                 |          | X                  |            |           |
| Propor novas validacoes             |          | X                  |            |           |
| Propor policy hardening             |          | X                  |            |           |
| Propor mudanca de prompts           |          | X                  |            |           |
| PR de baixo risco (doc, teste)      |          | X                  |            |           |
| PR de medio risco (alerta, config)  |          | X                  |            |           |
| Relaxar thresholds                  |          |                    | X          |           |
| Alterar RBAC/permissoes             |          |                    | X          |           |
| Alterar seguranca                   |          |                    | X          |           |
| Acessar dados sensiveis             |          |                    |            | X         |
| Auto-aprovar PRs                    |          |                    |            | X         |
| Expandir permissoes                 |          |                    |            | X         |
| Acoes destrutivas novas             |          |                    |            | X         |
| Auto-treinamento opaco              |          |                    |            | X         |

---

## 10. Revisao da Politica

Esta politica e revisada trimestralmente pela equipe de engenharia e segurança. Mudancas na politica requerem aprovacao do engineering manager e do security lead.

### Historico de Revisoes

| Data       | Versao | Mudanca        | Aprovado por |
| ---------- | ------ | -------------- | ------------ |
| 2026-04-08 | 1.0    | Versao inicial | -            |
