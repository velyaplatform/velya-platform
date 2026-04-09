# Matriz de Guardrails — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Arquitetura, Segurança e Governança  
> **Propósito**: Matriz de guardrails (barreiras de proteção) para cada risco significativo identificado na plataforma Velya. Um guardrail é uma barreira técnica ou processual que previne, detecta ou corrige comportamento indesejado.

---

## Tipos de Guardrail

| Tipo              | Definição                                                  | Momento de Atuação     |
| ----------------- | ---------------------------------------------------------- | ---------------------- |
| **Preventivo**    | Impede que o problema ocorra                               | Antes da ação          |
| **Detectivo**     | Identifica o problema quando ocorre                        | Durante ou após a ação |
| **Corretivo**     | Reverte ou mitiga o problema após ocorrer                  | Após a ação            |
| **Compensatório** | Reduz o impacto enquanto o controle principal está ausente | Em paralelo            |

---

## Status e Efetividade

| Status           | Significado                      |
| ---------------- | -------------------------------- |
| **Implementado** | Controle em funcionamento        |
| **Parcial**      | Implementado mas incompleto      |
| **Planejado**    | Decisão tomada, não implementado |
| **Ausente**      | Não existe                       |

---

## Domínio 1 — Segurança de AI/Agents

| ID        | Risco que Mitiga                           | Tipo       | Mecanismo                                                                   | Onde Implementado                                  | Status  | Efetividade | Como Testar                                                                                        |
| --------- | ------------------------------------------ | ---------- | --------------------------------------------------------------------------- | -------------------------------------------------- | ------- | ----------- | -------------------------------------------------------------------------------------------------- |
| GR-AI-001 | Prompt injection via dados FHIR            | Preventivo | Sanitização de inputs + delimitadores de conteúdo no prompt builder         | `packages/ai-gateway/` — função `buildContext()`   | Ausente | Alta        | Injetar payload em campo `Patient.name` e verificar que o agent ignora a instrução                 |
| GR-AI-002 | Output de LLM sem validação de schema      | Preventivo | Zod schema validation de todo output antes de uso                           | `packages/ai-gateway/` — função `validateOutput()` | Ausente | Alta        | Enviar output malformado ao parser e verificar rejeição                                            |
| GR-AI-003 | PHI além do mínimo necessário em contexto  | Preventivo | Context schema por tipo de task — allowlist de campos PHI                   | `packages/ai-gateway/` — `ContextBuilder`          | Ausente | Alta        | Verificar que campos proibidos não aparecem em contextos de AI                                     |
| GR-AI-004 | Contaminação de contexto entre pacientes   | Preventivo | Isolamento de sessão por patient_id no AI Gateway                           | `packages/ai-gateway/` — session isolation         | Ausente | Média       | Processar dois pacientes em sequência; verificar que contexto do segundo não tem dados do primeiro |
| GR-AI-005 | Memória desatualizada como verdade         | Detectivo  | TTL por tipo de memória + staleness indicator                               | `services/memory-service/`                         | Ausente | Média       | Criar memória com timestamp de 60 dias atrás; verificar que é rejeitada                            |
| GR-AI-006 | Agent em loop de autocorreção              | Preventivo | Limite de N tentativas por task; escalação automática após limite           | `packages/ai-gateway/` — rate limiter por agent    | Ausente | Alta        | Simular tarefa que sempre falha; verificar que agent para após N tentativas                        |
| GR-AI-007 | Validator aprovando sem verificação        | Detectivo  | Monitoramento de taxa de aprovação; alerta se > 95%                         | Prometheus alerta + Grafana dashboard              | Ausente | Média       | Configurar validator mock com 100% de aprovação; verificar que alerta dispara                      |
| GR-AI-008 | Injection via nota clínica                 | Preventivo | Remoção de padrões suspeitos de notas clínicas antes de incluir no contexto | `packages/ai-gateway/` — `sanitizeClinicalNote()`  | Ausente | Média       | Injetar instrução em nota clínica; verificar que é removida antes do prompt                        |
| GR-AI-009 | Ferramenta de Tier 3+ sem aprovação humana | Preventivo | Middleware de validação de Tier no AI Gateway                               | `packages/ai-gateway/` — `ToolTierValidator`       | Ausente | Alta        | Tentar executar ferramenta Tier 3 sem aprovação; verificar bloqueio                                |
| GR-AI-010 | PHI em memória de agent                    | Preventivo | Filtro de PHI na escrita no memory-service                                  | `services/memory-service/` — `writeMemory()`       | Ausente | Alta        | Tentar armazenar memória com CPF; verificar rejeição                                               |

---

## Domínio 2 — Governança de Agents

| ID         | Risco que Mitiga                     | Tipo          | Mecanismo                                                                      | Onde Implementado                                  | Status                                  | Efetividade | Como Testar                                                                       |
| ---------- | ------------------------------------ | ------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| GR-GOV-001 | Agent ativado sem shadow mode        | Preventivo    | Gate de lifecycle: PR para `active` requer relatório de shadow mode            | CI pipeline + PR template                          | Ausente                                 | Alta        | Criar PR para mudar agent para active sem relatório de shadow; verificar bloqueio |
| GR-GOV-002 | Nome de agent fora do padrão         | Preventivo    | Linter de nome de agent no CI                                                  | CI pipeline — `scripts/lint-agent-names.sh`        | Ausente                                 | Alta        | Criar agent com nome incorreto; verificar que CI falha                            |
| GR-GOV-003 | Task sem dono humano                 | Preventivo    | Campo `human_owner` obrigatório na schema de task                              | `services/task-inbox-service/` — schema validation | Ausente                                 | Alta        | Criar task sem `human_owner`; verificar rejeição                                  |
| GR-GOV-004 | Agent criando PRs sem limite de taxa | Preventivo    | Rate limiter: máximo 2 PRs por agent por hora                                  | `packages/ai-gateway/` — `GitHubPRRateLimit`       | Ausente                                 | Alta        | Tentar criar 3 PRs em 1 hora; verificar que 3º é bloqueado                        |
| GR-GOV-005 | Scorecard sem dados reais            | Detectivo     | ServiceMonitor para agents + dashboard de scorecard                            | Kubernetes ServiceMonitor + Grafana                | Ausente                                 | Alta        | Verificar que métricas de agent aparecem no Prometheus                            |
| GR-GOV-006 | Agent sem kill switch documentado    | Compensatório | Matriz de kill switches (`kill-switch-matrix.md`) atualizada antes de ativação | Documentação + ConfigMap kill-switch-config        | Parcial (doc criada, sem implementação) | Baixa       | Verificar que kill switch de cada agent funciona em < 60s                         |

---

## Domínio 3 — Segurança de Infraestrutura

| ID           | Risco que Mitiga                      | Tipo          | Mecanismo                                                                     | Onde Implementado                                       | Status               | Efetividade | Como Testar                                                                 |
| ------------ | ------------------------------------- | ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------- | ----------- | --------------------------------------------------------------------------- |
| GR-INFRA-001 | NetworkPolicy não enforçada (kindnet) | Compensatório | Documentação de risco + proibição de dados reais até CNI correto              | `docs/blindspots/` + processo                           | Parcial (doc criada) | Baixa       | Migrar para Calico/Cilium e verificar enforcement                           |
| GR-INFRA-002 | Pod sem resource limits — OOMKill     | Preventivo    | LimitRange por namespace com defaults obrigatórios                            | Kubernetes LimitRange em cada namespace                 | Ausente              | Alta        | Criar pod sem limits; verificar que LimitRange aplica defaults              |
| GR-INFRA-003 | KEDA sem maxReplicaCount              | Preventivo    | Kube-linter rule: ScaledObject deve ter maxReplicaCount                       | CI — `kube-linter`                                      | Ausente              | Alta        | Criar ScaledObject sem maxReplicaCount; verificar que CI falha              |
| GR-INFRA-004 | Container rodando como root           | Preventivo    | PodSecurity admission policy no namespace                                     | Kubernetes PodSecurity (restricted)                     | Ausente              | Alta        | Tentar criar pod com `runAsUser: 0`; verificar rejeição                     |
| GR-INFRA-005 | Secrets em código                     | Preventivo    | `gitleaks` no pre-commit e no CI                                              | `.github/workflows/security-scan.yml` + pre-commit hook | Ausente              | Alta        | Fazer commit com fake secret; verificar que pre-commit rejeita              |
| GR-INFRA-006 | Imagem com CVE crítico em produção    | Preventivo    | Trivy no CI — bloquear build com CVE crítico                                  | CI pipeline — `trivy image`                             | Ausente              | Alta        | Usar imagem com CVE crítico conhecida; verificar que build falha            |
| GR-INFRA-007 | Pod sem anti-affinity — SPOF em nó    | Preventivo    | Template de Deployment com PodAntiAffinity obrigatório para serviços críticos | `infra/helm/charts/` — `_helpers.tpl`                   | Ausente              | Média       | Verificar que replicas de serviço crítico estão em nós diferentes           |
| GR-INFRA-008 | Backup sem restore testado            | Detectivo     | Job de restore test mensal com alerta de falha                                | Kubernetes CronJob de restore test                      | Ausente              | Alta        | Executar restore test e medir tempo. Alerta se > RTO definido               |
| GR-INFRA-009 | Prettier corrompendo Helm             | Preventivo    | `.prettierignore` + `helm lint` no CI                                         | `.prettierignore` + CI pipeline                         | Parcial              | Média       | Executar Prettier em `charts/`; verificar que templates não são corrompidos |

---

## Domínio 4 — Proteção de Dados de Saúde (HIPAA/PHI)

| ID         | Risco que Mitiga                    | Tipo                      | Mecanismo                                                         | Onde Implementado                               | Status                     | Efetividade | Como Testar                                                          |
| ---------- | ----------------------------------- | ------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- | -------------------------- | ----------- | -------------------------------------------------------------------- |
| GR-PHI-001 | PHI em logs de aplicação            | Preventivo                | Log sanitization middleware em todos os serviços NestJS           | `packages/logging/` — `SanitizationInterceptor` | Ausente                    | Alta        | Fazer request com PHI no body; verificar que logs não contêm PHI     |
| GR-PHI-002 | PHI em traces OTel                  | Preventivo                | Attribute filtering no OTel Collector — allowlist de atributos    | `platform/otel-collector/config.yaml`           | Ausente                    | Alta        | Verificar que spans não contêm request body ou campos PHI            |
| GR-PHI-003 | Sem autenticação no frontend        | Preventivo                | NextAuth.js com OIDC — obrigatório antes de qualquer PHI real     | `apps/velya-web/`                               | Ausente                    | Alta        | Acessar `/patients` sem login; deve redirecionar para login          |
| GR-PHI-004 | Sem HTTPS                           | Preventivo                | TLS no nginx-ingress com cert-manager                             | `platform/ingress/` + cert-manager              | Ausente                    | Alta        | Verificar que `https://velya.x.x.x.nip.io` funciona                  |
| GR-PHI-005 | Sem audit log de acesso a PHI       | Detectivo + Compensatório | Audit log middleware: user_id, resource, timestamp, action        | `packages/audit/` — `AuditMiddleware`           | Ausente                    | Alta        | Acessar recurso de paciente; verificar que audit log registra acesso |
| GR-PHI-006 | PHI no browser (localStorage)       | Preventivo                | Auditoria de Web Storage + proibição de PHI em storage de browser | `apps/velya-web/` — code review rule            | Ausente                    | Média       | Inspecionar localStorage após navegar por dados de paciente          |
| GR-PHI-007 | Sem BAA com Anthropic               | Preventivo                | Gate de processo: PHI real proibido sem BAA assinado              | Processo + documentação                         | Compensatório (doc criada) | Baixa       | Verificar BAA assinado e arquivado antes de usar dados reais         |
| GR-PHI-008 | Retenção indefinida de PHI          | Preventivo                | TTL em Loki, Tempo, NATS streams e memory-service                 | Config de cada sistema                          | Ausente                    | Alta        | Verificar `retention_period` configurado em cada sistema             |
| GR-PHI-009 | Sem criptografia em repouso         | Detectivo                 | Verificação automática de criptografia em repouso por sistema     | Script de validação de segurança                | Ausente                    | Alta        | Verificar flags de criptografia em PostgreSQL, volumes, NATS         |
| GR-PHI-010 | PHI em contexto de AI desnecessário | Preventivo                | Context schema por tipo de task com campos PHI explícitos         | `packages/ai-gateway/` — `ContextSchemas`       | Ausente                    | Alta        | Verificar que contexto de análise de alta não inclui CPF e endereço  |

---

## Domínio 5 — Qualidade de Código

| ID          | Risco que Mitiga                 | Tipo       | Mecanismo                                                                 | Onde Implementado                         | Status  | Efetividade | Como Testar                                                                     |
| ----------- | -------------------------------- | ---------- | ------------------------------------------------------------------------- | ----------------------------------------- | ------- | ----------- | ------------------------------------------------------------------------------- |
| GR-CODE-001 | Cobertura de testes insuficiente | Preventivo | Gate de cobertura mínima de 80% no CI para `services/` e `packages/`      | CI pipeline — Jest/Vitest coverage        | Ausente | Alta        | Fazer PR com novo código sem testes; verificar que CI bloqueia merge            |
| GR-CODE-002 | Breaking change em tsconfig      | Preventivo | Typecheck completo em todos os pacotes quando tsconfig é modificado       | CI pipeline — hook condicional            | Ausente | Alta        | Modificar tsconfig.json; verificar que CI executa typecheck em todos os pacotes |
| GR-CODE-003 | Version bump com breaking change | Preventivo | Verificação de CHANGELOG + testes de integração em version-bump PRs       | CI pipeline — `check-breaking-changes.sh` | Ausente | Média       | Bump de major version sem especificação de breaking changes; verificar alerta   |
| GR-CODE-004 | `any` type em TypeScript         | Preventivo | ESLint rule `@typescript-eslint/no-explicit-any` como error               | `.eslintrc` — strict config               | Ausente | Alta        | Adicionar `any` ao código; verificar que lint falha                             |
| GR-CODE-005 | Logs não-estruturados            | Preventivo | ESLint rule proibindo `console.log` em código de serviço                  | `.eslintrc` — `no-console` rule           | Ausente | Alta        | Adicionar `console.log` a um serviço NestJS; verificar que lint falha           |
| GR-CODE-006 | Secret em código                 | Preventivo | `gitleaks` + pre-commit hook                                              | Pre-commit + CI                           | Ausente | Alta        | Fazer commit com string de API key; verificar bloqueio                          |
| GR-CODE-007 | Migration de banco sem backup    | Preventivo | Checklist de migration: backup obrigatório antes de migration destructiva | PR template + processo                    | Ausente | Média       | Verificar que PR de migration inclui evidência de backup                        |
| GR-CODE-008 | Mudança crítica sem ADR          | Preventivo | Template de PR exige referência a ADR para mudanças de arquitetura        | GitHub PR template                        | Ausente | Média       | Fazer PR de mudança de arquitetura sem ADR; verificar aviso                     |

---

## Domínio 6 — Custo

| ID          | Risco que Mitiga                        | Tipo       | Mecanismo                                                             | Onde Implementado                        | Status  | Efetividade | Como Testar                                                     |
| ----------- | --------------------------------------- | ---------- | --------------------------------------------------------------------- | ---------------------------------------- | ------- | ----------- | --------------------------------------------------------------- |
| GR-COST-001 | Agent em loop de AI — custo exponencial | Preventivo | Rate limiter por agent no AI Gateway: máximo 10 chamadas em 5 minutos | `packages/ai-gateway/`                   | Ausente | Alta        | Simular 11 chamadas do mesmo agent em 5 min; verificar bloqueio |
| GR-COST-002 | Model errado para tarefa simples        | Preventivo | Política de model routing por tipo de task                            | `packages/ai-gateway/` — `ModelRouter`   | Ausente | Alta        | Verificar que task de triagem usa Haiku, não Opus               |
| GR-COST-003 | Sem maxReplicaCount no KEDA             | Preventivo | Kube-linter rule obrigando maxReplicaCount                            | CI                                       | Ausente | Alta        | Criar ScaledObject sem maxReplicaCount; CI deve falhar          |
| GR-COST-004 | label patient_id no Prometheus          | Preventivo | Code review rule: proibir IDs de alta cardinalidade como labels       | `.github/CODEOWNERS` + review checklist  | Ausente | Média       | Adicionar patient_id como label; revisor deve rejeitar          |
| GR-COST-005 | Sem budget alert em AWS                 | Preventivo | AWS Budgets com alertas em 50%, 80%, 100%                             | OpenTofu — `infra/tofu/modules/budgets/` | Ausente | Alta        | Verificar que AWS Budget alert existe e notificação funciona    |
| GR-COST-006 | OTel 100% sampling em produção          | Preventivo | Tail-based sampling configurado no OTel Collector                     | `platform/otel-collector/config.yaml`    | Ausente | Alta        | Verificar `sampling.rate` no OTel Collector config              |

---

## Domínio 7 — Operação Clínica

| ID          | Risco que Mitiga                       | Tipo          | Mecanismo                                                                 | Onde Implementado                                   | Status  | Efetividade | Como Testar                                                                  |
| ----------- | -------------------------------------- | ------------- | ------------------------------------------------------------------------- | --------------------------------------------------- | ------- | ----------- | ---------------------------------------------------------------------------- |
| GR-CLIN-001 | Automation bias — confiança cega em AI | Compensatório | Disclaimer explícito em todas as recomendações de AI na UI                | `apps/velya-web/` — componente de AI recommendation | Ausente | Média       | Verificar que toda recomendação AI tem disclaimer "Requer validação clínica" |
| GR-CLIN-002 | Ação irreversível sem confirmação      | Preventivo    | Confirmação + undo window para ações críticas na UI                       | `apps/velya-web/` — `ConfirmationDialog`            | Ausente | Alta        | Tentar alta em massa; verificar que modal de confirmação aparece             |
| GR-CLIN-003 | Semáforo sem suporte daltonismo        | Preventivo    | Ícone + label + cor em todos os indicadores de status                     | `apps/velya-web/` — design system                   | Ausente | Alta        | Simular interface com filtro de daltonismo; verificar distinguibilidade      |
| GR-CLIN-004 | Dado stale como atual                  | Detectivo     | Timestamp de "última atualização" visível + alerta se > X min sem refresh | `apps/velya-web/` — React Query config              | Ausente | Média       | Verificar que timestamp de atualização aparece em dados críticos             |
| GR-CLIN-005 | Override de AI não monitorado          | Detectivo     | Registro de override com motivo + dashboard de override rate              | `apps/velya-web/` + Prometheus métrica              | Ausente | Média       | Fazer override de recomendação; verificar que é registrado com timestamp     |
| GR-CLIN-006 | Alert fatigue clínica                  | Preventivo    | Rate limiting de notificações: máximo X alertas por hora por usuário      | `services/notification-service/`                    | Ausente | Alta        | Enviar 20 alertas em 1 minuto para mesmo usuário; verificar throttling       |

---

## Domínio 8 — Mudança e Deploy

| ID            | Risco que Mitiga                       | Tipo       | Mecanismo                                                                | Onde Implementado        | Status  | Efetividade | Como Testar                                                           |
| ------------- | -------------------------------------- | ---------- | ------------------------------------------------------------------------ | ------------------------ | ------- | ----------- | --------------------------------------------------------------------- |
| GR-DEPLOY-001 | Deploy sem rollback automático         | Corretivo  | ArgoCD Rollouts com canary + análise automática de error rate            | `infra/argocd/rollouts/` | Ausente | Alta        | Fazer deploy com bug intencional; verificar rollback automático       |
| GR-DEPLOY-002 | Rollback sem reverter schema           | Preventivo | Migrations backward-compatible — policy enforçada em code review         | PR template + processo   | Ausente | Média       | Verificar que migration de coluna NOT NULL tem default value          |
| GR-DEPLOY-003 | Deploy em horário de pico              | Preventivo | Change freeze automático configurado para horário clínico crítico        | Branch protection + CI   | Ausente | Alta        | Tentar deploy às 8h (pico de altas); verificar bloqueio               |
| GR-DEPLOY-004 | Release sem observação pós-implantação | Preventivo | Release checklist obrigatório com sign-off após 10 minutos de observação | PR template + processo   | Ausente | Média       | Verificar que release notes incluem checklist de observação concluído |

---

## Domínio 9 — Observabilidade

| ID         | Risco que Mitiga                     | Tipo       | Mecanismo                                                               | Onde Implementado                              | Status  | Efetividade | Como Testar                                                         |
| ---------- | ------------------------------------ | ---------- | ----------------------------------------------------------------------- | ---------------------------------------------- | ------- | ----------- | ------------------------------------------------------------------- |
| GR-OBS-001 | Alertas sem receivers                | Preventivo | Teste de alerta de smoke obrigatório pós-deploy do Alertmanager         | CI + runbook                                   | Ausente | Alta        | Disparar alerta de teste e verificar recebimento no Slack/PagerDuty |
| GR-OBS-002 | Serviço sem ServiceMonitor           | Preventivo | Linter que verifica se todo serviço em `velya-dev-*` tem ServiceMonitor | CI                                             | Ausente | Alta        | Criar serviço sem ServiceMonitor; CI deve alertar                   |
| GR-OBS-003 | Consumer lag sem detecção            | Detectivo  | Alerta Prometheus: `nats_consumer_num_pending > 100` por > 5 min        | PrometheusRule                                 | Ausente | Alta        | Parar consumer e verificar que alerta dispara em 5 minutos          |
| GR-OBS-004 | Prometheus sem monitoramento próprio | Detectivo  | Probe sintético externo verificando endpoint de métricas do Prometheus  | `platform/probes/` — probe HTTP                | Ausente | Alta        | Parar Prometheus; verificar que probe externo detecta em < 2 min    |
| GR-OBS-005 | Logs sem trace_id                    | Preventivo | Middleware NestJS injetando trace_id em todos os logs                   | `packages/logging/` — `TraceContextMiddleware` | Ausente | Alta        | Verificar que logs de um request HTTP têm `trace_id` no JSON        |

---

## Sumário de Implementação

| Domínio                     | Total de Guardrails | Implementados | Parciais | Ausentes |
| --------------------------- | ------------------- | ------------- | -------- | -------- |
| Segurança de AI/Agents      | 10                  | 0             | 0        | 10       |
| Governança de Agents        | 6                   | 0             | 1        | 5        |
| Segurança de Infraestrutura | 9                   | 0             | 1        | 8        |
| Proteção de Dados de Saúde  | 10                  | 0             | 1        | 9        |
| Qualidade de Código         | 8                   | 0             | 0        | 8        |
| Custo                       | 6                   | 0             | 0        | 6        |
| Operação Clínica            | 6                   | 0             | 0        | 6        |
| Mudança e Deploy            | 4                   | 0             | 0        | 4        |
| Observabilidade             | 5                   | 0             | 0        | 5        |
| **TOTAL**                   | **64**              | **0**         | **3**    | **61**   |

---

## Guardrails Prioritários para Go-Live

Os seguintes guardrails são **pré-requisitos absolutos** antes de qualquer uso com dados reais de pacientes:

1. **GR-PHI-003** — Autenticação no frontend
2. **GR-PHI-004** — HTTPS obrigatório
3. **GR-PHI-001** — Log sanitization
4. **GR-PHI-005** — Audit log de acesso a PHI
5. **GR-PHI-007** — BAA com Anthropic
6. **GR-AI-001** — Sanitização de inputs para prevenir prompt injection
7. **GR-AI-009** — Middleware de validação de Tier de ferramentas
8. **GR-OBS-001** — Alertas com receivers configurados
9. **GR-CLIN-001** — Disclaimer de AI em recomendações clínicas
10. **GR-CLIN-002** — Confirmação de ações irreversíveis

> **Conclusão**: Com 0 de 64 guardrails plenamente implementados e 61 ausentes, a plataforma opera sem nenhuma das barreiras de proteção necessárias para um sistema de saúde. A implementação dos 10 guardrails prioritários de go-live deve ser o primeiro objetivo técnico antes de qualquer expansão de funcionalidade.
