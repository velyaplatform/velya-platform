# Catálogo de Falhas Silenciosas — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Observabilidade e Arquitetura  
> **Propósito**: Catalogar falhas que ocorrem sem gerar alerta visível, sem erro explícito no log, ou sem impacto imediato detectável — mas que acumulam dano ao longo do tempo.

---

## Definição

Uma **falha silenciosa** é qualquer condição onde:
1. O sistema (ou uma parte dele) não está funcionando corretamente, E
2. Nenhum alerta automático dispara, E
3. Nenhum log de erro visível é gerado, OU o erro existe mas ninguém está olhando

O aspecto mais perigoso de falhas silenciosas em ambiente hospitalar é que o dano pode acumular por horas ou dias antes de ser detectado — e a detecção pode acontecer apenas quando um paciente já foi afetado.

---

## Catálogo

### SF-001 — NetworkPolicy Definida Mas Não Enforçada

**Descrição**: As NetworkPolicies dos namespaces `velya-dev-*` estão definidas e aceitas pela API do Kubernetes, mas o CNI kindnet não as enforça. Qualquer pod pode se comunicar com qualquer outro pod no cluster.

**Como ocorre**: kindnet é o CNI padrão do kind e não implementa a API de NetworkPolicy. Os recursos existem no etcd mas são ignorados completamente em runtime.

**Janela de detecção**: Indefinida — nunca detectado automaticamente. Só descoberto por teste explícito ou análise da stack CNI.

**Impacto acumulado**: Todo o modelo de segurança de rede da plataforma é ilusório. Um pod comprometido tem acesso irrestrito a todos os outros pods, incluindo o banco de dados. PHI completamente exposto internamente.

**Detector necessário**: Script de validação de CNI que verifica se NetworkPolicies são enforçadas. Executar em setup do ambiente e periodicamente.

```bash
# Teste: pod em velya-dev-web consegue acessar postgres em velya-dev-core?
kubectl run test-pod --image=busybox -n velya-dev-web --rm -it -- wget -qO- http://postgres.velya-dev-core.svc.cluster.local:5432
# Se retornar qualquer coisa além de "connection refused" => NetworkPolicy NÃO está enforçada
```

---

### SF-002 — ArgoCD Instalado Sem Applications — GitOps Inoperante

**Descrição**: O ArgoCD está instalado e seu UI está acessível via port-forward. No entanto, há 0 Applications registradas. Nenhum sync é executado. O cluster diverge do Git silenciosamente.

**Como ocorre**: A instalação do ArgoCD foi concluída mas a configuração de Applications não foi feita. Do ponto de vista da UI, o sistema "está funcionando".

**Janela de detecção**: Indefinida — nenhum alerta dispara para "ArgoCD sem Applications". Só detectado por acesso à UI e observação direta.

**Impacto acumulado**: Mudanças no Git nunca chegam ao cluster. Mudanças manuais no cluster nunca são detectadas como drift. A promessa de GitOps (auditabilidade, reprodutibilidade) é nula.

**Detector necessário**:
```bash
# Verificar se há Applications configuradas
argocd app list 2>/dev/null | wc -l
# Se retornar 0 ou 1 (apenas header) => nenhuma Application configurada
```
Alerta: `argocd_app_info` métrica com count = 0.

---

### SF-003 — KEDA ScaledObject com Fonte Indisponível — Escala para Mínimo Sem Aviso

**Descrição**: Um ScaledObject que usa Prometheus como trigger não consegue coletar métricas (Prometheus indisponível ou ServiceMonitor ausente). O KEDA escala silenciosamente para `minReplicaCount` e mantém lá.

**Como ocorre**: Se o Prometheus está reiniciando, o ServiceMonitor não existe, ou a query PromQL retorna erro, o KEDA Operator registra um erro em seu log mas não propaga esse status de forma visível.

**Janela de detecção**: Pode durar horas. O serviço tem menos réplicas do que deveria para a carga atual. Latência aumenta gradualmente. Só detectado quando usuários reclamam ou alerta de latência dispara.

**Impacto acumulado**: Serviço operando abaixo da capacidade durante pico clínico. Latência elevada para clínicos durante período crítico.

**Detector necessário**:
```yaml
# Alerta Prometheus
- alert: KedaScaledObjectDegraded
  expr: |
    keda_scaler_active == 0 and
    kube_deployment_spec_replicas == keda_scaledobject_min_replica_count
  for: 15m
  annotations:
    summary: "ScaledObject {{ $labels.scaledObject }} no mínimo por 15 minutos"
```

---

### SF-004 — nginx-ingress Retornando 504 com Pod Saudável

**Descrição**: O pod do serviço está Running, o health check passa, mas o nginx-ingress retorna 504 para requests externos porque não consegue rotear para o pod sem a annotation `service-upstream: "true"`.

**Como ocorre**: Com `hostNetwork: true`, o nginx tenta acessar IPs de pods diretamente. Em kind, esses IPs não são roteáveis pelo nginx no host network. **Já ocorreu no ambiente Velya.**

**Janela de detecção**: Imediata para usuários (veem 504), mas pode durar horas sem diagnóstico correto porque o pod aparece saudável no Kubernetes.

**Impacto acumulado**: Serviço completamente inacessível externamente enquanto parece saudável internamente. Diagnóstico incorreto prolonga o incidente.

**Detector necessário**:
```bash
# Smoke test de disponibilidade externa após cada deploy
curl -s -o /dev/null -w "%{http_code}" http://velya.172.19.0.6.nip.io/api/health
# Resultado esperado: 200. Qualquer 5xx indica problema.
```
Alerta sintético: probe HTTP externo a cada 30 segundos.

---

### SF-005 — Consumer NATS Morto Sem Ack — Mensagens Reentregues Indefinidamente

**Descrição**: Um consumer NATS JetStream parou de fazer ack nas mensagens após falha interna. O NATS continua reentregando indefinidamente (até `maxDeliver`). O consumer processa e falha em loop.

**Como ocorre**: Bug no handler do consumer causa exceção não tratada. A exceção é capturada pelo SDK NATS mas sem ack, então a mensagem é reagendada. Sem dead-letter queue configurada, isso continua para sempre.

**Janela de detecção**: Pode durar horas. O log tem erros repetidos, mas se o log não é monitorado com alerta específico, passa despercebido. O consumer parece "ativo" (está processando) mas não está efetivamente funcionando.

**Impacto acumulado**: Recursos consumidos em reprocessamento inútil. Mensagens novas ficam atrás de uma fila de redeliveries. Latência de processamento de eventos novos aumenta.

**Detector necessário**: Monitorar `nats consumer info` e alertar se `num_redelivered / num_delivered > 0.10`.

---

### SF-006 — AI Context Construído com PHI Além do Mínimo Necessário

**Descrição**: O AI Gateway inclui campos de PHI no contexto (data de nascimento, endereço, histórico completo) quando apenas o diagnóstico atual seria suficiente para a função solicitada. Violação do princípio de minimum necessary da HIPAA.

**Como ocorre**: O código que constrói o contexto de AI inclui o objeto Patient completo por conveniência, sem analisar quais campos são realmente necessários para cada tipo de prompt.

**Janela de detecção**: Nunca — sem auditoria de contexto, essa violação ocorre silenciosamente em cada request de AI com dados de paciente.

**Impacto acumulado**: PHI desnecessário enviado ao provider Anthropic em cada requisição. Superfície de exposição ampliada. Custo adicional de tokens. Risco aumentado em caso de breach.

**Detector necessário**: Auditoria de código do AI Gateway. Classificação de campos PHI por necessidade por tipo de prompt. Logging do tamanho e campos de contexto (sem valores PHI).

---

### SF-007 — Alerta Prometheus Definido Mas Não Roteado Para Nenhum Contato

**Descrição**: Os alertas `VelyaServiceDown` e `VelyaHighCPU` estão configurados nos PrometheusRules e aparecem como FIRING no Prometheus UI, mas o Alertmanager não tem receivers configurados. Nenhuma notificação é enviada.

**Como ocorre**: PrometheusRules foram criadas mas a configuração do Alertmanager (receivers, routing) não foi completada.

**Janela de detecção**: Indefinida — o alerta está disparando mas ninguém sabe. Descoberto apenas quando alguém acessa o Prometheus UI proativamente ou quando o incidente é detectado por outro meio.

**Impacto acumulado**: Todo o investimento em alertas é nulo. Incidentes não são detectados automaticamente. O time opera sem safety net de monitoramento.

**Detector necessário**:
```bash
# Verificar se Alertmanager tem receivers configurados
kubectl get secret alertmanager-config -n velya-dev-observability -o jsonpath='{.data.alertmanager\.yaml}' | base64 -d | grep -c "receivers"
# Se retornar 0 ou apenas receiver de fallback => alertas não chegam a ninguém
```

---

### SF-008 — ServiceMonitor Ausente — Serviço Não Scrapeado, Parece Healthy

**Descrição**: patient-flow-service, task-inbox-service, discharge-orchestrator e outros serviços Velya não têm ServiceMonitor configurado. Prometheus não coleta métricas deles. No kube-state-metrics, o pod aparece como Running e ready.

**Como ocorre**: ServiceMonitors precisam ser criados explicitamente para cada serviço. Sem eles, o Prometheus não sabe que deve coletar métricas de determinados serviços.

**Janela de detecção**: Indefinida — o Grafana não mostra dados desses serviços mas um operador pode confundir "no data" com "dados OK".

**Impacto acumulado**: Zero visibilidade de métricas de aplicação (request rate, error rate, latência) para os serviços clínicos mais críticos. Degradação de serviço não é detectada até impacto no usuário.

**Detector necessário**: Validar que todo serviço em `velya-dev-*` tem um ServiceMonitor correspondente no CI.

---

### SF-009 — Backup Nunca Executado — DR Acredita Ter Cobertura

**Descrição**: Não há evidência de que algum backup automático de PostgreSQL, NATS streams ou estado do cluster foi executado e verificado.

**Como ocorre**: O planejamento de DR foi discutido mas a implementação não foi executada. Em ausência de evidência contrária, a suposição é de que há algum backup.

**Janela de detecção**: Descoberta apenas no momento em que o restore é necessário — ou seja, quando um desastre ocorre. Neste momento, é tarde demais.

**Impacto acumulado**: Zero capacidade real de disaster recovery. Em caso de falha de cluster ou corrupção de dados, todos os dados de pacientes seriam perdidos permanentemente.

**Detector necessário**: Job de backup com verificação de integridade que falha visivelmente se não executar. Alerta se o último backup bem-sucedido foi há mais de 24 horas.

---

### SF-010 — Frontend Mostrando Dado Stale Como Atual

**Descrição**: O Next.js/React não tem invalidação de cache configurada. Dados buscados há horas são apresentados ao usuário sem indicação de que podem estar desatualizados.

**Como ocorre**: React Query ou SWR sem `staleTime` e `refetchInterval` adequados. Dados ficam em cache local do browser sem revalidação.

**Janela de detecção**: Variável — o usuário pode notar que os dados estão errados quando compara com outra fonte (prontuário físico, conversa com colega). Pode levar horas.

**Impacto acumulado**: Decisão clínica baseada em estado desatualizado de paciente. Por exemplo: status de exame atualizado mas clínico vê resultado antigo e toma decisão com base nele.

**Detector necessário**: Implementar timestamp de "última atualização" visível para todos os dados críticos. Indicador visual de "dado possivelmente desatualizado" após X minutos sem revalidação.

---

### SF-011 — Agent em Loop de Autocorreção Sem Escalação

**Descrição**: Um agent tenta executar uma tarefa, falha, tenta se corrigir, falha novamente, em um loop sem limite de iterações e sem escalação para humano.

**Como ocorre**: Sem limite de tentativas de autocorreção e sem threshold de escalação, o agent continua tentando indefinidamente.

**Janela de detecção**: Pode durar horas. O agent está "ativo" (consumindo tokens, criando traces), mas não está produzindo saída útil. Descoberto quando alguém verifica o status da task manualmente.

**Impacto acumulado**: Custo de inferência AI crescendo sem produzir valor. Task bloqueada sem resolução. Outros trabalhos não iniciados porque o agent está preso.

**Detector necessário**: Limite de N tentativas por task. Escalação automática após limite atingido. Alerta se agent fica ativo em mesma task por mais de 30 minutos.

---

### SF-012 — Validator Aprovando Sem Ler Evidência

**Descrição**: Um agent validator aprova outputs de outros agents sem verificar adequadamente a evidência. A governança de qualidade é um carimbo, não uma verificação real.

**Como ocorre**: Sem checklist obrigatório de validação e sem auditoria de qualidade dos validators, um validator pode simplesmente aprovar para manter throughput.

**Janela de detecção**: Nunca detectado automaticamente. Só revelado por auditoria manual de amostras de outputs aprovados.

**Impacto acumulado**: Erros de agents chegam ao ambiente produtivo. Código incorreto é mergeado. Dados incorretos são processados. A camada de qualidade não existe efetivamente.

**Detector necessário**: Auditoria aleatória de 10% dos outputs aprovados por validators. Taxa de aprovação monitorada — alerta se > 95% por período.

---

### SF-013 — Serviço NestJS Logando PHI em Request Bodies

**Descrição**: Serviços NestJS com interceptors de logging que capturam request e response bodies estão logando dados de pacientes em texto plano no Loki.

**Como ocorre**: Interceptor genérico de logging adicionado para debug/observabilidade captura todos os campos do request sem sanitização.

**Janela de detecção**: Nunca — os logs existem e estão sendo armazenados. Só detectado por auditoria de logs ou em caso de violação HIPAA.

**Impacto acumulado**: PHI persistido indefinidamente em sistema de logs sem controle de acesso adequado. Violação HIPAA em curso.

**Detector necessário**: Scanner automático de logs que detecta padrões de PHI (nomes, datas, MRNs). Alerta imediato se PHI detectado em logs.

---

### SF-014 — Prometheus Alert Firing Mas Threshold Muito Alto Para Ser Útil

**Descrição**: Alertas configurados com thresholds tão conservadores que só disparam quando o problema já é grave demais. Por exemplo: alerta de CPU apenas quando > 95% por 10 minutos.

**Como ocorre**: Thresholds definidos sem baseline de uso normal. Medo de alertas ruidosos leva a thresholds excessivamente permissivos.

**Janela de detecção**: O alerta dispara apenas quando o sistema já está em crise. Oportunidade de intervenção precoce perdida.

**Impacto acumulado**: Sem alerta precoce, incidentes são descobertos apenas quando o impacto é máximo. MTTR (Mean Time To Restore) aumenta.

**Detector necessário**: Revisão de thresholds de todos os alertas. Adicionar alertas de warning (70%) além de alertas de critical (90%).

---

### SF-015 — Memory Service Acumulando Dados PHI Sem TTL

**Descrição**: O memory-service armazena contexto de interações de agents sem política de expiração. Memórias com PHI crescem indefinidamente.

**Como ocorre**: Implementação inicial sem política de lifecycle de memória.

**Janela de detecção**: Nunca — sem auditoria de conteúdo da memória, o PHI acumula silenciosamente.

**Impacto acumulado**: PHI persistido além do período necessário. Violação HIPAA de retenção. Crescimento de storage sem limite.

**Detector necessário**: Auditoria periódica de conteúdo da memória. TTL obrigatório por tipo de memória. Purge automático de PHI após período definido.

---

### SF-016 — Feature Flag Ativa em Produção Sem Dono

**Descrição**: Feature flags habilitadas sem definição de quem é o dono, qual é o critério de remoção, e qual é a data de expiração.

**Como ocorre**: Prática comum de adicionar feature flags sem processo de lifecycle.

**Janela de detecção**: Indefinida — flags "zumbi" existem indefinidamente até alguém perceber ou causarem conflito.

**Impacto acumulado**: Complexidade de código acumulada. Comportamentos condicionais sem documentação. Risco de ativar inadvertidamente uma flag antiga com efeito colateral desconhecido.

**Detector necessário**: Registro de feature flags com dono e data de expiração. Alerta para flags sem atualização há mais de 30 dias.

---

### SF-017 — Traces com 100% Sampling em Volume Alto

**Descrição**: OTel Collector configurado para samplear 100% dos traces. Com volume real de produção, o armazenamento de traces explode e o Tempo/Jaeger OOMKill.

**Como ocorre**: Configuração padrão de desenvolvimento mantida em produção.

**Janela de detecção**: Detectado quando storage do Tempo/Jaeger esgota ou o pod OOMKill.

**Impacto acumulado**: Custo de armazenamento crescendo. Eventually o sistema de traces fica indisponível, perdendo observabilidade.

**Detector necessário**: Monitorar volume de traces por hora. Alerta se cresce acima de taxa esperada. Configurar tail-based sampling antes de go-live.

---

### SF-018 — Drift Entre Documentação de Arquitetura e Realidade do Cluster

**Descrição**: A documentação de arquitetura descreve o estado desejado, mas o cluster real tem configurações diferentes. Novos membros da equipe tomam decisões baseadas em documentação incorreta.

**Como ocorre**: Documentação criada antes da implementação. Implementação diverge sem atualizar a documentação.

**Janela de detecção**: Detectado quando um engenheiro age com base na documentação e descobre que a realidade é diferente.

**Impacto acumulado**: Decisões incorretas baseadas em arquitetura desatualizada. Onboarding lento e errado. Troubleshooting mais difícil.

**Detector necessário**: Processo de "architecture review" trimestral. Documentação marcada com estado: Planejado / Em Implementação / Implementado / Desatualizado.

---

### SF-019 — Prettier Corrompendo Templates Helm em CI

**Descrição**: O Prettier configurado para formatar YAML pode transformar `{{` em `{ {` em templates Helm, quebrando todos os charts. **Já ocorreu no projeto Velya.**

**Como ocorre**: Prettier sem `.prettierignore` adequado processa arquivos `*.yaml` em `charts/`, corrompendo a sintaxe de template Helm.

**Janela de detecção**: Detectado na próxima tentativa de `helm template` ou `helm install` após o commit do Prettier.

**Impacto acumulado**: Todos os charts Helm quebrados após a formatação. Deploy impossível até correção manual.

**Detector necessário**: `helm lint` obrigatório no CI para todos os charts. `.prettierignore` cobrindo `charts/**/*.yaml`.

---

### SF-020 — NATS Stream Atingindo max_bytes com Discard Silencioso de Eventos Clínicos

**Descrição**: Uma stream NATS com `discard=old` e `max_bytes` insuficiente descarta eventos antigos silenciosamente para acomodar novos. Eventos clínicos importantes são perdidos permanentemente.

**Como ocorre**: A stream foi dimensionada sem considerar o volume real de eventos. Cresce até o limite e começa a descartar.

**Janela de detecção**: Pode durar dias. Consumers procuram eventos que não existem mais. A inconsistência de estado é descoberta apenas quando um fluxo clínico está com dados faltantes.

**Impacto acumulado**: Histórico de eventos de pacientes incompleto. Workflows que dependem de sequência de eventos operam com dados parciais. Decisões clínicas baseadas em contexto incompleto.

**Detector necessário**: Alerta quando stream atinge 70% de `max_bytes`. Monitorar `nats_stream_num_deleted` — crescimento indica descarte ativo.

---

### SF-021 — ArgoCD Application em OutOfSync Sem Notificação

**Descrição**: Uma Application do ArgoCD entra em OutOfSync (cluster divergiu do Git) mas nenhuma notificação é enviada. O time não sabe que o cluster está dessincronizado.

**Como ocorre**: Notificações do ArgoCD não estão configuradas. O status OutOfSync existe na UI mas ninguém está olhando.

**Janela de detecção**: Indefinida — descoberto apenas na próxima vez que alguém acessa a UI do ArgoCD ou quando uma mudança de comportamento é notada em produção.

**Impacto acumulado**: Cluster diverge do Git progressivamente. Mudanças importantes não estão aplicadas. Estado de produção desconhecido.

**Detector necessário**: Notificação Slack imediata quando Application fica OutOfSync por mais de 5 minutos.

---

### SF-022 — Pod com readinessProbe Passando Mas Logica Interna Quebrada

**Descrição**: O readinessProbe faz GET `/health` que retorna 200, mas internamente o serviço tem uma dependência quebrada (ex: worker NATS desconectado, fila de processamento parada).

**Como ocorre**: Health check superficial que não verifica dependências reais.

**Janela de detecção**: O serviço recebe tráfego (está "ready") mas falha em processar. Usuários recebem erros. Detectado por alert de error rate ou por reclamação de usuários.

**Impacto acumulado**: Tráfego roteado para instâncias que não conseguem processar. Error rate eleva. Experiência do usuário degradada sem diagnóstico imediato.

**Detector necessário**: Implementar readinessProbe que verifica dependências críticas reais (DB ping, NATS connection status, worker queue health).

---

### SF-023 — Version Bump Automático Introduzindo Breaking Change

**Descrição**: O workflow `version-bump.yml` faz bump de versão de dependências automaticamente. Uma nova versão de uma biblioteca introduz breaking change. O CI passa porque os testes têm cobertura próxima de zero.

**Como ocorre**: Dependência de terceiro publica nova versão com breaking change. O bump automático atualiza, os testes insuficientes não capturam, e o PR é mergeado.

**Janela de detecção**: Detectado em produção quando o comportamento quebrado é ativado (pode ser em feature específica com uso baixo).

**Impacto acumulado**: Regressão silenciosa em produção. Com cobertura de testes próxima de zero, o risco de breaking changes não detectados é muito alto.

**Detector necessário**: Testes de integração mínimos. Contract tests para APIs críticas. Review manual obrigatório de `CHANGELOG` de dependências com bump maior ou menor.

---

### SF-024 — Rotação de Secrets Sem Atualização de Pods

**Descrição**: Um Kubernetes Secret é atualizado (nova API key), mas os pods já em execução têm a versão antiga montada via envFrom. Os pods continuam usando a chave antiga até o próximo restart.

**Como ocorre**: Comportamento padrão do Kubernetes — variáveis de ambiente de Secrets não são atualizadas em pods existentes.

**Janela de detecção**: Detectado quando a chave antiga expira ou é revogada e os pods começam a falhar com erros de autenticação.

**Impacto acumulado**: Falha em cascata de serviços que dependem da chave rotacionada, sem diagnóstico imediato.

**Detector necessário**: Processo de rotação que inclui `kubectl rollout restart` para todos os deployments que usam o secret. Ou usar External Secrets Operator com reload automático.

---

### SF-025 — Consumer NATS Ativo Mas Sem Throughput Real

**Descrição**: O consumer NATS está conectado e registrado, mas por algum motivo não está fazendo `next()` para buscar novas mensagens. Mensagens acumulam sem ser processadas.

**Como ocorre**: Bug de async/await onde o consumer fica preso aguardando uma Promise que nunca resolve. O consumer está "vivo" mas parado.

**Janela de detecção**: Detectado quando consumer lag aumenta enquanto o pod está Running e sem erros aparentes.

**Impacto acumulado**: Consumer lag cresce indefinidamente. Eventos recentes não são processados. Estado do sistema atrasa progressivamente.

**Detector necessário**: Monitorar consumer lag separado de status do pod. Um pod Running com consumer lag crescente indica este problema.

---

### SF-026 — Prometheus sem Alerta para Própria Saúde

**Descrição**: O Prometheus monitora todos os serviços, mas não há alerta externo que monitore se o próprio Prometheus está saudável.

**Como ocorre**: Configuração incompleta de monitoramento — quem monitora o monitor?

**Janela de detecção**: Detectado quando alguém nota que o Grafana não tem dados. O Prometheus pode estar down por horas sem que nenhum alerta dispare (porque o Prometheus está down).

**Impacto acumulado**: Perda completa de observabilidade sem detecção automática. Incidentes não são detectados durante o downtime do Prometheus.

**Detector necessário**: Alerta externo ao Prometheus — probe sintético que verifica se o endpoint `/metrics` do Prometheus está respondendo.

---

### SF-027 — Loki Sem Alertas de Crescimento de Storage

**Descrição**: O Loki armazena logs sem política de retenção configurada. Storage cresce indefinidamente até esgotamento.

**Como ocorre**: Configuração padrão do Loki sem retenção.

**Janela de detecção**: Detectado quando o storage do Loki esgota e começa a recusar writes. Primeiro sinal: logs param de aparecer no Grafana.

**Impacto acumulado**: Perda de logs após esgotamento. Custo crescente de armazenamento. Em cluster local, pode afetar outros componentes que compartilham storage.

**Detector necessário**: Alerta em 70% de uso de storage do Loki. Configurar `retention_period` no Loki.

---

### SF-028 — Frontend Sem Error Boundary — Crash Silencioso de Componente

**Descrição**: Um erro de JavaScript em um componente React causa unmount silencioso do componente sem mensagem de erro ao usuário. A UI fica parcialmente quebrada — algumas seções desaparecem ou mostram estado em branco.

**Como ocorre**: Sem `<ErrorBoundary>` ao redor de componentes, erros de render propagam até o root e podem desmontar a aplicação inteira.

**Janela de detecção**: O usuário vê UI parcialmente quebrada. Pode levar tempo para reportar se o problema parece ser "lentidão" ou "bug visual".

**Impacto acumulado**: Clínico operando com UI incompleta sem saber. Dados críticos que deveriam aparecer não aparecem.

**Detector necessário**: Implementar `<ErrorBoundary>` em todos os componentes críticos. Integrar Sentry para capturar erros de React não tratados.

---

### SF-029 — Agent Criando Tasks Sem Prioridade Clara — Backlog Silenciosamente Crescendo

**Descrição**: Agents criam tarefas no backlog sem prioridade adequada. O backlog cresce indefinidamente sem curadoria humana.

**Como ocorre**: Agents têm permissão de criar tasks sem limite de taxa e sem restrição de prioridade.

**Janela de detecção**: Detectado quando alguém revisa o backlog e encontra centenas de tasks criadas por agents sem contexto humano.

**Impacto acumulado**: Trabalho humano real se perde no ruído de tasks de agents. Prioridades incorretas levam a trabalho errado sendo feito primeiro.

**Detector necessário**: Limite de taxa de criação de tasks por agent por hora. Alerta se backlog de agent-tasks crescer acima de threshold sem curadoria humana.

---

### SF-030 — Drift de Configuração Entre Namespaces Velya

**Descrição**: Configurações que deveriam ser consistentes entre namespaces `velya-dev-*` (ex: image pull secrets, resource quotas, network policies) divergem silenciosamente.

**Como ocorre**: Configurações aplicadas manualmente a um namespace e esquecidas nos demais. Sem GitOps funcionando, não há enforcement de consistência.

**Janela de detecção**: Detectado quando um serviço falha em um namespace mas funciona em outro por razão de configuração diferente.

**Impacto acumulado**: Comportamento inconsistente entre ambientes. Debugging difícil por inconsistência de configuração.

**Detector necessário**: Script de validação de consistência entre namespaces. Executar após cada mudança de configuração. ArgoCD com ApplicationSet para configurações compartilhadas.

---

## Resumo por Tempo de Detecção

| Janela de Detecção | Falhas Silenciosas | IDs |
|---|---|---|
| Nunca (requer auditoria explícita) | 8 | SF-001, SF-002, SF-007, SF-013, SF-015, SF-016, SF-021, SF-023 |
| Indefinida (até alguém olhar) | 10 | SF-006, SF-008, SF-009, SF-012, SF-017, SF-018, SF-020, SF-025, SF-029, SF-030 |
| Horas | 7 | SF-003, SF-005, SF-011, SF-019, SF-022, SF-026, SF-027 |
| Minutos (detectado por usuário) | 5 | SF-004, SF-010, SF-014, SF-024, SF-028 |

> **Prioridade de instrumentação**: As 18 falhas silenciosas com janela de detecção "Nunca" ou "Indefinida" são as mais urgentes — podem estar ocorrendo agora sem que ninguém saiba.
