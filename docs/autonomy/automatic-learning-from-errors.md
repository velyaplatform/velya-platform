# Pipeline de Aprendizado Automatico a Partir de Erros

> **Principio**: Todo erro e uma oportunidade de aprendizado. O sistema deve
> automaticamente extrair conhecimento de cada falha e usar esse conhecimento
> para prevenir recorrencias.

## Visao Geral

O pipeline de aprendizado transforma cada erro detectado em uma cadeia de
melhorias automaticas: guardrails, testes, alertas e documentacao.

```
Erro detectado
  |
  v
+--------------------+
| 1. FINGERPRINT     |  Hash unico do erro (tipo + contexto + componente)
+--------------------+
  |
  v
+--------------------+
| 2. CONTEXTO        |  Logs, metricas, traces, estado, deploy recente?
+--------------------+
  |
  v
+--------------------+
| 3. FREQUENCIA      |  Primeira vez? Recorrente? Regressao?
+--------------------+
  |
  v
+--------------------+
| 4. IMPACTO         |  Usuarios afetados, servicos, dados, SLA
+--------------------+
  |
  v
+--------------------+
| 5. CAUSA           |  Root cause (automatico ou assistido)
+--------------------+
  |
  v
+--------------------+
| 6. REMEDIACAO      |  O que foi feito para resolver
+--------------------+
  |
  v
+--------------------+
| 7. EFICACIA        |  A remediacao funcionou? Quanto tempo?
+--------------------+
  |
  v
+--------------------+
| 8. REGRESSAO?      |  Esse erro ja aconteceu antes?
+--------------------+
  |
  v
+--------------------+
| 9. GUARDRAIL       |  Que guardrail teria prevenido?
+--------------------+
  |
  v
+--------------------+
| 10. TESTE          |  Que teste teria detectado antes?
+--------------------+
  |
  v
+--------------------+
| 11. ALERTA         |  Que alerta deveria existir?
+--------------------+
  |
  v
+--------------------+
| 12. DOC ATUALIZADA |  Que documentacao precisa ser atualizada?
+--------------------+
```

---

## Perguntas Automaticas

O pipeline faz automaticamente as seguintes perguntas para cada erro:

### Pergunta 1: "Ja aconteceu antes?"

```typescript
interface RecurrenceCheck {
  errorFingerprint: string;
  lookbackPeriod: string;  // "30d", "90d", "365d"
  result: {
    firstOccurrence: Date;
    totalOccurrences: number;
    lastOccurrence: Date;
    trend: 'increasing' | 'stable' | 'decreasing' | 'first-time';
    relatedErrors: string[];  // Fingerprints similares
  };
}

async function checkRecurrence(fingerprint: string): Promise<RecurrenceCheck> {
  const history = await errorStore.findByFingerprint(fingerprint, '365d');

  if (history.length === 0) {
    return {
      errorFingerprint: fingerprint,
      lookbackPeriod: '365d',
      result: {
        firstOccurrence: new Date(),
        totalOccurrences: 1,
        lastOccurrence: new Date(),
        trend: 'first-time',
        relatedErrors: await findSimilarErrors(fingerprint),
      },
    };
  }

  const occurrencesLast30d = history.filter(
    e => Date.now() - e.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000
  ).length;
  const occurrencesPrevious30d = history.filter(
    e => {
      const age = Date.now() - e.timestamp.getTime();
      return age >= 30 * 24 * 60 * 60 * 1000 && age < 60 * 24 * 60 * 60 * 1000;
    }
  ).length;

  return {
    errorFingerprint: fingerprint,
    lookbackPeriod: '365d',
    result: {
      firstOccurrence: history[history.length - 1].timestamp,
      totalOccurrences: history.length + 1,
      lastOccurrence: history[0].timestamp,
      trend: occurrencesLast30d > occurrencesPrevious30d ? 'increasing' : 
             occurrencesLast30d < occurrencesPrevious30d ? 'decreasing' : 'stable',
      relatedErrors: await findSimilarErrors(fingerprint),
    },
  };
}
```

### Pergunta 2: "Por que voltou?"

```typescript
interface RegressionAnalysis {
  errorFingerprint: string;
  isRegression: boolean;
  previousFix?: {
    date: Date;
    description: string;
    guardrails: string[];
    tests: string[];
  };
  regressionCause?: string;
  gaps: {
    missingGuardrail: boolean;
    missingTest: boolean;
    missingAlert: boolean;
    missingDoc: boolean;
    fixIncomplete: boolean;
  };
}

async function analyzeRegression(fingerprint: string): Promise<RegressionAnalysis> {
  const previousFixes = await errorStore.findFixesByFingerprint(fingerprint);

  if (previousFixes.length === 0) {
    return { errorFingerprint: fingerprint, isRegression: false, gaps: {
      missingGuardrail: false, missingTest: false, missingAlert: false,
      missingDoc: false, fixIncomplete: false,
    }};
  }

  const lastFix = previousFixes[0];

  // Verificar o que faltou
  const guardrailExists = await checkGuardrailExists(fingerprint);
  const testExists = await checkTestExists(fingerprint);
  const alertExists = await checkAlertExists(fingerprint);
  const docUpdated = await checkDocUpdated(fingerprint, lastFix.date);

  return {
    errorFingerprint: fingerprint,
    isRegression: true,
    previousFix: lastFix,
    regressionCause: determineRegressionCause(lastFix, {
      guardrailExists, testExists, alertExists, docUpdated,
    }),
    gaps: {
      missingGuardrail: !guardrailExists,
      missingTest: !testExists,
      missingAlert: !alertExists,
      missingDoc: !docUpdated,
      fixIncomplete: !guardrailExists || !testExists,
    },
  };
}
```

### Pergunta 3: "Faltou teste, guardrail ou observabilidade?"

```typescript
interface GapAnalysis {
  errorFingerprint: string;
  gaps: Gap[];
  suggestions: Suggestion[];
}

interface Gap {
  type: 'test' | 'guardrail' | 'alert' | 'observability' | 'doc' | 'process';
  description: string;
  severity: 'high' | 'medium' | 'low';
  estimatedEffort: 'small' | 'medium' | 'large';
}

interface Suggestion {
  type: 'add-test' | 'add-guardrail' | 'add-alert' | 'add-metric' | 'update-doc' | 'add-validation';
  description: string;
  priority: number;
  autoImplementable: boolean;
  template?: string;
}

async function analyzeGaps(error: ErrorRecord): Promise<GapAnalysis> {
  const gaps: Gap[] = [];
  const suggestions: Suggestion[] = [];

  // Verificar se existe teste para este cenario
  const relatedTests = await findRelatedTests(error.component, error.type);
  if (relatedTests.length === 0) {
    gaps.push({
      type: 'test',
      description: `Nenhum teste cobre o cenario: ${error.type} em ${error.component}`,
      severity: 'high',
      estimatedEffort: 'medium',
    });
    suggestions.push({
      type: 'add-test',
      description: `Adicionar teste para ${error.type} em ${error.component}`,
      priority: 1,
      autoImplementable: true,
      template: generateTestTemplate(error),
    });
  }

  // Verificar se existe guardrail
  const relatedGuardrails = await findRelatedGuardrails(error.component, error.type);
  if (relatedGuardrails.length === 0) {
    gaps.push({
      type: 'guardrail',
      description: `Nenhum guardrail previne: ${error.type} em ${error.component}`,
      severity: 'high',
      estimatedEffort: 'small',
    });
    suggestions.push({
      type: 'add-guardrail',
      description: `Adicionar guardrail para prevenir ${error.type}`,
      priority: 1,
      autoImplementable: true,
      template: generateGuardrailTemplate(error),
    });
  }

  // Verificar se existe alerta adequado
  const relatedAlerts = await findRelatedAlerts(error.component, error.type);
  if (relatedAlerts.length === 0) {
    gaps.push({
      type: 'alert',
      description: `Nenhum alerta detecta: ${error.type} em ${error.component}`,
      severity: 'medium',
      estimatedEffort: 'small',
    });
    suggestions.push({
      type: 'add-alert',
      description: `Adicionar alerta para ${error.type} em ${error.component}`,
      priority: 2,
      autoImplementable: true,
      template: generateAlertTemplate(error),
    });
  }

  // Verificar observabilidade
  const hasMetrics = await checkMetricsCoverage(error.component);
  if (!hasMetrics) {
    gaps.push({
      type: 'observability',
      description: `Metricas insuficientes para ${error.component}`,
      severity: 'medium',
      estimatedEffort: 'medium',
    });
    suggestions.push({
      type: 'add-metric',
      description: `Adicionar metricas para ${error.component}`,
      priority: 3,
      autoImplementable: false,
    });
  }

  return { errorFingerprint: error.fingerprint, gaps, suggestions };
}
```

---

## Fingerprint de Erro

O fingerprint e um hash unico que identifica um erro especifico,
permitindo rastreamento de recorrencias e regressoes.

```typescript
interface ErrorFingerprint {
  hash: string;
  components: {
    errorType: string;      // TypeError, ConnectionError, TimeoutError, etc.
    component: string;       // velya-api, velya-auth, etc.
    location: string;        // arquivo:linha ou endpoint
    message: string;         // Mensagem normalizada (sem dados variaveis)
  };
}

function generateFingerprint(error: RawError): ErrorFingerprint {
  // Normalizar mensagem removendo dados variaveis
  const normalizedMessage = error.message
    .replace(/\b[0-9a-f]{8,}\b/g, '<ID>')       // UUIDs, hashes
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<IP>')  // IPs
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\b/g, '<TIMESTAMP>')  // Timestamps
    .replace(/\b\d+ms\b/g, '<DURATION>')          // Duracoes
    .replace(/port \d+/g, 'port <PORT>')          // Portas
    .replace(/"[^"]{40,}"/g, '"<LONG_STRING>"');   // Strings longas

  const components = {
    errorType: error.type,
    component: error.service,
    location: error.stack?.split('\n')[1]?.trim() ?? 'unknown',
    message: normalizedMessage,
  };

  const hash = sha256(JSON.stringify(components));

  return { hash, components };
}
```

---

## Contexto Capturado

Para cada erro, o pipeline captura automaticamente o contexto completo.

```typescript
interface ErrorContext {
  fingerprint: string;
  timestamp: Date;

  // Informacoes do erro
  error: {
    type: string;
    message: string;
    stack?: string;
    code?: string;
  };

  // Ambiente
  environment: {
    service: string;
    version: string;
    namespace: string;
    pod: string;
    node: string;
    lastDeploy?: Date;
    timeSinceDeploy?: string;
  };

  // Metricas no momento
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    requestRate: number;
    errorRate: number;
    latencyP99: number;
    queueDepth?: number;
    connectionPoolUsage?: number;
  };

  // Logs relacionados
  relatedLogs: {
    before: LogEntry[];   // 50 linhas antes
    after: LogEntry[];    // 20 linhas depois
    errors: LogEntry[];   // Outros erros no mesmo periodo
  };

  // Traces
  traces?: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    duration: number;
    spans: SpanSummary[];
  };

  // Deploy recente?
  recentDeploy?: {
    version: string;
    deployedAt: Date;
    changes: string[];
    deployer: string;
  };

  // Incidentes relacionados
  relatedIncidents: {
    fingerprint: string;
    timestamp: Date;
    resolution?: string;
  }[];
}
```

---

## Analise de Impacto

```typescript
interface ImpactAnalysis {
  fingerprint: string;
  impact: {
    usersAffected: number | 'unknown';
    servicesAffected: string[];
    dataIntegrity: 'intact' | 'potentially-compromised' | 'confirmed-compromised';
    slaImpact: boolean;
    revenueImpact: 'none' | 'low' | 'medium' | 'high';
    complianceImpact: boolean;
    duration: number;  // ms desde deteccao
    blast_radius: 'single-pod' | 'single-service' | 'multiple-services' | 'platform-wide';
  };
  classification: {
    severity: 'P1' | 'P2' | 'P3' | 'P4';
    urgency: 'immediate' | 'next-hour' | 'next-day' | 'backlog';
    category: 'availability' | 'performance' | 'data-integrity' | 'security' | 'compliance';
  };
}

function classifyImpact(context: ErrorContext): ImpactAnalysis {
  let severity: 'P1' | 'P2' | 'P3' | 'P4' = 'P4';
  let urgency: 'immediate' | 'next-hour' | 'next-day' | 'backlog' = 'backlog';

  // P1: Servico critico completamente indisponivel
  if (context.metrics.errorRate > 50) {
    severity = 'P1';
    urgency = 'immediate';
  }
  // P2: Degradacao significativa
  else if (context.metrics.errorRate > 10 || context.metrics.latencyP99 > 5000) {
    severity = 'P2';
    urgency = 'next-hour';
  }
  // P3: Problema notavel mas servico funcional
  else if (context.metrics.errorRate > 1 || context.metrics.latencyP99 > 2000) {
    severity = 'P3';
    urgency = 'next-day';
  }

  return {
    fingerprint: context.fingerprint,
    impact: {
      usersAffected: estimateAffectedUsers(context),
      servicesAffected: findAffectedServices(context),
      dataIntegrity: assessDataIntegrity(context),
      slaImpact: severity === 'P1' || severity === 'P2',
      revenueImpact: severity === 'P1' ? 'high' : severity === 'P2' ? 'medium' : 'none',
      complianceImpact: isComplianceRelated(context),
      duration: Date.now() - context.timestamp.getTime(),
      blast_radius: determinaBlastRadius(context),
    },
    classification: { severity, urgency, category: categorizeError(context) },
  };
}
```

---

## Sugestoes Automaticas

### Template de Guardrail Sugerido

```typescript
function generateGuardrailTemplate(error: ErrorRecord): string {
  if (error.type === 'ConnectionError') {
    return `
# Guardrail: Circuit Breaker para ${error.component}
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ${error.component}-connection-guardrail
spec:
  groups:
    - name: ${error.component}-connection
      rules:
        - alert: ${toPascalCase(error.component)}ConnectionFailure
          expr: |
            rate(${error.component.replace(/-/g, '_')}_connection_errors_total[2m]) > 0.1
          for: 1m
          labels:
            severity: warning
          annotations:
            summary: "${error.component} com falhas de conexao"
`;
  }

  if (error.type === 'TimeoutError') {
    return `
# Guardrail: Timeout Alert para ${error.component}
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ${error.component}-timeout-guardrail
spec:
  groups:
    - name: ${error.component}-timeout
      rules:
        - alert: ${toPascalCase(error.component)}HighLatency
          expr: |
            histogram_quantile(0.99, rate(${error.component.replace(/-/g, '_')}_request_duration_seconds_bucket[5m])) > 2
          for: 2m
          labels:
            severity: warning
`;
  }

  return `# Guardrail generico para ${error.type} em ${error.component}`;
}
```

### Template de Teste Sugerido

```typescript
function generateTestTemplate(error: ErrorRecord): string {
  return `
// Test: Prevenir regressao de ${error.type} em ${error.component}
// Gerado automaticamente pelo learning pipeline
// Fingerprint: ${error.fingerprint}
// Data: ${new Date().toISOString()}

describe('${error.component} - ${error.type} prevention', () => {
  it('should handle ${error.type} gracefully', async () => {
    // Simular condicao que causou o erro
    const mockCondition = createMockFor('${error.type}');
    
    // Verificar que o sistema lida gracefully
    const result = await ${error.component}.handleRequest(mockCondition);
    
    expect(result.status).not.toBe(500);
    expect(result.error).toBeUndefined();
    expect(result.degradedMode).toBe(true); // Se aplicavel
  });

  it('should alert on ${error.type}', async () => {
    const alerts = await getActiveAlerts();
    const relevant = alerts.filter(a => a.labels.alertname.includes('${error.component}'));
    expect(relevant.length).toBeGreaterThan(0);
  });
});
`;
}
```

---

## Eficacia da Remediacao

```typescript
interface RemediationEfficacy {
  fingerprint: string;
  remediationId: string;
  applied: Date;
  measurements: {
    recurrenceWithin24h: boolean;
    recurrenceWithin7d: boolean;
    recurrenceWithin30d: boolean;
    timeToDetect: number;       // ms
    timeToRemediate: number;    // ms
    timeToRecover: number;      // ms
    userImpactDuration: number; // ms
    autoRemediated: boolean;
    manualIntervention: boolean;
  };
  effectiveness: 'highly-effective' | 'effective' | 'partially-effective' | 'ineffective';
  followUp: {
    guardrailAdded: boolean;
    testAdded: boolean;
    alertAdded: boolean;
    docUpdated: boolean;
  };
}

async function measureEfficacy(
  fingerprint: string,
  remediationId: string,
): Promise<RemediationEfficacy> {
  const remediation = await getRemediation(remediationId);
  const recurrences = await findRecurrences(fingerprint, remediation.completedAt);

  const within24h = recurrences.filter(
    r => r.timestamp.getTime() - remediation.completedAt.getTime() < 24 * 60 * 60 * 1000
  );
  const within7d = recurrences.filter(
    r => r.timestamp.getTime() - remediation.completedAt.getTime() < 7 * 24 * 60 * 60 * 1000
  );
  const within30d = recurrences.filter(
    r => r.timestamp.getTime() - remediation.completedAt.getTime() < 30 * 24 * 60 * 60 * 1000
  );

  let effectiveness: RemediationEfficacy['effectiveness'];
  if (within24h.length === 0 && within7d.length === 0 && within30d.length === 0) {
    effectiveness = 'highly-effective';
  } else if (within24h.length === 0 && within7d.length === 0) {
    effectiveness = 'effective';
  } else if (within24h.length === 0) {
    effectiveness = 'partially-effective';
  } else {
    effectiveness = 'ineffective';
  }

  return {
    fingerprint,
    remediationId,
    applied: remediation.completedAt,
    measurements: {
      recurrenceWithin24h: within24h.length > 0,
      recurrenceWithin7d: within7d.length > 0,
      recurrenceWithin30d: within30d.length > 0,
      timeToDetect: remediation.detectionTime,
      timeToRemediate: remediation.remediationTime,
      timeToRecover: remediation.recoveryTime,
      userImpactDuration: remediation.userImpactDuration,
      autoRemediated: remediation.autoRemediated,
      manualIntervention: remediation.manualIntervention,
    },
    effectiveness,
    followUp: {
      guardrailAdded: await checkGuardrailExists(fingerprint),
      testAdded: await checkTestExists(fingerprint),
      alertAdded: await checkAlertExists(fingerprint),
      docUpdated: await checkDocUpdated(fingerprint, remediation.completedAt),
    },
  };
}
```

---

## Metricas do Learning Pipeline

```yaml
metrics:
  - name: velya_learning_errors_processed_total
    type: counter
    help: "Total de erros processados pelo pipeline"

  - name: velya_learning_recurrences_detected_total
    type: counter
    help: "Total de recorrencias detectadas"

  - name: velya_learning_regressions_detected_total
    type: counter
    help: "Total de regressoes detectadas"

  - name: velya_learning_guardrails_suggested_total
    type: counter
    help: "Total de guardrails sugeridos"

  - name: velya_learning_guardrails_implemented_total
    type: counter
    help: "Total de guardrails implementados"

  - name: velya_learning_tests_suggested_total
    type: counter
    help: "Total de testes sugeridos"

  - name: velya_learning_tests_implemented_total
    type: counter
    help: "Total de testes implementados"

  - name: velya_learning_remediation_effectiveness
    type: histogram
    help: "Distribuicao de eficacia de remediacoes"
    buckets: [0, 0.25, 0.5, 0.75, 1.0]

  - name: velya_learning_mean_time_to_learn_seconds
    type: histogram
    help: "Tempo entre erro e aprendizado registrado"

  - name: velya_learning_gaps_open
    type: gauge
    labels: [type]
    help: "Gaps abertos por tipo (test, guardrail, alert, doc)"
```

---

## CronJob: Learning Pipeline

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: learning-pipeline
  namespace: velya-autonomy
  labels:
    velya.io/pipeline: learning
    velya.io/tier: autonomy
spec:
  schedule: "*/5 * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 240
      template:
        spec:
          serviceAccountName: autonomy-runner
          containers:
            - name: learning-pipeline
              image: velya/autonomy-agent:latest
              command: ["node", "dist/pipelines/learning.js"]
              env:
                - name: ERROR_STORE_URL
                  value: "postgres://velya-errors.velya-system.svc.cluster.local:5432/errors"
                - name: PROMETHEUS_URL
                  value: "http://prometheus.velya-monitoring.svc.cluster.local:9090"
                - name: LOOKBACK_PERIOD
                  value: "5m"
              resources:
                requests:
                  cpu: 200m
                  memory: 256Mi
                limits:
                  cpu: 500m
                  memory: 512Mi
          restartPolicy: OnFailure
```
