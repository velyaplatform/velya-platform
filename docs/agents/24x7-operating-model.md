# Modelo Operacional 24/7 — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Namespaces:** velya-dev-agents, velya-dev-platform, velya-dev-observability  
**Última revisão:** 2026-04-08  

---

## 1. Visão Geral do Modelo 24/7

A Velya opera como uma plataforma de saúde digital que nunca dorme. Pacientes são admitidos, transferidos e recebem alta 24 horas por dia, 7 dias por semana. O modelo operacional 24/7 define como os agents, workflows, e offices da Velya se organizam para garantir continuidade de operação, detecção precoce de problemas e resposta coordenada a incidentes em qualquer horário.

O modelo é composto de cinco camadas:
1. **Ritmos de execução** — loops de tempo que definem quando cada tipo de trabalho acontece
2. **Modos operacionais** — estados formais do sistema com comportamentos distintos
3. **Transições de modo** — regras e trilha de auditoria para mudanças de estado
4. **Offices** — unidades organizacionais de agents com charter e SLAs
5. **Governança contínua** — mecanismos de oversight que operam sem intervenção humana

---

## 2. Ritmos de Execução

### 2.1 Loop Contínuo (1s–30s)

**Quem executa:** Sentinel Agents, Heartbeat Monitor, Queue Sentinel  
**Propósito:** Detecção imediata de anomalias e falhas críticas  
**Implementação:** Deployment com processo em loop, não CronJob  

Trabalhos do loop contínuo:
- Verificação de heartbeat de todos os agents registrados (a cada 60s por agent)
- Monitoramento de crescimento de DLQ (threshold: +10 mensagens em 30s = alerta)
- Verificação de disponibilidade de NATS JetStream (health check a cada 10s)
- Monitoramento de uso de memória e CPU por namespace (a cada 15s via metrics-server)
- Detecção de pods em CrashLoopBackOff (a cada 30s via API Kubernetes)

**SLA do loop contínuo:** Qualquer anomalia crítica detectada em até 60 segundos de ocorrência.

### 2.2 Loop Curto (5–15 minutos)

**Quem executa:** Worker Agents, Validation Agents, Task Inbox Worker  
**Propósito:** Processamento de workload operacional rotineiro  
**Implementação:** KEDA ScaledObject ativo, escala de 1 a N réplicas conforme lag de fila  

Trabalhos do loop curto:
- Classificação de novos itens no task inbox clínico
- Validação de outputs de agents com novos resultados disponíveis
- Geração de heartbeats por agent (a cada 5 minutos para workers)
- Verificação de SLA de tarefas em andamento
- Processamento de handoffs entre agents (fila `velya.agents.handoff.*`)
- Verificação de leases expirados e liberação de tarefas presas

**SLA do loop curto:** Nenhuma tarefa fica sem processamento por mais de 15 minutos.

### 2.3 Loop Horário

**Quem executa:** Governance Agents, Reporting Agents, Learning Agents  
**Propósito:** Análises que requerem janela de dados agregada  
**Implementação:** Kubernetes CronJob com schedule `0 * * * *`  

Trabalhos do loop horário:
- Auditoria de decisions de agents na última hora
- Cálculo de score de qualidade por office (média ponderada dos últimos 60 min)
- Relatório de custo de inferência LLM por agent e office
- Verificação de aderência a SLAs de tempo de resposta por serviço
- Sweep de leases expirados há mais de 2x o TTL configurado
- Atualização do snapshot de coordination (agent-sync-status.json)
- Análise de retry rate por fila (threshold: >20% = alerta de saúde de fila)

**SLA do loop horário:** Relatório horário disponível em até 5 minutos após virada de hora.

### 2.4 Loop Diário

**Quem executa:** Batch Agents, Cost Governance, Audit Agent, Report Agent  
**Propósito:** Análises profundas e limpeza de dados  
**Implementação:** CronJob com schedule `0 2 * * *` (2h UTC para evitar pico de carga)  

Trabalhos do loop diário:
- Relatório completo de saúde do cluster (nodes, namespaces, pods, events)
- Custo total do dia anterior por namespace e por NodePool
- Auditoria completa de decisions clínicas do dia
- Limpeza de completed jobs e pods terminados com histórico > 3
- Análise de padrões de retry (identificação de erros recorrentes)
- Geração de learning events a partir de incidentes do dia
- Revisão de agents em estado `probation` com score de qualidade
- Backup de configurações de agents (ConfigMaps, CRDs KEDA)

**SLA do loop diário:** Relatório diário entregue ao Knowledge Office até 06h00 UTC.

### 2.5 Loop Semanal

**Quem executa:** Architecture Review Agent, Market Intelligence Agent, FinOps Agent  
**Propósito:** Revisões estratégicas e aprendizado institucional  
**Implementação:** CronJob com schedule `0 3 * * 1` (segunda-feira, 3h UTC)  

Trabalhos do loop semanal:
- Relatório semanal de tendências de custo (7 dias, projeção para 30 dias)
- Market intelligence sweep de fontes técnicas controladas
- Revisão de agents em fila de retirement (candidatos à aposentadoria)
- Análise de evolução de scores de qualidade por office (semana vs semana anterior)
- Identificação de capability gaps no ecossistema de agents
- Revisão de DLQs com items sem resolução há >3 dias
- Proposta de novos runbooks com base em incidentes da semana

**SLA do loop semanal:** Relatório semanal entregue até segunda-feira 08h00 UTC.

---

## 3. Modos Operacionais

O sistema Velya opera em um dos seguintes modos formais em qualquer instante. O modo atual é persistido em um ConfigMap no namespace `velya-dev-platform` e lido por todos os agents na inicialização e a cada 60 segundos.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: velya-operating-mode
  namespace: velya-dev-platform
data:
  current_mode: "active"
  mode_since: "2026-04-08T10:00:00Z"
  mode_reason: "operação normal"
  transitioned_by: "ops-watchdog"
  previous_mode: "maintenance"
```

### 3.1 Modo: active

**Descrição:** Operação normal. Todos os agents, loops e offices funcionando dentro dos SLAs esperados.

**Comportamento de agents:**
- Todos os loops em execução nos ritmos normais
- KEDA escalando workloads conforme demanda
- Alertas em thresholds normais (não elevados)

**Critérios de entrada:** Sistema estável, todos os serviços críticos respondendo, DLQs abaixo do threshold.

**Critérios de saída:** Detecção de anomalia sistêmica, início de manutenção planejada, ou falha de componente crítico.

### 3.2 Modo: paused

**Descrição:** Processamento de novas tarefas suspenso. Tarefas em andamento são concluídas. Sentinels e Watchdogs continuam ativos.

**Comportamento de agents:**
- Workers param de consumir novas mensagens das filas
- Tarefas já em processamento são concluídas normalmente
- Heartbeat continua (agents reportam `state: paused`)
- Novas mensagens são aceitas nas filas mas não processadas
- Alertas de queue buildup são gerados após 15 minutos de pausa

**Uso típico:** Manutenção não planejada de curta duração, janela de deploy crítico, investigação ativa de incidente.

**Duração máxima recomendada:** 30 minutos. Após 30 minutos em modo paused, o sistema sugere transição para maintenance ou retorno a active.

### 3.3 Modo: maintenance

**Descrição:** Janela de manutenção planejada. Workloads não-críticos suspensos. Apenas serviços essenciais de saúde do cluster e serviços de emergência clínica continuam.

**Comportamento de agents:**
- Todos os workers de tasks não-urgentes suspensos
- Tasks com `priority: emergency` continuam sendo processadas
- Loop contínuo ativo com frequência reduzida (a cada 2 minutos)
- Backup automático de state antes de qualquer operação de manutenção
- Logs de todas as mudanças realizadas durante maintenance em nível `audit`

**Pré-requisitos para entrar em maintenance:**
- Notificação com no mínimo 4 horas de antecedência (exceto emergências)
- Confirmação de ausência de cirurgias/procedimentos agendados no período
- Aprovação de pelo menos dois membros da equipe de operações

### 3.4 Modo: degraded

**Descrição:** Sistema funcionando com capacidade reduzida. Alguns componentes falharam mas o serviço essencial continua. Priorização automática de workloads críticos.

**Comportamento de agents:**
- Triagem automática: apenas tasks `priority: high` e `priority: emergency` processadas
- Workers de tasks não-críticas pausados automaticamente
- Escalada automática de alertas para canal de incidentes
- Watchdog em modo intensivo: checks a cada 30 segundos
- Log de todos os itens descartados/postergados para reconciliação posterior

**Critérios de entrada automática:**
- 2 ou mais serviços críticos com health check falhando
- Taxa de erros > 25% em qualquer serviço de produção
- Latência P99 > 5x o SLA por mais de 3 minutos consecutivos
- DLQ crescendo > 50 mensagens por minuto

### 3.5 Modo: shadow

**Descrição:** Um novo agent ou workflow executa em paralelo ao sistema existente sem afetar resultados reais. Os outputs são logados e comparados mas não aplicados.

**Comportamento:**
- O agent shadow recebe as mesmas mensagens que o agent de produção (via fan-out NATS)
- Outputs do shadow são enviados para `velya.agents.shadow.{agent_name}` (não para destino real)
- Métricas de comparação: accuracy vs. production, latência, custo de inferência
- Threshold de promoção: 7 dias em shadow com accuracy >= 0.90 e sem incidentes
- O shadow não tem permissão de escrita em qualquer sistema real

**Uso:** Validação de novos agents antes de promoção para produção. Toda mudança de agent de Nível 3+ começa em shadow.

### 3.6 Modo: quarantine

**Descrição:** Agent isolado após comportamento anômalo. Não processa novos trabalhos. Sob investigação ativa.

**Detalhes completos no documento `pause-resume-quarantine-model.md`.**

**Resumo:** Agent quarantenado não consome mensagens, não emite outputs, mas continua enviando heartbeat com `state: quarantine`. Suas filas são redirecionadas para um agent de fallback ou para fila de espera humana.

---

## 4. Transições de Modo com Trilha de Auditoria

### 4.1 Registro de Transição

Toda transição de modo gera um evento de auditoria persistido em:
- Loki (tag: `mode_transition`)
- ConfigMap `velya-mode-history` (últimas 100 transições)
- Métrica Prometheus: `velya_operating_mode_transitions_total{from, to, trigger}`

```json
{
  "event": "mode_transition",
  "timestamp": "2026-04-08T14:30:00Z",
  "from_mode": "active",
  "to_mode": "degraded",
  "triggered_by": "ops-watchdog",
  "trigger_reason": "patient-flow-service health check failing for 3 minutes",
  "affected_agents": ["task-inbox-worker", "discharge-worker"],
  "human_notified": true,
  "notification_channel": "velya-ops-alerts",
  "expected_duration_minutes": 30,
  "rollback_plan": "auto-return-to-active-when-health-restored"
}
```

### 4.2 Transições Automáticas Permitidas

| De | Para | Gatilho | Reversão automática |
|---|---|---|---|
| active | degraded | 2+ serviços falhando | Sim, quando serviços recuperam |
| active | paused | Comando de ops watchdog | Não (requer ação explícita) |
| degraded | active | Serviços recuperados | Sim, após 5 min estável |
| degraded | maintenance | Falha não-recuperável | Não |
| shadow | active | Aprovação pós-período de shadow | Não (requer ação explícita) |
| quarantine | investigation | Detecção de anomalia severa | Não |

### 4.3 Transições que Requerem Aprovação Humana

| Transição | Aprovadores necessários | Prazo máximo para decisão |
|---|---|---|
| active → maintenance | 2 ops engineers | 24h (planejada) / 30min (emergência) |
| quarantine → active | Architecture Review + Governance | 48h |
| investigation → retirement | Architecture Review | 72h |
| degraded (>2h) → maintenance | 1 ops engineer | 30min |

---

## 5. As 23 Offices da Velya

A Velya organiza seus agents em 23 offices funcionais. Cada office tem um charter claro, metas mensuráveis, SLAs definidos e backlog gerenciado.

---

### Office 1: Clinical Operations Office

**Charter:** Garantir o fluxo contínuo e seguro de pacientes através de todos os pontos de cuidado, desde admissão até alta.

**Metas:**
- Tempo médio de classificação de urgência < 2 minutos
- Taxa de sucesso de alta no primeiro dia programado > 85%
- Zero tarefas clínicas críticas sem owner por mais de 5 minutos

**SLAs:**
- Task inbox: classifica em < 3 minutos após chegada
- Discharge orchestration: inicia em < 5 minutos após ordem médica
- Escalação para humano: notificação em < 1 minuto

**Agents:**
- task-inbox-worker (Worker)
- discharge-worker (Worker)
- patient-flow-sentinel (Sentinel)
- clinical-governance-agent (Governance)

**Backlog gerenciado:** Fila `velya.agents.clinical-ops.*`

---

### Office 2: Platform Health Office

**Charter:** Manter a infraestrutura Kubernetes e os serviços de plataforma operando dentro dos parâmetros definidos.

**Metas:**
- Uptime de serviços críticos > 99.5% (4.38h downtime/mês máximo)
- Tempo de detecção de falha < 60 segundos
- Tempo de recuperação de pods < 5 minutos (para falhas auto-recuperáveis)

**SLAs:**
- Detecção de CrashLoopBackOff: < 60s
- Alerta de ResourceQuota > 80%: < 2 minutos
- Relatório de saúde diário: disponível até 06h UTC

**Agents:**
- platform-sentinel (Sentinel)
- k8s-health-watchdog (Watchdog)
- resource-quota-monitor (Sentinel)

---

### Office 3: Cost Governance Office (FinOps Office)

**Charter:** Garantir que o custo de operação da plataforma permaneça dentro dos budgets aprovados e identificar oportunidades de otimização.

**Metas:**
- Custo mensal dentro de ±10% do budget aprovado
- Alertas de desvio de custo em < 6 horas de ocorrência
- Relatório de otimização mensal com pelo menos 3 recomendações acionáveis

**SLAs:**
- Detecção de spike de custo > 20%: < 6 horas
- Relatório diário de custo: disponível até 06h UTC
- Budget breach action: automática em < 30 minutos após detecção

**Agents:**
- cost-sentinel (Sentinel)
- cost-sweep-batch (Batch)
- finops-report-agent (Governance)

---

### Office 4: Observability Office

**Charter:** Garantir que a plataforma tenha visibilidade completa de seu estado operacional através de métricas, logs, traces e alertas.

**Metas:**
- Cobertura de alertas: 100% dos serviços críticos com pelo menos um alerta configurado
- Alertas falsos positivos < 5% do total de alertas disparados
- MTTA (Mean Time To Alert): < 2 minutos para incidentes críticos

**SLAs:**
- Prometheus disponível: 99.9% (8.7h downtime/ano máximo)
- Grafana disponível: 99.5% (43.8h downtime/ano máximo)
- Loki ingestão: sem perda de logs em condições normais
- Alertas críticos: PagerDuty/Slack em < 1 minuto

**Agents:**
- observability-sentinel (Sentinel)
- alert-quality-agent (Governance)
- dashboard-sync-agent (Worker)

---

### Office 5: Security & Compliance Office

**Charter:** Garantir que a plataforma Velya opere em conformidade com requisitos de segurança de dados de saúde (LGPD, padrões hospitalares) e que incidentes de segurança sejam detectados e respondidos rapidamente.

**Metas:**
- Zero dados de pacientes expostos fora do namespace autorizado
- Scan de vulnerabilidades: 100% dos containers em < 24h de build
- Auditoria de RBAC: revisão completa mensal

**SLAs:**
- Detecção de violação de Network Policy: < 5 minutos
- Rotação de secrets: automática a cada 30 dias
- Resposta a incidente de segurança: primeira ação em < 15 minutos

**Agents:**
- security-sentinel (Sentinel)
- rbac-audit-agent (Governance)
- secret-rotation-agent (Worker)

---

### Office 6: Architecture Review Office

**Charter:** Garantir que todas as mudanças de arquitetura, novos agents e novos componentes atendam aos princípios definidos da plataforma Velya.

**Metas:**
- 100% dos novos agents revisados antes de deploy em produção
- Zero violações de princípios arquiteturais não detectadas em produção
- ADRs (Architecture Decision Records) criados para toda decisão de impacto médio+

**SLAs:**
- Revisão de proposta de novo agent: < 48 horas
- Revisão de ADR: < 72 horas
- Aprovação de multi-agent (Nível 3+): < 5 dias úteis

**Agents:**
- architecture-review-agent (Governance)
- adr-sync-agent (Worker)

---

### Office 7: Knowledge Office

**Charter:** Capturar, organizar e distribuir conhecimento institucional: playbooks, runbooks, lições aprendidas, decisões arquiteturais e documentação técnica.

**Metas:**
- Playbooks atualizados em < 24h após incidente resolvido
- 100% dos incidentes com post-mortem em < 72h
- Documentação de todos os agents aprovados

**SLAs:**
- Ingestão de learning event: < 1 hora após geração
- Publicação de playbook atualizado: < 24 horas
- Relatório semanal de knowledge: segunda-feira 08h UTC

**Agents:**
- knowledge-curator-agent (Learning)
- playbook-updater-agent (Worker)
- incident-reporter-agent (Governance)

---

### Office 8: Agent Factory Office

**Charter:** Gerenciar o ciclo de vida completo de agents: criação, revisão, shadow, aprovação, deploy, monitoramento e aposentadoria.

**Detalhes completos no documento `agent-factory-24x7.md`.**

**SLAs:**
- Proposta de agent na fila candidate-agents: avaliação inicial em < 8 horas
- Aprovação de agent padrão: < 5 dias
- Aposentadoria de agent obsoleto: < 30 dias após decisão

---

### Office 9: AI Gateway Office

**Charter:** Gerenciar o roteamento eficiente e econômico de chamadas de inferência LLM entre modelos disponíveis, garantindo custo controlado e qualidade de resposta.

**Metas:**
- Custo de inferência dentro do budget mensal
- Latência P99 de chamadas de LLM < 10 segundos
- Taxa de fallback para modelo menor: < 20% (indica problema de sizing)

**SLAs:**
- Roteamento de chamada: < 50ms de overhead
- Alerta de budget de inferência > 80%: imediato
- Fallback automático em caso de timeout: < 3 segundos

**Agents:**
- ai-gateway-sentinel (Sentinel)
- model-router-agent (Worker)
- inference-budget-watchdog (Watchdog)

---

### Office 10: Data Quality Office

**Charter:** Garantir a qualidade, consistência e integridade dos dados que entram e saem da plataforma Velya.

**Metas:**
- Taxa de validação de schema: 100% dos payloads de entrada
- Taxa de erros de dados detectados antes de persistência > 99%
- Relatório de qualidade de dados: diário

**SLAs:**
- Validação de payload de entrada: < 100ms
- Alerta de degradação de qualidade de dados: < 15 minutos
- Correção de inconsistência detectada: iniciada em < 1 hora

**Agents:**
- data-validation-agent (Governance)
- schema-sentinel (Sentinel)
- data-quality-report-agent (Batch)

---

### Office 11: Discharge Excellence Office

**Charter:** Otimizar o processo de alta hospitalar para reduzir atrasos, garantir segurança do paciente e melhorar a eficiência operacional.

**Metas:**
- Tempo médio de alta (ordem médica → saída do paciente) < 4 horas
- Taxa de readmissão em 30 dias < 8%
- 100% das altas com checklist completo documentado

**SLAs:**
- Início do workflow de alta: < 5 minutos após ordem médica
- Notificação de bloqueio no processo de alta: < 2 minutos
- Relatório de eficiência de alta: diário, por unidade

**Agents:**
- discharge-orchestrator-agent (Worker)
- discharge-sentinel (Sentinel)
- discharge-audit-agent (Governance)

---

### Office 12: Patient Flow Optimization Office

**Charter:** Analisar e otimizar o fluxo de pacientes entre setores do hospital para reduzir gargalos e melhorar a experiência do paciente.

**Metas:**
- Ocupação de leitos otimizada: variância < 15% do ideal
- Tempo de espera para transferência inter-setorial < 30 minutos
- Identificação proativa de gargalos antes de impacto ao paciente

**SLAs:**
- Atualização de mapa de ocupação: a cada 5 minutos
- Alerta de gargalo detectado: < 10 minutos após início
- Recomendação de redistribuição: < 15 minutos após detecção de gargalo

**Agents:**
- patient-flow-optimizer (Worker)
- bed-occupancy-sentinel (Sentinel)
- flow-analysis-agent (Batch)

---

### Office 13: Integration Office

**Charter:** Gerenciar as integrações da Velya com sistemas externos: HIS (Hospital Information System), laboratórios, farmácias, seguradoras e APIs de regulação.

**Metas:**
- Uptime de todas as integrações críticas > 99%
- Tempo de detecção de falha de integração < 5 minutos
- Zero mensagens perdidas em caso de falha temporária de integração

**SLAs:**
- Retry automático em falha de integração: início em < 30 segundos
- Alerta de integração crítica falhando: < 5 minutos
- Relatório de saúde de integrações: horário

**Agents:**
- integration-sentinel (Sentinel)
- integration-retry-worker (Worker)
- integration-health-watchdog (Watchdog)

---

### Office 14: Scheduling Office

**Charter:** Gerenciar e otimizar a agenda de exames, consultas e procedimentos para maximizar utilização de recursos e minimizar tempo de espera.

**Metas:**
- Taxa de utilização de salas de exame > 80% em horário de pico
- Tempo médio de espera para agendamento < 2 dias úteis para não-urgentes
- Taxa de no-show < 10% com confirmações automáticas

**SLAs:**
- Confirmação automática de agendamento: 24h antes
- Detecção de conflito de agenda: < 1 minuto
- Rescheduling automático por cancelamento: < 30 minutos

**Agents:**
- scheduling-optimizer-agent (Worker)
- appointment-sentinel (Sentinel)
- no-show-predictor-agent (Worker)

---

### Office 15: Validation Office

**Charter:** Executar validações de todos os outputs de agents antes de aplicação, garantindo que decisões automatizadas atendem às regras de negócio e protocolos clínicos.

**Metas:**
- 100% dos outputs de agents validados antes de aplicação
- Taxa de validações reprovadas com incidente gerado: 100%
- Tempo de validação < 5 segundos para validações não-LLM

**SLAs:**
- Validação de output de agent: < 5 segundos (regras determinísticas), < 30 segundos (LLM)
- Incidente gerado por falha de validação: < 1 minuto
- Relatório de validações reprovadas: horário

**Agents:**
- output-validator-agent (Governance)
- clinical-rule-validator (Governance)
- schema-validator-agent (Governance)

---

### Office 16: Audit Office

**Charter:** Manter trilha completa e imutável de todas as decisões automatizadas, ações de agents e mudanças de estado do sistema para fins de compliance e investigação.

**Metas:**
- 100% das decisões de agents auditadas
- Audit trail imutável: zero modificações pós-registro
- Pesquisa em audit trail: resultado em < 10 segundos

**SLAs:**
- Registro de audit event: < 500ms após evento
- Relatório de auditoria diária: disponível até 06h UTC
- Resposta a requisição de auditoria: < 4 horas

**Agents:**
- audit-recorder-agent (Governance)
- audit-integrity-sentinel (Sentinel)

---

### Office 17: Incident Response Office

**Charter:** Detectar, classificar, responder e documentar incidentes operacionais e de segurança com velocidade e coordenação.

**Metas:**
- MTTD (Mean Time To Detect): < 2 minutos para incidentes críticos
- MTTR (Mean Time To Recover): < 30 minutos para incidentes de Severidade 1
- Post-mortem: 100% dos incidentes S1 e S2 com post-mortem em < 48h

**SLAs:**
- Criação de incident ticket: < 3 minutos após detecção
- Notificação de on-call: < 5 minutos
- Status update: a cada 15 minutos durante incidente ativo

**Agents:**
- incident-detector-agent (Watchdog)
- incident-coordinator-agent (Worker)
- post-mortem-agent (Learning)

---

### Office 18: Watchdog Office

**Charter:** Supervisionar o comportamento de todos os outros agents e workflows, detectando e respondendo a anomalias de comportamento.

**Detalhes completos no documento `watchdog-model.md`.**

**SLAs:**
- Detecção de agent silencioso: < 3 minutos
- Detecção de queue buildup: < 5 minutos
- Escalação a Incident Response: < 2 minutos após confirmação de anomalia

---

### Office 19: Learning Office

**Charter:** Transformar incidentes, correções e feedbacks em melhorias sistemáticas da plataforma através de loops de aprendizado estruturados.

**Detalhes completos no documento `learning-loops-model.md`.**

**SLAs:**
- Ingestão de learning event: < 1 hora
- Proposta de melhoria gerada: < 24h após incidente
- Aprovação de mudança em template/validator: < 5 dias úteis

---

### Office 20: Market Intelligence Office

**Charter:** Monitorar o ecossistema tecnológico relevante para identificar oportunidades de melhoria, riscos emergentes e melhores práticas aplicáveis.

**Detalhes completos no documento `market-intelligence-loop-model.md`.**

**SLAs:**
- Sweep semanal: concluído até segunda-feira 08h UTC
- Relatório de inteligência: entregue ao Knowledge Office até terça-feira
- Alerta de risco emergente: < 24h após identificação

---

### Office 21: Retention & Quality Office

**Charter:** Monitorar e melhorar a qualidade de interações, satisfação de usuários clínicos e resultados de pacientes através da análise de feedbacks e métricas de uso.

**Metas:**
- Score de satisfação de usuários clínicos > 4.0/5.0
- Taxa de tarefas completadas sem retrabalho > 90%
- NPS de usuários internos > 40

**SLAs:**
- Coleta de feedback: processado em < 1 hora
- Relatório de qualidade: semanal, segunda-feira
- Alerta de degradação de qualidade percebida: < 24h

**Agents:**
- feedback-collector-agent (Worker)
- quality-trend-agent (Batch)
- ux-friction-sentinel (Sentinel)

---

### Office 22: Probation & Quarantine Office

**Charter:** Gerenciar agents em estados especiais (shadow, probation, quarantine, investigation) garantindo processo rigoroso de requalificação ou aposentadoria.

**Detalhes completos no documento `pause-resume-quarantine-model.md`.**

**SLAs:**
- Revisão de agent em probation: semanal
- Decisão de requalificação ou aposentadoria: < 30 dias de probation
- Relatório de quarantine ativa: diário

---

### Office 23: Infrastructure Automation Office

**Charter:** Automatizar operações de infraestrutura rotineiras: scaling, patching, backup, rotação de credenciais e manutenção de cluster.

**Metas:**
- 95% das operações rotineiras de infra executadas sem intervenção humana
- Zero downtime por patch de rotina
- Backup de configurações: 100% de sucesso diário

**SLAs:**
- Scaling automático (KEDA): < 2 minutos para novas réplicas
- Rotação de secrets: automática, sem interrupção de serviço
- Relatório de operações de infra: diário

**Agents:**
- infra-automation-agent (Worker)
- scaling-watchdog (Watchdog)
- backup-agent (Batch)

---

## 6. Dashboard de Estado 24/7

O estado atual de todos os offices é visível em um dashboard Grafana no namespace `velya-dev-observability`. URL local: `http://localhost:3000/d/velya-24x7-ops`

**Painéis principais:**
1. **Modo operacional atual** — gauge com cor por modo (verde=active, amarelo=degraded, vermelho=maintenance)
2. **Heartbeat map** — grade de agents com timestamp do último heartbeat
3. **Queue depths por office** — série temporal de lag de filas NATS
4. **DLQ growth rate** — taxa de crescimento de DLQs por office
5. **SLA aderência por office** — % de tarefas dentro do SLA nas últimas 24h
6. **Custo de inferência LLM** — por agent e por office, rolling 24h
7. **Score de qualidade por office** — médias ponderadas por office

---

## 7. Escalation Chain

Para qualquer incidente que não seja auto-resolvido em 5 minutos:

```
Nível 1 (0-5 min):    Agent automático tenta resolver
Nível 2 (5-15 min):   Watchdog escalada para Incident Response Office
Nível 3 (15-30 min):  Incident Response Office notifica on-call engineer
Nível 4 (30-60 min):  On-call engineer notifica tech lead da área
Nível 5 (60+ min):    Tech lead notifica CTO se impacto clínico confirmado
```

Todos os níveis são registrados com timestamp no audit trail e no sistema de ticketing.
