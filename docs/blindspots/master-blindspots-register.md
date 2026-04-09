# Registro Mestre de Pontos Cegos — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Arquitetura e Governança  
> **Propósito**: Registro consolidado de todos os pontos cegos conhecidos da plataforma Velya. Um ponto cego é qualquer condição onde o sistema (ou seus operadores) não tem visibilidade adequada, não tem controle, ou faz uma suposição implícita que pode ser falsa e causar dano.

---

## Convenções

| Campo | Valores possíveis |
|---|---|
| **Severidade** | Baixa / Média / Alta / Crítica / Catastrófica |
| **Explorabilidade** | Baixa / Média / Alta / Imediata |
| **Raio de Explosão** | Componente / Serviço / Namespace / Cluster / Plataforma / Clínico |
| **Status** | Aberto / Em Remediação / Mitigado / Aceito |

---

## Categoria 1 — Arquitetura

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| ARCH-001 | **Ausência de circuit breakers inter-serviço**: patient-flow-service e discharge-orchestrator chamam services downstream sem circuit breaker. Uma falha em cascata pode derrubar o fluxo inteiro sem isolamento. | Crítica | Alta | Plataforma | Arquitetura | Aberto | Implementar circuit breaker com NestJS + `@nestjs/axios` + axios-circuit-breaker ou Resilience4j. Definir thresholds por rota. |
| ARCH-002 | **Sem contrato formal de API entre serviços**: Os serviços não publicam contratos OpenAPI validados. Mudanças de schema quebram consumidores silenciosamente sem detecção até runtime. | Alta | Alta | Serviço | Arquitetura | Aberto | Publicar OpenAPI spec por serviço. Usar contract testing (Pact ou Prism). Adicionar validation gate no CI. |
| ARCH-003 | **Acoplamento temporal via NATS sem dead-letter queue**: Eventos publicados no NATS que não são consumidos ficam na stream até atingir `max_bytes`. Não há DLQ configurada — mensagens inválidas causam redelivery storm. | Alta | Média | Serviço | Backend | Aberto | Configurar dead-letter stream por subject. Implementar exponential backoff no consumer com limite de tentativas. |
| ARCH-004 | **Boundary de domínio não enforçado**: Serviços como api-gateway e ai-gateway têm acesso à rede completa do cluster. Não existe enforcement de que patient-flow-service só fale com seus dependentes diretos. | Alta | Média | Cluster | Arquitetura | Aberto | Migrar para CNI que enforça NetworkPolicy (Calico ou Cilium). Definir policies por namespace. Validar no CI com kube-linter. |
| ARCH-005 | **Sem fallback degradado para AI Gateway**: Quando o AI Gateway está indisponível ou o provider Anthropic tem outage, nenhum serviço tem caminho de fallback — toda funcionalidade AI para. | Crítica | Alta | Plataforma | Arquitetura | Aberto | Implementar fallback para modelo local ou cache de resposta. Definir modo degradado para cada feature AI. |
| ARCH-006 | **Temporal Workers sem configuração de concorrência**: Os workers do Temporal não têm limites de concorrência definidos. Um pico de workflows pode starvar outros serviços de CPU. | Média | Média | Serviço | Backend | Aberto | Configurar `maxConcurrentActivityTaskExecutions` e `maxConcurrentWorkflowTaskExecutions` por worker. |
| ARCH-007 | **Medplum/FHIR sem validação de schema no ingress**: Eventos FHIR que chegam pelo NATS não são validados contra o schema FHIR antes de serem processados. Dados malformados chegam aos serviços. | Alta | Média | Serviço | Backend | Aberto | Adicionar FHIR schema validator no consumer NATS antes de processar. Rejeitar para DLQ se inválido. |
| ARCH-008 | **Sem estratégia de versioning de eventos NATS**: Subjects NATS como `velya.patient.updated` não têm versão. Mudanças de schema quebram todos os consumidores simultaneamente. | Alta | Alta | Plataforma | Arquitetura | Aberto | Adotar versioning de subject (v1.velya.patient.updated). Implementar envelope com schema version. Manter backward compatibility por N versões. |

---

## Categoria 2 — Runtime e Infraestrutura

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| INFRA-001 | **kindnet NÃO enforça NetworkPolicy**: Todas as NetworkPolicies definidas nos namespaces são aceitas pela API do Kubernetes mas completamente ignoradas pelo CNI kindnet. Qualquer pod comprometido pode acessar qualquer outro pod no cluster. **Esta vulnerabilidade foi confirmada empiricamente.** | Catastrófica | Imediata | Cluster | Plataforma | Aberto | Migrar para Calico ou Cilium no ambiente local. Documentar como risco aceito temporário com data de resolução. Nunca usar dados reais de pacientes enquanto esta condição existir. |
| INFRA-002 | **nginx-ingress com hostNetwork=true requer annotation `nginx.ingress.kubernetes.io/service-upstream: "true"`**: Sem esta annotation, o ingress tenta acessar IPs de pods diretamente e falha silenciosamente com 504. **Descoberta confirmada em produção local.** | Alta | Imediata | Cluster | Plataforma | Mitigado (parcial) | Aplicar annotation em todos os Ingress resources. Adicionar ao template de Ingress padrão. Documentar em runbook de troubleshooting. |
| INFRA-003 | **Backup nunca executado nem testado**: Os dados em PostgreSQL e NATS JetStream nunca foram objeto de backup verificado. Não existe runbook de restore testado. O time assume proteção que não existe. | Catastrófica | N/A (risco de perda) | Plataforma | Operacional | Aberto | Implementar backup automatizado com Velero (cluster) + pg_dump (PostgreSQL). Executar restore test mensal. Documentar RTO/RPO real. |
| INFRA-004 | **Sem resource requests/limits nos workloads Velya**: A maioria dos pods de serviços Velya não tem `resources.requests` e `resources.limits` definidos. Um serviço com leak pode consumir todos os recursos do nó. | Alta | Alta | Nó | Backend | Aberto | Definir requests e limits para todos os containers. Usar LimitRange por namespace como safety net. Habilitar VPA para coleta de dados antes de ajuste manual. |
| INFRA-005 | **ArgoCD instalado mas sem nenhuma Application configurada**: O GitOps é pré-requisito da estratégia de deploy, mas o ArgoCD tem 0 Applications registradas. Todos os deploys são feitos manualmente — o cluster diverge do Git sem detecção. | Crítica | Alta | Plataforma | DevOps | Aberto | Criar Applications para cada serviço crítico. Configurar auto-sync com self-heal. Adicionar sync status ao dashboard de saúde. |
| INFRA-006 | **Nós do cluster kind sem anti-affinity rules**: Workloads críticos (patient-flow-service, discharge-orchestrator) podem acabar no mesmo nó. A falha de um nó derruba múltiplos serviços críticos simultaneamente. | Alta | Baixa | Nó | DevOps | Aberto | Definir PodAntiAffinity para serviços críticos. Usar `topologySpreadConstraints` para distribuição entre nós. |
| INFRA-007 | **Sem PodDisruptionBudget para serviços críticos**: Durante operações de manutenção ou eviction, todos os pods de um serviço podem ser derrubados simultaneamente. | Alta | Média | Serviço | DevOps | Aberto | Criar PDB com `minAvailable: 1` para todos os serviços com mais de 1 réplica. |
| INFRA-008 | **KEDA ScaledObjects sem maxReplicaCount explícito**: Sem limite superior definido, um metric spike pode escalar para centenas de pods, consumindo todos os recursos do cluster. | Crítica | Alta | Cluster | DevOps | Aberto | Definir `maxReplicaCount` conservador em todos os ScaledObjects. Adicionar alerta de escala acima de threshold. |
| INFRA-009 | **Secrets em plaintext em ConfigMaps ou variáveis de ambiente hardcoded**: Revisão inicial indica que alguns serviços têm credenciais em ConfigMaps ou Dockerfiles, não em Secrets corretamente gerenciados. | Crítica | Alta | Plataforma | Segurança | Aberto | Auditoria completa de todos os ConfigMaps e Dockerfiles. Migrar para External Secrets Operator + vault ou AWS Secrets Manager. |
| INFRA-010 | **Sem liveness/readiness probes adequados**: Serviços retornam 200 no health check mesmo quando internamente degradados (DB connection pool esgotado, NATS desconectado). | Alta | Alta | Serviço | Backend | Aberto | Implementar readiness probe que verifica dependências reais: DB ping, NATS connection, cache availability. |

---

## Categoria 3 — Governança de Agents

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| GOV-001 | **18 agents definidos, apenas 1 com nome correto**: A convenção `{office}-{role}-agent` é seguida apenas pelo `eng-platform-agent`. Os demais 17 agents têm nomes inconsistentes. Governança de identidade inoperante. | Alta | Alta | Plataforma | Governança | Aberto | Renomear todos os agents seguindo a convenção. Adicionar linter de nome de agent ao CI. |
| GOV-002 | **Shadow mode nunca executado**: A governança prevê que agents operem em shadow mode antes de serem promovidos a autonomia. Nenhum agent passou por shadow mode documentado. Risco de agent autônomo sem baseline de qualidade. | Alta | Alta | Plataforma | Governança | Aberto | Definir shadow mode como gate obrigatório de promoção. Criar framework de shadow execution com logging de decisões. |
| GOV-003 | **Validators podem aprovar por pressão de throughput**: Não há proteção técnica contra um validator aprovando tarefas sem leitura real da evidência. O sistema confia na boa-fé dos agents. | Crítica | Alta | Plataforma | Governança | Aberto | Implementar checklist obrigatório de validação. Medir taxa de aprovação por validator. Alerta se taxa > 95% por período. |
| GOV-004 | **Tasks criadas por agents sem dono humano**: Tarefas geradas automaticamente podem existir no backlog indefinidamente sem nenhum humano responsável por validá-las ou executá-las. | Alta | Média | Plataforma | Governança | Aberto | Exigir `human_owner` em tasks geradas por agents. Alerta para tasks órfãs com mais de 48h. |
| GOV-005 | **Sem limite de taxa de ações por agent**: Um agent pode criar centenas de PRs, tasks ou eventos NATS sem nenhum rate limiting. | Alta | Alta | Plataforma | Governança | Aberto | Implementar rate limiter por agent ID. Configurar kill switch por categoria de ação. |
| GOV-006 | **Aprendizado sem validação de qualidade**: O learning loop pode propagar padrões derivados de incidentes isolados ou decisões excepcionais como se fossem boas práticas. | Alta | Média | Plataforma | Governança | Aberto | Implementar revisão humana obrigatória antes de propagar aprendizado. Quarentena de novos padrões por N dias antes de adoção. |
| GOV-007 | **Offices sem charter executável**: Os offices estão definidos conceitualmente mas não têm charter com SLA, capacidade, escalação e métricas de saúde. | Média | Alta | Plataforma | Governança | Aberto | Criar charter template e preencher para cada office. Implementar health check de office. |
| GOV-008 | **Nenhum agent em runtime real**: Todos os agents são definições em `.claude/agents/`. Nenhum está executando workflows reais de forma autônoma. A governança de agents é teórica. | Alta | Alta | Plataforma | Governança | Aberto | Definir critérios para ativação de agents. Executar piloto controlado com 1-2 agents antes de escalar. |

---

## Categoria 4 — Frontend

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| FE-001 | **Sem autenticação no frontend**: Qualquer pessoa com acesso à URL `http://velya.172.19.0.6.nip.io` acessa dados de pacientes sem credenciais. | Catastrófica | Imediata | Plataforma | Segurança | Aberto | Implementar autenticação antes de qualquer uso com dados reais. Mínimo: NextAuth.js com provider OIDC. |
| FE-002 | **Score de qualidade frontend: 8/100**: O frontend atual não cumpre requisitos mínimos de produção — sem testes, sem acessibilidade validada, sem error boundaries, sem estado global robusto. | Alta | Alta | Serviço | Frontend | Aberto | Roadmap de qualidade com gates de CI. Mínimo 60/100 antes de uso clínico. |
| FE-003 | **Dados stale apresentados como atuais**: Não há indicador de "última atualização" ou invalidação automática de cache. Um cliníco pode ver dados de horas atrás acreditando serem em tempo real. | Alta | Alta | Clínico | Frontend | Aberto | Implementar cache invalidation com React Query staleTime. Mostrar timestamp de última atualização para dados críticos. |
| FE-004 | **Ações sem confirmação em operações irreversíveis**: A interface de alta permite ações em massa sem confirmação adicional. Um clique acidental pode desencadear processo de alta de múltiplos pacientes. | Crítica | Alta | Clínico | Frontend | Aberto | Adicionar confirmação explícita para ações irreversíveis. Implementar janela de desfazer (undo window) de 5-10 segundos. |
| FE-005 | **Semáforo visual sem suporte para daltonismo**: A página de discharge usa cores verde/amarelo/vermelho sem símbolo ou texto complementar. 8% da população masculina tem daltonismo. | Alta | Alta | Clínico | Frontend | Aberto | Adicionar ícones e labels de texto além das cores. Passar por teste de acessibilidade com simulador de daltonismo. |
| FE-006 | **Sem error boundaries**: Um erro de renderização em um componente pode derrubar toda a aplicação. Não há fallback visual para componentes que falham. | Alta | Alta | Serviço | Frontend | Aberto | Implementar `<ErrorBoundary>` em todos os componentes de alta criticidade. Definir fallback UI para cada boundary. |
| FE-007 | **Sem instrumentação de RUM (Real User Monitoring)**: Não há dados de performance real de usuários — tempo de carregamento, erros de JS, Web Vitals. O time não sabe como a UI performa em dispositivos clínicos. | Média | Média | Serviço | Frontend | Aberto | Integrar OTel Web ou Sentry RUM. Coletar Core Web Vitals. Definir SLOs de UX. |
| FE-008 | **PHI em localStorage/sessionStorage**: Sem auditoria do que o Next.js persiste no browser. Dados de pacientes podem estar armazenados sem criptografia no dispositivo do usuário. | Crítica | Alta | Clínico | Segurança | Aberto | Auditar uso de Web Storage. Remover qualquer PHI. Usar session-only cookies HTTPOnly para dados sensíveis. |

---

## Categoria 5 — Dados e Privacidade

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| DATA-001 | **PHI em logs de serviços NestJS**: Request bodies com dados de pacientes são logados sem sanitização. Qualquer acesso ao Loki expõe PHI em texto plano. | Catastrófica | Imediata | Plataforma | Privacidade | Aberto | Implementar log sanitization middleware em todos os serviços NestJS. Redact campos PHI antes de logar. Auditar logs existentes. |
| DATA-002 | **PHI em traces do OpenTelemetry**: Spans do OTel podem conter request/response bodies com dados de pacientes. Tempo armazenado indefinidamente. | Alta | Média | Plataforma | Privacidade | Aberto | Configurar attribute filtering no OTel Collector. Definir lista allowlist de atributos permitidos. |
| DATA-003 | **Sem BAA com Anthropic confirmado**: PHI pode estar sendo enviado para a API Anthropic sem Business Associate Agreement formal — violação direta da HIPAA. | Catastrófica | Imediata | Plataforma | Compliance | Aberto | Obter BAA com Anthropic antes de usar dados reais de pacientes. Alternativa: usar modelos locais ou redação de PHI antes de enviar. |
| DATA-004 | **Sem política de retenção de PHI**: Dados de pacientes em PostgreSQL, NATS streams e Loki crescem indefinidamente. Sem política de retenção, descarte ou anonimização. | Alta | Baixa | Plataforma | Compliance | Aberto | Definir política de retenção por tipo de dado. Implementar TTL no Loki. Definir retenção de streams NATS. Purge automático de PHI pós-período regulatório. |
| DATA-005 | **AI context construído com PHI além do mínimo necessário**: O princípio de minimum necessary da HIPAA exige que apenas o PHI necessário para a função seja enviado. O AI Gateway não tem controle de escopo de PHI por request. | Alta | Média | Plataforma | Compliance | Aberto | Implementar PHI scoping por use case no AI Gateway. Documentar justificativa de necessidade para cada campo PHI incluído no contexto. |
| DATA-006 | **Sem trilha de auditoria de acesso a PHI**: A HIPAA exige log de quem acessou quais dados de paciente, quando e por qual motivo. Não existe este registro. | Catastrófica | Imediata | Plataforma | Compliance | Aberto | Implementar audit log imutável para todo acesso a PHI. Usar append-only storage. Incluir user, timestamp, patient_id, recurso acessado, justificativa. |
| DATA-007 | **Inconsistência entre FHIR e banco relacional**: Dados de pacientes podem estar duplicados ou divergentes entre o Medplum/FHIR e o PostgreSQL interno dos serviços. Sem mecanismo de reconciliação. | Alta | Média | Serviço | Backend | Aberto | Definir PostgreSQL como cache do FHIR ou FHIR como source of truth. Implementar reconciliation job. |
| DATA-008 | **Sem criptografia em repouso verificada**: Não há confirmação de que PostgreSQL, NATS streams e volumes Kubernetes têm criptografia em repouso ativa. | Alta | Baixa | Plataforma | Segurança | Aberto | Verificar e documentar estado de criptografia em repouso de cada sistema. Ativar onde ausente. |

---

## Categoria 6 — Segurança

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| SEC-001 | **Sem TLS inter-serviço**: Comunicação entre serviços no cluster (gRPC, REST interno) ocorre em plaintext. Um adversário com acesso à rede do cluster pode interceptar tráfego clínico. | Alta | Média | Cluster | Segurança | Aberto | Implementar mTLS via service mesh (Istio ou Linkerd). Alternativa mínima: TLS manual nos endpoints internos. |
| SEC-002 | **Sem image scanning no pipeline CI**: Imagens Docker não são escaneadas por vulnerabilidades antes do deploy. Imagens com CVEs críticos chegam ao cluster sem detecção. | Alta | Alta | Cluster | Segurança | Aberto | Integrar Trivy ou Grype no pipeline CI. Bloquear build se CVE crítico encontrado. |
| SEC-003 | **Containers rodando como root**: Sem verificação de que os containers da plataforma Velya usam usuários não-root. Um container comprometido tem privilégios de root no nó. | Alta | Alta | Nó | Segurança | Aberto | Auditar todos os Dockerfiles. Definir `runAsNonRoot: true` nos SecurityContext. Usar `securityContext.readOnlyRootFilesystem: true` onde possível. |
| SEC-004 | **Sem RBAC refinado por serviço**: ServiceAccounts com permissões excessivas. Um serviço comprometido pode ter acesso a recursos do cluster muito além do necessário. | Alta | Média | Cluster | Segurança | Aberto | Auditar permissões de cada ServiceAccount. Aplicar princípio de menor privilégio. Usar `audit2rbac` para gerar RBAC minimal. |
| SEC-005 | **Sem WAF (Web Application Firewall) no ingress**: O nginx-ingress não tem regras de ModSecurity ou equivalente ativo. Requests maliciosos chegam diretamente aos serviços. | Alta | Alta | Serviço | Segurança | Aberto | Habilitar ModSecurity no nginx-ingress. Configurar OWASP Core Rule Set. Definir modo detection antes de enforcement. |
| SEC-006 | **API keys em variáveis de ambiente sem rotação**: As chaves de API (Anthropic, outros providers) não têm política de rotação. Uma chave comprometida permanece válida indefinidamente. | Alta | Alta | Plataforma | Segurança | Aberto | Implementar rotação automática de secrets. Usar External Secrets Operator. Definir TTL máximo de 90 dias para chaves. |
| SEC-007 | **Sem proteção contra prompt injection via dados clínicos**: Campos free-text de pacientes (notas clínicas, nomes) não são sanitizados antes de serem incluídos em prompts de AI. | Crítica | Alta | Plataforma | Segurança | Aberto | Implementar sanitização de inputs antes de incluir em prompts. Usar delimitadores seguros. Testar com payloads de injeção. |
| SEC-008 | **Sem autenticação na API interna entre serviços**: Serviços chamam uns aos outros sem autenticação mutual. Qualquer pod no cluster pode chamar endpoints internos. | Alta | Média | Cluster | Segurança | Aberto | Implementar autenticação inter-serviço (mTLS, JWT interno, ou API key por serviço). |

---

## Categoria 7 — Compliance

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| COMP-001 | **Sem framework HIPAA formal implementado**: A plataforma lida com PHI mas não tem política de privacidade, treinamento de equipe, designação de Privacy Officer, nem BAA com fornecedores. | Catastrófica | Imediata | Empresa | Compliance | Aberto | Contratar assessoria HIPAA. Nomear Privacy Officer. Documentar todos os fluxos de PHI. Obter BAAs com todos os fornecedores (Anthropic, AWS, etc.). |
| COMP-002 | **Sem auditoria de PHI por user**: A HIPAA requer que acesso a PHI seja auditável por usuário. Não há sistema de audit logging implementado. | Catastrófica | Imediata | Empresa | Compliance | Aberto | Implementar audit log com: user_id, timestamp, patient_id, recurso, ação, justificativa clínica. Armazenamento imutável por 6 anos (HIPAA). |
| COMP-003 | **Sem Breach Notification Procedure**: Em caso de vazamento de PHI, a HIPAA exige notificação dentro de 60 dias (HHS) e sem demora injustificada para pacientes. Não há procedimento documentado. | Crítica | N/A | Empresa | Compliance | Aberto | Criar e testar Breach Notification Procedure. Definir responsáveis, canal de notificação, template de comunicação. |
| COMP-004 | **Sem DPIA (Data Protection Impact Assessment)**: O processamento de PHI por AI não foi avaliado formalmente quanto a riscos de privacidade. | Alta | Baixa | Empresa | Compliance | Aberto | Conduzir DPIA para cada caso de uso de AI com PHI. Documentar riscos e controles. |
| COMP-005 | **Sem política de retenção documentada e executada**: Dados de pacientes devem ser retidos por período mínimo regulatório e então descartados com segurança. Nenhuma política existe. | Alta | Baixa | Empresa | Compliance | Aberto | Definir retenção por tipo de dado: registros clínicos (mínimo 7 anos), logs operacionais (1 ano), dados de AI (avaliar necessidade). Implementar purge automático. |
| COMP-006 | **Sem gestão de consentimento do paciente**: Para uso de dados de pacientes em treino ou melhoria de AI, consentimento explícito é necessário. Não há mecanismo de consentimento. | Alta | Baixa | Empresa | Compliance | Aberto | Definir política clara: dados de pacientes NÃO serão usados para treino de modelos sem consentimento. Implementar controle técnico de opt-in. |
| COMP-007 | **Sem certificação de segurança de fornecedores**: Não há verificação de SOC2, ISO 27001 ou equivalente para todos os fornecedores que processam PHI. | Média | Baixa | Empresa | Compliance | Aberto | Auditar certificações de todos os fornecedores (Anthropic, AWS, GitHub, etc.). Exigir BAA e evidência de controles. |

---

## Categoria 8 — Operacional

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| OPS-001 | **Runbooks existem mas nunca foram testados**: Há runbooks para incidentes comuns, mas nenhum foi executado em drill. Em uma crise real, o time depende de documentação não validada. | Alta | Alta | Plataforma | Operacional | Aberto | Agendar game day mensal. Executar pelo menos 3 cenários de incidente por trimestre. Documentar gaps encontrados. |
| OPS-002 | **Sem on-call rotation definida**: Não há schedule de plantão definido para incidentes em produção. Em uma falha crítica fora do horário, não está claro quem responde. | Crítica | Alta | Plataforma | Operacional | Aberto | Definir on-call rotation com PagerDuty ou Opsgenie. Definir SLA de resposta por severidade. |
| OPS-003 | **Sem processo de incident review pós-mortem**: Incidentes não resultam em postmortems estruturados. Os mesmos erros podem se repetir. | Alta | Alta | Plataforma | Operacional | Aberto | Implementar processo de blameless postmortem. Template padronizado. Review obrigatório para P0/P1. |
| OPS-004 | **Dashboard Grafana acessível apenas via port-forward**: Sem ingress para Grafana, o time não consegue monitorar o cluster de forma conveniente. Em incidente, o tempo de acesso ao diagnóstico aumenta. | Média | Alta | Plataforma | Operacional | Aberto | Criar Ingress para Grafana com autenticação. URL: `http://grafana.172.19.0.6.nip.io`. |
| OPS-005 | **Sem process owner para cada serviço**: Nenhum serviço tem um dono claro responsável por sua saúde operacional. Problemas ficam sem dono. | Alta | Alta | Plataforma | Operacional | Aberto | Definir service ownership. Criar `CODEOWNERS` e `service-catalog.yaml` com dono por serviço. |
| OPS-006 | **Sem processo de capacity planning**: Não há revisão periódica de uso de recursos vs. capacidade disponível. Surpresas de esgotamento de capacidade em produção. | Média | Média | Plataforma | Operacional | Aberto | Implementar revisão mensal de capacity com dados do Prometheus. Definir threshold de alerta precoce (70% de uso). |
| OPS-007 | **Alertas sem runbook linkado**: Alertas Prometheus (VelyaServiceDown, VelyaHighCPU) não têm link para runbook na annotation `runbook_url`. Em incidente, o respondedor não sabe o que fazer. | Alta | Alta | Plataforma | Operacional | Aberto | Adicionar `annotations.runbook_url` a todos os PrometheusRules. Criar runbook para cada alerta. |

---

## Categoria 9 — Observabilidade

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| OBS-001 | **Sem ServiceMonitors para serviços Velya**: patient-flow-service, task-inbox-service, discharge-orchestrator e demais serviços não têm ServiceMonitor. Prometheus não coleta métricas deles. | Crítica | Alta | Plataforma | Observabilidade | Aberto | Criar ServiceMonitor para cada serviço. Expor `/metrics` endpoint em cada serviço NestJS com `@willsoto/nestjs-prometheus`. |
| OBS-002 | **Sem métricas de negócio**: Nenhuma métrica de negócio está sendo coletada: tempo médio de alta, taxa de bloqueadores, inbox overload. O time não tem visibilidade do impacto clínico real. | Alta | Alta | Plataforma | Observabilidade | Aberto | Definir golden signals de negócio. Implementar custom metrics no código. Criar dashboard Grafana de operações clínicas. |
| OBS-003 | **Sem tracing end-to-end**: Não há trace propagado do frontend até o banco de dados. Latência lenta é impossível de diagnosticar. | Alta | Alta | Plataforma | Observabilidade | Aberto | Implementar OTel tracing em todos os serviços NestJS. Propagar trace context via NATS headers. Configurar Tempo como backend. |
| OBS-004 | **Sem tracing no AI Gateway**: O AI Gateway não gera spans para chamadas ao Anthropic. Não há visibilidade de latência, modelo usado, tokens consumidos, ou erros de API. | Alta | Alta | Plataforma | Observabilidade | Aberto | Instrumentar AI Gateway com OTel. Registrar: model, input_tokens, output_tokens, latency_ms, cache_hit, error_code. |
| OBS-005 | **Correlação de logs sem trace_id**: Logs dos serviços NestJS não incluem `trace_id`. Impossível correlacionar logs com traces durante diagnóstico de incidente. | Alta | Alta | Plataforma | Observabilidade | Aberto | Implementar middleware NestJS que injeta `trace_id` em todos os logs. Usar AsyncLocalStorage para propagar contexto. |
| OBS-006 | **Sem dashboards específicos para Velya**: Grafana tem dashboards genéricos de Kubernetes mas nenhum dashboard de serviços Velya, workflows clínicos ou AI. | Alta | Alta | Plataforma | Observabilidade | Aberto | Criar 5 dashboards mínimos: Overview da Plataforma, Saúde dos Serviços, Operações Clínicas, AI/Agents, Infraestrutura. |
| OBS-007 | **Alertas sem contato de roteamento configurado**: Alertas definidos nos PrometheusRules não têm receiver configurado no Alertmanager. Alertas são gerados mas nunca notificam ninguém. | Crítica | Imediata | Plataforma | Observabilidade | Aberto | Configurar Alertmanager com receivers (Slack, PagerDuty). Definir routing por severidade. Testar com alert de teste. |

---

## Categoria 10 — Custo

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| COST-001 | **Sem limite de custo de inferência por agent**: Um agent em retry loop com modelos caros (Claude Opus) pode gerar custo ilimitado em horas. Sem circuit breaker de custo. | Crítica | Alta | Plataforma | Produto | Aberto | Implementar token budget por agent por hora. Circuit breaker de custo no AI Gateway. Alerta quando 80% do budget diário consumido. |
| COST-002 | **Model selection sem otimização de custo**: Não há política de uso do modelo mais econômico adequado. Tarefas simples de triagem podem usar Claude Opus (15x mais caro que Haiku) sem necessidade. | Alta | Alta | Plataforma | Produto | Aberto | Definir política de model routing por tipo de tarefa. Tarefas simples → Haiku. Tarefas complexas → Sonnet. Casos especiais → Opus. |
| COST-003 | **KEDA thrash gerando custo de pods**: ScaledObjects sem cooldown adequado podem oscilar entre mínimo e máximo a cada 30-60 segundos, gerando custo de criação/destruição de pods e custo de nós. | Alta | Média | Cluster | DevOps | Aberto | Configurar `cooldownPeriod` de 300s mínimo. Usar `stabilizationWindowSeconds` no HPA. Monitorar scaling events. |
| COST-004 | **Label patient_id em métricas Prometheus**: Se algum serviço adicionar patient_id como label de uma métrica, criará bilhões de time series (cardinalidade explosiva), podendo OOMKill o Prometheus. | Crítica | Alta | Plataforma | Observabilidade | Aberto | Auditar labels de todas as métricas. Proibir IDs de alta cardinalidade como labels. Adicionar cardinality limit no Prometheus. |
| COST-005 | **Sem budget cap de cloud em produção (EKS)**: Em produção no EKS, não há AWS Budget Alert configurado. Um runaway workload pode gerar custo de dezenas de milhares de dólares antes de ser detectado. | Crítica | Alta | Plataforma | Produto | Aberto | Configurar AWS Budgets com alertas em 50%, 80%, 100% do budget mensal. Criar kill switch de emergência para EKS. |
| COST-006 | **Sem sampling de traces configurado**: OTel collector configurado para 100% de sampling. Com volume real de tráfego hospitalar, o custo de armazenamento de traces explodiria. | Alta | Alta | Plataforma | Observabilidade | Aberto | Configurar tail-based sampling no OTel Collector. Reter 100% de erros e 5% de traces bem-sucedidos. |

---

## Categoria 11 — Fatores Humanos

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| HF-001 | **Interface não testada em condições reais de uso clínico**: A UI foi desenvolvida fora do contexto hospitalar (turnos de 12h, alta interrupção, iluminação variável). Nunca foi testada com profissionais de saúde reais em ambiente clínico. | Alta | Alta | Clínico | Produto | Aberto | Conduzir testes de usabilidade com enfermeiros e médicos. Observar uso em ambiente real. Priorizar feedback de campo. |
| HF-002 | **Alert fatigue por volume de notificações**: Sem limite de frequência de alertas, profissionais de saúde podem ser bombardeados com notificações, levando a ignorar alertas críticos. | Crítica | Alta | Clínico | Produto | Aberto | Definir política de notification rate limiting. Implementar criticality triage antes de notificar. |
| HF-003 | **Viés de automação**: Clínicos podem confiar excessivamente em recomendações de AI sem aplicar julgamento clínico próprio. O sistema não tem mensagem clara de que AI é suporte, não decisão. | Crítica | Alta | Clínico | Produto | Aberto | Adicionar disclaimer claro em todas as recomendações de AI. Registrar se recomendação foi seguida ou overridden. Monitorar override rate. |
| HF-004 | **Sobrecarga cognitiva na interface**: 6 métricas simultâneas no Command Center, múltiplos filtros, mistura de informações clínicas e operacionais. Dificulta triagem em situação de pressão. | Alta | Alta | Clínico | Produto | Aberto | Realizar análise de cognitive load. Priorizar informação crítica. Implementar modo de crise com UI simplificada. |
| HF-005 | **Sem treinamento formalizado para usuários**: Profissionais de saúde podem usar funcionalidades de AI sem entender limitações, confiabilidade esperada ou quando não confiar nas recomendações. | Alta | Alta | Clínico | Produto | Aberto | Criar programa de treinamento. Incluir casos de falha da AI. Testar competência antes de acesso a dados reais. |
| HF-006 | **Fluxo de alta com etapas não claras para casos complexos**: O workflow de alta para casos com múltiplos bloqueadores não tem orientação clara sobre priorização. O profissional tem que decidir a ordem sozinho. | Média | Alta | Clínico | Produto | Aberto | Implementar orquestração inteligente de sequência de alta. AI sugere próximo passo com base em dependências. |

---

## Categoria 12 — Integrações

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| INT-001 | **Sem retry com idempotência nas chamadas ao Medplum**: Se uma chamada FHIR para o Medplum falha, o retry pode criar duplicatas de recursos (Patient, Encounter, etc.). | Alta | Alta | Serviço | Backend | Aberto | Implementar idempotency key em todas as mutations FHIR. Usar `If-None-Exist` header do FHIR para operações create. |
| INT-002 | **Sem circuit breaker para dependências externas**: Chamadas ao Anthropic, Medplum e outros serviços externos não têm circuit breaker. Lentidão do provider externo causa lentidão em cascata nos serviços Velya. | Alta | Alta | Serviço | Backend | Aberto | Implementar circuit breaker com timeout por provider externo. Configurar fallback e retry com backoff. |
| INT-003 | **Sem monitoramento de SLA de providers externos**: Não há alertas quando Anthropic, Medplum ou outros providers externos degradam. O time descobre pela degradação dos serviços Velya, não pela fonte. | Alta | Alta | Plataforma | Observabilidade | Aberto | Implementar health check ativo para cada provider externo. Alerta quando latência p99 > threshold ou error rate > 1%. |
| INT-004 | **Sem validação de schema FHIR no consumer**: Eventos FHIR que chegam via NATS não são validados contra o profile FHIR antes de serem processados. Dados inválidos causam erros de runtime obscuros. | Alta | Média | Serviço | Backend | Aberto | Implementar FHIR validator (medplum/core ou fhir.js) no consumer antes do processamento. |
| INT-005 | **Sem teste de contrato com Medplum**: Mudanças no Medplum podem quebrar a integração sem detecção precoce. Não há testes de contrato automatizados. | Alta | Média | Serviço | Backend | Aberto | Implementar consumer-driven contract tests (Pact). Executar no CI a cada PR. |
| INT-006 | **Webhook de integrações externas sem validação de assinatura**: Se houver webhooks de sistemas externos (HIS, LIS), não há verificação de assinatura HMAC para validar autenticidade. | Alta | Alta | Serviço | Segurança | Aberto | Implementar validação de assinatura HMAC para todos os webhooks recebidos. Rejeitar requests sem assinatura válida. |

---

## Categoria 13 — AI e LLM (OWASP LLM Top 10)

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| LLM-001 | **LLM01 - Prompt Injection via dados clínicos**: Campos free-text de pacientes (notas, nomes, diagnósticos) podem conter instruções maliciosas que alteram o comportamento do LLM. Impacto clínico direto. | Catastrófica | Alta | Clínico | Segurança | Aberto | Sanitizar todos os inputs antes de incluir em prompts. Usar delimitadores de conteúdo seguro. Testar regularmente com payloads de injeção. |
| LLM-002 | **LLM02 - Insecure Output Handling**: Respostas do LLM são usadas diretamente para ações (criar tarefas, publicar eventos NATS) sem validação de output. Output malicioso ou incorreto pode causar ações clínicas erradas. | Crítica | Alta | Plataforma | Segurança | Aberto | Implementar output validation antes de qualquer ação baseada em output de LLM. Schema validation, plausibility check, threshold de confiança. |
| LLM-003 | **LLM03 - Training Data Poisoning**: Se dados de pacientes são usados para fine-tuning sem controle, dados enviesados ou manipulados podem corromper o modelo. | Alta | Baixa | Plataforma | Segurança | Aberto | Política explícita: sem fine-tuning com dados de pacientes sem processo controlado de curadoria e validação. |
| LLM-004 | **LLM04 - Model Denial of Service**: Prompts muito longos, recursivos ou computacionalmente caros podem travar o AI Gateway e por extensão os serviços dependentes. | Alta | Média | Plataforma | Segurança | Aberto | Implementar limite de tamanho de prompt. Rate limiting por client. Timeout de inferência. |
| LLM-005 | **LLM05 - Supply Chain Vulnerabilities**: Dependência de modelos e ferramentas de terceiros (Anthropic SDK, LangChain, etc.) sem verificação de integridade. | Média | Baixa | Plataforma | Segurança | Aberto | Auditar dependências de AI regularmente. Usar lockfile. Verificar integridade de pacotes. |
| LLM-006 | **LLM06 - Sensitive Information Disclosure**: LLM pode incluir PHI de outros pacientes em suas respostas se o contexto de memória ou RAG for contaminado. | Catastrófica | Alta | Clínico | Segurança | Aberto | Isolamento de contexto por paciente. Nunca incluir dados de múltiplos pacientes no mesmo contexto sem sanitização. |
| LLM-007 | **LLM07 - Insecure Plugin Design**: MCPs e tools dos agents têm acesso a recursos críticos (kubectl, NATS publish, DB write) sem validação adequada de ação. | Crítica | Alta | Plataforma | Segurança | Aberto | Implementar classificação de risco por ferramenta (Tier 0-4). Requer aprovação humana para ações Tier 2+. |
| LLM-008 | **LLM08 - Excessive Agency**: Agents tomam ações no mundo real (modificar cluster, criar PRs, publicar eventos NATS) com autonomia além do necessário. | Crítica | Alta | Plataforma | Governança | Aberto | Princípio de menor privilégio para agents. Audit log de toda ação de agent. Kill switches por categoria. |
| LLM-009 | **LLM09 - Overreliance**: O sistema e seus usuários confiam demais no output do LLM, sem validação crítica. Em contexto clínico, isso pode causar dano ao paciente. | Catastrófica | Alta | Clínico | Produto | Aberto | Disclaimer explícito em todas as recomendações AI. Monitorar override rate. Treinar usuários em limitações. |
| LLM-010 | **LLM10 - Model Theft**: API keys de acesso a modelos podem ser comprometidas, resultando em uso não autorizado e custo financeiro. | Alta | Média | Plataforma | Segurança | Aberto | Rotação regular de API keys. Monitoramento de uso anômalo. Alertas de custo. |

---

## Categoria 14 — Prompt, Memória e Contexto

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| PMC-001 | **Memória desatualizada usada como verdade atual**: O memory-service pode retornar memórias de dias ou semanas atrás que já não refletem a realidade do paciente ou do sistema. | Alta | Alta | Clínico | Backend | Aberto | Implementar TTL por tipo de memória. Marcar memórias com timestamp e staleness indicator. |
| PMC-002 | **Memória contraditória entre agents**: Dois agents com memórias conflitantes sobre o estado de um paciente podem tomar ações opostas. Sem mecanismo de resolução de conflito. | Alta | Média | Clínico | Backend | Aberto | Implementar memória compartilhada com controle de versão. Resolver conflitos com regras definidas de precedência. |
| PMC-003 | **Context window overflow silencioso**: Quando o contexto excede o limite do modelo, o LLM trunca silenciosamente partes do contexto. Informações críticas podem ser perdidas sem aviso. | Alta | Alta | Plataforma | Backend | Aberto | Monitorar tamanho de contexto. Alertar quando > 80% do limit. Implementar compressão de contexto antes de truncar. |
| PMC-004 | **Viés de recência no contexto**: O modelo dá mais peso às últimas mensagens do contexto. Uma informação recente mas irrelevante pode dominar a resposta sobre informações importantes mais antigas. | Média | Média | Clínico | Produto | Aberto | Implementar summarização de contexto antigo. Destacar informações críticas independente de posição no contexto. |
| PMC-005 | **Memória de agent sem lifecycle**: O memory-service armazena memórias indefinidamente sem TTL, archival, ou purge. Cresce sem limite e consome storage. | Média | Baixa | Plataforma | Backend | Aberto | Definir política de lifecycle de memória: hot (7 dias), warm (30 dias), cold (arquivado), deleted (após período regulatório). |

---

## Categoria 15 — Deploy e Mudança

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| DEP-001 | **Sem rollback automático**: Nenhum deployment tem rollback automático configurado. Um deploy com bug requer intervenção manual para reverter. | Alta | Alta | Serviço | DevOps | Aberto | Configurar canary deployments via ArgoCD Rollouts. Definir análise automática (error rate, latência) com rollback automático se thresholds excedidos. |
| DEP-002 | **Rollback não reverte migrations de banco**: Um rollback de código que reverteu uma migration de schema pode corromper dados se a migration foi irreversível. | Crítica | Alta | Serviço | Backend | Aberto | Adotar política de migrations backward-compatible. Separar deploy de código e deploy de schema. |
| DEP-003 | **Version-bump automático sem verificação de breaking changes**: O workflow `version-bump.yml` faz bump de versão automaticamente sem verificar se há breaking changes nas dependências. | Alta | Alta | Plataforma | DevOps | Aberto | Adicionar verificação de breaking changes no workflow. Usar `npx check-breaking-changes` ou equivalente. |
| DEP-004 | **Prettier corrompeu templates Helm historicamente**: Um incidente real onde o Prettier formatou `{{` para `{ {` em templates Helm, quebrando todos os charts. | Alta | Alta | Plataforma | DevOps | Mitigado (parcial) | Adicionar `.prettierignore` para arquivos `*.yaml` em `charts/`. Verificar CI lint de Helm separado do Prettier. |
| DEP-005 | **Sem change freeze em períodos críticos**: Não há política de change freeze durante picos operacionais do hospital (final de mês, feriados, alta sazonalmente). | Alta | Alta | Plataforma | Operacional | Aberto | Definir calendário de change freeze. Configurar proteção de branch durante períodos críticos. |

---

## Categoria 16 — Modos de Falha

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| FAIL-001 | **Falha silenciosa de consumer NATS**: Um consumer que para de consumir não gera alerta. Mensagens acumulam na stream até atingir limite. O serviço parece saudável no Kubernetes. | Crítica | Alta | Serviço | Backend | Aberto | Monitorar consumer lag via NATS JetStream metrics. Alerta quando lag > threshold por mais de 5 minutos. |
| FAIL-002 | **Split-brain em PostgreSQL sem detecção**: Se o PostgreSQL primário perder conectividade parcialmente, pode haver dois nós acreditando ser primário. Writes divergentes causam corrupção de dados. | Crítica | Baixa | Plataforma | Backend | Aberto | Usar solução HA gerenciada (AWS RDS Multi-AZ). Implementar fencing e apenas 1 writer permitido. |
| FAIL-003 | **Temporal worker crash durante workflow crítico**: Se um worker Temporal cai no meio de um workflow de alta, o workflow pode ficar stuck aguardando heartbeat que nunca chega. | Alta | Média | Serviço | Backend | Aberto | Configurar heartbeat timeout no Temporal. Implementar retry automático de workers crashados. |
| FAIL-004 | **AI Gateway em modo parcialmente degradado**: O AI Gateway pode responder a health checks mas falhar em requests específicos (timeout de modelo, rate limit de certos endpoints). Parece saudável mas não está. | Alta | Alta | Plataforma | Backend | Aberto | Implementar health check sintético no AI Gateway que faz chamada real de teste ao modelo. |
| FAIL-005 | **Falha de DNS interna**: kube-dns degradado causa falhas cascata em todos os serviços que fazem service discovery por nome. Difícil de diagnosticar — parece falha do serviço. | Alta | Baixa | Cluster | Infraestrutura | Aberto | Monitorar DNS resolution time como métrica. Configurar DNS fallback. Adicionar ao runbook de troubleshooting. |
| FAIL-006 | **Node notReady sem eviction de pods**: Um nó que vai para NotReady não evict imediatamente os pods. Por 5 minutos (padrão), pods ficam presos no nó morto. | Alta | Baixa | Cluster | Infraestrutura | Aberto | Ajustar `node.kubernetes.io/not-ready:NoExecute` toleration timeout. Configurar `pod-eviction-timeout` no controller manager. |

---

## Categoria 17 — Recuperação de Desastres

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| DR-001 | **Backup nunca testado — restore pode falhar**: Mesmo que backups existam (o que é incerto), nenhum restore foi executado. A capacidade real de recuperação é desconhecida. | Catastrófica | N/A | Plataforma | Operacional | Aberto | Executar restore test completo imediatamente. Agendar restore test mensal automático. Documentar RTO e RPO medidos. |
| DR-002 | **RTO e RPO não definidos**: Não há definição de quanto tempo é aceitável para recuperar o sistema após falha, nem de quanta perda de dados é tolerável. O time não tem objetivos a atingir. | Alta | N/A | Plataforma | Produto | Aberto | Definir RTO (tempo de recuperação) e RPO (ponto de recuperação) por tier de serviço. Validar se a arquitetura atual consegue atingi-los. |
| DR-003 | **Sem procedimento de failover para ambiente alternativo**: Se o cluster kind-velya-local for perdido totalmente, não há ambiente alternativo mínimo para continuar operação. | Alta | N/A | Plataforma | Operacional | Aberto | Definir Disaster Recovery site. Documentar procedimento de failover para EKS em caso de falha total do ambiente local. |
| DR-004 | **Secrets perdidos com o cluster**: Se o cluster for destruído, os Kubernetes Secrets são perdidos junto. Nenhum secret é persistido externamente. | Crítica | N/A | Plataforma | Operacional | Aberto | Usar External Secrets Operator com backend externo (AWS Secrets Manager ou Vault). Backup de secrets separado do cluster. |
| DR-005 | **Sem runbook de recuperação de PostgreSQL**: Não existe runbook documentado e testado para restaurar o PostgreSQL a partir de backup em cenário de falha de storage ou corrupção. | Crítica | N/A | Plataforma | Operacional | Aberto | Criar runbook de restauração PostgreSQL. Executar drill. Documentar tempo de restauração medido. |
| DR-006 | **Estado do ArgoCD não persistido**: Se o ArgoCD for recriado do zero (ex: cluster rebuild), as Applications precisam ser recriadas manualmente. Não há bootstrap automático. | Alta | N/A | Plataforma | DevOps | Aberto | Implementar App-of-Apps pattern no ArgoCD. O cluster deve ser capaz de se auto-bootstrapar a partir do Git. |

---

## Categoria 18 — Institucional

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| INST-001 | **Governança de agents sem evidência de funcionamento**: A estrutura de offices, validators e coordinators existe no papel mas não há evidência de que produz saídas reais validadas por humanos. | Alta | Alta | Empresa | Governança | Aberto | Implementar scorecards com métricas reais. Revisão humana semanal de outputs de agents. |
| INST-002 | **Ausência de ADRs para maioria das decisões de arquitetura**: Apenas 13 ADRs documentados para uma plataforma com centenas de decisões de arquitetura implícitas. | Alta | Alta | Empresa | Arquitetura | Aberto | Criar ADR para cada decisão significativa retroativamente. Exigir ADR para toda nova decisão de arquitetura. |
| INST-003 | **Risco de concentração de conhecimento**: Se membros-chave da equipe saírem, o conhecimento implícito sobre o sistema é perdido. A documentação não cobre o conhecimento tácito. | Alta | Baixa | Empresa | Operacional | Aberto | Programa de documentação de conhecimento tácito. Pair programming obrigatório. Rotação de responsabilidades. |
| INST-004 | **Sem processo formal de security review**: Mudanças de arquitetura e novos features não passam por security review formal antes de serem implementados. | Alta | Alta | Empresa | Segurança | Aberto | Implementar Threat Modeling para novos features. Security review gate no processo de ADR. |
| INST-005 | **Decisões tomadas em contexto de conversa não rastreadas**: Decisões importantes tomadas em conversas com AI ou reuniões informais não são registradas como ADRs ou documentos rastreáveis. | Média | Alta | Empresa | Governança | Aberto | Exigir que toda decisão de arquitetura seja registrada em ADR, independente de como surgiu. |
| INST-006 | **Sem definição de pronto (Definition of Done) para agents**: Não há critério claro de quando uma tarefa executada por um agent é considerada concluída com qualidade suficiente. | Alta | Alta | Empresa | Governança | Aberto | Definir DoD por tipo de tarefa. Incluir: evidência de validação, coverage de teste, review de segurança quando aplicável. |

---

## Categoria 19 — Conhecimento

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| KNOW-001 | **Cobertura de testes próxima de zero**: A maioria dos serviços NestJS não tem testes unitários ou de integração. O código não tem rede de segurança para mudanças. | Alta | Alta | Plataforma | Engenharia | Aberto | Definir cobertura mínima de 60% como gate no CI. Roadmap para atingir 80% nos serviços críticos. |
| KNOW-002 | **Documentação diverge da implementação real**: Documentação de arquitetura descreve o estado desejado, não o estado atual. Novos membros da equipe são induzidos a erro. | Alta | Alta | Empresa | Engenharia | Aberto | Marcar documentação com estado (Planejado/Em Implementação/Implementado). Revisão trimestral de documentação vs. realidade. |
| KNOW-003 | **Sem ambiente de staging entre dev e produção**: Mudanças vão de desenvolvimento diretamente para produção sem validação em ambiente similar ao de produção. | Alta | Alta | Plataforma | DevOps | Aberto | Criar ambiente de staging no EKS. Definir promoção: dev → staging → produção com gates de qualidade. |
| KNOW-004 | **Falta de conhecimento de domínio clínico na equipe**: Decisões de produto e UX são tomadas sem input de profissionais de saúde. Podem não refletir os fluxos reais de trabalho clínico. | Alta | Alta | Empresa | Produto | Aberto | Envolver profissionais de saúde desde o início (user research, co-design). Nomear Clinical Advisor. |
| KNOW-005 | **Sem processo de knowledge transfer entre AI e equipe humana**: Insights e decisões tomadas em contexto de AI não são transferidos sistematicamente para a base de conhecimento humana da equipe. | Média | Alta | Empresa | Operacional | Aberto | Processo de review de ADRs gerados com assistência de AI. Curadoria humana de conhecimento produzido por AI. |

---

## Categoria 20 — Degradação Silenciosa

| ID | Descrição | Severidade | Explorabilidade | Raio de Explosão | Dono | Status | Remediação |
|---|---|---|---|---|---|---|---|
| SIL-001 | **Serviços respondendo 200 com lógica de negócio falha**: Um serviço pode retornar HTTP 200 enquanto internamente falha silenciosamente em processar dados (ex: exception capturada sem propagar). | Crítica | Alta | Serviço | Backend | Aberto | Implementar error tracking (Sentry). Nunca capturar exceções sem log e métrica de erro. Testar cenários de falha interna. |
| SIL-002 | **Consumer lag crescendo sem alerta**: O consumer NATS pode acumular mensagens por horas antes de alguém notar. O serviço parece saudável mas está processando dados de horas atrás. | Alta | Alta | Serviço | Observabilidade | Aberto | Monitorar consumer lag como SLI. Alerta quando lag > 5 minutos de mensagens acumuladas. |
| SIL-003 | **AI retornando respostas de baixa qualidade sem detecção**: Sem avaliação de qualidade de output de AI, o modelo pode degradar (mudança de versão pelo provider, contexto ruim) sem que ninguém perceba. | Alta | Alta | Plataforma | AI | Aberto | Implementar avaliação automática de qualidade de output. Monitorar confidence scores. Alerta se qualidade cai abaixo de threshold. |
| SIL-004 | **Sync do ArgoCD silenciosamente falhando**: O ArgoCD pode falhar em sincronizar por dias sem alerta visível. O cluster deriva do Git sem que a equipe saiba. | Crítica | Alta | Plataforma | DevOps | Aberto | Configurar alertas de sync failure no ArgoCD. Notificação no Slack para sync degraded > 15 minutos. |
| SIL-005 | **Crescimento silencioso de storage sem alerta**: PostgreSQL, NATS streams e Loki crescem continuamente. Sem alerta de capacidade, o primeiro sinal é falha de write por storage full. | Alta | Alta | Plataforma | Operacional | Aberto | Alertas de uso de storage: 70% warning, 85% critical. Monitorar crescimento diário. |
| SIL-006 | **Feature flag habilitada mas comportamento não monitorado**: Feature flags ativadas em produção sem monitoramento de impacto podem degradar experiência silenciosamente. | Média | Média | Serviço | Produto | Aberto | Correlacionar ativação de feature flags com métricas de saúde. Alerta automático 30 minutos após ativação. |
| SIL-007 | **Memória de agent aprendendo padrão errado**: O memory-service pode registrar uma decisão incorreta como aprendizado positivo. O erro é então repetido como se fosse boa prática. | Alta | Média | Plataforma | AI | Aberto | Revisão humana de novos padrões adicionados à memória. Quarentena de 7 dias antes de propagar aprendizado. |

---

## Resumo Executivo

| Categoria | Total de Itens | Críticos/Catastróficos | Abertos |
|---|---|---|---|
| Arquitetura | 8 | 2 | 8 |
| Runtime/Infraestrutura | 10 | 3 | 9 |
| Governança de Agents | 8 | 2 | 8 |
| Frontend | 8 | 2 | 8 |
| Dados e Privacidade | 8 | 3 | 8 |
| Segurança | 8 | 2 | 8 |
| Compliance | 7 | 3 | 7 |
| Operacional | 7 | 1 | 7 |
| Observabilidade | 7 | 2 | 7 |
| Custo | 6 | 2 | 6 |
| Fatores Humanos | 6 | 2 | 6 |
| Integrações | 6 | 0 | 6 |
| AI/LLM | 10 | 4 | 10 |
| Prompt/Memória/Contexto | 5 | 0 | 5 |
| Deploy/Mudança | 5 | 1 | 4 |
| Modos de Falha | 6 | 2 | 6 |
| Recuperação de Desastres | 6 | 2 | 6 |
| Institucional | 6 | 0 | 6 |
| Conhecimento | 5 | 0 | 5 |
| Degradação Silenciosa | 7 | 1 | 7 |
| **TOTAL** | **143** | **34** | **142** |

> **Atenção**: 34 itens de severidade Crítica ou Catastrófica estão abertos. A plataforma **não deve processar dados reais de pacientes** até que os itens marcados como Catastróficos sejam remediados ou aceitos com risco documentado.
