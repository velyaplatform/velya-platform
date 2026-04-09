# Velya Omission Hunter Report

## Data: 2026-04-09
## Versao: 1.0
## Classificacao: CONFIDENCIAL - USO INTERNO

---

### Executive Summary

The Velya hospital platform is, in its current state, an **elaborate architectural blueprint with a thin veneer of functional code**. There are 249 documentation files describing a sophisticated hospital platform with NATS event-driven architecture, Temporal durable workflows, Medplum FHIR integration, multi-agent AI governance, and comprehensive RBAC. The reality is that **none of these integrations exist in working form**. The backend services (patient-flow, discharge-orchestrator, task-inbox, audit-service) are NestJS scaffolds where every single controller method returns hardcoded empty arrays or "Not implemented" errors. There is no database connection, no NATS client, no Temporal worker, no FHIR integration, no real authentication, and no real patient data anywhere in the system.

The frontend is the most complete layer -- 8+ pages that render in the browser with a functional UI, an access control engine with 28 professional roles, and an audit logger with hash-chain integrity. However, the frontend's RBAC is purely client-side (a dropdown selector with no backend verification), the audit trail writes to `/tmp/` (lost on every pod restart unless a PersistentVolume is manually attached), and all patient data displayed is hardcoded mock data in React components. The break-glass API endpoint accepts any request without authenticating who the caller actually is -- it trusts the `role` field sent in the request body.

The gap between what the documentation describes and what the code implements is not a "backlog" -- it is a **chasm**. Approximately 95% of the documented architecture is aspirational. The platform cannot be used in any clinical setting in its current form. The 15 files already in `docs/blindspots/` identify meta-risks but do not address the fundamental problem: **the services are empty shells**. This report catalogs every concrete omission found in the codebase.

---

### 1. Top 20 Riscos Mais Perigosos Que Ainda Nao Cobrimos

| ID | Dominio | Descricao | Impacto | Severidade | Urgencia |
|----|---------|-----------|---------|------------|----------|
| R-001 | Autenticacao | Nao existe autenticacao real. O usuario seleciona seu papel via dropdown no frontend. Qualquer pessoa pode se declarar `clinical_director` ou `admin_system`. | Acesso irrestrito a todas as funcionalidades | CRITICO | IMEDIATO |
| R-002 | Autorizacao Backend | O RBAC em `apps/web/src/lib/access-control.ts` so e verificado no frontend. Nenhum backend service valida tokens, sessoes ou permissoes. Qualquer chamada HTTP direta aos services ignora todas as regras. | Bypass total de controle de acesso | CRITICO | IMEDIATO |
| R-003 | Persistencia de Auditoria | `audit-logger.ts` escreve em `/tmp/velya-audit` (linha 5). Sem PersistentVolume, cada restart do pod apaga toda a trilha de auditoria. Em ambiente hospitalar, isso viola LGPD e regulamentacoes CFM. | Perda de evidencias regulatorias | CRITICO | IMEDIATO |
| R-004 | Persistencia de Eventos | `event-store.ts` escreve em `/tmp/velya-events` (linha 4). Mesma vulnerabilidade de R-003. Eventos de break-glass, alertas e acoes sao perdidos em cada restart. | Perda de registros de acesso de emergencia | CRITICO | IMEDIATO |
| R-005 | Servicos Vazios | Todos os 4 services em `services/` (patient-flow, discharge-orchestrator, task-inbox, audit-service) retornam arrays vazios ou "Not implemented" em cada endpoint. Nenhuma logica de negocio esta implementada. | Plataforma nao funcional para operacao | CRITICO | IMEDIATO |
| R-006 | Sem Banco de Dados | Nenhum service se conecta ao PostgreSQL. Nao existem entidades TypeORM/Prisma/Drizzle, nenhuma query SQL, nenhum pool de conexao. O PostgreSQL deployado no cluster e completamente ignorado pelo codigo. | Dados clinicos nao sao persistidos | CRITICO | IMEDIATO |
| R-007 | Break-Glass Sem Autenticacao | O endpoint `POST /api/break-glass` aceita qualquer `role` no body da requisicao sem validar identidade. Qualquer pessoa pode ativar acesso de emergencia para qualquer paciente. | Acesso de emergencia fraudulento | CRITICO | IMEDIATO |
| R-008 | NATS Nao Conectado | A arquitetura documenta NATS JetStream como backbone de eventos. Zero linhas de codigo importam ou usam um NATS client em qualquer service. Os subjects e consumers definidos na documentacao nao existem. | Nenhuma comunicacao event-driven | ALTO | CURTO PRAZO |
| R-009 | Temporal Nao Deployado | `infra/kubernetes/bootstrap/temporal-values.yaml` existe mas nao e referenciado por nenhum ArgoCD Application. Nenhum service tem Temporal workers ou workflow definitions. | Workflows duraveis inexistentes | ALTO | CURTO PRAZO |
| R-010 | Dados Mock no Frontend | Todas as paginas do frontend exibem dados hardcoded. Nao ha fetch real para APIs. Pacientes, tasks, metricas -- tudo e inventado no componente React. | Ilusao de funcionalidade | ALTO | CURTO PRAZO |
| R-011 | Observabilidade Fantasma | `packages/observability/` define Counter, Histogram, Gauge e Tracer -- todas implementacoes custom in-memory. Nao usam `@opentelemetry/sdk-*`. Nenhum service importa esses packages. Grafana dashboards referenciam metricas que nao sao emitidas. | Cegueira operacional total | ALTO | CURTO PRAZO |
| R-012 | AI Gateway Sem Integracao | `platform/ai-gateway/` tem o provider Anthropic implementado mas nenhum service ou frontend faz chamadas a ele. Nao existe roteamento real de requisicoes AI. | Capacidade AI nao utilizada | MEDIO | MEDIO PRAZO |
| R-013 | Platform Services Isolados | Os 5 platform services (agent-orchestrator, ai-gateway, decision-log-service, memory-service, policy-engine) sao implementacoes standalone. Nenhum se comunica com outro via NATS, HTTP ou qualquer mecanismo. | Orquestracao de agentes inexistente | ALTO | MEDIO PRAZO |
| R-014 | Sem Medplum/FHIR | A documentacao declara "FHIR-first clinical data model via Medplum". Nao existe nenhuma referencia a FHIR resources, Medplum client, ou modelo clinico padronizado em todo o codebase. | Interoperabilidade clinica zero | ALTO | MEDIO PRAZO |
| R-015 | Sem Testes Reais | O unico arquivo de teste e `tests/unit/platform.test.ts` com 2 testes triviais (verifica que o nome comeca com "velya-" e que portas sao > 3000). Zero testes de logica de negocio, integracao ou e2e. | Qualidade nao verificavel | CRITICO | IMEDIATO |
| R-016 | Sem Validacao de Input | Services usam `ValidationPipe` do NestJS mas nao tem DTOs com decorators `class-validator`. Os interfaces TypeScript sao apagados em runtime -- nenhuma validacao real acontece. | Dados invalidos aceitos silenciosamente | ALTO | CURTO PRAZO |
| R-017 | Sem Rate Limiting | Nenhum endpoint tem rate limiting. O break-glass pode ser chamado infinitamente. APIs podem ser abusadas sem restricao. | DDoS e abuso de recursos | ALTO | CURTO PRAZO |
| R-018 | Sem CORS Configurado | Nenhuma configuracao de CORS encontrada nos services NestJS ou no Next.js. Em producao, isso permite requisicoes cross-origin nao autorizadas. | Cross-site request forgery | MEDIO | CURTO PRAZO |
| R-019 | Sem Health Checks Reais | O endpoint `/api/health` na web app existe mas os backend services nao implementam health checks que verifiquem dependencias (DB, NATS, cache). | Pods reportam "healthy" quando estao disfuncionais | MEDIO | CURTO PRAZO |
| R-020 | Hash Chain Quebravel | A audit-logger usa `lastHash` em variavel in-memory (linha 57). Se o pod restartar, o lastHash reinicia como 'GENESIS', quebrando a cadeia. Se dois pods rodam simultaneamente, geram cadeias conflitantes. | Integridade de auditoria nao confiavel | ALTO | CURTO PRAZO |

---

### 2. Top 20 Areas de Falsa Sensacao de Completude

| ID | Area | O Que Parece | A Realidade |
|----|------|-------------|------------|
| F-001 | RBAC/Access Control | 28 roles definidos com data classes, actions, break-glass eligibility, audit levels. Parece completo. | So existe no frontend (`access-control.ts`). Nenhum backend verifica. O `isAllowed()` so e chamado no client-side rendering. Qualquer `curl` bypassa tudo. |
| F-002 | Audit Trail | Hash chain com SHA-256, integridade verificavel, filtros, busca por data. Implementacao sofisticada. | Escreve em `/tmp/`. Perdido em restart. Variavel `lastHash` in-memory. Sem replicacao. Sem backup. Sem retencao configurada. |
| F-003 | Event Store | Append-only event store com tipos, severidade, acknowledgment, limites de 10k eventos por tipo. | Mesma vulnerabilidade do /tmp/. writeFileSync (nao atomico). Sem transacoes. Sem indice. Busca e leitura linear de arquivo JSON inteiro. |
| F-004 | Discharge Orchestrator | Controller com 6 endpoints, domain model com tipos precisos (BlockerCategory, BlockerPriority, BlockerStatus, SLA defaults). | Cada metodo retorna `{ error: 'Not implemented', statusCode: 501 }` ou arrays vazios. Zero linhas de logica de negocio. |
| F-005 | Patient Flow | Controller com endpoints de census, command center, encounters. Domain model com Encounter e BedManagement. | Todos retornam zeros e arrays vazios. Nenhum dado real e consultado. |
| F-006 | Task Inbox | CRUD completo + bulk operations + subtasks + summary. Interface mais rica dos services. | Tudo retorna "Not implemented" ou "Task not found". Nem uma task pode ser criada. |
| F-007 | Observability Package | Counter, Histogram, Gauge classes. Tracer com SpanBuilder. Logger estruturado com correlation IDs. | Implementacao custom in-memory que nunca exporta para Prometheus ou OTLP. `flush()` retorna spans mas nao os envia. Nenhum service importa o package. |
| F-008 | CI/CD Pipeline | 6 workflows GitHub Actions: CI, deploy, security, release, version-bump, platform-validation. | CI faz lint e typecheck de codigo que nao tem testes. Deploy existe mas services nao tem logica. Security scan roda em codigo inerte. |
| F-009 | Kubernetes Bootstrap | 22 YAML files: HPA, PDB, network policies, KEDA, alertmanager, Prometheus rules, service monitors. | Referenciam metricas (`velya_*`) que nenhum service emite. Alertas disparam em metricas inexistentes. HPAs escalam baseados em metricas que nunca existem. |
| F-010 | AI Gateway | Provider Anthropic funcional, model router com routing policies, request logger. | Nao recebe nenhuma requisicao. Nenhum service ou frontend chama o gateway. E um servidor HTTP escutando no vazio. |
| F-011 | Agent Orchestrator | Runtime, lifecycle, delegation, policy gate, scorecard. Governanca sofisticada. | Nenhum agente real existe no repositorio. Diretorio `agents/` nao existe. O orquestrador nao tem agentes para orquestrar. |
| F-012 | Event Contracts | `packages/event-contracts/src/events.ts` define schemas de eventos. | Nenhum produtor ou consumidor real. Os eventos sao definidos mas nunca publicados ou processados. |
| F-013 | Domain Package | `packages/domain/` com Patient, Task, DischargeBlocker models. | Duplica os types dos services. Nenhum service importa do package compartilhado. Cada service tem seus proprios types internos. |
| F-014 | Grafana Dashboards | ConfigMaps com dashboards JSON completos: platform overview, runtime pressure. | Queries Prometheus referenciam metricas nao emitidas. Dashboards mostram "No Data" para tudo exceto metricas de infra do Kubernetes. |
| F-015 | ArgoCD Setup | App-of-apps pattern em `infra/argocd/app-of-apps.yaml`. | Arquivo unico. Nao ha Applications individuais para cada service. Nao ha promotion pipeline entre ambientes. |
| F-016 | Network Policies | YAML define restrict ingress/egress por namespace. | Policies referenciam services que retornam dados vazios. A seguranca de rede protege services que nao fazem nada. |
| F-017 | Prometheus Rules | Rules com thresholds para latencia, error rate, pod health. | Alertas baseados em metricas customizadas que nao existem. So alertas de infra Kubernetes funcionam. |
| F-018 | AI Contracts | `packages/ai-contracts/` com AIRequest, AIProvider, ModelRouting types. | Types existem mas nenhum servico os consome. Nao ha contrato validado em runtime. |
| F-019 | Decision Log Service | 406 linhas com modelo de decisao, armazenamento, busca. | Servico standalone sem consumidores. Nenhum agente ou workflow registra decisoes nele. |
| F-020 | Policy Engine | 435 linhas implementando avaliacao de policies. | Motor sem policies reais carregadas. Nenhum service consulta o policy engine para decisoes. |

---

### 3. Top 20 Validacoes Faltantes

| ID | Validacao | Onde Deveria Estar | Impacto da Ausencia |
|----|-----------|--------------------|---------------------|
| V-001 | Validacao de identidade do usuario em cada API request | Middleware de todos os services | Qualquer pessoa pode chamar qualquer endpoint |
| V-002 | Validacao de JWT/session token | Middleware de autenticacao (inexistente) | Sem prova criptografica de identidade |
| V-003 | Validacao de permissao no backend antes de cada operacao | Guards/interceptors NestJS | RBAC existe so no browser |
| V-004 | Validacao de schema com class-validator nos DTOs | Todos os controllers dos services | TypeScript interfaces nao validam em runtime |
| V-005 | Validacao de integridade referencial (patientId, encounterId) | Camada de domain/repository | IDs fantasmas aceitos sem verificacao |
| V-006 | Validacao de limites de break-glass (max sessoes simultaneas) | Break-glass API route | Um role pode abrir infinitas sessoes |
| V-007 | Validacao de transicoes de estado validas (e.g., blocker lifecycle) | Domain services | Status pode pular de "identified" para qualquer outro |
| V-008 | Validacao de dados clinicos contra FHIR R4 profiles | Camada de persistencia (inexistente) | Dados clinicos nao seguem nenhum padrao |
| V-009 | Validacao de CPF/CRM/COREN nos cadastros de profissionais | Modulo de identidade (inexistente) | Conselho profissional nunca verificado |
| V-010 | Validacao de formato de datas (timezone-aware, ISO-8601) | Todos os endpoints que recebem datas | Inconsistencias de timezone |
| V-011 | Validacao de tamanho maximo de payload em requests | NestJS global pipes ou express middleware | Requests enormes podem causar OOM |
| V-012 | Validacao de idempotencia em operacoes de escrita | Middleware ou interceptor | Operacoes duplicadas criam dados duplicados |
| V-013 | Validacao de conflito de versao (optimistic locking) | Domain services + repository | Writes concorrentes sobrescrevem sem deteccao |
| V-014 | Validacao de SLA deadlines em formato ISO valido | Discharge blocker creation | SLA invalido nao gera erro |
| V-015 | Validacao de justificativa de break-glass contra blacklist de termos genericos | Break-glass API | "teste" ou "xxx" sao aceitos como justificativa |
| V-016 | Validacao de que eventos no event store nao ultrapassem tamanho maximo | Event store append | Evento gigante pode corromper o arquivo JSON |
| V-017 | Validacao de rate limit por role e por IP | Todos os endpoints | Sem protecao contra abuso |
| V-018 | Validacao de que um profissional so acessa pacientes de seu setor/turno | Backend authorization (ABAC) | `patientRelationship` no AuthContext nunca e verificado no backend |
| V-019 | Validacao de assinatura digital em documentos clinicos | Modulo de assinatura (inexistente) | `sign_document` action existe no RBAC mas nao ha implementacao |
| V-020 | Validacao de que audit log nao foi corrompido antes de servir dados | API de auditoria | Dados corrompidos retornados sem aviso |

---

### 4. Top 20 Testes Faltantes

| ID | Cenario de Teste | Tipo | Arquivo que Deveria Testar |
|----|-----------------|------|----------------------------|
| T-001 | `isAllowed()` retorna false para role sem permissao | Unit | `access-control.test.ts` |
| T-002 | `isAllowed()` com break-glass permite acesso para role elegivel | Unit | `access-control.test.ts` |
| T-003 | `isAllowed()` com break-glass nega acesso para role nao elegivel | Unit | `access-control.test.ts` |
| T-004 | Audit logger cria arquivo diario e appenda corretamente | Integration | `audit-logger.test.ts` |
| T-005 | Audit logger mantem hash chain integra apos multiplas entradas | Unit | `audit-logger.test.ts` |
| T-006 | `verifyIntegrity()` detecta adulteracao no meio da chain | Unit | `audit-logger.test.ts` |
| T-007 | Event store respeita MAX_EVENTS_PER_FILE e descarta antigos | Unit | `event-store.test.ts` |
| T-008 | Break-glass endpoint rejeita roles nao elegiveis com 403 | Integration | `break-glass.test.ts` |
| T-009 | Break-glass endpoint rejeita justificativa curta (< 10 chars) | Integration | `break-glass.test.ts` |
| T-010 | DischargeController.listBlockers retorna paginacao correta | Integration | `discharge.controller.test.ts` |
| T-011 | PatientFlowController.getCensus retorna dados por departamento | Integration | `patient-flow.controller.test.ts` |
| T-012 | TaskController.createTask valida campos obrigatorios | Integration | `task.controller.test.ts` |
| T-013 | TaskController.bulkOperation processa parcialmente (alguns sucesso, alguns falha) | Integration | `task.controller.test.ts` |
| T-014 | isBlockerOverdue retorna true quando slaDeadline passou | Unit | `discharge-blocker.test.ts` |
| T-015 | computeResolutionMinutes calcula corretamente | Unit | `discharge-blocker.test.ts` |
| T-016 | Observability Counter incrementa e collecta corretamente | Unit | `metrics.test.ts` |
| T-017 | Observability Histogram calcula percentis corretamente | Unit | `metrics.test.ts` |
| T-018 | Logger filtra por minLevel corretamente | Unit | `logger.test.ts` |
| T-019 | SpanBuilder propaga trace context para child spans | Unit | `tracer.test.ts` |
| T-020 | AnthropicProvider retorna completion e calcula custo | Integration | `anthropic-provider.test.ts` |

---

### 5. Top 20 Dashboards/Alertas Faltantes

| ID | Dashboard/Alerta | Por Que E Necessario | Status |
|----|-----------------|---------------------|--------|
| D-001 | Dashboard de sessoes break-glass ativas | Supervisores precisam ver quem tem acesso de emergencia em tempo real | NAO EXISTE (dados em /tmp/) |
| D-002 | Alerta de break-glass ativado (notificacao imediata) | CFM exige supervisao de acesso de emergencia | Evento e criado mas nao entregue a ninguem |
| D-003 | Dashboard de ocupacao de leitos em tempo real | Core da operacao hospitalar | Endpoint retorna zeros |
| D-004 | Dashboard de blockers de alta por categoria | Gestao de altas precisa visao agregada | Endpoint retorna zeros |
| D-005 | Alerta de blocker de alta ultrapassando SLA | Escalacao de atrasos na alta | Nenhuma metrica emitida |
| D-006 | Dashboard de tasks pendentes por equipe | Gestao de carga de trabalho | Endpoint retorna zeros |
| D-007 | Alerta de task nao atendida apos SLA | Escalacao de tarefas negligenciadas | Sem metricas |
| D-008 | Dashboard de metricas RED por service (rate, errors, duration) | Observabilidade basica de microservicos | Package existe, nenhum service usa |
| D-009 | Dashboard de latencia P50/P95/P99 por endpoint | Performance tracking | Histograma definido, nunca populado |
| D-010 | Alerta de error rate acima de 5% em qualquer service | Deteccao rapida de degradacao | Sem metricas |
| D-011 | Dashboard de integridade da audit chain | Compliance e regulatorio | verifyIntegrity() existe mas nao e exposto em dashboard |
| D-012 | Dashboard de decisoes AI com confidence score | Supervisao de recomendacoes AI | Decision log service isolado |
| D-013 | Alerta de AI gateway com latencia alta | Performance de AI | Gateway sem metricas expostas |
| D-014 | Dashboard de custo de AI por provider e modelo | Controle financeiro de AI | costPerInputToken definido mas nunca calculado agregado |
| D-015 | Dashboard de agent scorecard (accuracy, latency, error rate) | Governanca de agentes | Scorecard definido em codigo, sem agentes reais |
| D-016 | Alerta de pod usando /tmp/ sem PersistentVolume | Deteccao de perda de dados | Nao existe |
| D-017 | Dashboard de census hospitalar historico (trends) | Planejamento de capacidade | Sem dados historicos |
| D-018 | Alerta de PostgreSQL sem connections de services | Deteccao de DB nao utilizado | DB deployado mas ignorado |
| D-019 | Dashboard de throughput de eventos NATS | Monitoramento do event bus | NATS nao conectado |
| D-020 | Dashboard de Temporal workflow execution status | Monitoramento de workflows | Temporal nao deployado |

---

### 6. Top 20 Workflows Faltantes

| ID | Workflow | Descricao | Dependencias |
|----|----------|-----------|-------------|
| W-001 | Patient Admission Workflow | Registrar admissao, atribuir leito, criar encounter, notificar equipes | DB, patient-flow service, NATS |
| W-002 | Discharge Planning Workflow | Identificar blockers, atribuir responsaveis, acompanhar resolucao, aprovar alta | Temporal, discharge-orchestrator, NATS |
| W-003 | Break-Glass Audit Review | Notificar supervisor, exigir revisao em 24h, registrar resultado | NATS, audit service, notificacoes |
| W-004 | Medication Reconciliation | Verificar medicamentos na admissao e alta, detectar interacoes | FHIR/Medplum, pharmacy |
| W-005 | Lab Result Delivery | Receber resultado de lab, notificar medico, atualizar prontuario | Integracao externa, FHIR |
| W-006 | Clinical Alert Escalation | Detectar alerta clinico, notificar cadeia de comando ate resposta | NATS, notificacoes, task-inbox |
| W-007 | Insurance Pre-Authorization | Solicitar autorizacao, acompanhar status, atualizar billing | Integracao convennio, billing |
| W-008 | Shift Handoff | Transferir responsabilidades entre turnos com checklist | NATS, task-inbox |
| W-009 | Bed Turnover Coordination | Coordenar limpeza, manutencao e disponibilizacao de leito apos alta | task-inbox, cleaning, maintenance |
| W-010 | Patient Transfer Between Units | Coordenar transporte, atualizacao de leito, transferencia de responsabilidade | patient-flow, transport |
| W-011 | Critical Value Notification | Resultado laboratorial critico -> notificacao imediata ao medico com confirmacao | NATS, notificacoes, timeout |
| W-012 | Consent Collection | Coletar consentimento para procedimento, armazenar assinatura, registrar audit | FHIR, assinatura digital |
| W-013 | Incident Report | Reportar incidente clinico, investigar, documentar, comunicar | Forms, audit, notificacoes |
| W-014 | Patient Identity Verification | Verificar identidade antes de procedimento critico (2 identificadores) | Patient registry |
| W-015 | Controlled Substance Dispensing | Dupla verificacao, registro, reconciliacao de controlados | Pharmacy, audit |
| W-016 | Agent Shadow-to-Active Promotion | Avaliar metricas de shadow, aprovar promocao, ativar | Agent orchestrator, scorecard |
| W-017 | Secret Rotation | Rotacionar credenciais periodicamente, atualizar ESO, verificar services | ESO, K8s secrets |
| W-018 | Data Backup and Recovery | Backup de PostgreSQL, audit logs, event store. Teste de recovery. | PostgreSQL, storage |
| W-019 | Compliance Audit Report Generation | Gerar relatorio de compliance periodico com evidencias | Audit service, report generator |
| W-020 | User Provisioning/Deprovisioning | Criar/remover acesso de profissional com verificacao de conselho | Identity provider, RBAC |

---

### 7. Top 20 Politicas/Guardrails Faltantes

| ID | Politica | Descricao | Consequencia da Ausencia |
|----|----------|-----------|--------------------------|
| G-001 | Session Timeout Policy | Sessoes devem expirar apos inatividade (15-30 min para clinicos) | Sessoes eternas. Terminais abandonados permanecem logados. |
| G-002 | Password/Credential Policy | Requisitos de complexidade, rotacao, MFA | Nao existe autenticacao para ter politica de senha |
| G-003 | Data Retention Policy (enforced) | Audit logs devem ser retidos por X anos conforme regulacao | Audit logs em /tmp/ sobrevivem ate o proximo restart |
| G-004 | PHI Access Logging Policy (enforced) | Todo acesso a dados de paciente deve ser logado | Frontend loga, backend nao existe para logar |
| G-005 | Concurrent Session Limit | Mesmo usuario nao pode ter sessoes simultaneas excessivas | Sem autenticacao, sem controle de sessao |
| G-006 | Data Classification Enforcement | Classes A-E definidas no RBAC mas nunca verificadas nos dados | Dados nao tem classificacao atribuida |
| G-007 | Encryption at Rest | Dados sensiveis devem ser criptografados em disco | /tmp/ sem criptografia, sem volume criptografado |
| G-008 | Encryption in Transit (service-to-service) | mTLS entre services | Services se comunicam via HTTP plain |
| G-009 | Backup Policy | Backup regular de dados criticos com teste de restore | Nenhum backup configurado |
| G-010 | Disaster Recovery Plan | RTO/RPO definidos, procedimento de failover | Nenhum DR plan implementado |
| G-011 | Change Management Gate | Mudancas em producao requerem aprovacao formal | CI/CD faz merge sem gates de qualidade significativos |
| G-012 | Data Minimization Enforcement | Doc `data-minimization-model.md` existe mas nao e enforced | Todos os dados sao acessiveis sem restricao |
| G-013 | API Versioning Policy | APIs devem ter versionamento (v1, v2) com deprecation timeline | Services usam `/api/v1/` mas nao ha politica de evolucao |
| G-014 | Log Sanitization (PHI) | Logs nao devem conter PHI em texto plano | audit-logger loga dados sem sanitizacao de PHI |
| G-015 | Feature Flag Governance | Flags devem ter owner, descricao, data de remocao | Nenhum sistema de feature flags implementado |
| G-016 | Dependency Vulnerability SLA | CVEs criticas devem ser corrigidas em 24h | Security scan roda mas sem SLA enforced |
| G-017 | Agent Kill Switch (implemented) | Docs descrevem kill switches para agentes. Nenhum implementado. | Agentes (quando existirem) nao podem ser parados de emergencia |
| G-018 | Capacity Planning Policy | Limites de pacientes/leitos/encounters por instancia | Sem limites definidos ou enforced |
| G-019 | Cross-tenant Data Isolation | Se multiplos hospitais usarem a plataforma | Nenhum tenant isolation implementado |
| G-020 | Incident Response Runbook (tested) | Runbooks existem em docs/ mas nunca foram testados | Documentacao sem validacao pratica |

---

### 8. Registro de Omissoes por Dominio

#### 8.1 Seguranca do Paciente

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Nenhum mecanismo de "five rights" de medicacao (paciente certo, medicamento certo, dose certa, via certa, hora certa) | Nenhum modulo de pharmacy/medication em services/ | CRITICO |
| 2 | Sem alerta de alergia a medicamento | Sem modelo de dados de alergia | CRITICO |
| 3 | Sem verificacao de interacao medicamentosa | Sem base de dados farmacologica | CRITICO |
| 4 | Sem protocolo de deterioracao clinica (NEWS/MEWS score) | Sem calculo de scores de risco | ALTO |
| 5 | Sem alerta de queda de paciente | Sem escala de Morse implementada | ALTO |
| 6 | Sem checklist de cirurgia segura (OMS) | Nenhum modulo cirurgico | ALTO |
| 7 | `approve_discharge` action existe no RBAC mas nao ha workflow de validacao clinica | discharge-orchestrator retorna "Not implemented" | CRITICO |

#### 8.2 Comunicacao e Continuidade

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Sem handoff estruturado entre turnos (SBAR) | Nenhum modulo de handoff | ALTO |
| 2 | Sem notificacoes push para clinicos | NATS nao conectado, sem WebSocket | ALTO |
| 3 | Sem integracoes com sistemas de mensagens (WhatsApp/email para familiares) | Nenhum modulo de comunicacao externa | MEDIO |
| 4 | Sem painel de pendencias por turno | Task inbox retorna arrays vazios | ALTO |
| 5 | Sem rastreamento de leitura de comunicados | Sem modelo de acknowledgment de comunicados | MEDIO |

#### 8.3 Contingencia e Downtime

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Sem plano de downtime documentado com procedimentos manuais | Nenhum runbook de contingencia testado | CRITICO |
| 2 | Sem modo offline do frontend | App web pura, sem service worker | ALTO |
| 3 | Sem fallback de impressao de formularios essenciais | Nenhum template de formulario de contingencia | ALTO |
| 4 | Sem redundancia de audit trail (backup em tempo real) | Single point of failure em /tmp/ | CRITICO |
| 5 | Sem DR (Disaster Recovery) testado | Nenhum teste de restore | CRITICO |

#### 8.4 Interfaces e Integracao

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Sem integracao com laboratorio (LIS) | Nenhum modulo de integracao | ALTO |
| 2 | Sem integracao com imagem (RIS/PACS) | Nenhum modulo de integracao | ALTO |
| 3 | Sem integracao com farmacia externa | Nenhum modulo de integracao | MEDIO |
| 4 | Sem integracao com convenios/ANS (TISS/TUSS) | Nenhum modulo de billing | ALTO |
| 5 | Sem integracao com RNDS (Rede Nacional de Dados em Saude) | Nenhum modulo de integracao nacional | MEDIO |
| 6 | Anti-corruption layers mencionados em docs mas nenhum existe em `services/integrations/` | Diretorio nao existe | ALTO |

#### 8.5 Identidade e Acesso

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Sem identity provider (Keycloak, Auth0, Cognito) | Nenhuma dependencia de IdP | CRITICO |
| 2 | Sem MFA (Multi-Factor Authentication) | Sem autenticacao basica | CRITICO |
| 3 | Sem SSO (Single Sign-On) | Sem autenticacao | CRITICO |
| 4 | Sem JIT provisioning real (it_support_jit, security_admin_jit sao apenas labels) | Roles existem no RBAC mas sem mecanismo de elevacao temporal | ALTO |
| 5 | Sem audit de logins/logouts | Sem autenticacao para auditar | CRITICO |
| 6 | `resolveUiRole()` faz fallback para `admin_system` quando role e desconhecido (linha 711 access-control.ts) | Um role invalido ganha acesso de admin | CRITICO |

#### 8.6 Dados e Qualidade

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Sem modelo de dados persistente (nenhum schema de banco) | Zero migrations, zero entidades | CRITICO |
| 2 | Sem validacao de dados de paciente (CPF, data de nascimento, nome) | Sem modulo de cadastro | ALTO |
| 3 | Sem deduplicacao de pacientes | Sem master patient index | ALTO |
| 4 | Sem versionamento de dados clinicos | Sem event sourcing real | ALTO |
| 5 | Sem qualidade de dados (completude, consistencia, atualidade) | Sem metricas de qualidade | MEDIO |
| 6 | PostgreSQL deployado no cluster (`postgresql.velya-dev-platform.svc.cluster.local`) mas zero queries em todo o codebase | `temporal-values.yaml` referencia o host | CRITICO |

#### 8.7 Auditoria e Proveniencia

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Audit trail so no frontend (Next.js API routes). Backend services nao auditam nada. | Zero imports de audit-logger em services/ | CRITICO |
| 2 | Sem proveniencia de dados (quem criou, quando, de onde veio) | Sem campo de proveniencia nos models | ALTO |
| 3 | Sem non-repudiation (assinatura digital em acoes criticas) | Sem PKI, sem certificado digital | ALTO |
| 4 | Audit log nao e exportavel para SIEM | Sem integrador com SIEM | MEDIO |
| 5 | Sem retencao configuravel de audit logs | Hardcoded em /tmp/ sem cleanup | ALTO |
| 6 | `queryAudit()` le arquivo inteiro em memoria para cada consulta | `readFileSync` na linha 174 do audit-logger.ts | MEDIO |

#### 8.8 IA e Agents

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Nenhum agente real existe. Diretorio `agents/` nao existe no repositorio. | `ls agents/` retorna erro | ALTO |
| 2 | AI Gateway implementado mas nunca chamado | Nenhum import ou HTTP call ao gateway | ALTO |
| 3 | Sem prompt injection detection implementada | Mencionado em `ai-safety.md` rules mas sem codigo | ALTO |
| 4 | Sem PHI redaction em prompts AI | Mencionado em docs, sem implementacao | CRITICO |
| 5 | Sem shadow mode implementado (mecanismo de comparacao) | Lifecycle definido, sem codigo | ALTO |
| 6 | 14 paginas de regras de governanca de agentes para zero agentes | `.claude/rules/agents.md`, `agent-governance.md`, `ai-safety.md` | INFO |

#### 8.9 Infraestrutura

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Sem OpenTofu modules implementados | `infra/tofu/` nao existe | ALTO |
| 2 | Sem PersistentVolumeClaim para audit/event store | Nenhum PVC definido em bootstrap/ | CRITICO |
| 3 | Sem Dockerfiles para backend services | Dockerfile existe so para `apps/web` e `apps/api-gateway` | ALTO |
| 4 | Sem Helm charts para services | `infra/helm/charts/` nao existe | ALTO |
| 5 | ArgoCD tem apenas `app-of-apps.yaml` sem Applications filhas | Arquivo unico em `infra/argocd/` | ALTO |
| 6 | Temporal values file existe mas nao e referenciado por nenhum deployment | `temporal-values.yaml` orfao | ALTO |
| 7 | Services nao tem Dockerfiles, nao podem ser containerizados e deployados | Sem build pipeline para services | CRITICO |

#### 8.10 UX e Fatores Humanos

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Role selector e um dropdown sem autenticacao -- confuso e inseguro | Frontend page layout.tsx | CRITICO |
| 2 | Sem validacao de usabilidade com profissionais reais | Sem testes de usabilidade documentados | ALTO |
| 3 | Sem modo escuro / alto contraste (acessibilidade) | Sem WCAG compliance | MEDIO |
| 4 | Sem internacionalizacao (i18n) -- strings hardcoded em PT-BR e EN misturadas | Componentes React | MEDIO |
| 5 | Sem feedback de loading/error states em operacoes | Dados mock nao geram loading | MEDIO |
| 6 | Sem responsividade para mobile/tablet | CSS desktop-first | MEDIO |

#### 8.11 Governanca

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | 249 docs mas nenhum processo de revisao de docs | Docs descrevem futuro sem data | MEDIO |
| 2 | ADRs mencionados nas rules mas diretorio `docs/architecture/decisions/` nao verificado | Decisoes podem nao estar registradas | MEDIO |
| 3 | Sem Definition of Done para features | Sem criterio de aceitacao | ALTO |
| 4 | Sem SLA definidos e medidos para services | Sem SLO/SLI/SLA | ALTO |
| 5 | Sem processo de change management para producao | CI faz deploy sem gates | ALTO |
| 6 | Sem comite de seguranca de paciente atuante na plataforma | Sem workflow de comite | ALTO |

#### 8.12 Seguranca e Privacidade

| # | Omissao | Evidencia | Severidade |
|---|---------|-----------|------------|
| 1 | Sem LGPD compliance implementada (consentimento, portabilidade, exclusao) | Nenhum modulo de privacidade | CRITICO |
| 2 | Sem criptografia de dados sensiveis em repouso | /tmp/ sem criptografia | CRITICO |
| 3 | Sem WAF (Web Application Firewall) | Sem configuracao de WAF | ALTO |
| 4 | Sem pen-test executado | Sem relatorio de pen-test | ALTO |
| 5 | Sem DPIA (Data Protection Impact Assessment) | Nenhum documento DPIA | ALTO |
| 6 | Sem DPO (Data Protection Officer) designado na plataforma | Sem configuracao de DPO | ALTO |
| 7 | Break-glass endpoint acessivel sem HTTPS enforcement | Sem redirect HTTP->HTTPS no service | ALTO |

---

### 9. Registro de Contradicoes Entre Prompts/Artefatos

| ID | Artefato A | Artefato B | Contradicao |
|----|-----------|-----------|-------------|
| C-001 | `CLAUDE.md`: "FHIR-first clinical data model via Medplum" | Codebase inteiro | Zero linhas de FHIR ou Medplum em qualquer arquivo .ts |
| C-002 | `CLAUDE.md`: "NATS JetStream" como messaging | Services | Nenhum import de NATS client em nenhum service |
| C-003 | `CLAUDE.md`: "Temporal" para workflows | Services | Nenhum import de @temporalio em nenhum service |
| C-004 | `CLAUDE.md`: "OpenTelemetry" para observabilidade | `packages/observability/` | Implementacao custom sem OpenTelemetry SDK real. Nenhum service importa. |
| C-005 | `CLAUDE.md`: "Tests required. No merging without passing unit + integration tests" | `tests/` | Unico teste verifica nome e portas. Zero testes de logica. |
| C-006 | `.claude/rules/quality.md`: "Minimum coverage: 80% line coverage" | Repositorio | Coverage e 0% para toda logica de negocio |
| C-007 | `.claude/rules/quality.md`: "Use Vitest as the test runner" | `tests/unit/platform.test.ts` | Arquivo importa vitest mas testa trivialidades |
| C-008 | `.claude/rules/architecture.md`: "All domain events are published to NATS" | Services | Zero eventos publicados |
| C-009 | `.claude/rules/security.md`: "No secrets in code. Ever." | `.ministack/repo/.env` | Arquivo .env existe (possivelmente com segredos) |
| C-010 | `.claude/rules/agents.md`: "Agent definitions live in agents/{office}/{agent-name}/" | Repositorio | Diretorio `agents/` nao existe |
| C-011 | `.claude/rules/architecture.md`: "Each service owns its data" | Services | Nenhum service acessa nenhum dado |
| C-012 | `.claude/rules/infrastructure.md`: "OpenTofu is the only tool for cloud provisioning" | `infra/` | Nenhum modulo OpenTofu existe |
| C-013 | `access-control.ts` linha 711: fallback para `admin_system` | Principio de menor privilegio | Role desconhecido ganha privilegio maximo |
| C-014 | `.claude/rules/red-team.md`: "Red Team Office reports to the Governance Council" | Repositorio | Nao ha Red Team Office implementado |
| C-015 | `CLAUDE.md`: "Structured logging only. No console.log" | `audit-logger.ts` linha 142 | Usa `console.log` para output de auditoria |

---

### 10. Registro de Assuncoes Nao Testadas

| ID | Assuncao | Onde e Feita | Como Validar | Status |
|----|----------|-------------|-------------|--------|
| A-001 | PostgreSQL esta acessivel e tem databases criados | temporal-values.yaml referencia host | Conectar e verificar | NAO VALIDADO |
| A-002 | /tmp/ tem espaco suficiente para audit logs de um dia inteiro | audit-logger.ts | Calcular volume de logs por dia | NAO VALIDADO |
| A-003 | writeFileSync e rapido o suficiente para nao bloquear requests | audit-logger.ts linha 139 | Load test com writes concorrentes | NAO VALIDADO |
| A-004 | JSON.parse de arquivo inteiro cabe em memoria | audit-logger.ts queryAudit() | Simular arquivo com 100k+ entradas | NAO VALIDADO |
| A-005 | Math.random() gera IDs suficientemente unicos | audit-logger.ts, event-store.ts | Analise de colisao em volume alto | NAO VALIDADO |
| A-006 | 10000 eventos por tipo e suficiente | event-store.ts MAX_EVENTS_PER_FILE | Medir volume real de eventos | NAO VALIDADO |
| A-007 | Hash chain SHA-256 e suficiente para compliance regulatorio | audit-logger.ts | Consulta juridica sobre requisitos de auditoria | NAO VALIDADO |
| A-008 | 30 minutos de break-glass e tempo suficiente/seguro | break-glass route.ts | Consultar politica hospitalar | NAO VALIDADO |
| A-009 | Grafana dashboards sao lidos pelo sidecar automaticamente | grafana-dashboards-velya.yaml label `grafana_dashboard: "1"` | Verificar configuracao do sidecar | NAO VALIDADO |
| A-010 | ValidationPipe do NestJS valida algo sem class-validator decorators | Services main.ts | Enviar request invalido e verificar | NAO VALIDADO |
| A-011 | Container Next.js no pod tem acesso de escrita ao /tmp/ | Dockerfile + SecurityContext | Verificar readOnlyRootFilesystem config | NAO VALIDADO |
| A-012 | Single-replica services sao aceitaveis para um hospital | Nenhum PDB definido para services | Calcular disponibilidade necessaria | NAO VALIDADO |
| A-013 | NATS JetStream vai funcionar cross-cluster quando implementado | architecture.md | PoC de NATS cross-cluster | NAO VALIDADO |
| A-014 | Medplum vai ser compativel com o modelo de dados atual | Nenhum modelo de dados real existe | PoC de Medplum com modelo de encounter | NAO VALIDADO |
| A-015 | 28 roles sao suficientes para todos os hospitais brasileiros | access-control.ts | Validar com hospitais reais | NAO VALIDADO |

---

### 11. Backlog de Correcoes Obrigatorias

Prioridade: P0 (blocker, fazer agora) > P1 (critico) > P2 (alto) > P3 (medio)

| Prioridade | Correcao | Justificativa |
|-----------|---------|---------------|
| P0-001 | Criar PersistentVolumeClaim para `/tmp/velya-audit` e `/tmp/velya-events` | Dados regulatorios perdidos a cada restart |
| P0-002 | Implementar autenticacao real (Keycloak ou similar) | Sem autenticacao, tudo e acessivel |
| P0-003 | Implementar middleware de autorizacao nos backend services | RBAC so no frontend e igual a nao ter RBAC |
| P0-004 | Corrigir fallback de `resolveUiRole()` de `admin_system` para role com zero permissoes | Role invalido ganha acesso total |
| P0-005 | Adicionar validacao de identidade no break-glass endpoint | Qualquer pessoa pode ativar acesso de emergencia |
| P1-001 | Implementar conexao com PostgreSQL nos services | Dados nao sao persistidos |
| P1-002 | Implementar logica de negocio no discharge-orchestrator | Controller existe, logica nao |
| P1-003 | Implementar logica de negocio no patient-flow | Controller existe, logica nao |
| P1-004 | Implementar logica de negocio no task-inbox | Controller existe, logica nao |
| P1-005 | Criar Dockerfiles para todos os backend services | Sem Dockerfile, sem deploy |
| P1-006 | Implementar testes unitarios para access-control.ts | 28 roles sem nenhum teste |
| P1-007 | Implementar testes unitarios para audit-logger.ts | Hash chain sem teste de integridade |
| P1-008 | Substituir implementacao custom de observability por @opentelemetry/sdk-* | Metricas nunca exportadas |
| P2-001 | Conectar services ao NATS | Event-driven architecture so no papel |
| P2-002 | Deploy e integracao do Temporal | Workflows duraveis inexistentes |
| P2-003 | Integrar frontend com APIs reais (remover mock data) | Frontend mostra dados falsos |
| P2-004 | Implementar rate limiting em todos os endpoints | Sem protecao contra abuso |
| P2-005 | Implementar Medplum/FHIR para dados clinicos | Sem padrao clinico |
| P3-001 | Criar Helm charts para services | Sem charts, sem GitOps real |
| P3-002 | Implementar agent lifecycle e criar primeiro agente | Orquestrador sem agentes |
| P3-003 | Implementar integracoes externas (LIS, RIS, TISS) | Sem interoperabilidade |

---

### 12. Plano de Priorizacao

#### Fase 0: Parar a Hemorragia (Semana 1-2)

**Objetivo**: Eliminar vulnerabilidades criticas que tornariam qualquer deploy catastrofico.

1. **PersistentVolumeClaims** para audit e event store -- 2 YAMLs, 1 hora
2. **Corrigir `resolveUiRole()` fallback** -- mudar `admin_system` para role sem permissoes -- 5 minutos
3. **Adicionar validacao de sessao no break-glass** -- mesmo que basica com token -- 1 dia
4. **Mover audit/event de /tmp/ para path com PV** -- ja suportado via env var -- 1 hora
5. **Escrever testes para access-control.ts e audit-logger.ts** -- 2 dias

#### Fase 1: Autenticacao e Persistencia (Semana 3-6)

**Objetivo**: Ter identidade real e dados persistentes.

1. **Deploy Keycloak ou Cognito** como identity provider
2. **JWT middleware** em todos os services NestJS
3. **Conexao PostgreSQL** com entidades TypeORM ou Drizzle
4. **Migrations** para tabelas de encounter, blocker, task, audit
5. **Implementar discharge-orchestrator** como primeiro service real
6. **Dockerfiles** para todos os services

#### Fase 2: Integracao e Observabilidade (Semana 7-12)

**Objetivo**: Services se comunicam e sao observaveis.

1. **NATS JetStream** deployment e integracao com services
2. **OpenTelemetry SDK real** substituindo custom implementations
3. **Grafana dashboards** corrigidos para metricas reais
4. **Frontend conectado a APIs reais** -- remover mock data
5. **Rate limiting e CORS** em todos os endpoints

#### Fase 3: Clinical Grade (Semana 13-24)

**Objetivo**: Plataforma minimamente viavel para uso clinico.

1. **Medplum/FHIR** para modelo de dados clinico
2. **Temporal workflows** para discharge planning e admission
3. **Integracoes externas** (LIS, RIS, TISS)
4. **AI Gateway** integrado com primeiro caso de uso real
5. **Primeiro agente** em shadow mode
6. **LGPD compliance** (consentimento, portabilidade, exclusao)
7. **Pen-test** e correcao de vulnerabilidades
8. **Testes e2e** com Playwright para jornadas criticas

#### Fase 4: Production Readiness (Semana 25+)

1. **OpenTofu modules** para infra AWS real
2. **ArgoCD Applications** individuais por service
3. **Helm charts** com values por ambiente
4. **DR plan** testado
5. **Compliance audit** com evidencias
6. **Treinamento** de profissionais

---

### Nota Final

Este relatorio nao e pessimista -- e factual. O projeto tem uma base arquitetural sofisticada e um frontend funcional. O gap esta na **implementacao de backend**. Os 249 documentos e as regras em `.claude/rules/` demonstram um pensamento arquitetural maduro. Mas documentacao sem implementacao e um risco: cria a ilusao de completude enquanto o sistema real nao faz quase nada.

A prioridade absoluta e transformar os scaffolds em services funcionais com autenticacao, persistencia e testes. Sem isso, o restante da infraestrutura (NATS, Temporal, Grafana, ArgoCD, AI Gateway, Agent Orchestrator) sao camadas de complexidade protegendo o vazio.
