# Revisao de Acesso e Recertificacao

**Modulo:** Velya Access Control - Access Review & Recertification  
**Versao:** 1.0.0  
**Data:** 2026-04-08  
**Classificacao:** Interno - Compliance e Governanca  
**Responsavel:** Time de Plataforma Velya  

---

## 1. Visao Geral

A revisao periodica de acessos garante que permissoes concedidas permanecem adequadas ao longo do tempo. Sem revisao ativa, os acessos tendem a acumular (privilege creep), usuarios inativos mantem permissoes, e funcionarios transferidos retêm acessos de unidades anteriores.

O Velya implementa um ciclo de revisao em duas camadas:

1. **Recertificacao trimestral** pelo gestor da unidade (foco operacional).
2. **Recertificacao semestral** pela equipe de compliance (foco regulatorio).

Alem disso, gatilhos automaticos revogam acessos quando condicoes predefinidas sao detectadas.

---

## 2. Ciclo de Recertificacao

### 2.1 Calendario

| Ciclo | Frequencia | Responsavel | Escopo | SLA para Conclusao |
|---|---|---|---|---|
| Trimestral (Q1-Q4) | A cada 3 meses | Gestor de cada unidade | Usuarios da unidade | 15 dias uteis |
| Semestral (S1-S2) | A cada 6 meses | Equipe de Compliance | Todos os usuarios | 30 dias uteis |
| Ad-hoc | Sob demanda | Seguranca da Informacao | Usuarios especificos | 5 dias uteis |
| Pos-incidente | Apos incidente de seguranca | CISO | Usuarios envolvidos | 48 horas |

### 2.2 Calendario Anual

| Mes | Atividade | Responsavel |
|---|---|---|
| Janeiro | Recertificacao Q1 (trimestral) + S1 (semestral) | Gestores + Compliance |
| Fevereiro | Conclusao Q1/S1 + Relatorio | Compliance |
| Marco | - | - |
| Abril | Recertificacao Q2 (trimestral) | Gestores |
| Maio | Conclusao Q2 + Relatorio | Compliance |
| Junho | - | - |
| Julho | Recertificacao Q3 (trimestral) + S2 (semestral) | Gestores + Compliance |
| Agosto | Conclusao Q3/S2 + Relatorio | Compliance |
| Setembro | - | - |
| Outubro | Recertificacao Q4 (trimestral) | Gestores |
| Novembro | Conclusao Q4 + Relatorio anual | Compliance |
| Dezembro | Revisao de politicas de acesso | CISO + Compliance |

---

## 3. Gatilhos Automaticos de Revogacao

### 3.1 Eventos que Disparam Revogacao Imediata

| Gatilho | Deteccao | Acao | Tempo de Execucao |
|---|---|---|---|
| Fim de contrato | Integracao com RH (data_fim_contrato) | Desativar usuario + revogar todos os papeis | Imediato (T+0) |
| Demissao | Integracao com RH (status = desligado) | Desativar usuario + revogar todos os papeis | Imediato (T+0) |
| Transferencia de unidade | Integracao com RH (unidade alterada) | Revogar papeis da unidade anterior | 24 horas |
| Suspensao de credencial | Integracao com conselho (CRM/COREN suspenso) | Revogar papel clinico | Imediato (T+0) |
| Licenca medica > 30 dias | Integracao com RH (tipo_afastamento) | Suspender acesso (reativar no retorno) | Ao detectar |
| Licenca maternidade/paternidade | Integracao com RH | Suspender acesso (reativar no retorno) | Ao detectar |
| Ferias > 15 dias | Integracao com RH (ferias) | Suspender acesso (reativar no retorno) | Ao detectar |
| Incidente de seguranca | Sistema de incidentes (usuario envolvido) | Suspender acesso + investigar | Imediato (T+0) |

### 3.2 Deteccao de Contas Inativas

| Condicao | Acao | Reversivel |
|---|---|---|
| Sem login ha > 60 dias | Notificacao ao gestor | N/A (aviso) |
| Sem login ha > 90 dias | Desativar conta | Sim (reativacao pelo gestor) |
| Sem login ha > 180 dias | Arquivar conta + revogar papeis | Sim (requer aprovacao dupla) |
| Sem login ha > 365 dias | Deletar conta (preservar auditoria) | Nao |
| Conta de servico sem uso > 30 dias | Alerta para equipe de TI | N/A |

### 3.3 Deteccao de Acumulo de Papeis (Role Accumulation)

| Condicao | Indicador | Acao |
|---|---|---|
| Usuario com > 3 papeis ativos | Acumulo potencial | Revisao obrigatoria pelo gestor |
| Usuario com papeis em > 2 unidades | Transferencia nao tratada | Verificar com RH |
| Papel atribuido ha > 1 ano sem recertificacao | Papel potencialmente obsoleto | Forcar recertificacao |
| Papeis com conflito toxico | Combinacao proibida (ex: prescritor + dispensador) | Revogar imediatamente + alertar |
| Papel nao utilizado > 90 dias | Papel potencialmente desnecessario | Sugerir revogacao ao gestor |

### 3.4 Deteccao de Privilege Creep

Para detectar privilege creep, o sistema compara o conjunto atual de permissoes com o perfil inicial do usuario:

```
Perfil Inicial (admissao)          Perfil Atual              Analise
+-------------------------+    +-------------------------+    +-------------------------+
| Papeis: 1               |    | Papeis: 4               |    | Acrescimo: +3 papeis    |
| - enfermeiro            |    | - enfermeiro            |    |                         |
|                         |    | - enfermeiro_uti         |    | Papeis novos:           |
| Unidades: 1             |    | - supervisor_turno      |    | - enfermeiro_uti        |
| - Enfermaria 2B         |    | - gestor_estoque        |    | - supervisor_turno     |
|                         |    |                         |    | - gestor_estoque       |
| Permissoes: 45          |    | Unidades: 3             |    |                         |
|                         |    | - Enfermaria 2B         |    | Unidades novas: +2     |
|                         |    | - UTI Adulto            |    | Permissoes: +82        |
|                         |    | - Farmacia              |    |                         |
|                         |    |                         |    | ALERTA: Creep detectado|
|                         |    | Permissoes: 127         |    | Revisao obrigatoria    |
+-------------------------+    +-------------------------+    +-------------------------+
```

---

## 4. Fluxo de Recertificacao

### 4.1 Recertificacao Trimestral (Gestor)

```
Sistema         Gestor Unidade    Usuario Revisado    RBAC Engine      Audit Log
   |                  |                |                  |               |
   |--[Gerar lista    |                |                  |               |
   |  de usuarios     |                |                  |               |
   |  da unidade]--->|                |                  |               |
   |                  |                |                  |               |
   |--[Notificar:     |                |                  |               |
   |  recertificacao  |                |                  |               |
   |  iniciada]------>|                |                  |               |
   |                  |                |                  |               |
   |  Para cada usuario:               |                  |               |
   |                  |                |                  |               |
   |--[Exibir:        |                |                  |               |
   |  - Nome          |                |                  |               |
   |  - Papeis        |                |                  |               |
   |  - Ultimo login  |                |                  |               |
   |  - Uso de papeis |                |                  |               |
   |  - Alertas]----->|                |                  |               |
   |                  |                |                  |               |
   |                  |--[Decisao:     |                  |               |
   |                  |  Manter /      |                  |               |
   |                  |  Revogar /     |                  |               |
   |                  |  Modificar]--->|                  |               |
   |                  |                |                  |               |
   |   Se REVOGAR:    |                |                  |               |
   |                  |--[Notificar    |                  |               |
   |                  |  usuario]----->|                  |               |
   |                  |                |                  |               |
   |                  |--[Aplicar      |                  |               |
   |                  |  revogacao]----|----------------->|               |
   |                  |                |                  |--[Revogar     |
   |                  |                |                  |  papel]       |
   |                  |                |                  |--[Emitir      |
   |                  |                |                  |  evento]----->|
   |                  |                |                  |               |
   |   Se MODIFICAR:  |                |                  |               |
   |                  |--[Propor       |                  |               |
   |                  |  alteracao]--->|                  |               |
   |                  |                |--[Aceitar /      |               |
   |                  |                |  Contestar]      |               |
   |                  |                |                  |               |
   |  Ao final:       |                |                  |               |
   |                  |--[Assinar      |                  |               |
   |                  |  recertificacao|                  |               |
   |                  |  digitalmente] |                  |               |
   |                  |                |                  |               |
   |--[Gerar          |                |                  |               |
   |  relatorio]----->|                |                  |               |
```

### 4.2 Informacoes Disponibilizadas ao Gestor

Para cada usuario na lista de recertificacao, o gestor recebe:

| Informacao | Descricao | Fonte |
|---|---|---|
| Nome completo | Nome do colaborador | RH |
| Cargo | Cargo funcional | RH |
| Profissao/Conselho | CRM, COREN, etc. | RH |
| Data de admissao | Inicio do vinculo | RH |
| Unidade atual | Unidade atribuida | RH |
| Papeis ativos | Lista de papeis no RBAC | RBAC Engine |
| Data de atribuicao | Quando cada papel foi concedido | RBAC Engine |
| Ultimo login | Data do ultimo acesso | Session Store |
| Frequencia de uso | Media de logins/semana | Metricas |
| Uso por papel | Quais papeis foram efetivamente usados | Audit Log |
| Alertas pendentes | Anomalias detectadas | Anomaly Detection |
| Historico de recertificacao | Resultado da ultima revisao | Compliance DB |
| Perfil inicial vs. atual | Comparacao de permissoes | Privilege Creep Detection |

### 4.3 Decisoes Possiveis

| Decisao | Descricao | Requer Justificativa | Efeito |
|---|---|---|---|
| **Manter** | Acesso atual e adequado | Nao | Nenhuma alteracao |
| **Revogar papel** | Papel especifico nao e mais necessario | Sim | Papel removido |
| **Revogar todos** | Usuario nao deveria ter acesso | Sim | Conta suspensa |
| **Modificar** | Trocar papel por outro mais adequado | Sim | Papel substituido |
| **Escalar** | Gestor nao consegue decidir | Sim | Encaminhar para Compliance |
| **Contestar** | Usuario pode contestar revogacao | - | Prazo de 5 dias uteis |

---

## 5. Automacao de Verificacoes

### 5.1 CronJob: Deteccao de Contas Inativas

```yaml
# cronjob-stale-account-detection.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: stale-account-detection
  namespace: velya-access
  labels:
    app: velya-access-review
    component: stale-detection
spec:
  schedule: "0 2 * * *"  # Todo dia as 2h da manha
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 7
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        metadata:
          labels:
            app: velya-access-review
            job: stale-detection
        spec:
          serviceAccountName: access-review-sa
          containers:
            - name: stale-detector
              image: velya/access-review-tools:1.0.0
              command:
                - /bin/sh
                - -c
                - |
                  echo "=== Deteccao de Contas Inativas ==="
                  echo "Data: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

                  # 1. Contas sem login > 60 dias - AVISO
                  access-review detect-stale \
                    --threshold-days 60 \
                    --action notify \
                    --notify-role gestor_unidade \
                    --output /tmp/stale-60d.json

                  # 2. Contas sem login > 90 dias - DESATIVAR
                  access-review detect-stale \
                    --threshold-days 90 \
                    --action disable \
                    --notify-role gestor_unidade \
                    --notify-role compliance \
                    --output /tmp/stale-90d.json

                  # 3. Contas sem login > 180 dias - ARQUIVAR
                  access-review detect-stale \
                    --threshold-days 180 \
                    --action archive \
                    --require-dual-approval \
                    --notify-role compliance \
                    --notify-role ciso \
                    --output /tmp/stale-180d.json

                  # 4. Contas de servico sem uso > 30 dias
                  access-review detect-stale \
                    --account-type service \
                    --threshold-days 30 \
                    --action notify \
                    --notify-role ti_manager \
                    --output /tmp/stale-svc-30d.json

                  # 5. Publicar metricas
                  access-review push-metrics \
                    --stale-60 /tmp/stale-60d.json \
                    --stale-90 /tmp/stale-90d.json \
                    --stale-180 /tmp/stale-180d.json \
                    --stale-svc /tmp/stale-svc-30d.json

                  echo "=== Deteccao concluida ==="
              env:
                - name: RBAC_API_URL
                  value: "http://velya-rbac-engine.velya-access:8080"
                - name: SESSION_STORE_URL
                  value: "redis://velya-session-redis.velya-access:6379"
                - name: HR_API_URL
                  value: "http://velya-hr-integration.velya-access:8080"
                - name: NOTIFICATION_URL
                  value: "http://velya-notification.velya-platform:8080"
                - name: PUSHGATEWAY_URL
                  value: "http://pushgateway.observability:9091"
              resources:
                requests:
                  memory: "128Mi"
                  cpu: "100m"
                limits:
                  memory: "256Mi"
                  cpu: "200m"
          restartPolicy: OnFailure
```

### 5.2 CronJob: Deteccao de Acumulo de Papeis

```yaml
# cronjob-role-accumulation-detection.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: role-accumulation-detection
  namespace: velya-access
spec:
  schedule: "0 3 * * 1"  # Toda segunda-feira as 3h
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: access-review-sa
          containers:
            - name: role-accumulation
              image: velya/access-review-tools:1.0.0
              command:
                - /bin/sh
                - -c
                - |
                  echo "=== Deteccao de Acumulo de Papeis ==="

                  # 1. Usuarios com mais de 3 papeis
                  access-review detect-accumulation \
                    --max-roles 3 \
                    --action flag-for-review \
                    --output /tmp/accumulation.json

                  # 2. Usuarios com papeis em multiplas unidades
                  access-review detect-cross-unit \
                    --max-units 2 \
                    --action flag-for-review \
                    --output /tmp/cross-unit.json

                  # 3. Combinacoes toxicas de papeis
                  access-review detect-toxic-combinations \
                    --policy /etc/velya/toxic-combinations.yaml \
                    --action revoke-and-alert \
                    --output /tmp/toxic.json

                  # 4. Privilege creep (comparacao com perfil inicial)
                  access-review detect-privilege-creep \
                    --growth-threshold 50 \
                    --action flag-for-review \
                    --output /tmp/creep.json

                  # 5. Papeis nao utilizados > 90 dias
                  access-review detect-unused-roles \
                    --threshold-days 90 \
                    --action suggest-revocation \
                    --output /tmp/unused-roles.json

                  # 6. Gerar relatorio consolidado
                  access-review generate-report \
                    --accumulation /tmp/accumulation.json \
                    --cross-unit /tmp/cross-unit.json \
                    --toxic /tmp/toxic.json \
                    --creep /tmp/creep.json \
                    --unused /tmp/unused-roles.json \
                    --format html \
                    --send-to compliance@hospital.com.br

                  echo "=== Analise concluida ==="
              volumeMounts:
                - name: config
                  mountPath: /etc/velya
                  readOnly: true
              resources:
                requests:
                  memory: "256Mi"
                  cpu: "200m"
                limits:
                  memory: "512Mi"
                  cpu: "500m"
          volumes:
            - name: config
              configMap:
                name: access-review-config
          restartPolicy: OnFailure
```

### 5.3 CronJob: Integracao com RH para Desligamentos

```yaml
# cronjob-hr-offboarding-sync.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: hr-offboarding-sync
  namespace: velya-access
spec:
  schedule: "*/15 * * * *"  # A cada 15 minutos
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: access-review-sa
          containers:
            - name: hr-sync
              image: velya/access-review-tools:1.0.0
              command:
                - /bin/sh
                - -c
                - |
                  # Sincronizar com sistema de RH
                  access-review hr-sync \
                    --check-terminations \
                    --check-transfers \
                    --check-leaves \
                    --check-credential-status \
                    --auto-revoke-on-termination \
                    --auto-suspend-on-leave \
                    --auto-adjust-on-transfer \
                    --notify-on-action
              env:
                - name: HR_API_URL
                  value: "http://velya-hr-integration.velya-access:8080"
                - name: HR_API_KEY
                  valueFrom:
                    secretKeyRef:
                      name: hr-integration-credentials
                      key: api_key
              resources:
                requests:
                  memory: "128Mi"
                  cpu: "100m"
                limits:
                  memory: "256Mi"
                  cpu: "200m"
          restartPolicy: OnFailure
```

---

## 6. Combinacoes Toxicas de Papeis

### 6.1 Matriz de Incompatibilidade

| Papel A | Papel B | Risco | Motivo |
|---|---|---|---|
| `medico_prescritor` | `farmaceutico_dispensador` | Critico | Separacao de prescricao e dispensacao |
| `medico_solicitante` | `medico_laudista` | Alto | Separacao de solicitacao e laudo |
| `enfermeiro_checagem` | `farmaceutico_dispensador` | Alto | Separacao de dispensacao e administracao |
| `gestor_usuarios` | `auditor_acesso` | Alto | Quem cria acesso nao pode auditar |
| `dba_producao` | `security_analyst` | Medio | Separacao de operacao e seguranca |
| `faturista` | `gestor_financeiro` | Alto | Separacao de registro e aprovacao |
| `recepcao` | `gestor_leitos` | Medio | Separacao de admissao e alocacao |

### 6.2 Configuracao de Combinacoes Toxicas

```yaml
# toxic-combinations.yaml
toxic_combinations:
  - id: "TC-001"
    name: "Prescricao + Dispensacao"
    severity: "critical"
    roles:
      - "medico_prescritor"
      - "farmaceutico_dispensador"
    action: "block_assignment"
    rationale: >
      A separacao entre quem prescreve e quem dispensa e um controle
      fundamental de seguranca do paciente, prevenindo erros de
      medicacao e fraudes.
    exceptions: []

  - id: "TC-002"
    name: "Solicitacao + Laudo"
    severity: "high"
    roles:
      - "medico_solicitante"
      - "medico_laudista"
    action: "block_for_same_patient"
    rationale: >
      O medico que solicita um exame nao deve ser o mesmo que
      emite o laudo, exceto em situacoes de emergencia.
    exceptions:
      - condition: "plantao_unico"
        approval: "diretor_clinico"

  - id: "TC-003"
    name: "Criacao de Usuario + Auditoria"
    severity: "high"
    roles:
      - "gestor_usuarios"
      - "auditor_acesso"
    action: "block_assignment"
    rationale: >
      Quem cria e gerencia contas de usuario nao pode ser responsavel
      por auditar os acessos desses mesmos usuarios.
    exceptions: []

  - id: "TC-004"
    name: "Faturamento + Aprovacao Financeira"
    severity: "high"
    roles:
      - "faturista"
      - "gestor_financeiro"
    action: "block_assignment"
    rationale: >
      Separacao de deveres entre quem registra cobranças e quem
      aprova pagamentos e lancamentos.
    exceptions: []

  - id: "TC-005"
    name: "Checagem de Medicacao + Dispensacao"
    severity: "high"
    roles:
      - "enfermeiro_checagem"
      - "farmaceutico_dispensador"
    action: "block_assignment"
    rationale: >
      Quem administra o medicamento ao paciente nao deve ser o
      mesmo que dispensou da farmacia.
    exceptions: []
```

---

## 7. Template de Relatorio de Recertificacao

### 7.1 Relatorio Trimestral por Unidade

```
+================================================================+
|        RELATORIO DE RECERTIFICACAO DE ACESSO - TRIMESTRAL      |
+================================================================+

Periodo:        Q2/2026 (Abril - Junho)
Unidade:        UTI Adulto
Gestor:         Enf. Ana Paula Costa (COREN-SP 123456)
Data Conclusao: 2026-05-10
Status:         CONCLUIDO

+----------------------------------------------------------------+
| RESUMO EXECUTIVO                                                |
+----------------------------------------------------------------+
| Total de usuarios revisados:        42                         |
| Acessos mantidos:                   38 (90.5%)                 |
| Papeis revogados:                    3 (7.1%)                  |
| Papeis modificados:                  1 (2.4%)                  |
| Contestacoes recebidas:             1                          |
| Contestacoes aceitas:               0                          |
| Contas inativas detectadas:         2                          |
| Contas desativadas:                 2                          |
| Acumulo de papeis detectado:        1                          |
| Combinacoes toxicas detectadas:     0                          |
+----------------------------------------------------------------+

+----------------------------------------------------------------+
| ACOES REALIZADAS                                                |
+----------------------------------------------------------------+

1. REVOGACOES:
   +----------+--------------------+--------------+----------------+
   | Usuario  | Papel Revogado     | Motivo       | Data           |
   +----------+--------------------+--------------+----------------+
   | USR-0087 | fisioterapeuta_uti | Transferido  | 2026-05-02     |
   |          |                    | para Enf. 3A |                |
   | USR-0124 | tecnico_enf_uti    | Desligado    | 2026-05-05     |
   | USR-0156 | medico_plantonista | Nao atua     | 2026-05-08     |
   |          |                    | mais na UTI  |                |
   +----------+--------------------+--------------+----------------+

2. MODIFICACOES:
   +----------+-------------------+-------------------+------------+
   | Usuario  | Papel Anterior    | Novo Papel        | Data       |
   +----------+-------------------+-------------------+------------+
   | USR-0092 | enfermeiro        | supervisor_turno  | 2026-05-03 |
   +----------+-------------------+-------------------+------------+

3. CONTAS INATIVAS DESATIVADAS:
   +----------+--------------------+-----------------+-----------+
   | Usuario  | Ultimo Login       | Dias Inativo    | Acao      |
   +----------+--------------------+-----------------+-----------+
   | USR-0098 | 2026-01-15         | 115 dias        | Desativada|
   | USR-0145 | 2025-12-20         | 141 dias        | Desativada|
   +----------+--------------------+-----------------+-----------+

4. ACUMULO DE PAPEIS:
   +----------+------------------------------+---------+----------+
   | Usuario  | Papeis Acumulados            | Decisao | Data     |
   +----------+------------------------------+---------+----------+
   | USR-0071 | enfermeiro, enfermeiro_uti,   | Manter  | 2026-05-04|
   |          | supervisor_turno,             | 3,      |          |
   |          | gestor_estoque               | revogar |          |
   |          |                              | 1       |          |
   +----------+------------------------------+---------+----------+

+----------------------------------------------------------------+
| ASSINATURA DIGITAL                                              |
+----------------------------------------------------------------+
| Gestor: Enf. Ana Paula Costa                                   |
| COREN-SP: 123456                                               |
| Assinatura: [Assinado digitalmente em 2026-05-10T16:30:00Z]   |
| Hash: 7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f...  |
+================================================================+
```

---

## 8. Metricas de Recertificacao

### 8.1 KPIs

| Metrica | Meta | Alerta |
|---|---|---|
| Taxa de conclusao no prazo | > 95% | < 90% |
| Taxa de revogacao por ciclo | 5-15% | < 2% (rubber-stamping) |
| Contas inativas detectadas | < 5% do total | > 10% |
| Acumulo de papeis | < 3% dos usuarios | > 5% |
| Combinacoes toxicas | 0 | > 0 |
| Contestacoes | < 10% das revogacoes | > 20% |
| Tempo medio de decisao | < 5 min/usuario | > 10 min |
| Revert de revogacoes | < 5% | > 10% |

### 8.2 Dashboard de Recertificacao

```yaml
# recertification-dashboard.yaml
panels:
  - title: "Progresso da Recertificacao por Unidade"
    type: bar_gauge
    query: |
      velya_recertification_progress{cycle="Q2_2026"} * 100
    thresholds:
      - value: 0
        color: red
      - value: 50
        color: yellow
      - value: 90
        color: green

  - title: "Usuarios Pendentes de Revisao"
    type: table
    query: |
      velya_recertification_pending_users{cycle="Q2_2026"} > 0

  - title: "Taxa de Revogacao por Ciclo"
    type: time_series
    query: |
      velya_recertification_revocations_total /
      velya_recertification_reviewed_total * 100

  - title: "Contas Inativas por Unidade"
    type: bar_chart
    query: |
      velya_stale_accounts_total by (unit, threshold)

  - title: "Acumulo de Papeis"
    type: table
    query: |
      velya_role_accumulation_detected{roles_count >= 4}

  - title: "SLA de Conclusao"
    type: stat
    query: |
      velya_recertification_completed_on_time /
      velya_recertification_total_cycles * 100

  - title: "Historico de Recertificacoes"
    type: time_series
    query: |
      velya_recertification_decisions_total by (decision)
```

---

## 9. Processo de Contestacao

### 9.1 Fluxo de Contestacao

Quando um usuario tem um papel revogado na recertificacao, ele pode contestar:

| Etapa | Prazo | Acao |
|---|---|---|
| 1. Notificacao | T+0 | Usuario recebe email/notificacao da revogacao |
| 2. Contestacao | T+5 dias uteis | Usuario submete contestacao com justificativa |
| 3. Analise | T+10 dias uteis | Compliance analisa contestacao |
| 4. Decisao | T+15 dias uteis | Manter revogacao ou reverter |
| 5. Recurso (opcional) | T+20 dias uteis | Recurso ao CISO (ultima instancia) |

Durante o periodo de contestacao, o acesso permanece **revogado**. Se a contestacao for aceita, o acesso e restaurado retroativamente e um registro de justificativa e adicionado.

---

## 10. Integracao com Sistema de RH

### 10.1 Eventos de RH Monitorados

```yaml
# hr-integration-events.yaml
hr_events:
  - event: "employee.terminated"
    action: "immediate_deactivation"
    fields:
      - employee_id
      - termination_date
      - termination_reason
    velya_action: |
      1. Desativar conta imediatamente
      2. Revogar todos os papeis
      3. Invalidar todas as sessoes ativas
      4. Notificar gestor e seguranca
      5. Gerar relatorio de ultimos acessos (30 dias)

  - event: "employee.transferred"
    action: "unit_access_adjustment"
    fields:
      - employee_id
      - old_unit
      - new_unit
      - transfer_date
    velya_action: |
      1. Revogar papeis da unidade anterior
      2. Notificar gestor da unidade anterior
      3. Notificar gestor da nova unidade para atribuir papeis
      4. Manter papeis base (nao vinculados a unidade)

  - event: "employee.leave_started"
    action: "suspend_access"
    fields:
      - employee_id
      - leave_type
      - start_date
      - expected_return_date
    velya_action: |
      1. Suspender conta (nao desativar)
      2. Preservar papeis para reativacao
      3. Invalidar sessoes ativas
      4. Programar reativacao na data de retorno

  - event: "employee.leave_ended"
    action: "reactivate_access"
    fields:
      - employee_id
      - actual_return_date
    velya_action: |
      1. Reativar conta
      2. Restaurar papeis preservados
      3. Notificar gestor para confirmar papeis
      4. Exigir troca de senha no primeiro login

  - event: "credential.suspended"
    action: "revoke_clinical_role"
    fields:
      - employee_id
      - council_type
      - council_number
      - suspension_reason
    velya_action: |
      1. Revogar papeis clinicos imediatamente
      2. Manter papeis administrativos (se aplicavel)
      3. Notificar gestor e compliance
      4. Bloquear acoes que requerem registro ativo

  - event: "credential.restored"
    action: "restore_clinical_role"
    fields:
      - employee_id
      - council_type
      - council_number
    velya_action: |
      1. Notificar gestor para reatribuir papeis clinicos
      2. Nao reativar automaticamente (requer recertificacao)
```

---

## 11. Conformidade e Evidencias

### 11.1 Requisitos Regulatorios Atendidos

| Requisito | Regulamento | Evidencia |
|---|---|---|
| Revisao periodica de acessos | ISO 27001 A.9.2.5 | Relatorios trimestrais |
| Remocao de direitos na rescisao | ISO 27001 A.9.2.6 | Logs de revogacao automatica |
| Segregacao de deveres | ISO 27001 A.6.1.2 | Deteccao de combinacoes toxicas |
| Controle de acessos privilegiados | ISO 27001 A.9.2.3 | Recertificacao + JIT |
| Protecao de dados do titular | LGPD Art. 46 | Revogacao em desligamento |
| Minimizacao de dados | LGPD Art. 6 III | Deteccao de privilege creep |

### 11.2 Artefatos Gerados

| Artefato | Frequencia | Retencao | Destinatario |
|---|---|---|---|
| Relatorio de recertificacao (por unidade) | Trimestral | 5 anos | Gestor + Compliance |
| Relatorio consolidado (hospital) | Semestral | 5 anos | CISO + Diretoria |
| Log de revogacoes automaticas | Continuo | 5 anos | Compliance |
| Evidencia de deteccao de contas inativas | Diario | 2 anos | TI + Compliance |
| Evidencia de deteccao de combinacoes toxicas | Semanal | 5 anos | Compliance + CISO |
| Ata de contestacao | Sob demanda | 5 anos | Compliance |

---

*Documento gerado para a plataforma Velya. Uso interno - Compliance e Governanca.*
