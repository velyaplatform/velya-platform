# Registro de Suposições — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Arquitetura e Governança  
> **Propósito**: Log formal de todas as suposições que o sistema, a equipe e os processos fazem. Suposições não validadas são riscos silenciosos. Este registro torna essas suposições explícitas para que possam ser testadas.

---

## Convenções

| Campo | Valores possíveis |
|---|---|
| **Status** | Assumida / Em Validação / Validada / Invalidada |
| **Risco se Errada** | Baixo / Médio / Alto / Crítico / Catastrófico |

---

## Suposições INVALIDADAS (confirmadas como falsas)

Estas suposições foram explicitamente testadas e encontradas erradas. Servem como lições aprendidas.

| ID | Suposição Invalidada | Data | Como foi Descoberta | Impacto Real | Fallback Aplicado |
|---|---|---|---|---|---|
| **INV-001** | "kindnet enforça NetworkPolicy — pods de namespaces diferentes não conseguem se comunicar sem NetworkPolicy permitindo" | 2026-04 | Teste empírico: pod em `velya-dev-web` conseguiu acessar pod em `velya-dev-core` apesar de NetworkPolicy restritiva | CRÍTICO: toda segurança de rede baseada em NetworkPolicy é ilusória no ambiente local | Documentado como risco aceito temporário. Jamais usar dados reais de pacientes até resolução. |
| **INV-002** | "nginx-ingress acessa IPs de pods diretamente sem configuração adicional" | 2026-04 | 504 Gateway Timeout em todos os ingresses com hostNetwork=true | ALTO: todos os serviços ficaram inacessíveis via ingress até descoberta | Aplicar annotation `nginx.ingress.kubernetes.io/service-upstream: "true"` em todos os Ingress resources |
| **INV-003** | "Os serviços estão operacionais e processando requests reais" | 2026-04 | Análise de código revelou que a maioria dos serviços é scaffold — handlers sem lógica real, retornando mock data | ALTO: nenhum serviço está realmente funcional em produção | Roadmap de implementação real de cada serviço |
| **INV-004** | "GitOps está funcionando — ArgoCD sincroniza o cluster com o repositório" | 2026-04 | Verificação: ArgoCD tem 0 Applications configuradas | CRÍTICO: todos os deploys são manuais, cluster diverge do Git sem detecção | Deploys manuais documentados como processo temporário |
| **INV-005** | "O frontend está funcional e pronto para uso clínico" | 2026-04 | Avaliação de qualidade resultou em score 8/100 — sem autenticação, sem testes, sem error handling | CATASTRÓFICO: frontend atual não pode ser usado com dados reais | Bloqueio de uso com dados reais até score mínimo de 60/100 |
| **INV-006** | "Testes cobrem o código — regressões serão detectadas pelo CI" | 2026-04 | Análise revelou cobertura de testes próxima de zero na maioria dos serviços | ALTO: mudanças de código não têm rede de segurança | Gate de cobertura mínima adicionado ao CI como objetivo |

---

## Categoria 1 — Suposições Técnicas

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| TECH-001 | Técnica | "O cluster kind-velya-local com 5 nós tem recursos suficientes para executar todos os namespaces e serviços simultaneamente" | Infra | Alto: serviços evictados por falta de recursos, instabilidade | Medir uso real de CPU/memória com `kubectl top nodes` e `kubectl top pods` | Assumida | Definir resource budgets por namespace. Priorizar serviços críticos. |
| TECH-002 | Técnica | "O NATS JetStream está configurado com retenção e replication adequadas para a carga de eventos clínicos" | Backend | Alto: perda de eventos, backpressure, consumer lag | Revisar configuração de streams: `nats stream info`. Verificar replication factor. | Assumida | Backup de configuração. Retenção baseada em critérios clínicos mínimos. |
| TECH-003 | Técnica | "PostgreSQL está configurado para suportar a carga de conexões simultâneas de todos os serviços" | Backend | Alto: connection pool exhausted, serviços falhando | Verificar `max_connections` do PostgreSQL vs. número de pods × pool size por pod | Assumida | Implementar PgBouncer como connection pooler. |
| TECH-004 | Técnica | "As imagens Docker dos serviços são construídas de forma reprodutível — o mesmo código sempre gera a mesma imagem" | DevOps | Médio: builds não-determinísticos, divergência entre ambientes | Verificar uso de versões fixas em Dockerfiles. Checar se há dependências de data/hora no build. | Assumida | Usar lockfiles rigorosos. Fixar todas as versões de dependências. |
| TECH-005 | Técnica | "O health check HTTP dos serviços NestJS reflete o estado real de funcionamento (DB conectado, NATS disponível)" | Backend | Crítico: serviço visto como saudável pelo Kubernetes enquanto funcionalmente degradado | Testar: derrubar o banco e verificar se o pod ainda fica como Ready | Assumida | Implementar readiness probe que verifica dependências reais. |
| TECH-006 | Técnica | "Os volumes PersistentVolume sobrevivem ao restart de pods e ao rebuild do cluster kind" | Infra | Crítico: perda de dados ao reiniciar cluster ou pod | Testar: restart do pod e verificar persistência dos dados | Assumida | Backup externo periódico de dados críticos. |
| TECH-007 | Técnica | "O OTel Collector consegue lidar com o volume de spans e logs gerados em carga real hospitalar" | Observabilidade | Médio: OTel Collector fica para trás, perde dados de observabilidade | Load test do collector com volume estimado de produção | Assumida | Configurar buffer e retry. Implementar tail sampling para reduzir volume. |
| TECH-008 | Técnica | "O Prometheus não vai atingir OOM com as métricas coletadas atualmente" | Observabilidade | Alto: Prometheus crashando, perda de métricas e alertas | Verificar cardinality atual: `prometheus_tsdb_symbol_table_size_bytes` | Assumida | Configurar cardinality limits. Remover labels de alta cardinalidade. |
| TECH-009 | Técnica | "A API do Anthropic tem disponibilidade suficiente para o SLA esperado da plataforma Velya" | Backend | Crítico: features AI indisponíveis durante outages do provider | Verificar SLA da Anthropic API. Implementar circuit breaker e fallback. | Assumida | Cache de respostas frequentes. Modo degradado sem AI. |
| TECH-010 | Técnica | "O Temporal server está configurado corretamente e consegue persistir estado de workflows de alta hospitalar" | Backend | Crítico: workflows perdidos, estado inconsistente de alta de pacientes | Executar workflow de teste end-to-end e verificar persistência após restart | Assumida | Manual fallback para workflow sem orquestração. |
| TECH-011 | Técnica | "As migrações de banco do Prisma/TypeORM são idempotentes e podem ser re-executadas com segurança" | Backend | Alto: corrupção de schema, duplicação de dados | Verificar se cada migration tem verificação de existência prévia | Assumida | Backup antes de cada migration. Migrations em transação com rollback. |
| TECH-012 | Técnica | "A integração com Medplum/FHIR R4 é compatível com a versão do servidor Medplum em uso" | Backend | Alto: falhas de integração, dados FHIR malformados | Verificar versão do SDK medplum/core vs. versão do servidor Medplum | Assumida | Testes de integração contra servidor Medplum real. |
| TECH-013 | Técnica | "KEDA consegue acessar o Prometheus como fonte de métricas para triggers de escala" | Infra | Alto: KEDA não consegue escalar, serviços subprovisionados em pico | Verificar KEDA ScaledObject status: `kubectl describe scaledobject` | Assumida | Fallback para HPA simples baseado em CPU/memória. |

---

## Categoria 2 — Suposições Operacionais

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| OPS-001 | Operacional | "A equipe tem competência técnica para operar Kubernetes, NestJS, NATS e a stack completa em cenário de incidente" | Operacional | Alto: incidente prolongado por falta de competência | Drill de incidente com cenários reais. Avaliar gap de competência. | Assumida | Runbooks detalhados. Suporte de contrato com especialistas. |
| OPS-002 | Operacional | "Os alertas do Prometheus chegam às pessoas certas quando acionados" | Observabilidade | Crítico: incidente não detectado, dano clínico silencioso | Verificar Alertmanager config. Disparar alerta de teste e confirmar recebimento. | Assumida | Backup de notification channel. Escalação automática por tempo. |
| OPS-003 | Operacional | "O tempo de resposta a incidentes P0 é compatível com o impacto clínico tolerável" | Operacional | Crítico: pacientes afetados por indisponibilidade longa | Definir SLA de resposta por severidade. Medir tempo de resposta em drills. | Assumida | On-call rotation com SLA contratual. |
| OPS-004 | Operacional | "Os runbooks estão atualizados e refletem a realidade atual do sistema" | Operacional | Alto: resposta a incidente lenta ou incorreta por documentação desatualizada | Revisar runbooks contra estado real do cluster trimestralmente | Assumida | Processo de revisão obrigatória de runbooks após cada incidente. |
| OPS-005 | Operacional | "O ambiente local kind-velya-local pode ser recriado completamente em menos de 30 minutos" | DevOps | Médio: perda de produtividade prolongada em caso de falha do cluster local | Cronometrar tempo real de rebuild do cluster a partir do zero | Assumida | Documentar procedimento de rebuild. Script de bootstrap automatizado. |
| OPS-006 | Operacional | "Deploys em horários de baixo uso do hospital causam mínimo impacto operacional" | Operacional | Médio: deploy em horário de pico causa degradação para usuários clínicos | Mapear padrões de uso por hora do dia. Definir janela de manutenção. | Assumida | Change freeze automático durante picos. |
| OPS-007 | Operacional | "O ambiente de produção EKS será similarmente configurado ao ambiente local kind" | DevOps | Alto: comportamentos diferentes em produção vs. desenvolvimento | Executar validação de paridade de configuração entre kind e EKS | Assumida | Infrastructure-as-Code rigoroso. Testes de paridade automáticos. |

---

## Categoria 3 — Suposições Humanas

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| HUM-001 | Humana | "Profissionais de saúde vão ler e entender as recomendações de AI antes de agir" | Produto | Catastrófico: decisão clínica baseada em output de AI mal compreendido | Observação de uso em campo. User testing com profissionais reais. | Assumida | UI que exige confirmação explícita de leitura. |
| HUM-002 | Humana | "A equipe de engenharia vai revisar PRs de agents com atenção crítica, não apenas aprovando" | Governança | Crítico: código incorreto ou perigoso aprovado por rubber stamp | Monitorar tempo médio de review. Alerta para reviews < 2 minutos. | Assumida | Checklist obrigatório de review. Peer review duplo para mudanças críticas. |
| HUM-003 | Humana | "Validators de agents aplicarão julgamento crítico, não simplesmente aprovarão para manter throughput" | Governança | Crítico: governança de agents inoperante, qualidade não verificada | Amostrar outputs aprovados por validators. Medir taxa de aprovação. | Assumida | Alerta se taxa de aprovação > 95% por período. Auditoria periódica de samples. |
| HUM-004 | Humana | "A equipe clínica fornecerá feedback ativo quando a AI errar ou apresentar informação inadequada" | Produto | Alto: erros de AI não são corrigidos, qualidade degrada silenciosamente | Implementar feedback loop na UI. Medir taxa de feedback vs. uso. | Assumida | Incentivar ativamente o reporte de erros. Baixar barreira de feedback. |
| HUM-005 | Humana | "Novos membros da equipe conseguirão se orientar pela documentação existente" | Engenharia | Médio: onboarding lento, erros por incompreensão da arquitetura | Conduzir onboarding test com novo membro e medir tempo até produtividade | Assumida | Buddy program. Documentação de onboarding específica e validada. |
| HUM-006 | Humana | "A equipe vai reportar pontos cegos e suposições erradas quando descobri-los" | Governança | Alto: pontos cegos permanecem ocultos, sistema acumula risco silenciosamente | Cultura de segurança psicológica. Blameless retrospectives. | Assumida | Canal anônimo de reporte de riscos. |

---

## Categoria 4 — Suposições sobre Dados

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| DATA-001 | Dados | "Dados FHIR do Medplum são consistentes e válidos segundo o profile FHIR R4" | Backend | Alto: dados malformados causam falhas em cascata nos serviços | Implementar validação FHIR schema no consumer. Auditar amostra de dados. | Assumida | Quarentena de dados inválidos. DLQ para processamento posterior com correção. |
| DATA-002 | Dados | "IDs de pacientes são únicos e estáveis ao longo do tempo no sistema Medplum" | Backend | Crítico: confusão de identidade de paciente — dados misturados entre pacientes | Verificar política de identidade no Medplum. Testar merge e split de pacientes. | Assumida | Índice de correspondência de pacientes (MPI) dedicado. |
| DATA-003 | Dados | "Dados de pacientes em PostgreSQL e Medplum estão sincronizados (consistência eventual respeitada)" | Backend | Alto: divergência de dados, decisões clínicas baseadas em dados stale | Implementar job de reconciliação. Monitorar lag de sincronização. | Assumida | Mecanismo de invalidação de cache ao detectar divergência. |
| DATA-004 | Dados | "Logs e traces não contêm PHI que viole a HIPAA" | Compliance | Catastrófico: violação de HIPAA, exposição de dados de pacientes | Auditoria de logs: buscar padrões de PHI (nomes, datas de nascimento, MRNs) | Assumida | Implementar log sanitization middleware urgentemente. |
| DATA-005 | Dados | "O volume de dados de pacientes ficará dentro dos limites de capacidade de armazenamento planejados" | Infra | Alto: armazenamento esgotado, perda de writes, falha de serviço | Projetar crescimento baseado em admissões/dia esperadas × tamanho médio de registro | Assumida | Política de retenção com archival automático. |
| DATA-006 | Dados | "Dados usados para treinar ou calibrar modelos de AI são representativos do uso real hospitalar" | AI | Alto: modelo viés, performando mal para casos reais | Análise de distribuição de dados de treino vs. dados de produção | Assumida | Monitoramento de drift de dados. Retreino periódico. |

---

## Categoria 5 — Suposições de Latência

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| LAT-001 | Latência | "A latência de chamada ao Anthropic API é aceitável para uso clínico em tempo real (< 3 segundos p95)" | Produto | Alto: UX degradada, profissionais abandonam a ferramenta por lentidão | Medir latência real p50/p95/p99 com carga representativa | Assumida | Cache de respostas frequentes. Streaming de resposta com UI de indicador de progresso. |
| LAT-002 | Latência | "A latência interna entre serviços via NATS é < 100ms p99" | Backend | Médio: degradação de fluxos que dependem de múltiplos eventos sequenciais | Instrumentar com OTel e medir latência de processamento NATS | Assumida | Timeout por etapa com fallback definido. |
| LAT-003 | Latência | "Queries PostgreSQL críticas completam em < 50ms p95" | Backend | Alto: timeout de requests, degradação de serviços clínicos | Habilitar `pg_stat_statements`. Medir queries lentas em carga realista. | Assumida | Índices adequados. Query timeout com fallback. Read replicas para queries pesadas. |
| LAT-004 | Latência | "O frontend carrega em < 3 segundos em dispositivos de nível hospitalar (tablets, estações antigas)" | Frontend | Alto: abandono de ferramenta por lentidão em dispositivos reais | Testar em dispositivos reais do hospital com conexão de rede hospitalar | Assumida | Otimização de bundle. Code splitting. Service worker para cache. |

---

## Categoria 6 — Suposições de Volume

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| VOL-001 | Volume | "O hospital-alvo tem entre 50 e 500 pacientes ativos simultaneamente — dimensionamento baseado neste range" | Produto | Alto: subdimensionamento (sistema sobrecarregado) ou superdimensionamento (custo desnecessário) | Validar capacidade real do hospital-alvo. Definir range concreto. | Assumida | Autoscaling com KEDA. Load testing antes do go-live. |
| VOL-002 | Volume | "O volume de eventos NATS não excederá 10.000 eventos/minuto em operação normal" | Backend | Alto: NATS sobrecarregado, consumer lag crescente | Load test com volume de 2x o máximo esperado | Assumida | Aumentar capacidade de NATS. Batching de eventos de baixa prioridade. |
| VOL-003 | Volume | "Cada discharge-orchestrator workflow executa em média 5 atividades — dimensionamento do Temporal baseado nisso" | Backend | Médio: workers Temporal subdimensionados para workflows mais complexos | Instrumentar workflows reais e medir número médio de atividades | Assumida | Aumentar `maxConcurrentActivityTaskExecutions`. |
| VOL-004 | Volume | "O número de usuários simultâneos da interface web não excederá 50 por hospital" | Frontend | Médio: degradação de performance do servidor Next.js em pico | Load test com 2x o número esperado de usuários simultâneos | Assumida | Horizontal scaling do pod Next.js. CDN para assets estáticos. |
| VOL-005 | Volume | "O tamanho médio de context window por requisição de AI não excederá 8.000 tokens" | AI | Alto: custo acima do planejado, latência elevada para contextos longos | Medir tamanho real de contextos em requests de produção | Assumida | Limite de tamanho de contexto no AI Gateway. Compressão de contexto. |

---

## Categoria 7 — Suposições de Ordem de Eventos

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| ORD-001 | Ordem | "Eventos NATS chegam em ordem cronológica para o mesmo paciente dentro de um subject" | Backend | Crítico: estado incorreto de paciente por processamento fora de ordem | Verificar garantias de ordering do NATS JetStream por subject | Assumida | Implementar event sourcing com sequence number por paciente. |
| ORD-002 | Ordem | "O serviço patient-flow-service sempre recebe o evento de admissão antes do evento de atualização" | Backend | Alto: update processado antes do create — estado inconsistente | Testar com envio proposital fora de ordem | Assumida | Idempotência com upsert. Evento de update cria paciente se não existe. |
| ORD-003 | Ordem | "Workflows Temporal executam steps em sequência determinística" | Backend | Alto: steps executados em paralelo quando deveriam ser sequenciais, ou vice-versa | Revisar definição de workflows para garantir sequenciamento correto | Assumida | Testes de workflow com verificação de ordem de execução. |
| ORD-004 | Ordem | "Mudanças de configuração no Kubernetes são aplicadas na ordem esperada (ConfigMap antes do Pod restart)" | DevOps | Médio: pod reinicia com configuração antiga, comportamento inesperado | Verificar se há dependências de ordem nos scripts de deploy | Assumida | Usar `kubectl rollout restart` após aplicar ConfigMaps. |

---

## Categoria 8 — Suposições de Disponibilidade

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| AVAIL-001 | Disponibilidade | "O ambiente kind-velya-local estará disponível durante o horário de desenvolvimento (08h-20h)" | DevOps | Médio: perda de produtividade por indisponibilidade do ambiente local | Monitorar uptime do ambiente. Alert automático se cluster unreachable. | Assumida | Procedimento de recovery documentado e testado. |
| AVAIL-002 | Disponibilidade | "A API Anthropic estará disponível em 99.9% do tempo durante horário clínico" | Produto | Crítico: features AI indisponíveis durante operação clínica real | Verificar SLA real da Anthropic. Implementar circuit breaker e modo degradado. | Assumida | Cache de respostas. Modelos locais como fallback. |
| AVAIL-003 | Disponibilidade | "O Medplum FHIR server estará disponível para consultas em tempo real durante operações clínicas" | Backend | Crítico: dados de pacientes indisponíveis durante atendimento | Verificar SLA do Medplum. Implementar cache de dados críticos de pacientes. | Assumida | Cache local de dados FHIR recentes. Modo offline com dados cached. |
| AVAIL-004 | Disponibilidade | "PostgreSQL terá disponibilidade de 99.9% em produção (EKS RDS Multi-AZ)" | Backend | Crítico: indisponibilidade total de dados operacionais | Verificar configuração RDS Multi-AZ. Testar failover automático. | Assumida | Read replicas para queries de leitura durante failover. |

---

## Categoria 9 — Suposições de Permissões

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| PERM-001 | Permissões | "ServiceAccounts dos serviços têm apenas as permissões mínimas necessárias (princípio de menor privilégio)" | Segurança | Alto: serviço comprometido tem acesso a recursos do cluster além do necessário | Auditar RBAC de cada ServiceAccount com `kubectl auth can-i --list` | Assumida | Auditoria completa de RBAC. Reduzir permissões ao mínimo. |
| PERM-002 | Permissões | "Apenas o pipeline CI/CD tem permissão para fazer push de imagens Docker para o registry" | Segurança | Alto: imagens não autorizadas no registry, supply chain attack | Verificar IAM policies do ECR/registry. Auditoria de push history. | Assumida | Signed images. Admission webhook que verifica assinatura. |
| PERM-003 | Permissões | "Agents têm acesso restrito às ferramentas mínimas necessárias para sua função" | Governança | Crítico: agent com acesso excessivo causa dano de larga escala | Auditar lista de ferramentas disponíveis por agent | Assumida | Implementar Tier de ferramentas por nível de risco. Aprovação para Tier 2+. |
| PERM-004 | Permissões | "O banco de dados não é acessível diretamente a partir do frontend ou da internet" | Segurança | Catastrófico: acesso direto ao banco a partir da internet | Verificar security groups / NetworkPolicy entre frontend e database | Assumida | Verificar e documentar arquitetura de rede. |

---

## Categoria 10 — Suposições de Consistência

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| CONS-001 | Consistência | "Dados de pacientes no PostgreSQL são consistentes com o estado no Medplum/FHIR em t+30 segundos (consistência eventual)" | Backend | Alto: decisões clínicas baseadas em dados divergentes | Implementar job de reconciliação. Medir lag de sincronização. | Assumida | Indicador visual de freshness dos dados na UI. |
| CONS-002 | Consistência | "A memória compartilhada entre agents reflete o estado mais recente do sistema" | AI | Alto: agent tomando decisão baseado em estado desatualizado do sistema | Implementar TTL na memória. Validar freshness antes de usar dado de memória. | Assumida | Fallback para dados diretos do banco quando memória é stale. |
| CONS-003 | Consistência | "Eventos publicados no NATS são entregues exatamente uma vez para cada consumer" | Backend | Alto: duplicatas causam ações duplicadas (ex: alta duplicada de paciente) | Verificar configuração de QoS do NATS JetStream (at-least-once vs. exactly-once) | Assumida | Idempotência em todos os consumers. Deduplication key por evento. |
| CONS-004 | Consistência | "Configurações do Kubernetes (ConfigMaps, Secrets) estão sincronizadas entre todos os nós do cluster" | DevOps | Médio: pods em nós diferentes com configurações divergentes | Verificar consistência de configuração entre nós após deploy | Assumida | Rollout restart após mudança de configuração. |

---

## Categoria 11 — Suposições Regulatórias

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| REG-001 | Regulatória | "A plataforma Velya está no escopo da HIPAA e precisa de conformidade total antes de processar dados reais de pacientes" | Compliance | Catastrófico: multa HIPAA de $100-$50.000 por violação, até $1.9M/ano | Esta suposição deve ser tratada como VERDADEIRA por default. Validar com assessor jurídico. | Assumida | Operação apenas com dados sintéticos até conformidade confirmada. |
| REG-002 | Regulatória | "Um Business Associate Agreement com Anthropic é necessário antes de enviar PHI para a API" | Compliance | Catastrófico: violação de HIPAA, exposição de PHI a terceiro sem BAA | Verificar termos de serviço Anthropic. Solicitar BAA formalmente. | Assumida | Usar apenas dados sintéticos até BAA firmado. |
| REG-003 | Regulatória | "Registros médicos precisam ser retidos por pelo menos 7 anos (federal) ou mais conforme estado" | Compliance | Alto: descarte prematuro de dados obrigatórios, risco legal | Verificar requisitos por estado e federal. Implementar política de retenção. | Assumida | Retenção conservadora de 10 anos até validação legal. |
| REG-004 | Regulatória | "A plataforma como Software as a Medical Device (SaMD) pode requerer aprovação da FDA (21 CFR Part 11)" | Compliance | Catastrófico: operar SaMD sem aprovação FDA é ilegal | Consulta jurídica especializada em regulação de AI médica | Assumida | Não lançar como SaMD até análise regulatória concluída. |
| REG-005 | Regulatória | "Regras de privacidade estaduais (CCPA, etc.) se aplicam além da HIPAA federal" | Compliance | Alto: violação de lei estadual além da HIPAA | Verificar jurisdição de operação e leis estaduais aplicáveis | Assumida | Aplicar controles mais restritivos até validação legal. |

---

## Categoria 12 — Suposições de Custo

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| COST-001 | Custo | "O custo mensal de inferência AI ficará dentro do budget planejado com o volume de uso esperado" | Produto | Alto: custo AI muito maior que o projetado compromete viabilidade | Calcular custo estimado baseado em volume × tokens médios × preço por token | Assumida | Budget cap no AI Gateway. Alertas de custo em 50%/80%/100% do budget. |
| COST-002 | Custo | "O custo de infraestrutura EKS em produção será prevísivel e controlável" | Produto | Alto: custo de cloud excede receita, inviabilizando o modelo de negócio | Usar AWS Cost Calculator para projetar custo com especificações definidas | Assumida | AWS Budgets com kill switch. Revisão mensal de custo vs. budget. |
| COST-003 | Custo | "Não haverá explosão de custo por KEDA thrash ou runaway workloads antes de ir a produção" | DevOps | Alto: custo inesperado de instâncias EKS por scaling descontrolado | Testar KEDA com cargas artificiais no ambiente local antes de produção | Assumida | maxReplicaCount em todos os ScaledObjects. Alerta de scaling events. |

---

## Categoria 13 — Suposições sobre Comportamento de Agents

| ID | Categoria | Declaração da Suposição | Dono | Risco se Errada | Método de Validação | Status | Fallback |
|---|---|---|---|---|---|---|---|
| AGENT-001 | Comportamento de Agents | "Agents seguem as regras em `.claude/rules/` de forma consistente em todos os contextos" | Governança | Crítico: agent ignorando regras de segurança ou governança por contexto específico | Testar agents com prompts adversariais que tentam contornar regras | Assumida | Validators independentes verificam saídas. Regras como checklist verificável. |
| AGENT-002 | Comportamento de Agents | "Agents vão escalar para revisão humana quando incertos, em vez de agir com baixa confiança" | Governança | Crítico: agent agindo com alta incerteza causa dano ao sistema | Testar com cenários de alta ambiguidade. Verificar se escalação é acionada. | Assumida | Threshold de confiança obrigatório. Ação bloqueada abaixo de threshold. |
| AGENT-003 | Comportamento de Agents | "O coordinator agent distribui trabalho de forma equitativa e eficiente entre agents disponíveis" | Governança | Médio: trabalho concentrado em um agent, outros ociosos, gargalo | Monitorar distribuição de tasks por agent. Alerta de concentração. | Assumida | Load balancing explícito de tasks pelo coordinator. |
| AGENT-004 | Comportamento de Agents | "Agents não entram em loop de autocorreção indefinido sem escalação" | Governança | Alto: agent consumindo recursos e créditos de AI em loop | Implementar limite de tentativas de autocorreção por task. Escalação obrigatória após N tentativas. | Assumida | Circuit breaker por agent ID. Kill switch por categoria de ação. |
| AGENT-005 | Comportamento de Agents | "A memória de agents não contém PHI que não deveria ser persistido" | Compliance | Catastrófico: PHI persistido no memory-service sem controle de retenção | Auditar conteúdo da memória de agents. Implementar filtro de PHI na escrita. | Assumida | Proibir PHI na memória de agents. Usar referências (patient_id) em vez de dados. |
| AGENT-006 | Comportamento de Agents | "Agents que criam PRs automáticos incluem contexto suficiente para revisão humana eficaz" | Governança | Alto: PRs de agents aprovados sem entendimento real do impacto | Revisar PRs gerados por agents. Definir template mínimo obrigatório. | Assumida | Template obrigatório de PR com seção de impacto e plano de rollback. |
| AGENT-007 | Comportamento de Agents | "A saída de um agent é determinística o suficiente para ser testada e auditada" | Governança | Alto: comportamento não-determinístico dificulta auditoria e debugging | Testar agents múltiplas vezes com mesmo input. Medir variância de output. | Assumida | Usar temperature=0 para agents com saídas críticas. Log completo de cada execução. |

---

## Resumo do Registro de Suposições

| Categoria | Total | Validadas | Em Validação | Assumidas | Invalidadas |
|---|---|---|---|---|---|
| Suposições Invalidadas (seção especial) | 6 | 0 | 0 | 0 | 6 |
| Técnicas | 13 | 0 | 0 | 13 | 0 |
| Operacionais | 7 | 0 | 0 | 7 | 0 |
| Humanas | 6 | 0 | 0 | 6 | 0 |
| Dados | 6 | 0 | 0 | 6 | 0 |
| Latência | 4 | 0 | 0 | 4 | 0 |
| Volume | 5 | 0 | 0 | 5 | 0 |
| Ordem de Eventos | 4 | 0 | 0 | 4 | 0 |
| Disponibilidade | 4 | 0 | 0 | 4 | 0 |
| Permissões | 4 | 0 | 0 | 4 | 0 |
| Consistência | 4 | 0 | 0 | 4 | 0 |
| Regulatórias | 5 | 0 | 0 | 5 | 0 |
| Custo | 3 | 0 | 0 | 3 | 0 |
| Comportamento de Agents | 7 | 0 | 0 | 7 | 0 |
| **TOTAL** | **78** | **0** | **0** | **72** | **6** |

> **Nota crítica**: Zero suposições validadas. A maioria das suposições nunca foi testada explicitamente. Este é um risco sistêmico — o sistema opera sobre fundamentos não verificados. A prioridade imediata é validar as suposições de severidade Catastrófica e Crítica antes de qualquer uso com dados reais de pacientes.
