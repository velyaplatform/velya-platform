# O Que Velya Deve Fazer Melhor Que o Mercado

## Propósito

Os nove fornecedores analisados (Tasy, MV, Pixeon, TOTVS, Oracle Health, TrakCare, Epic, MEDITECH Expanse, Dedalus) dominam o mercado há décadas. Competir em **paridade** com eles é necessário mas não é suficiente. Velya precisa **ganhar** em vetores onde o mercado inteiro tem lacunas sistêmicas.

Este documento lista os **dez vetores de superioridade** do Velya, o que o mercado entrega hoje em cada um (tipicamente pouco ou mal), e o que o Velya deve entregar para **vencer**, não apenas empatar.

Estes dez vetores formam a **narrativa competitiva** e a **direção de produto** do Velya.

---

## 1. Patient Journey Realmente Operacional

### O Problema

Todos os nove fornecedores **falam** de Patient Journey. Philips Tasy tem "Patient Journey" como módulo; TOTVS comunica "jornada 100% digital"; Epic tem Care Everywhere; Oracle tem "clinically driven workflows"; Dedalus tem pathways.

**Nenhum deles entrega, de fato, uma timeline unificada que integre simultaneamente:**

- Clínico — evoluções, prescrições, resultados, diagnósticos
- Operacional — leito, transferências, ADT, atrasos, handoffs
- Financeiro — autorizações, charges, glosa, cobrança
- Conforto — dor, medo, qualidade do sono, alimentação
- Comunicação — chamadas de campainha, tempos de resposta, mensagens
- Handoffs — passagens de turno, transferências entre setores, alta

O que existe nos concorrentes são **múltiplas abas separadas** ou **múltiplas telas desconectadas**, cada uma mostrando um aspecto. O profissional precisa mentalmente correlacionar eventos de abas diferentes para entender a jornada real do paciente.

### O Que Velya Entrega

**Timeline unificada como conceito de primeira classe**, persistida como stream de eventos imutáveis, visualizada como eixo temporal navegável, filtrada por ator (médico vê o que importa para médico, enfermagem vê o que importa para enfermagem, gestor vê o que importa para gestão), com **milestones observáveis**, **SLAs medidos** e **anomalias destacadas**.

**Sem abas. Sem telas separadas. Uma única linha do tempo onde tudo que aconteceu com o paciente é visível.**

### Por Que Vencemos

Nenhum concorrente tem arquitetura de eventos de primeira classe. Todos são DB-centric, o que impede a timeline unificada real. Velya nasce event-first — a timeline é o subproduto natural da arquitetura.

---

## 2. Auditoria Radical com Hash Chain

### O Problema

Todos os nove fornecedores têm **log de auditoria**. Mas em todos, o log é:

- Armazenado no mesmo DB do sistema
- Editável por administradores internos
- Sem prova criptográfica de integridade
- Sem proveniência de cada alteração
- Sem exportação forense estruturada

Em um processo judicial ou auditoria regulatória, o log Epic/Cerner/MV é "aceito" porque o sistema é grande, não porque há prova matemática de integridade.

### O Que Velya Entrega

**Hash chain** em cada evento crítico: cada operação que afeta dados clínicos ou financeiros é encadeada criptograficamente com a anterior (Merkle-tree-like). Qualquer tentativa de alteração posterior invalida a cadeia inteira.

**Proveniência completa** — quem fez, quando, a partir de qual origem, com qual justificativa, em qual contexto (profissão, função, tarefa, unidade, turno).

**Exportação forense assinada** — o cliente pode exportar, a qualquer momento, uma trilha de auditoria assinada que um auditor externo pode verificar sem depender do Velya.

**Protocolo publicado** — o algoritmo de hash chain é aberto, documentado, revisável. Não é "confie em nós".

### Por Que Vencemos

Nenhum concorrente publica protocolo criptográfico. Este é o padrão do século XXI para auditoria; o mercado hospitalar está atrasado. Velya traz o estado-da-arte de audit trails (já padrão em sistemas financeiros) para o hospital.

---

## 3. Observabilidade Nativa com OpenTelemetry

### O Problema

Os nove concorrentes são **black boxes**:

- Não publicam traces distribuídos
- Não publicam métricas padronizadas
- Não expõem logs estruturados acessíveis ao cliente
- Não suportam OpenTelemetry nativo
- O cliente não consegue saber por que o sistema está lento, onde há gargalo, qual request falhou, qual serviço está degradado

Em sistemas modernos (bancos, e-commerce, SaaS), OTel é padrão há anos. No mundo hospitalar, é inexistente.

### O Que Velya Entrega

**OpenTelemetry nativo em todos os serviços**, desde o dia um:

- **Traces distribuídos** — cada request cruza múltiplos serviços com trace context propagado
- **Métricas** — latência p50/p95/p99, error rate, saturação, cada serviço
- **Logs estruturados** — JSON com correlação a trace ID
- **Exportação para backends do cliente** — Datadog, Grafana Cloud, New Relic, Honeycomb, Jaeger, Tempo
- **Dashboards nativos** prontos para uso, publicados como código

### Por Que Vencemos

Nenhum concorrente publica contratos de telemetria abertos. Cliente Velya pode **medir** o sistema da mesma forma que mede qualquer outro serviço moderno. SRE hospitalar vira possível.

---

## 4. Mobile-First Sério

### O Problema

Todos os nove têm apps móveis, mas o padrão é:

- **Retrofit** — web responsiva embalada em WebView
- **Feature-incompleto** — só um subset do sistema; médico ainda precisa desktop
- **Sem offline** — cai a rede, para tudo
- **Multi-app confuso** — cada função em um app diferente
- **UX não pensada para mobile** — telas densas adaptadas, não redesenhadas

Expanse Now (MEDITECH) é o mais próximo do ideal, mas ainda trata mobile como complemento.

### O Que Velya Entrega

**Mobile-first profissional desde o dia um**:

- **App nativo** iOS/Android, não WebView
- **Offline-first** — trabalha sem rede, sincroniza quando volta
- **Cobertura completa das tarefas beira-leito** — evoluir, prescrever, visualizar exames, checar sinais vitais, autorizar, assinar, medicar
- **UX pensada para mobile** — action-first, não telas densas
- **Biometria e PIN** como autenticação padrão
- **Push notifications** com deep link para a ação
- **Sincronização eficiente** — delta updates, não full reload

### Por Que Vencemos

O mercado hospitalar está atrasado em mobile profissional. Médicos e enfermeiros vivem no smartphone, mas o sistema de trabalho está no desktop. Velya resolve isso de forma nativa.

---

## 5. Agentes Governados com Kill Switch

### O Problema

Todos os concorrentes estão correndo para lançar **IA** — Oracle Health ambient AI, TrakCare Assistant, MEDITECH Discharge AI, Epic summarization. Mas **nenhum** publica:

- **Kill switch** — como desligar o agente em caso de problema
- **Evaluation harness** — testes automatizados contínuos de qualidade do agente
- **Contratos de dados** — o que o agente lê, o que escreve, quais permissões
- **Drift monitoring** — detecção de degradação ao longo do tempo
- **Explicabilidade** — por que o agente sugeriu X

Em um hospital, IA sem governança é **risco regulatório e clínico**. Um agente que alucina uma dose pode matar.

### O Que Velya Entrega

**Agentes como serviços de primeira classe, governados de ponta a ponta**:

- **Kill switch operacional** — o cliente desliga qualquer agente em 1 clique, sem reiniciar o sistema
- **Evaluation harness contínuo** — cada release do agente passa por bateria de testes clínicos automatizados antes de ir para produção
- **Contratos de dados publicados** — cada agente tem um manifesto: "leio estes dados, escrevo estes dados, exijo estas permissões, assinado por este hash"
- **Drift monitoring** — detecção de queda de qualidade, alerta para equipe
- **Explicabilidade** — cada sugestão do agente traz referências e cadeia de raciocínio auditável
- **Modo sombra** — agente roda em sombra antes de ir para produção, validando contra realidade

### Por Que Vencemos

Governança de IA vai virar requisito regulatório nos próximos anos (EU AI Act, ANPD no Brasil, FDA nos EUA). Velya estará pronto; o mercado não está.

---

## 6. Action-First UX vs Everything-at-Once

### O Problema

EHRs tradicionais são **click-heavy**: telas densas, tudo ao mesmo tempo, 200 campos em uma página, abas dentro de abas, menus dentro de menus. O profissional perde tempo caçando o que precisa.

Epic Hyperspace é o exemplo canônico — poderoso, cobrindo tudo, mas exigindo horas de treinamento para aprender os atalhos. MV SOUL MV tem a mesma herança.

### O Que Velya Entrega

**Action-first UX**:

- **A tela mostra a próxima ação** que o profissional deve tomar, destacada e pronta
- **Contexto filtrado** — só o que importa para esta tarefa, agora
- **Ações em 1-2 clicks** — prescrever, evoluir, assinar, autorizar
- **Atalhos contextuais** — teclado, voz, gestos
- **Cognitive offload** — Velya lembra o que o profissional precisa, não o contrário
- **Priorização dinâmica** — pacientes críticos, tarefas urgentes, alertas no topo

### Por Que Vencemos

UX hospitalar é historicamente subestimada. Velya trata UX como engenharia de redução de custo cognitivo — cada clique poupado é tempo ganho no leito.

---

## 7. Cloud-Native Real

### O Problema

Todos os nove concorrentes reivindicam "cloud":

- Philips Tasy — HTML5, mas Oracle DB + stack legado; cloud é hosting gerenciado
- MV SOUL MV — .NET + SQL Server; cloud é hosting
- Epic — Epic Hosting em OCI ou AWS; não é SaaS multi-tenant
- Oracle Health — migrando Cerner Millennium para OCI; parcial
- MEDITECH Expanse — o mais próximo de cloud-first real, mas em Google Cloud
- Dedalus — microservices + AWS, mas parcial

**Nenhum nasceu cloud-native**. Todos estão portando legado.

### O Que Velya Entrega

**Cloud-native real desde o dia zero**:

- **Kubernetes como plataforma** de deployment
- **Microservices** com contratos explícitos
- **Stateless services** com estado em bancos dedicados
- **Horizontal scaling** automático
- **Multi-cloud** — GCP, AWS, Azure, on-prem Kubernetes (não lock-in)
- **PostgreSQL** como banco padrão (aberto, não proprietário)
- **Kafka / eventos** como primeira classe
- **GitOps** — deploy declarativo versionado
- **Chaos engineering** como prática

### Por Que Vencemos

Velya não carrega o peso de 20-40 anos de código legado. A arquitetura é uma escolha, não uma restrição.

---

## 8. Eventos como First-Class Citizens

### O Problema

Todos os nove são **DB-centric**: a verdade vive no banco, e o sistema consulta o banco para tudo. Eventos existem como triggers ou notificações, mas não são o modelo primário.

Isso impede:

- Timeline unificada real (que exige stream de eventos)
- Auditoria radical (que exige imutabilidade e ordem)
- Integração pub/sub natural
- Replay histórico
- Derivação de projeções (BI em tempo real)
- ML em streaming

### O Que Velya Entrega

**Eventos como primeira classe**:

- **Event sourcing** para domínios onde proveniência importa (clínico, financeiro)
- **Kafka / NATS** como spine de comunicação entre serviços
- **FHIR subscriptions** como contrato externo
- **Projections** derivadas dos eventos para UI, BI, ML
- **Replay** — qualquer consumidor pode reconstruir seu estado a partir do stream
- **Tópicos bem definidos** por domínio

### Por Que Vencemos

Arquitetura event-first desbloqueia vetores #1 (timeline), #2 (auditoria), #3 (observabilidade) e #10 (RBAC contextual). Sem eventos, nenhum desses funciona.

---

## 9. Memory Offload Automático

### O Problema

Hospitais dependem de **checklists humanos** para lembrar:

- Tarefas pendentes (cobrar resultado, verificar glicemia, reavaliar em 4h)
- Passagens de turno (o que estava aberto)
- Prazos regulatórios (tempo para alta, prazo para relatório)
- Follow-ups (ligar para paciente pós-alta)
- Eventos agendados (quimio, curativo, fisioterapia)

Sistemas tradicionais exigem que o profissional **lembre** de marcar tudo isso. Esquecimento é a norma, não a exceção.

### O Que Velya Entrega

**Memory offload automático** — o sistema lembra pelo profissional:

- **Tarefas derivadas automaticamente** de prescrições, protocolos, eventos
- **Reminders contextuais** — aparecem na hora e no lugar certos
- **Handoff automatizado** — passagem de turno é derivada do estado e não do que o profissional digitou
- **Follow-up automático** — pós-alta, reavaliações, retornos
- **Integração com calendário do profissional** — via mobile app
- **Nudges** não intrusivos — "faltam 2h para o próximo curativo"

### Por Que Vencemos

Velya trata cognição como recurso escasso. O sistema é o **braço estendido da memória** do profissional, não outra coisa que ele precisa lembrar de usar.

---

## 10. RBAC Contextual: Profissão + Função + Tarefa + Contexto

### O Problema

RBAC tradicional é **papel**: "médico pode ler e escrever no PEP". Mas isso é grosseiro:

- Um médico residente pode escrever o que um fellow pode?
- Um médico da UTI pode ver prontuário de pediatria?
- Um enfermeiro pode acessar o prontuário em um turno em que não está de plantão?
- Um médico pode acessar prontuário de familiar?
- Uma auditoria pode ser feita sem quebrar LGPD?

Sistemas tradicionais ou são **restritivos demais** (bloqueando trabalho legítimo) ou **permissivos demais** (permitindo acesso indevido).

### O Que Velya Entrega

**RBAC granular contextual**:

- **Profissão** — médico, enfermagem, farmácia, fisio, admin, gestão
- **Função** — residente, staff, plantonista, auditor, consultor
- **Tarefa** — operação específica sendo executada (evoluir, prescrever, autorizar)
- **Contexto** — unidade, turno, relacionamento com paciente, urgência

Cada decisão de autorização considera **os quatro eixos** e é **registrada com justificativa** no log de auditoria.

**Break-glass** — acesso emergencial sempre possível, com justificativa obrigatória e revisão posterior automática.

### Por Que Vencemos

LGPD, certificação SBIS e auditoria hospitalar exigem granularidade. Sistemas tradicionais atropelam isso. Velya trata autorização como cidadã de primeira classe, não como middleware esquecido.

---

## Os Dez Vetores como Narrativa Competitiva

Estes dez vetores formam a **história Velya**:

> *"O mercado hospitalar é dominado por sistemas legados que fazem muita coisa, mas fazem pouco bem feito em dimensões que importam para o século XXI: jornada do paciente, auditoria, observabilidade, mobile, IA governada, UX, cloud, eventos, cognição e controle de acesso. Velya nasce cloud-native, event-first, com auditoria radical, observabilidade nativa, mobile-first sério, IA governada, UX action-first, memory offload automático e RBAC contextual. Entregamos a mesma cobertura clínica dos líderes brasileiros (Tasy, MV), com a arquitetura e a governança que nenhum deles tem — nem pode ter sem reescrever tudo."*

Cada vetor alimenta a comunicação comercial, o roadmap de produto, o design e a arquitetura. Juntos, definem por que Velya existe e por que vence.

---

## O Que Significa "Vencer"

Vencer não é ter mais features. É:

1. Entregar **paridade funcional** em tudo o que importa (decisões `copy` em `velya-target-state-from-market-benchmark.md`)
2. Ser **arquitetonicamente superior** nos dez vetores deste documento
3. Ter **narrativa única** que conecta profundidade clínica a governança moderna
4. Oferecer **time-to-value de semanas**, não anos
5. Cobrar **preço justo**, não premium absurdo
6. Ter **cliente feliz** — medido em NPS, collections, safety, satisfaction
7. Ser **reconhecido** por órgãos independentes (KLAS, HIMSS, SBIS)

Este documento é a **bússola**. O roadmap é o **mapa**. A execução é o **caminho**. Velya vence quando os dez vetores estão medidos, comunicados e validados pelo cliente.
