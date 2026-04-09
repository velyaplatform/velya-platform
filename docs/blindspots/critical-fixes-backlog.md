# Velya Critical Fixes Backlog

## Data: 2026-04-09
## Classificacao: MANDATORIO antes de qualquer uso em ambiente hospitalar

---

## Formato

Cada item segue o formato:
- **ID**: Identificador unico
- **Titulo**: Descricao curta
- **Descricao**: O que precisa ser feito e por que
- **Severidade**: CRITICO / ALTO / MEDIO / BAIXO
- **Esforco**: S (1-2 dias) / M (3-5 dias) / L (1-2 semanas) / XL (3-4 semanas)
- **Dependencias**: O que precisa existir antes
- **Owner Sugerido**: Perfil tecnico necessario
- **Evidencia**: Arquivo e linha que comprovam o gap

---

## P0 -- FAZER IMEDIATAMENTE (bloqueadores de seguranca)

### FIX-001: PersistentVolumeClaim para audit e event store

**Descricao**: Criar PVCs para os paths `/tmp/velya-audit` e `/tmp/velya-events`. Sem PV, toda a trilha de auditoria e eventos (incluindo sessoes break-glass) sao perdidos em cada restart de pod. Em ambiente hospitalar, isso viola LGPD Art. 37 (registro de atividades de tratamento) e resolucoes CFM sobre rastreabilidade de prontuario.

**Severidade**: CRITICO
**Esforco**: S (1-2 horas para criar YAMLs + atualizar env vars)
**Dependencias**: Nenhuma
**Owner Sugerido**: DevOps/SRE
**Evidencia**:
- `apps/web/src/lib/audit-logger.ts` linha 5: `const AUDIT_DIR = process.env.VELYA_AUDIT_PATH || '/tmp/velya-audit'`
- `apps/web/src/lib/event-store.ts` linha 4: `const STORE_DIR = process.env.VELYA_EVENT_STORE_PATH || '/tmp/velya-events'`

**Tarefas**:
1. Criar `infra/kubernetes/bootstrap/velya-data-pvcs.yaml` com PVCs de 10Gi
2. Atualizar deployment da web app para montar volumes nos paths corretos
3. Definir env vars `VELYA_AUDIT_PATH` e `VELYA_EVENT_STORE_PATH` apontando para o volume montado
4. Configurar backup diario dos volumes

---

### FIX-002: Corrigir fallback de resolveUiRole()

**Descricao**: Quando um role desconhecido e passado para `resolveUiRole()`, a funcao retorna `admin_system` (linha 711), que tem accessLevel 7, acesso a todas as dataClasses (A-E), e break-glass eligibility. Isso e o oposto do principio de menor privilegio. Um atacante que envie qualquer string como role ganha acesso total.

**Severidade**: CRITICO
**Esforco**: S (5 minutos de codigo + teste)
**Dependencias**: Nenhuma
**Owner Sugerido**: Backend developer
**Evidencia**:
- `apps/web/src/lib/access-control.ts` linha 711: `return UI_ROLE_MAP[uiRole] ?? 'admin_system'`

**Tarefas**:
1. Criar um role `unknown_denied` com accessLevel 0, zero allowedActions, zero allowedDataClasses
2. Ou alterar o fallback para lancar erro/retornar null
3. Adicionar teste unitario que verifica que role desconhecido nao ganha acesso
4. Verificar todos os callers de `resolveUiRole()` para tratar o caso de fallback

---

### FIX-003: Implementar autenticacao real

**Descricao**: Nao existe nenhum mecanismo de autenticacao. O "login" e um dropdown de roles no frontend. Qualquer pessoa que acesse a URL tem acesso total. Para uma plataforma hospitalar com dados de pacientes, isso e inaceitavel em qualquer nivel.

**Severidade**: CRITICO
**Esforco**: XL (3-4 semanas incluindo integracao com todos os services)
**Dependencias**: Nenhuma (pode ser iniciado imediatamente)
**Owner Sugerido**: Security engineer + Backend developer
**Evidencia**:
- Nao existe nenhum arquivo de autenticacao em `apps/web/src/lib/`
- Nao existe middleware de auth em nenhum service
- `apps/web/src/app/layout.tsx` usa dropdown para selecao de role

**Tarefas**:
1. Escolher e deployar identity provider (Keycloak, Cognito, ou Auth0)
2. Configurar OIDC/OAuth2 com o frontend Next.js (next-auth ou similar)
3. Implementar middleware JWT em todos os NestJS services
4. Mapear claims do JWT para ProfessionalRole do RBAC
5. Remover dropdown de role e substituir por login real
6. Implementar logout e session management
7. Configurar MFA para roles com accessLevel >= 5
8. Testes de integracao para fluxo de auth

---

### FIX-004: Adicionar validacao de identidade no break-glass

**Descricao**: O endpoint `POST /api/break-glass` aceita `role` no body da requisicao sem verificar quem esta fazendo a chamada. Qualquer pessoa pode enviar `{ "role": "clinical_director", "patientId": "any", "justification": "emergencia real" }` e ativar acesso de emergencia.

**Severidade**: CRITICO
**Esforco**: M (depende de FIX-003 para autenticacao completa, mas pode ter mitigacao parcial)
**Dependencias**: FIX-003 (para solucao completa)
**Owner Sugerido**: Backend developer
**Evidencia**:
- `apps/web/src/app/api/break-glass/route.ts` linhas 45-69: aceita role do body sem auth

**Tarefas (mitigacao imediata)**:
1. Adicionar API key basica para o endpoint (nao ideal, mas melhor que nada)
2. Limitar break-glass a IPs internos da rede hospitalar
3. Rate limit de 3 ativacoes por hora por IP
4. Notificacao por email/SMS quando break-glass e ativado

**Tarefas (solucao completa, apos FIX-003)**:
1. Extrair role do JWT, nao do body
2. Verificar que o usuario autenticado realmente tem o role declarado
3. Registrar identidade real (nao auto-declarada) no audit log

---

### FIX-005: Backend authorization middleware

**Descricao**: O RBAC definido em `access-control.ts` so e verificado no frontend (browser). Nenhum backend service valida permissoes. Um `curl` direto para qualquer endpoint bypassa todo o controle de acesso.

**Severidade**: CRITICO
**Esforco**: L (1-2 semanas)
**Dependencias**: FIX-003 (precisa de identidade para autorizar)
**Owner Sugerido**: Backend developer
**Evidencia**:
- Zero imports de `access-control` em qualquer arquivo dentro de `services/`
- Zero guards ou interceptors de autorizacao em NestJS modules

**Tarefas**:
1. Criar `packages/authorization/` com guard NestJS reutilizavel
2. O guard extrai role do JWT, usa `isAllowed()` para verificar permissao
3. Decorator `@RequiresAction('view_clinical_summary')` em cada endpoint
4. Decorator `@RequiresDataClass('C')` para endpoints que acessam dados clinicos
5. Implementar em todos os services
6. Testes unitarios para cada combinacao de role x action

---

## P1 -- CRITICO (fazer nas proximas 2-4 semanas)

### FIX-006: Conexao com PostgreSQL nos services

**Descricao**: PostgreSQL esta deployado no cluster mas nenhum service se conecta a ele. Todos os dados sao perdidos (in-memory ou /tmp/). Sem banco, a plataforma nao pode operar.

**Severidade**: CRITICO
**Esforco**: XL (3-4 semanas para todos os services)
**Dependencias**: Nenhuma
**Owner Sugerido**: Backend developer
**Evidencia**:
- Zero imports de qualquer ORM ou DB driver em `services/`
- `temporal-values.yaml` referencia `postgresql.velya-dev-platform.svc.cluster.local` confirmando que DB existe

**Tarefas**:
1. Escolher ORM (Drizzle recomendado para TypeScript strict)
2. Configurar conexao via External Secrets Operator (credenciais)
3. Criar schemas/migrations para: encounters, blockers, tasks, audit_entries
4. Implementar repositories para cada service
5. Injetar repositories nos controllers via NestJS DI
6. Testes de integracao com TestContainers

---

### FIX-007: Implementar logica de negocio no discharge-orchestrator

**Descricao**: O service mais critico para a operacao hospitalar (gestao de altas) retorna "Not implemented" em todos os endpoints. Discharge blockers nao podem ser criados, atualizados ou consultados.

**Severidade**: CRITICO
**Esforco**: L (1-2 semanas)
**Dependencias**: FIX-006 (PostgreSQL)
**Owner Sugerido**: Backend developer + domain expert
**Evidencia**:
- `services/discharge-orchestrator/src/api/discharge.controller.ts`: todos os metodos com TODO

**Tarefas**:
1. Criar `blocker.repository.ts` com CRUD no PostgreSQL
2. Criar `blocker.service.ts` com logica de negocio (validacao de transicoes, SLA, escalacao)
3. Implementar `createBlocker` com validacao e emissao de evento
4. Implementar `updateBlockerStatus` com maquina de estados
5. Implementar `getBlockerSummary` com agregacao real
6. Implementar `reassignBlocker` com notificacao
7. Testes unitarios para cada transicao de estado

---

### FIX-008: Implementar logica de negocio no patient-flow

**Descricao**: Gestao de internacoes e censo hospitalar retorna zeros em todos os endpoints.

**Severidade**: CRITICO
**Esforco**: L (1-2 semanas)
**Dependencias**: FIX-006 (PostgreSQL)
**Owner Sugerido**: Backend developer + domain expert
**Evidencia**:
- `services/patient-flow/src/api/patient-flow.controller.ts`: todos os metodos com TODO

**Tarefas**:
1. Criar `encounter.repository.ts` com CRUD
2. Criar `bed-management.repository.ts` com census
3. Implementar `listEncounters` com filtros reais
4. Implementar `getCensus` com dados reais de ocupacao
5. Implementar `getCommandCenter` com metricas agregadas reais
6. Testes unitarios e de integracao

---

### FIX-009: Implementar logica de negocio no task-inbox

**Descricao**: Task inbox e o sistema de trabalho da equipe. Nenhuma task pode ser criada ou gerenciada.

**Severidade**: CRITICO
**Esforco**: L (1-2 semanas)
**Dependencias**: FIX-006 (PostgreSQL)
**Owner Sugerido**: Backend developer
**Evidencia**:
- `services/task-inbox/src/api/task.controller.ts`: 8 endpoints, todos retornam stubs

**Tarefas**:
1. Criar `task.repository.ts` com CRUD
2. Criar `task.service.ts` com logica de atribuicao, escalacao, SLA
3. Implementar `createTask`, `updateTask`, `assignTask`
4. Implementar `bulkOperation` com processamento parcial
5. Implementar `getInboxSummary` com agregacao real
6. Testes unitarios para state machine de tasks

---

### FIX-010: Criar Dockerfiles para backend services

**Descricao**: Apenas `apps/web` e `apps/api-gateway` tem Dockerfile. Os 4 services em `services/` e os 5 em `platform/` nao podem ser containerizados.

**Severidade**: ALTO
**Esforco**: M (3-5 dias para todos os services)
**Dependencias**: Nenhuma
**Owner Sugerido**: DevOps/SRE
**Evidencia**:
- `find . -name Dockerfile` retorna apenas 3 resultados (web, api-gateway, .ministack)

**Tarefas**:
1. Criar Dockerfile multi-stage para cada service (base node:22-slim)
2. Usar distroless ou slim image para runtime
3. Configurar non-root user
4. Configurar health check
5. .dockerignore para excluir node_modules, tests, docs
6. Build e push para registry

---

### FIX-011: Escrever testes unitarios para camada de seguranca

**Descricao**: access-control.ts (713 linhas), audit-logger.ts (272 linhas), e event-store.ts (100 linhas) sao as unicas camadas de seguranca do sistema e nao tem nenhum teste.

**Severidade**: CRITICO
**Esforco**: M (3-5 dias)
**Dependencias**: Nenhuma
**Owner Sugerido**: Backend developer
**Evidencia**:
- `tests/unit/platform.test.ts`: unico teste com 2 assertions triviais

**Tarefas**:
1. `access-control.test.ts`: testar isAllowed para cada role x action, break-glass, data classes, nav sections, resolveUiRole
2. `audit-logger.test.ts`: testar hash chain, integridade, queryAudit com filtros, verifyIntegrity
3. `event-store.test.ts`: testar appendEvent, getEvents com filtros, ackEvent, MAX_EVENTS_PER_FILE
4. Alvo: >90% coverage para estes 3 arquivos

---

### FIX-012: Substituir observability custom por OpenTelemetry SDK

**Descricao**: `packages/observability/` implementa Counter, Histogram, Gauge e Tracer from scratch. Estas implementacoes armazenam dados in-memory e nunca exportam para Prometheus ou OTLP. O `flush()` do Tracer retorna spans mas nao os envia a lugar nenhum.

**Severidade**: ALTO
**Esforco**: L (1-2 semanas)
**Dependencias**: Nenhuma
**Owner Sugerido**: Backend developer + SRE
**Evidencia**:
- `packages/observability/src/tracer.ts` linha 279: `// In a real implementation, this would send to the OTel collector`
- `packages/observability/src/metrics.ts`: Counter/Histogram/Gauge sao Map<string, number> in-memory
- Zero imports de `@opentelemetry/*` em todo o codebase

**Tarefas**:
1. Adicionar dependencias: `@opentelemetry/sdk-node`, `@opentelemetry/exporter-otlp-*`, `@opentelemetry/instrumentation-*`
2. Substituir Counter/Histogram/Gauge custom pelos equivalentes OTel
3. Substituir Tracer custom por OTel TracerProvider
4. Configurar NodeSDK com auto-instrumentation (HTTP, NestJS)
5. Manter interfaces existentes como wrappers se necessario
6. Verificar que metricas aparecem no Prometheus e traces no Tempo

---

## P2 -- ALTO (fazer nas proximas 4-8 semanas)

### FIX-013: Integrar NATS JetStream

**Descricao**: A arquitetura documenta NATS como backbone de eventos. Zero linhas de codigo interagem com NATS.

**Severidade**: ALTO
**Esforco**: XL (3-4 semanas)
**Dependencias**: FIX-006 (services precisam de logica primeiro)
**Owner Sugerido**: Backend developer
**Evidencia**:
- Zero imports de `nats` ou `@nats-io/*` em qualquer service
- `packages/event-contracts/` define eventos que nunca sao publicados

**Tarefas**:
1. Adicionar NATS client a cada service
2. Publicar eventos em operacoes de escrita (create, update, delete)
3. Criar consumers para workflows inter-service
4. Usar subjects do `event-contracts` package
5. Implementar dead-letter queue para falhas
6. Testes de integracao com NATS embedded

---

### FIX-014: Deploy e integracao do Temporal

**Descricao**: Temporal values file existe mas nao e deployado. Nenhum workflow duravel existe.

**Severidade**: ALTO
**Esforco**: XL (3-4 semanas)
**Dependencias**: FIX-006, FIX-013
**Owner Sugerido**: Backend developer + DevOps
**Evidencia**:
- `infra/kubernetes/bootstrap/temporal-values.yaml` existe mas nao e referenciado por ArgoCD
- Zero imports de `@temporalio/*`

**Tarefas**:
1. Criar ArgoCD Application para Temporal
2. Deploy Temporal com PostgreSQL existente
3. Criar primeiro workflow: DischargeWorkflow
4. Implementar activities para cada etapa do discharge
5. Worker processes nos services
6. Testes de workflow com replay

---

### FIX-015: Conectar frontend a APIs reais

**Descricao**: Todas as paginas exibem dados hardcoded. O frontend nao faz fetch real para nenhum service backend.

**Severidade**: ALTO
**Esforco**: L (1-2 semanas)
**Dependencias**: FIX-007, FIX-008, FIX-009 (services precisam funcionar)
**Owner Sugerido**: Frontend developer
**Evidencia**:
- Dados mock hardcoded em componentes React

**Tarefas**:
1. Criar hooks/services de fetch para cada API
2. Implementar loading states e error handling
3. Remover dados mock dos componentes
4. SWR ou React Query para caching
5. Testes de componente com MSW para mock de API

---

### FIX-016: Rate limiting em todos os endpoints

**Descricao**: Nenhum endpoint tem rate limiting. O break-glass pode ser chamado infinitamente.

**Severidade**: ALTO
**Esforco**: M (3-5 dias)
**Dependencias**: Nenhuma
**Owner Sugerido**: Backend developer
**Evidencia**:
- Zero configuracao de rate limiting em qualquer service ou API route

**Tarefas**:
1. Rate limiting no Next.js API routes (middleware)
2. Rate limiting nos NestJS services (throttler module)
3. Limites especificos para break-glass (3/hora por IP)
4. Limites gerais (100 req/min por IP)
5. Headers de rate limit na resposta (X-RateLimit-*)

---

### FIX-017: CORS e security headers

**Descricao**: Sem CORS configurado. Sem security headers (CSP, HSTS, X-Frame-Options).

**Severidade**: ALTO
**Esforco**: S (1-2 dias)
**Dependencias**: Nenhuma
**Owner Sugerido**: Backend developer
**Evidencia**:
- Zero configuracao de CORS em NestJS ou Next.js

**Tarefas**:
1. Configurar CORS no Next.js (next.config.js ou middleware)
2. Configurar CORS no NestJS (app.enableCors com whitelist)
3. Adicionar security headers: CSP, HSTS, X-Content-Type-Options, X-Frame-Options
4. Helmet middleware em NestJS

---

### FIX-018: Health checks reais

**Descricao**: Endpoints de health nao verificam dependencias. Um service pode reportar "healthy" enquanto nao tem conexao com DB ou NATS.

**Severidade**: MEDIO
**Esforco**: M (3-5 dias)
**Dependencias**: FIX-006 (DB), FIX-013 (NATS)
**Owner Sugerido**: Backend developer
**Evidencia**:
- `/api/health` retorna `{ status: 'ok' }` sem verificar nada

**Tarefas**:
1. Terminus module no NestJS para health checks
2. Verificar PostgreSQL connectivity
3. Verificar NATS connectivity (quando implementado)
4. Verificar disk space para audit/event store
5. Readiness vs Liveness probes diferenciados no Kubernetes

---

## P3 -- MEDIO (fazer nas proximas 8-16 semanas)

### FIX-019: Medplum/FHIR para dados clinicos

**Descricao**: Documentacao declara "FHIR-first clinical data model via Medplum" mas zero implementacao existe.

**Severidade**: ALTO
**Esforco**: XL (4+ semanas)
**Dependencias**: FIX-006, FIX-003
**Owner Sugerido**: Clinical informatics engineer
**Evidencia**:
- Zero imports de Medplum ou FHIR em todo o codebase

**Tarefas**:
1. Deploy Medplum server
2. Definir FHIR profiles para Patient, Encounter, Condition, Medication
3. Criar ACL (Anti-Corruption Layer) entre services e Medplum
4. Migrar modelo de dados de Encounter do patient-flow para FHIR
5. Implementar FHIR Subscriptions para eventos clinicos

---

### FIX-020: Criar Helm charts

**Descricao**: Sem Helm charts, o deploy de services e manual ou nao existe.

**Severidade**: ALTO
**Esforco**: L (1-2 semanas)
**Dependencias**: FIX-010 (Dockerfiles)
**Owner Sugerido**: DevOps/SRE
**Evidencia**:
- `infra/helm/charts/` nao existe

**Tarefas**:
1. Template de chart base para services NestJS
2. Chart para cada service com values-{dev,staging,prod}.yaml
3. Ingress, service, deployment, configmap, secrets
4. Resource requests/limits conforme rules
5. PDB para services criticos
6. ArgoCD Applications referenciando os charts

---

### FIX-021: OpenTofu modules para infra AWS

**Descricao**: Documentacao exige OpenTofu para toda infra. Nenhum modulo existe.

**Severidade**: ALTO
**Esforco**: XL (4+ semanas)
**Dependencias**: Nenhuma
**Owner Sugerido**: Infrastructure engineer
**Evidencia**:
- `infra/tofu/` nao existe

**Tarefas**:
1. Estrutura de modulos: `infra/tofu/modules/` e `infra/tofu/envs/`
2. Modulos: VPC, EKS, RDS, ECR, S3 (state), Route53, ACM
3. State em S3 com DynamoDB locking
4. CI pipeline com `tofu plan` em PRs
5. Tagging conforme rules

---

### FIX-022: LGPD compliance

**Descricao**: Nenhum mecanismo de compliance com LGPD implementado.

**Severidade**: CRITICO (regulatorio)
**Esforco**: XL (4+ semanas)
**Dependencias**: FIX-003, FIX-006
**Owner Sugerido**: Privacy engineer + DPO
**Evidencia**:
- Nenhum modulo de consentimento, portabilidade ou exclusao

**Tarefas**:
1. Modulo de consentimento (coleta, revogacao, registro)
2. Endpoint de portabilidade de dados do titular
3. Endpoint de exclusao (com restricoes para dados clinicos obrigatorios)
4. DPIA (Data Protection Impact Assessment) documentado
5. Registro de atividades de tratamento (ROPA)
6. Processo de resposta a incidentes de vazamento

---

### FIX-023: Implementar primeiro agente AI real

**Descricao**: 14+ paginas de governanca de agentes para zero agentes. O agent-orchestrator, policy-engine, decision-log e memory-service existem mas nao tem agentes para operar.

**Severidade**: MEDIO
**Esforco**: XL (3-4 semanas)
**Dependencias**: FIX-012 (AI Gateway funcional)
**Owner Sugerido**: AI engineer
**Evidencia**:
- `agents/` directory does not exist
- Agent orchestrator has no agents to orchestrate

**Tarefas**:
1. Criar diretorio `agents/` com template
2. Escolher primeiro caso de uso: discharge-planning-agent (sugere resolucao de blockers)
3. Definir charter, scope, permissions, KPIs
4. Implementar em shadow mode
5. Conectar ao AI gateway
6. Registrar no agent orchestrator
7. Executar por 4 semanas em shadow antes de ativar

---

### FIX-024: Testes e2e com Playwright

**Descricao**: Zero testes e2e. Nenhuma jornada critica e validada end-to-end.

**Severidade**: ALTO
**Esforco**: L (1-2 semanas)
**Dependencias**: FIX-003, FIX-015 (frontend com dados reais)
**Owner Sugerido**: QA engineer
**Evidencia**:
- Nenhum arquivo Playwright ou Cypress

**Tarefas**:
1. Setup Playwright com Next.js
2. Teste e2e: login -> dashboard -> ver pacientes
3. Teste e2e: criar blocker de alta -> resolver -> confirmar resolucao
4. Teste e2e: break-glass -> verificar audit log
5. Teste e2e: criar task -> atribuir -> completar
6. CI pipeline para rodar e2e nightly

---

### FIX-025: Backup e disaster recovery

**Descricao**: Nenhuma estrategia de backup ou DR implementada.

**Severidade**: CRITICO
**Esforco**: L (1-2 semanas)
**Dependencias**: FIX-006 (DB com dados)
**Owner Sugerido**: SRE
**Evidencia**:
- Nenhuma configuracao de backup

**Tarefas**:
1. Backup automatizado de PostgreSQL (pg_dump ou WAL archiving)
2. Backup de PVCs (audit/event store)
3. S3 bucket para armazenamento de backups
4. Teste de restore documentado e agendado mensalmente
5. Definir RPO (Recovery Point Objective) e RTO (Recovery Time Objective)
6. Runbook de disaster recovery testado

---

## P4 -- BAIXO (proximos 3-6 meses)

### FIX-026: Integracoes externas (LIS, RIS, TISS)

**Severidade**: ALTO
**Esforco**: XL por integracao
**Dependencias**: FIX-019 (Medplum/FHIR)
**Owner Sugerido**: Integration engineer

---

### FIX-027: i18n e acessibilidade

**Severidade**: MEDIO
**Esforco**: L
**Dependencias**: Nenhuma
**Owner Sugerido**: Frontend developer

---

### FIX-028: Modo offline e contingencia

**Severidade**: ALTO
**Esforco**: XL
**Dependencias**: FIX-015
**Owner Sugerido**: Frontend developer + SRE

---

### FIX-029: mTLS entre services

**Severidade**: ALTO
**Esforco**: L
**Dependencias**: Service mesh ou manual cert management
**Owner Sugerido**: Security engineer

---

### FIX-030: Pen-test e remediacao

**Severidade**: ALTO
**Esforco**: XL
**Dependencias**: FIX-003, FIX-005, FIX-016, FIX-017
**Owner Sugerido**: Security team externo

---

## Matriz de Dependencias

```
FIX-001 (PVCs)               --> independente, fazer primeiro
FIX-002 (resolveUiRole)      --> independente, fazer primeiro
FIX-003 (autenticacao)        --> independente, iniciar imediatamente
FIX-004 (break-glass auth)    --> depende de FIX-003
FIX-005 (backend authz)       --> depende de FIX-003
FIX-006 (PostgreSQL)          --> independente, iniciar em paralelo com FIX-003
FIX-007 (discharge logic)     --> depende de FIX-006
FIX-008 (patient-flow logic)  --> depende de FIX-006
FIX-009 (task-inbox logic)    --> depende de FIX-006
FIX-010 (Dockerfiles)         --> independente
FIX-011 (testes seguranca)    --> independente, fazer em paralelo
FIX-012 (OpenTelemetry)       --> independente
FIX-013 (NATS)                --> depende de FIX-006 + FIX-007/08/09
FIX-014 (Temporal)            --> depende de FIX-006 + FIX-013
FIX-015 (frontend real)       --> depende de FIX-007/08/09
```

## Caminho Critico

```
Semana 1-2:   FIX-001 + FIX-002 + FIX-010 + FIX-011 (paralelo)
Semana 1-4:   FIX-003 (iniciar, continuara por mais tempo)
Semana 2-6:   FIX-006 (PostgreSQL)
Semana 4-8:   FIX-007 + FIX-008 + FIX-009 (paralelo, apos DB)
Semana 6-8:   FIX-003 finalizado -> FIX-004 + FIX-005
Semana 6-10:  FIX-012 + FIX-016 + FIX-017 (paralelo)
Semana 8-12:  FIX-015 (frontend real, apos services)
Semana 10-14: FIX-013 (NATS)
Semana 12-16: FIX-014 (Temporal)
```

**MVP funcional estimado**: Semana 12-16 (3-4 meses com 2-3 engenheiros dedicados).

---

## Metricas de Acompanhamento

| Metrica | Valor Atual | Meta MVP | Meta Production |
|---------|------------|----------|-----------------|
| Services com logica real | 0/9 | 4/9 | 9/9 |
| Endpoints retornando dados reais | 0/18+ | 12/18 | 18/18 |
| Test coverage (logica de negocio) | 0% | 50% | 80% |
| Autenticacao implementada | Nao | Sim | Sim + MFA |
| Autorizacao no backend | Nao | Sim | Sim + ABAC |
| Dados persistidos em DB | Nao | Sim | Sim + backup |
| NATS conectado | Nao | Nao | Sim |
| Temporal deployado | Nao | Nao | Sim |
| FHIR/Medplum | Nao | Nao | Sim |
| Audit trail persistente | Nao (tmp) | Sim (PV) | Sim (PV + backup) |
| LGPD compliance | Nao | Parcial | Completo |
