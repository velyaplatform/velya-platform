# Modelo de Overlap Policy para Schedules e Workflows — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Engine de Workflows:** Temporal  
**Última revisão:** 2026-04-08  

---

## 1. O Problema do Overlap

Quando um job agendado (CronJob, Temporal Schedule, Argo CronWorkflow) demora mais do que seu intervalo de execução, surge o problema de overlap: uma nova execução começa antes que a anterior termine. Isso pode causar:

- **Processamento duplicado:** Dois jobs processando as mesmas mensagens
- **Race conditions:** Dois jobs escrevendo simultaneamente no mesmo destino
- **Resource exhaustion:** N instâncias rodando simultaneamente consomem N vezes os recursos
- **Data inconsistency:** Resultados conflitantes de duas execuções paralelas
- **Cascading failure:** Se cada execução demora mais que o intervalo, o número de instâncias cresce indefinidamente

A política de overlap define como o sistema deve se comportar quando esse cenário ocorre.

---

## 2. As Seis Políticas de Overlap

### 2.1 Skip

**Definição:** Se uma execução anterior ainda está rodando quando o schedule dispara, a nova execução é completamente ignorada (pulada). A execução em andamento continua sem interrupção.

**Comportamento:**
```
T=0:00  Execução A inicia (duração esperada: 5min)
T=1:00  Schedule dispara novamente → SKIP (A ainda rodando)
T=2:00  Schedule dispara → SKIP
T=5:00  Execução A termina
T=6:00  Schedule dispara → Execução B inicia normalmente
```

**Quando usar:**
- O trabalho do job é idempotente e o dado mais recente não é crítico
- Atrasos de um ciclo são aceitáveis
- O job é de relatório ou análise: perder um ciclo não causa problema
- O volume de trabalho é naturalmente limitado (o job sempre termina antes do próximo ciclo se o sistema estiver saudável)

**Exemplos na Velya:**
- `cost-sweep` (a cada 6h): Se o sweep de 00:00 ainda está rodando às 06:00, pular o sweep das 06:00
- `market-intelligence-sweep` (semanal): Nunca precisa de instâncias paralelas
- `daily-report` (diário 02h UTC): Se o relatório de ontem ainda está processando, pular e gerar o de amanhã normalmente

**Risco:** Dados podem ficar desatualizados por um ciclo extra se o job demorar mais que o esperado. Monitorar duração média do job.

**Configuração no Temporal Schedule:**
```go
ScheduleSpec{
    CronExpressions: []string{"0 */6 * * *"},
},
ScheduleAction{
    Action: &temporal.ScheduleWorkflowAction{
        Workflow: CostSweepWorkflow,
    },
},
SchedulePolicies{
    OverlapPolicy: temporal.ScheduleOverlapPolicySkip,
},
```

**Configuração no Kubernetes CronJob:**
```yaml
spec:
  concurrencyPolicy: Forbid  # Equivalente ao Skip
  schedule: "0 */6 * * *"
```

---

### 2.2 BufferOne

**Definição:** Se uma execução anterior ainda está rodando, a nova execução é colocada em buffer e aguarda. Apenas UMA execução pode estar em buffer por vez. Se o schedule disparar novamente enquanto há uma execução em buffer, o novo disparo é ignorado.

**Comportamento:**
```
T=0:00  Execução A inicia
T=1:00  Schedule → Buffer: execução B aguardando
T=2:00  Schedule → SKIP (buffer já tem B)
T=3:00  Schedule → SKIP (buffer ainda tem B)
T=4:00  Execução A termina → Execução B inicia imediatamente
T=5:00  Schedule → Buffer: C aguardando
T=8:00  Execução B termina → Execução C inicia
```

**Quando usar:**
- Não se pode perder um ciclo (diferente de Skip)
- Mas não é seguro ter duas instâncias paralelas
- O dado precisa ser processado, mas pode esperar a vez
- Workload tem picos ocasionais mas volta ao normal

**Exemplos na Velya:**
- `heartbeat-sweep` (a cada 5min): Se o sweep demorar, o próximo aguarda. Não se pode perder a verificação de heartbeat.
- `hourly-governance-report`: Relatório importante, mas pode atrasar um ciclo se necessário.

**Risco:** Se os jobs estiverem consistentemente demorando mais que o intervalo, o buffer cria uma fila de execuções atrasadas. Monitorar.

**Configuração no Temporal:**
```go
SchedulePolicies{
    OverlapPolicy: temporal.ScheduleOverlapPolicyBufferOne,
},
```

---

### 2.3 BufferAll

**Definição:** Todas as execuções disparadas enquanto outra está rodando são colocadas em buffer e executadas sequencialmente. Buffer ilimitado (limitado apenas pelos limites de workflow do Temporal).

**Comportamento:**
```
T=0:00  Execução A inicia
T=1:00  Schedule → Buffer B
T=2:00  Schedule → Buffer C
T=3:00  Execução A termina → B inicia
T=4:00  B termina → C inicia
T=5:00  C termina → sistema volta ao normal
```

**Quando usar:**
- Processamento de eventos onde NENHUMA execução pode ser perdida
- Workload episódico com rajadas que o sistema deve absorver
- Volume garantidamente finito (sem risco de buffer crescer indefinidamente)

**Exemplos na Velya:**
- Raramente usado. Preferir Skip ou BufferOne.
- Pode ser usado para `audit-batch` em situações de catch-up após manutenção.

**Risco ALTO:** Se o volume de trabalho excede consistentemente a capacidade, o buffer cresce indefinidamente causando OOM ou degradação. **Requer validação obrigatória antes de uso.**

---

### 2.4 CancelOther

**Definição:** Se uma nova execução dispara enquanto outra está rodando, a execução em andamento recebe sinal de cancelamento. A nova execução assume.

**Comportamento:**
```
T=0:00  Execução A inicia
T=1:00  Schedule → Execução B inicia; A recebe cancel signal
T=1:05  Execução A limpa e termina (graceful shutdown)
T=1:05  Execução B processa dados mais recentes
```

**Quando usar:**
- O dado mais recente é sempre mais importante que o dado em processamento
- A execução em andamento pode ser interrompida sem consequências negativas (idempotente, sem transações parciais)
- É preferível processar dados atualizados do que concluir dados antigos

**Exemplos na Velya:**
- Análise de estado atual da ocupação de leitos (dado antigo de 5 minutos atrás é menos valioso que análise fresca)
- Market intelligence scanning (versão mais nova do scan é mais relevante)

**Restrições críticas:**
- A execução sendo cancelada DEVE ter lógica de graceful shutdown (detectar cancelamento e limpar)
- Não usar em jobs com side-effects parciais não reversíveis
- Não usar em workflows clínicos que podem ter aplicado parte das mudanças

**Configuração no Temporal:**
```go
SchedulePolicies{
    OverlapPolicy: temporal.ScheduleOverlapPolicyCancelOther,
},
```

---

### 2.5 TerminateOther

**Definição:** Similar ao CancelOther, mas a execução em andamento é terminada imediatamente (sem graceful shutdown). Mais agressivo e potencialmente perigoso.

**Diferença vs CancelOther:**

| Aspecto | CancelOther | TerminateOther |
|---|---|---|
| Shutdown | Graceful (cleanup) | Imediato (kill) |
| Side effects | Pode limpar | Pode deixar lixo |
| Velocidade de liberação | Mais lento | Imediato |
| Segurança | Mais seguro | Mais perigoso |

**Quando usar na Velya:**
- Praticamente nunca. Apenas em situações de emergência documentadas.
- Apenas em jobs que são completamente stateless e idempotentes sem cleanup necessário

**Validação obrigatória antes de usar TerminateOther:**
- [ ] O job não tem estado intermediário que precisa ser limpo
- [ ] Não há transações abertas que precisam ser rolladas
- [ ] Nenhuma mensagem NATS foi parcialmente publicada
- [ ] Nenhum lease foi adquirido sem correspondente release
- [ ] Aprovação formal do Architecture Review Office

---

### 2.6 AllowAll

**Definição:** Múltiplas instâncias do job podem rodar simultaneamente sem restrições.

**Comportamento:**
```
T=0:00  Execução A inicia
T=1:00  Execução B inicia (paralela a A)
T=2:00  Execução C inicia (paralela a A e B)
...
```

**Quando usar:**
- O job processa partições distintas de dados (cada instância processa subset diferente)
- A operação é completamente idempotente e não há estado compartilhado
- O sistema de destino suporta escrita concorrente sem conflitos
- O volume de trabalho justifica paralelismo e os recursos suportam

**Validação obrigatória antes de usar AllowAll:**

Antes de definir `AllowAll` em qualquer schedule, é obrigatório documentar e aprovar:

```yaml
# overlap-validation.yaml — deve existir junto com o schedule
schedule_name: nome-do-schedule
overlap_policy: AllowAll
validation:
  idempotency_guarantee: "Sim — cada execução usa sequence ID único como chave de deduplicação"
  shared_state_analysis: "Não há estado compartilhado. Cada instância escreve em partição separada."
  resource_analysis: "3 instâncias simultâneas: 3 * 200m CPU = 600m total. Cabe na ResourceQuota."
  concurrency_test_results: "Testado com 5 instâncias simultâneas sem inconsistências. Ver test log."
  approved_by: "Architecture Review Office"
  approved_at: "2026-04-08"
  review_deadline: "2026-05-08"  # Revisar em 30 dias
```

**Exemplos na Velya:**
- Raramente necessário. Preferir KEDA scaling com workers em filas separadas.
- Pode ser aplicado em jobs de análise que processam partições independentes de dados históricos.

---

## 3. Tabela de Decisão por Tipo de Job

| Tipo de Job | Política Recomendada | Justificativa |
|---|---|---|
| Relatório diário | Skip | Perder um ciclo é aceitável; não pode duplicar |
| Sweep de custo (6h) | Skip | Dado um ciclo mais antigo é aceitável |
| Heartbeat check (5min) | BufferOne | Não pode perder; mas não pode ter paralelo |
| Market intelligence (semanal) | Skip | Longo e único por semana |
| Audit batch diário | Skip | Um audit por dia é suficiente |
| Governance report (horário) | BufferOne | Importante, pode atrasar mas não perder |
| Cost alert sweep | BufferOne | Alerta pode estar atrasado mas não perdido |
| Bed availability check | CancelOther | Dado mais recente é sempre melhor |
| Patient flow analysis | CancelOther | Análise fresca supera análise antiga |
| DLQ cleanup | Skip | Limpeza pode esperar o próximo ciclo |
| Secret rotation | Forbid/Skip | NUNCA paralelo — risco de inconsistência |
| Backup de configurações | Skip | Backup pode ser do próximo ciclo |

---

## 4. Configuração de Schedules Temporal com Overlap Policy

### 4.1 API Go para criar Temporal Schedule

```go
package schedules

import (
    "context"
    "go.temporal.io/sdk/client"
    temporal "go.temporal.io/sdk/temporal"
)

// CreateCostSweepSchedule cria o schedule de cost sweep com política Skip
func CreateCostSweepSchedule(c client.Client) error {
    ctx := context.Background()
    
    scheduleHandle, err := c.ScheduleClient().Create(ctx, client.ScheduleOptions{
        ID: "cost-sweep-schedule",
        Spec: client.ScheduleSpec{
            CronExpressions: []string{"0 */6 * * *"},
            Jitter: 5 * time.Minute, // Jitter de até 5 minutos para evitar thundering herd
        },
        Action: &client.ScheduleWorkflowAction{
            ID:        "cost-sweep-run",
            Workflow:  CostSweepWorkflow,
            TaskQueue: "platform-ops",
            Args: []interface{}{
                CostSweepConfig{
                    Namespaces:    []string{"velya-dev-agents", "velya-dev-platform", "velya-dev-core"},
                    BudgetConfig:  "cost-budgets",
                    AlertThreshold: 0.80,
                },
            },
        },
        Policies: client.SchedulePolicies{
            OverlapPolicy:    temporal.ScheduleOverlapPolicySkip,
            CatchupWindow:    1 * time.Hour,  // Se o servidor ficou offline, não executar mais de 1h de catch-up
            PauseOnFailure:   true,           // Pausar o schedule se o workflow falhar 3x
        },
    })
    
    if err != nil {
        return fmt.Errorf("falha ao criar cost-sweep-schedule: %w", err)
    }
    
    return nil
}

// CreateHeartbeatSweepSchedule cria o schedule de heartbeat com política BufferOne
func CreateHeartbeatSweepSchedule(c client.Client) error {
    ctx := context.Background()
    
    _, err := c.ScheduleClient().Create(ctx, client.ScheduleOptions{
        ID: "heartbeat-sweep-schedule",
        Spec: client.ScheduleSpec{
            CronExpressions: []string{"*/5 * * * *"},
            Jitter: 30 * time.Second,
        },
        Action: &client.ScheduleWorkflowAction{
            ID:        "heartbeat-sweep-run",
            Workflow:  HeartbeatSweepWorkflow,
            TaskQueue: "platform-ops",
        },
        Policies: client.SchedulePolicies{
            OverlapPolicy:  temporal.ScheduleOverlapPolicyBufferOne,
            PauseOnFailure: false,  // Heartbeat check deve continuar mesmo após falha
        },
    })
    
    return err
}
```

### 4.2 Verificação de Estado de Schedule

```bash
# Listar todos os schedules e seus estados
temporal schedule list --namespace velya

# Verificar política de overlap de um schedule específico
temporal schedule describe --schedule-id cost-sweep-schedule --namespace velya

# Disparar execução manual (respeitando a overlap policy)
temporal schedule trigger --schedule-id cost-sweep-schedule --namespace velya

# Ver histórico de execuções de um schedule
temporal schedule describe --schedule-id cost-sweep-schedule --namespace velya --fields recentActions
```

---

## 5. Monitoramento de Overlap

### 5.1 Métricas de Overlap

```yaml
# Regras Prometheus para detectar overlaps problemáticos
groups:
  - name: velya.schedule.overlap
    interval: 1m
    rules:
      
      # Job rodando mais que 2x o período esperado (provável problema de overlap futuro)
      - alert: ScheduledJobRunningLong
        expr: |
          kube_job_status_active{namespace="velya-dev-agents"} > 0
          AND
          (time() - kube_job_status_start_time) > 7200
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Job {{ $labels.job_name }} rodando há mais de 2 horas"
          description: "Pode causar overlap na próxima execução. Verificar causa do delay."
      
      # Múltiplas instâncias do mesmo job rodando (inesperado para jobs com Skip/Forbid)
      - alert: UnexpectedJobParallelism
        expr: |
          count by (job_name) (kube_job_status_active{namespace="velya-dev-agents"}) > 1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Múltiplas instâncias de {{ $labels.job_name }} rodando simultaneamente"
          description: "Verificar se a política de concorrência está correta."
      
      # Schedule Temporal com muitos runs em buffer (indica BufferAll crescendo)
      - alert: TemporalScheduleBufferGrowing
        expr: |
          temporal_schedule_buffered_actions > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Schedule Temporal com {{ $value }} execuções em buffer"
```

### 5.2 Dashboard Grafana de Schedules

Painel `velya-schedules` em `http://localhost:3000` deve exibir:

1. **Estado de todos os schedules:** running/scheduled/paused
2. **Duração histórica de cada schedule:** P50/P95/P99
3. **Contagem de skips por schedule:** indica quantas vezes a política Skip foi ativada
4. **Jobs com duração > intervalo:** early warning de problemas de overlap
5. **Pausa por falha:** schedules que foram pausados automaticamente por falha

---

## 6. Regras de Validação de Overlap antes de Deploy

Toda nova definição de schedule deve passar pelo seguinte checklist antes de entrar em produção:

**Validação obrigatória para QUALQUER política:**
- [ ] Duração máxima esperada do job documentada
- [ ] Comportamento em caso de falha definido (PauseOnFailure: true/false)
- [ ] CatchupWindow configurado adequadamente
- [ ] Monitoramento de duração do job configurado
- [ ] Alerta para job rodando > 2x duração esperada configurado

**Validação adicional para CancelOther/TerminateOther:**
- [ ] Lógica de graceful shutdown implementada e testada
- [ ] Ausência de side effects parciais documentada
- [ ] Teste de cancelamento durante execução realizado

**Validação adicional para AllowAll:**
- [ ] Documento `overlap-validation.yaml` criado e aprovado
- [ ] Teste de concorrência com N instâncias realizado
- [ ] Análise de recursos com N instâncias simultâneas documentada
- [ ] Revisar em 30 dias após início de uso

**Validação adicional para BufferAll:**
- [ ] Análise de cenário de pior caso (volume máximo de buffer) documentada
- [ ] Limite de buffer definido (MaximumAttempts ou timeout)
- [ ] Alerta para buffer crescendo > 5 entradas configurado
