# Modelo de Reducao de Dependencia Manual

> **Principio**: Cada dependencia manual e um ponto de falha. O objetivo e
> reduzir a dependencia manual em 80% no primeiro trimestre, priorizando
> os itens de maior risco e frequencia.

## Visao Geral

Este documento mapeia todas as operacoes da plataforma Velya, classificando-as
como automaticas ou manuais. Para cada item manual, documenta por que ainda
e manual, a proposta de automacao, prioridade e esforco.

---

## Mapa: Automatico vs Manual

### Status Atual

```
+----------------------------------------------------------------------+
|              MAPA DE DEPENDENCIA MANUAL - VELYA PLATFORM             |
+----------------------------------------------------------------------+
|                                                                        |
|  [============================] 62% Automatico                        |
|  [============                ] 38% Manual                            |
|                                                                        |
|  Target Q1: [================================] 80% Automatico         |
|  Target Q2: [=====================================] 92% Automatico   |
|  Target Q4: [========================================] 97% Automatico|
|                                                                        |
+----------------------------------------------------------------------+
```

### Operacoes Automaticas (Ja Implementadas)

| #  | Operacao                              | Mecanismo                    | Intervalo  |
|----|----------------------------------------|------------------------------|------------|
| 1  | Heartbeat de servicos                 | Control Loop                 | 30s        |
| 2  | Deteccao de estado stale              | Control Loop                 | 1min       |
| 3  | Monitoramento de filas                | Control Loop                 | 30s        |
| 4  | Probe de endpoints                    | Control Loop                 | 1min       |
| 5  | Liveness de agents                    | Control Loop                 | 2min       |
| 6  | Deteccao de drift                     | Control Loop                 | 5min       |
| 7  | Deteccao de no-data                   | Control Loop                 | 5min       |
| 8  | GitOps deploy                         | ArgoCD                       | Continuo   |
| 9  | Auto-scaling de pods                  | HPA/VPA                      | Continuo   |
| 10 | Renovacao de certificados             | cert-manager + watchdog      | 1h         |
| 11 | Coleta de metricas                    | Prometheus                   | 15s        |
| 12 | Coleta de logs                        | Loki + Promtail              | Continuo   |
| 13 | Alertas baseados em regras            | Alertmanager                 | Continuo   |
| 14 | Backup de banco de dados              | CronJob + Veloci Backup      | Diario     |
| 15 | Restart de pods em CrashLoop          | Remediation Engine           | Automatico |
| 16 | Validacao pos-deploy                  | Release Validation Agent     | Event      |
| 17 | Smoke tests continuos                 | Synthetic Validation Agent   | 5min       |
| 18 | Validacao de auth                     | Auth Validation Agent        | 5min       |
| 19 | Validacao de dashboards               | Dashboard Validation Agent   | 15min      |
| 20 | Fingerprint de erros                  | Learning Pipeline            | 5min       |
| 21 | Geracrao de backlog                   | Backlog Generator            | 15min      |

### Operacoes Ainda Manuais

| #  | Operacao                              | Frequencia Real | Risco    | Status     |
|----|----------------------------------------|-----------------|----------|------------|
| M1 | Revisao de logs de auditoria          | Semanal         | Alto     | Manual     |
| M2 | Revisao de roles e permissoes         | Mensal          | Alto     | Manual     |
| M3 | Teste de disaster recovery            | Trimestral      | Critico  | Manual     |
| M4 | Revisao de politicas de rede          | Mensal          | Alto     | Manual     |
| M5 | Atualizacao de dependencias           | Semanal         | Medio    | Semi-auto  |
| M6 | Revisao de custos de infraestrutura   | Mensal          | Baixo    | Manual     |
| M7 | Validacao de compliance LGPD          | Mensal          | Alto     | Manual     |
| M8 | Revisao de SLAs com parceiros         | Trimestral      | Medio    | Manual     |
| M9 | Onboarding de novos servicos          | Sob demanda     | Medio    | Semi-auto  |
| M10| Offboarding de servicos deprecated    | Sob demanda     | Medio    | Manual     |
| M11| Rotacao de credenciais externas       | Trimestral      | Critico  | Manual     |
| M12| Revisao de capacidade/sizing          | Mensal          | Medio    | Manual     |
| M13| Atualizacao de runbooks               | Sob demanda     | Medio    | Manual     |
| M14| Treinamento de equipe em novos proc   | Sob demanda     | Baixo    | Manual     |
| M15| Revisao pos-incidente formal          | Pos-incidente   | Alto     | Manual     |
| M16| Validacao de backup restore           | Mensal          | Critico  | Semi-auto  |
| M17| Benchmark de performance              | Mensal          | Medio    | Manual     |
| M18| Scan de vulnerabilidades (profundo)   | Mensal          | Alto     | Semi-auto  |
| M19| Revisao de metricas de negocio        | Semanal         | Baixo    | Manual     |
| M20| Decisao de scale permanente           | Sob demanda     | Medio    | Manual     |

---

## Detalhamento de Cada Item Manual

### M1: Revisao de Logs de Auditoria

```yaml
operacao: revisao-logs-auditoria
status: manual
frequencia: semanal
risco_se_esquecido: alto (compliance)
tempo_medio: 2h por revisao

por_que_manual: |
  A revisao requer julgamento humano para identificar padroes suspeitos
  que nao se encaixam em regras pre-definidas. Regras automaticas pegam
  violacoes obvias, mas anomalias sutis requerem contexto de negocio.

proposta_automacao:
  fase_1:
    descricao: "Alertas automaticos para padroes conhecidos"
    items:
      - Acesso fora de horario
      - Acesso a dados de pacientes nao-atribuidos
      - Volume anomalo de acessos por usuario
      - Tentativas de acesso negado repetidas
    esforco: small
    prioridade: P1
    reducao_manual: 60%

  fase_2:
    descricao: "Relatorio automatico semanal com anomalias destacadas"
    items:
      - Score de risco por usuario/sessao
      - Comparacao com baseline da semana anterior
      - Desvios estatisticos automaticos
    esforco: medium
    prioridade: P2
    reducao_manual: 30%

  residual_manual: 10%
  justificativa: "Revisao de anomalias edge-case que requerem julgamento"
```

### M2: Revisao de Roles e Permissoes

```yaml
operacao: revisao-roles-permissoes
status: manual
frequencia: mensal
risco_se_esquecido: alto (security)
tempo_medio: 4h por revisao

por_que_manual: |
  Decisoes de acesso requerem entendimento do contexto organizacional
  (quem saiu, quem mudou de funcao, quem precisa de acesso temporario).

proposta_automacao:
  fase_1:
    descricao: "Deteccao automatica de permissoes nao-utilizadas"
    items:
      - Roles atribuidos mas nunca usados (30d)
      - Service accounts sem atividade
      - Tokens sem uso
      - Permissoes excessivas (least privilege check)
    esforco: medium
    prioridade: P1
    reducao_manual: 50%

  fase_2:
    descricao: "Access review automatizado com aprovacao por email"
    items:
      - Envio mensal de relatorio de permissoes para cada manager
      - Confirmacao ou revogacao com um click
      - Auto-revogacao apos 14 dias sem confirmacao
    esforco: large
    prioridade: P2
    reducao_manual: 40%

  residual_manual: 10%
  justificativa: "Aprovacao de novas permissoes e excecoes"
```

### M3: Teste de Disaster Recovery

```yaml
operacao: teste-disaster-recovery
status: manual
frequencia: trimestral
risco_se_esquecido: critico
tempo_medio: 8h por teste

por_que_manual: |
  DR test envolve cenarios complexos e decisoes em tempo real que
  variam a cada execucao. O ambiente de DR precisa ser provisionado
  e o processo de failover tem passos criticos.

proposta_automacao:
  fase_1:
    descricao: "Automacao do provisionamento de ambiente DR"
    items:
      - Terraform/Pulumi para criar ambiente DR sob demanda
      - Restore automatico de backups no ambiente DR
      - Verificacao automatica de integridade pos-restore
    esforco: large
    prioridade: P1
    reducao_manual: 40%

  fase_2:
    descricao: "Game day automatizado com checklist interativo"
    items:
      - Script de failover com confirmacoes em pontos criticos
      - Validacao automatica de cada etapa
      - Metricas de RTO/RPO coletadas automaticamente
    esforco: large
    prioridade: P2
    reducao_manual: 30%

  residual_manual: 30%
  justificativa: "Decisoes de failover em cenarios nao-previstos"
```

### M4: Revisao de Politicas de Rede

```yaml
operacao: revisao-politicas-rede
status: manual
frequencia: mensal
risco_se_esquecido: alto (security)
tempo_medio: 2h por revisao

por_que_manual: |
  NetworkPolicies sao criticas para seguranca. Mudancas incorretas
  podem expor servicos ou bloquear comunicacao legitima.

proposta_automacao:
  fase_1:
    descricao: "Drift detection automatico para NetworkPolicies"
    items:
      - Comparar policies aplicadas vs declaradas no Git
      - Alertar sobre policies ausentes ou extras
      - Visualizacao automatica do mapa de rede
    esforco: small
    prioridade: P1
    reducao_manual: 50%

  fase_2:
    descricao: "Validacao automatica de principio de menor privilegio"
    items:
      - Analisar trafego real vs policies
      - Sugerir restricoes adicionais
      - Detectar policies muito permissivas
    esforco: medium
    prioridade: P2
    reducao_manual: 30%

  residual_manual: 20%
  justificativa: "Aprovacao de novas regras de rede"
```

### M5: Atualizacao de Dependencias

```yaml
operacao: atualizacao-dependencias
status: semi-automatico
frequencia: semanal
risco_se_esquecido: medio (security)
tempo_medio: 3h por ciclo

por_que_manual: |
  Dependabot/Renovate cria PRs automaticamente, mas a decisao de
  merge e a resolucao de conflitos ainda sao manuais.

proposta_automacao:
  fase_1:
    descricao: "Auto-merge para patches de seguranca"
    items:
      - Auto-merge se CI passa e e patch/minor sem breaking change
      - Security patches merged automaticamente
      - Agrupamento de updates menores
    esforco: small
    prioridade: P1
    reducao_manual: 60%

  fase_2:
    descricao: "Teste automatico de compatibilidade para major updates"
    items:
      - Suite de testes expandida para updates
      - Canary deploy automatico para testar update
      - Relatorio de impacto automatico
    esforco: medium
    prioridade: P3
    reducao_manual: 25%

  residual_manual: 15%
  justificativa: "Major version updates com breaking changes"
```

### M11: Rotacao de Credenciais Externas

```yaml
operacao: rotacao-credenciais-externas
status: manual
frequencia: trimestral
risco_se_esquecido: critico (security)
tempo_medio: 4h por rotacao

por_que_manual: |
  Credenciais externas (APIs de terceiros, integraces) requerem
  coordenacao com os provedores e atualizacao em multiplos locais.

proposta_automacao:
  fase_1:
    descricao: "Inventario automatico com alertas de expiracao"
    items:
      - Catalogo de todas as credenciais externas
      - Alerta 30 dias antes da expiracao
      - Alerta se credencial sem rotacao > 90 dias
    esforco: small
    prioridade: P1
    reducao_manual: 30%

  fase_2:
    descricao: "Rotacao automatica para provedores com API"
    items:
      - Scripts de rotacao para cada provedor
      - External Secrets Operator
      - Validacao pos-rotacao automatica
    esforco: large
    prioridade: P2
    reducao_manual: 50%

  residual_manual: 20%
  justificativa: "Provedores sem API de rotacao"
```

### M16: Validacao de Backup Restore

```yaml
operacao: validacao-backup-restore
status: semi-automatico
frequencia: mensal
risco_se_esquecido: critico
tempo_medio: 3h por validacao

por_que_manual: |
  Restore requer ambiente isolado e verificacao de integridade
  de dados que vai alem de checksums (verificacao funcional).

proposta_automacao:
  fase_1:
    descricao: "Restore automatico em ambiente efemero"
    items:
      - Criar namespace temporario
      - Restore do ultimo backup
      - Queries de validacao automaticas
      - Comparar counts/checksums com producao
      - Destruir namespace
    esforco: medium
    prioridade: P1
    reducao_manual: 70%

  fase_2:
    descricao: "Validacao funcional pos-restore"
    items:
      - Smoke tests contra dados restaurados
      - Verificacao de integridade referencial
      - Relatorio automatico
    esforco: medium
    prioridade: P2
    reducao_manual: 20%

  residual_manual: 10%
  justificativa: "Validacao de cenarios especificos de corrupcao"
```

---

## Plano de Reducao por Trimestre

### Q1: De 62% para 80% (Target: 80% automatico)

| Item | Operacao                    | Fase | Esforco | Reducao | Owner          |
|------|-----------------------------|------|---------|---------|----------------|
| M1   | Logs de auditoria           | F1   | Small   | 60%     | security-team  |
| M2   | Roles e permissoes          | F1   | Medium  | 50%     | security-team  |
| M4   | Politicas de rede           | F1   | Small   | 50%     | platform-team  |
| M5   | Dependencias                | F1   | Small   | 60%     | platform-team  |
| M11  | Credenciais externas        | F1   | Small   | 30%     | security-team  |
| M16  | Backup restore              | F1   | Medium  | 70%     | platform-team  |
| M18  | Scan vulnerabilidades       | F1   | Small   | 50%     | security-team  |

**Impacto Q1**: 7 itens parcialmente automatizados = ~18% de reducao manual

### Q2: De 80% para 92% (Target: 92% automatico)

| Item | Operacao                    | Fase | Esforco | Reducao | Owner          |
|------|-----------------------------|------|---------|---------|----------------|
| M1   | Logs de auditoria           | F2   | Medium  | 30%     | security-team  |
| M2   | Roles e permissoes          | F2   | Large   | 40%     | security-team  |
| M3   | Disaster recovery           | F1   | Large   | 40%     | platform-team  |
| M4   | Politicas de rede           | F2   | Medium  | 30%     | platform-team  |
| M11  | Credenciais externas        | F2   | Large   | 50%     | security-team  |
| M12  | Capacidade/sizing           | F1   | Medium  | 60%     | platform-team  |
| M17  | Benchmark performance       | F1   | Medium  | 70%     | platform-team  |

### Q3-Q4: De 92% para 97% (Target: 97% automatico)

| Item | Operacao                    | Fase | Esforco | Reducao | Owner          |
|------|-----------------------------|------|---------|---------|----------------|
| M3   | Disaster recovery           | F2   | Large   | 30%     | platform-team  |
| M5   | Dependencias                | F2   | Medium  | 25%     | platform-team  |
| M9   | Onboarding servicos         | F2   | Large   | 80%     | platform-team  |
| M10  | Offboarding servicos        | F1   | Medium  | 70%     | platform-team  |

---

## Metricas de Reducao

```yaml
metrics:
  - name: velya_manual_operations_total
    type: gauge
    help: "Total de operacoes identificadas"

  - name: velya_automated_operations_total
    type: gauge
    help: "Total de operacoes automatizadas"

  - name: velya_automation_ratio
    type: gauge
    help: "Ratio de automacao (0-1)"

  - name: velya_manual_time_hours_monthly
    type: gauge
    labels: [operation]
    help: "Horas manuais gastas por mes por operacao"

  - name: velya_manual_risk_score
    type: gauge
    labels: [operation]
    help: "Score de risco da operacao manual (1-10)"

  - name: velya_automation_target_ratio
    type: gauge
    labels: [quarter]
    help: "Target de automacao por trimestre"
```

### Alertas

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: manual-dependency-alerts
  namespace: velya-autonomy
spec:
  groups:
    - name: manual-dependency
      rules:
        - alert: ManualOperationOverdue
          expr: |
            velya_manual_operation_last_execution_timestamp + 
            velya_manual_operation_expected_interval < time()
          for: 24h
          labels:
            severity: warning
          annotations:
            summary: "Operacao manual {{ $labels.operation }} atrasada"

        - alert: AutomationRatioBelowTarget
          expr: |
            velya_automation_ratio < velya_automation_target_ratio{quarter="current"}
          for: 7d
          labels:
            severity: info
          annotations:
            summary: "Ratio de automacao ({{ $value }}) abaixo do target"

        - alert: HighRiskManualOperation
          expr: |
            velya_manual_risk_score > 7 
            and velya_manual_operation_automated == 0
          labels:
            severity: warning
          annotations:
            summary: "Operacao manual de alto risco nao automatizada: {{ $labels.operation }}"
```

---

## Decisao Tree: Automatizar Agora?

```
Operacao manual identificada
  |
  v
Risco se esquecida?
  |
  +-- Critico --> Automatizar Q1 (F1)
  |
  +-- Alto --> Frequencia?
  |              |
  |              +-- Semanal+ --> Automatizar Q1
  |              +-- Mensal   --> Automatizar Q1-Q2
  |              +-- Raro     --> Alerta + schedule de revisao
  |
  +-- Medio --> Custo de automacao?
  |              |
  |              +-- Small  --> Automatizar Q1 (quick win)
  |              +-- Medium --> Automatizar Q2
  |              +-- Large  --> Avaliar ROI, planejar Q3
  |
  +-- Baixo --> Frequencia alta e tempo > 2h?
                 |
                 +-- Sim --> Automatizar Q2-Q3
                 +-- Nao --> Manter manual, monitorar
```

---

## Dashboard de Reducao Manual

```yaml
# Grafana dashboard para acompanhar reducao de dependencia manual
dashboard:
  uid: velya-manual-reduction
  title: "Reducao de Dependencia Manual"
  panels:
    - title: "Ratio de Automacao"
      type: stat
      query: velya_automation_ratio
      thresholds:
        - value: 0
          color: red
        - value: 0.7
          color: yellow
        - value: 0.9
          color: green

    - title: "Operacoes Manuais vs Automaticas"
      type: piechart
      queries:
        - "velya_automated_operations_total"
        - "velya_manual_operations_total"

    - title: "Horas Manuais por Mes"
      type: timeseries
      query: sum(velya_manual_time_hours_monthly)

    - title: "Top 10 Operacoes Manuais por Tempo"
      type: table
      query: topk(10, velya_manual_time_hours_monthly)

    - title: "Operacoes Manuais de Alto Risco"
      type: table
      query: velya_manual_risk_score > 5

    - title: "Progresso por Trimestre"
      type: bargauge
      queries:
        - 'velya_automation_ratio'
        - 'velya_automation_target_ratio{quarter="Q1"}'
        - 'velya_automation_target_ratio{quarter="Q2"}'
        - 'velya_automation_target_ratio{quarter="Q4"}'
```
