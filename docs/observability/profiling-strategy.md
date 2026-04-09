# Estratégia de Profiling Contínuo — Velya Platform

> Profiling contínuo permite ver o que o código está fazendo internamente, não apenas o que as métricas mostram externamente.
> É o sinal que responde "por quê" quando métricas mostram "o quê".
> Última atualização: 2026-04-08

---

## 1. Ferramenta: Grafana Pyroscope

**Grafana Pyroscope** é a solução de profiling contínuo escolhida para a Velya. É OSS, integra nativamente com Grafana, e suporta múltiplos tipos de profiling:

| Tipo de profiling   | O que mede                                  | Formato                       |
| ------------------- | ------------------------------------------- | ----------------------------- |
| CPU profiling       | Onde o processo passa tempo de CPU          | Flame graph de call stacks    |
| Heap profiling      | Quais objetos estão sendo alocados e quanto | Flame graph de alocações      |
| Goroutine profiling | Goroutines/threads em execução              | Lista de goroutines (para Go) |
| Mutex profiling     | Tempo esperando em locks                    | Flame graph de contention     |
| Block profiling     | Tempo bloqueado em I/O                      | Flame graph de blocking       |

**Estado atual**: Pyroscope não está instalado. Profiling não está disponível.

---

## 2. Quando Usar Profiling

O profiling tem overhead (< 2% CPU, mas não zero). Use de forma direcionada:

### 2.1 Investigações Reativas (acionar manualmente)

| Situação                                               | Tipo de profiling | Como acionar                                |
| ------------------------------------------------------ | ----------------- | ------------------------------------------- |
| P99 de latência elevado sem causa aparente em traces   | CPU profiling     | Ativar para o pod específico por 10 minutos |
| Memória crescendo continuamente sem estabilizar        | Heap profiling    | Ativar por 30 minutos e comparar snapshots  |
| Event loop lag > 50ms no Node.js (velya-web ou NestJS) | CPU profiling     | Ativar para o pod por 5 minutos             |
| CPU throttling detectado em container                  | CPU profiling     | Ativar para o pod por 15 minutos            |

### 2.2 Profiling Contínuo (habilitado permanentemente para serviços prioritários)

| Serviço              | Justificativa                                                    | Tipo de profiling | Sampling rate |
| -------------------- | ---------------------------------------------------------------- | ----------------- | ------------- |
| api-gateway          | Alto volume de tráfego, hotspot de CPU impacta todos os usuários | CPU               | 100 samples/s |
| ai-gateway           | Construção de contexto para prompts pode ter custo de CPU alto   | CPU + Heap        | 100 samples/s |
| patient-flow-service | Lógica de negócio complexa, queries potencialmente lentas        | CPU               | 50 samples/s  |

### 2.3 Quando NÃO usar profiling

- Não ativar profiling em todos os serviços simultaneamente (overhead acumulado)
- Não ativar heap profiling em produção por mais de 1 hora sem necessidade (pode afetar GC)
- Não usar profiling como substituto de traces (são complementares, não alternativos)

---

## 3. Correlação com Outros Sinais

A integração do Pyroscope com Grafana permite correlacionar flame graphs com outros sinais:

### 3.1 Spike de latência → Flame graph

1. Time Series de P99 mostra spike em 14:32
2. Clicar no ponto de spike no gráfico Grafana
3. Data Link abre Pyroscope com flame graph do mesmo período
4. Identificar: "function buildAIContext() consumia 60% do CPU durante o spike"

### 3.2 Spike de CPU → Flame graph

```promql
# Detectar spike de CPU
rate(container_cpu_usage_seconds_total{service="api-gateway"}[5m]) > 0.80
```

Ao receber alerta, abrir Pyroscope e buscar o mesmo serviço no período do alerta.

### 3.3 Memory leak → Heap profiling ao longo do tempo

```promql
# Detectar crescimento contínuo de memória (possível leak)
deriv(container_memory_usage_bytes{service="patient-flow-service"}[1h]) > 0
# Valor positivo e crescente por mais de 1h = suspeita de leak
```

Com Pyroscope, comparar heap snapshot do início da manhã com heap snapshot da tarde → identificar quais objetos estão crescendo.

### 3.4 Error de latência em trace → Flame graph no span lento

Quando Tempo (tracing) e Pyroscope estão ambos disponíveis:

1. Abrir trace com span lento (ex.: `buildAIContext` levou 8 segundos)
2. Clicar no span → Grafana mostra botão "Profile"
3. Abre flame graph do Pyroscope para o período exato do span
4. Identificar hotspot interno da função

---

## 4. Instrumentação NestJS com Pyroscope

### 4.1 Opção 1: SDK @pyroscope/nodejs (manual)

```bash
npm install @pyroscope/nodejs
```

```typescript
// src/profiling.ts — importar ANTES de qualquer outro módulo (como instrumentation.ts)
import Pyroscope from '@pyroscope/nodejs';

Pyroscope.init({
  serverAddress:
    process.env.PYROSCOPE_SERVER_ADDRESS || 'http://pyroscope.velya-dev-observability:4040',
  appName: process.env.SERVICE_NAME || 'velya-service',
  tags: {
    environment: process.env.NODE_ENV || 'dev',
    namespace: process.env.POD_NAMESPACE || 'velya-dev-core',
    version: process.env.SERVICE_VERSION || '0.0.0',
    office: process.env.VELYA_OFFICE || 'unknown',
  },
});

Pyroscope.start();

process.on('SIGTERM', () => {
  Pyroscope.stop();
});
```

```typescript
// src/main.ts
import './profiling'; // PRIMEIRA importação, antes de instrumentation
import './instrumentation';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// ...
```

### 4.2 Opção 2: eBPF com Grafana Beyla (sem instrumentação manual — preferido para produção)

**Grafana Beyla** usa eBPF para fazer profiling sem modificação de código. Vantagem: sem overhead de SDK, sem mudança de código nos serviços.

```yaml
# infra/observability/beyla/beyla-daemonset.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: beyla
  namespace: velya-dev-observability
spec:
  selector:
    matchLabels:
      app: beyla
  template:
    metadata:
      labels:
        app: beyla
    spec:
      hostPID: true # Necessário para eBPF
      serviceAccountName: beyla
      containers:
        - name: beyla
          image: grafana/beyla:1.4.0
          env:
            - name: BEYLA_OPEN_PORT
              value: '3000' # Porta dos serviços NestJS
            - name: BEYLA_OTEL_TRACES_ENDPOINT
              value: 'http://otel-collector.velya-dev-observability:4317'
            - name: BEYLA_PROMETHEUS_PORT
              value: '9090'
            - name: PYROSCOPE_SERVER_ADDRESS
              value: 'http://pyroscope.velya-dev-observability:4040'
          securityContext:
            privileged: true # Necessário para eBPF
          volumeMounts:
            - name: kernel
              mountPath: /sys/kernel
      volumes:
        - name: kernel
          hostPath:
            path: /sys/kernel
```

**Restrição**: Beyla requer kernel Linux >= 5.8 com eBPF habilitado. Verificar compatibilidade com o nó do kind-velya-local.

---

## 5. Instalação do Grafana Pyroscope

### 5.1 Instalar via Helm

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install pyroscope grafana/pyroscope \
  --namespace velya-dev-observability \
  --values infra/observability/pyroscope/pyroscope-values.yaml
```

### 5.2 Values file

```yaml
# infra/observability/pyroscope/pyroscope-values.yaml
pyroscope:
  replication:
    factor: 1 # Dev: sem replicação

  storage:
    backend: filesystem
    filesystem:
      dir: /data/pyroscope

  components:
    querier:
      replicas: 1
    distributor:
      replicas: 1
    ingester:
      replicas: 1

persistence:
  enabled: true
  size: 10Gi
  storageClass: standard

service:
  type: ClusterIP
  port: 4040

# Retenção de profiling data
compactor:
  retentionPeriod: 168h # 7 dias em dev

resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    memory: 512Mi
```

### 5.3 Configurar datasource no Grafana

```yaml
# Adicionar ao infra/observability/grafana/provisioning/datasources/velya-datasources.yaml
- name: Pyroscope
  type: grafana-pyroscope-datasource
  uid: pyroscope-velya
  url: http://pyroscope.velya-dev-observability:4040
  jsonData:
    keepCookies: []
  version: 1
  editable: false
```

---

## 6. Limitações e Guardrails de Custo

### 6.1 Overhead de CPU

| Método                         | Overhead de CPU | Overhead de memória     |
| ------------------------------ | --------------- | ----------------------- |
| `@pyroscope/nodejs` (sampling) | < 2%            | < 50 MB                 |
| Beyla (eBPF)                   | < 1%            | < 100 MB (no DaemonSet) |
| Profiling desabilitado         | 0%              | 0%                      |

**Monitorar o overhead**:

```promql
# Verificar que Pyroscope e Beyla não estão consumindo CPU demais
sum(rate(container_cpu_usage_seconds_total{container=~"pyroscope|beyla"}[5m])) /
sum(rate(container_cpu_usage_seconds_total[5m]))
# Meta: < 2% do total de CPU do cluster
```

### 6.2 Sampling Rate Recomendado

| Ambiente               | Sampling rate                            | Justificativa                   |
| ---------------------- | ---------------------------------------- | ------------------------------- |
| dev                    | 100 samples/s                            | Investigação ativa              |
| staging                | 50 samples/s                             | Balance entre dados e overhead  |
| prod                   | 100 samples/s para serviços prioritários | Dados de qualidade para análise |
| prod (outros serviços) | 0 (desabilitado)                         | Sem justificativa de custo      |

### 6.3 Retenção de Dados de Profiling

| Ambiente | Retenção | Storage estimado |
| -------- | -------- | ---------------- |
| dev      | 7 dias   | 2-5 GB           |
| staging  | 14 dias  | 5-10 GB          |
| prod     | 30 dias  | 20-50 GB         |

### 6.4 Alertas de Overhead

```yaml
alert: PyroscopeHighOverhead
expr: |
  sum(rate(container_cpu_usage_seconds_total{container="pyroscope"}[5m])) /
  sum(rate(container_cpu_usage_seconds_total{namespace=~"velya-dev-.+"}[5m])) > 0.03
for: 10m
labels:
  severity: medium
  domain: cost
annotations:
  summary: 'Pyroscope consumindo > 3% do CPU total dos serviços Velya'
  initial_action: 'Reduzir sampling rate ou desabilitar profiling em serviços não prioritários'
```

---

## 7. Roteiro de Implementação

### Fase 1 — Semana 1 (instalação)

1. Verificar que kernel do nó kind suporta eBPF:

   ```bash
   kubectl get nodes -o json | jq '.items[].status.nodeInfo.kernelVersion'
   # Precisa ser >= 5.8
   ```

2. Instalar Pyroscope via Helm em velya-dev-observability

3. Configurar datasource no Grafana (YAML de provisioning)

4. Verificar que Pyroscope UI está acessível:
   ```bash
   kubectl port-forward svc/pyroscope -n velya-dev-observability 4040:4040
   # Acessar http://localhost:4040
   ```

### Fase 2 — Semana 2 (instrumentação)

5. Adicionar `@pyroscope/nodejs` ao api-gateway:
   - Criar `src/profiling.ts`
   - Importar em `main.ts` como primeira importação
   - Deploy e verificar que profiles aparecem no Pyroscope UI

6. Adicionar ao ai-gateway com tags de modelo e agent:
   ```typescript
   Pyroscope.init({
     appName: 'ai-gateway',
     tags: {
       environment: process.env.NODE_ENV,
       namespace: process.env.POD_NAMESPACE,
     },
   });
   ```

### Fase 3 — Semana 3 (integração com Grafana)

7. Criar painel de Flame Graph no dashboard velya-backend-ai-gateway-performance

8. Configurar Data Links: spike de CPU → Pyroscope do mesmo período

9. Criar alerta de overhead de Pyroscope

10. Documentar casos de uso reais e treinamento do time

---

## 8. Casos de Uso Documentados para a Velya

### Caso 1: ai-gateway lento durante pico de uso

**Hipótese**: A construção do contexto para prompts (busca em memory-service + montagem do prompt) está consumindo CPU excessivo.

**Como investigar com Pyroscope**:

1. Identificar horário do pico no Time Series de latência do ai-gateway
2. Abrir Pyroscope → selecionar `ai-gateway` → período do pico
3. Analisar flame graph: procurar funções de serialização/deserialização ou busca em grafos

### Caso 2: patient-flow-service com memory leak

**Hipótese**: Um cache in-memory não está sendo invalidado corretamente.

**Como investigar com Pyroscope**:

1. Abrir Explore no Grafana → Pyroscope datasource
2. Selecionar `patient-flow-service` → tipo: `memory`
3. Usar diff view: comparar snapshot das 8h com snapshot das 18h do mesmo dia
4. Identificar quais objetos cresceram no período

### Caso 3: api-gateway com event loop lag

**Hipótese**: Alguma operação síncrona está bloqueando o event loop do Node.js.

```promql
# Detectar lag de event loop
nodejs_eventloop_lag_seconds{service="api-gateway"} > 0.05
```

**Como investigar**:

1. Ativar profiling temporariamente: `kubectl exec -n velya-dev-platform deploy/api-gateway -- kill -USR1 1`
   (acionar dump de CPU profiling via signal, se implementado)
2. Abrir flame graph → procurar operações síncronas longas no event loop
