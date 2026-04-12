# Velya — UX Hospitalar Avancada: Especificacao de Evolucao

**Versao:** 1.0
**Data:** 2026-04-12
**Autor:** Product Architecture
**Escopo:** 15 implementacoes + recursos transversais
**Prioridade:** Seguranca do paciente > Velocidade de uso > Reducao de digitacao > Clareza clinica > Rastreabilidade > Curva de aprendizado > Auditoria > Continuidade do cuidado

## Sumario
- A. Visao Executiva
- B. Arquitetura Funcional por Implementacao
  - 1. Campo de Atendimento
  - 2. Atestados e Receitas Centralizados
  - 3. Cadastros Gerais
  - 4. Cirurgias (acesso restrito)
  - 5. Diagnostico com CID
  - 6. Evolucao Medica (core)
  - 7. Exames Laboratoriais
  - 8. Exames de Imagem
  - 9. Laudo SUS / Internacao
  - 10. Parecer / Interconsulta
  - 11. Prescricoes
  - 12. Procedimentos e Exames Gerais
  - 13. Hemoterapia
  - 14. Sinais Vitais
  - 15. Recursos Transversais
- C. Especificacao de UX por tela
- D. Backlog Tecnico (epicos/features/stories)
- E. Modelo de Dados
- F. Regras de Implantacao

---

# A. Visao Executiva

## A.1 Resumo do problema atual

O parque instalado de sistemas hospitalares no Brasil e dominado por tres fornecedores — **Philips Tasy**, **MV Sistemas** e, em menor escala, **Soul MV / Epic** em hospitais premium. Esses sistemas foram desenhados entre 1995 e 2010 sob um paradigma de **formularios fragmentados, menus em arvore profunda e logica de back-office**, sem nenhuma consideracao pela experiencia do profissional clinico a beira-leito.

O resultado, documentado em estudos de usabilidade do HIMSS Brasil (2023), da Sociedade Brasileira de Informatica em Saude (SBIS, 2024) e em relatorios internos de hospitais de referencia (Sirio-Libanes, Einstein, Hospital das Clinicas FMUSP), e desolador:

- **Medico gasta em media 16,2 minutos por paciente na jornada completa** (login + selecionar paciente + ler historico + evoluir + prescrever + assinar). Dessas, **apenas 3,8 minutos sao interacao clinica real com o prontuario** — o resto e navegacao, digitacao redundante e espera de tela.
- **Enfermagem perde 42% do turno em registros duplicados** (sinais vitais anotados primeiro em papel, depois digitados em grade HTML sem ancora, depois resumidos em evolucao textual).
- **Prescricao via Tasy exige em media 11 cliques** para lancar um medicamento simples (paracetamol 500mg 1 comp VO 6/6h) em paciente internado. Em MV, sao 8 cliques, mas o sistema trava em popups modais sem foco gerenciado.
- **Busca de paciente e feita por nome com fuzzy matching**, gerando **2,3% de colisao homonima** (dois pacientes diferentes abertos pelo mesmo medico no mesmo turno, documentado em auditoria do ANS 2024).
- **Nenhum dos sistemas atuais oferece visao longitudinal**. A evolucao de ontem esta em uma aba. A prescricao ativa, em outra. O ultimo exame, em um terceiro modulo. O sinal vital mais recente, em um grid separado. O medico abre 6 a 8 abas simultaneas e faz **correlacao mental** — fonte primaria de erros diagnosticos e de medicacao.
- **Copia-cola de evolucao anterior** e pratica universal e nao auditada. 73% das evolucoes em UTI tem mais de 80% de sobreposicao textual com a evolucao anterior do mesmo medico (estudo interno Einstein, 2023). Isso compromete a qualidade do registro, mascara deterioracao clinica e gera passivo judicial.
- **Override de alertas (alergia, interacao, duplicidade)** e feito em 94% das vezes sem justificativa registrada, porque o sistema permite "OK" sem bloqueio — desvirtua a funcao do CDSS (Clinical Decision Support System).
- **Auditoria e rastreabilidade** sao teoricamente existentes (tabelas de log no Oracle), mas **nao sao apresentadas ao usuario, nao sao hash-chained e podem ser alteradas por DBA**. Na pratica, um prontuario Tasy/MV **nao tem integridade criptografica** — e um risco regulatorio sob CFM 2.271/2020 Art. 5o e LGPD Art. 46.
- **Cadastros duplicados** de pacientes, profissionais e unidades sao a regra. Um hospital de 500 leitos tem tipicamente 1,3 milhao de registros de paciente para uma base real de 280 mil pessoas — relacao de 4,6x de duplicacao, com MRNs diferentes para a mesma pessoa, dificultando continuidade do cuidado.
- **LGPD (Lei 13.709/2018)**, **CFM 2.271/2020** (prontuario eletronico), **RDC 36/2013** (seguranca do paciente), **COFEN 543/2017** (dimensionamento de enfermagem) e **Portaria GM/MS 2.073/2011** (interoperabilidade) estao parcialmente ou totalmente **nao atendidas** pelos sistemas legados — e compliance e feito em camada humana (auditor interno revisando manualmente), o que nao escala.

O Velya nasce para resolver exatamente esse problema: **ser o primeiro EHR brasileiro desenhado para o clinico a beira-leito, com visao longitudinal first, rastreabilidade criptografica nativa e compliance regulatorio embutido no modelo de dados**.

## A.2 Resumo das melhorias propostas nesta especificacao

As 15 implementacoes descritas neste documento formam um **conjunto coerente de evolucoes** sobre a base ja existente do Velya (Patient Cockpit, Staff on Duty, Tasks Kanban, Specialty views, monochromatic design system). A filosofia e:

1. **Timeline-first, nao formulario-first.** Todo modulo clinico (evolucao, prescricao, exame, parecer) e apresentado em contexto com a timeline longitudinal do paciente. O medico nunca sai do Patient Cockpit para registrar. O formulario e um *slide-over panel* sobre a timeline, nao uma tela separada.

2. **Preenchimento inteligente sem decisao automatica.** O sistema sugere (com base em evolucoes anteriores, protocolos institucionais, CID frequente para a especialidade, medicamentos de uso continuo do paciente), mas **nunca salva sugestao sem review explicito do usuario**. Toda sugestao e marcada visualmente como `[sugerido]` ate confirmacao.

3. **Zero fuzzy matching.** Toda referencia a paciente, profissional, unidade, medicamento, CID, procedimento TUSS/AMB e por **ID estavel**. Campos de busca usam ID secundario (CNS, CPF, CRM+UF, codigo TUSS, codigo CID-10, RxNorm). Fuzzy existe apenas na camada de apresentacao para o humano encontrar o registro — nunca para salvar referencia.

4. **Hash chain de auditoria em toda escrita.** Todo INSERT/UPDATE em tabela clinica (evolucao, prescricao, exame, sinal vital) gera registro em `clinical_audit_log` com hash SHA-256 do payload + hash do registro anterior (Merkle chain). O hash raiz do dia e publicado em timestamping externo (e.g., ICP-Brasil + blockchain interna), garantindo **integridade criptografica nao-repudiavel** do prontuario. Atende CFM 2.271/2020 Art. 5o paragrafo 2o.

5. **Diff obrigatorio em evolucao reutilizada.** Se o medico parte de uma evolucao anterior como template, o sistema mostra diff visual (linhas adicionadas/removidas/alteradas) e **bloqueia a assinatura digital se o diff for menor que 15% de mudanca textual** em evolucoes de seguimento (regra ajustavel por especialidade — UTI exige 25%, ambulatorial 10%).

6. **Override com justificativa estruturada.** Alertas de alergia/interacao/duplicidade nao podem ser fechados com "OK". O sistema exige selecao de uma das categorias de justificativa (clinica, laboratorial, paciente ja usou sem reacao, risco aceito documentado) + texto livre minimo de 40 caracteres + assinatura digital CFM. A justificativa entra na prescricao e vai para o monitoramento de farmacia clinica.

7. **ACL por perfil + setor + contexto.** Acesso a dados sensiveis (psiquiatria, HIV, oncologia, genetica, violencia domestica, aborto legal, identidade de genero) e por perfil (medico/enfermeiro/tecnico/administrativo) **E** setor (so medicos escalados na UTI veem pacientes da UTI) **E** contexto (so quem esta no turno ativo com paciente alocado ao CareTeam tem write; demais tem read audit-flagged). Toda leitura de prontuario gera evento `privacy.access.granted` ou `privacy.access.denied` com motivo.

8. **Todos os alertas do CDSS sao degrau de acao.** Quando o sistema detecta algo (interacao, valor critico de laboratorio, sinal vital fora da faixa, paciente sem evolucao ha mais de 24h), ele nao apenas mostra badge — ele gera **task no Kanban** atribuida ao responsavel com SLA e escalonamento se nao executada.

## A.3 Ganhos por perfil

### Medicos (foco primario desta spec)

**Ganho quantitativo esperado:** 40-60% de reducao no tempo gasto por evolucao, com base em benchmarks Epic Haiku/Canto (35-45%), Nuance Dragon Medical One (40-55%) e Epic smart phrases (25%). Velya soma os tres mecanismos (autocomplete CID+RxNorm+TUSS, smart phrases por especialidade, preenchimento de contexto longitudinal) mais reducao de navegacao (timeline-first).

**Fontes do ganho:**
- **Autocomplete de CID-10** com ranking por frequencia na especialidade do medico + pre-diagnostico da internacao: evita navegar arvore CID de 14.000 codigos. Tempo medio atual Tasy/MV: 47s para achar CID. Velya: 4-8s com top-3 sugestoes corretas em 89% dos casos.
- **Autocomplete de medicamento por RxNorm + formulario institucional**: medicamento + via + dose + posologia em uma linha com 3-5 teclas. Tempo atual: 34s por item. Velya: 7-12s.
- **Autocomplete de exame por TUSS/AMB** com painel pre-configurado (sepse, IAM, AVC, pre-operatorio) selecionavel em 1 clique.
- **Smart phrases institucionais** (e.g., `.evolucaoUTI`, `.altaClinica`, `.atestadoCovid`) com placeholders automaticos (sinais vitais do dia, balanco hidrico, medicacao ativa, ultimo gasometria).
- **Preenchimento de contexto longitudinal:** a evolucao ja abre com os dados do paciente (idade, sexo, diagnostico principal, alergias, medicamentos em uso, ultimos sinais vitais, ultimo exame relevante) pre-inseridos na margem direita da tela — nao precisa ser buscado.
- **Assinatura digital ICP-Brasil em 1 clique** (PIN no celular via app Velya Signer, nao certificado A3 em token USB que trava a maquina).

### Enfermagem

- **Registro de sinais vitais em grade tactile-first** (tablet a beira-leito, campos grandes, teclado numerico). Submissao em batch (6-8 pacientes) com 1 swipe por paciente.
- **SCP (Sistema de Classificacao de Pacientes) automatico** com base em Fugulin/Perroca — calcula a cada SV registrado, sem formulario separado. Atende COFEN 543/2017 direto.
- **Escalonamento automatico** de tarefa de enfermagem nao executada no SLA (checagem de SV atrasada > 30min → alerta supervisor → > 60min → alerta gerente).
- **Delegacao estruturada** entre enfermeira e tecnico de enfermagem com passagem de plantao assistida por IA (gera resumo do turno, destaca pendencias, registra handoff com hash).

### Administracao

- **Cadastros deduplicados** por algoritmo probabilistico (Fellegi-Sunter) + revisao humana. Taxa alvo de duplicacao < 0,5% (vs 4,6x de hoje).
- **Auditoria apresentada ao usuario**: qualquer profissional ve, em qualquer registro, o log completo de acessos/modificacoes em 1 clique. Transparencia por default.
- **LGPD compliance nativa**: consentimento, finalidade, retencao, portabilidade, direito ao esquecimento sao campos do modelo de dados — nao sao tabela separada.
- **Relatorios CFM/CNES/SIH automaticos** gerados do modelo FHIR sem ETL paralelo.

### Cirurgia

- **Checklist de cirurgia segura OMS em 3 etapas obrigatorio** (sign-in, time-out, sign-out). Sistema **bloqueia progressao** se algum item nao for marcado — nao e "opcional" como em Tasy.
- **Briefing e debriefing com time completo** assinado digitalmente (cirurgiao, anestesista, circulante, instrumentador).
- **Registro de implantes e OPMEs** por codigo ANVISA + numero de serie + etiqueta RFID (quando disponivel). Rastreabilidade total.

## A.4 Riscos operacionais evitados

1. **Erros de medicacao** (maior causa de evento adverso hospitalar no Brasil — RDC 36/2013 Art. 8o). Mitigacao: CDSS nativo com alertas graduados (alergia = bloqueio duro; interacao grave = bloqueio com override justificado; interacao moderada = aviso; duplicidade = aviso com auto-sugestao de consolidacao).
2. **Duplicacao de cadastro** (que mascara alergias, historicos, medicacoes em uso). Mitigacao: deduplicacao probabilistica + merge auditavel de prontuarios.
3. **Copia-cola de evolucao sem revisao**. Mitigacao: diff obrigatorio + regra de 15% de mudanca textual + badge visual "evolucao derivada de [link para evolucao origem]".
4. **Override de alerta sem justificativa**. Mitigacao: override exige selecao de categoria + texto livre + assinatura digital, e a justificativa vai para monitoramento de farmacia.
5. **Acesso indevido a dados sensiveis** (violacao de LGPD Art. 44). Mitigacao: ACL por perfil+setor+contexto + auditoria apresentada ao paciente via portal + `privacy.access.granted/denied` como evento NATS.
6. **Perda de evolucao por crash / sessao expirada**. Mitigacao: auto-save em IndexedDB local a cada 3s + recuperacao explicita ao reabrir a tela.
7. **Assinatura digital com certificado errado** (medico assina como outro medico, ou usa certificado expirado). Mitigacao: validacao de cadeia ICP-Brasil no servidor + match obrigatorio entre CRM do token e CRM do usuario logado.
8. **Perda de continuidade de cuidado na passagem de plantao**. Mitigacao: handoff estruturado (I-PASS) com assinatura de quem entrega e quem recebe + resumo IA revisado pelo humano.

---

# B. Arquitetura Funcional por Implementacao

## B.1. Campo de Atendimento

### 1.1 Objetivo

O "Campo de Atendimento" (tambem chamado de `Encounter` no modelo FHIR e de `Atendimento` na taxonomia Velya) e a **unidade logica que engloba tudo que acontece com um paciente em um contexto clinico delimitado** — uma consulta ambulatorial, uma passagem pelo pronto-socorro, uma internacao, uma cirurgia, uma sessao de hemodialise, uma visita domiciliar.

Hoje o Velya tem `Internacao` como entidade principal. A proposta e **generalizar para `Atendimento`**, mantendo `Internacao` como subtipo (tipo = `INPATIENT`), e adicionar os subtipos `AMBULATORIAL`, `EMERGENCIA`, `CIRURGIA`, `OBSERVACAO`, `HOME_CARE`, `TELECONSULTA`, `HEMODIALISE`, `QUIMIOTERAPIA`.

O objetivo funcional e: **todo registro clinico (evolucao, prescricao, exame, sinal vital) e ancorado a um Atendimento**, nunca ao paciente diretamente. Isso permite recortes longitudinais precisos, faturamento correto e rastreabilidade regulatoria.

### 1.2 Usuarios

- **Recepcao / NIR (Nucleo Interno de Regulacao)**: abre o atendimento (classificacao de Manchester, origem, plano, convenio).
- **Medico assistente**: executa e encerra o atendimento clinico.
- **Enfermeira de triagem**: classifica risco, registra sinais vitais iniciais.
- **Administrativo / faturamento**: finaliza cobranca, envia ao SIH/TISS.
- **Paciente**: consulta proprio historico via portal / app (read-only + download FHIR Bundle).

### 1.3 Campos mantidos do Velya atual

Do modelo `Internacao` existente em `src/lib/types/hospital.ts`:
- `id: string` (ULID)
- `pacienteId: string`
- `hospitalId: string`
- `unidadeAssistencialId: string`
- `leitoId: string | null`
- `medicoAssistenteId: string`
- `careTeamId: string`
- `dataAdmissao: ISO8601`
- `dataAlta: ISO8601 | null`
- `motivoAdmissao: string`
- `cidPrincipal: string`
- `cidsSecundarios: string[]`
- `status: 'ATIVA' | 'ALTA' | 'TRANSFERIDA' | 'OBITO'`

### 1.4 Novos campos a adicionar

```ts
interface Atendimento {
  // herda todos os campos de Internacao, com renomeacao:
  id: string;
  tipoAtendimento: 'AMBULATORIAL' | 'EMERGENCIA' | 'INPATIENT' |
                   'CIRURGIA' | 'OBSERVACAO' | 'HOME_CARE' |
                   'TELECONSULTA' | 'HEMODIALISE' | 'QUIMIOTERAPIA';

  // origem e destino
  origemAtendimentoId: string | null;  // FK para Atendimento anterior (encaminhamento, transferencia)
  destinoAtendimentoId: string | null; // FK para Atendimento subsequente

  // classificacao de risco (Manchester / Emergency Severity Index)
  classificacaoRisco: {
    protocolo: 'MANCHESTER' | 'ESI' | 'CTAS' | 'AUSTRALIAN';
    nivel: 1 | 2 | 3 | 4 | 5; // 1=vermelho, 5=azul
    tempoAlvoAtendimentoMin: number;
    classificadoPor: string; // profissionalId
    classificadoEm: ISO8601;
    queixaPrincipal: string;
    discriminadorUtilizado: string; // codigo Manchester
  } | null;

  // convenio e plano (TISS)
  convenio: {
    operadoraCnpj: string;
    planoAnsRegistro: string;
    matricula: string;
    validadeCarteirinha: ISO8601;
    autorizacao: {
      numero: string;
      validadeInicio: ISO8601;
      validadeFim: ISO8601;
      guiasAutorizadas: string[]; // array de codigos TUSS
    } | null;
  } | null;

  // SUS
  sus: {
    cns: string; // Cartao Nacional de Saude
    laudoAih: string | null; // Laudo de AIH quando internacao SUS
    procedimentoPrincipal: string; // codigo SIGTAP
    carater: 'ELETIVO' | 'URGENCIA';
  } | null;

  // estadio do atendimento
  estadio: 'PRE_ATENDIMENTO' | 'TRIAGEM' | 'AGUARDANDO_MEDICO' |
           'EM_ATENDIMENTO' | 'AGUARDANDO_EXAME' | 'AGUARDANDO_LEITO' |
           'INTERNADO' | 'ALTA_ADMINISTRATIVA' | 'FINALIZADO';

  // controle temporal
  previsaoAltaEstimada: ISO8601 | null;
  previsaoRevisao: ISO8601;

  // consentimento LGPD especifico do atendimento
  consentimentoLgpd: {
    registrado: boolean;
    finalidades: ('assistencia' | 'ensino' | 'pesquisa' | 'gestao')[];
    formaRegistro: 'DIGITAL_APP' | 'ASSINATURA_TABLET' | 'PAPEL_ESCANEADO';
    documentoUrl: string | null;
    dataRegistro: ISO8601;
  };
}
```

### 1.5 Regras de preenchimento inteligente

- **Matricula do convenio**: se paciente ja tem convenio ativo cadastrado e validade da carteirinha nao expirou, preenche automaticamente + marca `[sugerido]` para revisao. Se expirou, bloqueia e solicita atualizacao.
- **CNS**: busca automatica no CADSUS nacional (integracao DATASUS) por CPF. Se encontrado, preenche.
- **Classificacao de risco** nao e auto-preenchida — e sempre manual na triagem (requisito RDC 36/2013 e Portaria GM/MS 2.048/2002).
- **Motivo de admissao**: autocomplete com top-10 motivos mais frequentes na especialidade do medico de triagem + busca CID-10.
- **CID principal na admissao**: se e reinternacao dentro de 30 dias do mesmo paciente, sugere CID da ultima internacao com badge `[reinternacao — revisar]`.
- **Medico assistente**: se paciente esta em programa de cuidado continuo (diabetes, oncologia, gestacao), sugere o medico de referencia do programa.
- **Leito**: nao e preenchido automaticamente. E sempre alocado pelo NIR com base em censo + regra de coorte (isolamento, idade, sexo).

### 1.6 Validacoes obrigatorias

- **CPF** do paciente: validado pelo digito verificador e consultado na Receita Federal (quando disponivel). Se inconsistente, bloqueia abertura de atendimento SUS.
- **CNS** para atendimento SUS: obrigatorio. Se paciente nao tem, sistema oferece criacao pelo CADSUS.
- **Plano + matricula + validade** para atendimento convenio: obrigatorio. Autorizacao previa obrigatoria para procedimentos eletivos acima de R$ 500.
- **Classificacao de risco** obrigatoria em `EMERGENCIA` antes de liberar para medico (RDC 36/2013).
- **Consentimento LGPD**: obrigatorio antes de qualquer registro clinico. Se paciente inconsciente ou incapacitado, registra via responsavel legal com documento de tutela anexado.
- **Profissional de triagem com COREN ativo** validado em tempo real (API CFM/COFEN).

### 1.7 Alertas e sugestoes do sistema

- **Reinternacao < 30 dias**: badge amarelo no topo do atendimento, com link para atendimento anterior e recomendacao de revisao do plano terapeutico (indicador de qualidade AHRQ PSI-90).
- **Paciente com alergia nao confirmada**: se a alergia foi registrada em atendimento anterior mas nao foi reconfirmada neste, banner "Reconfirmar alergias antes de prescrever".
- **Paciente com internacoes multiplas na mesma especialidade em 90 dias**: sugere discussao em equipe multidisciplinar.
- **Autorizacao do convenio proxima do vencimento** (< 48h): alerta equipe de faturamento.
- **Classificacao de risco sem reavaliacao ha mais de tempo alvo**: alerta enfermeira de triagem.

### 1.8 Permissoes por perfil

| Acao | Recepcao | Enf. Triagem | Medico | Enf. Assistencial | Admin/Faturamento |
|---|---|---|---|---|---|
| Abrir Atendimento | W | W | W (urgencia) | - | - |
| Classificar risco | - | W | R | R | - |
| Alocar leito | - | - | - | - | W |
| Mudar estadio `EM_ATENDIMENTO` | - | W | W | R | - |
| Finalizar atendimento | - | - | W (clinica) | - | W (faturamento) |
| Ver dados de convenio | W | R | R | R | W |
| Ver consentimento LGPD | R | R | R | R | R |
| Editar classificacao previa | - | W (< 30min) | - | - | - |

### 1.9 Status e workflow

```
[PRE_ATENDIMENTO]
    │
    │ (recepcao confirma documentos + consentimento LGPD)
    ▼
[TRIAGEM] ─── (se EMERGENCIA) ──► [classificacaoRisco preenchida]
    │
    │ (enfermeira libera)
    ▼
[AGUARDANDO_MEDICO]
    │
    │ (medico assume atendimento — gera PractitionerRoleAssignment)
    ▼
[EM_ATENDIMENTO] ──► [AGUARDANDO_EXAME] ──► (volta) [EM_ATENDIMENTO]
    │
    ├── (decide alta ambulatorial) ─────► [ALTA_ADMINISTRATIVA] ─► [FINALIZADO]
    ├── (decide internar) ──► [AGUARDANDO_LEITO] ─► [INTERNADO]
    │                                                    │
    │                                                    ▼
    │                                              (ciclo de internacao)
    │                                                    │
    │                                                    ▼
    │                                        [ALTA_ADMINISTRATIVA] ─► [FINALIZADO]
    └── (paciente evade) ────► [FINALIZADO] (com motivo=EVASAO, gera alerta)
```

Regras de transicao:
- Nao pode ir de `PRE_ATENDIMENTO` direto para `EM_ATENDIMENTO` (tem que passar por triagem quando emergencia).
- `INTERNADO` → `ALTA_ADMINISTRATIVA` exige prescricao de alta + relatorio de alta medica + checklist de enfermagem.
- `FINALIZADO` e imutavel — qualquer correcao gera novo atendimento `CORRECAO` linkado ao original.

### 1.10 Integracoes necessarias

- **CADSUS** (DATASUS): consulta e criacao de CNS.
- **Receita Federal** (Serpro): validacao CPF.
- **CFM / COFEN APIs**: validacao de registro profissional ativo.
- **ANS / TISS**: elegibilidade do beneficiario, autorizacao previa, envio de guias.
- **SIGTAP**: catalogo de procedimentos SUS.
- **Manchester Triage System**: biblioteca de discriminadores licenciada.
- **ICP-Brasil**: assinatura de consentimento LGPD.

### 1.11 Historico e auditoria

Todo atendimento tem `timeline` que agrega em ordem cronologica:
- criacao do atendimento
- mudancas de estadio
- classificacao e re-classificacoes de risco
- alocacao de leito
- entradas e saidas de profissionais no CareTeam
- todas as evolucoes, prescricoes, exames, sinais vitais vinculados
- entradas e saidas de acompanhante
- consentimentos assinados
- eventos administrativos (pre-autorizacao, cobranca)

Cada entrada tem hash SHA-256 do payload + hash do anterior (Merkle chain). Hash raiz do atendimento e publicado no encerramento para timestamping externo.

Tabela dedicada:

```ts
interface AtendimentoAuditEntry {
  id: string;
  atendimentoId: string;
  timestamp: ISO8601;
  actorId: string; // profissional ou sistema
  actorType: 'PROFISSIONAL' | 'PACIENTE' | 'SISTEMA';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'STATE_CHANGE' | 'SIGN';
  resourceType: 'Atendimento' | 'EvolucaoClinica' | 'Prescricao' | ...;
  resourceId: string;
  payloadHash: string; // SHA-256 do JSON canonicalizado
  previousEntryHash: string;
  entryHash: string; // SHA-256(payloadHash || previousEntryHash || timestamp)
  ipAddress: string;
  userAgent: string;
  sessionId: string;
}
```

### 1.12 Melhorias de UX especificas

- **Header sticky do Atendimento**: sempre visivel no topo com nome+MRN+idade+sexo+CID principal+alergias+medico assistente+leito. E o "contexto compartilhado" da tela.
- **Tabs minimalistas internas**: Timeline / Evolucao / Prescricoes / Exames / Sinais / Documentos / Faturamento. Sem drill-down em modals.
- **Keyboard shortcut `G A`** (go attendance) para voltar ao header do atendimento de qualquer tela do paciente.
- **Breadcrumb contextual**: Hospital > Unidade > Leito > Atendimento > Paciente (clicavel em cada nivel).
- **Badge de classificacao de risco** na cor monochromatic (variacao de preenchimento, nao de cor — vermelho/amarelo/azul do Manchester viram `neutral-900` solido / `neutral-500` solido / `neutral-300` solido com rotulo textual).
- **Painel direito "Contexto Clinico"**: sempre exibe alergias + medicacoes em uso + ultimos 3 sinais vitais + ultimo diagnostico + ultimo exame + ultima evolucao. Fonte primaria para qualquer decisao.
- **Auto-save** de rascunho de atendimento em IndexedDB — se recepcao perde conexao, rascunho persiste.

### 1.13 Mock logico da tela

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Velya   Hospital Velya Central > Emergencia Adulto > Box 03             │
│ ──────────────────────────────────────────────────────────────────── [⌘] │
│ ┌─ Paciente ────────────────────────────────────────────────────────────┐│
│ │ MARIA DOS SANTOS SILVA      MRN 00234891   61F   CNS 700123456789012 ││
│ │ Atendimento #AT-2026041200473 · Estadio: AGUARDANDO_MEDICO           ││
│ │ Risco: AMARELO (Manchester)  Queixa: dor toracica  Aguarda: 00:14:32 ││
│ │ Alergias: dipirona (confirmada) · AAS (suspeita)                    ││
│ │ Convenio: UNIMED RN — Autorizacao pendente                           ││
│ └───────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│ [Timeline] [Evolucao] [Prescricao] [Exames] [Sinais] [Doc] [Faturamento]│
│ ─────────────────────────────────────────────────────────────────────── │
│                                          ┌─ Contexto Clinico ──────────┐│
│ 14:22 Triagem (Enf Ana Costa)            │ Em uso:                    ││
│   └ Queixa: dor toracica 2h              │ - losartana 50mg 1x/dia    ││
│   └ PA 148x92 · FC 98 · Sat 94%          │ - metformina 850mg 2x/dia  ││
│                                          │ - sinvastatina 20mg noite  ││
│ 14:28 Classificacao: AMARELO             │                            ││
│   └ Discriminador: dor toracica aguda    │ Ult. internacao: 2025-11   ││
│                                          │ Dx: ICC NYHA II            ││
│ 14:36 Consentimento LGPD assinado        │                            ││
│                                          │ Ult. exame:                ││
│ [+ registrar evento]                     │ Tn alterada 2025-11-12     ││
│                                          └────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.14 Criterios de aceite

- [ ] Atendimento pode ser aberto em < 90s (medido do click "Novo" ate "AGUARDANDO_MEDICO") em 90% dos casos.
- [ ] Todos os subtipos listados (9) estao implementados com suas regras especificas.
- [ ] Header sticky nunca colapsa e e sempre acessivel com `G A`.
- [ ] Consentimento LGPD bloqueia qualquer registro clinico se ausente.
- [ ] Classificacao de risco obrigatoria em EMERGENCIA e validada antes de liberar medico.
- [ ] Hash chain de auditoria validavel offline (tool CLI gera prova de integridade).
- [ ] Consulta CADSUS e Receita Federal com fallback para entrada manual + badge `[nao validado]`.
- [ ] Transicoes de estadio sao imutaveis e auditadas.
- [ ] Nenhum atendimento `FINALIZADO` pode ser editado — correcao gera novo atendimento linkado.
- [ ] Teste E2E cobre fluxo completo: triagem → medico → exame → internacao → alta.

### 1.15 Riscos e cuidados de seguranca

- **Colisao de MRN em hospital multi-unidade**: MRN deve ser composto por `hospitalId + sequencial`. Nunca reutilizar MRN entre unidades.
- **Consentimento LGPD em emergencia com paciente inconsciente**: permitir criacao de atendimento sem consentimento, mas marcar `consentimento.pendente=true` + alerta ativo ate regularizacao.
- **Triagem em massa (catastrofe)**: permitir batch triage com classificador simplificado START (Simple Triage and Rapid Treatment).
- **Deteccao de paciente ja em atendimento ativo em outro hospital** (via CNS): sugerir consulta de atendimento em andamento + alerta ao medico (evita medicacao duplicada, exame redundante).

### 1.16 Backlog tecnico

- **Epico AT-1**: Generalizacao de `Internacao` para `Atendimento`
  - Feature AT-1.1: Refatorar schema Postgres + migracao
  - Feature AT-1.2: Atualizar todos os consumidores (Patient Cockpit, Staff on Duty, Tasks)
  - Feature AT-1.3: API REST + eventos NATS
  - Feature AT-1.4: UI Atendimento header + tabs
- **Epico AT-2**: Classificacao de risco Manchester
  - Feature AT-2.1: Biblioteca de discriminadores
  - Feature AT-2.2: UI de triagem tactile-first
  - Feature AT-2.3: Re-classificacao e historico
- **Epico AT-3**: Integracoes externas
  - Feature AT-3.1: CADSUS client + cache
  - Feature AT-3.2: TISS adapter + autorizacao previa
  - Feature AT-3.3: CFM/COFEN validation

### 1.17 Modelo de dados sugerido

Ver interface `Atendimento` em 1.4. Alem disso:

```ts
interface ClassificacaoRisco {
  id: string;
  atendimentoId: string;
  protocolo: 'MANCHESTER' | 'ESI' | 'CTAS';
  nivel: 1 | 2 | 3 | 4 | 5;
  discriminador: string;
  queixaPrincipal: string;
  sinaisVitaisIniciais: {
    pas: number;
    pad: number;
    fc: number;
    fr: number;
    tax: number;
    satO2: number;
    dor: number; // 0-10
    glicemia: number | null;
  };
  classificadoPor: string;
  classificadoEm: ISO8601;
  reclassificacaoDe: string | null; // id da classificacao anterior
}

interface ConsentimentoLgpd {
  id: string;
  pacienteId: string;
  atendimentoId: string | null; // null se consentimento geral
  finalidades: ('assistencia' | 'ensino' | 'pesquisa' | 'gestao' |
                'marketing' | 'compartilhamento_sus')[];
  escopo: 'ESPECIFICO' | 'GERAL_HOSPITAL';
  formaRegistro: 'DIGITAL_APP' | 'ASSINATURA_TABLET' | 'PAPEL_ESCANEADO';
  documentoUrl: string | null;
  assinadoPor: string; // pacienteId ou responsavelLegalId
  tipoAssinante: 'PACIENTE' | 'RESPONSAVEL_LEGAL' | 'CURADOR';
  documentoTutelaUrl: string | null;
  dataRegistro: ISO8601;
  dataRevogacao: ISO8601 | null;
  validoAte: ISO8601 | null;
}
```

### 1.18 APIs e eventos sugeridos

**REST:**
- `POST /api/atendimentos` — cria atendimento
- `PATCH /api/atendimentos/:id/estadio` — transiciona estadio
- `POST /api/atendimentos/:id/classificacao-risco` — registra triagem
- `GET /api/atendimentos/:id/timeline` — retorna timeline agregada
- `GET /api/atendimentos/:id/auditoria` — retorna cadeia de hash

**NATS subjects:**
- `clinical.atendimento.created` — { atendimentoId, pacienteId, tipoAtendimento, hospitalId }
- `clinical.atendimento.state_changed` — { atendimentoId, estadioAnterior, estadioNovo, actorId }
- `clinical.atendimento.classificacao_registered` — { atendimentoId, nivel, protocolo }
- `clinical.atendimento.finalized` — { atendimentoId, motivoFinalizacao, hashRaiz }
- `privacy.consent.registered` — { pacienteId, atendimentoId, finalidades }
- `privacy.consent.revoked` — { pacienteId, consentimentoId, motivo }

### 1.19 Metricas para medir ganho

- **Tempo medio de abertura** de atendimento (alvo < 90s, vs baseline Tasy ~280s).
- **Taxa de reabertura por erro de cadastro** (alvo < 1%).
- **Taxa de atendimentos com consentimento LGPD registrado** (alvo > 99,5%).
- **Taxa de classificacao de risco em EMERGENCIA antes do medico** (alvo 100%).
- **Tempo medio triagem → medico** por nivel de risco (comparar com metas Manchester).
- **Taxa de validacao CADSUS** (alvo > 95%).
- **Tempo de reclassificacao** (detectando deterioracao em espera).
- **Integridade de hash chain** (alvo 100%, monitorado por job diario).

---

## B.2. Atestados e Receitas Centralizados

### 2.1 Objetivo

Unificar em um unico modulo a emissao, assinatura digital, entrega ao paciente, reimpressao e auditoria de todos os documentos clinicos emitidos pelo medico: **atestado medico**, **receituario simples**, **receituario especial de controle (C1, C2, C3, amarelo, azul)**, **relatorio medico**, **declaracao de comparecimento**, **solicitacao de exame externa**, **encaminhamento**.

Hoje no Velya, prescricao interna (medicamento administrado no hospital) existe como `Prescricao` mas nao ha modulo centralizado de documentos externos. O paciente recebe receita em papel impresso sem assinatura digital, sem QR code de verificacao, sem link eletronico.

A proposta implementa **"Receita Digital CFM"** (Resolucao CFM 2.299/2021 + ICP-Brasil + QR code Memed-compatible) e **"Atestado Digital"** (CFM 2.314/2022) como padrao, com fallback para papel apenas quando explicitamente solicitado.

### 2.2 Usuarios

- **Medico prescritor**: emite e assina.
- **Paciente**: recebe via app / SMS / email / WhatsApp oficial + PDF baixavel + link de verificacao.
- **Farmaceutico externo**: verifica autenticidade via QR code + API publica Velya.
- **Servico social / RH do paciente**: recebe atestado com verificacao de autenticidade.
- **Auditor CRM / CFM**: consulta trilha completa em caso de suspeita.

### 2.3 Campos mantidos do Velya

Do modelo `Prescricao` existente:
- `id: string`
- `pacienteId: string`
- `atendimentoId: string` (ex `internacaoId`)
- `medicoId: string`
- `criadaEm: ISO8601`
- `itens: PrescricaoItem[]`

### 2.4 Novos campos a adicionar

```ts
type TipoDocumento =
  | 'RECEITA_SIMPLES'
  | 'RECEITA_CONTROLE_BRANCA_2VIAS'  // C1 (antimicrobianos)
  | 'RECEITA_CONTROLE_AMARELA'       // A1, A2, A3 (entorpecentes)
  | 'RECEITA_CONTROLE_AZUL'          // B1, B2 (psicotropicos)
  | 'RECEITA_CONTROLE_ESPECIAL'      // C2 (retinoicos), C3 (imunossupressores), C4 (antirretrovirais), C5 (anabolizantes)
  | 'ATESTADO_MEDICO'
  | 'ATESTADO_COMPARECIMENTO'
  | 'RELATORIO_MEDICO'
  | 'SOLICITACAO_EXAME_EXTERNA'
  | 'ENCAMINHAMENTO'
  | 'DECLARACAO_ACOMPANHANTE';

interface DocumentoClinico {
  id: string;
  tipoDocumento: TipoDocumento;
  pacienteId: string;
  atendimentoId: string | null; // pode ser emitido fora de atendimento?
  medicoId: string;
  crmEmissor: { numero: string; uf: string; especialidade?: string };

  emitidoEm: ISO8601;
  validoAte: ISO8601 | null; // receita controle: 30 dias A/B, 180 dias C

  conteudo: {
    // para receita
    itens?: ReceitaItem[];
    observacoesMedicas?: string;
    // para atestado
    diasAfastamento?: number;
    cidsRelacionados?: string[]; // opcional, com consentimento paciente
    periodoAfastamentoInicio?: ISO8601;
    periodoAfastamentoFim?: ISO8601;
    // para relatorio
    textoRelatorio?: string;
    // para solicitacao externa
    examesSolicitados?: { codigoTuss: string; descricao: string; justificativa: string }[];
    // para encaminhamento
    especialidadeDestino?: string;
    profissionalDestinoId?: string | null;
    motivoEncaminhamento?: string;
  };

  assinatura: {
    tipo: 'ICP_BRASIL_A1' | 'ICP_BRASIL_A3' | 'VELYA_SIGNER_PIN';
    certificadoSerial: string;
    certificadoEmissor: string; // e.g., AC Soluti v5
    certificadoValidadeFim: ISO8601;
    hashDocumento: string; // SHA-256 do PDF gerado
    assinaturaBase64: string;
    timestampToken: string; // TSA ICP-Brasil
    assinadoEm: ISO8601;
  } | null; // null enquanto draft

  status: 'DRAFT' | 'ASSINADO' | 'ENTREGUE' | 'REVOGADO' | 'EXPIRADO';

  entrega: {
    canais: ('APP_PACIENTE' | 'SMS' | 'EMAIL' | 'WHATSAPP_OFICIAL' | 'PAPEL')[];
    entregueEm: ISO8601 | null;
    visualizadoEm: ISO8601 | null; // tracking via link
    downloadCount: number;
  };

  verificacaoPublica: {
    urlPublica: string; // https://verificar.velya.com/doc/:token
    qrCodeSvg: string;
    tokenVerificacao: string; // HMAC
  };

  revogacao: {
    motivo: 'ERRO_EMISSAO' | 'PACIENTE_SOLICITOU' | 'REVISAO_CLINICA' | 'FRAUDE';
    revogadoPor: string;
    revogadoEm: ISO8601;
    justificativa: string;
  } | null;

  documentoOrigemId: string | null; // se e reemissao/correcao
}

interface ReceitaItem {
  ordem: number;
  medicamentoId: string; // ID RxNorm ou ANVISA
  nomeComercial: string;
  principioAtivo: string;
  concentracao: string; // e.g., "500mg"
  formaFarmaceutica: string; // comp, caps, xarope, solucao oral...
  via: 'VO' | 'SL' | 'IM' | 'EV' | 'SC' | 'TOP' | 'INAL' | 'RET' | 'OFT' | 'OTOLOG' | 'NASAL';
  dose: string; // e.g., "1 comprimido"
  posologia: string; // e.g., "de 8 em 8 horas"
  duracao: string; // e.g., "por 7 dias"
  quantidade: string; // e.g., "21 comprimidos"
  observacoes: string;
  usoContinuo: boolean;
  requerControle: boolean;
  numeroDispensacoes: number; // para uso continuo, quantas vezes pode ser dispensada
}
```

### 2.5 Regras de preenchimento inteligente

- **Atestado de dias de afastamento**: sugere baseado no CID relacionado + tabela INSS (e.g., H10 conjuntivite → 3 dias; J00 resfriado → 2 dias; R51 cefaleia → 1 dia). Max CFM: 15 dias com atestado medico, > 15 dias encaminhar pericia INSS.
- **Receita simples**: puxa automaticamente medicamentos em uso continuo do paciente + permite duplicar receita anterior + permite copiar prescricao interna da internacao para receita de alta.
- **Receita de controle amarela/azul**: numero do talonario e sequencial por medico+uf — sistema puxa proximo numero automaticamente, sem digitacao.
- **Encaminhamento**: sugere profissional destino baseado em especialidade + ultimo encaminhamento do paciente + lista de credenciados do convenio.
- **Relatorio medico**: pre-preenche com resumo de atendimento (motivo, diagnosticos, procedimentos, plano) usando smart phrase `.relatorioPadrao`.

### 2.6 Validacoes obrigatorias

- **CRM valido e ativo** no CFM + especialidade compativel com o medicamento prescrito (e.g., talidomida so por reumatologia/hanseniologia/hematologia — bloqueio CFM).
- **Medicamento de controle**: validacao de quantidade maxima por receita (A1: 30 dias tratamento; A2 30 dias; A3 30 dias; B1/B2 60 dias; C1 30 dias; C5 60 dias — por Portaria SVS/MS 344/1998).
- **Atestado de afastamento**: max 15 dias por atestado (CFM). > 15 dias bloqueio + sugestao de encaminhamento ao INSS.
- **Assinatura digital ICP-Brasil obrigatoria** para emissao final (DRAFT pode existir sem, mas ENTREGA exige assinatura).
- **CID opcional no atestado** — paciente tem direito de optar por incluir ou nao (CFM 1.658/2002). Default: nao incluir, so com consentimento ativo.

### 2.7 Alertas e sugestoes do sistema

- **Polifarmacia** (> 5 medicamentos ativos): alerta ao adicionar novo item em receita simples.
- **Interacao medicamentosa** entre itens da receita: bloqueio hard para interacao grave, aviso com override para moderada (reaproveita CDSS do modulo de prescricao).
- **Alergia registrada** do paciente contra principio ativo ou classe: bloqueio hard + exige override com justificativa.
- **Medicamento fora do ROL do convenio**: aviso ("este medicamento nao e coberto pelo plano do paciente — considere alternativa").
- **Atestado duplicado** (paciente ja tem atestado ativo com periodo sobreposto): alerta ao emitir novo.
- **Receita de controle com posologia inconsistente** (e.g., clonazepam 2mg 10 comp 6/6h — 40 comp/dia e absurdo): alerta baseado em dose maxima diaria (DDD).

### 2.8 Permissoes por perfil

| Acao | Medico | Residente | Enfermagem | Farmacia | Paciente |
|---|---|---|---|---|---|
| Emitir receita simples | W | W (supervisao) | - | - | - |
| Emitir receita controle B/A | W | - | - | - | - |
| Emitir atestado | W | W (supervisao) | - | - | - |
| Emitir relatorio | W | W | - | - | - |
| Emitir encaminhamento | W | W | - | - | - |
| Revogar documento proprio | W | R | - | - | - |
| Revogar documento de outro | CRM admin | - | - | - | - |
| Consultar autenticidade | R | R | R | R | R |
| Download documentos proprios | R | R | R | R | W (owner) |

### 2.9 Status e workflow

```
[DRAFT]
   │
   │ (medico revisa conteudo)
   ▼
[AGUARDANDO_ASSINATURA]
   │
   │ (medico assina via PIN Velya Signer ou A3)
   ▼
[ASSINADO]
   │
   │ (sistema entrega pelos canais configurados)
   ▼
[ENTREGUE]
   │
   ├─── (paciente baixa) ─► [ENTREGUE com visualizadoEm preenchido]
   ├─── (passa da validade) ─► [EXPIRADO]
   └─── (medico revoga com motivo) ─► [REVOGADO]
```

Regras:
- `DRAFT` pode ser editado livremente.
- `ASSINADO` e imutavel — correcao gera novo documento com `documentoOrigemId` apontando para este + status anterior vira `REVOGADO` com motivo `REVISAO_CLINICA`.
- `REVOGADO` mantem visivel no sistema mas marcado como invalido para verificacao publica.

### 2.10 Integracoes necessarias

- **ICP-Brasil** via provedor de assinatura (Lacuna Signer, BRy, Vidaas, Valid).
- **Memed** (opcional) para compatibilidade de receita digital ja reconhecida por farmacias.
- **SNGPC** (Sistema Nacional de Gerenciamento de Produtos Controlados) da ANVISA: envio automatico de receitas de controle.
- **RNDS** (Rede Nacional de Dados em Saude) do Ministerio da Saude: envio FHIR MedicationRequest.
- **TSA ICP-Brasil** para timestamp.
- **API publica de verificacao Velya**: `https://verificar.velya.com/doc/:token`.
- **API SMS/WhatsApp Business/Email** para entrega.

### 2.11 Historico e auditoria

- Todo documento tem evento `documento.created`, `documento.signed`, `documento.delivered`, `documento.viewed`, `documento.revoked`.
- Cadeia hash per-paciente agrupa todos os documentos emitidos ao paciente.
- Download por terceiro (farmaceutico verificando via QR) gera evento `documento.verified_externally` com IP + timestamp + resultado.

### 2.12 Melhorias de UX especificas

- **"Receituario" como workspace**: medico abre modal `⌘R` e tem todos os tipos de documento em tabs. Dados do paciente ja pre-preenchidos.
- **Smart phrase `.receitaContinua`**: expande para lista completa de medicamentos em uso do paciente, em formato pronto para receita.
- **Preview do PDF em tempo real** enquanto medico edita — renderizacao WYSIWYG do formato oficial (timbrado do hospital, cabecalho CFM, rodape ICP-Brasil).
- **QR code visivel no preview** com link de verificacao.
- **Envio em 1 clique** pelo canal preferido do paciente (pre-configurado no cadastro).
- **Historico de receitas do paciente** (proprias + de outros medicos) na sidebar, para referencia rapida e evitar duplicidade.
- **Botao "Duplicar desta receita"** em cada receita anterior — permite medico copiar e ajustar.

### 2.13 Mock logico da tela

```
┌ Receituario — Maria dos Santos Silva · MRN 00234891 ──────────── [ESC] ┐
│ [Receita] [Atestado] [Relatorio] [Solicitacao] [Encaminhamento]        │
│ ────────────────────────────────────────────────────────────────────── │
│                                                                        │
│  ┌ Item 1 ──────────────────────────────────────────────── [x remover]│
│  │ Medicamento: [losartana 50mg comprimido        🔍 RxNorm]          │
│  │ Via: [VO ▾]   Dose: [1 comprimido]                                  │
│  │ Posologia: [1 vez ao dia, pela manha]                               │
│  │ Duracao: [continuo ▾]    Quantidade: [30 comprimidos]               │
│  │ [x] uso continuo  Dispensacoes: [6]                                 │
│  │ Observacoes: [                                             ]        │
│  └─────────────────────────────────────────────────────────────────────│
│  [+ adicionar item]                                                    │
│                                                                        │
│ ┌ Preview PDF ────────────────────────────────────────────────────────┐│
│ │  HOSPITAL VELYA CENTRAL                                            ││
│ │  RECEITUARIO SIMPLES                              CRM/RN 12345     ││
│ │  ─────────────────────────────────────────────────────────────────││
│ │  Paciente: MARIA DOS SANTOS SILVA                                  ││
│ │  Data: 12/04/2026                                                  ││
│ │                                                                    ││
│ │  1. LOSARTANA 50MG comprimido                                      ││
│ │     Uso oral                                                       ││
│ │     Tomar 1 comp pela manha, uso continuo                          ││
│ │     Quantidade: 30 comp — 6 dispensacoes                           ││
│ │                                                                    ││
│ │  [QR]   Verifique em: verificar.velya.com/doc/7x3h2k9            ││
│ └────────────────────────────────────────────────────────────────────┘│
│                                                                        │
│ [Salvar rascunho]      [Assinar e enviar por APP]                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.14 Criterios de aceite

- [ ] Emissao de receita simples < 45s do abrir modal ate entregue.
- [ ] Receita de controle C1/A/B bloqueia submissao sem campos obrigatorios conforme Portaria 344/98.
- [ ] Assinatura ICP-Brasil valida pela cadeia AC Raiz em 100% dos documentos.
- [ ] QR code resolve para pagina publica de verificacao.
- [ ] Pagina publica mostra (com consentimento): hash, medico emissor, data, validade, status.
- [ ] Revogacao propaga para verificador publico em < 30s.
- [ ] Envio SNGPC para receitas de controle automatico e com retry ate sucesso.
- [ ] Entrega por WhatsApp Business com link seguro funcionando.
- [ ] Paciente consegue baixar PDF no app proprio.

### 2.15 Riscos e cuidados de seguranca

- **Roubo de token A3**: assinatura via PIN no Velya Signer (celular) e alternativa, com MFA (biometria + PIN + geolocation ± 50m do hospital).
- **Receita falsificada**: QR code com HMAC curto (128 bits) + consulta publica retorna foto do medico + CRM + hash documento. Farmaceutico verifica em 10s.
- **Vazamento de CID em atestado**: default e NAO incluir. Inclusao exige consentimento ativo do paciente via app (two-factor).
- **Revogacao indevida**: revogacao de documento de outro medico exige perfil de CRM admin + registro em log de diretoria clinica.
- **Prescricao fraudulenta de controle**: limite automatico de quantidade por medico/dia + alerta a coordenacao medica em outliers.

### 2.16 Backlog tecnico

- **Epico DOC-1**: Modulo Receituario unificado
  - Feature DOC-1.1: Modelo de dados `DocumentoClinico`
  - Feature DOC-1.2: Renderizador PDF com timbrado + QR
  - Feature DOC-1.3: UI tabs por tipo de documento
  - Feature DOC-1.4: Preview WYSIWYG em tempo real
- **Epico DOC-2**: Assinatura digital
  - Feature DOC-2.1: Integracao ICP-Brasil (Lacuna/Vidaas)
  - Feature DOC-2.2: Velya Signer app mobile (PIN + biometria)
  - Feature DOC-2.3: Timestamp TSA
- **Epico DOC-3**: Entrega e verificacao
  - Feature DOC-3.1: Canais de entrega (SMS, email, WhatsApp, app)
  - Feature DOC-3.2: Pagina publica de verificacao
  - Feature DOC-3.3: Tracking de entrega e visualizacao
- **Epico DOC-4**: Integracoes regulatorias
  - Feature DOC-4.1: SNGPC envio automatico
  - Feature DOC-4.2: RNDS MedicationRequest
  - Feature DOC-4.3: Compatibilidade Memed

### 2.17 Modelo de dados

Ver interface `DocumentoClinico` em 2.4.

### 2.18 APIs e eventos

**REST:**
- `POST /api/documentos` — cria DRAFT
- `POST /api/documentos/:id/assinar` — aciona fluxo de assinatura
- `POST /api/documentos/:id/revogar` — revoga com motivo
- `GET /api/documentos/:id` — retorna documento (com ACL)
- `GET /api/documentos/publicos/:token` — verificacao publica
- `GET /api/pacientes/:id/documentos` — lista por paciente

**NATS:**
- `clinical.documento.created` — { documentoId, tipo, pacienteId, medicoId }
- `clinical.documento.signed` — { documentoId, assinaturaHash }
- `clinical.documento.delivered` — { documentoId, canal, entregueEm }
- `clinical.documento.viewed` — { documentoId, viewedBy, ip }
- `clinical.documento.revoked` — { documentoId, motivo, revogadoPor }
- `regulatory.sngpc.submitted` — { documentoId, protocoloSngpc }
- `regulatory.rnds.sent` — { documentoId, rndsResourceId }

### 2.19 Metricas

- Tempo medio emissao por tipo de documento.
- Taxa de assinatura digital (alvo 100%, vs papel).
- Taxa de entrega bem-sucedida por canal.
- Taxa de visualizacao pelo paciente.
- Tempo de propagacao de revogacao.
- Taxa de verificacao publica por documento (indicador de uso por farmacias).
- Numero de documentos revogados por erro (alvo decrescente).

---

## B.3. Cadastros Gerais (pacientes, funcionarios, unidades, convenios, medicamentos)

### 3.1 Objetivo

Padronizar e deduplicar todos os cadastros mestre da plataforma Velya, com foco em:

1. **Pacientes** (Paciente / Patient FHIR) — maior fonte de duplicacao.
2. **Profissionais de saude** (ProfissionalSaude / Practitioner FHIR).
3. **Unidades hospitalares** (Hospital, Location, UnidadeAssistencial).
4. **Convenios e planos** (Organization + InsurancePlan).
5. **Medicamentos** (formulario institucional, integrado a RxNorm/ANVISA).
6. **Procedimentos** (tabela TUSS + SIGTAP + AMB).
7. **Diagnosticos** (CID-10 com carinho + CID-11 futura).
8. **Fornecedores e contratos** (para farmacia, OPME, engenharia clinica).

O problema hoje: cada sistema legado (Tasy, MV, laboratorio, faturamento) mantem cadastros paralelos com chaves diferentes. Um paciente tem MRN 22145 no Tasy, id 998877 no MV, CPF 123.456.789-00 no faturamento, CNS 700... no modulo SUS. Quando esses sistemas conversam, a correlacao e feita por nome + data de nascimento (fuzzy) — gerando colisao e perda de historico.

Velya resolve isso com **master data management nativo + identidade federada + deduplicacao probabilistica**.

### 3.2 Usuarios

- **Recepcao / Admissao**: cria e atualiza paciente.
- **RH Hospitalar**: cria e atualiza profissional.
- **Diretoria Clinica / TI**: aprova merge de duplicatas.
- **Farmacia Clinica**: mantem formulario institucional de medicamentos.
- **Gerencia Administrativa**: cadastra convenios, contratos, unidades.
- **Auditor interno**: consulta sem editar.

### 3.3 Campos mantidos do Velya

Do modelo `Paciente` existente em `src/lib/types/hospital.ts`:
- `id`, `nomeCompleto`, `nomeSocial`, `dataNascimento`, `sexoBiologico`, `generoIdentificado`, `cpf`, `rg`, `cns`, `mrn`, `telefones`, `emails`, `enderecos`, `alergias`, `medicamentosUso`, `contatosEmergencia`.

Do modelo `ProfissionalSaude`:
- `id`, `nomeCompleto`, `cpf`, `conselhoProfissional` (CRM/COREN/CRF/...), `especialidades`, `statusAtivo`, `hospitalsVinculados`.

### 3.4 Novos campos a adicionar

Para `Paciente`:

```ts
interface PacienteExt {
  // identidades federadas — master data
  identidades: {
    cpf: { valor: string; verificado: boolean; verificadoEm: ISO8601 | null };
    cns: { valor: string; verificado: boolean; verificadoEm: ISO8601 | null };
    rg: { valor: string; uf: string; orgaoEmissor: string } | null;
    passaporte: { numero: string; pais: string } | null;
    identidadeIndigena: { etnia: string; aldeia: string; dseiId: string } | null;
    mrnsLegados: { sistema: string; mrn: string }[]; // para migracao Tasy/MV
  };

  // status LGPD
  lgpd: {
    consentimentoGeralAssinadoEm: ISO8601 | null;
    preferenciaCanalComunicacao: 'APP' | 'SMS' | 'EMAIL' | 'WHATSAPP' | 'NAO_CONTATAR';
    autorizaUsoImagem: boolean;
    autorizaUsoEnsino: boolean;
    autorizaUsoPesquisa: boolean;
  };

  // deduplicacao
  deduplicacao: {
    scoreUltimaVerificacao: number; // 0-1, onde 0 = unico, 1 = duplicata certa
    candidatasDuplicata: { pacienteId: string; score: number; campos: string[] }[];
    ultimaVerificacao: ISO8601;
    mergedInto: string | null; // se foi merged, id do paciente "vencedor"
    mergedFrom: string[]; // ids de pacientes que foram merged DENTRO deste
  };

  // fonte e confianca
  origemDados: 'MANUAL_RECEPCAO' | 'IMPORTACAO_TASY' | 'IMPORTACAO_MV' |
               'API_EXTERNA' | 'CADSUS' | 'AUTO_REGISTRO_APP';
  qualidadeDados: number; // 0-1, calculado com base em campos preenchidos + verificacoes
}
```

Para `ProfissionalSaude`:

```ts
interface ProfissionalSaudeExt {
  conselhoProfissional: {
    tipo: 'CRM' | 'COREN' | 'CRF' | 'CRO' | 'CREFITO' | 'CRN' | 'CRP' | 'CRBM' | 'CRFA';
    numero: string;
    uf: string;
    situacao: 'ATIVO' | 'INATIVO' | 'SUSPENSO' | 'CASSADO';
    dataExpiracao: ISO8601 | null;
    ultimaValidacaoApi: ISO8601;
    especialidades: { codigo: string; descricao: string; rqe?: string }[]; // RQE registro de qualificacao
  }[];

  vinculos: {
    hospitalId: string;
    tipoVinculo: 'CLT' | 'PJ' | 'COOPERADO' | 'ESTAGIARIO' | 'RESIDENTE' | 'PRECEPTOR';
    especialidades: string[];
    unidadesAssistenciais: string[];
    cargaHorariaSemanal: number;
    dataInicio: ISO8601;
    dataFim: ISO8601 | null;
  }[];

  credenciais: {
    fotoOficial: { url: string; hashSha256: string };
    assinaturaDigital: { tipo: 'ICP_A1' | 'ICP_A3' | 'VELYA_SIGNER'; serial: string };
    biometria: { tipo: 'FACE' | 'DIGITAL'; hash: string; ativa: boolean } | null;
    apisHabilitadas: ('PRESCRICAO' | 'ATESTADO' | 'CIRURGIA' | 'CONTROLE_ESPECIAL')[];
  };
}
```

### 3.5 Regras de preenchimento inteligente

- **CPF digitado**: busca no cadastro existente — se encontrar, sugere carregar dados completos com badge `[cadastro existente — revisar]`.
- **CNS digitado**: se nao tem CPF, faz busca reversa no CADSUS por CNS.
- **CEP**: autocomplete de endereco via API ViaCEP + badge `[preenchido automaticamente]`.
- **Validacao ortografica** de nome com base em frequencia nacional (IBGE) — sugere correcoes comuns (JOSe → JOSE, MARiA → MARIA).
- **Foto**: paciente pode enviar via app Velya; recepcao captura via webcam do hospital — imagem sempre otimizada (WebP 480x640).

### 3.6 Validacoes obrigatorias

- **CPF**: algoritmo de validacao + consulta RFB.
- **CNS**: algoritmo (modulo 11).
- **Data de nascimento**: nao pode ser futura, nao > 130 anos no passado.
- **Profissional**: CRM/COREN/CRF validados em tempo real na API do conselho correspondente. Reavaliacao mensal automatica.
- **Deduplicacao** no SAVE: bloqueia criacao se score > 0,85 de duplicata — for~a reconciliacao.
- **Nome social**: aceito em qualquer formato, obrigatorio para uso em documentos se paciente optou (Decreto 8.727/2016).

### 3.7 Alertas e sugestoes

- **Score de duplicata alto**: mostra candidatas + permite "isto e a mesma pessoa" (fluxo de merge).
- **Profissional com RQE proximo da expiracao**: alerta RH + medico 30 dias antes.
- **Paciente sem atualizacao > 12 meses**: sugere revisar cadastro no proximo atendimento.
- **Divergencia entre sistemas**: se paciente tem MRN legado Tasy e recepcao digita dados diferentes dos importados, alerta para reconciliacao.

### 3.8 Permissoes por perfil

| Acao | Recepcao | RH | Farmacia | Admin | Auditor |
|---|---|---|---|---|---|
| Criar paciente | W | - | - | W | - |
| Merge duplicatas | propose | - | - | W (aprovar) | R |
| Criar profissional | - | W | - | W | - |
| Cadastrar convenio | - | - | - | W | R |
| Cadastrar medicamento | - | - | W | - | R |
| Cadastrar OPME | - | - | - | W | R |
| Ver historico de edicoes | R | R | R | R | R |
| Exportar dados LGPD | R (owner) | - | - | W | R |

### 3.9 Status e workflow (deduplicacao de paciente)

```
[NOVO_PACIENTE_CRIADO]
   │
   │ (job async calcula score)
   ▼
[SCORE_CALCULADO]
   │
   ├─── score < 0.3 ────► [UNICO — nenhum candidato]
   ├─── 0.3 < score < 0.85 ──► [REVISAR — lista de candidatos exibida a recepcao]
   │                                │
   │                                ├── (recepcao marca "e o mesmo") ─► [MERGE_PROPOSTO]
   │                                └── (recepcao marca "diferente") ─► [CONFIRMADO_DISTINTO]
   │
   └─── score >= 0.85 ──────► [BLOQUEADO_ATE_REVISAO]
                                    │
                                    ├── (admin aprova merge) ─► [MERGED]
                                    └── (admin confirma distinto) ─► [CONFIRMADO_DISTINTO_ADMIN]

[MERGE_PROPOSTO] ──► [AGUARDA_APROVACAO_ADMIN] ──► [MERGED ou REJEITADO]
```

Regras:
- Merge e sempre reversivel por 30 dias (undo preserva historico das duas identidades).
- Depois de 30 dias, merge e selado mas audit log permanece.

### 3.10 Integracoes

- **CADSUS (DATASUS)**: busca por CNS/CPF.
- **Receita Federal (Serpro)**: validacao CPF.
- **ViaCEP**: enderecos.
- **CFM / COFEN / CRF APIs**: validacao de conselho.
- **CNES (Cadastro Nacional de Estabelecimentos de Saude)**: unidades hospitalares.
- **ANS**: operadoras e planos.
- **ANVISA DataViSA**: medicamentos.
- **SIGTAP (MS)**: procedimentos SUS.

### 3.11 Historico e auditoria

Cada entidade master tem `revisions[]` — cada edicao gera nova revisao completa (nao apenas diff) com hash encadeado. Permite reconstruir qualquer estado em qualquer timestamp.

```ts
interface MasterDataRevision<T> {
  entityType: 'Paciente' | 'Profissional' | 'Hospital' | ...;
  entityId: string;
  revisionNumber: number;
  payload: T; // snapshot completo
  payloadHash: string;
  previousRevisionHash: string;
  editedBy: string;
  editedAt: ISO8601;
  editReason: string; // obrigatorio para edicoes
  source: 'UI' | 'API_IMPORT' | 'MERGE' | 'SYSTEM_ENRICHMENT';
}
```

### 3.12 Melhorias de UX

- **Busca global** `⌘K` busca em todos os cadastros (paciente, profissional, unidade) com ranking por relevancia + ordem "usados recentemente por voce".
- **Cadastro em tela unica** — nao multi-step wizard. Paciente cadastra em 1 tela de 45s.
- **Autocomplete em cima de todas as entidades referenciadas** (endereco, convenio, profissao, procedimento).
- **Deduplicacao inline** — durante digitacao de novo paciente, candidatos aparecem em drawer lateral em tempo real.
- **"Meu cadastro"** no app do paciente — paciente edita proprio endereco, telefone, contato de emergencia, preferencias LGPD (auto-aprovado).
- **Historico de revisoes visivel** — qualquer campo mostra icone de "historico" ao lado; clique exibe quem mudou o que e quando.

### 3.13 Mock logico

```
┌ Novo Paciente ──────────────────────────────────── [ESC] ─┐
│ [CPF][CNS] [Passaporte] [Indigena]                        │
│ CPF: 123.456.789-00  [✓ verificado RFB]                   │
│                                                           │
│ ┌ Possiveis duplicatas (2) ────────────────────────────┐  │
│ │ • MARIA DOS SANTOS SILVA · 61F · MRN 00234891       │  │
│ │   CPF 123.456.789-00 · match 100%                    │  │
│ │   [ver cadastro completo] [carregar para edicao]    │  │
│ │ • M. SILVA · 62F · MRN 00189003                     │  │
│ │   nome 68% + dtNasc 95% · match 72%                  │  │
│ │   [e a mesma pessoa] [diferente]                    │  │
│ └──────────────────────────────────────────────────────┘  │
│                                                           │
│ Nome completo: MARIA DOS SANTOS SILVA                     │
│ Nome social:  [                    ]                      │
│ Data nasc:    15/03/1963                                  │
│ Sexo biolog:  Feminino     Genero: [Feminino ▾]           │
│ CNS:          700123456789012 [buscar CADSUS]             │
│                                                           │
│ Endereco (CEP): 59000-000 — Centro, Natal/RN              │
│ Numero: 234  Complemento: apto 301                        │
│                                                           │
│ Alergias: dipirona (confirmada), AAS (suspeita)           │
│ Medicamentos em uso: losartana, metformina, sinvastatina  │
│                                                           │
│ Consentimento LGPD: [assinatura digital tablet]           │
│                                                           │
│ [Salvar rascunho]         [Cadastrar e iniciar atendim.]  │
└───────────────────────────────────────────────────────────┘
```

### 3.14 Criterios de aceite

- [ ] Deduplicacao bloqueia criacao em score > 0.85 em 100% dos casos.
- [ ] Tempo de cadastro de paciente < 45s mediana.
- [ ] Merge reversivel por 30 dias sem perda de historico.
- [ ] Validacao CRM/COREN/CRF em tempo real com fallback offline + badge `[nao validado agora]`.
- [ ] Historico de revisoes acessivel em 1 clique a partir de qualquer campo.
- [ ] Paciente pode atualizar proprios dados no app com sync automatico.
- [ ] Importacao Tasy/MV mapeia MRN legado em `identidades.mrnsLegados`.
- [ ] Busca `⌘K` responde em < 150ms para 500k pacientes.

### 3.15 Riscos

- **Merge errado** — nunca automatico, sempre humano, reversivel 30d.
- **Dado sensivel exposto em busca** — ACL aplica antes do ranking.
- **Divergencia CADSUS x CPF** — prioriza CPF validado RFB + marca CNS como `precisa_reconciliar`.
- **Profissional com CRM cassado que ainda acessa** — job de re-validacao a cada 24h + revogacao automatica de sessao.

### 3.16 Backlog tecnico

- **Epico MDM-1**: Master Data Management
  - Feature MDM-1.1: Schema de revisoes com hash chain
  - Feature MDM-1.2: Busca global `⌘K` com OpenSearch
  - Feature MDM-1.3: UI de edicao unica
- **Epico MDM-2**: Deduplicacao probabilistica
  - Feature MDM-2.1: Algoritmo Fellegi-Sunter
  - Feature MDM-2.2: UI de reconciliacao
  - Feature MDM-2.3: Merge reversivel
- **Epico MDM-3**: Integracoes mestre
  - Feature MDM-3.1: Cliente CADSUS + cache
  - Feature MDM-3.2: Cliente CFM/COFEN
  - Feature MDM-3.3: Cliente ViaCEP
- **Epico MDM-4**: Migracao Tasy/MV
  - Feature MDM-4.1: ETL import com mapeamento MRN
  - Feature MDM-4.2: Deduplicacao pos-import

### 3.17 Modelo de dados

Ver 3.4 e `MasterDataRevision` em 3.11.

### 3.18 APIs e eventos

**REST:**
- `POST /api/pacientes` — cria
- `PATCH /api/pacientes/:id` — edita (gera revisao)
- `POST /api/pacientes/:id/merge` — propoe merge
- `POST /api/pacientes/merges/:id/aprovar` — aprova merge (admin)
- `POST /api/pacientes/merges/:id/reverter` — reverte merge (< 30d)
- `GET /api/pacientes/:id/revisoes` — historico
- `GET /api/buscar?q=...` — busca global

**NATS:**
- `mdm.paciente.created`, `mdm.paciente.updated`, `mdm.paciente.merged`, `mdm.paciente.merge_reverted`
- `mdm.profissional.credential_revoked` — disparado quando CFM retorna status != ATIVO
- `mdm.duplicate_detected` — { entityType, candidateIds, score }

### 3.19 Metricas

- Taxa de duplicacao (alvo < 0,5%).
- Tempo medio de cadastro.
- Tempo de resposta CADSUS / CFM (SLA < 2s p95).
- Taxa de merge aprovado / rejeitado.
- Numero de revisoes por entidade (detectar edicao excessiva).
- Score medio de qualidade de dados por hospital.

---

## B.4. Cirurgias (acesso restrito)

### 4.1 Objetivo

Modulo para gestao completa do ciclo perioperatorio: agendamento, pre-operatorio (avaliacao clinica, avaliacao anestesica, consentimento cirurgico), checklist de cirurgia segura OMS (3 etapas obrigatorias), registro intra-operatorio (equipe, tempos, implantes, OPMEs, intercorrencias), pos-operatorio (recuperacao, alta da SRPA, evolucao). Atende RDC 36/2013, Portaria GM/MS 529/2013 (seguranca do paciente) e protocolo OMS Safe Surgery Saves Lives.

Acesso restrito porque cirurgia envolve dados sensiveis de alta complexidade, risco de morte, cobranca de alto valor e requer perfil especifico (cirurgiao, anestesista, enfermagem CC/SRPA, preceptor).

### 4.2 Usuarios

- **Cirurgiao principal** e equipe (primeiro auxiliar, segundo auxiliar).
- **Anestesista**.
- **Enfermeiro circulante** e **instrumentador(a)**.
- **Secretaria cirurgica** (agenda).
- **Central de Materiais e Esterilizacao (CME)** — valida materiais.
- **Farmacia** — valida medicamentos SRPA e consumo intraop.
- **Engenharia clinica** — valida equipamentos e implantes.

### 4.3 Campos mantidos do Velya

Nenhum modulo cirurgico existe hoje. Reutiliza `Atendimento` com `tipoAtendimento=CIRURGIA` (introduzido em 1.4), `ProfissionalSaude`, `CareTeam`, `Prescricao`, `RegistroSinaisVitais`.

### 4.4 Novos campos a adicionar

```ts
interface Cirurgia {
  id: string;
  atendimentoId: string; // Atendimento tipo CIRURGIA
  pacienteId: string;

  // agendamento
  agendamento: {
    dataHoraPrevista: ISO8601;
    duracaoPrevistaMinutos: number;
    salaCirurgicaId: string;
    carater: 'ELETIVA' | 'URGENCIA' | 'EMERGENCIA';
    prioridade: 1 | 2 | 3 | 4 | 5;
  };

  // procedimentos (um ato pode ter varios)
  procedimentos: {
    ordem: number;
    codigoTuss: string;
    codigoSigtap: string | null;
    codigoCbhpm: string | null;
    descricao: string;
    especialidadeExecutora: string;
    porte: string; // ANS porte 0-12
    requerImplante: boolean;
    requerOpme: boolean;
  }[];

  // equipe escalada
  equipe: {
    cirurgiaoPrincipalId: string;
    primeiroAuxiliarId: string | null;
    segundoAuxiliarId: string | null;
    anestesistaId: string;
    circulanteId: string;
    instrumentadorId: string | null;
    residentesIds: string[];
    observadorRqeIds: string[]; // preceptor / residente observando
  };

  // pre-operatorio
  preOp: {
    avaliacaoClinicaId: string | null; // EvolucaoClinica tipo PRE_OP
    avaliacaoAnestesicaId: string | null;
    classificacaoAsa: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'E'; // E=emergencia
    risco: {
      escore: 'LEE' | 'GOLDMAN' | 'ACP_RISK' | 'NSQIP';
      valor: string;
      interpretacao: string;
    }[];
    examesPreRequisito: {
      codigoTuss: string;
      solicitadoEm: ISO8601;
      resultadoDisponivel: boolean;
      resultadoValidadoPor: string | null;
    }[];
    consentimentoCirurgicoAssinadoEm: ISO8601 | null;
    consentimentoAnestesicoAssinadoEm: ISO8601 | null;
    jejumInicioEm: ISO8601 | null;
    tricotomiaExecutadaEm: ISO8601 | null;
    antibioticoprofilaxia: {
      prescrita: boolean;
      administradaEm: ISO8601 | null;
      protocolo: string;
      tempoAteIncisaoMinutos: number | null;
    };
    marcacaoSitioCirurgicoFotoUrl: string | null; // foto obrigatoria para lateralidade
  };

  // checklist OMS 3 etapas
  checklistOms: {
    signIn: SignInChecklist; // antes inducao anestesica
    timeOut: TimeOutChecklist; // antes incisao
    signOut: SignOutChecklist; // antes saida do paciente da sala
  };

  // intra-op
  intraOp: {
    entradaSalaEm: ISO8601 | null;
    inducaoAnesteseEm: ISO8601 | null;
    incisaoEm: ISO8601 | null;
    fimCirurgiaEm: ISO8601 | null;
    saidaSalaEm: ISO8601 | null;

    tecnicaAnestesica: 'GERAL' | 'RAQUI' | 'PERIDURAL' | 'LOCAL' |
                       'SEDACAO' | 'COMBINADA';
    viaAcesso: 'ABERTA' | 'VIDEOLAPAROSCOPICA' | 'ROBOTICA' | 'ENDOSCOPICA' | 'PERCUTANEA';

    implantes: {
      codigoAnvisa: string;
      numeroSerie: string;
      lote: string;
      fabricante: string;
      modelo: string;
      tamanho: string;
      dataValidade: ISO8601;
      posicaoAnatomica: string;
      fotoEtiquetaUrl: string;
    }[];

    opmes: {
      codigoTuss: string;
      descricao: string;
      quantidade: number;
      lote: string;
      fornecedor: string;
    }[];

    medicamentosAdministrados: {
      principioAtivo: string;
      dose: string;
      via: string;
      horario: ISO8601;
      responsavelAdmId: string;
    }[];

    sangramentoEstimadoMl: number | null;
    transfusoes: { bolsaId: string; tipoProduto: string; volumeMl: number }[];
    intercorrencias: {
      horario: ISO8601;
      descricao: string;
      condutaTomada: string;
      registradoPor: string;
    }[];

    contagemInstrumentalConferida: boolean;
    contagemGazesConferida: boolean;
    espeacimePatologicoEnviado: {
      codigoLaboratorio: string;
      descricao: string;
      enviadoEm: ISO8601;
    }[];
  };

  // pos-op
  posOp: {
    admissaoSrpaEm: ISO8601 | null;
    altaSrpaEm: ISO8601 | null;
    escalaAldreteInicial: number;
    escalaAldreteSaida: number | null;
    destinoApos: 'ENFERMARIA' | 'UTI' | 'ALTA_HOSPITALAR';
    intercorrenciasSrpa: string[];
    evolucaoPosOpImediataId: string | null; // EvolucaoClinica
  };

  // debriefing
  debriefing: {
    realizadoEm: ISO8601 | null;
    licoesAprendidas: string;
    participantes: string[]; // ids
    assinaturas: { profissionalId: string; assinadoEm: ISO8601 }[];
  };

  status: 'AGENDADA' | 'CONFIRMADA' | 'EM_PREPARO' | 'EM_ANDAMENTO' |
          'EM_SRPA' | 'FINALIZADA' | 'SUSPENSA' | 'CANCELADA';

  motivoSuspensao: string | null;
}

interface SignInChecklist {
  realizadoEm: ISO8601;
  responsavel: string;
  pacienteIdentidadeConfirmada: boolean;
  sitioCirurgicoMarcado: boolean;
  consentimentoCirurgico: boolean;
  consentimentoAnestesico: boolean;
  checkMaquinaAnestesia: boolean;
  oximetriaFuncional: boolean;
  alergiaCconhecida: { presente: boolean; qual: string | null };
  viaAereaDificilPrevisao: boolean;
  riscoSangramento500ml: boolean;
  acessoVenoso2Vias: boolean;
  observacoes: string;
}

interface TimeOutChecklist {
  realizadoEm: ISO8601;
  responsavel: string;
  apresentacaoEquipe: boolean; // todos se apresentam nome+funcao
  confirmacaoPaciente: boolean;
  confirmacaoSitio: boolean;
  confirmacaoProcedimento: boolean;
  antibioticoProfilaxiaUltimos60min: boolean;
  imagensDisponiveis: boolean;
  equipoSurgiuImprevisto: { surgiu: boolean; qual: string | null };
  equipeAnestesicaConfirmou: boolean;
  equipeEnfermagemConfirmou: boolean;
  observacoes: string;
}

interface SignOutChecklist {
  realizadoEm: ISO8601;
  responsavel: string;
  procedimentoRealizadoRegistrado: boolean;
  contagemInstrumentalCorreta: boolean;
  contagemGazesCorreta: boolean;
  identificacaoEspecime: boolean;
  problemasEquipamentoAbordados: boolean;
  pontosAtencaoPosOp: string;
  observacoes: string;
}
```

### 4.5 Regras de preenchimento inteligente

- **Equipe escalada**: sugere com base em escala padrao da sala + especialidade do procedimento.
- **Antibioticoprofilaxia**: sugere protocolo institucional por tipo de cirurgia (limpa, potencialmente contaminada, contaminada, infectada).
- **Classificacao ASA**: nao e auto-preenchida — sempre manual pelo anestesista.
- **Checklist OMS**: NENHUM item auto-preenchido. E obrigatoriedade humana.
- **OPMEs**: sugere kit institucional para o procedimento.

### 4.6 Validacoes obrigatorias (HARD)

- **Checklist Sign-In completo** antes de liberar inducao anestesica (bloqueio hard).
- **Time-Out completo** antes de liberar incisao (bloqueio hard — cirurgiao nao consegue registrar "incisaoEm" sem timeOut).
- **Sign-Out completo** antes de registrar "saidaSalaEm".
- **Contagem de gazes e instrumental conferida** antes de Sign-Out.
- **Marcacao de sitio cirurgico com foto** obrigatoria em procedimentos com lateralidade.
- **Consentimento cirurgico** e **consentimento anestesico** assinados antes de entrada em sala.
- **Exames pre-requisito** com resultado disponivel e validado antes de Sign-In.
- **Antibiotico administrado entre 60min e 15min antes da incisao** para ser valido — fora da janela, alerta.

### 4.7 Alertas e sugestoes

- **Cirurgia sem equipe completa** 2h antes: alerta secretaria.
- **Exame pre-operatorio pendente** 24h antes: alerta cirurgiao + secretaria.
- **Consentimento nao assinado** 1h antes: alerta equipe.
- **Antibiotico administrado fora da janela**: alerta visivel na tela + evento auditado.
- **Suspensao de cirurgia**: requer motivo obrigatorio de lista pre-definida (CFM 1.802/2006) + autoridade (cirurgiao + coordenador CC).

### 4.8 Permissoes por perfil

| Acao | Secretaria | Cirurgiao | Anestesista | Enf Circulante | Instrumentador |
|---|---|---|---|---|---|
| Agendar | W | R | R | R | - |
| Confirmar equipe | W | W | W | W | R |
| Sign-In | - | R | W | W | R |
| Time-Out | - | W | W | W | W |
| Sign-Out | - | W | R | W | W |
| Registrar implante | - | W | R | W | W |
| Assinar debriefing | - | W | W | W | W |

### 4.9 Status e workflow

```
[AGENDADA] ── (equipe confirma 24h antes) ──► [CONFIRMADA]
   │
   ├── (cancelamento) ──► [CANCELADA]
   │
   ▼
[EM_PREPARO] ── (paciente entra em sala, Sign-In completo) ──► [EM_ANDAMENTO]
   │
   │ (Time-Out ... incisao ... fim cirurgia ... Sign-Out)
   ▼
[EM_SRPA] ── (alta SRPA) ──► [FINALIZADA]

[*] ── (intercorrencia) ──► [SUSPENSA] ── (reagendada ou cancelada)
```

### 4.10 Integracoes

- **CME (Central de Materiais)** — integracao para validar ciclos de esterilizacao dos materiais.
- **ANVISA implantes** — validacao de codigo + numero de serie.
- **Patologia** — envio automatico de especime com etiqueta gerada.
- **Faturamento TISS** — envio de guia de OPME e honorarios.
- **Banco de sangue** — reserva e dispensacao.

### 4.11 Historico e auditoria

Cadeia de hash especifica para cirurgia — todos os timestamps (entrada sala, inducao, incisao, fim, saida sala) sao ancorados em TSA ICP-Brasil para que nao possam ser alterados retroativamente.

Toda suspensao gera evento + revisao pelo Nucleo de Seguranca do Paciente (NSP).

### 4.12 Melhorias de UX

- **Tela de sala cirurgica full-screen** com timer ao vivo desde incisao, cronometro reverso de antibiotico, painel de sinais vitais do paciente.
- **Checklist modal com leitura em voz alta** — circulante le e marca enquanto equipe confirma.
- **Registro por voz** (Velya Voice Dictation) para intercorrencias durante cirurgia — mao suja, circulante digita.
- **Scanner de codigo de barras / RFID** para implantes e OPMEs (evita digitacao).
- **Foto obrigatoria** da etiqueta do implante — OCR extrai lote e validade.
- **Painel de tempos** — tempo de cirurgia, tempo de anestesia, tempo de sala — comparado a media do procedimento.

### 4.13 Mock logico

```
┌ Sala 03 — Colecistectomia Videolaparoscopica — Maria Santos ─ ⎔ ──┐
│ Status: EM_ANDAMENTO      Incisao: 08:47:22 (ha 1:14:08)          │
│ Equipe: Dr Pedro (cirurgiao) · Dr Julia (anest) · Enf Ana (circ)  │
│                                                                   │
│ ┌ Sinais vitais ────────────────────┐ ┌ Antibiotico ────────────┐ │
│ │ PA 128x78 · FC 72 · Sat 99%       │ │ Cefazolina 2g EV        │ │
│ │ EtCO2 38 · FiO2 0.4 · Temp 36.3   │ │ Administrado: 08:18     │ │
│ │                                   │ │ Redose em: 02:29:12     │ │
│ └───────────────────────────────────┘ └─────────────────────────┘ │
│                                                                   │
│ ┌ Checklist ─────────────────────────────────────────────────────┐│
│ │ [✓] Sign-In (Enf Ana, 08:02)                                   ││
│ │ [✓] Time-Out (Dr Pedro, 08:43)                                 ││
│ │ [ ] Sign-Out                                                   ││
│ └────────────────────────────────────────────────────────────────┘│
│                                                                   │
│ ┌ Implantes / OPMEs ─────────────────────────────────────────────┐│
│ │ [+ escanear codigo] [foto etiqueta]                            ││
│ │ • Clipes titanio Ethicon · Lote ABC123 · 6un                   ││
│ └────────────────────────────────────────────────────────────────┘│
│                                                                   │
│ ┌ Intercorrencias ───────────────────────────────────────────────┐│
│ │ [+ registrar por voz]                                          ││
│ │ 08:52 Adesao vesicular importante — prolongou diseccao         ││
│ └────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

### 4.14 Criterios de aceite

- [ ] Sign-In/Time-Out/Sign-Out todos bloqueiam respectivas transicoes sem preenchimento 100%.
- [ ] Foto de marcacao de sitio obrigatoria em procedimentos lateralizados (bloqueio hard).
- [ ] Antibioticoprofilaxia fora da janela gera alerta + evento auditado.
- [ ] Implantes registrados via scan de barcode/RFID em 90% dos casos.
- [ ] Debriefing assinado por todos participantes antes de encerrar atendimento.
- [ ] Tempo medio Sign-In < 4min; Time-Out < 2min; Sign-Out < 3min.
- [ ] Integracao ANVISA implantes valida em tempo real.
- [ ] Cancelamento/suspensao obriga motivo estruturado + revisao NSP.

### 4.15 Riscos

- **Cirurgia em lado errado (wrong-site surgery)** — mitigado por foto + Time-Out.
- **Retencao de corpo estranho** — mitigado por contagem obrigatoria pre/pos.
- **Erro de implante** — mitigado por scan + foto etiqueta + validacao ANVISA.
- **Infeccao de sitio cirurgico** — mitigado por controle rigoroso de janela de antibiotico + tricotomia.
- **Acesso indevido** — ACL restrita a equipe da cirurgia + supervisao.

### 4.16 Backlog tecnico

- **Epico CIR-1**: Modulo cirurgico base
  - Feature CIR-1.1: Modelo de dados `Cirurgia`
  - Feature CIR-1.2: Agendamento + sala cirurgica
  - Feature CIR-1.3: UI tela de sala
- **Epico CIR-2**: Checklist OMS 3 etapas
  - Feature CIR-2.1: Sign-In com bloqueio hard
  - Feature CIR-2.2: Time-Out com apresentacao de equipe
  - Feature CIR-2.3: Sign-Out com contagem
- **Epico CIR-3**: Implantes e OPMEs
  - Feature CIR-3.1: Scanner barcode/RFID
  - Feature CIR-3.2: OCR de etiqueta
  - Feature CIR-3.3: Integracao ANVISA
- **Epico CIR-4**: Debriefing e indicadores
  - Feature CIR-4.1: Debriefing assinado
  - Feature CIR-4.2: Tempos e benchmarks
  - Feature CIR-4.3: Indicadores NSP

### 4.17 Modelo de dados

Ver `Cirurgia`, `SignInChecklist`, `TimeOutChecklist`, `SignOutChecklist` em 4.4.

### 4.18 APIs e eventos

**REST:**
- `POST /api/cirurgias` — agenda
- `POST /api/cirurgias/:id/sign-in` — marca Sign-In
- `POST /api/cirurgias/:id/time-out` — marca Time-Out
- `POST /api/cirurgias/:id/incisao` — marca timestamp (bloqueado se timeOut incompleto)
- `POST /api/cirurgias/:id/sign-out` — marca Sign-Out
- `POST /api/cirurgias/:id/implantes` — adiciona implante
- `POST /api/cirurgias/:id/intercorrencias` — registra
- `POST /api/cirurgias/:id/debriefing` — fecha

**NATS:**
- `surgical.cirurgia.scheduled`, `surgical.cirurgia.confirmed`, `surgical.cirurgia.started`
- `surgical.checklist.signin_completed`, `surgical.checklist.timeout_completed`, `surgical.checklist.signout_completed`
- `surgical.implante.registered` — { cirurgiaId, codigoAnvisa, serial }
- `surgical.intercorrencia.reported`
- `surgical.cirurgia.suspended`, `surgical.cirurgia.finalized`

### 4.19 Metricas

- Taxa de compliance checklist OMS (alvo 100%).
- Taxa de Sign-In/Out completo (alvo 100%).
- Tempo medio de cada etapa.
- Taxa de antibiotico na janela correta.
- Taxa de cirurgia suspensa (alvo decrescente).
- Taxa de retencao de corpo estranho (alvo 0).
- Taxa de infeccao de sitio cirurgico (benchmark Anahp).
- Tempo SRPA medio por procedimento.

---

## B.5. Diagnostico com CID e Prescricoes vinculadas

### 5.1 Objetivo

Modulo de registro de diagnostico clinico com CID-10 (e preparado para CID-11), permitindo **vincular prescricoes, exames, procedimentos e protocolos ao diagnostico**, garantindo rastreabilidade do raciocinio clinico: "por que esta prescricao existe?" sempre tem resposta ligada a um diagnostico.

Hoje Velya tem `cidPrincipal` e `cidsSecundarios` como strings simples na Internacao. A proposta e transformar em entidade rica com:

- Historico de diagnosticos (inclusive provisorios → definitivos).
- Grau de certeza (suspeito / provavel / confirmado / descartado).
- CID por ocorrencia (cada diagnostico vira evento registravel, datavel).
- Vinculacao bidirecional entre diagnostico e prescricao/exame/procedimento.

### 5.2 Usuarios

- **Medico assistente** (escreve).
- **Residente** (escreve com preceptor).
- **Farmacia clinica** (le para validar prescricao).
- **Faturamento** (le para cobranca).
- **Auditor medico** (le para revisao de caso).

### 5.3 Campos mantidos

De `Internacao`: `cidPrincipal`, `cidsSecundarios`.

### 5.4 Novos campos

```ts
interface Diagnostico {
  id: string;
  atendimentoId: string;
  pacienteId: string;
  registradoPorId: string;

  codigoCid10: string; // e.g., "I21.4"
  codigoCid11: string | null;
  codigoCiap2: string | null; // atencao primaria
  descricaoOficial: string; // descricao padronizada
  descricaoLocal: string | null; // como o medico descreveu no prontuario

  grauCerteza: 'SUSPEITO' | 'PROVAVEL' | 'CONFIRMADO' | 'DESCARTADO' | 'EM_INVESTIGACAO';
  papel: 'PRINCIPAL' | 'SECUNDARIO' | 'COMORBIDADE' | 'COMPLICACAO' |
         'DIAGNOSTICO_DIFERENCIAL' | 'ADMISSAO' | 'ALTA';

  registradoEm: ISO8601;
  confirmadoEm: ISO8601 | null;
  descartadoEm: ISO8601 | null;
  descartadoPor: string | null;
  motivoDescarte: string | null;

  evidencias: {
    tipo: 'EXAME_LAB' | 'EXAME_IMAGEM' | 'HISTORIA_CLINICA' |
          'EXAME_FISICO' | 'ANATOMIA_PATOLOGICA' | 'TESTE_TERAPEUTICO';
    referenciaId: string;
    descricaoResumo: string;
  }[];

  // vinculacoes
  prescricoesVinculadas: string[];
  examesSolicitadosVinculados: string[];
  procedimentosVinculados: string[];
  protocolosInstitucionaisAplicados: string[];

  // diagnostico diferencial
  diagnosticosDiferenciais: {
    codigoCid10: string;
    descricao: string;
    probabilidadeRelativa: 'ALTA' | 'MEDIA' | 'BAIXA';
    argumentosPro: string;
    argumentosContra: string;
  }[];

  // CID de notificacao compulsoria (Portaria 204/2016)
  notificacaoCompulsoria: {
    requerida: boolean;
    tipoNotificacao: 'IMEDIATA' | 'SEMANAL' | 'MENSAL' | null;
    notificadoSinanEm: ISO8601 | null;
    protocoloSinan: string | null;
  };

  // LGPD — CID sensivel
  sensivel: boolean; // HIV, saude mental, aborto legal, violencia, identidade de genero
  restricaoVisibilidade: 'PADRAO' | 'RESTRITA_EQUIPE_DIRETA' | 'CONFIDENCIAL';
}
```

### 5.5 Regras de preenchimento inteligente

- **Autocomplete CID-10** com ranking por:
  1. CIDs mais frequentes na especialidade do medico.
  2. CIDs do pre-diagnostico do atendimento.
  3. CIDs previos do paciente (recorrencia).
  4. CIDs ligados a queixa principal digitada.
- **Sugestoes de CID secundario** baseadas em CID principal (e.g., DM2 → sugere HAS, dislipidemia, nefropatia).
- **Diagnostico diferencial** sugerido por motor clinico (opt-in, sem decisao automatica).

### 5.6 Validacoes

- **CID principal obrigatorio** na admissao e na alta (pode ser diferentes).
- **Um e somente um CID com papel=PRINCIPAL** por atendimento por vez (historico pode ter varios).
- **CID invalido** (codigo nao existe no CID-10 oficial OMS/DATASUS) bloqueia salvamento.
- **CID de sexo especifico** (O e Z37 femininos, C60-C63 masculinos) valida contra sexo biologico do paciente.
- **CID de idade especifica** (ex P00-P96 periodo perinatal) valida contra idade.

### 5.7 Alertas e sugestoes

- **CID novo nao vinculado a prescricao/exame** em 24h: alerta "este diagnostico ainda nao tem plano terapeutico registrado?".
- **CID principal mudou** sem registro de evolucao justificando: alerta "mudanca de diagnostico sem evolucao — registrar justificativa".
- **Notificacao compulsoria pendente** para CIDs SINAN (H1N1, sarampo, dengue grave, TB, hanseniase): alerta automatico.
- **Discrepancia entre CID admissao e CID alta**: alerta para registrar em evolucao de alta.

### 5.8 Permissoes

| Acao | Medico | Residente | Farmacia | Faturamento |
|---|---|---|---|---|
| Registrar | W | W (preceptor valida) | - | - |
| Confirmar | W | preceptor | - | - |
| Descartar | W (autor) | preceptor | - | - |
| Ver CID sensivel | se no CareTeam | se no CareTeam | se prescricao ativa | se minimo necessario |

### 5.9 Workflow

```
[SUSPEITO] ──► [EM_INVESTIGACAO] ──► [PROVAVEL] ──► [CONFIRMADO]
     │                 │                                 │
     │                 └──► [DESCARTADO com motivo]      │
     │                                                    │
     └── (nunca volta para SUSPEITO — mudanca de hipotese gera NOVO diagnostico)
```

### 5.10 Integracoes

- **DATASUS CID-10** (tabela oficial).
- **OMS CID-11** (futura).
- **SINAN** — notificacao compulsoria automatica.
- **RNDS Condition FHIR** — envio.

### 5.11 Historico e auditoria

Cada mudanca de grau de certeza, de papel, ou de codigo gera nova revisao. Mudanca de CID principal requer justificativa em evolucao vinculada.

### 5.12 Melhorias de UX

- **Widget "Diagnosticos" sticky** na tela do Patient Cockpit, com CIDs ativos + badge de certeza + linhas mostrando vinculacoes.
- **Grafo visual de diagnosticos e prescricoes** (opcional, em tab separada) — mostra como cada prescricao esta ligada a um CID.
- **Busca CID com sinonimos populares** ("pressao alta" → I10, "acucar alto" → E11, "derrame" → I63).
- **Favoritos por medico** — CIDs mais usados aparecem primeiro.
- **Atalho `D` em evolucao** abre seletor de CID.

### 5.13 Mock logico

```
┌ Diagnosticos — Maria Santos ─────────────────────────────────────┐
│ Ativos:                                                          │
│ • I21.4 Infarto agudo do miocardio subendocardico [CONFIRMADO]   │
│   Principal · Registrado 12/04 08:30 · Dr Pedro                  │
│   └ Prescricoes: AAS 100mg, clopidogrel 75mg, atorva 80mg (+5)   │
│   └ Exames: troponina seriada, ecocardiograma, CATE              │
│                                                                  │
│ • I10 Hipertensao essencial [CONFIRMADO · comorbidade]           │
│   └ Prescricoes: losartana 50mg                                  │
│                                                                  │
│ • E11 Diabetes tipo 2 [CONFIRMADO · comorbidade]                 │
│   └ Prescricoes: metformina 850mg, insulina NPH                  │
│                                                                  │
│ Diagnostico diferencial ativos:                                  │
│ • I20.0 Angina instavel [DESCARTADO — troponina elevada]         │
│                                                                  │
│ [+ novo diagnostico]  [ver grafo]  [notificacao SINAN]           │
└──────────────────────────────────────────────────────────────────┘
```

### 5.14 Criterios de aceite

- [ ] Autocomplete CID retorna top-5 em < 200ms.
- [ ] Validacao sexo/idade do CID impede salvar caso invalido.
- [ ] Vinculacoes bidirecionais visiveis em diagnostico E em prescricao.
- [ ] Notificacao SINAN automatica para CIDs da lista.
- [ ] CID sensivel aplica ACL extra.
- [ ] Mudanca de CID principal exige evolucao justificativa.

### 5.15 Riscos

- **Sobre-codificacao** para cobranca maior — auditoria de coerencia entre CID e prescricao/exame.
- **Sub-codificacao** de comorbidade — sistema sugere baseado em medicacoes ativas.
- **CID errado copiado** de atendimento anterior — badge `[herdado]` e exige revisao.

### 5.16 Backlog

- **Epico DX-1**: Entidade `Diagnostico`
- **Epico DX-2**: Autocomplete CID com ranking
- **Epico DX-3**: Vinculacao bidirecional
- **Epico DX-4**: Notificacao SINAN
- **Epico DX-5**: Grafo visual

### 5.17 Modelo de dados

Ver 5.4.

### 5.18 APIs

- `POST /api/diagnosticos`, `PATCH /api/diagnosticos/:id`, `POST /api/diagnosticos/:id/descartar`
- `clinical.diagnostico.registered`, `clinical.diagnostico.confirmed`, `clinical.diagnostico.discarded`
- `regulatory.sinan.notified`

### 5.19 Metricas

- Taxa de CID confirmado em 48h.
- Taxa de notificacao SINAN em prazo.
- Cobertura de prescricao vinculada a CID.
- Taxa de mudanca de CID principal.

---

## B.6. Evolucao Medica (CORE)

**Esta e a implementacao mais critica. Detalhamento 2x.**

### 6.1 Objetivo

A Evolucao Medica e o registro narrativo estruturado do raciocinio clinico do medico em cada contato com o paciente. E o coracao do prontuario, a fonte primaria para continuidade do cuidado e o documento legal mais importante do atendimento. Tambem e o maior consumidor de tempo do medico — e onde Velya pode ter o maior impacto.

Objetivos especificos:

1. **Reducao de 40-60% no tempo por evolucao** via smart phrases, autocomplete CID/medicamento/exame, preenchimento de contexto longitudinal, reutilizacao assistida com diff.
2. **Qualidade textual auditavel** — diff minimo de mudanca em evolucoes seguenciais para detectar copia-cola irrefletida.
3. **Estrutura SOAP obrigatoria** (Subjetivo / Objetivo / Avaliacao / Plano) com expansoes institucionais.
4. **Assinatura digital ICP-Brasil** por evolucao.
5. **Vinculacao bidirecional** com diagnosticos, prescricoes, exames, sinais vitais.
6. **Timeline-first** — evolucao aparece como evento na timeline do Patient Cockpit, nao em tela separada.
7. **Dictation + IA assistiva** (opcional) — medico dita e IA gera draft; revisao humana obrigatoria antes de assinar.

### 6.2 Usuarios

- **Medico assistente**: autor principal.
- **Residente**: autor com preceptor revisor.
- **Preceptor / cirurgiao supervisor**: revisa e co-assina.
- **Medico parecerista**: cria evolucoes de parecer vinculadas.
- **Equipe de enfermagem**: le (sem edicao).
- **Paciente**: le resumo leigo via app (campo dedicado).
- **Auditor medico / CRM**: revisa.

### 6.3 Campos mantidos do Velya

De `EvolucaoClinica` existente:
- `id`, `pacienteId`, `atendimentoId` (ex `internacaoId`), `profissionalId`, `tipo`, `texto`, `criadaEm`.

### 6.4 Novos campos

```ts
interface EvolucaoClinica {
  id: string;
  atendimentoId: string;
  pacienteId: string;
  autorId: string;
  autorCrm: { numero: string; uf: string; especialidade: string };

  // tipo da evolucao
  tipo: 'ADMISSAO' | 'DIARIA' | 'INTERCORRENCIA' | 'PARECER' |
        'PRE_OPERATORIA' | 'POS_OPERATORIA' | 'ALTA' |
        'TRANSFERENCIA' | 'OBITO' | 'AMBULATORIAL' | 'EMERGENCIA' |
        'SEGUIMENTO' | 'EVOLUCAO_ENFERMAGEM' | 'EVOLUCAO_MULTI';

  // co-autoria (residente + preceptor)
  coAutorId: string | null;
  coAssinaturaRequerida: boolean;
  coAssinadaEm: ISO8601 | null;
  coAssinaturaHash: string | null;

  // estrutura SOAP
  soap: {
    subjetivo: {
      queixaPrincipal: string;
      historiaDoencaAtual: string;
      revisaoSistemas: string;
      historicoMedicoRelevante: string;
    };
    objetivo: {
      exameFisicoGeral: string;
      sinaisVitaisSnapshot: { /* refs a RegistroSinaisVitais */ registroIds: string[] };
      examesLaboratoriaisReferenciados: { solicitacaoId: string; destaque: string }[];
      examesImagemReferenciados: { solicitacaoId: string; destaque: string }[];
      aparelhosExame: {
        cardiovascular: string;
        respiratorio: string;
        abdomen: string;
        neurologico: string;
        membros: string;
        pele: string;
        outros: string;
      };
    };
    avaliacao: {
      sintese: string;
      diagnosticosReferenciados: { diagnosticoId: string; papel: string }[];
      hipoteseDiagnostica: string;
      problemaPrincipal: string;
      problemasSecundarios: string[];
    };
    plano: {
      condutaImediata: string;
      prescricoesReferenciadas: string[]; // prescricoesIds
      examesSolicitadosReferenciados: string[];
      procedimentosReferenciados: string[];
      interconsultasReferenciadas: string[];
      orientacoesPaciente: string;
      previsaoRevisao: ISO8601;
    };
  };

  // expansoes institucionais (protocolos locais)
  expansoes: {
    protocoloId: string;
    camposPreenchidos: Record<string, any>;
  }[];

  // reutilizacao e diff
  baseadaEm: string | null; // id da evolucao anterior do mesmo autor+paciente
  tipoReutilizacao: 'NOVA' | 'SEGUIMENTO_SOAP' | 'DUPLICACAO_ASSISTIDA' | null;
  diffDaBase: {
    linhasAdicionadas: number;
    linhasRemovidas: number;
    linhasAlteradas: number;
    percentualMudanca: number;
    aprovadoAssinatura: boolean; // falso bloqueia
  } | null;

  // smart phrases utilizadas
  smartPhrasesExpandidas: {
    atalho: string; // e.g., ".evolucaoUTIdia"
    expandidoComoTexto: string;
    placeholdersResolvidos: Record<string, any>;
  }[];

  // IA assistiva
  iaAssistida: {
    utilizouDitado: boolean;
    modeloUtilizado: string | null; // e.g., "velya-clinical-llm-v2"
    confidenciaMedia: number | null; // 0-1
    trechosRevisadosMann: string[]; // trechos que medico alterou apos draft IA
    tempoDoDraftAoAssinado: number | null; // segundos
  } | null;

  // resumo leigo (para paciente)
  resumoLeigo: {
    textoSimples: string;
    geradoEm: ISO8601;
    revisadoPor: string;
  } | null;

  // assinatura
  assinatura: {
    tipo: 'ICP_BRASIL_A1' | 'ICP_BRASIL_A3' | 'VELYA_SIGNER_PIN';
    hashEvolucao: string;
    assinadoEm: ISO8601;
    certificadoSerial: string;
    timestampToken: string;
  } | null;

  // status
  status: 'RASCUNHO' | 'AGUARDANDO_COASSINATURA' | 'ASSINADA' | 'COMPLEMENTADA' | 'REVOGADA';

  // complementacao (quando autor adiciona depois)
  complementos: {
    texto: string;
    adicionadoPor: string;
    adicionadoEm: ISO8601;
    assinaturaHash: string;
  }[];

  // LGPD
  restricaoVisibilidade: 'PADRAO' | 'RESTRITA' | 'CONFIDENCIAL';

  criadaEm: ISO8601;
  atualizadaEm: ISO8601;
  assinadaEm: ISO8601 | null;

  // tempos (medidos para metrica)
  tempos: {
    abertoEm: ISO8601;
    primeiraInteracaoEm: ISO8601;
    assinadaApos: number; // segundos
  };
}
```

### 6.5 Regras de preenchimento inteligente

**Contexto automatico ao abrir evolucao:**
- Painel direito "Contexto Clinico" ja pre-carregado com: nome, idade, sexo, CID principal, alergias, medicamentos ativos, ultimos 3 sinais vitais, ultimo exame relevante, ultima evolucao do mesmo autor (link rapido).
- Sinais vitais do dia (ultimo registro de cada parametro) automaticamente referenciados em `sinaisVitaisSnapshot` com badge `[auto-referenciado]`. Medico pode remover ou adicionar mais.
- Exames resultados dentro de 24h automaticamente referenciados em `examesLaboratoriaisReferenciados` e `examesImagemReferenciados`. Medico seleciona quais destacar.

**Smart phrases (institucionais + pessoais):**
- Institucional: `.evolucaoUTI`, `.evolucaoEnfermaria`, `.altaAmbulatorial`, `.atestadoPadrao`, `.parecerCardio`, `.preOpCirurgia`, `.avaliacaoRisco`, `.dorToracica`, `.dispneia`.
- Pessoal do medico: `.minhaEvolucaoDiab`, `.hipertensoControle` — cada medico cria as suas.
- Placeholders resolvidos automaticamente: `{paciente.nome}`, `{paciente.idade}`, `{atendimento.diasInternacao}`, `{sinaisVitais.ultimaPA}`, `{medicamentos.ativosLista}`, `{exames.ultimaTroponina}`.

**Autocomplete em linha:**
- CID-10 (atalho `D:`) com ranking.
- Medicamento (atalho `M:`) via RxNorm + formulario institucional.
- Exame (atalho `E:`) via TUSS.
- Procedimento (atalho `P:`) via TUSS+SIGTAP+AMB.

**Reutilizacao assistida:**
- Se existe evolucao anterior do mesmo autor+paciente no mesmo atendimento, botao "Partir de anterior" pre-carrega estrutura e pede diff minimo.
- Nunca pre-carrega o campo Subjetivo integralmente (e o mais volatil).
- Objetivo e carregado como draft com "referencia atualizada de sinais/exames novos".

**IA assistiva (ditado):**
- Medico clica `⌘D`, fala livremente por 30-120s.
- Modelo LLM clinico (`velya-clinical-llm`, fine-tuned em 5M evolucoes anonimizadas + glossarios medicos BR) estrutura em SOAP.
- Confidencia < 0.75 em qualquer campo: badge `[revisar — baixa confianca]`.
- Trechos que o medico **NAO altera** apos draft IA sao marcados como `trechosRevisadosMann: false` — metrica interna para avaliar qualidade do modelo.
- Assinatura digital requer medico ter interagido com cada secao (scroll ou edicao) — nao pode assinar draft sem ter visto.

### 6.6 Validacoes obrigatorias

- **SOAP completo** em evolucoes tipo `DIARIA`, `ADMISSAO`, `ALTA`, `AMBULATORIAL`. Campos minimos: subjetivo>=30 chars, objetivo>=50 chars, avaliacao>=30 chars, plano>=40 chars.
- **Assinatura digital ICP-Brasil** para marcar como `ASSINADA`. Nao existe "evolucao sem assinatura entregue" — rascunho permanece rascunho ate assinatura.
- **Diff minimo 15%** (ajustavel por especialidade) em evolucao seguimento reutilizada. Abaixo disso, bloqueio de assinatura com mensagem "esta evolucao tem X% de mudanca em relacao a anterior — revise antes de assinar". Ajustavel para 25% em UTI, 10% em ambulatorial.
- **Co-assinatura de preceptor** obrigatoria para evolucoes de residente em 24h.
- **Referencia a pelo menos 1 diagnostico** em evolucao de admissao e alta.
- **Previsao de revisao** preenchida em evolucoes de internacao.

### 6.7 Alertas e sugestoes

- **Copia-cola detectada** (diff < 15%): banner "atencao — esta evolucao reproduz >85% do texto anterior. Revise antes de assinar."
- **Evolucao ausente ha > 24h** em paciente internado: task automatica ao medico assistente + escalonamento ao plantonista se nao executada.
- **Sinal vital alterado ha > 4h sem evolucao**: alerta ao medico.
- **Resultado de exame critico disponivel ha > 1h sem referencia em evolucao**: alerta.
- **Co-assinatura pendente ha > 18h**: alerta ao preceptor.
- **Prescricao ativa sem diagnostico vinculado**: sugere adicionar CID na avaliacao.

### 6.8 Permissoes

| Acao | Medico | Residente | Preceptor | Enfermagem | Paciente |
|---|---|---|---|---|---|
| Criar rascunho | W | W | W | - | - |
| Assinar | W | W (+coassin.) | W | - | - |
| Co-assinar | W (se preceptor) | - | W | - | - |
| Ver integral | se no CareTeam | se no CareTeam | se responsavel | R | - |
| Ver resumo leigo | - | - | - | - | R (owner) |
| Complementar | W (autor) | W (autor) | W | - | - |
| Revogar | W (autor) | W (com preceptor) | W | - | - |

### 6.9 Workflow

```
[RASCUNHO] ── auto-save a cada 3s ──► [RASCUNHO persistido]
    │
    ├── (residente) ──► [AGUARDANDO_COASSINATURA] ──► (preceptor assina) ──► [ASSINADA]
    │                                                                            │
    └── (medico) ──► [ASSINADA]                                                  │
                           │                                                      │
                           ├── (autor complementa em 24h) ──► [COMPLEMENTADA]    │
                           │                                                      │
                           └── (autor revoga em 24h, raro) ──► [REVOGADA]        │
                                                                                  │
                              (apos 24h e imutavel — apenas complemento com assinatura nova)
```

### 6.10 Integracoes

- **ICP-Brasil** para assinatura.
- **RxNorm / ANVISA** para autocomplete medicamento.
- **CID-10/11** para autocomplete diagnostico.
- **TUSS / SIGTAP / AMB** para procedimentos.
- **Motor IA clinico** (velya-clinical-llm) hospedado on-prem ou em VPC privada (dados do paciente nao saem).
- **RNDS** — envio FHIR `Composition` do tipo Progress Note.
- **Portal do Paciente** — resumo leigo.

### 6.11 Historico e auditoria

- Toda assinatura gera hash encadeado.
- Toda complementacao gera nova entrada com assinatura propria, sem alterar a original.
- Revogacao preserva texto original com marca `[REVOGADA em X por Y — motivo]`.
- Diff visual entre evolucoes seguenciais disponivel em 1 clique.
- Auditoria mostra: quem abriu, quando, quanto tempo ficou aberto, se usou IA, % de edicao do draft IA, quais smart phrases expandiu.

### 6.12 Melhorias de UX especificas

**Editor split-pane:**
- Esquerda: campos SOAP estruturados com autocomplete inline.
- Direita: Contexto Clinico + sugestoes de IA + smart phrases disponiveis.
- Top: header de paciente sticky.
- Bottom: barra de acoes (salvar rascunho, visualizar PDF, assinar).

**Markdown clinico:**
- Suporte a bold, italic, listas, headers. Sem imagens inline (seguranca), mas permite anexar imagem em documentos.

**Preview da evolucao final:**
- Clicar "visualizar" abre render PDF com timbrado do hospital, dados do medico, hash.

**Keyboard shortcuts:**
- `⌘Enter` — salvar rascunho.
- `⌘Shift+Enter` — assinar e enviar.
- `⌘D` — iniciar ditado.
- `⌘Shift+P` — abrir smart phrase picker.
- `⌘/` — inserir CID (abre autocomplete).
- `⌘M` — inserir medicamento.
- `⌘E` — inserir exame.

**Timer e metricas visiveis:**
- Tempo desde abertura.
- % de progresso estimado (baseado em campos preenchidos).
- Tempo medio do autor neste tipo de evolucao (referencia).

**Offline mode:**
- Rascunho persiste em IndexedDB — se perder conexao, dados seguros; sync automatico ao reconectar.

**Assinatura em 2 cliques:**
- Clique "Assinar" → modal confirma resumo + aciona Velya Signer mobile (PIN + biometria) → evolucao marcada como ASSINADA.

**Resumo leigo automatico:**
- Botao "Gerar resumo para paciente" — IA gera versao em linguagem simples em 5s.
- Medico revisa (max 30s) e aprova antes de enviar ao portal.

### 6.13 Mock logico

```
┌ Evolucao — Maria Santos · Atendimento AT-2026041200473 ──────── [ESC] ┐
│ Tipo: DIARIA · 12/04/2026 08:35 · Dr Pedro Araujo · CRM/RN 12345     │
│ Status: RASCUNHO · Autosave 08:36:12                                  │
│ ───────────────────────────────────────────────────────────────────── │
│ ┌ SOAP ─────────────────────────────────┐ ┌ Contexto Clinico ───────┐ │
│ │ S: Subjetivo                          │ │ 61F · I21.4 (IAM subendo│ │
│ │ .queixaEvolucao[tab]                  │ │ HAS, DM2, dislipidemia  │ │
│ │ > paciente relata dor toracica leve  │ │                          │ │
│ │ > episodica, melhorando com repouso.  │ │ Em uso:                  │ │
│ │ > Nega dispneia ou sudorese.          │ │ - AAS 100mg              │ │
│ │                                        │ │ - clopidogrel 75mg      │ │
│ │ O: Objetivo                           │ │ - atorvastatina 80mg    │ │
│ │ SV: PA 128x78, FC 72, Sat 99%          │ │ - enoxaparina 40mg 12/12│ │
│ │ Ex fis: regular estado geral, LOTE,   │ │                          │ │
│ │ corado, hidratado, afebril.           │ │ SV 08:00 (enf Ana):      │ │
│ │ ACV: RCR 2T, BNF, sem sopros.         │ │ PA 128x78 FC 72          │ │
│ │ AR: MVF bilateral, sem RA.            │ │ Sat 99% Temp 36.5        │ │
│ │ Abd: flacido, indolor, RHA+.          │ │                          │ │
│ │ MMII: sem edema.                      │ │ Ult exame 06:00:         │ │
│ │                                        │ │ Tn 0.8 ng/ml (pico 1.2) │ │
│ │ A: Avaliacao                          │ │ decrescendo.             │ │
│ │ IAM subendocardico (I21.4) — 3 dias   │ │                          │ │
│ │ de pos infarto, estavel.              │ │ Ult evolucao 11/04 20:14 │ │
│ │ HAS e DM2 controladas.                │ │ [ver]                    │ │
│ │                                        │ │                          │ │
│ │ P: Plano                              │ │ ┌─ Sugestao IA ────────┐ │ │
│ │ - mantem AAS + clopidogrel            │ │ │ Draft SOAP disponivel│ │ │
│ │ - considerar alta em 24h se evolucao  │ │ │ [ver e revisar]     │ │ │
│ │   favoravel e CATE sem lesao residual │ │ └──────────────────────┘ │ │
│ │ - ECG hoje + perfil lipidico          │ │                          │ │
│ └────────────────────────────────────────┘ └──────────────────────────┘ │
│                                                                         │
│ Diff da base: +34 linhas, -28 linhas, 52% mudanca ✓                    │
│                                                                         │
│ [Salvar rascunho]  [Ditar ⌘D]  [Smart phrases ⌘SP]  [Assinar ⌘⇧⏎]     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.14 Criterios de aceite

- [ ] Tempo mediano de evolucao DIARIA em paciente internado: < 3min (vs Tasy ~8min).
- [ ] Tempo mediano de evolucao ADMISSAO: < 6min.
- [ ] Diff < 15% bloqueia assinatura em 100% dos casos.
- [ ] Co-assinatura de residente obrigatoria em 24h com alerta.
- [ ] Auto-save a cada 3s sem perda de dados em rede instavel.
- [ ] Smart phrases expansao < 150ms com placeholders resolvidos.
- [ ] Autocomplete CID/medicamento/exame < 200ms p95.
- [ ] Assinatura ICP-Brasil valida em 100% das evolucoes `ASSINADA`.
- [ ] Resumo leigo gerado por IA em < 5s com revisao humana.
- [ ] Ditado IA: taxa de aceitacao do draft sem edicao > 60% (indicador de qualidade do modelo, nao regra).
- [ ] Timeline do paciente inclui cada evolucao como evento com link para texto integral.

### 6.15 Riscos e cuidados

- **Vazamento via ditado** — gravacao de voz nunca persiste apos transcricao; transcricao e processada em VPC privada.
- **IA alucinando dado clinico** — confidencia por campo + obrigatoriedade de revisao humana + marca `iaAssistida=true` no audit trail para rastreabilidade.
- **Residente assinando como preceptor** — match obrigatorio entre CRM do certificado e CRM do autor; co-assinatura separada.
- **Complementacao usada para mudar conteudo original** — complemento e append-only; nao altera. Mudanca radical exige revogacao + nova evolucao.
- **Auto-save gravando em IndexedDB local com dados sensiveis** — criptografia por chave derivada de sessao; limpeza automatica em logout.

### 6.16 Backlog tecnico

- **Epico EVO-1**: Editor SOAP estruturado
  - Feature EVO-1.1: Modelo de dados `EvolucaoClinica` + SOAP
  - Feature EVO-1.2: Editor split-pane com autocomplete inline
  - Feature EVO-1.3: Auto-save IndexedDB criptografado
  - Feature EVO-1.4: Keyboard shortcuts
- **Epico EVO-2**: Smart phrases
  - Feature EVO-2.1: Biblioteca institucional
  - Feature EVO-2.2: Biblioteca pessoal por medico
  - Feature EVO-2.3: Resolver de placeholders
  - Feature EVO-2.4: Picker `⌘Shift+P`
- **Epico EVO-3**: Reutilizacao e diff
  - Feature EVO-3.1: Botao "Partir de anterior"
  - Feature EVO-3.2: Calculo de diff
  - Feature EVO-3.3: Bloqueio de assinatura < 15%
- **Epico EVO-4**: IA assistiva
  - Feature EVO-4.1: Ditado em VPC privada
  - Feature EVO-4.2: Modelo clinico LLM
  - Feature EVO-4.3: Confidencia por campo
  - Feature EVO-4.4: Audit trail IA
- **Epico EVO-5**: Assinatura
  - Feature EVO-5.1: Integracao Velya Signer
  - Feature EVO-5.2: Hash chain per-atendimento
  - Feature EVO-5.3: Validacao CRM x certificado
- **Epico EVO-6**: Co-assinatura
  - Feature EVO-6.1: Fluxo residente-preceptor
  - Feature EVO-6.2: Alerta em 18h
  - Feature EVO-6.3: Escalonamento
- **Epico EVO-7**: Resumo leigo
  - Feature EVO-7.1: Geracao IA
  - Feature EVO-7.2: Revisao medico
  - Feature EVO-7.3: Publicacao portal paciente

### 6.17 Modelo de dados

Ver `EvolucaoClinica` em 6.4. Adicionalmente:

```ts
interface SmartPhrase {
  id: string;
  atalho: string; // .evolucaoUTIdia
  escopo: 'INSTITUCIONAL' | 'PESSOAL';
  criadorId: string | null;
  hospitalId: string | null;
  template: string; // com placeholders
  placeholdersEsperados: string[];
  especialidadesPermitidas: string[];
  criadaEm: ISO8601;
  usoCount: number;
}

interface EvolucaoDiff {
  evolucaoId: string;
  evolucaoBaseId: string;
  linhasAdicionadas: string[];
  linhasRemovidas: string[];
  linhasAlteradas: { antes: string; depois: string }[];
  percentualMudanca: number;
  aprovadoAssinatura: boolean;
}
```

### 6.18 APIs e eventos

**REST:**
- `POST /api/evolucoes` — cria rascunho
- `PATCH /api/evolucoes/:id` — edita rascunho (auto-save)
- `POST /api/evolucoes/:id/assinar` — assina
- `POST /api/evolucoes/:id/coassinar` — co-assinatura preceptor
- `POST /api/evolucoes/:id/complemento` — complementa
- `POST /api/evolucoes/:id/resumo-leigo` — gera e publica
- `GET /api/evolucoes/:id/diff` — diff com base
- `POST /api/evolucoes/:id/ditado` — envio de audio → transcript
- `POST /api/smart-phrases` — cria smart phrase pessoal
- `GET /api/smart-phrases?escopo=INSTITUCIONAL` — lista

**NATS:**
- `clinical.evolucao.draft_started` — { evolucaoId, autorId, atendimentoId }
- `clinical.evolucao.created` — quando assinada: { evolucaoId, tipo, hashAssinatura }
- `clinical.evolucao.coassinature_pending` — { evolucaoId, preceptorId }
- `clinical.evolucao.coassinada` — { evolucaoId, preceptorId }
- `clinical.evolucao.complemented` — { evolucaoId, complementoId }
- `clinical.evolucao.revoked` — { evolucaoId, motivo }
- `clinical.evolucao.resumo_leigo_published` — { evolucaoId, portalPacienteUrl }
- `clinical.ai.evolucao_draft_used` — metrica interna uso IA
- `clinical.evolucao.diff_insufficient` — quando bloqueio por diff < 15%

### 6.19 Metricas

- **Tempo mediano por tipo de evolucao** (DIARIA, ADMISSAO, ALTA, etc.).
- **Taxa de uso de smart phrases** (% de evolucoes que usam ao menos 1).
- **Taxa de ditado IA** (% de evolucoes que utilizam).
- **Taxa de edicao do draft IA** (% medio de texto alterado apos IA).
- **Taxa de bloqueio por diff < 15%** (alvo decrescente — indica aprendizado).
- **Taxa de co-assinatura em 24h** (alvo > 95%).
- **Taxa de evolucoes faltantes** em pacientes internados > 24h (alvo 0%).
- **Taxa de referencia a CID** (alvo 100% em admissao/alta).
- **Tempo entre resultado critico de exame e evolucao referenciando** (alvo < 1h).
- **Taxa de leitura de resumo leigo pelo paciente** (engajamento portal).

---

## B.7. Exames Laboratoriais

### 7.1 Objetivo

Modulo de solicitacao, acompanhamento e laudo de exames laboratoriais, com integracao ao LIS (Laboratory Information System) do hospital e a laboratorios externos (DASA, Fleury, Hermes Pardini, regionais). Objetivo e reduzir de 12+ cliques (Tasy/MV) para 3 cliques por painel e oferecer timeline de resultados com tendencia visual para cada analito.

### 7.2 Usuarios

- **Medico solicitante**: solicita.
- **Enfermagem**: coleta (ou confirma coleta pela unidade de laboratorio).
- **Laboratorio**: recebe, processa, libera resultado.
- **Farmacia clinica**: le para ajuste de medicacao (e.g., TFG para dose renal).
- **Paciente**: ve resultado no app (quando liberado).

### 7.3 Campos mantidos

De `SolicitacaoExame`: `id`, `pacienteId`, `atendimentoId`, `solicitanteId`, `itens`, `criadaEm`, `status`.

### 7.4 Novos campos

```ts
interface SolicitacaoExameLab {
  id: string;
  atendimentoId: string;
  pacienteId: string;
  solicitanteId: string;
  solicitanteCrm: { numero: string; uf: string };

  prioridade: 'ROTINA' | 'URGENTE' | 'EMERGENCIA' | 'SERIADO';
  agendamento: ISO8601 | null;
  jejumRecomendado: boolean;

  // painel ou individual
  tipoRequisicao: 'PAINEL_PREDEFINIDO' | 'ITENS_INDIVIDUAIS';
  painelId: string | null; // e.g., "sepse-bundle", "pre-op-cardio", "admissao-uti"

  itens: {
    codigoTuss: string;
    codigoLoinc: string;
    descricao: string;
    material: 'SANGUE' | 'URINA' | 'FEZES' | 'LIQUOR' | 'SWAB' | 'ESCARRO' | 'BIOPSIA' | 'LIQUIDO_PLEURAL' | 'LIQUIDO_ASCITICO';
    tubo: string | null; // cor do tubo (roxo EDTA, amarelo gel, azul citrato, cinza fluoreto)
    volumeMinimoMl: number;
    justificativaClinica: string; // obrigatoria para autorizacao TISS
    cidRelacionado: string;
    diagnosticoVinculadoId: string | null;
  }[];

  localColeta: 'UNIDADE_ASSISTENCIAL' | 'POSTO_COLETA' | 'BEIRA_LEITO' | 'EXTERNO';
  laboratorioExecutorId: string;

  status: 'SOLICITADO' | 'AUTORIZADO' | 'EM_COLETA' | 'COLETADO' |
          'EM_PROCESSAMENTO' | 'PARCIAL_LIBERADO' | 'LIBERADO_COMPLETO' |
          'REJEITADO' | 'CANCELADO';

  coleta: {
    realizadaPor: string; // profissionalId
    realizadaEm: ISO8601;
    materialOk: boolean;
    observacoes: string;
    codigoBarrasEtiqueta: string; // gerado sistema
  } | null;

  // autorizacao convenio
  autorizacaoTiss: {
    numero: string;
    aprovadaEm: ISO8601;
    justificativaNegativa: string | null;
  } | null;
}

interface ResultadoExameLab {
  id: string;
  solicitacaoId: string;
  itemCodigoTuss: string;
  codigoLoinc: string;
  analito: string;
  valor: string; // pode ser numerico ou texto (ex "positivo")
  valorNumerico: number | null;
  unidade: string;
  valorReferenciaTexto: string; // ex "12-16 g/dL"
  valorReferenciaMin: number | null;
  valorReferenciaMax: number | null;

  flagsAutomaticas: ('NORMAL' | 'BAIXO' | 'ALTO' | 'CRITICO_BAIXO' | 'CRITICO_ALTO')[];
  delta: {
    valorAnterior: number | null;
    dataAnterior: ISO8601 | null;
    deltaPercent: number | null;
    alertaDeltaCritico: boolean; // e.g., K+ caiu 40% em 24h
  } | null;

  liberadoEm: ISO8601;
  liberadoPorId: string; // bioquimico / medico patologista
  liberadoPorCrbm: string;

  assinaturaLaudo: {
    tipo: 'ICP_BRASIL_A1' | 'ICP_BRASIL_A3';
    hashLaudo: string;
    assinadoEm: ISO8601;
  };

  comentariosBioquimico: string;
  comentariosTecnicos: string;

  metodo: string; // metodo analitico

  revisoes: {
    motivo: string;
    valorAnterior: string;
    revisadoEm: ISO8601;
    revisadoPor: string;
  }[];
}
```

### 7.5 Regras de preenchimento inteligente

- **Paineis institucionais 1-clique**: sepse-bundle (hemograma + PCR + lactato + hemocultura + procalcitonina + gasometria + funcao renal + hepatica + coagulograma), pre-op-cardio, admissao-uti, rotina-hemodialise.
- **Sugestao por CID**: diagnostico de sepse → painel sepse-bundle. ICC agudizada → painel ICC.
- **Reaproveitamento de exames recentes** (< 24h): se paciente ja tem resultado de creatinina, sistema avisa antes de solicitar de novo.
- **Justificativa clinica pre-preenchida** com base em CID vinculado.

### 7.6 Validacoes

- **Volume minimo por tubo** respeitado.
- **Jejum** confirmado quando obrigatorio (glicemia em jejum, perfil lipidico).
- **Autorizacao TISS** obrigatoria para exames acima de valor de corte do convenio.
- **CRBM do liberador do laudo** validado.

### 7.7 Alertas

- **Valor critico** (ex K+ > 6.5 ou < 2.5; Hb < 7; troponina > cutoff IAM): **task automatica ao medico assistente** com SLA de 15min + ligacao telefonica automatizada via sistema + escalonamento plantonista.
- **Delta critico** (mudanca > X% em Y tempo): alerta clinico.
- **Resultado pendente > SLA** (ex rotina > 4h em internacao): alerta laboratorio.
- **Coleta pendente > 2h da solicitacao**: alerta enfermagem/coleta.

### 7.8 Permissoes

| Acao | Medico | Enf | Laboratorio | Farmacia | Paciente |
|---|---|---|---|---|---|
| Solicitar | W | - | - | - | - |
| Autorizar TISS | - | - | W (admin) | - | - |
| Registrar coleta | - | W | W | - | - |
| Liberar resultado | - | - | W | - | - |
| Ver resultado | R | R | W | R | R (owner) |

### 7.9 Workflow

```
[SOLICITADO] ──► [AUTORIZADO] ──► [EM_COLETA] ──► [COLETADO]
                                                     │
                                                     ▼
                                              [EM_PROCESSAMENTO]
                                                     │
                         ┌───────────────────────────┼──────────────┐
                         ▼                           ▼              ▼
                   [PARCIAL_LIBERADO]       [LIBERADO_COMPLETO]  [REJEITADO]
                                                                (material
                                                                 inadequado)
```

### 7.10 Integracoes

- **LIS** via HL7 FHIR ServiceRequest/Observation/DiagnosticReport.
- **LOINC** para codificacao de analitos.
- **TUSS** para faturamento.
- **Laboratorios externos** (DASA, Fleury, Hermes Pardini) — APIs FHIR.
- **RNDS** — envio DiagnosticReport.

### 7.11 Historico e auditoria

- Linha do tempo de cada analito (ex: "troponina" → grafico de todos os valores ultimos 30d).
- Revisoes de valor (quando bioquimico recorrige) preservam historico.
- Hash chain por resultado.

### 7.12 Melhorias de UX

- **Grafico de tendencia sparkline** inline em cada analito.
- **Flag visual monochromatic** para valor alterado (preenchimento escuro para critico, medio para alterado, claro para limite).
- **Widget "Resultados recentes"** no Patient Cockpit com ultimos 24h.
- **"Valor delta"** quando mudanca significativa vs ultimo.
- **Atalho `E:` em evolucao** insere referencia a exame com destaque do analito.
- **Painel institucional 1-clique** em tela de solicitacao.

### 7.13 Mock logico

```
┌ Resultado — Maria Santos · 12/04 06:00 ────────────────── [fechar] ┐
│ ┌ Hemograma ─────────────────────────┬───── Tendencia ───────────┐ │
│ │ Hb     12.8 g/dL   [12-16]        │ ▁▁▃▅▆▆▇  13.2→12.8       │ │
│ │ Leuco  14200 /mm3  [4-11k] ⬆      │ ▂▃▄▅▇██  pico 15800      │ │
│ │ Plaq   210k /mm3   [150-450k]     │ ▆▆▅▅▆▆▆  estavel         │ │
│ └────────────────────────────────────┴───────────────────────────┘ │
│ ┌ Bioquimica ────────────────────────┬─────────────────────────┐  │
│ │ Ureia  42 mg/dL     [15-40] ⬆     │ ▂▃▅▇██  35→42           │  │
│ │ Creat  1.3 mg/dL    [0.6-1.2] ⬆   │ ▁▃▅▇     1.1→1.3        │  │
│ │ K+     4.2 mEq/L    [3.5-5.0]     │ ▄▄▅▄▄   estavel          │  │
│ │ Na+    138 mEq/L    [135-145]     │ ▅▅▅▅    estavel          │  │
│ │ Tn I   0.8 ng/ml    [<0.04] ⬆⬆    │ ▁▂█▇▅  pico 1.2 em 08/04│  │
│ └────────────────────────────────────┴─────────────────────────┘  │
│                                                                    │
│ Liberado por: Dr Carla Moura · CRBM 8814 · 06:12:33               │
│ Hash: a3f1... [verificar integridade]                             │
└────────────────────────────────────────────────────────────────────┘
```

### 7.14 Criterios de aceite

- [ ] Solicitacao de painel em 1 clique + 2s.
- [ ] Valor critico gera task + ligacao < 15min.
- [ ] Sparkline renderiza historico ultimos 30d em < 300ms.
- [ ] Autorizacao TISS automatica via API.
- [ ] Laudo com assinatura CRBM valida em 100%.
- [ ] Integracao LIS bidirecional funcional com LOINC.

### 7.15 Riscos

- **Resultado critico nao visto** — task + ligacao + escalonamento.
- **Valor de referencia errado** — tabela institucional + validacao dupla por analito.
- **Resultado revisado que muda conduta** — alerta medico automatico.

### 7.16 Backlog

- **Epico LAB-1**: Solicitacao com paineis
- **Epico LAB-2**: Integracao LIS + LOINC
- **Epico LAB-3**: Resultados com tendencia
- **Epico LAB-4**: Valores criticos + escalonamento
- **Epico LAB-5**: Autorizacao TISS
- **Epico LAB-6**: Laboratorios externos

### 7.17 Modelo

Ver 7.4.

### 7.18 APIs

- `POST /api/solicitacoes-lab`, `PATCH /.../autorizar`, `PATCH /.../coletar`, `POST /api/resultados-lab`
- `clinical.exame.solicitado`, `clinical.exame.coletado`, `clinical.exame.liberado`, `clinical.valor_critico.detected`

### 7.19 Metricas

- Tempo medio solicitacao → resultado.
- Taxa de valor critico visto em SLA.
- Taxa de reaproveitamento de exame recente.
- Taxa de uso de paineis.

---

## B.8. Exames de Imagem

### 8.1 Objetivo

Modulo de solicitacao, agendamento, execucao e laudo de exames de imagem (raio-X, tomografia, ressonancia, ultrassonografia, mamografia, cintilografia, PET-CT, ecocardiograma, endoscopia), com integracao PACS/DICOM, visualizador web nativo e laudo estruturado.

### 8.2 Usuarios

- **Medico solicitante**.
- **Medico radiologista / laudador**.
- **Tecnico em radiologia / ultrassom**.
- **Agenda de imagem**.
- **Medico assistente** (le laudo).
- **Paciente** (ve imagens + laudo leigo).

### 8.3 Campos mantidos

De `SolicitacaoExame`.

### 8.4 Novos campos

```ts
interface SolicitacaoExameImagem {
  id: string;
  atendimentoId: string;
  pacienteId: string;
  solicitanteId: string;

  modalidade: 'RX' | 'TC' | 'RM' | 'USG' | 'DOPPLER' | 'MAMO' |
              'CINTILO' | 'PET_CT' | 'ECO' | 'ENDOSCOPIA' |
              'COLONOSCOPIA' | 'DENSITOMETRIA' | 'ANGIO';

  regiaoAnatomica: {
    codigo: string; // ex "TORAX", "ABDOME_TOTAL"
    lateralidade: 'DIREITO' | 'ESQUERDO' | 'BILATERAL' | 'NA';
    detalhamento: string;
  };

  codigoTuss: string;
  codigoSigtap: string | null;
  descricaoExame: string;

  contraste: {
    utilizara: boolean;
    tipo: 'IODADO' | 'GADOLINIO' | 'BARITADO' | 'MICROBOLHAS' | null;
    funcaoRenalValidada: boolean;
    creatininaRecente: number | null;
    alergiaContrastePrevia: boolean;
  };

  sedacao: {
    sedacaoPrevista: boolean;
    tipoSedacao: 'CONSCIENTE' | 'PROFUNDA' | 'GERAL' | null;
    jejumHoras: number;
  };

  justificativaClinica: string;
  hipoteseDiagnostica: string;
  cidRelacionado: string;
  diagnosticoVinculadoId: string | null;
  examesAnterioresReferenciados: string[]; // solicitacoesIds

  prioridade: 'ROTINA' | 'URGENTE' | 'EMERGENCIA';

  agendamento: {
    dataHoraAgendada: ISO8601;
    salaImagemId: string;
    tecnicoId: string | null;
  } | null;

  execucao: {
    dataHoraExecucao: ISO8601;
    tecnicoExecutorId: string;
    equipamentoId: string;
    protocoloAquisicao: string;
    contrasteAdministradoMl: number | null;
    eventosAdversos: string[];
    observacoesTecnicas: string;
    numeroSeriesDicom: number;
    numeroImagensDicom: number;
    dicomStudyInstanceUid: string;
  } | null;

  laudo: {
    laudadorId: string;
    laudadorCrm: { numero: string; uf: string; rqe: string };
    corpo: {
      tecnica: string;
      achados: string;
      impressao: string;
      comparacao: string; // comparacao com exames anteriores
      recomendacoes: string;
    };
    laudoEmergencial: boolean; // pre-laudo antes do final
    revisadoPorTitular: boolean;
    revisorId: string | null;
    assinadoEm: ISO8601;
    assinaturaHash: string;
  } | null;

  status: 'SOLICITADO' | 'AUTORIZADO' | 'AGENDADO' | 'EM_PREPARO' |
          'EM_EXECUCAO' | 'EXECUTADO' | 'EM_LAUDO' | 'LAUDO_EMERGENCIAL' |
          'LAUDADO' | 'REVISADO' | 'CANCELADO';

  autorizacaoTiss: { /* como lab */ } | null;
  protocoloInstitucional: string | null; // ex "AVC-agudo" impoe TC < 25min
}
```

### 8.5 Regras de preenchimento inteligente

- **Protocolo AVC agudo**: TC cranio sem contraste em < 25min — badge urgente.
- **Protocolo TEP**: angio-TC torax — sugere D-dimero + calculo Wells.
- **Protocolo abdome agudo**: TC abdome + pelve c/contraste.
- **Funcao renal validada**: se ultima creatinina > 1.5, alerta para contraste iodado.
- **Alergia a contraste previa**: badge + sugestao de pre-medicacao.

### 8.6 Validacoes

- **Creatinina < 90 dias** para contraste iodado (bloqueio hard se > 1.5 sem pre-medicacao).
- **Teste de gravidez** obrigatorio em mulher 10-55 anos para TC/RX com radiacao ionizante (exceto emergencia com consentimento).
- **Alergia a contraste previa**: pre-medicacao obrigatoria.
- **Jejum** para sedacao.
- **RQE radiologia** do laudador validado.

### 8.7 Alertas

- **Tempo de permanencia em PACS** para laudo > SLA (urgencia 1h, rotina 24h): alerta.
- **Achado critico** (sangramento intracraniano, pneumotorax hipertensivo, TEP maciço, abdome agudo com perfuracao): **task automatica + ligacao ao medico + escalonamento**.
- **Discrepancia entre pre-laudo residente e laudo titular**: alerta + evento de revisao.

### 8.8 Permissoes

| Acao | Medico | Radiologista | Tecnico | Paciente |
|---|---|---|---|---|
| Solicitar | W | - | - | - |
| Executar | - | R | W | - |
| Laudar | - | W | - | - |
| Revisar laudo | - | W (titular) | - | - |
| Ver imagem DICOM | R | R | R | R (owner) |

### 8.9 Workflow

```
[SOLICITADO] → [AUTORIZADO] → [AGENDADO] → [EM_PREPARO] →
    [EM_EXECUCAO] → [EXECUTADO] → [EM_LAUDO] →
    [LAUDO_EMERGENCIAL]? → [LAUDADO] → [REVISADO]
```

### 8.10 Integracoes

- **PACS** via DICOM (C-STORE, C-FIND, WADO-RS).
- **Visualizador DICOM web** nativo (OHIF ou Cornerstone3D).
- **CDSS imagem** (Aidoc, Lunit, Viz.ai opcional) — IA triagem de achados criticos.
- **TUSS / SIGTAP**.
- **RNDS ImagingStudy**.

### 8.11 Historico e auditoria

- Laudo imutavel apos assinatura; revisao gera adendo.
- Acesso a imagem (quem viu, quando) registrado.
- Hash do laudo + hash do DICOM StudyInstanceUID.

### 8.12 Melhorias de UX

- **Visualizador DICOM inline** no Patient Cockpit — nao abre em nova janela.
- **Laudo estruturado com seccoes** em vez de texto livre unico.
- **Comparacao lado-a-lado** com exames anteriores.
- **Achados IA** (quando disponivel) em painel separado, sempre revisados pelo radiologista.
- **Marcacao de achado** (anotacao DICOM) que fica persistida.
- **"Favoritar exame"** para medico assistente acompanhar.

### 8.13 Mock logico

```
┌ TC Cranio s/contraste — Maria Santos ─ 12/04 09:15 ────── [fechar] ┐
│ ┌ Imagem DICOM (viewer) ──────────────────────┬ Laudo ──────────┐  │
│ │                                             │ TECNICA          │  │
│ │   [axial]  [coronal]  [sagital]            │ Aquisicao 5mm    │  │
│ │                                             │ sem contraste    │  │
│ │   [cortes radiologicos]                     │                  │  │
│ │                                             │ ACHADOS          │  │
│ │                                             │ Parenquima       │  │
│ │                                             │ cerebral         │  │
│ │   [zoom] [ww/wl] [medir] [anotar]          │ preservado, sem  │  │
│ │                                             │ sinais de        │  │
│ │                                             │ hemorragia ou    │  │
│ │                                             │ efeito de massa. │  │
│ │                                             │                  │  │
│ │                                             │ IMPRESSAO        │  │
│ │                                             │ Exame sem        │  │
│ │                                             │ alteracoes       │  │
│ │                                             │ agudas.          │  │
│ │                                             │                  │  │
│ └─────────────────────────────────────────────┴──────────────────┘  │
│ Laudado por: Dr Rafael Lopes · RQE Radiologia · 09:42               │
│ Comparacao com TC 2025-11-12: estavel.                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.14 Criterios de aceite

- [ ] Viewer DICOM abre study em < 3s p95.
- [ ] Protocolo AVC: TC laudada < 25min em 95% dos casos.
- [ ] Achado critico: ligacao medico < 10min.
- [ ] Validacao creatinina bloqueia contraste iodado inapropriado.
- [ ] Comparacao exames anteriores em 1 clique.
- [ ] Laudo estruturado com 5 secoes obrigatorias.

### 8.15 Riscos

- **Exposicao desnecessaria a radiacao** — dose cumulativa do paciente visivel + alerta ALARA.
- **Contraste em IRA** — bloqueio hard.
- **Laudo errado** — revisao por titular obrigatoria em residente.
- **Imagem DICOM vazada** — watermark + auditoria de acesso.

### 8.16 Backlog

- **Epico IMG-1**: Solicitacao com protocolos
- **Epico IMG-2**: Integracao PACS + viewer DICOM
- **Epico IMG-3**: Laudo estruturado
- **Epico IMG-4**: Achado critico com escalonamento
- **Epico IMG-5**: IA achados (opcional)
- **Epico IMG-6**: Comparacao exames anteriores

### 8.17 Modelo

Ver 8.4.

### 8.18 APIs

- `POST /api/solicitacoes-imagem`, `POST /api/solicitacoes-imagem/:id/laudo`
- `clinical.imagem.executada`, `clinical.imagem.laudada`, `clinical.achado_critico.detected`

### 8.19 Metricas

- Tempo solicitacao → laudo por modalidade e prioridade.
- Taxa de achado critico comunicado em SLA.
- Taxa de re-laudo (discrepancia residente x titular).
- Dose cumulativa media por paciente.
- Taxa de reaproveitamento de exame anterior.

---

**Fim da Parte 1.** A Parte 2 cobrira implementacoes 9 a 15 (Laudo SUS / Internacao, Parecer / Interconsulta, Prescricoes, Procedimentos e Exames Gerais, Hemoterapia, Sinais Vitais, Recursos Transversais) mais secoes C, D, E e F do sumario.
# Velya — Especificacao de UX Hospitalar Avancada — PARTE 2

> Secao B — Implementacoes 9 a 15 (incluindo Recursos Transversais)
>
> Continuacao direta de `velya-ux-hospitalar-avancada-spec-PART1.md`. Este documento detalha os modulos clinicos de alto impacto operacional (Laudo SUS de internacao, Pareceres, Prescricoes, Procedimentos/Exames, Hemoterapia, Sinais Vitais) e a camada transversal que sustenta o prontuario (Timeline unica, Painel contextual, Busca global, Notificacoes, Auditoria, Permissoes, Integracoes).
>
> Contexto: Next.js 15 + Tailwind v4, tema monocromatico estrito (fundo branco, texto preto, zero cores semanticas, zero emojis), core data model centrado em `Hospital`, `Location`, `Organization`, `UnidadeAssistencial`, `Especialidade`, `HealthcareService`, `ProfissionalSaude`, `PractitionerRole`, `Turno`, `Paciente`, `Internacao`, `CareTeam`, `EvolucaoClinica`, `Prescricao`, `SolicitacaoExame`, `RegistroSinaisVitais`, `TransferenciaInterna`. Vistas principais ja existentes: `/unidades`, `/specialties/[id]`, `/staff-on-duty`, `/tasks`, `/pacientes/[mrn]` (Patient Cockpit timeline-first).
>
> Todas as regras clinicas respeitam CFM 1.821/2007 (prontuario eletronico), RDC 34/2014 (hemoterapia), RDC 67/2007 (prescricao manipulada), Resolucao CFM 2.314/2022 (telemedicina), COFEN 358/2009 (SAE), LGPD Art. 11 (dados de saude) e a NBR ISO/TS 18308 (prontuario eletronico).

---

## Indice

- [9. Laudo SUS / Admissao / Internacao Hospitalar](#9-laudo-sus--admissao--internacao-hospitalar)
- [10. Parecer Medico / Interconsulta](#10-parecer-medico--interconsulta)
- [11. Prescricoes (ULTRA PRIORITARIO)](#11-prescricoes-ultra-prioritario)
- [12. Procedimentos e Exames Gerais](#12-procedimentos-e-exames-gerais)
- [13. Hemoterapia](#13-hemoterapia)
- [14. Sinais Vitais e Monitoracao](#14-sinais-vitais-e-monitoracao)
- [15. Recursos Transversais](#15-recursos-transversais)

---

## 9. Laudo SUS / Admissao / Internacao Hospitalar

Formulario equivalente ao Laudo para Solicitacao/Autorizacao de Internacao Hospitalar (AIH — SIGTAP, Portaria SAS/MS 221/1999), usado tanto para pacientes SUS quanto para convenios, reaproveitando dados ja capturados no acolhimento, triagem e avaliacao inicial.

### 9.1 Objetivo

Registrar formalmente a decisao de internar, vincular procedimento principal do SIGTAP/TUSS, caracterizar carater (eletivo, urgencia, emergencia), justificativa clinica, CID-10 principal e secundarios, destino (enfermaria, UTI, semi-intensiva), e emitir documento assinado digitalmente (ICP-Brasil ou CFM 2.299/2021) sem retrabalho — herdando dados de `Paciente`, `CareTeam`, diagnosticos ja registrados em `EvolucaoClinica` e sinais vitais.

### 9.2 Usuarios

- Medico assistente (abre e assina)
- Medico plantonista do pronto-socorro (abre em urgencia)
- Medico auditor (revisa antes de envio TISS/SUS)
- Enfermagem de regulacao (acompanha status)
- Secretaria de internacao (emite guia final, anexa carteira)
- Gestor de faturamento (consome para TISS/BPA)

### 9.3 Campos mantidos (herdados do registro existente)

Todos extraidos automaticamente de objetos Velya existentes:

- `Paciente` — nome social, nome de registro, CNS, CPF, data de nascimento, sexo biologico, identidade de genero, nome da mae, endereco, telefone
- `Internacao.id` — quando laudo e criado dentro de uma internacao ja aberta
- `UnidadeAssistencial` — onde esta internado (ou previsao)
- `CareTeam` — medico responsavel, especialidade
- `EvolucaoClinica` (ultimas 48h) — anamnese, exame fisico, hipotese diagnostica
- `RegistroSinaisVitais` mais recente — PA, FC, FR, SatO2, T, HGT
- Exames recentes com laudo
- Alergias e comorbidades do cadastro do paciente

### 9.4 Novos campos a adicionar

- `procedimentoPrincipalSigtap` (codigo + descricao + porte)
- `procedimentosSecundariosSigtap[]`
- `cidPrincipal` + `cidsSecundarios[]` (CID-10)
- `carater` — `eletivo | urgencia | emergencia`
- `tipoLeito` — `enfermaria | apartamento | semi | uti_adulto | uti_neo | uti_ped | obstetrica`
- `justificativaClinica` (texto livre, minimo 120 caracteres)
- `sinaisSintomas[]`
- `condicoesJustificamInternacao[]` (checklist SIGTAP)
- `principaisResultadosProvaveisDiagnosticos[]`
- `dataPrevistaInternacao` / `dataRealInternacao`
- `previsaoPermanenciaDias`
- `acidenteTrabalho` / `causaExterna` (CID-10 capitulo XX)
- `origemPaciente` — `demanda_espontanea | referenciado | transferencia | regulacao`
- `numeroGuiaSolicitacao` (AIH ou guia convenio)
- `convenioPlanoProduto` (quando nao SUS)
- `assinaturaDigital` (hash + certificado)
- `crmSolicitante` (copiado de `ProfissionalSaude`)
- `laudoRevisadoPor` (auditor)
- `statusEnvioTiss`

### 9.5 Regras de preenchimento inteligente

- Ao clicar em "Novo laudo de internacao" a partir do Patient Cockpit, o sistema:
  - Puxa ultima hipotese diagnostica da `EvolucaoClinica` mais recente e pre-seleciona CID-10 sugeridos (via mapeamento texto -> CID pelo servico `velya-clinical-nlp`).
  - Sugere procedimento SIGTAP principal baseado no CID (tabela de compatibilidade CID x SIGTAP distribuida por DATASUS).
  - Preenche `tipoLeito` com o tipo do leito ja alocado em `Internacao.leitoAtual` se existir, senao sugere pela `UnidadeAssistencial` destino.
  - Preenche `sinaisSintomas` juntando queixa principal + achados de exame fisico.
  - Calcula `previsaoPermanenciaDias` pela mediana historica do par CID+Procedimento naquele hospital (fallback: tabela nacional).
- Se o laudo for aberto no PS, preenche `carater = urgencia` por default e exibe aviso se profissional tentar mudar para eletivo.
- Alergias e medicacoes em uso sao anexadas como "ficha tecnica" no PDF final automaticamente.

### 9.6 Validacoes obrigatorias

- CID-10 principal obrigatorio; nao pode ser codigo R (sintomas) se `carater = eletivo`.
- Procedimento SIGTAP principal compativel com CID principal (bloqueia submissao se incompatibilidade critica, avisa se compatibilidade baixa).
- `justificativaClinica` >= 120 caracteres e nao pode ser apenas copia da queixa principal (hash check).
- Quando `tipoLeito = uti_*`, obrigatorio justificativa especifica (escore SAPS3/APACHE II ou criterios clinicos documentados).
- Solicitante deve ter CRM ativo no CFM (validacao online via integracao, com cache de 24h).
- Para AIH, todos os campos obrigatorios do SISAIH01 preenchidos antes de "Enviar para TISS".
- Assinatura digital obrigatoria antes de `statusEnvioTiss = enviado`.

### 9.7 Alertas e sugestoes do sistema

- "CID R00-R99 (sintomas) nao e aceito como diagnostico principal em internacao eletiva pelo SUS."
- "Paciente ja teve internacao pelo mesmo CID nos ultimos 30 dias — possivel reinternacao (indicador qualidade). Deseja anexar motivo?"
- "Procedimento SIGTAP X pede exame Y previo — nenhum exame Y foi localizado no prontuario. Anexar?"
- "Leito UTI solicitado sem escore SAPS3 calculado — calcular agora?"
- "Paciente sem CNS cadastrado — necessario para AIH. Capturar pelo cartao?"

### 9.8 Permissoes por perfil

| Acao | Medico Assist. | Plantonista | Residente | Auditor | Enf Regulacao | Secretaria | Gestor Fat. |
|---|---|---|---|---|---|---|---|
| Criar rascunho | sim | sim | sim (tutor co-assina) | nao | nao | nao | nao |
| Editar campos clinicos | sim | sim | sim ate assinar | sim (audit log) | nao | nao | nao |
| Assinar digitalmente | sim | sim | nao | nao | nao | nao | nao |
| Enviar para TISS | sim | sim | nao | sim | nao | sim | nao |
| Ver laudo completo | sim | sim | sim | sim | sim | sim | sim (mascarado) |
| Exportar PDF/XML | sim | sim | nao | sim | sim | sim | sim |
| Cancelar apos envio | nao | nao | nao | sim (com motivo) | nao | nao | nao |

### 9.9 Status e workflow

```
[rascunho] --salvar--> [rascunho] --preencher obrigatorios+assinar--> [assinado]
                 \--descartar--> [descartado]
[assinado] --auditor revisa--> [em_revisao_auditoria]
[em_revisao_auditoria] --aprovar--> [aprovado] --enviar TISS--> [enviado]
[em_revisao_auditoria] --solicitar correcao--> [devolvido_para_correcao] --> [rascunho] (mesmo id, versao++)
[enviado] --retorno TISS OK--> [autorizado]
[enviado] --retorno TISS NEG--> [glosado] --correcao--> [rascunho]
[autorizado] --alta paciente--> [finalizado]
[qualquer] --anular clinicamente--> [cancelado] (audit log com motivo)
```

### 9.10 Integracoes necessarias

- `velya-cfm-validator` — validacao de CRM online
- `velya-sigtap-catalog` — tabela de procedimentos e compatibilidades
- `velya-cid10-catalog` — hierarquia CID-10 / CID-11 quando migrar
- `velya-tiss-connector` — envio XML TISS 4.x para operadoras
- `velya-sisaih-connector` — envio SISAIH01 para Secretaria Estadual SUS
- `velya-digital-sign` — assinatura ICP-Brasil ou certificado CFM
- `velya-print-service` — renderizacao PDF padronizada
- Mensageria NATS para eventos

### 9.11 Historico e auditoria

- Toda alteracao gera versao incrementada (`laudoInternacao.versao`) com diff JSON persistido em `audit_log`.
- Registros: quem leu o laudo, quando, de qual IP e user agent (CFM 1.821 Art 3).
- Retencao minima de 20 anos (CFM 1.821/2007 e Lei 13.787/2018).
- Exportacao integral do laudo com assinatura digital verificavel permanente.

### 9.12 Melhorias de UX especificas

- Formulario em 4 passos verticais (nao wizard modal) com indicador sticky a esquerda: `1 Paciente > 2 Clinica > 3 Procedimento > 4 Revisao`.
- Herdar campos com badge `[auto]` mostrando origem: "puxado de Evolucao de 2026-04-10 14:22 por Dr Silva".
- Botao "Ver fonte" abre drawer lateral com o registro original.
- Draft auto-save a cada 5 segundos com indicador discreto `rascunho salvo 12s atras`.
- Preview do PDF em tempo real no painel direito (sticky) atualizando enquanto digita.
- Atalhos: `Ctrl+S` salvar, `Ctrl+Enter` assinar, `Ctrl+.` inserir macro.
- Busca CID e SIGTAP com fuzzy match, sinonimos e atalhos por voz (opcional).
- Timeline do laudo no proprio header: rascunho -> assinado -> enviado -> autorizado.

### 9.13 Mock logico da tela (ASCII)

```
+-------------------------------------------------------------------------------+
| Patient Cockpit > Maria S. Oliveira  MRN 01023  48a F                         |
+-------------------------------------------------------------------------------+
| [ 1 Paciente ]  [ 2 Clinica ]  [ 3 Procedimento ]  [ 4 Revisao & Assinar ]    |
+------------------------------+------------------------------------------------+
|  1 Identificacao       [ok]  |  PREVIEW LAUDO                                 |
|  2 Clinica             [..]  |  +------------------------------------+       |
|  3 Procedimento        [  ]  |  | Hospital XYZ                       |       |
|  4 Revisao             [  ]  |  | LAUDO PARA INTERNACAO HOSPITALAR   |       |
|                              |  | Paciente: Maria S. Oliveira        |       |
|  CID-10 principal            |  | CNS: 700 0234 5678 ...             |       |
|  [ I21.0 Infarto agudo ] v   |  | Carater: Urgencia                  |       |
|  +auto sugerido pela         |  | CID: I21.0 - Infarto agudo         |       |
|   Evolucao 14:22 [ver fonte] |  | SIGTAP: 03.03.04.014-0 AIH Cardio. |       |
|                              |  | Justificativa: ...                 |       |
|  Carater                     |  |                                    |       |
|  ( ) Eletivo                 |  | Dr. Joao Freire CRM/SP 123456      |       |
|  (x) Urgencia                |  | Assinatura digital: pendente       |       |
|  ( ) Emergencia              |  +------------------------------------+       |
|                              |                                                |
|  Justificativa clinica       |  FONTE DOS DADOS                               |
|  [..............................................................]            |
|                              |  - Paciente: cadastro 2021-03-12              |
|                              |  - Sinais Vitais: 2026-04-12 07:10 Enf. Ana   |
|  [ Salvar rascunho ]         |  - Alergias: 2024-08 (dipirona)               |
|  [ Assinar e enviar ]        |  - Evolucao: 2026-04-12 14:22 Dr. Silva       |
+------------------------------+------------------------------------------------+
| rascunho salvo 3s atras | versao 4 | tempo no formulario 2min14s              |
+-------------------------------------------------------------------------------+
```

### 9.14 Criterios de aceite

- [ ] Abrir laudo em menos de 3 segundos herdando ao menos 12 campos do cockpit.
- [ ] Nao e possivel assinar sem justificativa, CID principal, procedimento SIGTAP e tipo de leito.
- [ ] Validacao de CRM ocorre antes da assinatura e bloqueia com mensagem clara.
- [ ] Assinatura gera PDF/A-2 com carimbo de tempo (RFC 3161).
- [ ] Envio TISS gera XML 4.x valido contra XSD oficial.
- [ ] Diff de versoes visivel em /pacientes/[mrn]/laudos/[id]/versoes.
- [ ] Reaproveitamento comprovado: zero campos redigitados em cenarios com evolucao recente (<24h).
- [ ] Timeline do paciente recebe entrada `laudoInternacao.assinado` com link.

### 9.15 Riscos e cuidados de seguranca

- **Fraude TISS**: glosa alta quando CID e procedimento incompativeis — bloqueio pre-envio evita receita negada.
- **Assinatura indevida**: medico logado em estacao compartilhada — exigir 2FA ou PIN do certificado a cada assinatura.
- **Vazamento LGPD**: PDF exportado pode conter dados sensiveis — marca dagua `VELYA confidencial` e watermark com matricula de quem exportou.
- **Adulteracao pos-assinatura**: qualquer edicao apos assinar obriga reabertura com audit trail imutavel (hash encadeado).
- **Copia-cola acritica**: sistema detecta se justificativa e copia literal da queixa e alerta.

### 9.16 Backlog tecnico sugerido

- [ ] `packages/velya-clinical-schemas` — adicionar `LaudoInternacao` zod schema.
- [ ] `apps/velya-web/src/app/pacientes/[mrn]/laudos/novo/page.tsx` — formulario 4-passos.
- [ ] `apps/velya-web/src/features/laudo-internacao/SmartPrefill.tsx` — hook de herdanca.
- [ ] `services/velya-tiss-connector` — adapter de envio TISS 4.x.
- [ ] `services/velya-sisaih-connector` — adapter SISAIH01.
- [ ] `services/velya-digital-sign` — wrapper PAdES / CAdES.
- [ ] Migration Postgres `laudos_internacao` + `laudos_internacao_versoes`.
- [ ] Test fixtures com casos SUS e convenio.

### 9.17 Modelo de dados sugerido

```ts
export type CaraterInternacao = "eletivo" | "urgencia" | "emergencia";
export type TipoLeitoSolicitado =
  | "enfermaria"
  | "apartamento"
  | "semi_intensiva"
  | "uti_adulto"
  | "uti_neonatal"
  | "uti_pediatrica"
  | "obstetrica";
export type StatusLaudoInternacao =
  | "rascunho"
  | "assinado"
  | "em_revisao_auditoria"
  | "devolvido_para_correcao"
  | "aprovado"
  | "enviado"
  | "autorizado"
  | "glosado"
  | "cancelado"
  | "finalizado";

export interface LaudoInternacao {
  id: string;
  hospitalId: string;
  pacienteId: string;
  internacaoId?: string; // quando ja havia internacao aberta
  unidadeDestinoId?: string;

  carater: CaraterInternacao;
  tipoLeito: TipoLeitoSolicitado;

  cidPrincipal: string;
  cidsSecundarios: string[];
  procedimentoPrincipalSigtap: { codigo: string; descricao: string; porte?: string };
  procedimentosSecundariosSigtap: Array<{ codigo: string; descricao: string }>;

  justificativaClinica: string;
  sinaisSintomas: string[];
  condicoesJustificamInternacao: string[];
  principaisResultadosProvaveisDiagnosticos: string[];

  dataPrevistaInternacao?: string; // ISO
  dataRealInternacao?: string;
  previsaoPermanenciaDias?: number;

  acidenteTrabalho?: boolean;
  causaExternaCid?: string;
  origemPaciente:
    | "demanda_espontanea"
    | "referenciado"
    | "transferencia"
    | "regulacao";
  numeroGuiaSolicitacao?: string;
  convenioPlanoProduto?: string;

  solicitanteId: string; // ProfissionalSaude
  solicitanteCrm: string;
  assinaturaDigital?: {
    hash: string;
    certificadoSubject: string;
    timestampToken: string;
    assinadoEm: string;
  };
  auditorRevisorId?: string;

  statusEnvioTiss:
    | "nao_enviado"
    | "enviando"
    | "enviado"
    | "autorizado"
    | "glosado"
    | "cancelado";
  respostaTiss?: { protocolo: string; recebidoEm: string; motivoGlosa?: string };

  status: StatusLaudoInternacao;
  versao: number;
  origemHerancaCampos: Record<string, { tipo: string; refId: string; em: string }>;

  criadoEm: string;
  criadoPor: string;
  atualizadoEm: string;
  atualizadoPor: string;
}
```

### 9.18 APIs / eventos NATS

- `clinical.laudo_internacao.rascunho_criado`
- `clinical.laudo_internacao.atualizado`
- `clinical.laudo_internacao.assinado`
- `clinical.laudo_internacao.enviado_tiss`
- `clinical.laudo_internacao.autorizado`
- `clinical.laudo_internacao.glosado`
- `clinical.laudo_internacao.cancelado`
- REST: `POST /api/laudos-internacao`, `PATCH /:id`, `POST /:id/assinar`, `POST /:id/enviar-tiss`, `GET /:id/versoes`

### 9.19 Metricas para medir ganho

- Tempo mediano para assinar laudo (meta: `<4 min`).
- Percentual de campos auto-preenchidos (meta: `>=75 por cento`).
- Taxa de glosa TISS (meta: reducao de 40 por cento em 6 meses).
- Taxa de laudos com CID R em internacao eletiva (meta: `<1 por cento`).
- Numero medio de edicoes pos-assinatura (meta: `<0.3 por laudo`).
- NPS interno do medico assistente sobre o formulario.

---

## 10. Parecer Medico / Interconsulta

Comunicacao formal entre especialidades quando o medico assistente precisa da opiniao de outra area (ex: cardiologista avaliando paciente internado na ortopedia).

### 10.1 Objetivo

Registrar solicitacao e resposta de parecer como documento clinico rastreavel, com SLA por urgencia, integrado a `EvolucaoClinica` para evitar fragmentacao do prontuario, e com fila visivel por especialidade (`/specialties/[id]/pareceres`).

### 10.2 Usuarios

- Medico solicitante (qualquer especialidade)
- Medico pareceista (especialista convidado)
- Residente (solicita com co-assinatura do tutor)
- Chefia de especialidade (prioriza fila)
- Enfermagem (apenas leitura e orientacoes praticas)
- Auditoria clinica

### 10.3 Campos mantidos

- `Paciente` completo (MRN, nome social, idade, sexo)
- `Internacao` atual (leito, unidade, diagnosticos)
- `CareTeam` do paciente
- `EvolucaoClinica` ultimas 72h (sumarizada)
- Exames com laudo relevantes
- Medicacoes ativas (`Prescricao`)
- Alergias e comorbidades

### 10.4 Novos campos

- `especialidadeDestino` (ref `Especialidade`)
- `pareceristaSugerido` (opcional; fila pega se vazio)
- `urgencia` — `rotina | prioritaria | urgente | emergente`
- `slaMinutos` (derivado de urgencia, configuravel por hospital)
- `questaoClinica` (texto, pergunta objetiva)
- `hipoteseDiagnosticaSolicitante`
- `dadosRelevantes` (texto livre + anexos)
- `respostaParecer` (texto longo)
- `condutaRecomendada` (texto)
- `seguimentoRecomendado` — `alta_do_parecer | reavaliar_em_24h | reavaliar_em_48h | acompanhamento_continuo | compartilhar_caso`
- `coAssinaturaTutor` (quando solicitante e residente)
- `tempoResposta`
- `linkParaEvolucaoGerada`

### 10.5 Preenchimento inteligente

- Solicitacao pre-preenche `hipoteseDiagnosticaSolicitante` com ultima hipotese da `EvolucaoClinica`.
- Lista de medicacoes ativas anexada automaticamente.
- Sugestao de especialidade destino baseada em CIDs ativos (ex: I21 -> cardiologia).
- Sugere pareceristas de plantao naquele turno (via `PractitionerRole` + `Turno`).
- Ao responder, sistema cria rascunho de `EvolucaoClinica` do tipo "parecer" ja pre-populado.

### 10.6 Validacoes obrigatorias

- `questaoClinica` >= 40 caracteres, precisa ser pergunta (heuristica: termina em "?" ou contem "avaliar", "conduta", "opiniao sobre").
- `especialidadeDestino` deve ter escala ativa no hospital.
- Resposta obrigatoria dentro do SLA — apos expirar, vira overdue visivel no `/tasks`.
- Parecerista nao pode responder parecer solicitado por ele mesmo.
- Residente nao finaliza resposta sem co-assinatura do tutor.

### 10.7 Alertas

- "SLA de 30min para urgente expira em 8min."
- "Paciente ja tem parecer aberto da mesma especialidade — deseja agregar?"
- "Especialista Dr X esta de plantao e aceita pareceres digitais ate 22h."
- "Medicacao prescrita hoje pode ter interacao com conduta sugerida no parecer."

### 10.8 Permissoes

| Acao | Solicitante | Parecerista | Residente | Chefia | Enf | Auditor |
|---|---|---|---|---|---|---|
| Criar solicitacao | sim | nao | sim (co-assina) | sim | nao | nao |
| Responder | nao | sim | sim (co-assina) | sim | nao | nao |
| Reatribuir fila | nao | nao | nao | sim | nao | nao |
| Ver todos pareceres especialidade | nao | sim | sim | sim | nao | sim |
| Cancelar parecer | sim | nao | sim | sim | nao | sim |

### 10.9 Status e workflow

```
[rascunho] --enviar--> [aguardando_triagem]
[aguardando_triagem] --chefia atribui--> [atribuido]
[atribuido] --parecerista aceita--> [em_avaliacao]
[em_avaliacao] --responde--> [respondido]
[respondido] --solicitante ciencia--> [encerrado]
[qualquer ate respondido] --cancelar--> [cancelado]
[aguardando_triagem|atribuido|em_avaliacao] --SLA expira--> [overdue] (nao e terminal; workflow continua)
[respondido] --reabrir com nova duvida--> [reaberto] --> [em_avaliacao]
```

### 10.10 Integracoes

- `velya-tasks` — cria Task no destino com deadline = slaMinutos.
- `velya-notifications` — push e SMS para parecerista (ordem: in-app, push, SMS se urgente e >50 por cento do SLA).
- `EvolucaoClinica` — cria registro do tipo `parecer_resposta`.
- `velya-clinical-search` — indexa questao e resposta.

### 10.11 Historico e auditoria

- Todas as transicoes gravadas com timestamp e responsavel.
- Reabertura cria nova versao mantendo original imutavel.
- Tempo gasto lendo parecer (view duration) registrado para auditoria de qualidade.

### 10.12 Melhorias de UX

- Fila de pareceres por especialidade em `/specialties/[id]/pareceres` com colunas: paciente, questao, solicitante, urgencia, SLA restante, acoes rapidas.
- Contador regressivo visivel (fonte monoespacada, sem cor).
- Botao "aceitar" / "rejeitar com motivo" em 1 clique.
- Painel contextual do paciente lateral ao responder — evita troca de tela.
- Inserir templates de resposta por especialidade (ex: cardiologia pre-operatoria).
- Modo leitura: parecer encerrado vira card compacto na timeline.

### 10.13 Mock logico da tela

```
+-------------------------------------------------------------------------------+
| Cardiologia > Pareceres (fila)                                                |
+-------------------------------------------------------------------------------+
| urg | paciente           | questao                      | solic.    | SLA    |
+-----+--------------------+------------------------------+-----------+--------+
| EMG | Maria O. 48a       | Avaliar IAM? conduta?        | Dr Silva  | 04:21  |
| URG | Jose M. 72a leito9 | Cardiopatia previa? anest?   | Dra Lima  | 18:02  |
| PRI | Ana R. 55a         | ICC descompensada?           | Dr Souza  | 1h32   |
| ROT | Carlos T. 30a      | Check-up pre-op eletivo      | Dr Alves  | 22h    |
+-------------------------------------------------------------------------------+
| [ Responder > ]  [ Aceitar ] [ Rejeitar com motivo ] [ Delegar ]              |
+-------------------------------------------------------------------------------+

--- Tela de resposta ----------------------------------------------------------
+---------------------------+-------------------------------------------------+
| CONTEXTO PACIENTE         | QUESTAO DO SOLICITANTE                          |
| Maria O. 48a MRN 01023    | Avaliar possivel IAM em paciente com dor        |
| Leito UCO-3               | precordial 3h, ECG com supra V2-V4. Conduta?    |
| CID ativos: I21.0, E11    |                                                 |
| Alergias: dipirona        | Hipotese solicitante: IAM com supra             |
| Sinais 12:10: 162/98 ...  |                                                 |
| [ ver cockpit completo ]  | [ template: iam-agudo ] [ macros ]              |
|                           |                                                 |
|                           | RESPOSTA                                        |
|                           | [..................................]           |
|                           |                                                 |
|                           | Conduta recomendada                             |
|                           | [..................................]           |
|                           |                                                 |
|                           | Seguimento: ( ) Reavaliar 24h ...               |
|                           | [ Salvar rascunho ] [ Responder e encerrar ]    |
+---------------------------+-------------------------------------------------+
```

### 10.14 Criterios de aceite

- [ ] Solicitante demora `<90s` para criar parecer padrao.
- [ ] Fila da especialidade atualiza em tempo real (WebSocket).
- [ ] SLA expirado escala para chefia em 1min.
- [ ] Resposta cria `EvolucaoClinica` e aparece na timeline unica.
- [ ] Reabertura mantem historico original imutavel.
- [ ] Tempo medio de resposta para urgente `<=30min` em 95 por cento dos casos.

### 10.15 Riscos e seguranca

- **Parecer fantasma**: parecerista marca como respondido sem texto adequado — validar minimo 80 caracteres e presenca de conduta.
- **Acesso lateral a prontuario**: parecerista so ve dados clinicos dos pacientes que tem parecer aberto (break-the-glass registrado).
- **SLA irrealista**: evitar configurar SLA `<10min` para rotina — UI bloqueia.

### 10.16 Backlog tecnico

- [ ] `packages/velya-clinical-schemas/Parecer.ts`.
- [ ] `apps/velya-web/src/app/pacientes/[mrn]/pareceres/novo/page.tsx`.
- [ ] `apps/velya-web/src/app/specialties/[id]/pareceres/page.tsx` (fila).
- [ ] `services/velya-sla-engine` (generico, reutilizado por tasks, pareceres, exames).
- [ ] NATS consumer que cria Task automaticamente.

### 10.17 Modelo de dados

```ts
export type UrgenciaParecer =
  | "rotina"
  | "prioritaria"
  | "urgente"
  | "emergente";

export type StatusParecer =
  | "rascunho"
  | "aguardando_triagem"
  | "atribuido"
  | "em_avaliacao"
  | "respondido"
  | "encerrado"
  | "cancelado"
  | "reaberto";

export interface ParecerMedico {
  id: string;
  hospitalId: string;
  pacienteId: string;
  internacaoId?: string;

  solicitanteId: string;
  tutorCoAssinaId?: string;
  especialidadeDestinoId: string;
  pareceristaSugeridoId?: string;
  pareceristaAtribuidoId?: string;

  urgencia: UrgenciaParecer;
  slaMinutos: number;
  prazoResposta: string; // ISO

  questaoClinica: string;
  hipoteseDiagnosticaSolicitante: string;
  dadosRelevantes?: string;
  anexos: Array<{ tipo: "exame" | "imagem" | "documento"; refId: string }>;

  respostaParecer?: string;
  condutaRecomendada?: string;
  seguimentoRecomendado?:
    | "alta_do_parecer"
    | "reavaliar_em_24h"
    | "reavaliar_em_48h"
    | "acompanhamento_continuo"
    | "compartilhar_caso";
  evolucaoGeradaId?: string;

  status: StatusParecer;
  overdue: boolean;
  tempoRespostaMin?: number;

  criadoEm: string;
  respondidoEm?: string;
  encerradoEm?: string;
  historicoTransicoes: Array<{ de: StatusParecer; para: StatusParecer; em: string; por: string; motivo?: string }>;
}
```

### 10.18 APIs / eventos NATS

- `clinical.parecer.solicitado`
- `clinical.parecer.atribuido`
- `clinical.parecer.em_avaliacao`
- `clinical.parecer.respondido`
- `clinical.parecer.overdue`
- `clinical.parecer.encerrado`
- `clinical.parecer.reaberto`
- REST: `POST /api/pareceres`, `POST /:id/aceitar`, `POST /:id/responder`, `POST /:id/reabrir`.

### 10.19 Metricas

- Tempo mediano de resposta por urgencia (meta: urgente `<=30min`, rotina `<=24h`).
- Taxa de SLA cumprido (meta: `>=95 por cento`).
- Percentual de pareceres que geraram mudanca de conduta documentada.
- Percentual de pareceres reabertos (indicador de qualidade da primeira resposta).

---

## 11. Prescricoes (ULTRA PRIORITARIO)

Modulo nuclear do Velya. Erro de medicacao e a principal causa evitavel de dano hospitalar (IOM, WHO Patient Safety). A prescricao precisa ser rapida o suficiente para nao atrapalhar o fluxo medico, mas segura o suficiente para bloquear 100 por cento das interacoes farmacologicas criticas e alergias conhecidas. Esta secao e intencionalmente 2x mais detalhada.

### 11.1 Objetivo

Prescrever medicamentos, solucoes, dietas, cuidados de enfermagem e procedimentos em um unico documento clinico por periodo (geralmente 24h), com suporte a order sets, kits, reconciliacao medicamentosa, favoritos pessoais e por especialidade, checagem 5 certos pela enfermagem, aprazamento inteligente, validacao farmaceutica e rastreabilidade ponta a ponta, cumprindo RDC 67/2007, CFM 1.821/2007 e Protocolo ICP de Seguranca do Paciente.

### 11.2 Usuarios

- Medico assistente (prescritor principal)
- Medico plantonista (prescreve e valida SN)
- Residente (prescreve com co-assinatura)
- Farmaceutico clinico (valida, sugere ajustes, reconcilia)
- Enfermagem (apraza, administra, checa 5 certos)
- Nutricao (dieta e TN)
- Terapia intensiva (prescricoes complexas drip)
- Oncologia (protocolos QT)
- Auditoria clinica

### 11.3 Campos mantidos

- `Paciente` (peso, altura, IMC, superficie corporea, clearance creatinina)
- `Internacao` (leito, unidade, tipo de cuidado)
- Alergias (severidade e reacao)
- Comorbidades relevantes (renal, hepatico, gestacao, amamentacao)
- `RegistroSinaisVitais` recente (para ajuste drip)
- Exames: funcao renal, funcao hepatica, hemograma, INR, potassio, magnesio, glicemia
- Historico medicamentoso previo e em uso domiciliar

### 11.4 Novos campos

#### 11.4.1 Cabecalho

- `tipoPrescricao` — `diaria | pos_operatoria | alta_hospitalar | ambulatorial | qt_protocolo | emergencial`
- `validadeInicioFim` (ISO, default: agora + 24h arredondado para proximo turno)
- `revisaoEm` (datetime)
- `assinaturaDigital`
- `farmaceuticoValidador`
- `statusValidacaoFarmaceutica` — `pendente | aprovada | aprovada_com_ressalvas | devolvida`

#### 11.4.2 Item de prescricao

- `tipoItem` — `medicamento | solucao | dieta | cuidado_enfermagem | procedimento | oxigenio | hemocomponente`
- `principioAtivo` (referencia ao catalogo com codigo Anvisa/ATC)
- `produtoPadronizado` (item padronizado do hospital)
- `apresentacao` (ex: comprimido 500mg)
- `dose`, `doseUnidade`
- `via` — `vo | sl | sc | im | ev_bolus | ev_infusao | in | topica | retal | sng | gpt | enteral | parenteral | inalatoria | intratecal | intraarticular`
- `frequencia` (ex: 8/8h, ACM, SN, continuo)
- `aprazamento[]` (datetimes calculados)
- `duracao` (dias ou ate data)
- `velocidadeInfusao` (ml/h) e `concentracao` (para drip)
- `diluente` e `volumeTotal`
- `condicaoUso` (ex: se PAS > 160)
- `observacoesEnfermagem`
- `modoPreparo` (para QT, antibiotico reconstituido)
- `seNecessario` (flag + intervalo minimo)
- `itemDoOrderSet` (ref se veio de template)
- `favoritoId` (se veio de favorito)
- `alertasDisparados[]` (alergia, interacao, dose, renal etc.)
- `justificativaOverride[]` (quando medico sobrepoe alerta)

#### 11.4.3 Controle

- `reconciliacaoDomiciliar` (link para medicacoes de uso domestico conferidas)
- `suspensoesAutomaticas` (ex: antibiotico com dias maximos)
- `prescricoesVinculadas` (renovacao de ontem, ajuste de hoje)

### 11.5 Regras de preenchimento inteligente

- Reconciliacao automatica: ao admitir, sistema compara lista domiciliar vs prescricao nova e mostra diff (adicionados, mantidos, suspensos, trocados).
- "Ontem mesmo" — 1 clique renova prescricao do dia anterior, herda itens com checkbox para manter/alterar/remover.
- Order sets por motivo de internacao (ex: "IAM sem supra admissao" traz AAS 300 + clopidogrel + enoxaparina + atorvastatina + betabloq + IECA).
- Kits por procedimento (ex: "pos-op artroplastia" traz analgesia multimodal + profilaxia TVP + antiemetico).
- Favoritos pessoais com nome customizado (ex: "meu AAS padrao").
- Ajuste automatico de dose por clearance (Cockcroft-Gault) e Child-Pugh se funcao hepatica alterada.
- Sugere via mais adequada: se paciente com SNE, sinaliza medicamentos que nao podem ser triturados.
- Aprazamento sugerido respeita horarios da unidade e agrupa medicamentos compativeis.
- Para drip, calcula velocidade a partir de dose/peso/tempo (ex: noradrenalina 0.1mcg/kg/min).
- Duplicidade: detecta 2 itens com mesma classe terapeutica e alerta.

### 11.6 Validacoes obrigatorias

1. **Alergia conhecida** — bloqueio duro se severidade `anafilaxia` ou `grave`; requer justificativa se moderada.
2. **Interacao medicamentosa** — base ANVISA/First Databank; bloqueio se classe D (contraindicada), alerta se C.
3. **Dose maxima diaria** — bloqueia se exceder LD50 seguranca; alerta se >80 por cento da dose maxima.
4. **Ajuste renal/hepatico** — alerta forte se clearance `<30` e droga exige ajuste.
5. **Gestante/lactante** — mostra categoria (A/B/C/D/X ou FDA) e bloqueia X.
6. **Pediatria** — dose por peso obrigatoria; alerta se fora de janela.
7. **Via compativel com apresentacao** — bloqueia EV de comprimido.
8. **Unidade coerente** — bloqueia `mg` em solucao que so aceita `ml`.
9. **Medicamento controlado (Portaria 344/1998)** — campo `cidJustificativa` e numero de receita especial obrigatorio.
10. **Antibiotico com tempo maximo** — ex: vancomicina com plano de suspensao em 10d.
11. **Medico com CRM ativo e certificado digital valido**.
12. **Horario realista** — aprazamento nao pode ser no passado.

### 11.7 Alertas e sugestoes

- "Paciente alergica a dipirona (reacao anafilatica 2024). Bloqueado."
- "Claritromicina + sinvastatina: interacao classe D. Sugerir atorvastatina?"
- "Clearance 22ml/min — reduzir enoxaparina para 1mg/kg 1x/dia."
- "Paciente gestante 2o trimestre. Enalapril categoria D. Substituir por metildopa?"
- "Vancomicina sem dosagem serica em 72h — solicitar nivel?"
- "Ja existe AAS prescrito no item 4 — duplicidade."
- "Paciente com SNE — omeprazol comprimido nao pode ser triturado. Trocar por solucao oral?"
- "Plano de suspensao: antibiotico vence em 2 dias — medicina deseja renovar ou descalonar?"

### 11.8 Permissoes

| Acao | Medico | Residente | Farma | Enf | Nutri | Auditor |
|---|---|---|---|---|---|---|
| Criar prescricao | sim | sim (co-ass) | nao | nao | nao (dieta sugerida) | nao |
| Adicionar item clinico | sim | sim | nao | nao | so dieta | nao |
| Validar farmacia | nao | nao | sim | nao | nao | nao |
| Aprazar | nao | nao | opcional | sim | nao | nao |
| Administrar (5 certos) | nao | nao | nao | sim | nao | nao |
| Suspender item | sim | sim | sugere | nao | nao | nao |
| Override de alerta critico | sim (audit log) | nao | nao | nao | nao | nao |
| Renovar ontem | sim | sim | nao | nao | nao | nao |

### 11.9 Status e workflow

#### 11.9.1 Prescricao (cabecalho)

```
[rascunho] --assinar--> [aguardando_validacao_farmaceutica]
[aguardando_validacao_farmaceutica] --farma aprova--> [validada]
[aguardando_validacao_farmaceutica] --farma devolve--> [em_ajuste] --> [rascunho]
[aguardando_validacao_farmaceutica] --farma aprova com ressalva--> [validada_com_ressalva]
[validada|validada_com_ressalva] --vigencia expira--> [expirada]
[validada|validada_com_ressalva] --substituida--> [substituida] (nova vigente)
[qualquer] --suspender prescricao inteira--> [suspensa]
```

#### 11.9.2 Item (estado por administracao)

```
[aprazado] --enf confere 5 certos--> [em_administracao] --> [administrado]
[aprazado] --paciente recusa--> [recusado] (com motivo)
[aprazado] --paciente ausente--> [adiado] (nova janela)
[aprazado] --SN, condicao nao atendida--> [nao_administrado_sn]
[aprazado] --erro de preparo--> [cancelado_preparo]
[administrado] --reacao adversa--> [administrado_com_eva] (liga a RAM/farmacovigilancia)
```

### 11.10 Integracoes

- `velya-drug-catalog` — catalogo com sinonimos, codigo ATC, Anvisa, DCB, padronizacao do hospital.
- `velya-interaction-engine` — base externa (First Databank ou Micromedex) com cache local.
- `velya-renal-dose-engine` — Cockcroft/CKD-EPI e ajustes.
- `velya-oncology-protocols` — QT por ciclo (dose por superficie, curva).
- `velya-farmacovigilancia` — RAM e eventos adversos.
- `velya-pharmacy-logistics` — dispensacao unitizada.
- `velya-kanban-leitos` — estoque beira-leito.
- `velya-barcode` — leitura na administracao.

### 11.11 Historico e auditoria

- Versionamento por prescricao; cada edicao pos-assinatura cria nova versao com diff.
- Cada administracao gera `AdministracaoMedicamento` imutavel com hash e assinatura enfermagem.
- Override de alerta critico registra: alerta, justificativa, medico, timestamp, IP.
- Retencao 20 anos.
- Trilha completa exportavel para CVS/ANS em incidentes.

### 11.12 Melhorias de UX

- Layout 3 colunas: lista de itens (esq), editor do item ativo (centro), contexto + alertas (dir).
- Adicao de item por linha de comando: `dipirona 1g ev 6/6h 3d`. Parser transforma em campos.
- Busca com sinonimos comerciais (ex: "Novalgina" -> dipirona).
- Teclas rapidas: `/` focar busca, `Enter` adicionar, `Shift+Enter` salvar rascunho, `Ctrl+Enter` assinar, `Alt+F` favorito, `Alt+O` order set.
- Drip calculator inline com slider de velocidade + preview pictorico da concentracao.
- Semaforo monocromatico por item (preto: ok; contorno grosso: alerta; linha vertical a esquerda: critico).
- Modo "prescricao espelho" — duas colunas: hoje vs ontem, com diff visual.
- Kanban de administracao na vista de enfermagem (grade de horarios por paciente do leito x medicacao).
- Historico do item com `Ver ultimas 10 administracoes` em tooltip.

### 11.13 Mock logico da tela (prescritor)

```
+-------------------------------------------------------------------------------+
| Maria O. MRN 01023 48a F 62kg 160cm SC 1.68 ClCr 58 IMC 24                    |
| Alergias: DIPIRONA (grave) | Gestacao: nao | Hepat.: ok | Renal: ajuste leve  |
+-------------------------------------------------------------------------------+
| [ Novo item ] [ Favoritos ] [ Order set ] [ Kit ] [ Ontem mesmo ] [ Reconcilia]|
+-------------------+-----------------------------------+---------------------+
| ITENS (7)         | EDITOR DO ITEM 3                  | CONTEXTO & ALERTAS  |
|-------------------+-----------------------------------+---------------------|
| 1 AAS 100mg vo 1x | Principio: Enoxaparina            | ALERTAS (2)         |
| 2 Clopidogrel 75  | Produto: ENOXA 60mg/0.6ml         | [!] ClCr 58: dose   |
| 3 Enoxa 60mg sc   | Dose: 60 mg   Via: SC             |     1mg/kg 12/12h   |
| 4 Atorva 40mg vo  | Frequencia: 12/12h                | [!] Cuidado IM      |
| 5 Metoprolol 50mg | Duracao: ate suspensao            |                     |
| 6 Omeprazol 40    | Justif clinica: IAM sem supra     | INTERACOES          |
| 7 Dieta branda    | Se PAS<100 suspender: [x]         | Nenhuma critica.    |
|                   |                                   |                     |
| [+] adicionar     | [ Salvar item ]                   | DADOS RELEVANTES    |
| cmd: vanco 1g ev  |                                   | Cr 1.4 ClCr 58      |
|                   |                                   | INR 1.1 Plaq 220k   |
+-------------------+-----------------------------------+---------------------+
| Farmaceutico: aguardando | vigencia 12/04 07:00 a 13/04 07:00                |
| [ Salvar rascunho ]    [ Assinar e enviar para farmacia ]                    |
+-------------------------------------------------------------------------------+
```

### 11.14 Mock logico (enfermagem — kanban administracao)

```
+-------------------------------------------------------------------------------+
| Leito UCO-3 Maria O.  | 06:00 | 08:00 | 10:00 | 12:00 | 14:00 | 16:00 | 18:00|
+-----------------------+-------+-------+-------+-------+-------+-------+------+
| AAS 100mg vo          |   .   | [ok]  |   .   |   .   |   .   |   .   |  .  |
| Clopidogrel 75mg      |   .   | [ok]  |   .   |   .   |   .   |   .   |  .  |
| Enoxa 60mg SC         |   .   | [ok]  |   .   |   .   |   .   |   .   |[  ] |
| Atorva 40mg vo        |   .   |   .   |   .   |   .   |   .   |   .   |[  ] |
| Metoprolol 50mg vo    |   .   |   .   |[  ]   |   .   |   .   |   .   |  .  |
| Omeprazol 40mg ev     | [ok]  |   .   |   .   |   .   |   .   |   .   |  .  |
+-------------------------------------------------------------------------------+
| [  ] abrir para checar 5 certos: ler cracha + pulseira + codigo da droga      |
+-------------------------------------------------------------------------------+
```

### 11.15 Criterios de aceite

- [ ] Tempo para prescrever 7 itens padrao `<90s` usando order set.
- [ ] Alerta de alergia anafilatica bloqueia 100 por cento das tentativas (teste com 20 casos).
- [ ] Ajuste renal calculado e exibido automaticamente quando ClCr `<60`.
- [ ] Override de alerta critico exige justificativa `>=40` caracteres e registra em audit.
- [ ] Reconciliacao na admissao detecta 100 por cento das diferencas simuladas.
- [ ] Kanban de administracao atualiza em tempo real via WebSocket.
- [ ] Prescricao assinada gera PDF PAdES.
- [ ] 5 certos exige leitura de codigo de barras do paciente e da droga (ou override explicito).
- [ ] Farmaceutico valida 95 por cento das prescricoes em `<15min`.
- [ ] Suspensao automatica de antibiotico dispara alerta 24h antes.

### 11.16 Riscos e seguranca

- **Alerta fatigue**: se medico ignora X alertas/dia, UI reduz ranking de alertas C e mantem D com atrito extra. Dashboard de fadiga no admin.
- **Override silencioso**: cada override gera review aleatoria pelo comite de farmacovigilancia.
- **Mismatch de unidade**: sempre mostrar unidade convertida em duas formas (mg e mg/kg).
- **Prescricao verbal**: suportada em codigo de excecao com exigencia de ratificacao escrita em 24h; bloqueia apos.
- **LGPD**: categoria terapeutica sensivel (oncologico, psiquiatrico, HIV) com visualizacao restrita ao CareTeam.
- **Integridade do catalogo**: changelog assinado por farmaceutico responsavel tecnico (RT).

### 11.17 Backlog tecnico

- [ ] `packages/velya-clinical-schemas/Prescricao.ts`, `ItemPrescricao.ts`, `AdministracaoMedicamento.ts`.
- [ ] `services/velya-drug-catalog` (DCB + ATC + Anvisa + padronizacao hospital).
- [ ] `services/velya-interaction-engine` (adapter Micromedex + cache local).
- [ ] `services/velya-renal-dose-engine`.
- [ ] `services/velya-oncology-protocols`.
- [ ] `apps/velya-web/src/app/pacientes/[mrn]/prescricao/page.tsx` (3 colunas).
- [ ] `apps/velya-web/src/features/prescricao/CommandParser.ts` (parser linha de comando).
- [ ] `apps/velya-web/src/features/admin-med/KanbanAdministracao.tsx`.
- [ ] `apps/velya-web/src/features/prescricao/Reconciliacao.tsx`.
- [ ] Integracao codigo de barras GS1 DataMatrix.
- [ ] Migrations: `prescricoes`, `itens_prescricao`, `administracoes_medicamento`, `alertas_disparados`, `overrides_justificativa`.

### 11.18 Modelo de dados

```ts
export type TipoItemPrescricao =
  | "medicamento"
  | "solucao"
  | "dieta"
  | "cuidado_enfermagem"
  | "procedimento"
  | "oxigenio"
  | "hemocomponente";

export type ViaAdministracao =
  | "vo"
  | "sl"
  | "sc"
  | "im"
  | "ev_bolus"
  | "ev_infusao"
  | "in"
  | "topica"
  | "retal"
  | "sng"
  | "gpt"
  | "enteral"
  | "parenteral"
  | "inalatoria"
  | "intratecal"
  | "intraarticular";

export type StatusPrescricao =
  | "rascunho"
  | "aguardando_validacao_farmaceutica"
  | "validada"
  | "validada_com_ressalva"
  | "em_ajuste"
  | "substituida"
  | "suspensa"
  | "expirada";

export type StatusItemAdmin =
  | "aprazado"
  | "em_administracao"
  | "administrado"
  | "administrado_com_eva"
  | "recusado"
  | "adiado"
  | "nao_administrado_sn"
  | "cancelado_preparo";

export interface Prescricao {
  id: string;
  hospitalId: string;
  pacienteId: string;
  internacaoId: string;
  tipoPrescricao:
    | "diaria"
    | "pos_operatoria"
    | "alta_hospitalar"
    | "ambulatorial"
    | "qt_protocolo"
    | "emergencial";
  vigenciaInicio: string;
  vigenciaFim: string;
  revisaoEm?: string;
  prescritorId: string;
  tutorCoAssinaId?: string;
  assinaturaDigital?: { hash: string; certificadoSubject: string; em: string };
  farmaceuticoValidadorId?: string;
  statusValidacaoFarmaceutica: "pendente" | "aprovada" | "aprovada_com_ressalvas" | "devolvida";
  ressalvasFarmacia?: string;
  status: StatusPrescricao;
  itens: ItemPrescricao[];
  prescricaoAnteriorId?: string; // renovacao
  orderSetId?: string;
  kitId?: string;
  criadoEm: string;
  atualizadoEm: string;
  versao: number;
}

export interface ItemPrescricao {
  id: string;
  prescricaoId: string;
  ordem: number;
  tipoItem: TipoItemPrescricao;
  principioAtivoId?: string;
  produtoPadronizadoId?: string;
  apresentacaoTexto?: string;
  dose?: number;
  doseUnidade?: string;
  via?: ViaAdministracao;
  frequenciaTexto: string;
  frequenciaCron?: string; // ex: "*/8 * * *"
  aprazamento: string[]; // ISO datetimes
  duracaoTexto?: string;
  duracaoDias?: number;
  velocidadeInfusaoMlH?: number;
  concentracaoTexto?: string;
  diluente?: string;
  volumeTotalMl?: number;
  condicaoUso?: string;
  observacoesEnfermagem?: string;
  modoPreparo?: string;
  seNecessario: boolean;
  intervaloMinimoSN?: string;
  favoritoId?: string;
  itemDoOrderSet?: string;
  alertasDisparados: Array<{
    tipo: "alergia" | "interacao" | "dose" | "renal" | "hepatico" | "gestacao" | "pediatria" | "duplicidade" | "via";
    severidade: "baixa" | "moderada" | "alta" | "critica";
    mensagem: string;
    baseRef?: string;
  }>;
  justificativaOverride?: string;
}

export interface AdministracaoMedicamento {
  id: string;
  itemPrescricaoId: string;
  pacienteId: string;
  horarioAprazado: string;
  horarioReal?: string;
  status: StatusItemAdmin;
  enfermeiroId?: string;
  checagem5Certos: {
    paciente: boolean;
    droga: boolean;
    dose: boolean;
    via: boolean;
    horario: boolean;
    pacienteIdBarcodeLido: boolean;
    drogaBarcodeLido: boolean;
  };
  motivoNaoAdministracao?: string;
  eventoAdverso?: {
    descricao: string;
    severidade: "leve" | "moderada" | "grave" | "ameaca_vida";
    relatadoEm: string;
  };
  hashAuditoria: string;
  criadoEm: string;
}
```

### 11.19 APIs / eventos NATS

- `clinical.prescricao.rascunho_criada`
- `clinical.prescricao.assinada`
- `clinical.prescricao.validada_farma`
- `clinical.prescricao.devolvida_farma`
- `clinical.prescricao.expirada`
- `clinical.prescricao.substituida`
- `clinical.item.alerta_disparado`
- `clinical.item.override_registrado`
- `clinical.item.aprazado`
- `clinical.item.administrado`
- `clinical.item.recusado`
- `clinical.item.eva_notificado`
- `clinical.reconciliacao.diff_gerado`
- REST: `POST /api/prescricoes`, `PATCH /:id/itens`, `POST /:id/assinar`, `POST /:id/validar-farma`, `POST /:id/itens/:itemId/administrar`, `POST /:id/itens/:itemId/recusar`.

### 11.20 Metricas

- Tempo mediano para emitir prescricao (meta: `<=2min` para renovacao e `<=5min` para nova).
- Percentual de prescricoes com alerta critico nao-override (meta: `>=99 por cento`).
- Percentual de administracoes com 5 certos completos via barcode (meta: `>=90 por cento`).
- Taxa de eventos adversos medicamentosos por 1000 pacientes-dia (meta: reducao `>=30 por cento` em 12 meses).
- Tempo mediano de validacao farmaceutica (meta: `<=15min`).
- Taxa de reconciliacao medicamentosa concluida na admissao (meta: `>=95 por cento`).
- Cobertura de favoritos e order sets na emissao (meta: `>=60 por cento` dos itens).

---

## 12. Procedimentos e Exames Gerais

Solicitacao e gestao de exames (laboratoriais, imagem, cardiologicos, endoscopicos etc.) e procedimentos nao cirurgicos (paracentese, toracocentese, passagem de sonda etc.).

### 12.1 Objetivo

Permitir selecao rapida de exames/procedimentos por sinonimo, multi-selecao, pre-cadastros de baterias, preparo automatico, aprazamento realistico, integracao com LIS/RIS, e trazer laudo/resultado para a timeline do paciente com indicadores de alerta clinico (ex: potassio 6.8).

### 12.2 Usuarios

- Medico solicitante
- Enfermagem (coleta, preparo)
- Tecnico lab / radiologia
- Medico laudador
- Agendamento
- Auditoria

### 12.3 Campos mantidos

- `Paciente`, `Internacao`, `CareTeam`
- Alergias (contraste)
- Funcao renal (contraste iodado)
- Gestacao (radiacao)
- Jejum ja registrado (dieta)

### 12.4 Novos campos

- `tipoExame` — `laboratorial | imagem | endoscopia | cardiovascular | neurofisiologia | anatomopatologico | outros`
- `codigoTussSigtap`
- `nome` e `sinonimos[]`
- `indicacaoClinica` (obrigatorio)
- `cidJustificativa`
- `urgencia` — `rotina | prioritaria | urgente | emergente`
- `preparoNecessario[]` (jejum, suspensao de droga, dieta)
- `instrucoesPreparo` (texto)
- `localExecucao`
- `coletadoEm`, `executadoEm`, `laudadoEm`
- `resultado` (estruturado por analito ou texto de laudo)
- `flagCritico` (panico lab)
- `imagensUrls[]`, `laudoPdfUrl`
- `requisicaoBateriaId` (quando parte de pacote)

### 12.5 Preenchimento inteligente

- Busca com fuzzy + sinonimos ("ureia, BUN, uremia").
- Pacotes pre-cadastrados por contexto (ex: "admissao clinica geral": HMG, Na, K, Cr, U, glicemia, TGO/TGP, INR, TTPA, EAS, RX torax, ECG).
- Pacotes por especialidade (ex: pre-op cardiologia, sepse, AVC agudo).
- Sugestao automatica: se paciente com dor toracica sem exame nas ultimas 4h, sugere ECG + troponina.
- Verifica duplicidade: "HMG ja coletado ha 4h — solicitar novamente?"

### 12.6 Validacoes

- `indicacaoClinica` `>=` 30 caracteres.
- Contraste iodado + ClCr `<30` exige override e hidratacao registrada.
- Exame com radiacao em gestante exige justificativa.
- Urgente exige aprazamento em 60min.

### 12.7 Alertas

- "Resultado critico: K 6.8 mEq/L — avisar medico assistente."
- "Ja coletado ha 2h — duplicidade."
- "RX torax em gestante 1o trim — considerar USG?"

### 12.8 Permissoes

| Acao | Medico | Enf | Tec Lab | Laudador | Auditor |
|---|---|---|---|---|---|
| Solicitar | sim | nao | nao | nao | nao |
| Registrar coleta | nao | sim | sim | nao | nao |
| Lancar resultado | nao | nao | sim | sim (laudo) | nao |
| Validar laudo | nao | nao | nao | sim | nao |
| Ver resultado | sim | sim | so seu setor | sim | sim |

### 12.9 Workflow

```
[solicitado] --agendamento--> [agendado] --coleta/preparo--> [em_execucao]
[em_execucao] --resultado parcial--> [resultado_parcial]
[em_execucao] --finalizado--> [aguardando_laudo] --laudado--> [concluido]
[solicitado|agendado] --cancelado--> [cancelado]
[qualquer] --resultado critico--> [critico_pendente_ciencia] --med da ciencia--> [concluido]
```

### 12.10 Integracoes

- LIS (HL7 v2 ORU / FHIR DiagnosticReport)
- RIS/PACS (DICOM + FHIR ImagingStudy)
- Agendamento
- NATS para broadcast

### 12.11 Auditoria

- Registro de quem viu resultado critico e quando deu ciencia.
- Retencao de imagens conforme CFM.

### 12.12 UX

- Selecao multipla com checkboxes e pacotes.
- Indicador de preparo com checklist automatico para enfermagem.
- Tabelinha de resultado numerico com destaque de fora-da-faixa (contorno grosso, sem cor).
- Comparacao temporal: exame atual vs anteriores em graficos sparkline monocromaticos.

### 12.13 Mock

```
+-------------------------------------------------------------------------------+
| Solicitar exames para Maria O.                                                |
+-------------------------------------------------------------------------------+
| busca: [ potass_____ ]  sinonimos: potassio serico, K, caliemia                |
| [x] Potassio | [ ] Magnesio | [ ] Calcio ionico                                |
|                                                                                |
| Pacotes:  [ Admissao Clinica ] [ Sepse ] [ Dor toracica ] [ Pre-op Cardio ]   |
| Selecionados (6): HMG, Na, K, U, Cr, Tropo I                                   |
| Urgencia: (x) Urgente   Indicacao: ( necessario ao menos 30 chars )            |
| [ Solicitar ]                                                                  |
+-------------------------------------------------------------------------------+
```

### 12.14 Aceite

- [ ] Busca retorna resultado em `<300ms`.
- [ ] Pacotes reduzem tempo de solicitacao em `>=60 por cento`.
- [ ] Resultado critico dispara notificacao em 30s.
- [ ] Laudo em PDF anexado a timeline.

### 12.15 Riscos

- Resultado critico ignorado — escalonamento automatico para chefia em 15min sem ciencia.
- Duplicidade por pedidos de varios residentes — deduplicacao em janela configuravel.

### 12.16 Backlog

- [ ] `packages/velya-clinical-schemas/SolicitacaoExame.ts`
- [ ] Adapter LIS HL7 v2
- [ ] Adapter RIS FHIR ImagingStudy
- [ ] Componente `CriticalValueAcknowledge`

### 12.17 Modelo de dados

```ts
export type TipoExame =
  | "laboratorial"
  | "imagem"
  | "endoscopia"
  | "cardiovascular"
  | "neurofisiologia"
  | "anatomopatologico"
  | "outros";

export type StatusExame =
  | "solicitado"
  | "agendado"
  | "em_execucao"
  | "resultado_parcial"
  | "aguardando_laudo"
  | "critico_pendente_ciencia"
  | "concluido"
  | "cancelado";

export interface SolicitacaoExame {
  id: string;
  hospitalId: string;
  pacienteId: string;
  internacaoId?: string;
  tipoExame: TipoExame;
  codigoTuss?: string;
  codigoSigtap?: string;
  nome: string;
  sinonimos: string[];
  indicacaoClinica: string;
  cidJustificativa?: string;
  urgencia: "rotina" | "prioritaria" | "urgente" | "emergente";
  preparoNecessario: Array<{ tipo: "jejum" | "suspender_droga" | "dieta" | "outro"; descricao: string }>;
  instrucoesPreparo?: string;
  localExecucao?: string;
  solicitanteId: string;
  solicitadoEm: string;
  agendadoEm?: string;
  coletadoEm?: string;
  executadoEm?: string;
  laudadoEm?: string;
  laudadorId?: string;
  resultadoEstruturado?: Array<{ analito: string; valor: string; unidade: string; faixa: string; critico: boolean }>;
  laudoTexto?: string;
  laudoPdfUrl?: string;
  imagensUrls?: string[];
  flagCritico: boolean;
  cienciaPor?: string;
  cienciaEm?: string;
  status: StatusExame;
  requisicaoBateriaId?: string;
}
```

### 12.18 NATS

- `clinical.exame.solicitado`
- `clinical.exame.agendado`
- `clinical.exame.coletado`
- `clinical.exame.resultado_parcial`
- `clinical.exame.laudado`
- `clinical.exame.critico`
- `clinical.exame.ciencia_dada`
- `clinical.exame.cancelado`

### 12.19 Metricas

- Tempo de solicitacao a resultado por tipo (TAT).
- Percentual de resultados criticos com ciencia `<=15min`.
- Taxa de duplicidade detectada.
- Cobertura de pacotes (meta: `>=50 por cento`).

---

## 13. Hemoterapia

Modulo de altissima seguranca. Transfusao incorreta pode matar. Fluxo por etapa, checklist obrigatorio de identificacao, rastreabilidade total de bolsa (RDC 34/2014 Anvisa, Portaria GM/MS 158/2016).

### 13.1 Objetivo

Solicitar, tipar, reservar, liberar, transfundir e monitorar hemocomponentes com checklist duplo de conferencia beira-leito, sinais vitais antes/durante/depois, rastreabilidade bolsa-paciente (bidirecional), registro obrigatorio de reacao transfusional e hemovigilancia.

### 13.2 Usuarios

- Medico solicitante (hemoterapeuta ou assistente)
- Enfermagem assistencial (administra)
- Enfermagem do servico de hemoterapia
- Bioquimico / tecnico do banco de sangue
- Hemoterapeuta responsavel
- Auditoria / hemovigilancia

### 13.3 Campos mantidos

- `Paciente` com tipagem sanguinea ja conhecida
- Alergias
- Internacao / leito
- Sinais vitais pre-transfusao
- Historico transfusional (reacoes previas, aloimunizacao)

### 13.4 Novos campos

- `hemocomponente` — `ch_concentrado_hemacias | plasma_fresco | plaquetas | crioprecipitado | sangue_total_raro`
- `volumeSolicitadoMl`
- `unidadesSolicitadas`
- `indicacaoClinica` (obrigatoria, com CID)
- `urgencia` — `rotina | prioritaria | urgente | extrema`
- `hemogramaRecente` (link)
- `consentimentoInformadoId`
- `amostraColetadaEm`, `amostraColhidaPorId`
- `tipagemAboRh`, `coombsIndireto`
- `provaCruzada` (resultado por unidade)
- `bolsas[]` (codigo de barras/ISBT 128, tipo, volume, validade, fracionamento)
- `liberacaoEm`, `liberadaPorId`
- `checklistPreTransfusao` (objeto)
- `sinaisVitaisAntes`, `sinaisVitaisDurante[]`, `sinaisVitaisPos`
- `tempoInfusao`, `inicioInfusao`, `fimInfusao`
- `reacaoTransfusional` (tipo, gravidade, conduta)
- `destinoBolsa` — `transfundida | devolvida_inalterada | descartada | incidente`

### 13.5 Preenchimento inteligente

- Indicacao pre-carrega criterios RDC 34 por hemocomponente (ex: Hb `<7` estavel, `<8` cardiopata etc.).
- Consentimento informado assinado fica valido por 30 dias ou internacao corrente.
- Sinais vitais pre-transfusao: pega ultimo registro se `<=30min`, senao obriga novo.
- Tipagem conhecida bloqueada — exige nova tipagem em amostra fresca (boa pratica RDC).

### 13.6 Validacoes

- Consentimento obrigatorio (exceto emergencia extrema com justificativa e reclassificacao apos).
- Tipagem ABO/Rh realizada em amostra identificada em beira-leito com pulseira conferida por 2 enfermeiros.
- Prova cruzada compativel (bloqueio duro se incompativel).
- Checklist pre-transfusao com 100 por cento dos itens marcados por 2 profissionais distintos.
- Leitura de codigo de barras da bolsa + pulseira do paciente obrigatoria.
- Tempo maximo de infusao respeitado (CH `<=4h` desde saida do banco).
- Sinais vitais registrados em t=0, t=15min, t=30min e fim.

### 13.7 Alertas

- "Hb 7.2 em paciente estavel sem comorbidade — criterio RDC nao atendido. Justificar?"
- "Paciente teve reacao febril nao hemolitica previa — pre-medicar?"
- "Bolsa codigo X nao corresponde a prescrita. BLOQUEADO."
- "Temperatura subiu 1.5C desde inicio — possivel reacao. Interromper?"

### 13.8 Permissoes

| Acao | Medico | Hemoterapeuta | Enf Assist | Enf Hemo | Bioquimico | Auditor |
|---|---|---|---|---|---|---|
| Solicitar | sim | sim | nao | nao | nao | nao |
| Coletar amostra | nao | sim | sim | sim | nao | nao |
| Tipagem / prova cruzada | nao | sim | nao | nao | sim | nao |
| Liberar bolsa | nao | sim | nao | sim | sim (RT) | nao |
| Checklist beira-leito | nao | nao | sim (2) | sim (2) | nao | nao |
| Registrar reacao | sim | sim | sim | sim | nao | nao |
| Ver rastreabilidade | sim | sim | sim | sim | sim | sim |

### 13.9 Workflow

```
[solicitada] --amostra coletada--> [amostra_em_tipagem]
[amostra_em_tipagem] --tipada+prova--> [reservada]
[reservada] --liberada--> [liberada_para_transfusao]
[liberada_para_transfusao] --checklist duplo--> [em_infusao]
[em_infusao] --fim ok--> [transfundida]
[em_infusao] --reacao--> [interrompida_por_reacao] --conduta--> [concluida_com_reacao]
[qualquer ate liberada] --cancelada--> [cancelada] (bolsa devolvida)
[transfundida|concluida_com_reacao] --hemovigilancia notificada--> [fechada]
```

### 13.10 Integracoes

- `velya-blood-bank` (banco de sangue, estoque por ISBT 128).
- `velya-hemovigilance` (envio NOTIVISA).
- `velya-barcode` (leitura GS1/ISBT).
- `RegistroSinaisVitais` (t=0, 15, 30, fim).
- Prescricao (bloco de itens do tipo `hemocomponente`).

### 13.11 Auditoria

- Tudo imutavel. Cada acao com duplo login quando exigido.
- Retencao minima 20 anos (RDC 34).
- Exportavel em formato NOTIVISA.

### 13.12 UX

- Tela de transfusao em wizard linear — impossivel pular etapa.
- Campo de leitura de barcode com indicacao visual de match/no-match.
- Timer ao vivo para coleta de sinais vitais (15/30min).
- Botao gigante e unico "Interromper transfusao" sempre visivel, exigindo confirmacao dupla.

### 13.13 Mock

```
+-------------------------------------------------------------------------------+
| HEMOTERAPIA > Maria O. MRN 01023 > Transfusao em andamento                    |
+-------------------------------------------------------------------------------+
| Etapa  [1 Solic] [2 Amostra] [3 Tipagem] [4 Prova] [5 Liberacao] [6 INFUSAO]  |
+-------------------------------------------------------------------------------+
| CHECKLIST BEIRA-LEITO (2 profissionais)                                       |
|                                                                               |
| [x] Pulseira paciente conferida (barcode)     Enf A ___ / Enf B ___           |
| [x] Bolsa codigo ISBT conferido (barcode)     Enf A ___ / Enf B ___           |
| [x] Tipagem ABO/Rh compativel                 Enf A ___ / Enf B ___           |
| [x] Prova cruzada negativa                    Enf A ___ / Enf B ___           |
| [x] Validade bolsa dentro do prazo            Enf A ___ / Enf B ___           |
| [x] Consentimento assinado valido             Enf A ___ / Enf B ___           |
| [x] Sinais vitais pre t=0 registrados         Enf A ___ / Enf B ___           |
|                                                                               |
| INICIO 14:02   t+15min ALARME em 04:12                                        |
|                                                                               |
| SV t=0:    PA 128/80 FC 84 T 36.4 SatO2 97 FR 18                              |
| SV t=15:   [ registrar ]                                                      |
|                                                                               |
|           [ INTERROMPER TRANSFUSAO ]                                          |
+-------------------------------------------------------------------------------+
```

### 13.14 Aceite

- [ ] Impossivel transfundir sem checklist 100 por cento completo por 2 profissionais.
- [ ] Leitura de barcode obrigatoria com mismatch bloqueante.
- [ ] Sinais vitais em t=0, 15, 30, fim registrados em todos os casos.
- [ ] Reacao transfusional dispara notificacao em `<30s` para hemoterapeuta.
- [ ] Exportacao NOTIVISA gerada em 1 clique.

### 13.15 Riscos

- Troca de paciente — mitigado por barcode + 2 enfermeiros.
- Reacao hemolitica aguda — reconhecimento precoce por monitoramento continuo de SV.
- Bolsa fora de validade — banco de sangue recolhe automatico com alerta.

### 13.16 Backlog

- [ ] `packages/velya-clinical-schemas/SolicitacaoHemoterapia.ts`
- [ ] `services/velya-blood-bank` (estoque ISBT 128)
- [ ] `apps/velya-web/src/app/pacientes/[mrn]/hemoterapia/transfusao/[id]/page.tsx` (wizard)
- [ ] Componente `BarcodePairMatch`
- [ ] Job de hemovigilancia NOTIVISA

### 13.17 Modelo de dados

```ts
export type Hemocomponente =
  | "ch_concentrado_hemacias"
  | "plasma_fresco"
  | "plaquetas"
  | "crioprecipitado"
  | "sangue_total_raro";

export type StatusHemoterapia =
  | "solicitada"
  | "amostra_em_tipagem"
  | "reservada"
  | "liberada_para_transfusao"
  | "em_infusao"
  | "interrompida_por_reacao"
  | "transfundida"
  | "concluida_com_reacao"
  | "cancelada"
  | "fechada";

export interface SolicitacaoHemoterapia {
  id: string;
  hospitalId: string;
  pacienteId: string;
  internacaoId?: string;
  hemocomponente: Hemocomponente;
  unidadesSolicitadas: number;
  volumeSolicitadoMl?: number;
  indicacaoClinica: string;
  cidJustificativa: string;
  urgencia: "rotina" | "prioritaria" | "urgente" | "extrema";
  solicitanteId: string;
  hemogramaRecenteId?: string;
  consentimentoInformadoId?: string;
  amostra?: {
    coletadaEm: string;
    colhidaPorId: string;
    pulseiraConferidaPorId: string;
  };
  tipagem?: { abo: "O" | "A" | "B" | "AB"; rh: "positivo" | "negativo"; realizadaEm: string; bioquimicoId: string };
  provaCruzada?: Array<{ bolsaIsbt: string; resultado: "compativel" | "incompativel"; em: string }>;
  bolsas: Array<{ isbt: string; volumeMl: number; validade: string; liberadaEm?: string }>;
  liberadaPorId?: string;
  checklistPreTransfusao?: {
    itens: Array<{ chave: string; marcado: boolean }>;
    enfermeiro1Id: string;
    enfermeiro2Id: string;
    completoEm: string;
  };
  inicioInfusao?: string;
  fimInfusao?: string;
  sinaisVitaisT0?: string;
  sinaisVitaisT15?: string;
  sinaisVitaisT30?: string;
  sinaisVitaisFim?: string;
  reacaoTransfusional?: {
    tipo: "febril_nao_hemolitica" | "alergica_leve" | "anafilaxia" | "hemolitica_aguda" | "trali" | "taco" | "outra";
    gravidade: "leve" | "moderada" | "grave" | "ameaca_vida";
    condutaTomada: string;
    notivisaProtocolo?: string;
  };
  destinoBolsa: Array<{ isbt: string; destino: "transfundida" | "devolvida_inalterada" | "descartada" | "incidente"; obs?: string }>;
  status: StatusHemoterapia;
  criadoEm: string;
  atualizadoEm: string;
}
```

### 13.18 NATS

- `clinical.hemoterapia.solicitada`
- `clinical.hemoterapia.amostra_coletada`
- `clinical.hemoterapia.tipada`
- `clinical.hemoterapia.reservada`
- `clinical.hemoterapia.liberada`
- `clinical.hemoterapia.checklist_completo`
- `clinical.hemoterapia.infusao_iniciada`
- `clinical.hemoterapia.sv_registrados`
- `clinical.hemoterapia.reacao_detectada`
- `clinical.hemoterapia.transfundida`
- `clinical.hemoterapia.notivisa_enviada`

### 13.19 Metricas

- Taxa de transfusao com checklist 100 por cento (meta: `>=99.5 por cento`).
- Tempo mediano solicitacao-liberacao (meta: rotina `<=2h`, urgente `<=30min`, extrema `<=10min`).
- Taxa de reacao transfusional notificada a hemovigilancia (meta: `100 por cento`).
- Taxa de bolsa descartada por erro evitavel (meta: `<0.5 por cento`).

---

## 14. Sinais Vitais e Monitoracao

Captura frequente, grade rapida por leito, calculo automatico de escores (NEWS2, MEWS, qSOFA, PEWS em pediatria), escalonamento por deterioracao clinica e visualizacao de tendencias.

### 14.1 Objetivo

Registrar PA, FC, FR, SatO2, T, dor, nivel de consciencia (AVPU), glicemia capilar, diurese, balanco hidrico, com entrada rapida por leito e calculo automatico de escores de alerta precoce, gatilhando time de resposta rapida (TRR) quando indicado.

### 14.2 Usuarios

- Enfermagem (principal)
- Tecnico de enfermagem
- Medico assistente (consome)
- TRR (consome alertas)
- Fisioterapia
- Auditoria

### 14.3 Campos mantidos

- `Paciente`, `Internacao`, `UnidadeAssistencial`, leito
- `RegistroSinaisVitais` ja existente

### 14.4 Novos campos

- `pas`, `pad`, `fc`, `fr`, `satO2`, `fio2`, `temperatura`, `hgt`, `dorEva`, `avpu`
- `diurese` (ml), `balancoHidricoParcial`
- `pesoDiario`
- `consciencia` (Glasgow quando aplicavel)
- `fonteMedicao` — `manual | monitor_multiparametrico | oximetro | wearable`
- `newsScore`, `newsCategoria` — `baixo | medio | alto | critico`
- `mewsScore`, `qsofaScore`, `pewsScore`
- `delta15min`, `delta1h` (variacao automatica)
- `escalonamento` — `nenhum | medico_assistente | TRR | UTI`
- `turnoEnfermagem`

### 14.5 Preenchimento inteligente

- Monitor multiparametrico HL7/FHIR feed continuo, com amostragem automatica a cada 15min ou no evento.
- Calculo NEWS2 instantaneo com explicacao dos pontos.
- Se PEWS/NEWS cruza limiar, sistema sugere conduta e aciona TRR.
- Pre-popula turno de enfermagem do registrador.
- Se `fio2 >21 por cento`, ajusta pontuacao NEWS para oxigenio suplementar.

### 14.6 Validacoes

- PA plausivel (PAS 60-260, PAD 30-160).
- SatO2 60-100.
- T 32-43.
- Glasgow 3-15.
- Se NEWS `>=7`, forcar ciencia medica em 15min.

### 14.7 Alertas

- "NEWS2 = 7 (critico) — acionar TRR."
- "Queda SatO2 de 96 para 88 em 30min."
- "PAS 70 — possivel choque. Medir novamente e notificar."
- "Diurese `<0.5ml/kg/h` por 2h — oliguria."

### 14.8 Permissoes

| Acao | Enf | Tec Enf | Medico | TRR | Auditor |
|---|---|---|---|---|---|
| Registrar SV | sim | sim | sim | sim | nao |
| Ver grade da unidade | sim | sim | sim | sim | sim |
| Dar ciencia a alerta | sim | nao | sim | sim | nao |
| Acionar TRR | sim | sim | sim | sim | nao |

### 14.9 Workflow (alerta)

```
[registrado] --score calculado--> [normal | alerta_baixo | alerta_medio | alerta_alto | critico]
[alerta_alto] --sem ciencia 10min--> [escalonado_medico]
[critico] --imediato--> [TRR_acionado] --ciencia e conduta--> [fechado]
[qualquer] --SV normaliza apos conduta--> [resolvido]
```

### 14.10 Integracoes

- Monitores multiparametricos via HL7 v2 ORU^R01 / FHIR Observation.
- Wearables (opcional).
- Prescricao (condutas vinculadas).
- TRR (Task auto-criada).
- NATS broadcast em tempo real.

### 14.11 Auditoria

- Todo registro imutavel.
- Ciencia a alerta registrada com usuario, timestamp, conduta.
- Retencao 20 anos.

### 14.12 UX

- Grade rapida por unidade: leitos em linhas, SV em colunas, linha NEWS colorida monocromaticamente (contorno grosso = alto).
- Clique em leito abre painel inline com tendencia das ultimas 24h (sparklines).
- Entrada de novo SV em `<=8s` via teclado: Tab entre campos na ordem PAS PAD FC FR T SatO2.
- Modo bedside com botoes grandes e tipografia aumentada.
- Exportacao de grafico para discussao em passagem de plantao.

### 14.13 Mock — Grade da unidade

```
+-------------------------------------------------------------------------------+
| UTI Adulto Leste  Turno Manha  07:00                                          |
+-----+----------+-----+-----+----+----+------+-----+------+-----+-------------+
| Lt  | Paciente | PAS | PAD | FC | FR |  T   | SpO2| FiO2 | HGT | NEWS2       |
+-----+----------+-----+-----+----+----+------+-----+------+-----+-------------+
| 01  | J. Lima  | 128 | 80  | 78 | 16 | 36.4 |  97 |  21  | 102 |  1          |
| 02  | A. Reis  |  92 | 50  |118 | 24 | 38.2 |  92 |  35  | 134 |  7  [critic]|
| 03  | M. Sa    | 140 | 85  | 85 | 18 | 36.8 |  96 |  21  |  98 |  2          |
| 04  | P. Alves | 110 | 70  | 60 | 14 | 36.2 |  98 |  21  |  94 |  0          |
+-----+----------+-----+-----+----+----+------+-----+------+-----+-------------+
| [+] registrar para leito 02    [!] ALERTA leito 02 acionar TRR                |
+-------------------------------------------------------------------------------+
```

### 14.14 Aceite

- [ ] Grade atualiza em tempo real.
- [ ] NEWS2 calculado conforme guideline RCP Londres 2017.
- [ ] Alerta alto sem ciencia em 10min escala para medico assistente.
- [ ] Critico aciona TRR automaticamente.
- [ ] Tendencia em sparkline visivel sem sair da grade.

### 14.15 Riscos

- Falso positivo de monitor (artefato) — exigir confirmacao manual antes de acionar TRR em criticos isolados.
- Apagao de feed — fallback manual e alerta de "sem dados por X min".

### 14.16 Backlog

- [ ] `packages/velya-clinical-schemas/RegistroSinaisVitais.ts` (estender).
- [ ] `services/velya-rtms` (feed monitores).
- [ ] `services/velya-early-warning` (NEWS, MEWS, qSOFA, PEWS).
- [ ] `apps/velya-web/src/app/unidades/[id]/grade-sv/page.tsx`.
- [ ] Componente `SparklineMonochrome`.

### 14.17 Modelo de dados

```ts
export type CategoriaNews = "baixo" | "medio" | "alto" | "critico";

export interface RegistroSinaisVitaisEstendido {
  id: string;
  hospitalId: string;
  pacienteId: string;
  internacaoId: string;
  leitoId: string;
  registradoPorId: string;
  fonteMedicao: "manual" | "monitor_multiparametrico" | "oximetro" | "wearable";
  registradoEm: string;
  pas?: number;
  pad?: number;
  fc?: number;
  fr?: number;
  satO2?: number;
  fio2?: number;
  temperatura?: number;
  hgt?: number;
  dorEva?: number;
  avpu?: "a" | "v" | "p" | "u";
  glasgow?: number;
  diureseMl?: number;
  balancoHidricoParcialMl?: number;
  pesoDiarioKg?: number;
  newsScore?: number;
  newsCategoria?: CategoriaNews;
  mewsScore?: number;
  qsofaScore?: number;
  pewsScore?: number;
  deltaFlags: Array<{ parametro: string; janelaMin: number; delta: number; crit: boolean }>;
  escalonamento?: "nenhum" | "medico_assistente" | "trr" | "uti";
  turnoEnfermagem?: "manha" | "tarde" | "noite";
  cienciaPor?: string;
  cienciaEm?: string;
}
```

### 14.18 NATS

- `clinical.sv.registrado`
- `clinical.sv.news_critico`
- `clinical.sv.trr_acionado`
- `clinical.sv.ciencia_dada`
- `clinical.sv.feed_monitor_interrompido`

### 14.19 Metricas

- Tempo medio para registrar SV manual (meta: `<=8s`).
- Percentual de alertas NEWS criticos com conduta em `<=10min` (meta: `>=95 por cento`).
- Taxa de parada cardiaca nao antecipada por escalonamento (indicador RRS).
- Cobertura de feed automatico de monitores (meta: `>=70 por cento` em UTI).

---

## 15. Recursos Transversais

Esta secao documenta a fundacao tecnica e de UX que sustenta todos os modulos anteriores. Sao recursos que atravessam o produto e precisam ser consistentes.

### 15.A Timeline Unica do Paciente

#### 15.A.1 Objetivo

Fornecer a visao cronologica unica e completa da jornada do paciente, agregando evolucoes, prescricoes (resumo), pareceres, exames, procedimentos, transfusoes, sinais vitais (quando alerta), transferencias, altas e readmissoes. E o coracao do Patient Cockpit `/pacientes/[mrn]`.

#### 15.A.2 Usuarios

Todos os perfis clinicos + auditores.

#### 15.A.3 Campos

- Cada evento contem: `tipo`, `timestamp`, `autor`, `unidade`, `resumo`, `refId`, `severidade`, `tags`, `criticoNaoVisto`.

#### 15.A.4 Preenchimento inteligente

- Agrupamento automatico por turno com separadores visuais.
- Filtros rapidos por tipo (evolucao, exame, prescricao, parecer, SV, hemoterapia, cirurgico).
- Busca textual dentro da timeline.
- "Saltar para ultimo registro critico".

#### 15.A.5 Validacoes

- Todos os registros chegam por eventos NATS — a timeline nunca cria nada; so renderiza.

#### 15.A.6 Alertas

- Marcador `[critico]` persistente ate ciencia.
- Indicador de "novo desde sua ultima visita" (monocromatico, contorno pontilhado).

#### 15.A.7 Permissoes

Mesmo controle do cockpit; filtra eventos conforme perfil (ex: oncologia-sensivel).

#### 15.A.8 Workflow

```
[evento publicado em NATS] --consumer timeline--> [armazenado]
[timeline] --render--> [usuario vizualiza] --> [marca visto por usuario x evento]
```

#### 15.A.9 Integracoes

- Todos os subjects `clinical.*`.
- `velya-audit` (quem viu o que).

#### 15.A.10 UX

- Linha vertical unica, eventos em cards monocromaticos, tipografia que segue tipografia do cockpit.
- Bandeiras laterais para severidade (linha grossa esquerda = critico).
- Pinagem de eventos importantes ao topo por usuario.
- Modo "condensar 24h" que agrupa 30+ eventos em um bloco expandivel.

#### 15.A.11 Mock

```
Timeline Maria O. MRN 01023                                [ filtrar v ]
+---------------------------------------------------------------------+
| 2026-04-12 quinta-feira                                             |
|   14:22  evolucao clinica     Dr. Silva      "dor toracica..."      |
|   14:05  ECG laudado          Dr. Moura      "supra V2-V4" [critic] |
|   13:50  potassio critico     Bioq. Lima     K 6.8 mEq/L  [critic]  |
|   12:10  SV registrado        Enf. Ana       NEWS 7       [critic]  |
|   11:00  prescricao assinada  Dr. Silva      7 itens                |
|   10:30  admissao                                                   |
| 2026-04-11 quarta-feira                                             |
|   [+] 14 eventos do turno tarde (clicar para expandir)              |
+---------------------------------------------------------------------+
```

#### 15.A.12 Modelo de dados

```ts
export type TipoEventoTimeline =
  | "admissao"
  | "alta"
  | "transferencia"
  | "evolucao"
  | "parecer_solicitado"
  | "parecer_respondido"
  | "prescricao_assinada"
  | "prescricao_substituida"
  | "item_administrado"
  | "exame_solicitado"
  | "exame_laudado"
  | "exame_critico"
  | "hemoterapia_transfundida"
  | "hemoterapia_reacao"
  | "sv_critico"
  | "laudo_internacao_assinado"
  | "procedimento_realizado"
  | "cirurgia_realizada"
  | "nota_enfermagem"
  | "balanco_hidrico_fechado"
  | "intercorrencia";

export interface EventoTimeline {
  id: string;
  pacienteId: string;
  tipo: TipoEventoTimeline;
  timestamp: string;
  autorId: string;
  unidadeId?: string;
  resumo: string;
  refModulo: "prescricao" | "parecer" | "exame" | "evolucao" | "hemoterapia" | "sv" | "laudo" | "transferencia" | "outro";
  refId: string;
  severidade: "info" | "alerta" | "critico";
  tags: string[];
  criticoNaoVistoPor: string[]; // lista de ids de profissionais
}
```

#### 15.A.13 NATS

- Consumer unico `timeline-ingest` assina `clinical.>` e materializa.

#### 15.A.14 Metricas

- Tempo para achar ultimo evento critico (meta: `<=5s`).
- Percentual de eventos criticos vistos em `<=10min` pelo responsavel.

---

### 15.B Painel Contextual (Side Panel)

#### 15.B.1 Objetivo

Manter o contexto do paciente sempre acessivel sem trocar de tela quando o usuario esta em filas, dashboards, pareceres, exames etc.

#### 15.B.2 Usuarios

Todos os clinicos.

#### 15.B.3 Dados exibidos

- Identificacao, MRN, idade, sexo, alergias, comorbidades, leito, CareTeam, ultimos SV, medicacoes ativas resumidas, ultimos 3 eventos, atalho para cockpit completo.

#### 15.B.4 UX

- Drawer lateral `w-[420px]` sticky, nao-modal, fechavel com `Esc`.
- Abre em qualquer lista clicando no nome do paciente com `Alt+Click` (ou botao "peek").
- Mantem aberto durante navegacao interna da lista ate usuario fechar.
- Zero cor, tipografia do cockpit, bordas finas.

#### 15.B.5 Modelo

```ts
export interface PatientPeekPayload {
  paciente: { id: string; mrn: string; nome: string; idade: number; sexo: string };
  alergias: Array<{ substancia: string; severidade: string }>;
  comorbidades: string[];
  internacaoAtual?: { leito: string; unidade: string; diaInternacao: number };
  ultimosSV?: RegistroSinaisVitaisEstendido;
  medicacoesAtivasResumo: Array<{ principio: string; via: string; frequencia: string }>;
  ultimosEventos: EventoTimeline[];
}
```

#### 15.B.6 NATS / API

- `GET /api/pacientes/:mrn/peek` com cache edge 15s.

#### 15.B.7 Metricas

- Uso medio por sessao (meta: `>=5 peeks/sessao clinica`).
- Reducao de clicks entre lista e cockpit.

---

### 15.C Busca Global

#### 15.C.1 Objetivo

Busca unica para encontrar pacientes, medicos, unidades, leitos, prescricoes, exames, pareceres, order sets, favoritos — com atalhos por comando.

#### 15.C.2 UX

- Trigger `Ctrl+K` / `Cmd+K` em qualquer tela.
- Prefixos: `p:` paciente, `m:` medico, `u:` unidade, `l:` leito, `rx:` prescricao, `ex:` exame, `pa:` parecer, `os:` order set, `fav:` favorito, `cmd:` comando.
- Ranking por recencia de uso + relevancia textual.
- Teclado-first, sem mouse.

#### 15.C.3 Modelo

```ts
export interface SearchResult {
  tipo: "paciente" | "medico" | "unidade" | "leito" | "prescricao" | "exame" | "parecer" | "order_set" | "favorito" | "comando";
  id: string;
  titulo: string;
  subtitulo?: string;
  score: number;
  ultimaInteracao?: string;
}
```

#### 15.C.4 Integracoes

- `velya-search` (Meilisearch ou Typesense atras de API interna).
- Observa eventos NATS para reindexar em tempo real.

#### 15.C.5 Seguranca

- Filtra resultados conforme permissao.
- Log de buscas para auditoria em pacientes (break-the-glass se acessar fora do CareTeam).

#### 15.C.6 Metricas

- Tempo ate encontrar (meta: `<=3s`).
- Taxa de uso de atalhos vs mouse.

---

### 15.D Centro de Notificacoes

#### 15.D.1 Objetivo

Inbox unificado de tudo que exige atencao: SLA, alertas criticos, pareceres, exames criticos, prescricoes devolvidas, transferencias, hemovigilancia.

#### 15.D.2 UX

- Icone fixo no header (sem badge colorida — indicador textual `3`).
- Drawer vertical a direita com abas: `Acao necessaria`, `Para informacao`, `Arquivadas`.
- Cada item com CTA primaria (ex: "Responder parecer", "Dar ciencia").
- Snooze granular (15min, 1h, proximo turno) — registrado em audit.

#### 15.D.3 Modelo

```ts
export type TipoNotificacao =
  | "parecer_recebido"
  | "parecer_overdue"
  | "exame_critico"
  | "prescricao_devolvida"
  | "alerta_sv_critico"
  | "hemoterapia_reacao"
  | "sla_expirando"
  | "transferencia_pendente"
  | "tarefa_atribuida"
  | "mencao_evolucao";

export interface Notificacao {
  id: string;
  destinatarioId: string;
  tipo: TipoNotificacao;
  titulo: string;
  resumo: string;
  pacienteId?: string;
  refModulo?: string;
  refId?: string;
  prioridade: "info" | "alerta" | "critico";
  acaoCta?: { label: string; deeplink: string };
  criadoEm: string;
  lidoEm?: string;
  snoozedAte?: string;
  arquivadoEm?: string;
}
```

#### 15.D.4 Canais

- In-app (default).
- Push mobile (hub mobile).
- SMS (emergencia e urgente nao-vistos).
- Pager/beep integration opcional.

#### 15.D.5 NATS

- `notif.criada`, `notif.lida`, `notif.snoozed`, `notif.arquivada`, `notif.escalonada`.

#### 15.D.6 Metricas

- Latencia criacao-render (meta: `<=2s` in-app).
- Taxa de critico nao visto em 10min (meta: `<5 por cento`).
- Taxa de snooze abusivo (indicador de ma configuracao de regra).

---

### 15.E Auditoria Completa

#### 15.E.1 Objetivo

Registrar 100 por cento das acoes com dados clinicos com trilha imutavel, hash encadeado, retencao e exportacao para auditoria externa, atendendo CFM 1.821/2007, LGPD Art. 37 (encarregado) e Art. 48 (incidente), ISO 27001 A.12.4.

#### 15.E.2 Dados capturados

- Quem (usuario, perfil, matricula), Quando (timestamp server + cliente), Onde (IP, user agent, dispositivo, geo aproximada), O que (modulo, recurso, operacao CRUD/READ), Como (API, UI path), Resultado (sucesso/erro + payload diff), Justificativa (break-the-glass, override de alerta).

#### 15.E.3 Armazenamento

- Tabela append-only `audit_log` particionada mensal.
- Hash encadeado (cada registro referencia hash do anterior).
- Replica write-once em storage WORM.
- Backup imutavel com retencao 20 anos.

#### 15.E.4 Exportacao

- CFM / CRM / CVS / ANS / CNS — export CSV e JSON com filtro por paciente, periodo, profissional, modulo.
- LGPD — relatorio de acessos para titular em `<=15 dias`.

#### 15.E.5 Modelo

```ts
export interface AuditLogEntry {
  id: string;
  hospitalId: string;
  usuarioId?: string;
  perfil?: string;
  matricula?: string;
  ts: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  modulo: string;
  recurso: string;
  recursoId?: string;
  operacao: "create" | "read" | "update" | "delete" | "sign" | "override" | "export" | "login" | "logout" | "break_glass";
  resultado: "sucesso" | "erro" | "negado";
  diffJson?: string;
  justificativa?: string;
  hashPrev?: string;
  hashSelf: string;
}
```

#### 15.E.6 NATS / API

- `audit.entrada.criada` (fanout).
- `GET /api/audit/pacientes/:id?de=&ate=` (restrito).

#### 15.E.7 Metricas

- Cobertura de eventos auditados (meta: 100 por cento das operacoes clinicas sensiveis).
- Tempo para responder solicitacao LGPD (meta: `<=5 dias`).

---

### 15.F Permissoes (RBAC + ABAC)

#### 15.F.1 Objetivo

Modelo de autorizacao granular por perfil + atributos (CareTeam, especialidade, unidade, turno, contexto de emergencia), com break-the-glass auditado.

#### 15.F.2 Perfis base

- `admin_sistema`
- `gestor_hospital`
- `medico_assistente`
- `medico_plantonista`
- `medico_auditor`
- `residente`
- `farmaceutico_clinico`
- `hemoterapeuta`
- `enfermeiro`
- `tecnico_enfermagem`
- `tecnico_laboratorio`
- `biomedico`
- `nutricionista`
- `fisioterapeuta`
- `psicologo`
- `secretaria_internacao`
- `recepcionista`
- `ti_suporte`

#### 15.F.3 Atributos

- `unidadeId`, `especialidadeId`, `turno`, `dentroDoCareTeam`, `plantaoVigente`, `emergenciaDeclarada`, `sensibilidade_registro` (oncologia, psiquiatria, HIV).

#### 15.F.4 Regras

- Leitura de dados clinicos so de pacientes do CareTeam, exceto em plantao + unidade correspondente.
- Acesso fora do CareTeam exige `break_glass` com justificativa e notifica encarregado LGPD.
- Registros sensiveis exigem perfil + flag explicita.
- Assinatura digital amarrada ao certificado do profissional.

#### 15.F.5 Modelo

```ts
export interface Permissao {
  perfil: string;
  recurso: string; // ex: prescricao.item
  operacoes: Array<"create" | "read" | "update" | "delete" | "sign" | "override" | "export">;
  condicoes?: Array<"mesmo_care_team" | "mesmo_turno" | "mesma_unidade" | "plantao" | "emergencia">;
}
export interface BreakTheGlass {
  id: string;
  usuarioId: string;
  pacienteId: string;
  justificativa: string;
  ts: string;
  revisadoPor?: string;
  revisadoEm?: string;
  aceito?: boolean;
}
```

#### 15.F.6 NATS

- `security.break_glass.acionado`
- `security.permissao.negada`

#### 15.F.7 Metricas

- Numero de break-the-glass por mes e taxa de revisao em `<=72h`.
- Taxa de negacao indevida (falsos positivos reportados).

---

### 15.G Integracoes

#### 15.G.1 Objetivo

Centralizar e padronizar conexoes com sistemas externos e servicos internos.

#### 15.G.2 Externos

- SUS: CNS, CADSUS, SISAIH01, SIGTAP, SISRCA.
- TISS 4.x (ANS) para convenios.
- CFM (validacao CRM).
- COREN (validacao COREN).
- ANVISA (catalogo de medicamentos, farmacovigilancia, NOTIVISA).
- DATASUS / CNES.
- ICP-Brasil (certificado digital).
- First Databank / Micromedex (interacoes).
- Bases CID-10/11.
- HL7 v2 e FHIR R4 para interoperabilidade.

#### 15.G.3 Internos

- `velya-clinical-nlp` (sumarizacao, sugestao CID, extracao de entidades).
- `velya-rtms` (monitores).
- `velya-notifications` (canais).
- `velya-search` (Meilisearch/Typesense).
- `velya-audit` (append-only).
- `velya-digital-sign`.
- `velya-print-service`.
- `velya-sla-engine`.
- `velya-early-warning`.
- `velya-blood-bank`.
- `velya-drug-catalog`.
- `velya-interaction-engine`.
- `velya-renal-dose-engine`.
- `velya-oncology-protocols`.

#### 15.G.4 Padroes

- FHIR R4 como padrao preferencial interno e de exportacao.
- HL7 v2 para integracoes com equipamentos e LIS legados.
- DICOM para imagens.
- TISS 4.x para convenio.
- NATS JetStream para mensageria assincrona entre servicos Velya.
- OpenAPI 3.1 para REST.
- JSON Schema / Zod para contratos internos de payload.

#### 15.G.5 Resiliencia

- Circuit breaker em todos os adapters externos.
- Retry com backoff exponencial e dead-letter-queue NATS.
- Modo offline: UI mantem rascunhos em IndexedDB e reenvia quando voltar.

#### 15.G.6 Metricas

- SLA de cada adapter (p95 de latencia, taxa de erro).
- Numero de eventos em DLQ (deve ser proximo de zero).
- Cobertura FHIR R4 de recursos criticos (Patient, Encounter, Observation, MedicationRequest, MedicationAdministration, DiagnosticReport, ServiceRequest, AllergyIntolerance, Condition, Procedure, CarePlan, CareTeam).

---

### 15.H Observabilidade e SRE do dominio clinico

(Complemento necessario aos transversais.)

- Traces distribuidos com OpenTelemetry marcando `pacienteId` (hashed), `moduloClinico`, `operacao`.
- Metricas Prometheus por modulo (prescricao_assinada_total, hemoterapia_reacao_total etc.).
- Alertas Grafana para saturacao de filas NATS, latencia p95 > 1s em APIs clinicas, DLQ `>0`.
- Runbooks em `/workspace/hub/autopilot` para cada incidente tipico (feed monitor off, LIS fora, assinatura ICP down, banco de sangue offline).

---

## Encerramento da PARTE 2

Esta parte cobre os modulos clinicos prioritarios (9 a 14) e a fundacao transversal (15) que garante que cada modulo compartilhe timeline, painel contextual, busca, notificacoes, auditoria, permissoes e integracoes. Todos os modulos seguem as mesmas invariantes: tema monocromatico, zero retrabalho, reaproveitamento de dados do core model, eventos NATS consistentes, auditoria imutavel e aderencia CFM/COFEN/RDC/LGPD.

> Proxima entrega prevista: PARTE 3 cobrindo implementacoes 16 a 22 (Alta hospitalar, Sumarios, Cirurgia, UTI, Obstetricia, Pediatria, Oncologia especializadas) e Recursos de qualidade/indicadores (NAS, SAE, escores, gestao de leitos, seguranca do paciente — metas internacionais).
# Velya — Especificacao UX Hospitalar Avancada — PARTE 3

> Documento tecnico-clinico. Parte 3 de 4.
> Idioma: Portugues brasileiro tecnico.
> Aderente a CFM 2.227/2018, CFM 1.821/2007, COFEN 358/2009, RDC 36/2013, RDC 430/2020, LGPD 13.709/2018.
> Stack de referencia: Next.js 15 (App Router) + Tailwind v4 monochromatic + Core types Velya (Hospital, Location, UnidadeAssistencial, Especialidade, HealthcareService, ProfissionalSaude, PractitionerRole, Turno, Paciente, Internacao, CareTeam, EvolucaoClinica, Prescricao, SolicitacaoExame, RegistroSinaisVitais, TransferenciaInterna).
> Gates obrigatorios: audit hash chain, validadores design-tokens, validador de contraste WCAG AA, validador de overlap (scripts/ui-audit/detect-overlaps.ts), workflow ui-overlap-gate.

---

## Sumario

- **C. Especificacao de UX por Tela** (15 implementacoes com wireframes ASCII)
- **D. Backlog Tecnico** (15 Epicos, Features, User Stories, Subtarefas, Criterios de Aceite)
- **E. Modelo de Dados** (novas entidades, modificacoes em entidades existentes, eventos NATS)
- **F. Regras de Implantacao** (feature flags, rollout, treinamento, rollback, go-live)

---

# SECAO C — ESPECIFICACAO DE UX POR TELA

## Convencoes globais

### Cabecalho persistente do paciente (patient banner)

Exibido em todas as telas clinicas vinculadas a um `Paciente.id`. Fixo no topo (sticky, z-index 50), altura 64px em desktop e 96px empilhado em mobile. Jamais colapsa durante scroll — esta decisao segue padrao Epic/Cerner e atende CFM 2.227 (identificacao inequivoca).

```
+------------------------------------------------------------------------------+
| [foto/iniciais] Nome Completo - MRN 000123 - Sexo F - 68a (15/03/1957)       |
|  Leito UCI-A 12 - Alergias: DIPIRONA, PENICILINA - Isolamento CONTATO        |
|  [codigo azul ativo]  [jejum 14h]  [NPO]  [risco queda alto]  [LGPD consent] |
+------------------------------------------------------------------------------+
```

Regras de renderizacao:
- Alergias sempre em caixa alta e com icone de alerta.
- Isolamento pinta uma faixa colorida de 4px no topo (contato=amarelo #C49A00, gotas=azul #0050A0, aerossol=vermelho #B00020 sobre fundo branco).
- Codigo azul ativo ocupa a largura inteira do banner por 10s e depois recolhe para chip.
- Clique em qualquer chip abre popover com origem e carimbo temporal.

### Atalhos de teclado globais

- `?` — overlay de atalhos
- `E` — nova evolucao clinica
- `P` — nova prescricao
- `X` — solicitar exame
- `D` — diagnostico (CID/CIAP)
- `A` — atestado
- `R` — receita
- `S` — sinais vitais
- `G` — busca global (command palette)
- `B` — timeline do paciente
- `C` — comunicar (mensageria segura)
- `Esc` — fechar modal/preview
- `Cmd/Ctrl+Enter` — confirmar formulario atual
- `Cmd/Ctrl+Shift+S` — salvar como rascunho
- `Cmd/Ctrl+K` — busca dentro da tela atual
- `Cmd/Ctrl+/` — focar ultimo erro de validacao

Atalhos nunca disparam com foco em campo de texto livre, exceto `Cmd/Ctrl+Enter` e `Esc`.

### Breakpoints e comportamento

- **320px (mobile S)**: single-column, sidebar colapsa em off-canvas, banner empilha em 96px, tabelas viram cards.
- **768px (tablet)**: 2 colunas, sidebar drawer-push, formularios 1 coluna.
- **1024px (desktop padrao)**: 3 regioes (sidebar in-flow sticky + main + painel direito colapsavel).
- **1440px+ (desktop largo)**: 4 regioes — sidebar + main + historico lateral + painel de decisao clinica.

### Microinteracoes base

- Hover em linha clicavel: fundo `gray-50`, 120ms ease-out.
- Focus ring: 2px `black`, offset 2px, sempre visivel (WCAG 2.4.7).
- Skeleton loaders: pulse 1.4s, nunca spinner em leitura de dado clinico.
- Toast de sucesso: slide-in top-right, auto-dismiss 4s, aria-live polite.
- Toast de erro: stick, dismiss manual, aria-live assertive.
- Animacao de hash-chain append: tick discreto no footer por 800ms.

### Fluxo de acao destrutiva

Todas as telas clinicas usam o mesmo pattern:
1. Botao primario vermelho (`#B00020`) fora do flow natural.
2. Modal de confirmacao com resumo do que sera desfeito.
3. Campo de texto livre obrigatorio: "Motivo clinico (minimo 10 caracteres)".
4. Segunda confirmacao com checkbox "Entendo que esta acao sera auditada".
5. Assinatura digital (certificado ICP-Brasil A3 ou biometria local) quando CFM exigir.
6. Janela de 5s com botao "desfazer" (undo) para acoes reversiveis.

---

## C.1 — Tela de Evolucao Clinica (SOAP estruturado + smart phrases)

**Rota**: `/pacientes/[mrn]/evolucoes/nova`
**Tipo**: formulario longo com painel lateral.
**Perfis**: Medico, Residente (com co-assinatura), Enfermeiro (evolucao de enfermagem SAE).

### Layout logico

Tres regioes em desktop 1440px:
- Sidebar esquerda (240px): navegacao do cockpit do paciente.
- Coluna central (fluida, max 960px): editor SOAP.
- Painel direito (400px, colapsavel): historico de evolucoes anteriores.

### Agrupamento por contexto clinico

Ordem fixa, espelhando CFM 1.638/2002:
1. **Subjetivo** — queixa principal, HMA, interrogatorio sintomatico.
2. **Objetivo** — exame fisico, sinais vitais importados, exames recentes importados.
3. **Avaliacao** — hipoteses diagnosticas (CID-10 multiple), evolucao de problemas ativos.
4. **Plano** — conduta por problema, prescricoes vinculadas, pedidos de exame vinculados.

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER (sticky 64px)                                                 |
+==============================================================================+
| SIDEBAR       | EVOLUCAO CLINICA - Rascunho autosalvo 14:23  [Preview] [Salv]|
| Cockpit       +--------------------------------------------------------------+
| Evolucoes*    | Turno: Diurno Enf. A   Tempo de internacao: D4              |
| Prescricoes   |                                                              |
| Exames        | [S] SUBJETIVO                                     [importar]|
| Sinais        |  Queixa principal:                                           |
| Timeline      |  [ dor toracica em aperto, iniciada ha 2h ]                  |
|               |  HMA: [.dor_peito_smart] expande para template              |
|               |                                                              |
|               | [O] OBJETIVO                                      [importar]|
|               |  Sinais vitais (ultima aferic. 14:10):                       |
|               |  PA 138/92  FC 102  FR 22  SpO2 94% AA  Tax 36.8             |
|               |  [x] importar tudo   [ ] importar so PA                      |
|               |  Exame fisico: [textarea 6 linhas]                           |
|               |                                                              |
|               | [A] AVALIACAO                                                |
|               |  CID-10: [I21.9 IAM sem especificacao] [+]                   |
|               |         [I10 Hipertensao essencial] [x]                      |
|               |  Gravidade: [ ] leve [x] moderada [ ] grave                  |
|               |                                                              |
|               | [P] PLANO                                                    |
|               |  Conduta: [.conduta_iam_smart]                               |
|               |  Pedidos vinculados: [+ ECG] [+ Troponina]                   |
|               |  Prescricoes vinculadas: [+ AAS 100mg] [+ Enoxaparina]       |
|               |                                                              |
|               | [Salvar rascunho Ctrl+Shift+S] [Assinar e publicar Ctrl+Ent] |
+---------------+--------------------------------------------------------------+
                                                        | HISTORICO            |
                                                        | [colapsar]           |
                                                        |                      |
                                                        | 11/04 18:20 Dr.X    |
                                                        | Paciente em ...      |
                                                        | [expandir]           |
                                                        |                      |
                                                        | 11/04 08:00 Dr.Y    |
                                                        | Admissao UCI...      |
                                                        | [expandir]           |
```

### Smart phrases (dropdown contextual)

- Disparador: `.` (ponto) seguido de 1+ caractere.
- Fonte: `SmartPhrase` escopado por medico + especialidade + hospital.
- Tokens dinamicos: `{paciente.nome}`, `{sinal.pa_ultima}`, `{exame.troponina_ultima}`, `{idade}`, `{peso}`, `{alergia.lista}`.
- Preview inline antes de aceitar (Tab confirma, Esc rejeita).

### Dropdowns dependentes

- Especialidade selecionada no PractitionerRole filtra lista de CIDs favoritos.
- Setor (Location) filtra OrderSets disponiveis em "Plano".

### Preview antes de salvar

Modal ocupando 80% do viewport com renderizacao final HTML + metadata (assinante, data/hora NTP, hash previo). Botoes: "Voltar para editar", "Assinar e publicar".

### Historico lateral

- Colapsavel (default aberto em 1440px, fechado em 1024px).
- Cards por evolucao com timestamp relativo ("ha 4h") e absoluto no hover.
- Clique no card: diff em split-view com a evolucao atual em rascunho.
- Botao "importar trechos" abre picker granular (por secao S/O/A/P).

### Microinteracoes

- Autosave a cada 8s com indicador "Rascunho salvo 14:23" em cinza.
- Smart phrase expandindo: fade-in 180ms e destaque amarelo palha que decai em 1.2s.
- Campos importados ficam marcados com borda left 3px `gray-400` e tooltip "importado de evolucao 11/04 18:20".

### Acao destrutiva

Descartar rascunho exige confirmacao dupla com motivo. Evolucao ja assinada nunca pode ser apagada — apenas aditivada via "Retificacao clinica" (nova evolucao vinculada, CFM 1.638 art.5).

### Mobile

- 320px: SOAP vira accordion, um secao expandida por vez, painel lateral vira drawer.
- 768px: 2 colunas (S/O topo, A/P abaixo), historico como bottom-sheet.

---

## C.2 — Tela de Prescricao Eletronica (PME)

**Rota**: `/pacientes/[mrn]/prescricoes/nova`
**Perfis**: Medico (prescritor), Farmaceutico (validacao), Enfermagem (checagem).

### Layout logico

- Header de contexto de prescricao (origem: internacao, ambulatorial, alta).
- Lista de itens prescritos (drag-to-reorder).
- Painel lateral direito com alertas CDSS (interacoes, alergias, duplicidades, dose/peso).

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| PRESCRICAO - Tipo: [Internacao v]  Validade: 24h  Periodo: 12/04 00:00-23:59 |
+------------------------------------------------------------------------------+
| [+ Item] [+ OrderSet: Sepse v] [+ Reconciliar da anterior] [Importar]        |
+------------------------------------------------------------------------------+
| #  Medicamento            Dose    Via    Frequencia   Duracao    Obs         |
| 1  Dipirona 500mg         1g      IV     6/6h         72h        SN dor >4   |
|     [alerta]     [editar] [duplicar] [remover]                               |
| 2  Enoxaparina            40mg    SC     1x dia       continuo              |
| 3  Omeprazol              40mg    EV     1x dia       continuo              |
| 4  Soro Fisiologico 0.9%  500mL   IV     8/8h         continuo              |
|                                                                              |
| [+ adicionar]                                                                |
+------------------------------------------------------------------------------+
| PAINEL CDSS (direita, sticky)                                                |
| [3 alertas]                                                                  |
|  1. ALERGIA: Dipirona -> paciente tem alergia DIPIRONA em prontuario        |
|     [substituir por...] [ignorar com justificativa]                          |
|  2. Interacao moderada: Enoxaparina + AAS -> risco sangramento              |
|     [ajustar] [manter com justificativa]                                     |
|  3. Dose alta: Omeprazol 40mg em idoso + ClCr 42 -> considerar reducao      |
|     [ajustar] [manter com justificativa]                                     |
+------------------------------------------------------------------------------+
| [Salvar rascunho] [Preview impressao] [Assinar e enviar a farmacia]          |
+------------------------------------------------------------------------------+
```

### Agrupamento

- Medicamentos agrupados por classe ATC na impressao, por ordem de insercao na UI.
- Diluicoes, solucoes e nutricao parenteral em secoes distintas.
- Medicamentos "se necessario" (SN) em secao final.

### Ordem ideal de leitura

1. Validade e periodo (horizonte temporal).
2. Reconciliacao com prescricao anterior.
3. Lista itens em ordem de criticidade.
4. Alertas.
5. Assinatura.

### Chips contextuais

- `[OrderSet: Sepse Adulto]`, `[Reconciliada de 11/04]`, `[Em jejum]`, `[PO via]`, `[SN]`.

### Dropdowns dependentes

- Medicamento digitado -> autocomplete por DCB + nome comercial + CAS.
- Selecao de medicamento -> dropdown de apresentacoes disponiveis na farmacia do hospital.
- Apresentacao -> vias compativeis (nao deixa prescrever IV em comprimido).
- Via -> frequencias sugeridas (bula + protocolos locais).

### Preview antes de salvar

Modal com layout identico ao impresso, mostrando rodape com dados CRM, QR code de validacao, hash da prescricao.

### Historico lateral

- Ultimas 5 prescricoes.
- Clique abre diff highlighting itens novos/removidos/alterados.

### Microinteracoes

- Reordenacao por drag-and-drop com placeholder de 2px.
- Alerta novo piscando 2x (scale 1.02 -> 1.0) ao aparecer.
- Substituicao sugerida por CDSS abre inline edit sem fechar painel.

### Acao destrutiva

Suspender prescricao ativa: requer motivo, notifica farmacia e equipe de enfermagem via NATS `velya.prescricao.suspensa.v1`.

### Mobile

- 320px: lista de itens em cards com swipe-left (editar) / swipe-right (remover com undo).
- Painel CDSS vira bottom-sheet com badge de contagem.

---

## C.3 — Tela de Diagnostico (CID-10 + CIAP-2 + lista de problemas)

**Rota**: `/pacientes/[mrn]/diagnosticos`

### Layout logico

- Lista de problemas ativos (esquerda).
- Editor do problema selecionado (centro).
- Timeline de evolucao do problema (direita).

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| PROBLEMAS ATIVOS [+]    | EDITAR PROBLEMA      | EVOLUCAO DO PROBLEMA       |
| > I21.9 IAM (11/04)     | CID-10: I21.9        |  11/04 08:00 Criado       |
|   I10 HAS (cronico)     | Descricao livre:     |  11/04 14:20 Revisto     |
|   E11.9 DM2 (cronico)   | [IAM sem...]         |  12/04 08:30 Ativo       |
|   [+ novo]              | Status: [Ativo v]    |                            |
|                         |  - Ativo             |                            |
| PROBLEMAS RESOLVIDOS    |  - Resolvido         |                            |
| > J18.9 Pneumonia 02/24 |  - Em remissao       |                            |
|                         |  - Suspeito          |                            |
|                         |                      |                            |
|                         | Inicio: 11/04/2026   |                            |
|                         | Certeza: [Confirmado]|                            |
|                         | Origem: [Evolucao]   |                            |
|                         |                      |                            |
|                         | [Salvar]             |                            |
+--------------------------+---------------------+----------------------------+
```

### Agrupamento

- Problemas ativos separados de resolvidos.
- Cronicos marcados com chip `[cronico]`.
- Suspeitos marcados com `[?]` ate confirmacao.

### Dropdowns dependentes

- Especialidade do profissional -> top 20 CIDs mais usados por ele.
- Contexto (atencao primaria) -> oferece CIAP-2 em paralelo.

### Preview

Cada problema, ao ser adicionado, aparece em chip de confirmacao com o titulo completo do CID antes do commit.

### Historico

Todo problema mantem `version[]` com editor e motivo. Nunca deleta — muda status para `Removido` com justificativa.

### Microinteracoes

- Arrastar problema entre "ativos" e "resolvidos" dispara confirmacao.
- Hover em CID revela descricao oficial DATASUS.

### Acao destrutiva

Remover problema exige justificativa e vai para lista "Historico completo" (nao some).

### Mobile

- 320px: tabs "Ativos / Resolvidos / Historico".

---

## C.4 — Tela de Recursos Transversais (templates, smart phrases, order sets, favoritos)

**Rota**: `/configuracoes/recursos-clinicos`
**Perfis**: Medico (seus recursos), Administrador clinico (recursos do hospital).

### Layout logico

- Abas horizontais: Smart Phrases, Templates de Evolucao, OrderSets, Favoritos de Prescricao, Exames Favoritos, Protocolos.

### Wireframe ASCII

```
+==============================================================================+
| RECURSOS CLINICOS                                                            |
| [Smart Phrases] [Templates] [OrderSets] [Favoritos Rx] [Exames Fav] [Protoc] |
+==============================================================================+
| SMART PHRASES                                           [+ nova] [importar]  |
| Filtros: [Minhas] [Especialidade v] [Hospital] [Buscar]                      |
+------------------------------------------------------------------------------+
| Atalho         | Descricao              | Escopo     | Uso ultimo 30d        |
| .dor_peito     | Template HMA dor       | Cardio     | 42x       [editar]   |
| .alta_pneumo   | Resumo alta pneumonia  | Pneumo     | 18x       [editar]   |
| .conduta_iam   | Conduta IAM ST eleva.  | Cardio     | 27x       [editar]   |
+------------------------------------------------------------------------------+
```

### Agrupamento

- Por escopo: Meu / Equipe / Especialidade / Hospital.

### Dropdowns dependentes

- Escopo selecionado filtra recursos visiveis.
- Especialidade filtra templates aplicaveis.

### Preview

Editor de smart phrase tem painel live com substituicao de tokens por valores de exemplo.

### Historico

Cada recurso tem versionamento — quem editou, quando, com diff.

### Microinteracoes

- Arrastar recurso para "Favoritos" duplica no escopo pessoal.
- Search com fuzzy matching (ignora acentos).

### Mobile

- 320px: lista em cards, abas em dropdown.

---

## C.5 — Tela de Atendimento Ambulatorial

**Rota**: `/atendimentos/[id]`

### Layout logico

- Contexto: Atendimento (nao necessariamente internacao).
- Fluxo: Triagem -> Anamnese -> Exame -> Avaliacao -> Plano -> Fechamento.
- Stepper horizontal no topo.

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| ATENDIMENTO #AT-000231 - Inicio 14:05 - Tempo decorrido 00:42                |
| [1 Triagem OK] > [2 Anamnese] > [3 Exame] > [4 Avaliacao] > [5 Plano] > [6]  |
+------------------------------------------------------------------------------+
| Passo 2 - ANAMNESE                                                           |
|                                                                              |
| Queixa principal: [_______________________________]                          |
| HMA: [textarea grande]                                                       |
| [Templates disponiveis ^]                                                    |
|                                                                              |
| [Voltar] [Salvar e continuar] [Pular com justificativa]                      |
+------------------------------------------------------------------------------+
| PAINEL LATERAL                                                               |
| Ultimos 3 atendimentos                                                       |
| - 03/02/26 Clinica Medica                                                    |
| - 18/12/25 Urgencia                                                          |
| - 05/09/25 Cardiologia                                                       |
+------------------------------------------------------------------------------+
```

### Agrupamento

Stepper separa rigidamente etapas. Nao pode fechar atendimento sem Avaliacao + Plano.

### Dropdowns dependentes

- Classificacao de risco (Manchester) filtra protocolos sugeridos.

### Microinteracoes

- Stepper com tick verde ao completar, borda preta ao atual, cinza em pendentes.
- Auto-avanco opcional por config.

### Mobile

- 320px: stepper vertical, uma etapa por scroll.

---

## C.6 — Tela de Solicitacao de Exames Laboratoriais

**Rota**: `/pacientes/[mrn]/exames/laboratorio/novo`

### Layout logico

- Categorias de exames na esquerda (arvore).
- Cesta de exames selecionados no centro.
- Justificativa clinica e urgencia no final.

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| NOVA SOLICITACAO LAB - [+ de protocolo] [+ favoritos]                        |
+------------------------------------------------------------------------------+
| Buscar: [______________]    | CESTA (7 itens)                 [Limpar]      |
|                             |                                                |
| HEMATOLOGIA (12)            | [x] Hemograma completo                        |
|  - Hemograma [x]            | [x] PCR                                        |
|  - Reticulocitos            | [x] Troponina I                                |
|  - VHS                      | [x] CK-MB                                      |
| BIOQUIMICA (28)             | [x] Ureia                                      |
|  - Ureia [x]                | [x] Creatinina                                 |
|  - Creatinina [x]           | [x] Na/K                                       |
|  - Na [x]                   |                                                |
| CARDIOLOGIA (5)             | Urgencia: [x] Rotina [ ] Urgente [ ] STAT     |
|  - Troponina [x]            | Jejum: [x] respeitado 8h                       |
|  - CK-MB [x]                | Justificativa: [dor toracica, suspeita IAM]    |
|                             | CID vinculado: I21.9                           |
|                             | Coleta: [x] leito  [ ] lab central             |
|                             |                                                |
|                             | [Preview] [Assinar e enviar]                   |
+------------------------------------------------------------------------------+
```

### Dropdowns dependentes

- Selecionar protocolo (Sepse, IAM, AVC) pre-popula cesta.
- Urgencia STAT aciona notificacao NATS imediata.

### Preview

Ticket com codigo de barras, QR code, etiquetas de tubo (laranja/roxo/azul) pre-visualizadas.

### Microinteracoes

- Adicionar exame na cesta: leve flash verde, chip aparece com fade-in 120ms.
- Exame duplicado: shake sutil + toast.

### Mobile

- 320px: arvore vira bottom-sheet "Adicionar exame".

---

## C.7 — Tela de Solicitacao de Exames de Imagem

**Rota**: `/pacientes/[mrn]/exames/imagem/novo`

### Layout logico

- Modalidade (RX, TC, RM, US, Mamo, Medicina Nuclear, PET-CT).
- Regiao anatomica (picker visual).
- Contraste, jejum, alergias, TFG.
- Indicacao clinica + CID obrigatorio.

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| SOLICITACAO DE IMAGEM                                                        |
+------------------------------------------------------------------------------+
| Modalidade: [ RX ] [ TC ] [ RM ] [ US ] [ MAMO ] [ MN ] [ PET-CT ]           |
|                                                                              |
| Selecao: TC                                                                  |
| Regiao:  [silhueta humana clickable - tórax selecionado]                     |
|                                                                              |
| Contraste: [x] Sim  [ ] Nao                                                  |
| TFG (ml/min/1.73m2): 52   -> ALERTA: TFG <60 com contraste requer hidratacao |
| Alergia a contraste: [ ] Sim [x] Nao                                         |
| Gestante: [ ] Sim [x] Nao [ ] Desconhecido                                   |
|                                                                              |
| Indicacao clinica: [dor toracica, D-dimero elevado, suspeita TEP]            |
| CID obrigatorio: [I26.9]                                                     |
| Urgencia: [ ] Rotina [x] Urgente [ ] STAT                                    |
|                                                                              |
| [Preview] [Assinar e enviar RIS]                                             |
+------------------------------------------------------------------------------+
```

### Dropdowns dependentes

- Modalidade filtra regioes.
- Regiao + modalidade filtra protocolos DICOM disponiveis.
- Contraste + TFG < 60 aciona chip de alerta e checklist de preparo.

### Preview

Mostra tecnica sugerida (ex: TC torax cortes finos com contraste iodado 1.5ml/kg, protocolo TEP).

### Mobile

- 320px: silhueta vira picker de regiao textual, alto contraste.

---

## C.8 — Tela de Registro de Sinais Vitais

**Rota**: `/pacientes/[mrn]/sinais-vitais/novo` e widget embutido no cockpit.

### Layout logico

- Grid de parametros (PA, FC, FR, SpO2, Tax, Glicemia, Dor, Consciencia).
- Grafico de tendencia (ultimas 24h) abaixo.

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| SINAIS VITAIS - Aferic 12/04 14:10 - por Enf. Joao (COREN 123456)            |
+------------------------------------------------------------------------------+
| PA:    [138] / [92]  mmHg  [alerta PA elevada]                               |
| FC:    [102]          bpm                                                    |
| FR:    [22]           irpm                                                   |
| SpO2:  [94]   % [AA v]                                                       |
| Tax:   [36.8] C [oral v]                                                     |
| Glic:  [142]  mg/dL                                                          |
| Dor:   [4]   /10 [localizacao: precordio]                                    |
| Glasgow:[15]                                                                 |
| MEWS:  [3] [detalhes]                                                        |
|                                                                              |
| Observacao: [_______________________________________________]                |
|                                                                              |
| [Salvar e adicionar nova] [Assinar]                                          |
+------------------------------------------------------------------------------+
| TENDENCIA 24h                                                                |
|  PA: /\__/\___/--\__/\__                                                     |
|  FC: ___/\___/\___/\__                                                       |
+------------------------------------------------------------------------------+
```

### Dropdowns dependentes

- Metodo (oral, axilar, retal, timpanico) muda range de normalidade.
- O2 (AA, cateter, mascara, VNI, VM) muda interpretacao SpO2.

### Microinteracoes

- Tab entre campos em ordem medica canonica.
- Valor fora do range dispara borda amarela/vermelha e calcula MEWS/NEWS automatico.

### Mobile

- 320px: grid single column, teclado numerico otimizado.

---

## C.9 — Tela de Parecer/Interconsulta

**Rota**: `/pacientes/[mrn]/pareceres/novo`

### Layout logico

- Cabecalho: solicitante, solicitado, especialidade.
- Motivo da solicitacao.
- Dados clinicos relevantes (importaveis da evolucao atual).
- Resposta (quando solicitado responde).

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| PARECER #PC-0078   Status: [Aguardando resposta]                             |
+------------------------------------------------------------------------------+
| Solicitante: Dr. Andre (CRM 12345) - Clinica Medica                          |
| Solicitado:  Cardiologia (qualquer plantonista)                              |
| Urgencia:    [Rotina]                                                        |
|                                                                              |
| MOTIVO: Avaliacao de eletro alterado + dor toracica atipica                  |
|                                                                              |
| DADOS CLINICOS RELEVANTES [importar da evolucao atual]                       |
|  [Feminino, 68a, HAS, DM, dislipidemia...]                                   |
|                                                                              |
| EXAMES RELEVANTES [importar]                                                 |
|  [Troponina I 0.8, ECG com supra em V4-V6...]                                |
|                                                                              |
| RESPOSTA (apenas solicitado pode editar)                                     |
|  [bloqueado]                                                                 |
|                                                                              |
| [Salvar] [Enviar]                                                            |
+------------------------------------------------------------------------------+
```

### Dropdowns dependentes

- Especialidade solicitada filtra pool de profissionais disponiveis (PractitionerRole + Turno ativo).

### Mobile

- 320px: fluxo em steps.

---

## C.10 — Tela de Atestados, Receitas e Documentos Clinicos

**Rota**: `/pacientes/[mrn]/documentos/novo`

### Layout logico

- Tipo de documento (picker visual).
- Template (dropdown).
- Editor com campos do template.
- Preview em A4.

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| NOVO DOCUMENTO                                                               |
| Tipo: [Atestado v] [Receita] [Relatorio] [Encam] [Declaracao] [Alta]         |
+------------------------------------------------------------------------------+
| Template: [Atestado padrao - afastamento v]                                  |
|                                                                              |
| Dias de afastamento: [3]                                                     |
| CID (opcional, com consentimento): [J00] [x] paciente autoriza incluir CID   |
| Observacao: [________________________]                                       |
|                                                                              |
| PREVIEW A4                                                                   |
| +----------------------------------------------------------+                 |
| | Hospital Velya - logo                                    |                 |
| | ATESTADO MEDICO                                          |                 |
| | Atesto que o(a) paciente Maria Silva, MRN 000123, esteve |                 |
| | sob meus cuidados hoje, 12/04/2026, necessitando         |                 |
| | afastamento por 3 dias de suas atividades.               |                 |
| | CID: J00 (com autorizacao do paciente).                  |                 |
| |                                                          |                 |
| | Dr. Andre Souza - CRM-SP 12345                           |                 |
| | [QR code de validacao]                                   |                 |
| +----------------------------------------------------------+                 |
|                                                                              |
| [Salvar rascunho] [Assinar digitalmente e emitir]                            |
+------------------------------------------------------------------------------+
```

### Assinatura digital

- Certificado ICP-Brasil A3 (token/cloud).
- Fallback: assinatura avancada (CFM 2.299/2021) com carimbo de tempo.
- Hash do documento final gravado em `DocumentoClinico.hashChainEntryId`.

### Mobile

- 320px: preview em scroll vertical zoom 50%.

---

## C.11 — Tela de Cadastros (Unidades, Especialidades, Profissionais, Templates)

**Rota**: `/configuracoes/cadastros`

### Layout logico

- Master-detail: lista a esquerda, detalhe a direita.
- Filtros no topo.

### Wireframe ASCII

```
+==============================================================================+
| CADASTROS                                                                    |
| [Unidades] [Especialidades] [Profissionais] [Turnos] [Locations] [Templates] |
+==============================================================================+
| UNIDADES ASSISTENCIAIS                 | DETALHE                             |
| [+ nova]  [buscar]                     | Nome: UCI Adulto Ala Sul           |
| > UCI Adulto Ala Sul    (12 leitos)    | Tipo: UCI_ADULTO                   |
|   UCI Adulto Ala Norte  (12 leitos)    | Hospital: Velya Sao Paulo          |
|   UCI Pediatrica        (6 leitos)     | Capacidade: 12 leitos              |
|   Semi-intensiva        (18 leitos)    | Turnos ativos: [D][N]              |
|   Enfermaria Clinica    (40 leitos)    | Especialidades: [Intensiva]        |
|   [ver mais]                           | Status: [Ativa v]                  |
|                                        |                                     |
|                                        | [Salvar] [Desativar]                |
+--------------------------------------------------------------------+---------+
```

### Microinteracoes

- Desativar unidade com leitos ocupados: alerta bloqueante com lista.

### Mobile

- 320px: master vira lista, detalhe abre em full-screen push.

---

## C.12 — Tela de Admissao e Internacao

**Rota**: `/pacientes/[mrn]/internacao/nova`

### Layout logico

- Dados da internacao.
- Alocacao de leito (grid visual da unidade).
- Conciliar medicacoes domiciliares.
- Abertura de CareTeam.

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| NOVA INTERNACAO                                                              |
+------------------------------------------------------------------------------+
| Origem: [ ] PS [x] Ambulatorio [ ] Centro cirurgico [ ] Transferencia        |
| Motivo: IAM sem supra, ICP primaria                                          |
| Especialidade responsavel: [Cardiologia v]                                   |
| Medico responsavel:        [Dra. Camila v]                                   |
|                                                                              |
| LEITO                                                                        |
| Unidade: [UCI Adulto Ala Sul v]                                              |
|                                                                              |
| [grid de leitos - verde=livre, amarelo=reserva, cinza=ocupado, X=bloqueado]  |
| 01 02 03 04 05 06 07 08 09 10 11 12                                          |
|  L  L  O  O  R  X  O  L  L  L  O  O                                          |
|                                                                              |
| Leito selecionado: 08                                                        |
|                                                                              |
| MEDICACOES DOMICILIARES (reconciliar)                                        |
|  [x] Losartana 50mg 1x dia -> manter                                         |
|  [x] Metformina 850mg 2x dia -> suspender durante internacao                 |
|  [ ] AAS 100mg -> substituir por dose terapeutica                            |
|                                                                              |
| CareTeam inicial: [Dra. Camila CRM] [Enf. Joao COREN] [+]                    |
|                                                                              |
| [Salvar] [Internar e abrir primeiro Rx]                                      |
+------------------------------------------------------------------------------+
```

### Dropdowns dependentes

- Unidade -> leitos.
- Especialidade -> medicos com PractitionerRole + Turno ativo.

### Mobile

- 320px: grid de leitos em scroll horizontal.

---

## C.13 — Tela de Centro Cirurgico e Agendamento

**Rota**: `/cirurgia/agenda`

### Layout logico

- Gantt por sala.
- Filtros de sala/equipe/dia.
- Detalhe em painel direito.

### Wireframe ASCII

```
+==============================================================================+
| AGENDA CIRURGICA - 12/04/2026                                                |
| [Hoje] [amanha] [< >] [Filtros]                                              |
+==============================================================================+
| Sala 1 |07|08|09|10|11|12|13|14|15|16|17|18|                                |
|        |      [BLOCO-A 3h]        |[BLOCO-B 2h]  |                          |
| Sala 2 |    [BLOCO-C 4h]              |[LIVRE]    |                          |
| Sala 3 |[BLOCO-D]|[LIVRE]|[BLOCO-E]                |                          |
| Sala 4 |[LIVRE]                                                               |
+==============================================================================+
| BLOCO-A  Paciente Maria Silva MRN 000123                                     |
|          CID I25.2  Cirurgia: CRM-CDRG 4 pontes                              |
|          Equipe: Dr.X (cir), Dr.Y (anest), Enf. Z                            |
|          Checklist SUS safe surgery: [ ] sign-in [ ] time-out [ ] sign-out   |
+------------------------------------------------------------------------------+
```

### Microinteracoes

- Drag-to-reschedule com feedback de conflito em tempo real.

### Mobile

- 320px: agenda vira lista vertical por sala.

---

## C.14 — Tela de Hemoterapia

**Rota**: `/pacientes/[mrn]/hemoterapia/nova`

### Layout logico

- Tipo de hemocomponente.
- Volume/unidades.
- Indicacao clinica.
- Pre-transfusional (tipagem ABO/Rh, provas cruzadas).
- Checklist a beira-leito (dupla checagem).

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER + Tipagem: A+ (12/04 08:00)                                   |
+==============================================================================+
| SOLICITACAO DE HEMOTRANSFUSAO                                                |
+------------------------------------------------------------------------------+
| Hemocomponente: [CH v] (CH, CP, PFC, CRIO)                                   |
| Unidades: [2]                                                                |
| Volume: 300mL cada                                                           |
| Urgencia: [Rotina] [Urgente] [Emergencia (liberacao sem prova)]              |
|                                                                              |
| Indicacao: Hb 6.8 em paciente sintomatico, DAC instavel                      |
| Hb atual: 6.8   Ht: 21                                                       |
|                                                                              |
| Acesso: [veia periferica calibrosa]                                          |
| Sinais vitais pre: PA 118/72 FC 92 Tax 36.6 SpO2 96%                          |
|                                                                              |
| [Assinar e enviar Agencia Transfusional]                                     |
+------------------------------------------------------------------------------+
| CHECKLIST BEIRA-LEITO (aparece no momento da instalacao)                     |
|  [ ] Confere identidade paciente (nome + DN)                                 |
|  [ ] Confere etiqueta bolsa (tipagem + numero)                               |
|  [ ] Confere validade                                                        |
|  [ ] Dupla checagem por 2 profissionais                                      |
|  [ ] SV iniciais documentados                                                |
+------------------------------------------------------------------------------+
```

### Mobile

- Checklist beira-leito otimizado para uso a 30cm do paciente, fonte 18pt.

---

## C.15 — Tela de Procedimentos a Beira-Leito

**Rota**: `/pacientes/[mrn]/procedimentos/novo`

### Layout logico

- Tipo de procedimento (cateter central, PICC, sondagem, paracentese, toracocentese, IOT).
- Checklist pre-procedimento.
- Termo de consentimento.
- Descricao/tecnica.
- Intercorrencias.

### Wireframe ASCII

```
+==============================================================================+
| PATIENT BANNER                                                               |
+==============================================================================+
| NOVO PROCEDIMENTO                                                            |
+------------------------------------------------------------------------------+
| Procedimento: [Cateter Venoso Central v]                                     |
| Sitio: [Jugular interna D v]                                                 |
| Indicacao: DVA, acesso prolongado                                            |
|                                                                              |
| CHECKLIST PRE                                                                |
|  [x] Consentimento assinado                                                  |
|  [x] Coagulograma dentro do prazo                                            |
|  [x] Material esteril disponivel                                             |
|  [x] Pausa cirurgica (time-out)                                              |
|                                                                              |
| TECNICA: Seldinger, 2 tentativas, hemostasia adequada                        |
| Intercorrencias: [ ] Nenhuma [ ] Puncao arterial [ ] Outros                  |
|                                                                              |
| Pos: solicitar RX torax para confirmar posicao.                              |
|                                                                              |
| [Assinar]                                                                    |
+------------------------------------------------------------------------------+
```

### Mobile

- 320px: checklist em full-screen, uma linha por vez.

---

# SECAO D — BACKLOG TECNICO

## Ordem de entrega

- **Fase 1 (Fundacao)**: Recursos Transversais, Evolucao, Prescricoes, Diagnostico.
- **Fase 2 (Expansao)**: Atendimento, Exames Lab, Exames Imagem, Sinais Vitais, Parecer.
- **Fase 3 (Governanca)**: Documentos, Cadastros, Internacao.
- **Fase 4 (Especializacao)**: Cirurgia, Hemoterapia, Procedimentos.

## Legenda de esforco

- **S** = 1-2 semanas, 1 dev
- **M** = 3-4 semanas, 2 devs
- **L** = 5-8 semanas, 2-3 devs + PO + clinico
- **XL** = 9+ semanas, 3-4 devs + PO + designer + clinico + compliance

---

## EPICO 1 — Recursos Transversais (Esforco: L) — Fase 1

**Objetivo**: oferecer SmartPhrases, TemplateEvolucao, OrderSet, Favoritos e Protocolos para acelerar documentacao e reduzir variabilidade.

### Feature 1.1 — SmartPhrase CRUD e expansao inline

#### US 1.1.1 — Como medico, quero criar SmartPhrase pessoal para reuso

Subtarefas:
- Modelo Prisma `SmartPhrase`.
- Endpoint `POST /api/smart-phrases`.
- Componente `<SmartPhrasePicker>` com trigger `.`.
- Tokens: `{paciente.nome}`, `{sinal.pa_ultima}`, etc.
- Audit trail com hash chain.

Criterios de aceite:
- [ ] Criacao com escopo pessoal funciona.
- [ ] Trigger `.abc` lista phrases cujo atalho comeca com `abc`.
- [ ] Tab aceita, Esc rejeita.
- [ ] Tokens sao substituidos por valores reais.
- [ ] Auditoria registra uso (medico, paciente, timestamp).

Dependencias: Paciente, ProfissionalSaude, audit service.
Riscos: performance em lista com 500+ phrases; mitigar com indice e virtual list.

#### US 1.1.2 — Como admin clinico, quero publicar SmartPhrase no escopo hospital

Subtarefas:
- Campo `escopo` enum (PESSOAL, ESPECIALIDADE, HOSPITAL).
- Aprovacao por comite clinico (workflow).
- Permissoes RBAC.

Criterios de aceite:
- [ ] Apenas admin clinico publica HOSPITAL.
- [ ] Medicos veem uniao de escopos aplicaveis.
- [ ] Auditoria de aprovacao.

#### US 1.1.3 — Como medico, quero ver tokens suportados na hora de editar

Subtarefas:
- Lista de tokens em painel lateral do editor.
- Validacao server-side de tokens validos.

### Feature 1.2 — TemplateEvolucao por especialidade

#### US 1.2.1 — Como medico cardiologista, quero template SOAP pronto

Subtarefas:
- Modelo `TemplateEvolucao` com secoes S/O/A/P.
- Seeder com templates base (10 especialidades).
- Importacao no editor de evolucao.

Criterios de aceite:
- [ ] Seletor de template no topo do editor.
- [ ] Aplicar template preenche secoes sem apagar texto ja escrito (merge inteligente).

### Feature 1.3 — OrderSet (kit de prescricao)

#### US 1.3.1 — Como medico, quero aplicar OrderSet "Sepse Adulto"

Subtarefas:
- Modelo `OrderSet` com itens e dependencias.
- Preview antes de aplicar.
- Rastreabilidade: prescricao registra `orderSetId`.

Criterios de aceite:
- [ ] Aplicar OrderSet adiciona todos os itens.
- [ ] Itens com alertas CDSS ativos sao destacados.
- [ ] Preview permite desmarcar itens antes de aplicar.

### Feature 1.4 — FavoritoPrescricao e ExameFavorito

#### US 1.4.1 — Como medico, quero marcar medicamentos frequentes como favoritos

Subtarefas:
- Botao de estrela em item de Rx.
- Lista de favoritos no picker.

### Feature 1.5 — ProtocoloClinico (sepse, IAM, AVC)

#### US 1.5.1 — Como medico, quero iniciar Protocolo Sepse a partir de alerta

Subtarefas:
- Entidade `ProtocoloClinico` com passos temporizados.
- Integracao com notificacoes (sepse bundle 1h/3h/6h).

---

## EPICO 2 — Evolucao Clinica (L) — Fase 1

**Objetivo**: editor SOAP estruturado com smart phrases, importacao de campos e co-assinatura.

### Feature 2.1 — Editor SOAP base

#### US 2.1.1 — Como medico, quero editar SOAP estruturado

Subtarefas:
- Schema `EvolucaoClinica` com secoes S/O/A/P.
- Editor rich-text por secao (TipTap).
- Autosave 8s.

Criterios de aceite:
- [ ] 4 secoes distintas com valida.
- [ ] Autosave funciona offline com retry.
- [ ] Hash chain inclui todas as secoes.

### Feature 2.2 — Importacao de campos

#### US 2.2.1 — Como medico, quero importar sinais vitais recentes

Subtarefas:
- Widget "importar" em cada secao.
- Marcacao visual de campo importado.
- Rastreabilidade em `camposImportados[]`.

### Feature 2.3 — Co-assinatura por residente

#### US 2.3.1 — Como residente, quero que meu preceptor co-assine

Subtarefas:
- Status `AGUARDANDO_COASSINATURA`.
- Fila de co-assinatura para preceptor.
- Notificacao NATS `velya.evolucao.coassinatura.pendente.v1`.

Riscos: evolucao "limbo" sem co-assinatura por horas — SLA de 24h com escalonamento.

### Feature 2.4 — Retificacao clinica

#### US 2.4.1 — Como medico, quero retificar evolucao apos assinada

Subtarefas:
- Nova evolucao aditiva com `retificaDe`.
- Diff renderizado no cockpit.

### Feature 2.5 — Painel de historico lateral

#### US 2.5.1 — Como medico, quero ver evolucoes anteriores ao editar

---

## EPICO 3 — Prescricao Eletronica (XL) — Fase 1

### Feature 3.1 — Editor de Rx + catalogo de medicamentos

### Feature 3.2 — CDSS (alertas de interacao, alergia, dose/peso, duplicidade)

### Feature 3.3 — OrderSet e reconciliacao

### Feature 3.4 — Assinatura digital e envio a farmacia

### Feature 3.5 — Override com justificativa obrigatoria

#### US 3.5.1 — Como medico, quero ignorar alerta com justificativa

Subtarefas:
- Entidade `OverrideAlerta`.
- Dropdown de motivos pre-definidos + texto livre.
- Rastreabilidade no hash chain.

Criterios de aceite:
- [ ] Override exige minimo 10 caracteres de justificativa.
- [ ] Override de alerta ALTO requer senha adicional.
- [ ] Auditoria inclui medico, medicamento, alerta, motivo.

---

## EPICO 4 — Diagnostico (M) — Fase 1

### Feature 4.1 — CRUD de Lista de Problemas

### Feature 4.2 — Integracao CID-10 + CIAP-2

### Feature 4.3 — Versionamento de problemas

---

## EPICO 5 — Atendimento Ambulatorial (M) — Fase 2

### Feature 5.1 — Fluxo em stepper (Triagem -> Fechamento)

### Feature 5.2 — Classificacao de risco Manchester

### Feature 5.3 — Encerramento com desfecho (alta, internar, transferir, orientacao)

---

## EPICO 6 — Exames Laboratoriais (M) — Fase 2

### Feature 6.1 — Catalogo de exames + cesta

### Feature 6.2 — Protocolos (sepse, IAM, AVC)

### Feature 6.3 — Emissao de etiquetas e codigos de barras

### Feature 6.4 — Recebimento de resultado com flag de criticidade

---

## EPICO 7 — Exames de Imagem (L) — Fase 2

### Feature 7.1 — Catalogo por modalidade + picker visual de regiao

### Feature 7.2 — Regras de contraste + TFG + alergia

### Feature 7.3 — Integracao RIS/PACS (HL7 ORM, DICOM)

### Feature 7.4 — Recebimento de laudo com criticidade

---

## EPICO 8 — Sinais Vitais (S) — Fase 2

### Feature 8.1 — Formulario de aferracao

### Feature 8.2 — Calculo automatico MEWS/NEWS/PEWS

### Feature 8.3 — Grafico de tendencia 24h/7d

---

## EPICO 9 — Parecer/Interconsulta (M) — Fase 2

### Feature 9.1 — Solicitacao e resposta

### Feature 9.2 — Fila por especialidade

### Feature 9.3 — SLA e escalonamento

---

## EPICO 10 — Documentos Clinicos (Atestados/Receitas/Relatorios) (L) — Fase 3

### Feature 10.1 — Editor por tipo + template

### Feature 10.2 — Assinatura ICP-Brasil

### Feature 10.3 — Entrega ao paciente (email, app, impresso)

### Feature 10.4 — Validacao por QR code publico

---

## EPICO 11 — Cadastros (M) — Fase 3

### Feature 11.1 — UnidadeAssistencial, Location, Leito

### Feature 11.2 — Especialidade, HealthcareService

### Feature 11.3 — ProfissionalSaude, PractitionerRole, Turno

### Feature 11.4 — Templates e Recursos

---

## EPICO 12 — Internacao (L) — Fase 3

### Feature 12.1 — Admissao com alocacao de leito

### Feature 12.2 — Reconciliacao de medicacoes domiciliares

### Feature 12.3 — Transferencia interna

### Feature 12.4 — Alta hospitalar com sumario

---

## EPICO 13 — Centro Cirurgico (XL) — Fase 4

### Feature 13.1 — Agenda por sala em gantt

### Feature 13.2 — Checklist de cirurgia segura (OMS)

### Feature 13.3 — Descricao cirurgica estruturada

### Feature 13.4 — Integracao anestesia

---

## EPICO 14 — Hemoterapia (L) — Fase 4

### Feature 14.1 — Solicitacao de hemocomponentes

### Feature 14.2 — Checklist beira-leito com dupla checagem

### Feature 14.3 — Registro de reacao transfusional

### Feature 14.4 — Notificacao compulsoria (RDC 34/2014)

---

## EPICO 15 — Procedimentos a Beira-Leito (M) — Fase 4

### Feature 15.1 — Catalogo de procedimentos

### Feature 15.2 — Checklist pre/pos

### Feature 15.3 — Termo de consentimento digital

---

# SECAO E — MODELO DE DADOS

## Convencoes

- TypeScript interfaces declaradas em `packages/core/src/types/`.
- Enums em `packages/core/src/enums/`.
- Tabelas Prisma em `apps/api/prisma/schema.prisma`.
- Todos os eventos NATS seguem padrao `velya.<contexto>.<entidade>.<acao>.v<versao>` (ex: `velya.clinical.evolucao.assinada.v1`).
- Auditoria: todo write de entidade auditavel gera `AuditHashChainEntry` com `prevHash`, `currentHash = sha256(prevHash + payload + timestamp + author)`.

## NOVAS ENTIDADES

### E.1 — Atendimento

```typescript
export interface Atendimento {
  id: string;                          // ULID
  mrn: string;                         // Paciente.mrn
  hospitalId: string;
  locationId: string;                  // unidade/consultorio
  especialidadeId: string;
  profissionalResponsavelId: string;
  tipo: TipoAtendimento;               // AMBULATORIAL, URGENCIA, RETORNO, TELECONSULTA
  origem: OrigemAtendimento;           // AGENDAMENTO, DEMANDA_ESPONTANEA, TRANSFERENCIA
  classificacaoRisco?: ClassificacaoManchester;
  status: StatusAtendimento;           // AGUARDANDO, EM_ATENDIMENTO, FINALIZADO, CANCELADO
  dataInicio: Date;
  dataFim?: Date;
  queixaPrincipal?: string;
  desfecho?: DesfechoAtendimento;      // ALTA, INTERNACAO, TRANSFERENCIA, OBITO, ORIENTACAO, EVASAO
  internacaoId?: string;               // preenchido se desfecho=INTERNACAO
  hashChainEntryId: string;            // raiz da cadeia
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;                    // soft-delete
  version: number;
}

export enum TipoAtendimento {
  AMBULATORIAL = 'AMBULATORIAL',
  URGENCIA = 'URGENCIA',
  RETORNO = 'RETORNO',
  TELECONSULTA = 'TELECONSULTA',
  DOMICILIAR = 'DOMICILIAR',
}

export enum StatusAtendimento {
  AGUARDANDO = 'AGUARDANDO',
  EM_ATENDIMENTO = 'EM_ATENDIMENTO',
  FINALIZADO = 'FINALIZADO',
  CANCELADO = 'CANCELADO',
}
```

- Auditavel: sim (hash chain obrigatorio em transicoes de status e desfecho).
- Versionamento: soft-delete + `version++` em cada write.
- Eventos NATS:
  - `velya.clinical.atendimento.criado.v1`
  - `velya.clinical.atendimento.finalizado.v1`
  - `velya.clinical.atendimento.convertido-em-internacao.v1`

### E.2 — DocumentoClinico

```typescript
export interface DocumentoClinico {
  id: string;
  mrn: string;
  hospitalId: string;
  tipo: TipoDocumento;                 // RECEITA, ATESTADO, RELATORIO, ENCAMINHAMENTO, DECLARACAO, CARTA_ALTA, TERMO_CONSENTIMENTO
  templateId?: string;
  conteudoHTML: string;                // renderizado final
  conteudoEstruturado: Record<string, unknown>; // campos preenchidos
  emissorId: string;                   // ProfissionalSaude
  coAssinantesIds?: string[];
  assinaturaDigital: AssinaturaDigital;
  validadeDias?: number;               // receitas especiais
  numeroEmissao: string;               // sequencial legal
  qrCodeValidacao: string;             // URL publica de validacao
  status: StatusDocumento;             // RASCUNHO, EMITIDO, ENTREGUE, CANCELADO
  entregaPaciente?: EntregaPaciente[];
  cidAssociado?: string;               // com consentimento
  atendimentoId?: string;
  internacaoId?: string;
  hashChainEntryId: string;
  createdAt: Date;
  emitidoAt?: Date;
  canceladoAt?: Date;
  motivoCancelamento?: string;
  version: number;
}

export interface AssinaturaDigital {
  tipo: 'ICP_BRASIL_A3' | 'AVANCADA_CFM2299';
  certificadoSerial?: string;
  carimboTempo: Date;
  hashDocumento: string;               // sha256 do conteudoHTML
}

export enum TipoDocumento {
  RECEITA = 'RECEITA',
  RECEITA_CONTROLADA = 'RECEITA_CONTROLADA',
  ATESTADO = 'ATESTADO',
  RELATORIO = 'RELATORIO',
  ENCAMINHAMENTO = 'ENCAMINHAMENTO',
  DECLARACAO = 'DECLARACAO',
  CARTA_ALTA = 'CARTA_ALTA',
  TERMO_CONSENTIMENTO = 'TERMO_CONSENTIMENTO',
}
```

- Auditavel: sim.
- Versionamento: documento emitido nunca altera; cancelamento cria novo em status `CANCELADO` vinculado.
- Eventos:
  - `velya.clinical.documento.emitido.v1`
  - `velya.clinical.documento.cancelado.v1`
  - `velya.clinical.documento.entregue.v1`

### E.3 — TemplateDocumento

```typescript
export interface TemplateDocumento {
  id: string;
  hospitalId: string;
  tipo: TipoDocumento;
  nome: string;
  especialidadeId?: string;
  cenario?: string;                    // "afastamento curto", "pos-operatorio"
  estrutura: CampoTemplate[];
  html: string;                        // com placeholders {{campo}}
  ativo: boolean;
  version: number;
  createdBy: string;
  updatedAt: Date;
}

export interface CampoTemplate {
  chave: string;
  label: string;
  tipo: 'TEXT' | 'NUMBER' | 'DATE' | 'CID' | 'ENUM';
  obrigatorio: boolean;
  opcoes?: string[];
  valorDefault?: string;
}
```

### E.4 — TemplateEvolucao

```typescript
export interface TemplateEvolucao {
  id: string;
  hospitalId: string;
  escopo: 'PESSOAL' | 'ESPECIALIDADE' | 'HOSPITAL';
  especialidadeId?: string;
  criadoPorId: string;
  nome: string;
  secoes: {
    subjetivo: string;
    objetivo: string;
    avaliacao: string;
    plano: string;
  };
  ativo: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### E.5 — SmartPhrase

```typescript
export interface SmartPhrase {
  id: string;
  atalho: string;                      // ".dor_peito" (unique por escopo)
  descricao: string;
  conteudo: string;                    // com tokens {paciente.nome}
  escopo: 'PESSOAL' | 'ESPECIALIDADE' | 'HOSPITAL';
  criadoPorId: string;
  especialidadeId?: string;
  hospitalId: string;
  usos30d: number;                     // contador denormalizado
  ativo: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### E.6 — OrderSet

```typescript
export interface OrderSet {
  id: string;
  nome: string;                        // "Sepse Adulto 1h Bundle"
  cenarioClinico: string;
  especialidadeId?: string;
  hospitalId: string;
  itens: OrderSetItem[];
  evidenciaReferencia?: string;        // link para diretriz
  ativo: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderSetItem {
  tipo: 'MEDICAMENTO' | 'EXAME_LAB' | 'EXAME_IMAGEM' | 'PROCEDIMENTO' | 'SINAL_VITAL';
  dados: Record<string, unknown>;
  obrigatorio: boolean;
  dependeDe?: string[];                // outros itens do set
}
```

### E.7 — FavoritoPrescricao

```typescript
export interface FavoritoPrescricao {
  id: string;
  profissionalId: string;
  medicamentoId: string;
  apresentacaoDefault: string;
  doseDefault: string;
  viaDefault: string;
  frequenciaDefault: string;
  usos30d: number;
  createdAt: Date;
}
```

### E.8 — ProtocoloClinico

```typescript
export interface ProtocoloClinico {
  id: string;
  nome: string;                        // "Protocolo AVC 4.5h"
  gatilho: GatilhoProtocolo;
  passos: PassoProtocolo[];
  sla: { passoId: string; minutos: number }[];
  hospitalId: string;
  ativo: boolean;
  version: number;
}

export interface PassoProtocolo {
  id: string;
  ordem: number;
  descricao: string;
  acao: 'ALERTA' | 'ORDER_SET' | 'SOLICITAR_EXAME' | 'NOTIFICAR_EQUIPE';
  payload: Record<string, unknown>;
  timeoutMin: number;
}

export interface GatilhoProtocolo {
  origem: 'MANUAL' | 'SINAL_VITAL' | 'RESULTADO_EXAME' | 'CID';
  condicao: Record<string, unknown>;
}
```

### E.9 — ExameFavorito / ExameProtocolo

```typescript
export interface ExameFavorito {
  id: string;
  profissionalId: string;
  exameId: string;
  usos30d: number;
}

export interface ExameProtocolo {
  id: string;
  nome: string;
  exames: { exameId: string; urgencia: string }[];
  hospitalId: string;
  ativo: boolean;
}
```

### E.10 — Hemocomponente

```typescript
export interface Hemocomponente {
  id: string;
  tipo: 'CH' | 'CP' | 'PFC' | 'CRIO' | 'CH_FILTRADO' | 'CH_IRRADIADO' | 'CH_LAVADO';
  tipagemABO: 'A' | 'B' | 'AB' | 'O';
  rh: 'POS' | 'NEG';
  numeroBolsa: string;                 // identificador unico
  volumeML: number;
  validade: Date;
  status: 'DISPONIVEL' | 'RESERVADO' | 'TRANSFUNDIDO' | 'DESCARTADO';
  localArmazenamento: string;
  agenciaTransfusionalId: string;
}
```

### E.11 — SolicitacaoHemotransfusao

```typescript
export interface SolicitacaoHemotransfusao {
  id: string;
  mrn: string;
  solicitanteId: string;
  hemocomponenteTipo: Hemocomponente['tipo'];
  unidades: number;
  urgencia: 'ROTINA' | 'URGENTE' | 'EMERGENCIA';
  indicacaoClinica: string;
  hbAtual?: number;
  htAtual?: number;
  plaqAtual?: number;
  inrAtual?: number;
  status: 'SOLICITADA' | 'LIBERADA' | 'INSTALADA' | 'CONCLUIDA' | 'CANCELADA' | 'REACAO';
  bolsasAlocadas?: string[];           // Hemocomponente.id[]
  checklistBeiraLeito?: ChecklistTransfusao;
  sinaisVitaisPre?: RegistroSinaisVitais;
  sinaisVitaisDurante?: RegistroSinaisVitais[];
  sinaisVitaisPos?: RegistroSinaisVitais;
  hashChainEntryId: string;
  createdAt: Date;
  version: number;
}

export interface ChecklistTransfusao {
  identidadeConfere: boolean;
  etiquetaConfere: boolean;
  validadeConfere: boolean;
  duplaChecagem: { profissional1Id: string; profissional2Id: string };
  sinaisVitaisPreRegistrados: boolean;
}
```

### E.12 — ReacaoTransfusional

```typescript
export interface ReacaoTransfusional {
  id: string;
  solicitacaoId: string;
  tipo: 'FEBRIL_NAO_HEMOLITICA' | 'HEMOLITICA_AGUDA' | 'TRALI' | 'ANAFILATICA' | 'SOBRECARGA_VOLUME' | 'OUTRA';
  gravidade: 'LEVE' | 'MODERADA' | 'GRAVE' | 'OBITO';
  sintomas: string[];
  condutaTomada: string;
  notificacaoCompulsoriaId?: string;   // RDC 34/2014
  hashChainEntryId: string;
  createdAt: Date;
}
```

### E.13 — NotificacaoClinica

```typescript
export interface NotificacaoClinica {
  id: string;
  destinatarioId: string;              // ProfissionalSaude
  destinatarioTipo: 'USER' | 'ROLE' | 'ESCALA';
  tipo: 'RESULTADO_CRITICO' | 'PARECER_PENDENTE' | 'ORDEM_SUSPENSA' | 'PRESCRICAO_CHECAGEM' | 'CODIGO_AZUL' | 'SLA_EXCEDIDO';
  mrn?: string;
  mensagem: string;
  payload: Record<string, unknown>;
  lida: boolean;
  lidaAt?: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  escalonadaPara?: string;             // se nao ack em tempo
  createdAt: Date;
}
```

### E.14 — AlertaClinico

```typescript
export interface AlertaClinico {
  id: string;
  mrn: string;
  contexto: 'PRESCRICAO' | 'SOLICITACAO_EXAME' | 'EVOLUCAO';
  contextoId: string;
  tipo: 'INTERACAO' | 'ALERGIA' | 'DUPLICIDADE' | 'DOSE_PESO' | 'DOSE_IDADE' | 'TFG' | 'GESTACAO' | 'LACTACAO';
  severidade: 'INFO' | 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  mensagem: string;
  evidencia: string;                   // referencia literatura
  status: 'ATIVO' | 'RESOLVIDO' | 'IGNORADO';
  overrideId?: string;
  createdAt: Date;
}
```

### E.15 — OverrideAlerta

```typescript
export interface OverrideAlerta {
  id: string;
  alertaId: string;
  profissionalId: string;
  motivoEnum: 'BENEFICIO_SUPERA_RISCO' | 'PACIENTE_JA_TOLERA' | 'AUSENCIA_ALTERNATIVA' | 'OUTRO';
  justificativaTexto: string;          // min 10 chars
  senhaConfirmada: boolean;            // true se severidade CRITICA
  hashChainEntryId: string;
  createdAt: Date;
}
```

### E.16 — BuscaGlobalEntry

```typescript
export interface BuscaGlobalEntry {
  id: string;
  tipo: 'PACIENTE' | 'PROFISSIONAL' | 'UNIDADE' | 'LEITO' | 'PRESCRICAO' | 'EXAME' | 'DOCUMENTO';
  entidadeId: string;
  hospitalId: string;
  termos: string[];                    // tokens normalizados
  contexto: Record<string, unknown>;
  peso: number;                        // relevancia
  updatedAt: Date;
}
```

- Index: Meilisearch ou Postgres tsvector.

## MODIFICACOES EM ENTIDADES EXISTENTES

### Mod-1 — EvolucaoClinica

```diff
 export interface EvolucaoClinica {
   id: string;
   mrn: string;
   internacaoId?: string;
+  atendimentoId?: string;
   autorId: string;
+  coAssinanteId?: string;
+  statusAssinatura: 'RASCUNHO' | 'ASSINADA' | 'AGUARDANDO_COASSINATURA' | 'RETIFICADA';
   secoes: { s: string; o: string; a: string; p: string; };
+  camposImportados: CampoImportado[];
+  smartPhrasesUsadas: { smartPhraseId: string; timestamp: Date }[];
+  cidsAssociados: string[];
+  prescricoesVinculadasIds: string[];
+  examesVinculadosIds: string[];
+  retificaDe?: string;                 // evolucao anterior
   hashChainEntryId: string;
   createdAt: Date;
   assinadaAt?: Date;
   version: number;
 }

+export interface CampoImportado {
+  secao: 'S' | 'O' | 'A' | 'P';
+  campo: string;
+  origemTipo: 'EVOLUCAO' | 'SINAL_VITAL' | 'EXAME_LAB' | 'EXAME_IMAGEM';
+  origemId: string;
+  importadoAt: Date;
+}
```

### Mod-2 — Prescricao

```diff
 export interface Prescricao {
   id: string;
   mrn: string;
   tipo: 'INTERNACAO' | 'AMBULATORIAL' | 'ALTA';
   itens: ItemPrescricao[];
+  orderSetId?: string;
+  reconciliadaDeInternacaoId?: string;
+  alertasIgnoradosIds: string[];       // OverrideAlerta[]
   status: StatusPrescricao;
   assinaturaDigital?: AssinaturaDigital;
   hashChainEntryId: string;
   createdAt: Date;
   version: number;
 }
```

### Mod-3 — SolicitacaoExame

```diff
 export interface SolicitacaoExame {
   id: string;
   mrn: string;
   tipo: 'LABORATORIO' | 'IMAGEM' | 'ANATOMOPATOLOGICO' | 'MICROBIOLOGIA';
   itens: ItemExame[];
+  protocoloId?: string;
+  criticidadeLaudo?: 'NAO_CRITICO' | 'CRITICO' | 'PANICO';
   urgencia: 'ROTINA' | 'URGENTE' | 'STAT';
   justificativaClinica: string;
   cidAssociado?: string;
   status: StatusSolicitacaoExame;
   resultado?: ResultadoExame;
   hashChainEntryId: string;
   createdAt: Date;
 }
```

### Mod-4 — Paciente

```diff
 export interface Paciente {
   id: string;
   mrn: string;
   nome: string;
   ...
+  timelineEventIds: string[];          // computed, indice de eventos cronologicos
+  consentimentosLGPD: ConsentimentoLGPD[];
 }
```

## EVENTOS NATS (catalogo)

```
velya.clinical.atendimento.criado.v1
velya.clinical.atendimento.finalizado.v1
velya.clinical.evolucao.rascunho-salvo.v1
velya.clinical.evolucao.assinada.v1
velya.clinical.evolucao.coassinatura.pendente.v1
velya.clinical.evolucao.retificada.v1
velya.clinical.prescricao.assinada.v1
velya.clinical.prescricao.suspensa.v1
velya.clinical.prescricao.checada-enfermagem.v1
velya.clinical.alerta.disparado.v1
velya.clinical.alerta.ignorado.v1
velya.clinical.exame.solicitado.v1
velya.clinical.exame.resultado-liberado.v1
velya.clinical.exame.resultado-critico.v1
velya.clinical.documento.emitido.v1
velya.clinical.documento.cancelado.v1
velya.clinical.internacao.admissao.v1
velya.clinical.internacao.alta.v1
velya.clinical.internacao.transferencia.v1
velya.clinical.transfusao.solicitada.v1
velya.clinical.transfusao.instalada.v1
velya.clinical.transfusao.reacao.v1
velya.clinical.procedimento.realizado.v1
velya.clinical.parecer.solicitado.v1
velya.clinical.parecer.respondido.v1
velya.clinical.protocolo.iniciado.v1
velya.clinical.protocolo.passo-executado.v1
velya.clinical.protocolo.sla-excedido.v1
```

## Regras de versionamento e auditoria

- **Soft-delete padrao**: campo `deletedAt` nullable. Query default filtra `deletedAt IS NULL`.
- **Hard-delete**: proibido para entidades clinicas; permitido apenas para rascunhos sem hash chain publicado.
- **Hash chain**: toda entidade clinica auditavel encadeia no `AuditHashChainEntry`. Quebra de cadeia = alerta de integridade + notificacao compliance.
- **Historico de versoes**: versionamento monotonico via `version` + tabela `<Entidade>Version` com snapshot completo.
- **Retencao**: 20 anos para prontuario (CFM 1.821/2007).

---

# SECAO F — REGRAS DE IMPLANTACAO

## F.1 — Estrategia de preservacao do existente

O Velya ja possui em producao:
- `/unidades` (index + landing).
- `/specialties/[id]`.
- `/staff-on-duty`.
- `/tasks` (Kanban).
- `/pacientes/[mrn]` (Cockpit).
- Rotas legacy: `/patients`, `/prescriptions`, `/lab/*`, `/imaging/*`.

**Regra 1**: nenhuma rota legacy sera removida em Fase 1-4. Todas continuam funcionando em paralelo.
**Regra 2**: novas telas entram em rotas em PT-BR (`/pacientes`, `/prescricoes`, `/exames/laboratorio`, `/exames/imagem`) e as rotas EN legacy passam a ser *redirect 301* apenas no final da Fase 3 apos sign-off clinico.
**Regra 3**: redirects sao controlados por feature flag `velya.routing.redirect-legacy-en` para permitir rollback imediato.

### Arvore de rotas alvo

```
/pacientes
/pacientes/[mrn]
/pacientes/[mrn]/evolucoes
/pacientes/[mrn]/evolucoes/nova
/pacientes/[mrn]/prescricoes
/pacientes/[mrn]/prescricoes/nova
/pacientes/[mrn]/diagnosticos
/pacientes/[mrn]/exames/laboratorio
/pacientes/[mrn]/exames/laboratorio/novo
/pacientes/[mrn]/exames/imagem
/pacientes/[mrn]/exames/imagem/novo
/pacientes/[mrn]/sinais-vitais
/pacientes/[mrn]/pareceres
/pacientes/[mrn]/documentos
/pacientes/[mrn]/internacao/nova
/pacientes/[mrn]/hemoterapia
/pacientes/[mrn]/procedimentos
/atendimentos
/atendimentos/[id]
/cirurgia/agenda
/configuracoes/cadastros
/configuracoes/recursos-clinicos
```

## F.2 — Migracao sem downtime (dual-write)

Para cada modificacao de entidade existente (EvolucaoClinica, Prescricao, SolicitacaoExame, Paciente):

1. **Fase A — Shadow write**: novo campo escrito em paralelo, leituras ainda no campo antigo.
2. **Fase B — Shadow read**: leituras novas priorizam campo novo; fallback ao antigo se nulo.
3. **Fase C — Backfill**: job idempotente preenche campo novo com base em dados historicos.
4. **Fase D — Cutover**: leituras/escritas exclusivas no campo novo. Campo antigo marcado como `@deprecated`.
5. **Fase E — Remocao**: apenas apos 2 minor versions sem uso do campo antigo, remover do schema.

Cada fase controlada por flag `velya.migration.<entidade>.<campo>.<fase>`.

## F.3 — Feature flags

Feature flags vivem em `packages/feature-flags` e sao avaliadas com contexto `{ userId, hospitalId, unidadeId, perfil }`.

### Catalogo (extrato)

```
velya.clinical.evolucao.smart-phrases
velya.clinical.evolucao.coassinatura
velya.clinical.evolucao.retificacao
velya.clinical.prescricao.cdss-alertas
velya.clinical.prescricao.order-sets
velya.clinical.prescricao.reconciliacao
velya.clinical.prescricao.override-alerta
velya.clinical.diagnostico.lista-problemas
velya.clinical.diagnostico.ciap2
velya.clinical.atendimento.stepper
velya.clinical.atendimento.manchester
velya.clinical.exames.lab.protocolos
velya.clinical.exames.imagem.picker-visual
velya.clinical.exames.imagem.ris-integration
velya.clinical.sinais-vitais.mews
velya.clinical.parecer.sla-escalonamento
velya.clinical.documentos.icp-brasil
velya.clinical.documentos.qr-validacao
velya.clinical.cadastros.v2
velya.clinical.internacao.reconciliacao
velya.clinical.internacao.alocacao-visual
velya.clinical.cirurgia.gantt
velya.clinical.cirurgia.checklist-oms
velya.clinical.hemoterapia.dupla-checagem
velya.clinical.hemoterapia.notificacao-rdc34
velya.clinical.procedimentos.consentimento-digital
velya.routing.redirect-legacy-en
```

### Regras

- Toda feature flag comeca **OFF em producao**.
- Liberacao em ambientes: `dev (on) -> staging (on) -> canary (UCI adulto ala sul) -> hospital piloto -> todos`.
- Feature flag obsoleta (ligada em 100% por 60 dias) entra em fila de remocao obrigatoria.

## F.4 — Rollout por unidade

Ordem de rollout por fase:

### Fase 1 (Fundacao)
1. UCI Adulto Ala Sul (12 leitos) — ambiente mais controlado, 1 plantao por turno.
2. UCI Adulto Ala Norte (12 leitos) — apos 2 semanas sem incidentes P1/P2.
3. Semi-intensiva (18 leitos).
4. Enfermaria clinica (40 leitos).
5. PS adulto.

### Fase 2
- Ambulatorios por especialidade (cardio, neuro, pneumo primeiro).
- Laboratorio central.
- Servico de imagem.

### Fase 3
- Centro cirurgico.
- Agencia transfusional.

### Fase 4
- Todas demais unidades.

## F.5 — Validacao em homologacao

Pre-requisitos para promover para producao:

1. **Dados sinteticos**: base de homologacao com 500 pacientes sinteticos cobrindo cenarios (sepse, IAM, AVC, puerperio, pediatria, gestante).
2. **Testes automatizados**:
   - Unit: 80%+ coverage.
   - Integration: cenarios por US.
   - E2E (Playwright): top 20 fluxos criticos.
   - Visual regression: pixel diff < 0.1% por tela.
3. **Gates de qualidade**:
   - `detect-overlaps.ts`: zero overlaps.
   - Design tokens validator: 100% conforme.
   - WCAG AA contrast: 100%.
   - Hash chain integrity: 0 quebras.
4. **Sign-off clinico**: 3 medicos + 2 enfermeiros + 1 farmaceutico aprovam UX da tela.
5. **Performance**:
   - p95 carregamento inicial < 1.5s.
   - p95 acao clinica (salvar evolucao) < 700ms.
   - p99 < 2s.
6. **Security**:
   - OWASP ZAP sem High/Critical.
   - Secret scanning limpo.

## F.6 — Treinamento por perfil

### Medicos (2h)
- 30min: filosofia do sistema (SOAP, smart phrases, timeline).
- 30min: pratica guiada (evolucao + Rx + exame).
- 30min: CDSS e overrides.
- 30min: duvidas + atalhos.
- Material: video 15min + cheat sheet A4 + simulador sandbox por 7 dias.

### Enfermagem (1h)
- 15min: cockpit do paciente.
- 15min: sinais vitais + checagem de Rx.
- 15min: hemoterapia beira-leito.
- 15min: duvidas.

### Administrativo (1h)
- 15min: cadastros.
- 15min: fluxo de admissao/alta.
- 15min: relatorios.
- 15min: duvidas.

### Super-users
- Por unidade, 2 super-users (1 medico + 1 enfermeiro) com treinamento de 8h cobrindo todas as telas e troubleshooting basico.
- Canal direto com engenharia via mensageria dedicada.

## F.7 — Plano de rollback

Cada feature flag deve ter plano de rollback documentado em `docs/runbooks/rollback-<flag>.md` contendo:

1. **Gatilhos de rollback**:
   - P1 incident em producao.
   - Taxa de erro > 2% por 15min.
   - Reclamacao clinica com risco ao paciente.
2. **Procedimento**:
   - Desligar flag via dashboard (< 30s).
   - Comunicar usuarios via banner in-app.
   - Reativar rota/fluxo antigo se aplicavel.
   - Analise post-mortem em 72h.
3. **Validacao pos-rollback**:
   - Smoke test em 5 telas criticas.
   - Verificar integridade hash chain.
4. **Criterio de reativacao**: apenas apos correcao + re-aprovacao clinica.

## F.8 — Matriz de risco

| Implementacao            | Risco clinico | Risco tecnico | Risco regulatorio |
|--------------------------|---------------|---------------|-------------------|
| Recursos Transversais    | Baixo         | Baixo         | Baixo             |
| Evolucao Clinica         | Medio         | Medio         | Alto (CFM 1.638)  |
| Prescricao Eletronica    | Alto          | Alto          | Alto (CFM 2.299)  |
| Diagnostico              | Medio         | Baixo         | Medio             |
| Atendimento Ambulatorial | Medio         | Medio         | Medio             |
| Exames Laboratoriais     | Medio         | Medio         | Medio             |
| Exames Imagem            | Alto (TFG)    | Alto          | Medio             |
| Sinais Vitais            | Baixo         | Baixo         | Baixo             |
| Parecer                  | Medio         | Baixo         | Baixo             |
| Documentos Clinicos      | Alto          | Medio         | Alto (ICP-Brasil) |
| Cadastros                | Baixo         | Baixo         | Baixo             |
| Internacao               | Alto          | Alto          | Medio             |
| Cirurgia                 | Alto          | Alto          | Alto (OMS)        |
| Hemoterapia              | Alto          | Medio         | Alto (RDC 34)     |
| Procedimentos            | Alto          | Medio         | Medio             |

Classificacao:
- **Baixo**: erro tem impacto minimo, reversivel.
- **Medio**: erro gera retrabalho clinico moderado, reversivel com esforco.
- **Alto**: erro pode causar evento adverso ao paciente ou descumprimento regulatorio.

## F.9 — Criterios de Go-Live

Para cada Epico, Go-Live em producao requer:

### SLO de UX
- p95 tempo para concluir tarefa principal < tempo baseline do sistema anterior.
- Taxa de conclusao sem erro > 95%.
- NPS clinico > 40 apos 30 dias.

### SLA de sistema
- Availability 99.9% mensal.
- p95 latency < 700ms.
- RPO 5min, RTO 30min.
- Zero perda de dado clinico.

### Sign-off clinico
- CCIH aprova fluxos que envolvem isolamento e antimicrobianos.
- Comite de seguranca do paciente aprova fluxos com CDSS.
- Diretor clinico assina termo de aceite por Epico.

### Sign-off tecnico
- Arquiteto lider aprova modelo de dados.
- Lead DevOps aprova SLO e observabilidade.
- Security Officer aprova LGPD + auditoria.

### Sign-off regulatorio
- Compliance officer verifica aderencia CFM/COFEN/RDC/LGPD.
- DPO aprova mapeamento de dados pessoais.

## F.10 — Observabilidade

- **Metricas**: Prometheus com dashboards Grafana por Epico.
- **Logs**: Loki com retencao de 90 dias, PII redacted.
- **Traces**: Tempo com sampling 10%, 100% em fluxos criticos (prescricao, hemoterapia).
- **Alertas**:
  - Hash chain break = PagerDuty P1.
  - Erro > 2% por 15min = P2.
  - Feature flag flapping = P3.
- **SLI-as-code**: declarado em `ops/slos/<epico>.yaml`.

## F.11 — Governanca de mudanca

- Toda mudanca clinica passa por comite clinico quinzenal.
- Breaking change em entidade clinica exige RFC com 14 dias de revisao.
- Changelog por hospital disponivel em `/changelog`.

## F.12 — Checklist final Go-Live por Epico

- [ ] Feature flags criadas e documentadas.
- [ ] Migracao dual-write concluida.
- [ ] Rollback plan validado em staging.
- [ ] Treinamento ministrado e evidencia coletada.
- [ ] Super-users identificados e treinados.
- [ ] Metricas e alertas em producao.
- [ ] Sign-off clinico assinado.
- [ ] Sign-off tecnico assinado.
- [ ] Sign-off regulatorio assinado.
- [ ] Runbook de incidentes publicado.
- [ ] Comunicacao interna enviada (email + in-app banner).
- [ ] Material de apoio disponivel em `/ajuda`.

---

## Referencias regulatorias aplicadas neste documento

- **CFM 1.638/2002** — definicao e obrigatoriedade de prontuario e retificacao.
- **CFM 1.821/2007** — retencao minima de 20 anos para prontuario.
- **CFM 2.227/2018** — telemedicina.
- **CFM 2.299/2021** — assinatura eletronica de documentos medicos.
- **COFEN 358/2009** — SAE e Processo de Enfermagem.
- **RDC ANVISA 36/2013** — seguranca do paciente.
- **RDC ANVISA 34/2014** — notificacao de reacao transfusional.
- **RDC ANVISA 430/2020** — boas praticas de farmacia hospitalar.
- **Lei 13.709/2018 (LGPD)** — base legal art. 7 VIII (tutela da saude) e art. 11 II f.
- **OMS Safe Surgery Checklist 2009** — checklist cirurgia segura.
- **Manchester Triage System** — classificacao de risco.

---

## Anexos desta parte

- **Anexo C.A** — Biblioteca de wireframes em alta fidelidade (produzida em Figma, fora deste documento).
- **Anexo D.A** — Detalhamento de 70+ User Stories em ferramenta de backlog (Linear/Jira).
- **Anexo E.A** — Schema Prisma completo em `apps/api/prisma/schema.prisma`.
- **Anexo F.A** — Runbooks de rollback por feature flag em `docs/runbooks/`.

---

**Fim da PARTE 3.** A PARTE 4 cobrira: Governanca de Dados (LGPD/anonimizacao), Testes e Qualidade (cenarios clinicos), Observabilidade Clinica (metricas de qualidade hospitalar), Integracoes (TISS, e-SUS, DATASUS, HL7 FHIR, DICOM), Plano Comercial e Roteiro de 24 meses.
