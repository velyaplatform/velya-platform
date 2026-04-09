# Modelo de Reporte de Trabalho Nao-Clinico — Velya Platform

> Como profissionais de areas nao-clinicas reportam atividades: limpeza, manutencao, transporte, seguranca, TI, central de leitos. UX simplificada, poucos cliques, contexto pre-preenchido.

---

## 1. Principio Fundamental

**Profissionais nao-clinicos reportam trabalho sem acessar dados clinicos. O reporte deve ser rapido (< 30 segundos), com minimo de digitacao, templates por area e contexto pre-preenchido.**

---

## 2. Modelo por Area

### 2.1 Limpeza / Higienizacao

#### Fluxo Completo

```
[Acionamento] --> [Chegada] --> [Execucao] --> [Liberacao]
```

#### Campos Obrigatorios por Etapa

```typescript
interface LimpezaWorkflow {
  // --- Acionamento ---
  acionamento: {
    tipo_limpeza: 'terminal' | 'concorrente' | 'imediata' | 'area_critica' | 'desinfeccao';
    local: string;                      // Leito, sala, area
    motivo: 'alta' | 'obito' | 'transferencia' | 'contaminacao' | 'rotina' | 'isolamento';
    prioridade: 'urgente' | 'rotina';
    solicitante_id: string;             // Quem acionou (enfermeiro, sistema)
    isolamento?: boolean;               // Precaucao de isolamento?
    tipo_isolamento?: 'contato' | 'respiratorio' | 'aerossol' | 'goticulaa';
    timestamp: string;
  };

  // --- Chegada ---
  chegada: {
    profissional_id: string;
    timestamp: string;
    tempo_resposta_minutos: number;      // Calculado automaticamente
    sla_cumprido: boolean;               // Terminal: 60min, Concorrente: 30min
  };

  // --- Execucao ---
  execucao: {
    produtos_utilizados: string[];       // Lista padrao por tipo
    tecnica: string;                     // Conforme protocolo
    epi_utilizado: string[];             // EPI conforme precaucao
    checklist_completo: boolean;         // Checklist por tipo de limpeza
    observacoes?: string;
    inicio: string;
    fim: string;
    duracao_minutos: number;
  };

  // --- Liberacao ---
  liberacao: {
    liberado_por: string;               // ID do profissional de limpeza
    conferido_por?: string;             // Supervisor (quando aplicavel)
    timestamp: string;
    status_final: 'liberado' | 'pendencia' | 'retrabalho';
    pendencias?: string[];
  };
}
```

#### SLA

| Tipo | SLA Resposta | SLA Conclusao | Alerta | Escalacao |
|---|---|---|---|---|
| Terminal | 15 min | 60 min | 75% SLA | Supervisor |
| Concorrente | 10 min | 30 min | 75% SLA | Supervisor |
| Imediata | 5 min | 15 min | 50% SLA | Supervisor |
| Area critica | 10 min | 45 min | 50% SLA | Coordenador |
| Desinfeccao | 15 min | 90 min | 75% SLA | SCIH |

---

### 2.2 Manutencao

#### Fluxo Completo

```
[Chamado] --> [Inicio] --> [Execucao] --> [Conclusao]
                                              |
                                   [Indisponibilidade?] --> [Registro]
```

#### Campos Obrigatorios por Etapa

```typescript
interface ManutencaoWorkflow {
  // --- Chamado ---
  chamado: {
    tipo_manutencao: 'emergencial' | 'corretiva' | 'preventiva';
    equipamento_id?: string;            // ID do patrimonio
    equipamento_tipo: string;           // Tipo do equipamento
    local: string;                      // Onde esta
    defeito_relatado: string;           // Descricao do problema
    impacto_assistencial: 'critico' | 'alto' | 'medio' | 'baixo';
    solicitante_id: string;
    timestamp: string;
  };

  // --- Inicio ---
  inicio: {
    tecnico_id: string;
    timestamp: string;
    tempo_resposta_minutos: number;
    diagnostico_preliminar: string;
    pecas_necessarias?: string[];
    previsao_conclusao?: string;
  };

  // --- Execucao ---
  execucao: {
    servico_realizado: string;
    pecas_utilizadas?: string[];
    tecnica: string;
    inicio: string;
    fim: string;
    duracao_minutos: number;
  };

  // --- Conclusao ---
  conclusao: {
    status_final: 'resolvido' | 'paliativo' | 'pendente_peca' | 'substituicao_necessaria';
    teste_realizado: boolean;
    equipamento_operacional: boolean;
    observacoes?: string;
    timestamp: string;
  };

  // --- Indisponibilidade (se aplicavel) ---
  indisponibilidade?: {
    equipamento_id: string;
    motivo: string;
    inicio: string;
    previsao_retorno?: string;
    alternativa_disponibilizada?: string;
    areas_impactadas: string[];
    comunicado_para: string[];          // Quem foi avisado
  };
}
```

#### SLA

| Tipo | SLA Resposta | SLA Conclusao | Escalacao |
|---|---|---|---|
| Emergencial | 15 min | 2h | Coordenador -> Direcao |
| Corretiva | 1h | 4h | Supervisor |
| Preventiva | N/A (agendada) | Conforme agenda | Supervisor |

---

### 2.3 Transporte Interno

#### Fluxo Completo

```
[Acionamento] --> [Aceite] --> [Saida] --> [Chegada] --> [Transferencia Custodia]
```

#### Campos Obrigatorios por Etapa

```typescript
interface TransporteWorkflow {
  // --- Acionamento ---
  acionamento: {
    tipo_transporte: 'urgente' | 'rotina' | 'agendado';
    paciente_id: string;                // ID do paciente (sem dados clinicos)
    origem: string;                     // Local de origem
    destino: string;                    // Local de destino
    motivo: 'exame' | 'cirurgia' | 'transferencia' | 'alta' | 'outro';
    restricoes: TransporteRestricoes;
    prioridade: 'imediata' | 'urgente' | 'rotina';
    solicitante_id: string;
    timestamp: string;
  };

  // --- Aceite ---
  aceite: {
    maqueiro_id: string;
    timestamp: string;
    tempo_aceite_minutos: number;
    previsao_saida?: string;
  };

  // --- Saida ---
  saida: {
    timestamp: string;
    acompanhantes: string[];            // IDs de acompanhantes (enfermeiro, familiar)
    equipamentos: string[];             // O2, bomba, monitor
    custodia_recebida_de: string;       // De quem recebeu o paciente
    aceite_custodia: boolean;           // Aceite explicito
  };

  // --- Chegada ---
  chegada: {
    timestamp: string;
    tempo_total_minutos: number;
    condicao_paciente: 'estavel' | 'intercorrencia';
    intercorrencia_descricao?: string;
  };

  // --- Transferencia Custodia ---
  transferencia_custodia: {
    entregue_para: string;              // ID de quem recebeu
    aceite_custodia: boolean;           // Aceite explicito no destino
    timestamp: string;
    observacoes?: string;
  };
}

interface TransporteRestricoes {
  oxigenio: boolean;
  maca: boolean;
  cadeira_rodas: boolean;
  isolamento: boolean;
  tipo_isolamento?: string;
  monitor_transporte: boolean;
  bomba_infusao: boolean;
  acompanhante_obrigatorio: boolean;
  jejum: boolean;
}
```

#### SLA

| Tipo | SLA Aceite | SLA Saida | SLA Total | Escalacao |
|---|---|---|---|---|
| Imediata | 3 min | 5 min | 15 min | Supervisor -> Coordenador |
| Urgente | 5 min | 10 min | 30 min | Supervisor |
| Rotina | 10 min | 20 min | 45 min | Supervisor |
| Agendado | N/A | Conforme agenda | +/- 15 min | Supervisor |

---

### 2.4 Seguranca

#### Fluxo

```
[Ocorrencia] --> [Contencao] --> [Apoio] --> [Registro Final]
```

#### Campos Obrigatorios

```typescript
interface SegurancaWorkflow {
  ocorrencia: {
    tipo: 'agressao' | 'furto' | 'invasao' | 'incendio' | 'ameaca' | 'contencao_paciente' | 'apoio_equipe' | 'outro';
    local: string;
    descricao: string;
    envolvidos: string[];               // Descricao generica (sem dados clinicos)
    gravidade: 'critica' | 'alta' | 'media' | 'baixa';
    policia_acionada: boolean;
    timestamp: string;
    agente_id: string;
  };

  contencao?: {
    acoes_tomadas: string[];
    apoio_solicitado: string[];
    timestamp_inicio: string;
    timestamp_fim?: string;
  };

  registro_final: {
    desfecho: string;
    boletim_ocorrencia?: string;
    fotos?: boolean;
    testemunhas?: string[];
    encaminhamentos: string[];
    timestamp: string;
  };
}
```

---

### 2.5 TI

#### Fluxo

```
[Incidente] --> [Indisponibilidade?] --> [Correcao] --> [Impacto]
```

#### Campos Obrigatorios

```typescript
interface TIWorkflow {
  incidente: {
    tipo: 'sistema' | 'rede' | 'hardware' | 'seguranca' | 'integracao' | 'performance';
    sistema_afetado: string;
    descricao: string;
    severidade: 'critica' | 'alta' | 'media' | 'baixa';
    areas_impactadas: string[];
    usuarios_impactados_estimativa: number;
    reportado_por?: string;
    timestamp: string;
    tecnico_id: string;
  };

  indisponibilidade?: {
    sistema: string;
    inicio: string;
    fim?: string;
    duracao_minutos?: number;
    workaround?: string;
    comunicado_enviado: boolean;
    comunicado_para: string[];
  };

  correcao: {
    acao_realizada: string;
    causa_raiz?: string;
    categoria_causa: 'software' | 'hardware' | 'rede' | 'configuracao' | 'capacidade' | 'externo';
    permanente: boolean;                // Correcao definitiva ou paliativa
    timestamp: string;
  };

  impacto: {
    pacientes_afetados: boolean;
    dados_perdidos: boolean;
    tempo_indisponibilidade_minutos: number;
    custo_estimado?: number;
    plano_prevencao?: string;
    post_mortem_necessario: boolean;
  };
}
```

---

### 2.6 Central de Leitos

#### Fluxo

```
[Pedido] --> [Priorizacao] --> [Alocacao] --> [Bloqueio?] --> [Liberacao]
```

#### Campos Obrigatorios

```typescript
interface CentralLeitosWorkflow {
  pedido_vaga: {
    tipo_leito: 'uti' | 'semi' | 'enfermaria' | 'isolamento' | 'pediatrico' | 'obstetrico';
    especialidade: string;
    prioridade: 'emergencia' | 'urgente' | 'eletiva';
    origem: string;                     // De onde vem o paciente
    paciente_id: string;                // Sem dados clinicos
    necessidades_especiais?: string[];  // Isolamento, O2, monitoracao
    solicitante_id: string;
    timestamp: string;
  };

  priorizacao: {
    posicao_fila: number;
    criterio: string;
    regulador_id?: string;
    timestamp: string;
  };

  alocacao: {
    leito_id: string;
    unidade: string;
    responsavel_alocacao: string;
    timestamp: string;
    previsao_preparo?: string;
  };

  bloqueio?: {
    leito_id: string;
    motivo: 'manutencao' | 'limpeza' | 'reforma' | 'isolamento' | 'interdicao';
    inicio: string;
    previsao_liberacao?: string;
    responsavel: string;
  };

  liberacao: {
    leito_id: string;
    tipo_liberacao: 'alta' | 'transferencia' | 'obito' | 'manutencao_concluida';
    limpeza_status: 'pendente' | 'em_andamento' | 'concluida';
    disponivel_em?: string;
    responsavel: string;
    timestamp: string;
  };
}
```

---

## 3. UX Simplificada para Reporte Nao-Clinico

### 3.1 Principios de Design

```typescript
interface NonClinicalReportingUX {
  // Principio 1: Maximo 3 toques para registrar acao
  max_taps_to_report: 3;

  // Principio 2: Contexto pre-preenchido
  prefill: {
    profissional: 'auto';               // Do login
    unidade: 'auto';                    // Da sessao
    turno: 'auto';                      // Do turno vigente
    local: 'auto_or_select';            // GPS/NFC ou selecao rapida
    timestamp: 'auto';                  // Momento do registro
  };

  // Principio 3: Templates por area
  templates: {
    limpeza: LimpezaTemplate[];
    manutencao: ManutencaoTemplate[];
    transporte: TransporteTemplate[];
    seguranca: SegurancaTemplate[];
  };

  // Principio 4: Botoes grandes, texto minimo
  ui_guidelines: {
    min_button_size: '48dp';
    font_size_min: '16sp';
    contrast_ratio_min: 4.5;
    offline_capable: true;
    language: 'pt-BR';
    literacy_level: 'basico';           // Vocabulario simples
  };

  // Principio 5: Funciona offline com sync
  offline: {
    local_storage: true;
    sync_on_reconnect: true;
    max_offline_events: 100;
    conflict_resolution: 'server_wins';
  };
}
```

### 3.2 Templates de Reporte Rapido

```typescript
interface QuickReportTemplate {
  template_id: string;
  area: string;
  name: string;
  icon: string;
  prefilled_fields: Record<string, unknown>;
  required_input: string[];             // Campos que o usuario DEVE preencher
  optional_input: string[];             // Campos opcionais
  estimated_time_seconds: number;       // Tempo estimado para completar
}

const limpezaTemplates: QuickReportTemplate[] = [
  {
    template_id: 'LIMP-001',
    area: 'limpeza',
    name: 'Limpeza Terminal Concluida',
    icon: 'spray-can',
    prefilled_fields: {
      tipo_limpeza: 'terminal',
      category: 'higiene',
      event_type: 'liberacao_limpeza',
    },
    required_input: ['local'],          // Apenas selecionar o local
    optional_input: ['observacoes'],
    estimated_time_seconds: 10,
  },
  {
    template_id: 'LIMP-002',
    area: 'limpeza',
    name: 'Limpeza Concorrente OK',
    icon: 'broom',
    prefilled_fields: {
      tipo_limpeza: 'concorrente',
      category: 'higiene',
      event_type: 'liberacao_limpeza',
    },
    required_input: ['local'],
    optional_input: [],
    estimated_time_seconds: 8,
  },
  {
    template_id: 'LIMP-003',
    area: 'limpeza',
    name: 'Chegada no Local',
    icon: 'location-pin',
    prefilled_fields: {
      category: 'higiene',
      event_type: 'chegada_limpeza',
    },
    required_input: ['local'],
    optional_input: [],
    estimated_time_seconds: 5,
  },
];

const transporteTemplates: QuickReportTemplate[] = [
  {
    template_id: 'TRANS-001',
    area: 'transporte',
    name: 'Aceitar Transporte',
    icon: 'truck',
    prefilled_fields: {
      category: 'transporte',
      event_type: 'aceite_transporte',
    },
    required_input: [],                 // Aceite do acionamento recebido
    optional_input: ['previsao'],
    estimated_time_seconds: 3,
  },
  {
    template_id: 'TRANS-002',
    area: 'transporte',
    name: 'Paciente Entregue',
    icon: 'check-circle',
    prefilled_fields: {
      category: 'transporte',
      event_type: 'transferencia_custodia',
    },
    required_input: ['entregue_para'],  // Selecionar quem recebeu
    optional_input: ['observacoes'],
    estimated_time_seconds: 10,
  },
];

const manutencaoTemplates: QuickReportTemplate[] = [
  {
    template_id: 'MAN-001',
    area: 'manutencao',
    name: 'Inicio Reparo',
    icon: 'wrench',
    prefilled_fields: {
      category: 'manutencao',
      event_type: 'inicio_manutencao',
    },
    required_input: ['local', 'equipamento'],
    optional_input: ['diagnostico'],
    estimated_time_seconds: 15,
  },
  {
    template_id: 'MAN-002',
    area: 'manutencao',
    name: 'Reparo Concluido',
    icon: 'check-wrench',
    prefilled_fields: {
      category: 'manutencao',
      event_type: 'conclusao_manutencao',
    },
    required_input: ['status_final'],
    optional_input: ['observacoes'],
    estimated_time_seconds: 10,
  },
];
```

### 3.3 Tela de Reporte Rapido (Wireframe Descritivo)

```
+--------------------------------------------+
|  [Avatar] Maria Santos - Higienizacao      |
|  Turno: Diurno | UTI Adulto               |
+--------------------------------------------+
|                                            |
|  O que voce esta fazendo?                  |
|                                            |
|  +------------------+ +------------------+ |
|  |  [spray-can]     | |  [broom]         | |
|  |  Limpeza         | |  Limpeza         | |
|  |  Terminal         | |  Concorrente     | |
|  |  Concluida       | |  OK              | |
|  +------------------+ +------------------+ |
|                                            |
|  +------------------+ +------------------+ |
|  |  [location-pin]  | |  [alert]         | |
|  |  Chegada         | |  Limpeza         | |
|  |  no Local        | |  Imediata        | |
|  +------------------+ +------------------+ |
|                                            |
|  +------------------+ +------------------+ |
|  |  [hazard]        | |  [clipboard]     | |
|  |  Area            | |  Outro           | |
|  |  Critica         | |  (form completo) | |
|  +------------------+ +------------------+ |
|                                            |
|  [Historico do Turno: 12 registros]        |
+--------------------------------------------+
```

---

## 4. Regras de Reporte por Area

### 4.1 Tabela de Obrigatoriedade

| Area | Evento Minimo por Turno | Campos Minimos | SLA Monitorado | Handoff Obrigatorio |
|---|---|---|---|---|
| Limpeza | 1 por acionamento | tipo, local, horarios | Sim | Sim (liberacao) |
| Manutencao | 1 por chamado | equipamento, local, status | Sim | Sim (conclusao) |
| Transporte | 1 por transporte | paciente, origem, destino, horarios | Sim | Sim (custodia) |
| Seguranca | 1 por ocorrencia | tipo, local, descricao | Nao | Sim (registro final) |
| TI | 1 por incidente | sistema, descricao, impacto | Sim | Sim (correcao) |
| Central Leitos | 1 por pedido/alocacao | tipo_leito, local, status | Sim | Sim (alocacao) |
| Recepcao | 1 por atendimento | paciente, tipo, horario | Sim (espera) | Nao |
| Farmacia Logistica | 1 por dispensacao | medicamento, destino | Sim | Sim (entrega) |
| Nutricao Operacional | 1 por refeicao | tipo_dieta, destino | Sim | Sim (entrega) |
| Rouparia | 1 por distribuicao | tipo, quantidade, destino | Nao | Nao |
| Almoxarifado | 1 por requisicao | material, quantidade, solicitante | Nao | Sim (entrega) |

### 4.2 Excecoes e Desvios

```typescript
interface NonClinicalExceptionHandling {
  rules: ExceptionRule[];
}

const exceptionRules: ExceptionRule[] = [
  {
    rule_id: 'NCE-001',
    area: 'limpeza',
    exception: 'Limpeza nao pode ser realizada',
    required_fields: ['motivo', 'alternativa', 'previsao'],
    escalation: 'supervisor_higienizacao',
    notification: ['enfermeiro_unidade'],
  },
  {
    rule_id: 'NCE-002',
    area: 'transporte',
    exception: 'Transporte recusado',
    required_fields: ['motivo', 'restricao_encontrada'],
    escalation: 'supervisor_transporte',
    notification: ['enfermeiro_solicitante'],
  },
  {
    rule_id: 'NCE-003',
    area: 'manutencao',
    exception: 'Equipamento irreparavel',
    required_fields: ['diagnostico', 'alternativa', 'prazo_substituicao'],
    escalation: 'coordenador_manutencao',
    notification: ['admin_unidade', 'ti_patrimonio'],
  },
  {
    rule_id: 'NCE-004',
    area: 'central_leitos',
    exception: 'Sem vaga disponivel',
    required_fields: ['tipo_solicitado', 'alternativas_avaliadas', 'previsao'],
    escalation: 'regulacao_medica',
    notification: ['medico_solicitante', 'admin_unidade'],
  },
  {
    rule_id: 'NCE-005',
    area: 'ti',
    exception: 'Indisponibilidade prolongada (>1h)',
    required_fields: ['sistema', 'causa', 'workaround', 'previsao'],
    escalation: 'gerente_ti',
    notification: ['todos_gestores_areas_impactadas'],
  },
];

interface ExceptionRule {
  rule_id: string;
  area: string;
  exception: string;
  required_fields: string[];
  escalation: string;
  notification: string[];
}
```

---

## 5. NATS Subjects Nao-Clinicos

```yaml
subjects:
  # Limpeza
  - "velya.work.higiene.acionamento_limpeza"
  - "velya.work.higiene.chegada_limpeza"
  - "velya.work.higiene.execucao_limpeza"
  - "velya.work.higiene.liberacao_limpeza"

  # Manutencao
  - "velya.work.manutencao.chamado_manutencao"
  - "velya.work.manutencao.inicio_manutencao"
  - "velya.work.manutencao.conclusao_manutencao"
  - "velya.work.manutencao.indisponibilidade_equipamento"

  # Transporte
  - "velya.work.transporte.acionamento_transporte"
  - "velya.work.transporte.aceite_transporte"
  - "velya.work.transporte.saida_transporte"
  - "velya.work.transporte.chegada_transporte"
  - "velya.work.transporte.transferencia_custodia"

  # Seguranca
  - "velya.work.seguranca.ocorrencia_seguranca"
  - "velya.work.seguranca.contencao_seguranca"

  # TI
  - "velya.work.ti.incidente_ti"
  - "velya.work.ti.indisponibilidade_sistema"
  - "velya.work.ti.correcao_ti"

  # Central Leitos
  - "velya.work.operacional.pedido_vaga"
  - "velya.work.operacional.alocacao_vaga"
  - "velya.work.operacional.bloqueio_leito"
  - "velya.work.operacional.liberacao_leito"
```

---

## 6. Metricas

```yaml
metrics:
  - name: velya_non_clinical_report_time_seconds
    type: histogram
    labels: [area, template_id]
    buckets: [3, 5, 10, 15, 20, 30, 45, 60]
    help: "Tempo para completar reporte nao-clinico em segundos"

  - name: velya_non_clinical_template_usage
    type: counter
    labels: [area, template_id]
    help: "Uso de templates de reporte rapido"

  - name: velya_non_clinical_offline_events
    type: counter
    labels: [area]
    help: "Eventos registrados offline e sincronizados depois"

  - name: velya_non_clinical_sla_compliance
    type: gauge
    labels: [area, tipo]
    help: "Taxa de conformidade SLA nao-clinico"

  - name: velya_non_clinical_exceptions_total
    type: counter
    labels: [area, exception_type]
    help: "Total de excecoes registradas por area nao-clinica"
```

---

## 7. Resumo

O modelo de reporte nao-clinico garante:

1. **Reporte em < 30 segundos** — Templates pre-preenchidos, botoes grandes, poucos toques.
2. **Sem acesso clinico** — Profissional operacional nao ve dados clinicos.
3. **Cada area tem fluxo definido** — Etapas claras com campos obrigatorios por fase.
4. **SLA monitorado** — Cada etapa tem SLA e escalacao.
5. **Excecoes estruturadas** — Desvios registrados com motivo e escalacao.
6. **Funciona offline** — Sync automatico ao reconectar.
7. **Handoff com custodia** — Transporte e entregas com aceite explicito.
