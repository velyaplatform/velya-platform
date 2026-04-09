# Taxonomia de Eventos de Trabalho — Velya Platform

> Classificacao completa de todos os tipos de eventos de trabalho por area funcional, com enum de tipos, mapeamento de categorias e esquemas de dados.

---

## 1. Principio Fundamental

**Cada acao realizada no hospital corresponde a um tipo de evento padronizado. A taxonomia e fechada (enum) para garantir consistencia, mas extensivel via subcategorias.**

---

## 2. Enum Principal de Tipos de Evento

```typescript
enum WorkEventType {
  // ===== ENTRADA / ACOLHIMENTO =====
  CHEGADA_PACIENTE = 'chegada_paciente',
  CADASTRO_PACIENTE = 'cadastro_paciente',
  ATUALIZACAO_CADASTRO = 'atualizacao_cadastro',
  CLASSIFICACAO_RISCO = 'classificacao_risco',
  RECLASSIFICACAO_RISCO = 'reclassificacao_risco',
  ALOCACAO_ATENDIMENTO = 'alocacao_atendimento',
  TRIAGEM = 'triagem',
  ABERTURA_ATENDIMENTO = 'abertura_atendimento',
  VERIFICACAO_ELEGIBILIDADE = 'verificacao_elegibilidade',
  AUTORIZACAO_CONVENIO = 'autorizacao_convenio',

  // ===== ASSISTENCIA CLINICA =====
  AVALIACAO_INICIAL = 'avaliacao_inicial',
  AVALIACAO_ESPECIALIZADA = 'avaliacao_especializada',
  REAVALIACAO = 'reavaliacao',
  EVOLUCAO_MEDICA = 'evolucao_medica',
  EVOLUCAO_ENFERMAGEM = 'evolucao_enfermagem',
  EVOLUCAO_MULTIPROFISSIONAL = 'evolucao_multiprofissional',
  PRESCRICAO_MEDICA = 'prescricao_medica',
  PRESCRICAO_ENFERMAGEM = 'prescricao_enfermagem',
  PRESCRICAO_NUTRICIONAL = 'prescricao_nutricional',
  PRESCRICAO_FISIOTERAPIA = 'prescricao_fisioterapia',
  ADMINISTRACAO_MEDICAMENTO = 'administracao_medicamento',
  ADMINISTRACAO_DIETA = 'administracao_dieta',
  COLETA_MATERIAL = 'coleta_material',
  SOLICITACAO_EXAME = 'solicitacao_exame',
  REALIZACAO_EXAME = 'realizacao_exame',
  RESULTADO_EXAME = 'resultado_exame',
  LAUDO_EXAME = 'laudo_exame',
  COMUNICACAO_VALOR_CRITICO = 'comunicacao_valor_critico',
  PROCEDIMENTO = 'procedimento',
  PROCEDIMENTO_INVASIVO = 'procedimento_invasivo',
  CIRURGIA = 'cirurgia',
  ANESTESIA = 'anestesia',
  INTERCONSULTA_SOLICITACAO = 'interconsulta_solicitacao',
  INTERCONSULTA_RESPOSTA = 'interconsulta_resposta',
  PARECER = 'parecer',
  NOTIFICACAO_COMPULSORIA = 'notificacao_compulsoria',
  PASSAGEM_PLANTAO_CLINICO = 'passagem_plantao_clinico',
  HANDOFF_CLINICO = 'handoff_clinico',
  ALTA_MEDICA = 'alta_medica',
  ALTA_ADMINISTRATIVA = 'alta_administrativa',
  TRANSFERENCIA_INTERNA = 'transferencia_interna',
  TRANSFERENCIA_EXTERNA = 'transferencia_externa',
  OBITO = 'obito',
  DECLARACAO_OBITO = 'declaracao_obito',

  // ===== APOIO AO PACIENTE =====
  CHAMADA_PACIENTE = 'chamada_paciente',
  RESPOSTA_CHAMADA = 'resposta_chamada',
  AVALIACAO_DOR = 'avaliacao_dor',
  CONTROLE_DOR = 'controle_dor',
  CUIDADO_HIGIENE = 'cuidado_higiene',
  MUDANCA_DECUBITO = 'mudanca_decubito',
  TROCA_LEITO = 'troca_leito',
  TRANSPORTE_PACIENTE = 'transporte_paciente',
  ACOMPANHAMENTO_FAMILIAR = 'acompanhamento_familiar',
  ORIENTACAO_PACIENTE = 'orientacao_paciente',
  ORIENTACAO_ALTA = 'orientacao_alta',
  SOLICITACAO_DIETA = 'solicitacao_dieta',
  ENTREGA_DIETA = 'entrega_dieta',
  SOLICITACAO_MATERIAL = 'solicitacao_material',
  ENTREGA_MATERIAL = 'entrega_material',

  // ===== LIMPEZA / HIGIENIZACAO =====
  LIMPEZA_CONCORRENTE = 'limpeza_concorrente',
  LIMPEZA_TERMINAL = 'limpeza_terminal',
  LIMPEZA_IMEDIATA = 'limpeza_imediata',
  LIMPEZA_AREA_CRITICA = 'limpeza_area_critica',
  DESINFECCAO = 'desinfeccao',
  ACIONAMENTO_LIMPEZA = 'acionamento_limpeza',
  CHEGADA_LIMPEZA = 'chegada_limpeza',
  EXECUCAO_LIMPEZA = 'execucao_limpeza',
  LIBERACAO_LIMPEZA = 'liberacao_limpeza',

  // ===== MANUTENCAO =====
  CHAMADO_MANUTENCAO = 'chamado_manutencao',
  INICIO_MANUTENCAO = 'inicio_manutencao',
  EXECUCAO_MANUTENCAO = 'execucao_manutencao',
  CONCLUSAO_MANUTENCAO = 'conclusao_manutencao',
  MANUTENCAO_PREVENTIVA = 'manutencao_preventiva',
  MANUTENCAO_CORRETIVA = 'manutencao_corretiva',
  MANUTENCAO_EMERGENCIAL = 'manutencao_emergencial',
  INDISPONIBILIDADE_EQUIPAMENTO = 'indisponibilidade_equipamento',
  RETORNO_EQUIPAMENTO = 'retorno_equipamento',

  // ===== TRANSPORTE =====
  ACIONAMENTO_TRANSPORTE = 'acionamento_transporte',
  ACEITE_TRANSPORTE = 'aceite_transporte',
  SAIDA_TRANSPORTE = 'saida_transporte',
  CHEGADA_TRANSPORTE = 'chegada_transporte',
  TRANSFERENCIA_CUSTODIA = 'transferencia_custodia',
  RECUSA_TRANSPORTE = 'recusa_transporte',
  ATRASO_TRANSPORTE = 'atraso_transporte',

  // ===== CENTRAL DE LEITOS =====
  PEDIDO_VAGA = 'pedido_vaga',
  PRIORIZACAO_VAGA = 'priorizacao_vaga',
  ALOCACAO_VAGA = 'alocacao_vaga',
  BLOQUEIO_LEITO = 'bloqueio_leito',
  DESBLOQUEIO_LEITO = 'desbloqueio_leito',
  LIBERACAO_LEITO = 'liberacao_leito',
  INDISPONIBILIDADE_LEITO = 'indisponibilidade_leito',

  // ===== SEGURANCA =====
  OCORRENCIA_SEGURANCA = 'ocorrencia_seguranca',
  CONTENCAO_SEGURANCA = 'contencao_seguranca',
  APOIO_EQUIPE_SEGURANCA = 'apoio_equipe_seguranca',
  CONTROLE_ACESSO_FISICO = 'controle_acesso_fisico',
  RONDA_SEGURANCA = 'ronda_seguranca',

  // ===== TI =====
  INCIDENTE_TI = 'incidente_ti',
  INDISPONIBILIDADE_SISTEMA = 'indisponibilidade_sistema',
  CORRECAO_TI = 'correcao_ti',
  IMPACTO_TI = 'impacto_ti',
  DEPLOY_SISTEMA = 'deploy_sistema',
  MONITORAMENTO_TI = 'monitoramento_ti',

  // ===== FARMACIA =====
  DISPENSACAO = 'dispensacao',
  DEVOLUCAO_MEDICAMENTO = 'devolucao_medicamento',
  VALIDACAO_PRESCRICAO = 'validacao_prescricao',
  ALERTA_INTERACAO = 'alerta_interacao',
  REPOSICAO_ESTOQUE = 'reposicao_estoque',
  CONTROLE_TEMPERATURA = 'controle_temperatura',

  // ===== NUTRICAO =====
  PRODUCAO_DIETA = 'producao_dieta',
  DISTRIBUICAO_DIETA = 'distribuicao_dieta',
  CONTROLE_QUALIDADE_DIETA = 'controle_qualidade_dieta',
  AVALIACAO_NUTRICIONAL = 'avaliacao_nutricional',

  // ===== OPERACAO / FLUXO =====
  ATRASO_OPERACIONAL = 'atraso_operacional',
  INDISPONIBILIDADE_RECURSO = 'indisponibilidade_recurso',
  PENDENCIA_OPERACIONAL = 'pendencia_operacional',
  EXCECAO_OPERACIONAL = 'excecao_operacional',
  ESCALACAO = 'escalacao',
  ACEITE_TAREFA = 'aceite_tarefa',
  RECUSA_TAREFA = 'recusa_tarefa',
  CONCLUSAO_TAREFA = 'conclusao_tarefa',

  // ===== AUDITORIA / SESSAO =====
  LOGIN = 'login',
  LOGOUT = 'logout',
  TROCA_USUARIO = 'troca_usuario',
  ACESSO_PRONTUARIO = 'acesso_prontuario',
  BREAK_GLASS = 'break_glass',
  EDICAO_REGISTRO = 'edicao_registro',
  CORRECAO_REGISTRO = 'correcao_registro',
  ASSINATURA_DIGITAL = 'assinatura_digital',
  CANCELAMENTO = 'cancelamento',
  EXPORTACAO_DADOS = 'exportacao_dados',
  VISUALIZACAO_SENSIVEL = 'visualizacao_sensivel',
  FALHA_AUTENTICACAO = 'falha_autenticacao',
  IMPRESSAO_DOCUMENTO = 'impressao_documento',

  // ===== QUALIDADE / SEGURANCA DO PACIENTE =====
  EVENTO_ADVERSO = 'evento_adverso',
  QUASE_FALHA = 'quase_falha',
  NAO_CONFORMIDADE = 'nao_conformidade',
  DESVIO_PROTOCOLO = 'desvio_protocolo',
  INVESTIGACAO_INCIDENTE = 'investigacao_incidente',
  PLANO_ACAO_CORRETIVA = 'plano_acao_corretiva',

  // ===== FATURAMENTO =====
  PROCESSAMENTO_GUIA = 'processamento_guia',
  GLOSA = 'glosa',
  RECURSO_GLOSA = 'recurso_glosa',
  COBRANCA = 'cobranca',
}
```

---

## 3. Mapeamento Tipo -> Categoria

```typescript
const eventCategoryMapping: Record<WorkEventType, WorkEventCategory> = {
  // Entrada/Acolhimento
  [WorkEventType.CHEGADA_PACIENTE]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.CADASTRO_PACIENTE]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.ATUALIZACAO_CADASTRO]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.CLASSIFICACAO_RISCO]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.RECLASSIFICACAO_RISCO]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.ALOCACAO_ATENDIMENTO]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.TRIAGEM]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.ABERTURA_ATENDIMENTO]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.VERIFICACAO_ELEGIBILIDADE]: WorkEventCategory.ADMINISTRATIVO,
  [WorkEventType.AUTORIZACAO_CONVENIO]: WorkEventCategory.ADMINISTRATIVO,

  // Assistencia
  [WorkEventType.AVALIACAO_INICIAL]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.AVALIACAO_ESPECIALIZADA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.REAVALIACAO]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.EVOLUCAO_MEDICA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.EVOLUCAO_ENFERMAGEM]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.EVOLUCAO_MULTIPROFISSIONAL]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.PRESCRICAO_MEDICA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.PRESCRICAO_ENFERMAGEM]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.PRESCRICAO_NUTRICIONAL]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.PRESCRICAO_FISIOTERAPIA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.ADMINISTRACAO_MEDICAMENTO]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.ADMINISTRACAO_DIETA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.COLETA_MATERIAL]: WorkEventCategory.APOIO,
  [WorkEventType.SOLICITACAO_EXAME]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.REALIZACAO_EXAME]: WorkEventCategory.APOIO,
  [WorkEventType.RESULTADO_EXAME]: WorkEventCategory.APOIO,
  [WorkEventType.LAUDO_EXAME]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.COMUNICACAO_VALOR_CRITICO]: WorkEventCategory.COMUNICACAO,
  [WorkEventType.PROCEDIMENTO]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.PROCEDIMENTO_INVASIVO]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.CIRURGIA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.ANESTESIA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.INTERCONSULTA_SOLICITACAO]: WorkEventCategory.COMUNICACAO,
  [WorkEventType.INTERCONSULTA_RESPOSTA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.PARECER]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.NOTIFICACAO_COMPULSORIA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.PASSAGEM_PLANTAO_CLINICO]: WorkEventCategory.HANDOFF,
  [WorkEventType.HANDOFF_CLINICO]: WorkEventCategory.HANDOFF,
  [WorkEventType.ALTA_MEDICA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.ALTA_ADMINISTRATIVA]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.TRANSFERENCIA_INTERNA]: WorkEventCategory.HANDOFF,
  [WorkEventType.TRANSFERENCIA_EXTERNA]: WorkEventCategory.HANDOFF,
  [WorkEventType.OBITO]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.DECLARACAO_OBITO]: WorkEventCategory.ASSISTENCIAL,

  // Apoio ao paciente
  [WorkEventType.CHAMADA_PACIENTE]: WorkEventCategory.COMUNICACAO,
  [WorkEventType.RESPOSTA_CHAMADA]: WorkEventCategory.COMUNICACAO,
  [WorkEventType.AVALIACAO_DOR]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.CONTROLE_DOR]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.CUIDADO_HIGIENE]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.MUDANCA_DECUBITO]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.TROCA_LEITO]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.TRANSPORTE_PACIENTE]: WorkEventCategory.TRANSPORTE,
  [WorkEventType.ACOMPANHAMENTO_FAMILIAR]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.ORIENTACAO_PACIENTE]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.ORIENTACAO_ALTA]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.SOLICITACAO_DIETA]: WorkEventCategory.APOIO,
  [WorkEventType.ENTREGA_DIETA]: WorkEventCategory.APOIO,
  [WorkEventType.SOLICITACAO_MATERIAL]: WorkEventCategory.LOGISTICA,
  [WorkEventType.ENTREGA_MATERIAL]: WorkEventCategory.LOGISTICA,

  // Limpeza
  [WorkEventType.LIMPEZA_CONCORRENTE]: WorkEventCategory.HIGIENE,
  [WorkEventType.LIMPEZA_TERMINAL]: WorkEventCategory.HIGIENE,
  [WorkEventType.LIMPEZA_IMEDIATA]: WorkEventCategory.HIGIENE,
  [WorkEventType.LIMPEZA_AREA_CRITICA]: WorkEventCategory.HIGIENE,
  [WorkEventType.DESINFECCAO]: WorkEventCategory.HIGIENE,
  [WorkEventType.ACIONAMENTO_LIMPEZA]: WorkEventCategory.HIGIENE,
  [WorkEventType.CHEGADA_LIMPEZA]: WorkEventCategory.HIGIENE,
  [WorkEventType.EXECUCAO_LIMPEZA]: WorkEventCategory.HIGIENE,
  [WorkEventType.LIBERACAO_LIMPEZA]: WorkEventCategory.HIGIENE,

  // Manutencao
  [WorkEventType.CHAMADO_MANUTENCAO]: WorkEventCategory.MANUTENCAO,
  [WorkEventType.INICIO_MANUTENCAO]: WorkEventCategory.MANUTENCAO,
  [WorkEventType.EXECUCAO_MANUTENCAO]: WorkEventCategory.MANUTENCAO,
  [WorkEventType.CONCLUSAO_MANUTENCAO]: WorkEventCategory.MANUTENCAO,
  [WorkEventType.MANUTENCAO_PREVENTIVA]: WorkEventCategory.MANUTENCAO,
  [WorkEventType.MANUTENCAO_CORRETIVA]: WorkEventCategory.MANUTENCAO,
  [WorkEventType.MANUTENCAO_EMERGENCIAL]: WorkEventCategory.MANUTENCAO,
  [WorkEventType.INDISPONIBILIDADE_EQUIPAMENTO]: WorkEventCategory.MANUTENCAO,
  [WorkEventType.RETORNO_EQUIPAMENTO]: WorkEventCategory.MANUTENCAO,

  // Transporte
  [WorkEventType.ACIONAMENTO_TRANSPORTE]: WorkEventCategory.TRANSPORTE,
  [WorkEventType.ACEITE_TRANSPORTE]: WorkEventCategory.TRANSPORTE,
  [WorkEventType.SAIDA_TRANSPORTE]: WorkEventCategory.TRANSPORTE,
  [WorkEventType.CHEGADA_TRANSPORTE]: WorkEventCategory.TRANSPORTE,
  [WorkEventType.TRANSFERENCIA_CUSTODIA]: WorkEventCategory.TRANSPORTE,
  [WorkEventType.RECUSA_TRANSPORTE]: WorkEventCategory.TRANSPORTE,
  [WorkEventType.ATRASO_TRANSPORTE]: WorkEventCategory.TRANSPORTE,

  // Central de leitos
  [WorkEventType.PEDIDO_VAGA]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.PRIORIZACAO_VAGA]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.ALOCACAO_VAGA]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.BLOQUEIO_LEITO]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.DESBLOQUEIO_LEITO]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.LIBERACAO_LEITO]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.INDISPONIBILIDADE_LEITO]: WorkEventCategory.OPERACIONAL,

  // Seguranca
  [WorkEventType.OCORRENCIA_SEGURANCA]: WorkEventCategory.SEGURANCA,
  [WorkEventType.CONTENCAO_SEGURANCA]: WorkEventCategory.SEGURANCA,
  [WorkEventType.APOIO_EQUIPE_SEGURANCA]: WorkEventCategory.SEGURANCA,
  [WorkEventType.CONTROLE_ACESSO_FISICO]: WorkEventCategory.SEGURANCA,
  [WorkEventType.RONDA_SEGURANCA]: WorkEventCategory.SEGURANCA,

  // TI
  [WorkEventType.INCIDENTE_TI]: WorkEventCategory.TI,
  [WorkEventType.INDISPONIBILIDADE_SISTEMA]: WorkEventCategory.TI,
  [WorkEventType.CORRECAO_TI]: WorkEventCategory.TI,
  [WorkEventType.IMPACTO_TI]: WorkEventCategory.TI,
  [WorkEventType.DEPLOY_SISTEMA]: WorkEventCategory.TI,
  [WorkEventType.MONITORAMENTO_TI]: WorkEventCategory.TI,

  // Farmacia
  [WorkEventType.DISPENSACAO]: WorkEventCategory.APOIO,
  [WorkEventType.DEVOLUCAO_MEDICAMENTO]: WorkEventCategory.APOIO,
  [WorkEventType.VALIDACAO_PRESCRICAO]: WorkEventCategory.VALIDACAO,
  [WorkEventType.ALERTA_INTERACAO]: WorkEventCategory.ASSISTENCIAL,
  [WorkEventType.REPOSICAO_ESTOQUE]: WorkEventCategory.LOGISTICA,
  [WorkEventType.CONTROLE_TEMPERATURA]: WorkEventCategory.LOGISTICA,

  // Nutricao
  [WorkEventType.PRODUCAO_DIETA]: WorkEventCategory.APOIO,
  [WorkEventType.DISTRIBUICAO_DIETA]: WorkEventCategory.APOIO,
  [WorkEventType.CONTROLE_QUALIDADE_DIETA]: WorkEventCategory.VALIDACAO,
  [WorkEventType.AVALIACAO_NUTRICIONAL]: WorkEventCategory.ASSISTENCIAL,

  // Operacao
  [WorkEventType.ATRASO_OPERACIONAL]: WorkEventCategory.EXCECAO,
  [WorkEventType.INDISPONIBILIDADE_RECURSO]: WorkEventCategory.EXCECAO,
  [WorkEventType.PENDENCIA_OPERACIONAL]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.EXCECAO_OPERACIONAL]: WorkEventCategory.EXCECAO,
  [WorkEventType.ESCALACAO]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.ACEITE_TAREFA]: WorkEventCategory.OPERACIONAL,
  [WorkEventType.RECUSA_TAREFA]: WorkEventCategory.EXCECAO,
  [WorkEventType.CONCLUSAO_TAREFA]: WorkEventCategory.OPERACIONAL,

  // Auditoria
  [WorkEventType.LOGIN]: WorkEventCategory.AUDITORIA,
  [WorkEventType.LOGOUT]: WorkEventCategory.AUDITORIA,
  [WorkEventType.TROCA_USUARIO]: WorkEventCategory.AUDITORIA,
  [WorkEventType.ACESSO_PRONTUARIO]: WorkEventCategory.AUDITORIA,
  [WorkEventType.BREAK_GLASS]: WorkEventCategory.AUDITORIA,
  [WorkEventType.EDICAO_REGISTRO]: WorkEventCategory.CORRECAO,
  [WorkEventType.CORRECAO_REGISTRO]: WorkEventCategory.CORRECAO,
  [WorkEventType.ASSINATURA_DIGITAL]: WorkEventCategory.VALIDACAO,
  [WorkEventType.CANCELAMENTO]: WorkEventCategory.CORRECAO,
  [WorkEventType.EXPORTACAO_DADOS]: WorkEventCategory.AUDITORIA,
  [WorkEventType.VISUALIZACAO_SENSIVEL]: WorkEventCategory.AUDITORIA,
  [WorkEventType.FALHA_AUTENTICACAO]: WorkEventCategory.AUDITORIA,
  [WorkEventType.IMPRESSAO_DOCUMENTO]: WorkEventCategory.AUDITORIA,

  // Qualidade
  [WorkEventType.EVENTO_ADVERSO]: WorkEventCategory.EXCECAO,
  [WorkEventType.QUASE_FALHA]: WorkEventCategory.EXCECAO,
  [WorkEventType.NAO_CONFORMIDADE]: WorkEventCategory.EXCECAO,
  [WorkEventType.DESVIO_PROTOCOLO]: WorkEventCategory.EXCECAO,
  [WorkEventType.INVESTIGACAO_INCIDENTE]: WorkEventCategory.AUDITORIA,
  [WorkEventType.PLANO_ACAO_CORRETIVA]: WorkEventCategory.CORRECAO,

  // Faturamento
  [WorkEventType.PROCESSAMENTO_GUIA]: WorkEventCategory.ADMINISTRATIVO,
  [WorkEventType.GLOSA]: WorkEventCategory.ADMINISTRATIVO,
  [WorkEventType.RECURSO_GLOSA]: WorkEventCategory.ADMINISTRATIVO,
  [WorkEventType.COBRANCA]: WorkEventCategory.ADMINISTRATIVO,
};
```

---

## 4. Tabela Resumo por Area Funcional

### 4.1 Entrada/Acolhimento (10 tipos)

| Tipo                      | Categoria      | Papel Principal  | Campos Adicionais Obrigatorios    |
| ------------------------- | -------------- | ---------------- | --------------------------------- |
| chegada_paciente          | operacional    | Recepcao         | hora_chegada, tipo_atendimento    |
| cadastro_paciente         | operacional    | Cadastrista      | dados_demograficos, convenio      |
| classificacao_risco       | assistencial   | Enfermeiro       | protocolo_manchester, cor, queixa |
| alocacao_atendimento      | operacional    | Recepcao/Sistema | area_destino, prioridade          |
| triagem                   | assistencial   | Enfermeiro       | sinais_vitais, queixa_principal   |
| abertura_atendimento      | operacional    | Recepcao         | tipo_atendimento, guia            |
| verificacao_elegibilidade | administrativo | Recepcao         | convenio, resultado               |
| autorizacao_convenio      | administrativo | Faturamento      | numero_autorizacao, validade      |
| atualizacao_cadastro      | operacional    | Cadastrista      | campos_alterados                  |
| reclassificacao_risco     | assistencial   | Enfermeiro       | motivo, nova_cor                  |

### 4.2 Assistencia Clinica (32 tipos)

| Tipo                      | Categoria    | Papel Principal   | Campos Adicionais Obrigatorios        |
| ------------------------- | ------------ | ----------------- | ------------------------------------- |
| avaliacao_inicial         | assistencial | Medico/Enfermeiro | tipo_avaliacao, achados               |
| evolucao_medica           | assistencial | Medico            | conteudo_estruturado, diagnosticos    |
| evolucao_enfermagem       | assistencial | Enfermeiro        | diagnosticos_enfermagem, intervencoes |
| prescricao_medica         | assistencial | Medico            | itens_prescritos, vigencia            |
| administracao_medicamento | assistencial | Tec. Enfermagem   | medicamento, dose, via, horario       |
| coleta_material           | apoio        | Tec. Laboratorio  | tipo_material, tubo, paciente         |
| resultado_exame           | apoio        | Lab/Imagem        | exame, resultado, referencia          |
| comunicacao_valor_critico | comunicacao  | Lab               | valor, exame, receptor, confirmacao   |
| procedimento              | assistencial | Medico/Enfermeiro | tipo, local, duracao                  |
| cirurgia                  | assistencial | Cirurgiao         | tipo, duracao, equipe, anestesia      |
| interconsulta_solicitacao | comunicacao  | Medico            | especialidade, motivo, urgencia       |
| alta_medica               | assistencial | Medico            | tipo_alta, condicoes, orientacoes     |
| transferencia_interna     | handoff      | Medico/Enfermeiro | origem, destino, motivo, SBAR         |
| obito                     | assistencial | Medico            | hora, causa, CID                      |

### 4.3 Apoio ao Paciente (15 tipos)

| Tipo                | Categoria    | Papel Principal       | Campos Adicionais Obrigatorios    |
| ------------------- | ------------ | --------------------- | --------------------------------- |
| chamada_paciente    | comunicacao  | Paciente/Acompanhante | tipo_chamada, leito               |
| resposta_chamada    | comunicacao  | Enfermagem            | tempo_resposta, acao              |
| avaliacao_dor       | assistencial | Enfermagem            | escala, intensidade, local        |
| transporte_paciente | transporte   | Maqueiro              | origem, destino, tipo, restricoes |
| entrega_dieta       | apoio        | Nutricao Op           | tipo_dieta, horario, aceite       |

### 4.4 Limpeza/Higienizacao (9 tipos)

| Tipo                 | Categoria | Papel Principal    | Campos Adicionais Obrigatorios      |
| -------------------- | --------- | ------------------ | ----------------------------------- |
| acionamento_limpeza  | higiene   | Enfermagem/Sistema | tipo_limpeza, local, prioridade     |
| chegada_limpeza      | higiene   | Higienizacao       | tempo_resposta                      |
| execucao_limpeza     | higiene   | Higienizacao       | produtos, tecnica, duracao          |
| liberacao_limpeza    | higiene   | Higienizacao       | conferencia, liberado_por           |
| limpeza_terminal     | higiene   | Higienizacao       | motivo_terminal, checklist          |
| limpeza_concorrente  | higiene   | Higienizacao       | areas_cobertas                      |
| limpeza_imediata     | higiene   | Higienizacao       | motivo, tipo_contaminacao           |
| limpeza_area_critica | higiene   | Higienizacao       | area, protocolo_especial            |
| desinfeccao          | higiene   | Higienizacao       | agente, concentracao, tempo_contato |

### 4.5 Manutencao (9 tipos)

| Tipo                          | Categoria  | Papel Principal | Campos Adicionais              |
| ----------------------------- | ---------- | --------------- | ------------------------------ |
| chamado_manutencao            | manutencao | Qualquer        | equipamento, defeito, urgencia |
| inicio_manutencao             | manutencao | Tec. Manutencao | diagnostico_tecnico            |
| execucao_manutencao           | manutencao | Tec. Manutencao | servico_realizado, pecas       |
| conclusao_manutencao          | manutencao | Tec. Manutencao | status_final, teste            |
| indisponibilidade_equipamento | manutencao | Tec. Manutencao | equipamento, impacto, previsao |

### 4.6 Transporte (7 tipos)

| Tipo                   | Categoria  | Campos Adicionais                       |
| ---------------------- | ---------- | --------------------------------------- |
| acionamento_transporte | transporte | origem, destino, prioridade, restricoes |
| aceite_transporte      | transporte | maqueiro_id, previsao                   |
| saida_transporte       | transporte | hora_saida, acompanhantes               |
| chegada_transporte     | transporte | hora_chegada, condicao_paciente         |
| transferencia_custodia | transporte | de_quem, para_quem, aceite              |
| recusa_transporte      | transporte | motivo, alternativa                     |
| atraso_transporte      | transporte | motivo, nova_previsao                   |

### 4.7 Auditoria/Sessao (13 tipos)

| Tipo                  | Categoria | Detalhes                                           |
| --------------------- | --------- | -------------------------------------------------- |
| login                 | auditoria | metodo, dispositivo, unidade, ip                   |
| logout                | auditoria | motivo, duracao_sessao                             |
| troca_usuario         | auditoria | usuario_saiu, usuario_entrou                       |
| acesso_prontuario     | auditoria | paciente, motivo, relacao                          |
| break_glass           | auditoria | justificativa, paciente, duracao                   |
| edicao_registro       | correcao  | registro_original, campo, valor_antigo, valor_novo |
| correcao_registro     | correcao  | justificativa, aprovador                           |
| assinatura_digital    | validacao | documento, tipo_assinatura, certificado            |
| cancelamento          | correcao  | item_cancelado, motivo                             |
| exportacao_dados      | auditoria | tipo_dado, quantidade, formato, destino            |
| visualizacao_sensivel | auditoria | dado_acessado, justificativa                       |
| falha_autenticacao    | auditoria | motivo, tentativa_numero                           |
| impressao_documento   | auditoria | documento, impressora, copias                      |

---

## 5. Contagem Total

| Grupo Funcional              | Quantidade de Tipos |
| ---------------------------- | ------------------- |
| Entrada/Acolhimento          | 10                  |
| Assistencia Clinica          | 32                  |
| Apoio ao Paciente            | 15                  |
| Limpeza/Higienizacao         | 9                   |
| Manutencao                   | 9                   |
| Transporte                   | 7                   |
| Central de Leitos            | 7                   |
| Seguranca                    | 5                   |
| TI                           | 6                   |
| Farmacia                     | 6                   |
| Nutricao                     | 4                   |
| Operacao/Fluxo               | 8                   |
| Auditoria/Sessao             | 13                  |
| Qualidade/Seguranca Paciente | 6                   |
| Faturamento                  | 4                   |
| **TOTAL**                    | **141**             |

---

## 6. Extensibilidade

A taxonomia e fechada para os tipos principais (enum), mas extensivel via:

```typescript
interface ExtendedWorkEvent extends WorkEvent {
  // Subcategoria customizada (livre dentro do tipo)
  custom_subcategory?: string;

  // Campos adicionais por area (schema validado)
  area_specific_data?: Record<string, unknown>;

  // Tags para classificacao adicional
  tags?: string[];
}
```

Novos tipos devem ser propostos via PR com:

1. Definicao do tipo no enum
2. Mapeamento para categoria
3. Campos obrigatorios adicionais
4. Papeis autorizados
5. SLA associado (se aplicavel)

---

## 7. Resumo

A taxonomia de eventos de trabalho do Velya:

1. **141 tipos de evento** cobrindo todas as areas hospitalares.
2. **16 categorias** para agrupamento funcional.
3. **Mapeamento tipo->categoria** para roteamento automatico.
4. **Campos obrigatorios por tipo** para garantir completude.
5. **Papeis autorizados por tipo** para controle de acesso.
6. **Enum fechado** para consistencia, extensivel via subcategorias.
