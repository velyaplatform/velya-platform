# Matriz de Risco de Mudancas

> Documento 13 - Layered Assurance + Self-Healing  
> Plataforma Velya - Sistema Hospitalar Inteligente  
> Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

Toda mudanca na plataforma Velya deve ser classificada por risco antes de ser executada. A classificacao determina quais validacoes, gates, e niveis de automacao sao permitidos. Este documento define a matriz de risco completa, o fluxograma de classificacao, e exemplos concretos para cada servico da Velya.

---

## 2. Niveis de Risco

| Nivel       | Descricao                                                                | Exemplos                                                                                                | Tempo de Monitoramento Pos-Mudanca |
| ----------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Baixo**   | Mudanca com impacto limitado, facilmente reversivel, sem impacto clinico | Atualizacao de label, ajuste de log level, bump de dependencia patch                                    | 30 minutos                         |
| **Medio**   | Mudanca com impacto moderado, reversivel com algum esforco               | Feature flag nova, ajuste de HPA limits, novo endpoint nao-critico                                      | 2 horas                            |
| **Alto**    | Mudanca com impacto significativo, reversivel mas com risco de dados     | Nova feature clinica, alteracao de schema de banco, mudanca de policy                                   | 24 horas                           |
| **Critico** | Mudanca com potencial de impacto em seguranca do paciente ou compliance  | Alteracao de fluxo de alta, mudanca de agente clinico, alteracao de audit trail, infraestrutura de rede | 72 horas                           |

---

## 3. Matriz de Risco por Tipo de Mudanca

### 3.1 Codigo de Aplicacao

| Subtipo                                               | Risco | Validacoes Requeridas                            | Gates                              | Automacao Permitida                              | Rollback           | Monitoramento |
| ----------------------------------------------------- | ----- | ------------------------------------------------ | ---------------------------------- | ------------------------------------------------ | ------------------ | ------------- |
| Bug fix em endpoint nao-critico                       | Baixo | Unit tests, lint, build                          | CI green                           | Full auto (canary 5%->100%)                      | Argo Rollouts auto | 30min         |
| Bug fix em endpoint critico (patient-flow, discharge) | Alto  | Unit + integration + contract tests              | CI green + 1 reviewer clinico      | Semi-auto (canary 5%->25%->50%->100%, com pause) | Argo Rollouts auto | 24h           |
| Nova feature administrativa                           | Medio | Unit + integration tests                         | CI green + 1 reviewer              | Semi-auto (canary 5%->25%->100%)                 | Argo Rollouts auto | 2h            |
| Nova feature clinica                                  | Alto  | Unit + integration + E2E + clinical validation   | CI green + 2 reviewers (1 clinico) | Semi-auto com analysis em cada step              | Argo Rollouts auto | 24h           |
| Refatoracao sem mudanca de comportamento              | Baixo | Unit + integration tests, cobertura >= baseline  | CI green + 1 reviewer              | Full auto                                        | Argo Rollouts auto | 30min         |
| Mudanca de dependencia (patch)                        | Baixo | Unit tests + vulnerability scan                  | CI green                           | Full auto                                        | Argo Rollouts auto | 30min         |
| Mudanca de dependencia (minor)                        | Medio | Unit + integration tests + vulnerability scan    | CI green + 1 reviewer              | Semi-auto                                        | Argo Rollouts auto | 2h            |
| Mudanca de dependencia (major)                        | Alto  | Full test suite + vulnerability scan + manual QA | CI green + 2 reviewers             | Manual com canary                                | Argo Rollouts auto | 24h           |

### 3.2 Infraestrutura (OpenTofu)

| Subtipo                                        | Risco       | Validacoes Requeridas                                  | Gates                               | Automacao Permitida        | Rollback                | Monitoramento |
| ---------------------------------------------- | ----------- | ------------------------------------------------------ | ----------------------------------- | -------------------------- | ----------------------- | ------------- |
| Adicao de tag em recurso                       | Baixo       | `tofu plan` sem destruicao                             | CI green                            | Full auto                  | `tofu apply` reverso    | 30min         |
| Alteracao de security group (adicao de regra)  | Medio       | `tofu plan` + review de regras                         | CI green + 1 reviewer SRE           | Manual com plano aprovado  | `tofu apply` reverso    | 2h            |
| Alteracao de security group (remocao de regra) | Alto        | `tofu plan` + mapa de dependencias                     | CI green + 2 reviewers SRE          | Manual com plano aprovado  | `tofu apply` reverso    | 24h           |
| Alteracao de IAM policy                        | Alto        | `tofu plan` + IAM Access Analyzer                      | CI green + 2 reviewers (1 security) | Manual                     | `tofu apply` reverso    | 24h           |
| Alteracao de RDS instance                      | Critico     | `tofu plan` + backup verificado + janela de manutencao | CI green + 2 reviewers SRE + DBA    | Manual com aprovacao       | Restauracao de snapshot | 72h           |
| Alteracao de EKS cluster                       | Critico     | `tofu plan` + staging first                            | CI green + 2 reviewers SRE          | Manual com aprovacao dupla | Plano de contingencia   | 72h           |
| Alteracao de VPC/subnets                       | Critico     | `tofu plan` + mapa de conectividade                    | CI green + 2 reviewers SRE + net    | Manual com aprovacao dupla | Rollback manual         | 72h           |
| Criacao de recurso novo                        | Baixo-Medio | `tofu plan`                                            | CI green + 1 reviewer               | Semi-auto                  | `tofu destroy`          | 30min-2h      |

### 3.3 Migracao de Banco de Dados

| Subtipo                               | Risco   | Validacoes Requeridas                               | Gates                                   | Automacao Permitida                 | Rollback                         | Monitoramento |
| ------------------------------------- | ------- | --------------------------------------------------- | --------------------------------------- | ----------------------------------- | -------------------------------- | ------------- |
| Adicao de coluna nullable             | Baixo   | Migration up/down, staging test                     | CI green                                | Full auto                           | Migration down                   | 30min         |
| Adicao de coluna NOT NULL com default | Medio   | Migration up/down, staging test, volume check       | CI green + 1 reviewer                   | Semi-auto                           | Migration down                   | 2h            |
| Adicao de indice                      | Medio   | Migration up/down, staging test, lock analysis      | CI green + DBA review                   | Semi-auto (janela de baixo trafego) | Drop index                       | 2h            |
| Alteracao de tipo de coluna           | Alto    | Migration up/down, staging test, backward compat    | CI green + DBA review + 1 reviewer      | Manual                              | Migration down (se reversivel)   | 24h           |
| Remocao de coluna                     | Alto    | Verificar que N-1 nao usa, staging test             | CI green + DBA review + 1 reviewer      | Manual                              | Migration down (re-criar coluna) | 24h           |
| Alteracao de constraint/FK            | Alto    | Migration up/down, data validation                  | CI green + DBA review                   | Manual                              | Migration down                   | 24h           |
| Migracao de dados (backfill)          | Critico | Script testado em staging, backup, batch processing | CI green + DBA + 2 reviewers            | Manual com monitoramento            | Restore de backup                | 72h           |
| Mudanca de schema em tabela clinica   | Critico | Full test suite + DBA + clinical review             | CI green + DBA + clinical + 2 reviewers | Manual                              | Restore de backup                | 72h           |

### 3.4 Comportamento de Agente

| Subtipo                            | Risco   | Validacoes Requeridas                                  | Gates                                        | Automacao Permitida    | Rollback                      | Monitoramento |
| ---------------------------------- | ------- | ------------------------------------------------------ | -------------------------------------------- | ---------------------- | ----------------------------- | ------------- |
| Ajuste de prompt (nao-clinico)     | Medio   | A/B test em shadow mode, quality metrics               | CI green + 1 reviewer AI                     | Semi-auto com shadow   | Revert de prompt              | 2h            |
| Ajuste de prompt (clinico)         | Critico | Shadow mode 48h, clinical validation, quality metrics  | CI green + 2 reviewers (1 clinico, 1 AI)     | Manual apos shadow     | Revert de prompt + quarentena | 72h           |
| Mudanca de modelo (ai-gateway)     | Critico | Benchmark suite, shadow mode 72h, clinical validation  | CI green + AI lead + clinical lead           | Manual apos shadow     | Revert de modelo              | 72h           |
| Alteracao de confidence threshold  | Alto    | Impact analysis em decisoes historicas                 | CI green + 1 reviewer AI + 1 clinico         | Semi-auto              | Revert de config              | 24h           |
| Novo tipo de agente                | Critico | Full test suite, shadow mode 1 semana, clinical review | CI green + AI lead + clinical lead + product | Manual, staged rollout | Remover agente                | 72h           |
| Alteracao de memory-service schema | Alto    | Migration test, consistency check                      | CI green + 1 reviewer AI                     | Manual                 | Migration down                | 24h           |

### 3.5 Rotacao de Secrets

| Subtipo                              | Risco   | Validacoes Requeridas                                      | Gates                       | Automacao Permitida          | Rollback                                     | Monitoramento |
| ------------------------------------ | ------- | ---------------------------------------------------------- | --------------------------- | ---------------------------- | -------------------------------------------- | ------------- |
| Rotacao de API key (servico externo) | Medio   | Verificar que novo secret funciona antes de revogar antigo | Pre-check automatico        | Semi-auto (External Secrets) | Restaurar versao anterior                    | 2h            |
| Rotacao de database credentials      | Alto    | Dual-write period, verificar conexoes                      | Pre-check + DBA             | Semi-auto com dual-write     | Restaurar versao anterior                    | 24h           |
| Rotacao de certificado TLS           | Medio   | Verificar chain of trust, testar handshake                 | Pre-check automatico        | Semi-auto                    | Restaurar certificado anterior               | 2h            |
| Rotacao de JWT signing key           | Alto    | Key rotation com grace period, testar validacao            | Pre-check + 1 reviewer      | Semi-auto com grace period   | Restaurar key anterior                       | 24h           |
| Rotacao de encryption key (KMS)      | Critico | Verificar que dados podem ser re-encrypted                 | Pre-check + security review | Manual                       | NAO reversivel (re-encrypt com key anterior) | 72h           |

### 3.6 Atualizacao de Policy

| Subtipo                       | Risco   | Validacoes Requeridas                                         | Gates                                   | Automacao Permitida | Rollback   | Monitoramento |
| ----------------------------- | ------- | ------------------------------------------------------------- | --------------------------------------- | ------------------- | ---------- | ------------- |
| Nova policy (nao-clinica)     | Medio   | Unit test da policy, dry-run em prod                          | CI green + 1 reviewer                   | Semi-auto           | Git revert | 2h            |
| Nova policy (clinica)         | Critico | Unit test, integration test, dry-run em prod, clinical review | CI green + 2 reviewers (1 clinico)      | Manual              | Git revert | 72h           |
| Alteracao de policy existente | Alto    | Unit test, impact analysis, dry-run                           | CI green + 1 reviewer + owner da policy | Semi-auto           | Git revert | 24h           |
| Remocao de policy             | Alto    | Verificar que nenhum servico depende                          | CI green + owner + 1 reviewer           | Manual              | Git revert | 24h           |

### 3.7 Configuracao de Observabilidade

| Subtipo                        | Risco | Validacoes Requeridas                    | Gates                              | Automacao Permitida | Rollback           | Monitoramento |
| ------------------------------ | ----- | ---------------------------------------- | ---------------------------------- | ------------------- | ------------------ | ------------- |
| Novo dashboard                 | Baixo | Verificar queries validas                | CI green                           | Full auto           | Deletar dashboard  | 30min         |
| Novo alerta                    | Medio | Verificar threshold, testar em staging   | CI green + 1 reviewer              | Semi-auto           | Desabilitar alerta | 2h            |
| Alteracao de alerta critico    | Alto  | Verificar impacto, testar em staging     | CI green + 1 reviewer SRE          | Semi-auto           | Git revert         | 24h           |
| Alteracao de retencao de dados | Alto  | Verificar compliance (HIPAA/LGPD), custo | CI green + compliance + 1 reviewer | Manual              | Git revert         | 24h           |
| Alteracao de sampling rate     | Medio | Verificar impacto em troubleshooting     | CI green + 1 reviewer              | Semi-auto           | Git revert         | 2h            |

### 3.8 Definicao de Workflow (Temporal)

| Subtipo                         | Risco   | Validacoes Requeridas                     | Gates                              | Automacao Permitida | Rollback               | Monitoramento |
| ------------------------------- | ------- | ----------------------------------------- | ---------------------------------- | ------------------- | ---------------------- | ------------- |
| Novo workflow nao-clinico       | Medio   | Unit + integration tests                  | CI green + 1 reviewer              | Semi-auto           | Undeploy workflow      | 2h            |
| Novo workflow clinico           | Critico | Unit + integration + E2E, clinical review | CI green + 2 reviewers (1 clinico) | Manual              | Undeploy workflow      | 72h           |
| Alteracao de workflow existente | Alto    | Unit + integration, backward compat       | CI green + 1 reviewer + owner      | Semi-auto           | Deploy versao anterior | 24h           |
| Alteracao de retry policy       | Medio   | Impact analysis                           | CI green + 1 reviewer              | Semi-auto           | Git revert             | 2h            |
| Alteracao de timeout            | Medio   | Impact analysis                           | CI green + 1 reviewer              | Semi-auto           | Git revert             | 2h            |

### 3.9 Network Policy

| Subtipo                   | Risco   | Validacoes Requeridas                   | Gates                                 | Automacao Permitida | Rollback   | Monitoramento |
| ------------------------- | ------- | --------------------------------------- | ------------------------------------- | ------------------- | ---------- | ------------- |
| Adicao de egress rule     | Baixo   | Verificar destino, testar em staging    | CI green + 1 reviewer                 | Semi-auto           | Git revert | 30min         |
| Adicao de ingress rule    | Medio   | Verificar origem, security review       | CI green + 1 reviewer + security      | Semi-auto           | Git revert | 2h            |
| Remocao de regra          | Alto    | Mapa de dependencias, testar em staging | CI green + 2 reviewers (1 security)   | Manual              | Git revert | 24h           |
| Mudanca de default policy | Critico | Full connectivity test, staging first   | CI green + 2 reviewers SRE + security | Manual              | Git revert | 72h           |

### 3.10 Configuracao de Scaling (HPA/VPA/KEDA)

| Subtipo                      | Risco | Validacoes Requeridas                 | Gates                     | Automacao Permitida | Rollback   | Monitoramento |
| ---------------------------- | ----- | ------------------------------------- | ------------------------- | ------------------- | ---------- | ------------- |
| Aumento de maxReplicas       | Baixo | Verificar budget de recursos          | CI green                  | Full auto           | Git revert | 30min         |
| Reducao de minReplicas       | Medio | Load test, verificar SLO              | CI green + 1 reviewer     | Semi-auto           | Git revert | 2h            |
| Alteracao de KEDA scaler     | Medio | Testar em staging, verificar metricas | CI green + 1 reviewer     | Semi-auto           | Git revert | 2h            |
| Alteracao de VPA (auto mode) | Alto  | Monitorar em staging 24h              | CI green + 1 reviewer SRE | Semi-auto           | Git revert | 24h           |
| Reducao de resource limits   | Alto  | Load test, verificar OOMKill risk     | CI green + 1 reviewer SRE | Manual              | Git revert | 24h           |

---

## 4. Fluxograma de Classificacao de Risco

```
Mudanca proposta
|
+-- Afeta seguranca do paciente diretamente?
|   |
|   +-- SIM --> CRITICO
|   |           Requer: 2+ reviewers, 1 clinico, staging first
|   |           Monitoramento: 72h
|   |
|   +-- NAO --> Afeta dados clinicos (PHI)?
|               |
|               +-- SIM --> Pode corromper ou perder dados?
|               |           |
|               |           +-- SIM --> CRITICO
|               |           +-- NAO --> ALTO
|               |                       Requer: 2 reviewers, DBA se banco
|               |                       Monitoramento: 24h
|               |
|               +-- NAO --> Afeta disponibilidade de servico critico?
|                           |
|                           +-- SIM --> Pode causar downtime > 5min?
|                           |           |
|                           |           +-- SIM --> ALTO
|                           |           +-- NAO --> MEDIO
|                           |                       Requer: 1 reviewer
|                           |                       Monitoramento: 2h
|                           |
|                           +-- NAO --> Afeta observabilidade ou compliance?
|                                       |
|                                       +-- SIM --> MEDIO
|                                       +-- NAO --> E facilmente reversivel?
|                                                   |
|                                                   +-- SIM --> BAIXO
|                                                   |           Full auto permitido
|                                                   |           Monitoramento: 30min
|                                                   |
|                                                   +-- NAO --> MEDIO
```

---

## 5. Exemplos Concretos por Servico Velya

### 5.1 patient-flow

| Mudanca                                                   | Risco   | Justificativa                            |
| --------------------------------------------------------- | ------- | ---------------------------------------- |
| Adicionar campo `preferredLanguage` ao perfil do paciente | Medio   | Nao clinico, mas afeta dados do paciente |
| Alterar logica de calculo de tempo de espera              | Alto    | Afeta priorizacao clinica                |
| Corrigir bug de exibicao de nome no dashboard             | Baixo   | Cosmetic, sem impacto clinico            |
| Adicionar endpoint de transferencia entre unidades        | Critico | Movimentacao de paciente afeta seguranca |
| Alterar schema da tabela `patients`                       | Alto    | Dados clinicos, requer backward compat   |

### 5.2 discharge-orchestrator

| Mudanca                                      | Risco   | Justificativa                                         |
| -------------------------------------------- | ------- | ----------------------------------------------------- |
| Alterar timeout de step de medication review | Alto    | Pode impactar velocidade da alta                      |
| Adicionar novo step ao workflow de alta      | Critico | Afeta diretamente processo de alta                    |
| Corrigir logging de workflow                 | Baixo   | Observabilidade, sem impacto funcional                |
| Alterar logica de compensacao                | Critico | Falha de compensacao pode deixar estado inconsistente |
| Atualizar retry policy                       | Medio   | Pode afetar velocidade mas nao seguranca              |

### 5.3 ai-gateway

| Mudanca                                       | Risco   | Justificativa                        |
| --------------------------------------------- | ------- | ------------------------------------ |
| Trocar modelo Claude para versao mais recente | Critico | Comportamento do agente pode mudar   |
| Ajustar temperature do modelo                 | Alto    | Afeta consistencia das respostas     |
| Adicionar rate limiting                       | Medio   | Pode impactar disponibilidade        |
| Atualizar SDK do Anthropic (patch)            | Baixo   | Bugfix sem mudanca de comportamento  |
| Alterar system prompt de agente clinico       | Critico | Muda comportamento clinico do agente |

### 5.4 audit-service

| Mudanca                                  | Risco   | Justificativa                       |
| ---------------------------------------- | ------- | ----------------------------------- |
| Adicionar novo tipo de evento            | Medio   | Expansao, sem impacto em existentes |
| Alterar schema de evento existente       | Critico | Pode quebrar compliance/auditoria   |
| Alterar retencao de dados                | Critico | Compliance regulatoria (HIPAA/LGPD) |
| Adicionar indice para query de auditoria | Medio   | Performance, sem impacto funcional  |
| Corrigir bug em write path               | Alto    | Dados de audit podem ser afetados   |

### 5.5 policy-engine

| Mudanca                                 | Risco   | Justificativa                                 |
| --------------------------------------- | ------- | --------------------------------------------- |
| Adicionar nova policy de rate limiting  | Medio   | Nao clinica, impacto limitado                 |
| Alterar policy de acesso a PHI          | Critico | Seguranca de dados de paciente                |
| Adicionar policy de validacao de agente | Alto    | Afeta comportamento de agentes                |
| Corrigir bug em policy existente        | Alto    | Pode ter permitido ou bloqueado indevidamente |
| Remover policy obsoleta                 | Alto    | Pode ter dependentes nao documentados         |

### 5.6 agent-orchestrator

| Mudanca                            | Risco   | Justificativa                              |
| ---------------------------------- | ------- | ------------------------------------------ |
| Alterar lifecycle state machine    | Critico | Pode afetar quarentena/promocao de agentes |
| Ajustar heartbeat interval         | Baixo   | Operacional, sem impacto clinico           |
| Adicionar novo tipo de agente      | Critico | Novo comportamento no sistema clinico      |
| Alterar logica de fallback         | Alto    | Afeta resiliencia de agentes               |
| Corrigir bug em metricas de agente | Baixo   | Observabilidade apenas                     |

---

## 6. Gates e Aprovacoes

### 6.1 Matriz de Aprovacao

| Risco   | Reviewers                         | Aprovacao Clinica | Staging Required       | Canary                  | Deploy Window                |
| ------- | --------------------------------- | ----------------- | ---------------------- | ----------------------- | ---------------------------- |
| Baixo   | 1 dev                             | Nao               | Nao                    | 5%->100% (auto)         | Qualquer                     |
| Medio   | 1 dev + 1 especialista            | Nao               | Recomendado            | 5%->25%->100%           | Horario comercial            |
| Alto    | 2 devs + 1 especialista           | Se clinico        | Sim                    | 5%->25%->50%->100%      | Horario comercial, nao sexta |
| Critico | 2 devs + tech lead + especialista | Sim (se clinico)  | Obrigatorio + soak 24h | 5%->10%->25%->50%->100% | Terca-Quinta, 10h-14h        |

### 6.2 Deploy Windows

```
+--------+--------+--------+--------+--------+--------+--------+
| DOM    | SEG    | TER    | QUA    | QUI    | SEX    | SAB    |
+--------+--------+--------+--------+--------+--------+--------+
| Baixo  | Baixo  | Todos  | Todos  | Todos  | Baixo  | Baixo  |
| only   | Medio  |        |        |        | Medio  | only   |
|        |        |        |        |        |        |        |
| 10-18h | 09-17h | 09-17h | 09-17h | 09-17h | 09-15h | 10-14h |
+--------+--------+--------+--------+--------+--------+--------+

Excecoes:
- Hotfix de seguranca: qualquer momento, com page de SRE on-call
- Hotfix clinico: qualquer momento, com aprovacao de clinical-lead
- Critico: apenas Terca a Quinta, 10h-14h (maximo tempo de monitoramento antes do fim de semana)
```

---

## 7. Automacao de Classificacao

### 7.1 Labels de PR

Todo PR deve ter labels de risco. Se nao tiver, o CI bloqueia o merge.

```yaml
# .github/labeler.yml
risk/low:
  - changed-files:
      - any-glob-to-any-file:
          - 'docs/**'
          - '**/*.md'
          - '**/test/**'
          - '**/.gitignore'
          - '**/Makefile'

risk/medium:
  - changed-files:
      - any-glob-to-any-file:
          - 'k8s/*/hpa.yaml'
          - 'k8s/*/keda-*.yaml'
          - 'k8s/*/configmap.yaml'
          - 'services/*/src/routes/**'
          - 'dashboards/**'
          - 'alerts/**'

risk/high:
  - changed-files:
      - any-glob-to-any-file:
          - 'services/*/src/models/**'
          - 'services/*/migrations/**'
          - 'k8s/*/networkpolicy.yaml'
          - 'k8s/*/externalsecret.yaml'
          - 'policies/**'
          - 'tofu/modules/**'

risk/critical:
  - changed-files:
      - any-glob-to-any-file:
          - 'services/discharge-orchestrator/**'
          - 'services/patient-flow/src/discharge/**'
          - 'services/ai-gateway/prompts/**'
          - 'services/agent-orchestrator/src/lifecycle/**'
          - 'services/audit-service/src/schema/**'
          - 'services/policy-engine/src/clinical/**'
          - 'workflows/discharge-*'
          - 'tofu/modules/eks-cluster/**'
          - 'tofu/modules/rds-databases/**'
```

### 7.2 CI Gate Check

```yaml
# .github/workflows/risk-gate.yml
name: Risk Gate Check
on:
  pull_request:
    types: [labeled, unlabeled, synchronize, opened]

jobs:
  risk-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Check risk label exists
        uses: actions/github-script@v7
        with:
          script: |
            const labels = context.payload.pull_request.labels.map(l => l.name);
            const riskLabels = labels.filter(l => l.startsWith('risk/'));

            if (riskLabels.length === 0) {
              core.setFailed('PR deve ter label de risco: risk/low, risk/medium, risk/high, risk/critical');
              return;
            }

            const riskLevel = riskLabels[0].replace('risk/', '');
            const reviews = await github.rest.pulls.listReviews({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number,
            });

            const approvals = reviews.data.filter(r => r.state === 'APPROVED').length;

            const requiredApprovals = {
              'low': 1,
              'medium': 2,
              'high': 3,
              'critical': 4,
            };

            if (approvals < requiredApprovals[riskLevel]) {
              core.setFailed(
                `Risco ${riskLevel}: requer ${requiredApprovals[riskLevel]} aprovacoes, tem ${approvals}`
              );
            }

      - name: Check staging requirement
        if: contains(github.event.pull_request.labels.*.name, 'risk/high') || contains(github.event.pull_request.labels.*.name, 'risk/critical')
        uses: actions/github-script@v7
        with:
          script: |
            const comments = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const stagingConfirmed = comments.data.some(
              c => c.body.includes('[staging-verified]')
            );

            if (!stagingConfirmed) {
              core.setFailed(
                'Mudancas de risco alto/critico requerem verificacao em staging. ' +
                'Comente com [staging-verified] apos testar.'
              );
            }
```

---

## 8. Registro de Mudancas e Rastreabilidade

### 8.1 Campos Obrigatorios no PR

Todo PR deve conter no corpo:

```markdown
## Risk Classification

- **Risk Level:** [low|medium|high|critical]
- **Change Type:** [application|infrastructure|database|agent|secret|policy|observability|workflow|network|scaling]
- **Services Affected:** [lista de servicos]
- **Clinical Impact:** [none|indirect|direct]
- **Rollback Strategy:** [auto|manual|complex]
- **Monitoring Period:** [30min|2h|24h|72h]

## Validation Checklist

- [ ] Tests passing
- [ ] Staging verified (if required)
- [ ] Rollback tested (if high/critical)
- [ ] Clinical review (if clinical impact)
- [ ] DBA review (if database change)
- [ ] Security review (if auth/access change)

## Rollback Plan

[Descrever o plano de rollback especifico para esta mudanca]
```

### 8.2 Audit Trail de Mudancas

```yaml
# Cada deploy gera um registro em audit-service
change_event:
  type: 'deployment'
  timestamp: '2026-04-08T14:30:00Z'
  actor: 'github:user/joao.silva'
  change:
    pr_number: 1234
    risk_level: 'high'
    change_type: 'application'
    services: ['patient-flow']
    commit_sha: 'abc123def'
    rollout_id: 'patient-flow-rev-15'
  approvals:
    - reviewer: 'maria.costa'
      type: 'code_review'
    - reviewer: 'dr.oliveira'
      type: 'clinical_review'
  validation:
    staging_verified: true
    tests_passed: true
    canary_analysis: 'passed'
  monitoring:
    period: '24h'
    dashboard: 'https://grafana.velya.io/d/patient-flow-deploy'
    alerts_configured: true
```

---

## 9. Metricas de Risco

```promql
# Distribuicao de deploys por nivel de risco
sum by (risk_level) (velya_deploy_total)

# Taxa de rollback por nivel de risco
sum by (risk_level) (velya_rollback_total)
/ sum by (risk_level) (velya_deploy_total)

# Tempo medio de monitoramento pos-deploy
avg by (risk_level) (velya_deploy_monitoring_duration_seconds)

# Deploys sem label de risco (deve ser zero)
velya_deploy_without_risk_label_total

# Deploys criticos fora da janela permitida
velya_deploy_outside_window_total{risk_level="critical"}
```

---

## 10. Revisao e Atualizacao da Matriz

- **Revisao mensal:** Analisar rollbacks e incidentes, ajustar classificacoes se necessario
- **Revisao trimestral:** Revisar exemplos concretos, adicionar novos tipos de mudanca
- **Pos-incidente:** Se um incidente revelar que uma mudanca foi sub-classificada, atualizar imediatamente
- **Owner:** platform-sre com input de clinical-eng, ai-ops, security, compliance
