# Velya Implementation Reality Check

## Data: 2026-04-09

## Metodologia: Analise direta do codigo-fonte, sem confiar em documentacao

---

## Legenda de Status

| Status                | Significado                                                        |
| --------------------- | ------------------------------------------------------------------ |
| **REAL**              | Codigo funcional que executa logica de negocio                     |
| **REAL (limitado)**   | Funciona mas com restricoes graves (e.g., /tmp/, sem auth)         |
| **SCAFFOLD**          | Estrutura criada, tipos definidos, mas logica retorna stubs/vazios |
| **TYPES-ONLY**        | Apenas interfaces/types TypeScript sem implementacao               |
| **DEPLOYED (unused)** | Infra deployada no cluster mas nao utilizada pelo codigo           |
| **YAML-ONLY**         | Manifesto Kubernetes existe mas nao e deployado                    |
| **DOCS-ONLY**         | Descrito em documentacao, zero codigo                              |
| **NOT STARTED**       | Mencionado como futuro, nenhum artefato                            |

---

## Frontend (apps/web/)

| Componente                      | Status           | Evidencia                                            | Arquivo(s)                              |
| ------------------------------- | ---------------- | ---------------------------------------------------- | --------------------------------------- |
| Dashboard principal (home page) | REAL (mock data) | Renderiza MetricCards e TaskRows com dados hardcoded | `apps/web/src/app/page.tsx`             |
| Pagina de pacientes             | REAL (mock data) | Lista de pacientes renderiza mas com dados fake      | `apps/web/src/app/patients/page.tsx`    |
| Pagina de alta (discharge)      | REAL (mock data) | Mostra blockers e status mas dados inventados        | `apps/web/src/app/discharge/page.tsx`   |
| Pagina de tasks                 | REAL (mock data) | Task inbox com items hardcoded                       | `apps/web/src/app/tasks/page.tsx`       |
| Pagina de auditoria             | REAL (limitado)  | Consulta API /api/audit que le de /tmp/              | `apps/web/src/app/audit/page.tsx`       |
| Pagina de atividade             | REAL (mock data) | Activity feed com dados fake                         | `apps/web/src/app/activity/page.tsx`    |
| Pagina de sugestoes             | REAL (mock data) | AI suggestions com dados mock                        | `apps/web/src/app/suggestions/page.tsx` |
| Pagina de sistema               | REAL (limitado)  | System health com metricas parcialmente reais        | `apps/web/src/app/system/page.tsx`      |
| Layout/App Shell                | REAL             | Renderiza sidebar, header, role selector             | `apps/web/src/app/layout.tsx`           |
| Componentes UI                  | REAL             | Cards, badges, tables, botoes funcionais             | `apps/web/src/app/components/`          |
| CSS/Estilos                     | REAL             | Tema escuro hospitalar funcional                     | `apps/web/src/app/globals.css`          |

**Resumo Frontend**: 8+ paginas renderizam corretamente. UI e a camada mais completa. Problema: **100% dos dados exibidos sao mock**. Nenhuma pagina faz fetch real a services backend (exceto audit e health que usam /tmp/).

---

## API Routes (apps/web/src/app/api/)

| Endpoint                | Status          | O Que Faz                                                         | O Que Nao Faz                                                     |
| ----------------------- | --------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET/POST /api/audit`   | REAL (limitado) | Le/escreve audit entries em /tmp/ com hash chain                  | Nao persiste em DB, perde em restart                              |
| `GET/POST /api/events`  | REAL (limitado) | Le/escreve eventos em /tmp/ JSON files                            | Nao persiste em DB, perde em restart                              |
| `POST /api/break-glass` | REAL (limitado) | Cria sessao break-glass com audit, verifica eligibilidade de role | Nao verifica identidade do chamador                               |
| `GET /api/break-glass`  | REAL (limitado) | Lista sessoes break-glass                                         | Verifica permissao pelo role no query param (confiando no caller) |
| `POST /api/ack`         | REAL (limitado) | Acknowledges eventos no event store                               | Sem verificacao de quem esta acknowledging                        |
| `POST /api/sentinel`    | REAL (limitado) | Recebe eventos de sentinel e armazena                             | Em /tmp/                                                          |
| `POST /api/alerts`      | REAL (limitado) | Recebe alertas e armazena                                         | Em /tmp/                                                          |
| `POST /api/errors`      | REAL (limitado) | Recebe erros e armazena                                           | Em /tmp/                                                          |
| `POST /api/actions`     | REAL (limitado) | Recebe acoes e armazena                                           | Em /tmp/                                                          |
| `GET /api/stats`        | REAL (limitado) | Retorna contadores de eventos por tipo                            | De /tmp/                                                          |
| `GET /api/health`       | REAL            | Retorna status ok com timestamp                                   | Nao verifica dependencias                                         |
| `GET /api/metrics`      | REAL (limitado) | Retorna metricas basicas                                          | Sem metricas de negocio                                           |
| `GET /api/suggestions`  | REAL (limitado) | Retorna sugestoes AI                                              | Mock/static data                                                  |
| `GET /api/access`       | REAL            | Retorna definicoes de role                                        | Somente leitura de constantes                                     |

**Resumo API Routes**: 13 endpoints funcionais. Todos operam com /tmp/ file storage ou dados estaticos. Nenhum se conecta a banco de dados ou services backend.

---

## Backend Services (services/)

| Service                    | Status           | Evidencia Detalhada                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **discharge-orchestrator** | SCAFFOLD         | **main.ts**: NestJS bootstrap funcional (26 linhas). **discharge-orchestrator.module.ts**: Registra DischargeController, zero providers (9 linhas). **discharge.controller.ts**: 6 endpoints, TODOS retornam arrays vazios ou `{ error: 'Not implemented', statusCode: 501 }`. **domain/discharge-blocker.ts**: Types e 2 funcoes utilitarias (`isBlockerOverdue`, `computeResolutionMinutes`). **Realidade**: Nenhum repositorio, nenhum service injetado, nenhuma conexao a DB, nenhum evento emitido. |
| **patient-flow**           | SCAFFOLD         | **main.ts**: Bootstrap identico (26 linhas). **patient-flow.module.ts**: Registra PatientFlowController, zero providers (9 linhas). **patient-flow.controller.ts**: 4 endpoints, TODOS retornam zeros ou arrays vazios. **domain/encounter.ts**: Types de Encounter (216 linhas de interfaces). **domain/bed-management.ts**: Types de census (177 linhas de interfaces). **Realidade**: Mesma estrutura vazia.                                                                                          |
| **task-inbox**             | SCAFFOLD         | **main.ts**: Bootstrap identico (26 linhas). **task-inbox.module.ts**: Zero providers (9 linhas). **task.controller.ts**: 8 endpoints (o mais rico), TODOS retornam stubs. **domain/task.ts**: Types de Task (225 linhas de interfaces). **Realidade**: Zero logica executada. `bulkOperation` retorna todas as tasks como "failed: Not implemented".                                                                                                                                                    |
| **audit-service**          | SCAFFOLD (vazio) | **main.ts**: Bootstrap (26 linhas). **audit-service.module.ts**: ZERO controllers, ZERO providers (8 linhas -- o service mais vazio). **domain/audit-entry.ts**: Types (166 linhas de interfaces). **Realidade**: Nenhum endpoint exposto. O service starta mas nao faz absolutamente nada.                                                                                                                                                                                                              |

**Resumo Backend Services**: 4 services NestJS. Todos fazem bootstrap e escutam numa porta. Nenhum processa nenhuma requisicao de forma util. Total de TODOs encontrados nos controllers: **11 TODOs**. Total de linhas de logica de negocio real: **~15** (isBlockerOverdue, computeResolutionMinutes, DEFAULT_SLA_MINUTES).

---

## Platform Services (platform/)

| Service                  | Status         | Evidencia                                                                                                                                                                                                                                           |
| ------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ai-gateway**           | REAL (isolado) | AnthropicProvider funcional com SDK real (151 linhas). ModelRouter com routing policies (183 linhas). RequestLogger para telemetria. **MAS**: nenhum service ou frontend envia requests ao gateway. E um servidor HTTP funcional sem clientes.      |
| **agent-orchestrator**   | TYPES-ONLY     | AgentDefinition, AgentLifecycle, AgentRuntime, Delegation, PolicyGate, Scorecard -- todos com tipos e alguma logica (349 linhas no runtime). **MAS**: nenhum agente real existe. O diretorio `agents/` nao existe. O orquestrador orquestra o nada. |
| **policy-engine**        | TYPES-ONLY     | Engine com 435 linhas de avaliacao de policies. **MAS**: nenhuma policy real carregada, nenhum consumidor.                                                                                                                                          |
| **decision-log-service** | TYPES-ONLY     | 406 linhas de modelo de decisao e armazenamento. **MAS**: nenhum produtor de decisoes.                                                                                                                                                              |
| **memory-service**       | TYPES-ONLY     | 372 linhas de memory store. **MAS**: nenhum agente usa a memoria.                                                                                                                                                                                   |

**Resumo Platform Services**: 5 services. AI Gateway e o mais funcional (Anthropic provider real). Os outros 4 sao implementacoes standalone sem consumidores ou produtores.

---

## Shared Packages (packages/)

| Package             | Status       | Evidencia                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **observability**   | TYPES-ONLY   | Counter, Histogram, Gauge (280 linhas). Tracer/SpanBuilder (332 linhas). Logger (228 linhas). **Critico**: NAO usa `@opentelemetry/sdk-*`. Implementacao custom que armazena metricas in-memory e nunca exporta. `flush()` retorna spans mas nao os envia a nenhum collector. **Nenhum service importa este package.** |
| **domain**          | TYPES-ONLY   | Patient, Task, DischargeBlocker types. **Nenhum service importa deste package** -- cada service tem seus proprios types internos (duplicados).                                                                                                                                                                         |
| **event-contracts** | TYPES-ONLY   | Event schemas definidos. **Nenhum produtor ou consumidor** os usa.                                                                                                                                                                                                                                                     |
| **event-schemas**   | TYPES-ONLY   | Schema definitions. Nao importado por nenhum service.                                                                                                                                                                                                                                                                  |
| **ai-contracts**    | TYPES-ONLY   | AIRequest, AIProvider, ModelRouting. Importado pelo ai-gateway mas por nenhum outro service.                                                                                                                                                                                                                           |
| **shared-kernel**   | DESCONHECIDO | Existente mas conteudo nao verificado.                                                                                                                                                                                                                                                                                 |
| **config**          | DESCONHECIDO | Existente mas conteudo nao verificado.                                                                                                                                                                                                                                                                                 |

**Resumo Packages**: 7 packages compartilhados. Nenhum e importado pelos services em `services/`. Duplicacao de types entre packages e services.

---

## Infrastructure (infra/)

| Componente              | Status              | Evidencia                                                                                                     |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| **ArgoCD**              | SCAFFOLD            | Unico arquivo `app-of-apps.yaml`. Sem Applications filhas para services individuais.                          |
| **K8s Bootstrap YAMLs** | YAML-ONLY (parcial) | 22 arquivos YAML no bootstrap/. Alguns deployados (Grafana, Prometheus rules), outros nao (Temporal, KEDA).   |
| **Grafana Dashboards**  | DEPLOYED (inutil)   | ConfigMaps deployados. Dashboards referenciam metricas `velya_*` que nenhum service emite. Mostram "No Data". |
| **Prometheus Rules**    | DEPLOYED (parcial)  | Rules de infra Kubernetes funcionam. Rules de metricas custom nao disparam (metricas nao existem).            |
| **Alertmanager Config** | YAML-ONLY           | Configuracao existe mas nao verificado se deployado.                                                          |
| **Service Monitors**    | YAML-ONLY           | Monitoram endpoints de services que retornam dados vazios.                                                    |
| **HPA**                 | YAML-ONLY           | Horizontal Pod Autoscaler baseado em metricas que nao existem.                                                |
| **PDB**                 | YAML-ONLY           | PodDisruptionBudgets para services sem replicas significativas.                                               |
| **Network Policies**    | YAML-ONLY           | Restringem trafego entre services que nao se comunicam.                                                       |
| **KEDA ScaledObjects**  | YAML-ONLY           | Event-driven scaling para NATS que nao esta conectado.                                                        |
| **Priority Classes**    | YAML-ONLY           | Prioridades definidas.                                                                                        |
| **Admission Policies**  | YAML-ONLY           | Policies de admissao.                                                                                         |
| **Sentinel CronJobs**   | YAML-ONLY           | Verificacoes periodicas.                                                                                      |
| **Temporal Values**     | YAML-ONLY           | Configuracao completa para Temporal com PostgreSQL. Nao referenciado por ArgoCD.                              |
| **Tempo Values**        | YAML-ONLY           | Configuracao para distributed tracing.                                                                        |
| **Argo Rollouts**       | YAML-ONLY           | Canary/blue-green deployment config.                                                                          |
| **OpenTofu**            | NOT STARTED         | Nenhum modulo existe. `infra/tofu/` nao encontrado.                                                           |
| **Helm Charts**         | NOT STARTED         | `infra/helm/charts/` nao encontrado.                                                                          |

**Resumo Infra**: Rica em YAMLs, pobre em utilidade. A maioria dos recursos K8s existe em forma de manifesto mas referencia um ecossistema (NATS, Temporal, metricas custom) que nao esta implementado.

---

## CI/CD (.github/workflows/)

| Workflow                     | Status          | Evidencia                                                                                                         |
| ---------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| **ci.yaml**                  | REAL            | Lint (ESLint), format (Prettier), typecheck, naming conventions. Actions pinned por SHA. Concurrency configurada. |
| **deploy-web.yaml**          | REAL (parcial)  | Deploy da web app. Funcional para o frontend.                                                                     |
| **platform-validation.yaml** | REAL (parcial)  | Validacao da plataforma.                                                                                          |
| **release.yaml**             | REAL            | Release workflow.                                                                                                 |
| **security.yaml**            | REAL (limitado) | Security scan. Escaneia codigo que nao tem logica de negocio.                                                     |
| **version-bump.yaml**        | REAL            | Version bumping.                                                                                                  |

**Resumo CI/CD**: Pipelines bem configurados (SHA pinning, concurrency). Problema: validam codigo que nao faz nada. Sem testes de integracao ou e2e no pipeline.

---

## Testing

| Area              | Status           | Evidencia                                                                                          |
| ----------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| Unit tests        | 1 FILE (trivial) | `tests/unit/platform.test.ts`: 2 testes que verificam que nome comeca com "velya-" e portas > 3000 |
| Integration tests | NOT STARTED      | Nenhum arquivo                                                                                     |
| E2E tests         | NOT STARTED      | Nenhum arquivo                                                                                     |
| Agent tests       | NOT STARTED      | Nenhum agente para testar                                                                          |
| Load tests        | NOT STARTED      | Nenhum arquivo                                                                                     |
| Security tests    | NOT STARTED      | Nenhum arquivo                                                                                     |
| Test coverage     | 0%               | Nenhuma logica de negocio testada                                                                  |

**Resumo Testing**: O repositorio tem **1 arquivo de teste com 2 assertions triviais**. O CLAUDE.md declara "Tests required. No merging without passing unit + integration tests." A regra de qualidade exige "80% coverage". A realidade e 0%.

---

## Documentation (docs/)

| Area                           | Contagem       | Status                  |
| ------------------------------ | -------------- | ----------------------- |
| Total de docs .md              | 249            | PROLIFERACAO            |
| Docs descrevendo estado FUTURO | ~230           | ASPIRACIONAL            |
| Docs descrevendo estado ATUAL  | ~19            | PARCIAL                 |
| Docs de blindspots             | 15             | EXISTENTE               |
| ADRs                           | Nao verificado | POSSIVELMENTE EXISTENTE |
| Runbooks testados              | 0              | DOCS-ONLY               |

**Resumo Docs**: 249 documentos markdown. A vasta maioria descreve uma plataforma que ainda nao existe. A documentacao e o artefato mais maduro do projeto -- e simultaneamente o mais enganoso, porque implica funcionalidade que nao esta implementada.

---

## Quadro Resumo Final

| Camada            | % Real   | % Scaffold | % Docs-Only |
| ----------------- | -------- | ---------- | ----------- |
| Frontend UI       | 70%      | 20%        | 10%         |
| API Routes        | 60%      | 30%        | 10%         |
| Backend Services  | 5%       | 85%        | 10%         |
| Platform Services | 15%      | 40%        | 45%         |
| Shared Packages   | 20%      | 30%        | 50%         |
| Infrastructure    | 20%      | 30%        | 50%         |
| CI/CD             | 80%      | 10%        | 10%         |
| Testing           | 1%       | 0%         | 99%         |
| Observability     | 5%       | 25%        | 70%         |
| Security/Auth     | 0%       | 10%        | 90%         |
| AI/Agents         | 5%       | 15%        | 80%         |
| **MEDIA GERAL**   | **~25%** | **~25%**   | **~50%**    |

A plataforma esta aproximadamente **25% implementada** quando medida por funcionalidade real. A metade do projeto existe apenas como documentacao.

---

## O Que E Necessario Para Chamar de "MVP"

Para um MVP minimamente funcional em ambiente hospitalar:

1. Autenticacao real com identity provider
2. Pelo menos 1 service com logica de negocio e persistencia em PostgreSQL
3. Frontend consumindo dados reais de APIs
4. Audit trail persistente (nao em /tmp/)
5. Testes unitarios cobrindo >50% da logica
6. Rate limiting basico
7. HTTPS enforced
8. Backup de dados

Estimativa conservadora: **12-16 semanas** de desenvolvimento focado com 2-3 engenheiros.
