# Cenários de Teste de Hyperscalabilidade — Velya

**Versão:** 1.0  
**Domínio:** Validação de Escalabilidade  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Mandato

> **Nenhum mecanismo de autoscaling é confiável sem ter sido testado sob carga real. Estes cenários são executados antes de qualquer mudança em HPA, KEDA, NodePool ou VPA em staging/prod.**

---

## Pré-requisitos Gerais

```bash
# Ferramentas necessárias
which k6 || echo "Instalar: brew install k6"
which hey || echo "Instalar: brew install hey"
which nats || echo "Instalar: brew install nats-io/nats-tools/nats"

# Variáveis de ambiente para os testes
export VELYA_API_URL=http://localhost:8080   # kind-velya-local via port-forward
export NATS_URL=nats://localhost:4222        # NATS via port-forward
export PROMETHEUS_URL=http://localhost:9090   # Prometheus via port-forward
export TEMPORAL_URL=http://localhost:8088    # Temporal UI via port-forward

# Abrir port-forwards necessários
kubectl port-forward -n velya-dev-core service/api-gateway 8080:80 &
kubectl port-forward -n velya-dev-platform service/nats 4222:4222 &
kubectl port-forward -n velya-dev-observability service/prometheus-operated 9090:9090 &
kubectl port-forward -n velya-dev-platform service/temporal-ui 8088:8080 &
```

---

## Cenário 1: Burst Repentino de Tráfego HTTP

**Nome:** HTTP Traffic Burst — api-gateway  
**Objetivo:** Validar que HPA escala api-gateway durante burst e mantém SLO de latência

**Pré-condições:**
- api-gateway com HPA configurado (min: 3, max: 30)
- Prometheus scraping api-gateway
- Baseline de tráfego em 0 RPS

**Passos de Execução:**
```bash
# Script k6 — burst repentino
cat > /tmp/burst-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },    # Baseline
    { duration: '10s', target: 200 },   # Burst repentino
    { duration: '120s', target: 200 },  # Sustentado
    { duration: '30s', target: 10 },    # Decaimento
    { duration: '60s', target: 0 },     # Fim
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],   # SLO: P99 < 500ms
    http_req_failed: ['rate<0.01'],     # SLO: Error rate < 1%
  },
};

export default function () {
  const res = http.get(`${__ENV.VELYA_API_URL}/api/v1/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'duration < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(0.5);
}
EOF

k6 run --env VELYA_API_URL=$VELYA_API_URL /tmp/burst-test.js
```

**Métricas Observadas:**
- HPA replica count timeline durante o teste
- Latência P99 durante scale-up
- Tempo para HPA iniciar scale-up (target: < 60s após trigger)
- Tempo para novos pods ficarem ready

**Critérios de Sucesso:**
- [ ] P99 latência < 500ms durante burst (tolerância de 60s de degradação durante scale-up)
- [ ] Error rate < 1% durante todo o teste
- [ ] HPA escala para > 5 réplicas dentro de 60s do início do burst
- [ ] HPA escala para baixo após decaimento (dentro de 10 min)
- [ ] Nenhum pod CrashLoopBackOff durante o teste

**Risco se Falhar:**
Alta. Burst real de admissões hospitalares pode derrubar o api-gateway se HPA não funcionar.

---

## Cenário 2: Burst de Eventos em Fila NATS

**Nome:** NATS Event Queue Burst — patient-flow-worker  
**Objetivo:** Validar KEDA scaling de workers quando fila cresce rapidamente

**Pré-condições:**
- patient-flow-worker com KEDA ScaledObject (lagThreshold: 50)
- NATS JetStream com stream velya.clinical.events
- Workers em minReplicaCount (1 ou 2)

**Passos de Execução:**
```bash
# Publicar 1000 eventos de admissão de uma vez
cat > /tmp/publish-burst.sh << 'EOF'
#!/bin/bash
MSGS=1000
echo "Publicando $MSGS eventos de admissão..."

for i in $(seq 1 $MSGS); do
  nats pub velya.clinical.events \
    "{\"type\":\"patient.admitted\",\"patient_id\":\"test-$(uuidgen)\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    --server $NATS_URL &
  
  if [ $((i % 50)) -eq 0 ]; then
    echo "Publicados $i de $MSGS eventos"
    sleep 0.1   # Pequena pausa para não sobrecarregar NATS
  fi
done
wait
echo "Publicação concluída"
EOF

chmod +x /tmp/publish-burst.sh
/tmp/publish-burst.sh

# Monitorar escala em tempo real
watch -n 5 'kubectl get pods -n velya-dev-core -l app=patient-flow-worker --no-headers | wc -l'

# Monitorar NATS queue depth
watch -n 5 'nats stream info velya.clinical.events --server $NATS_URL | grep Messages'
```

**Métricas Observadas:**
```bash
# Prometheus queries durante o teste
# KEDA metrics value (lag do consumer)
curl -s "$PROMETHEUS_URL/api/v1/query" \
  --data-urlencode 'query=keda_scaler_metrics_value{scaledObject="patient-flow-worker-so"}' | \
  jq '.data.result[].value[1]'

# Replicas atuais
curl -s "$PROMETHEUS_URL/api/v1/query" \
  --data-urlencode 'query=kube_deployment_status_replicas{deployment="patient-flow-worker"}' | \
  jq '.data.result[].value[1]'
```

**Critérios de Sucesso:**
- [ ] KEDA inicia scale-up dentro de 30s do burst (pollingInterval + latência)
- [ ] Workers escalam para > 10 réplicas com 1000 mensagens na fila
- [ ] 95% das mensagens processadas em < 5 minutos
- [ ] DLQ fica vazio após processamento
- [ ] Workers escalam para baixo após fila esvaziada (cooldownPeriod)

**Risco se Falhar:**
Médio. Eventos clínicos processados com atraso → tarefas aparecem tarde no inbox.

---

## Cenário 3: Startup Latency em Massa (Cold Start)

**Nome:** Cold Start Latency — scale-from-zero  
**Objetivo:** Medir latência de startup de pods partindo do zero replicas

**Pré-condições:**
- ai-gateway-async-worker em minReplicaCount=0 (KEDA scale-to-zero)
- KEDA configurado com activationLagThreshold

**Passos de Execução:**
```bash
# 1. Garantir que workers estão em zero
kubectl scale deployment ai-gateway-async-worker -n velya-dev-agents --replicas=0

# Aguardar KEDA confirmar zero
sleep 30
kubectl get pods -n velya-dev-agents -l app=ai-gateway-async-worker

# 2. Publicar 1 mensagem para triggar cold start
nats pub velya.ai.requests \
  '{"agent":"test-agent","prompt":"Hello","priority":"normal"}' \
  --server $NATS_URL

# 3. Medir tempo até primeiro pod ficar Ready
START=$(date +%s)
while true; do
  READY=$(kubectl get pods -n velya-dev-agents -l app=ai-gateway-async-worker \
    -o jsonpath='{.items[?(@.status.containerStatuses[0].ready==true)].metadata.name}')
  if [ -n "$READY" ]; then
    END=$(date +%s)
    echo "Cold start latency: $((END-START)) segundos"
    break
  fi
  sleep 1
done
```

**Métricas Observadas:**
- Tempo total de cold start (publicação → pod Ready)
- Decomposição: scheduling time + image pull + container startup + readiness probe

**Critérios de Sucesso:**
- [ ] Cold start total < 60 segundos
- [ ] Pod ready < 45 segundos após scheduling
- [ ] Primeira mensagem processada < 90 segundos após publicação

**Risco se Falhar:**
Baixo. ai-gateway-async é um serviço assíncrono — latência de cold start é aceitável.

---

## Cenário 4: Scheduling Delay por Anti-Affinity

**Nome:** Anti-Affinity Scheduling Pressure  
**Objetivo:** Verificar que anti-affinity não bloqueia scaling no ambiente kind (3 nós)

**Passos de Execução:**
```bash
# Escalar api-gateway além do número de nós disponíveis
kubectl scale deployment api-gateway -n velya-dev-core --replicas=5

# Verificar se pods ficam pendentes
sleep 30
kubectl get pods -n velya-dev-core -l app=api-gateway

# Verificar events de scheduling
kubectl get events -n velya-dev-core --field-selector reason=FailedScheduling
```

**Critérios de Sucesso:**
- [ ] Com anti-affinity SOFT (preferred): pods schedulados mesmo com nós compartilhados
- [ ] Com anti-affinity HARD (required): documentar quantos pods ficam pendentes e por quê

**Risco se Falhar:**
Alto em prod se anti-affinity hard bloquear scaling durante pico.

---

## Cenário 5: Queue Buildup Gradual

**Nome:** Gradual Queue Accumulation  
**Objetivo:** Validar detecção e resposta a acúmulo gradual de fila (não burst)

**Passos de Execução:**
```bash
# Publicar 10 mensagens por minuto por 20 minutos (200 total)
# Simula chegada contínua de casos de discharge
for i in $(seq 1 200); do
  nats pub velya.discharge.queue \
    "{\"patient_id\":\"test-$i\",\"priority\":\"normal\",\"requested_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    --server $NATS_URL
  
  if [ $((i % 10)) -eq 0 ]; then
    echo "Mensagem $i publicada. Aguardando 60s..."
    sleep 60
  fi
done
```

**Métricas Observadas:**
- Queue depth ao longo do tempo
- KEDA scaling response (quando inicia o scale-up?)
- Clearance time após publicações cessarem

**Critérios de Sucesso:**
- [ ] KEDA inicia scale-up quando lag ultrapassa lagThreshold
- [ ] Backlog não cresce indefinidamente — workers acompanham a taxa
- [ ] Alerta de `NATSQueueDepthHigh` dispara antes de 500 mensagens
- [ ] Backlog zerado em < 10 minutos após fim das publicações

---

## Cenário 6: Retry Storm

**Nome:** Retry Storm — dependência externa instável  
**Objetivo:** Validar que retry storm não explode workers e DLQ

**Passos de Execução:**
```bash
# Simular instabilidade do HIS (sistema externo)
# Injetar falha nas respostas do endpoint do HIS mock

# Se houver mock do HIS:
kubectl patch deployment his-mock -n velya-dev-platform \
  --patch '{"spec":{"template":{"spec":{"containers":[{"name":"his-mock","env":[{"name":"FAILURE_RATE","value":"0.8"}]}]}}}}'

# Publicar 100 mensagens que dependem do HIS
for i in $(seq 1 100); do
  nats pub velya.discharge.queue \
    "{\"patient_id\":\"his-test-$i\",\"requires_his\":true}" \
    --server $NATS_URL
done

# Monitorar retry rate
watch -n 10 'nats stream info velya.discharge.queue --server $NATS_URL | grep -E "Messages|Redelivered"'
```

**Critérios de Sucesso:**
- [ ] DLQ recebe mensagens após 5 retries (max_deliver configurado)
- [ ] Workers não crasham sob retry storm
- [ ] Alerta `RetryBudgetExhausted` dispara quando taxa de retry está alta
- [ ] Após HIS ser restaurado, mensagens do DLQ podem ser re-enfileiradas
- [ ] Workers não fazem retry infinito (max_deliver = 5 respeitado)

**Comandos:**
```bash
# Restaurar HIS mock
kubectl patch deployment his-mock -n velya-dev-platform \
  --patch '{"spec":{"template":{"spec":{"containers":[{"name":"his-mock","env":[{"name":"FAILURE_RATE","value":"0"}]}]}}}}'

# Verificar DLQ
nats stream info velya.discharge.dlq --server $NATS_URL

# Re-enfileirar do DLQ após restauração
# (implementação específica do serviço)
```

---

## Cenário 7: Scale Oscillation (HPA Flapping)

**Nome:** HPA Flapping Prevention Test  
**Objetivo:** Verificar que stabilizationWindowSeconds previne flapping

**Passos de Execução:**
```bash
# Script k6 com carga em dente de serra (borderline de 60% CPU)
cat > /tmp/sawtooth-load.js << 'EOF'
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 80 },   # CPU ~55%
    { duration: '1m', target: 120 },  # CPU ~75% → scale up
    { duration: '1m', target: 80 },   # CPU ~55% → scale down?
    { duration: '1m', target: 120 },  # CPU ~75% → scale up?
    { duration: '1m', target: 80 },   # Repete
    { duration: '1m', target: 120 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  http.get(`${__ENV.VELYA_API_URL}/api/v1/health`);
  sleep(0.1);
}
EOF

k6 run --env VELYA_API_URL=$VELYA_API_URL /tmp/sawtooth-load.js

# Em paralelo, contar mudanças de replica
kubectl get events -n velya-dev-core --field-selector reason=SuccessfulRescale -w
```

**Critérios de Sucesso:**
- [ ] Com `stabilizationWindowSeconds: 300`, máximo 2 scale-downs em 8 minutos
- [ ] Nenhum "flapping" visível (réplicas subindo e descendo a cada minuto)
- [ ] Alerta `HPAFlapping` NÃO dispara (confirma que prevenção funciona)

---

## Cenário 8: Validation Queue Congestion

**Nome:** Human Approval Queue Congestion  
**Objetivo:** Validar comportamento quando médicos não aprovam workflows rapidamente

**Passos de Execução:**
```bash
# Criar 20 workflows de discharge que requerem aprovação médica
temporal workflow start \
  --task-queue discharge-orchestration \
  --type DischargeOrchestrationWorkflow \
  --input '{"patient_id":"bulk-test","require_physician_approval":true}' \
  --count 20 \
  --namespace velya-dev

# Não aprovar nenhum (simular médico indisponível)
# Aguardar 30 minutos

# Verificar status
temporal workflow list \
  --query 'WorkflowType="DischargeOrchestrationWorkflow" AND ExecutionStatus="Running"' \
  --namespace velya-dev | wc -l
```

**Critérios de Sucesso:**
- [ ] Workflows ficam em RUNNING aguardando aprovação (não timeout prematuramente)
- [ ] Alerta `TemporalWorkflowBacklogHigh` dispara quando > 10 workflows pendentes
- [ ] Após 2h sem aprovação, workflow escala para supervisor (se implementado)
- [ ] Task inbox-service mostra corretamente as aprovações pendentes

---

## Cenário 9: Degraded External Integration

**Nome:** External Integration Failure — HIS offline  
**Objetivo:** Validar modo degradado quando integração externa fica offline

**Passos de Execução:**
```bash
# Tornar HIS inacessível (simular via network policy)
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-his-access
  namespace: velya-dev-core
spec:
  podSelector:
    matchLabels:
      app: patient-flow-service
  policyTypes:
  - Egress
  egress:
  - ports:
    - port: 80
    - port: 443
    to:
    - namespaceSelector:
        matchLabels:
          velya.io/component: internal   # Apenas tráfego interno
EOF

# Verificar comportamento do sistema
curl -s $VELYA_API_URL/api/v1/health | jq '.integrations.his'

# Verificar se circuit breaker abriu
kubectl logs -n velya-dev-core deployment/patient-flow-service --since=2m | grep -i "circuit"

# Ativar modo degradado via velya-web ou API
curl -X POST $VELYA_API_URL/api/v1/platform/operation-mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"degraded","reason":"HIS integration offline","preset":"integration-degraded"}'
```

**Restauração:**
```bash
kubectl delete networkpolicy block-his-access -n velya-dev-core
```

**Critérios de Sucesso:**
- [ ] Circuit breaker abre em < 5 tentativas falhas
- [ ] Sistema continua funcionando para funcionalidades que não dependem do HIS
- [ ] Alerta disparado para equipe de operações
- [ ] Ativação de modo degradado funciona via API/UI
- [ ] Retorno ao modo normal após restaurar integração funciona

---

## Cenário 10: Slow Database

**Nome:** Database Slow Query Cascade  
**Objetivo:** Validar que lentidão no banco não colapsa os serviços

**Passos de Execução:**
```bash
# Injetar lentidão no PostgreSQL via extensão pg_sleep
kubectl exec -n velya-dev-platform postgresql-0 -- \
  psql -U velya -c "ALTER SYSTEM SET max_connections = '10';"  # Limitar conexões
kubectl exec -n velya-dev-platform postgresql-0 -- \
  pg_ctl reload -D /var/lib/postgresql/data

# Executar carga
k6 run --env VELYA_API_URL=$VELYA_API_URL /tmp/burst-test.js &

# Monitorar latência da database
kubectl logs -n velya-dev-core deployment/api-gateway --since=5m | grep -i "slow query\|timeout"
```

**Restauração:**
```bash
kubectl exec -n velya-dev-platform postgresql-0 -- \
  psql -U velya -c "ALTER SYSTEM RESET max_connections;"
kubectl exec -n velya-dev-platform postgresql-0 -- \
  pg_ctl reload -D /var/lib/postgresql/data
```

**Critérios de Sucesso:**
- [ ] Circuit breaker abre após N falhas de conexão
- [ ] Timeout de conexão configurado corretamente (não espera indefinidamente)
- [ ] Escalar api-gateway não resolve (adicionar réplicas quando o problema é o DB é contraproducente)
- [ ] Alerta de latência P99 dispara antes do sistema se degradar completamente

---

## Cenário 11: Cost Spike

**Nome:** LLM Token Budget Spike  
**Objetivo:** Validar guardrails de budget LLM quando consumo dispara

**Passos de Execução:**
```bash
# Simular consumo acelerado de tokens
# Enviar 1000 requests ao ai-gateway em 5 minutos
cat > /tmp/ai-burst.sh << 'EOF'
#!/bin/bash
for i in $(seq 1 1000); do
  curl -s -X POST $VELYA_API_URL/api/v1/ai/complete \
    -H "Content-Type: application/json" \
    -H "X-Office-Id: clinical-office" \
    -H "X-Priority: low" \
    -d '{"prompt":"Summarize: patient admitted with fever","max_tokens":100}' &
  
  if [ $((i % 50)) -eq 0 ]; then
    echo "$i requests enviados"
    sleep 1
  fi
done
wait
EOF

chmod +x /tmp/ai-burst.sh
/tmp/ai-burst.sh

# Monitorar budget
watch -n 10 'curl -s "$PROMETHEUS_URL/api/v1/query" \
  --data-urlencode "query=velya_ai_budget_consumed_ratio{office_id=\"clinical-office\"}" | \
  jq .data.result[].value[1]'
```

**Critérios de Sucesso:**
- [ ] Budget enforcer bloqueia requests low-priority quando utilização > 70%
- [ ] Budget enforcer bloqueia requests normal-priority quando > 85%
- [ ] Apenas requests critical passam quando > 95%
- [ ] Alerta `LLMTokenBudgetCritical` dispara
- [ ] KEDA não escala ai-gateway-async-worker além do orçamento

---

## Cenário 12: Node Provisioning Lag

**Nome:** Karpenter Node Provisioning Latency  
**Objetivo:** Medir latência de provisionamento de novo nó (EKS apenas)

**Nota:** Este cenário é executado em EKS staging, não em kind-velya-local.

**Passos de Execução (EKS Staging):**
```bash
# Verificar quantos nós disponíveis no NodePool alvo
kubectl get nodes -l velya.io/node-pool=realtime-app

# Consumir todo o capacity disponível nos nós atuais
kubectl scale deployment api-gateway -n velya-dev-core --replicas=50

# Medir tempo até Karpenter provisionar novo nó
START=$(date +%s)
INITIAL_NODES=$(kubectl get nodes -l velya.io/node-pool=realtime-app --no-headers | wc -l)

while true; do
  CURRENT_NODES=$(kubectl get nodes -l velya.io/node-pool=realtime-app --no-headers | wc -l)
  if [ "$CURRENT_NODES" -gt "$INITIAL_NODES" ]; then
    END=$(date +%s)
    echo "Karpenter provisionou novo nó em $((END-START)) segundos"
    break
  fi
  sleep 5
done
```

**Critérios de Sucesso:**
- [ ] Novo nó disponível em < 3 minutos
- [ ] Pods schedulados no novo nó em < 4 minutos total
- [ ] Nenhum SLO violado durante o período de provisionamento
- [ ] Karpenter log não mostra erros de capacity (suficiente capacidade Spot/OD)

---

## Cenário 13: Over-Scaling sem Benefício

**Nome:** Wasteful Scale-Up Detection  
**Objetivo:** Detectar quando scaling está acontecendo mas não há benefício de performance

**Passos de Execução:**
```bash
# Simular situação onde CPU está alta por memory pressure (GC)
# Não por carga real de requests

# 1. Forçar GC pressure injetando allocation no app
# (específico de implementação — usar endpoint de diagnóstico se disponível)

# 2. Monitorar se HPA sobe réplicas (por CPU)
kubectl get hpa api-gateway-hpa -n velya-dev-core -w &

# 3. Monitorar se latência melhora (não deveria, se problema é GC)
hey -n 1000 -c 50 $VELYA_API_URL/api/v1/health 2>&1 | grep "Requests/sec\|P99"

# 4. Verificar CPU throttling (sinal de GC pressure)
curl -s "$PROMETHEUS_URL/api/v1/query" \
  --data-urlencode 'query=rate(container_cpu_cfs_throttled_seconds_total{container="api-gateway"}[5m])' | \
  jq '.data.result[].value[1]'
```

**Critérios de Sucesso:**
- [ ] Identificar: escalar não melhora latência quando problema é GC/memory
- [ ] VPA recommendation reflete necessidade de mais memória, não mais réplicas
- [ ] Documentar: regra de não escalar quando causa é memory leak

---

## Cenário 14: Coexistência HPA + KEDA + Policies

**Nome:** Multi-Scaler Coexistence Validation  
**Objetivo:** Validar que HPA e KEDA coexistem sem conflito em Deployments diferentes

**Passos de Execução:**
```bash
# Verificar estado inicial
kubectl get hpa -n velya-dev-core
kubectl get scaledobject -n velya-dev-core
kubectl get scaledobject -n velya-dev-agents

# Executar carga simultânea em HTTP e NATS
k6 run /tmp/burst-test.js &   # Trigger para HPA (api-gateway)
/tmp/publish-burst.sh &       # Trigger para KEDA (patient-flow-worker)
wait

# Verificar que ambos escalaram independentemente
kubectl get pods -n velya-dev-core -l app=api-gateway
kubectl get pods -n velya-dev-core -l app=patient-flow-worker

# Verificar que não houve conflito
kubectl get events -n velya-dev-core | grep -i conflict
kubectl describe hpa api-gateway-hpa -n velya-dev-core
kubectl describe scaledobject patient-flow-worker-so -n velya-dev-core
```

**Critérios de Sucesso:**
- [ ] HPA e KEDA escalam deployments diferentes sem interferência
- [ ] Nenhum conflito de ownership nos events
- [ ] ResourceQuota do namespace não é violada durante scaling simultâneo
- [ ] Ambos os serviços mantêm SLOs durante a carga simultânea

---

## Cenário 15: PDB Blocking Drain

**Nome:** PodDisruptionBudget Drain Test  
**Objetivo:** Validar que PDB impede drain de nó quando viola disponibilidade

**Passos de Execução:**
```bash
# Verificar PDB configurado
kubectl get pdb -n velya-dev-core

# Tentar drenar um nó com pods protegidos
NODE=$(kubectl get pods -n velya-dev-core -l app=api-gateway -o jsonpath='{.items[0].spec.nodeName}')
echo "Tentando drenar nó: $NODE"

# Isso DEVE ser bloqueado pelo PDB
kubectl drain $NODE --ignore-daemonsets --pod-selector=app=api-gateway --timeout=30s

# Verificar mensagem de erro esperada:
# "Cannot evict pod as it would violate the pod's disruption budget"
```

**Critérios de Sucesso:**
- [ ] Drain é bloqueado pelo PDB quando violaria `maxUnavailable`
- [ ] Mensagem de erro clara explica o bloqueio
- [ ] Com `--force` (NUNCA em prod), drain é permitido
- [ ] PDB permite drain quando há réplicas suficientes (ex: 5 réplicas, PDB maxUnavailable=1)

---

## Cenário 16: Temporal Worker Resilience

**Nome:** Temporal Worker Crash During Workflow  
**Objetivo:** Validar que workflows Temporal sobrevivem ao crash de workers

**Passos de Execução:**
```bash
# Iniciar alguns workflows de discharge
for i in $(seq 1 5); do
  temporal workflow start \
    --task-queue discharge-orchestration \
    --type DischargeOrchestrationWorkflow \
    --input "{\"patient_id\":\"crash-test-$i\"}" \
    --namespace velya-dev
done

# Verificar workflows rodando
temporal workflow list --query 'ExecutionStatus="Running"' --namespace velya-dev

# Matar todos os workers abruptamente
kubectl delete pods -n velya-dev-agents -l app=discharge-orchestrator-worker --force

# Aguardar novos pods subirem
sleep 30
kubectl get pods -n velya-dev-agents -l app=discharge-orchestrator-worker

# Verificar que workflows continuaram (não falharam)
temporal workflow list --query 'ExecutionStatus="Running"' --namespace velya-dev
temporal workflow list --query 'ExecutionStatus="Failed"' --namespace velya-dev
```

**Critérios de Sucesso:**
- [ ] Nenhum workflow falhou pelo crash dos workers
- [ ] Workflows retomaram do último checkpoint (última atividade completada)
- [ ] Novo set de workers pegou os workflows pendentes em < 60s
- [ ] Histórico de execução no Temporal UI mostra continuidade correta

---

## Cenário 17: Spot Instance Eviction Simulation

**Nome:** Spot Eviction Resilience  
**Objetivo:** Validar que workers stateless sobrevivem a evição de nó Spot

**Nota:** Simular em kind-velya-local deletando um nó.

**Passos de Execução:**
```bash
# Ver nós disponíveis
kubectl get nodes

# Simular evição deletando o nó (kind permite isso)
NODE=$(kubectl get nodes --no-headers -o custom-columns=NAME:.metadata.name | tail -1)
kubectl delete node $NODE

# Verificar redistribuição de pods
sleep 30
kubectl get pods -n velya-dev-core -o wide

# Verificar se kind está tentando recriar o nó
docker ps | grep kind

# Verificar que filas NATS não perderam mensagens
nats stream info velya.clinical.events --server $NATS_URL | grep Messages
```

**Critérios de Sucesso:**
- [ ] Pods relocalizados para nós restantes em < 60s
- [ ] NATS JetStream não perdeu mensagens pendentes
- [ ] Mensagens em processamento no momento da evição foram re-entregues pelo NATS (ack_wait)
- [ ] Workers stateless (patient-flow-worker) retomaram sem perda de dados

---

## Cenário 18: ResourceQuota Exhaustion

**Nome:** Namespace Quota Exhaustion  
**Objetivo:** Validar comportamento quando namespace atinge o limit da ResourceQuota

**Passos de Execução:**
```bash
# Verificar quota atual
kubectl describe resourcequota velya-core-quota -n velya-dev-core

# Tentar criar pods acima da quota
kubectl scale deployment api-gateway -n velya-dev-core --replicas=100
# Deve falhar com: exceeded quota

# Verificar evento de falha
kubectl get events -n velya-dev-core | grep -i quota
```

**Critérios de Sucesso:**
- [ ] Kubernetes recusa criação de pods acima da quota (não cria parcialmente)
- [ ] Evento de `ExceededQuota` está no namespace
- [ ] HPA não trava quando não consegue criar pods (retorna erro graceful)
- [ ] Alerta `NamespaceCPUQuotaHigh` disparou antes de atingir o limite

---

## Cenário 19: Liveness Probe Kill Cascade

**Nome:** Cascading Pod Restarts from Liveness  
**Objetivo:** Validar que falha de liveness probe não causa cascade de restarts

**Passos de Execução:**
```bash
# Verificar configuração atual de liveness probe
kubectl get deployment api-gateway -n velya-dev-core \
  -o jsonpath='{.spec.template.spec.containers[0].livenessProbe}' | jq .

# Simular resposta lenta do health endpoint (se houver endpoint de chaos)
# Ou ajustar temporariamente o timeout para muito baixo (em dev apenas)
kubectl patch deployment api-gateway -n velya-dev-core \
  --patch '{"spec":{"template":{"spec":{"containers":[{"name":"api-gateway","livenessProbe":{"timeoutSeconds":1,"failureThreshold":1}}]}}}}'

# Verificar restarts
kubectl get pods -n velya-dev-core -l app=api-gateway -w

# Restaurar configuração correta
kubectl patch deployment api-gateway -n velya-dev-core \
  --patch '{"spec":{"template":{"spec":{"containers":[{"name":"api-gateway","livenessProbe":{"timeoutSeconds":10,"failureThreshold":5}}]}}}}'
```

**Critérios de Sucesso:**
- [ ] Com timeout correto (10s), liveness probe não mata pods durante operação normal
- [ ] Com timeout muito baixo, identificar o sintoma de cascade
- [ ] PDB limita quantos pods podem ser removidos simultaneamente

---

## Cenário 20: Full Chaos — Multi-Failure Simultaneous

**Nome:** Multi-Failure Simultaneous Recovery  
**Objetivo:** Validar recuperação quando múltiplos componentes falham ao mesmo tempo

**Pré-condições:**
- Ambiente de staging EKS (não rodar em kind com dados de dev reais)
- Time de operações notificado

**Passos de Execução:**
```bash
# Falha 1: HIS integration down
kubectl apply -f /tmp/block-his-network-policy.yaml

# Falha 2: Spot eviction em 1 nó de workers
kubectl delete node $(kubectl get nodes -l velya.io/node-pool=async-workers --no-headers | head -1 | awk '{print $1}')

# Falha 3: Prometheus momentaneamente down (para testar KEDA sem métricas)
kubectl scale deployment prometheus-operator -n velya-dev-observability --replicas=0
sleep 60
kubectl scale deployment prometheus-operator -n velya-dev-observability --replicas=1

# Observar comportamento do sistema sob múltiplas falhas simultâneas

# Sequência de recuperação
kubectl delete networkpolicy block-his-access -n velya-dev-core
# (Karpenter provisiona novo nó automaticamente)
# (Prometheus reinicia automaticamente após volta do operator)
```

**Critérios de Sucesso:**
- [ ] Sistema continua servindo tráfego HTTP (degradado, mas disponível)
- [ ] Alertas disparam para CADA falha separadamente
- [ ] Recuperação é automática para todos os 3 cenários
- [ ] Nenhum dado de workflow perdido (Temporal sobrevive)
- [ ] SLO de disponibilidade não violado além do budget de erro

---

## Matriz de Cenários

| # | Cenário | Ambiente | Duração | Frequência |
|---|---|---|---|---|
| 1 | HTTP Traffic Burst | kind/staging | 5 min | Por mudança no HPA |
| 2 | NATS Queue Burst | kind/staging | 15 min | Por mudança no KEDA |
| 3 | Cold Start Latency | kind/staging | 5 min | Por mudança em scale-to-zero |
| 4 | Anti-Affinity Scheduling | kind | 5 min | Por mudança em affinity |
| 5 | Queue Buildup Gradual | kind | 30 min | Mensal |
| 6 | Retry Storm | kind | 20 min | Por mudança em retry policy |
| 7 | HPA Flapping | staging | 10 min | Por mudança em HPA behavior |
| 8 | Validation Queue | kind | 60 min | Trimestral |
| 9 | Integration Failure | staging | 30 min | Mensal |
| 10 | Slow Database | staging | 20 min | Trimestral |
| 11 | Cost Spike LLM | kind | 15 min | Por mudança em budget |
| 12 | Node Provisioning | EKS staging | 15 min | Por mudança em NodePool |
| 13 | Over-Scaling | staging | 20 min | Semestral |
| 14 | Multi-Scaler Coexistence | kind | 20 min | Por mudança em qualquer scaler |
| 15 | PDB Blocking Drain | kind | 10 min | Por mudança em PDB |
| 16 | Temporal Worker Crash | kind | 15 min | Por mudança em Temporal |
| 17 | Spot Eviction | kind (simulado) | 10 min | Por mudança em workloads Spot |
| 18 | Quota Exhaustion | kind | 5 min | Por mudança em ResourceQuota |
| 19 | Liveness Cascade | kind/staging | 10 min | Por mudança em liveness probes |
| 20 | Multi-Failure Chaos | EKS staging | 60 min | Semestral |

---

*Todos os cenários devem ser executados em kind-velya-local antes de promover mudanças para staging.*
