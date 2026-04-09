# Patient Timeline UX Model - Pagina de Detalhes do Paciente

> Velya Platform - Documentacao Tecnica
> Ultima atualizacao: 2026-04-08
> Status: Especificacao Ativa

---

## 1. Visao Geral

A pagina de detalhes do paciente e o ponto central de visualizacao da jornada.
Ela apresenta uma visao completa, auditavel e acionavel de tudo que aconteceu,
esta acontecendo e deveria acontecer com o paciente durante sua internacao.

### Principios de UX

| Principio | Descricao |
|---|---|
| **Action-First** | Itens que requerem acao aparecem primeiro e com destaque |
| **Context-First** | Cada evento mostra quem, quando, onde, por que — sem clique adicional |
| **Progressive Disclosure** | Nivel 1: resumo. Nivel 2: detalhes. Nivel 3: proveniencia/auditoria |
| **Critical Now** | Alertas criticos sempre visiveis, nunca enterrados |
| **Zero Ambiguity** | Autoria e horario sempre explicitos — nunca "sistema" sem detalhamento |
| **Temporal Clarity** | Distinguir visualmente "quando aconteceu" vs "quando foi registrado" |
| **Confidence Visual** | Indicadores de confianca/completude em cada segmento da timeline |

---

## 2. Estrutura da Pagina

### 2.1 Layout Geral

```
+------------------------------------------------------------------------+
|  HEADER: Nome | Idade | Leito | Internacao | Alergias | Isolamento     |
+------------------------------------------------------------------------+
|                                                                        |
|  +---------------------------+  +-----------------------------------+  |
|  |                           |  |                                   |  |
|  |  EXECUTIVE SUMMARY        |  |  RESPONSAVEIS ATUAIS             |  |
|  |  (Estado atual compacto)  |  |  Medico | Enfermeiro | Turno      |  |
|  |                           |  |                                   |  |
|  +---------------------------+  +-----------------------------------+  |
|                                                                        |
|  +---------------------------+  +-----------------------------------+  |
|  |                           |  |                                   |  |
|  |  ALERTAS E PENDENCIAS     |  |  INDICADORES RAPIDOS              |  |
|  |  (Itens que requerem acao)|  |  Dor | Chamados | Gaps | Score    |  |
|  |                           |  |                                   |  |
|  +---------------------------+  +-----------------------------------+  |
|                                                                        |
|  +----------------------------------------------+  +-----------------+|
|  |                                              |  |                 ||
|  |  TIMELINE PRINCIPAL                          |  |  SIDEBAR        ||
|  |  (Filtros: tipo, papel, categoria, hora)     |  |  CONTEXTUAL     ||
|  |                                              |  |                 ||
|  |  [=====] Evento 1 - 14:35                    |  |  Proveniencia   ||
|  |  [=====] Evento 2 - 14:22                    |  |  Auditoria      ||
|  |  [=====] Evento 3 - 13:58                    |  |  Correcoes      ||
|  |  [=====] Evento 4 - 13:45                    |  |  Analytics      ||
|  |  ...                                         |  |  Criticos       ||
|  |                                              |  |                 ||
|  +----------------------------------------------+  +-----------------+|
|                                                                        |
|  +----------------------------------------------+                     |
|  |  TIMELINES ESPECIALIZADAS (Tabs)             |                     |
|  |  [Medicacao] [Chamados/Dor] [Handoff]        |                     |
|  +----------------------------------------------+                     |
|                                                                        |
+------------------------------------------------------------------------+
```

---

## 3. Componentes Detalhados

### 3.1 Header do Paciente

Sempre visivel no topo, fixo ao scroll.

```
+------------------------------------------------------------------------+
| [Avatar]  MARIA SILVA SANTOS  |  67 anos  |  F  |  MRN: 2026-04081    |
|                                                                        |
| Leito: CM-412A  |  Internada: 05/04/2026 (3 dias)  |  Previsao Alta: -|
|                                                                        |
| Alergias: [!] Penicilina (severa)  [!] Dipirona (moderada)            |
| Isolamento: [x] Contato  |  Risco Queda: [!] Alto                     |
| Diagnostico: Pneumonia Comunitaria Grave (J18.9)                       |
+------------------------------------------------------------------------+
```

**Regras do Header:**
- Alergias severas sempre com badge vermelho pulsante
- Isolamento com icone visual distinto
- Risco de queda alto com indicador permanente
- Tempo de internacao calculado automaticamente
- Se previsao de alta nao definida, mostrar "-" (nunca omitir o campo)

### 3.2 Resumo Executivo (Executive Summary)

Snapshot compacto do estado atual do paciente — atualizado em tempo real.

```typescript
interface ExecutiveSummaryComponent {
  // Dados exibidos
  current_state: {
    label: string;         // "Estavel", "Em observacao", "Critico"
    color: 'green' | 'yellow' | 'orange' | 'red';
    since: string;
  };

  latest_vitals_summary: {
    news_score: number;
    news_trend: 'improving' | 'stable' | 'worsening';
    last_collected: string;
    collector: string;
  };

  pain_current: {
    score: number | null;
    trend: string;
    last_assessed: string;
    reassessment_overdue: boolean;
  };

  active_orders_count: number;
  pending_results_count: number;
  open_calls_count: number;
  next_scheduled_action: {
    description: string;
    due_at: string;
    assigned_to: string;
  } | null;

  journey_confidence_score: number;
  documentation_completeness: number;
}
```

**Wireframe do Resumo Executivo:**

```
+---------------------------------------------------------------+
|  ESTADO ATUAL                                                  |
|  +------------------+  +------------------+  +---------------+ |
|  | [GREEN] Estavel  |  | NEWS: 3 (estavel)|  | Dor: 4/10    | |
|  | desde 08:00      |  | 13:45 - Enf.Ana  |  | (melhorando) | |
|  +------------------+  +------------------+  +---------------+ |
|                                                                |
|  Prescricoes ativas: 8  |  Resultados pendentes: 2            |
|  Chamados abertos: 0    |  Proxima acao: Amoxicilina 18:00    |
|                                                                |
|  Confianca Timeline: [========--] 82%                          |
|  Completude Doc.:    [==========-] 91%                         |
+---------------------------------------------------------------+
```

### 3.3 Responsaveis Atuais

```
+-----------------------------------------------+
|  RESPONSAVEIS ATUAIS                           |
|                                                |
|  Medico Assistente:                            |
|    Dr. Carlos Mendes (CRM 12345)               |
|    Desde: 05/04/2026                           |
|                                                |
|  Enfermeiro Responsavel:                       |
|    Enf. Ana Paula (COREN 67890)                |
|    Turno: Tarde (12:00 - 18:00)                |
|    Assumiu: 08/04/2026 12:05                   |
|                                                |
|  Ultimo Handoff:                               |
|    Enf. Roberto -> Enf. Ana Paula              |
|    12:05 - Aceito em 3 min                     |
|    [Ver detalhes]                              |
|                                                |
|  [!] Sem fisioterapeuta designado              |
+-----------------------------------------------+
```

**Regras:**
- Se handoff pendente sem aceitacao, mostrar badge de alerta laranja
- Se nao ha responsavel definido para alguma funcao esperada, mostrar gap em vermelho
- Clicar no nome do responsavel expande historico de custodia

### 3.4 Alertas e Pendencias

Ordenados por severidade e urgencia. Sempre visivel.

```
+---------------------------------------------------------------+
|  ALERTAS E PENDENCIAS                                [3 itens] |
|                                                                |
|  [!!! CRITICO] Resultado de hemocultura pendente               |
|    ha 4h | Solicitado por Dr. Mendes | Sem visualizacao        |
|    [Abrir resultado] [Marcar como visto]                       |
|                                                                |
|  [!! ALTO] Medicacao com atraso > 30 min                       |
|    Amoxicilina 500mg prevista 14:00, nao administrada          |
|    Responsavel: Enf. Ana Paula                                 |
|    [Registrar administracao] [Justificar]                      |
|                                                                |
|  [! MEDIO] Reavaliacao de dor em atraso                        |
|    Ultima avaliacao: 10:30 (dor 6/10)                          |
|    Intervencao realizada, reavaliacao devida 12:30             |
|    [Registrar reavaliacao]                                     |
+---------------------------------------------------------------+
```

**Regras de Pendencias:**
- Critico: fundo vermelho claro, borda vermelha, icone pulsante
- Alto: fundo laranja claro, borda laranja
- Medio: fundo amarelo claro, borda amarela
- Baixo: fundo cinza claro
- Cada pendencia tem botoes de acao diretos (nao exigir navegacao extra)
- Pendencias resolvidas saem da lista mas ficam na timeline com marca de resolucao

### 3.5 Indicadores Rapidos

```
+---------------------------------------------------------------+
|  INDICADORES RAPIDOS                                           |
|                                                                |
|  Dor Atual    Chamados Hoje   Gaps Detectados   Confianca      |
|  [  4/10  ]   [    2     ]    [     3      ]    [  82%    ]    |
|  melhorando    1 aberto        1 critico         [=======--]   |
|                                                                |
|  Medicacoes    Handoffs        Correcoes Hoje    Docs Atrasadas|
|  [ 6 de 8 ]   [ 2 ok    ]    [    1      ]     [   0      ]   |
|  on track      sem gap         timing fix        [==========]  |
+---------------------------------------------------------------+
```

---

## 4. Timeline Principal

### 4.1 Barra de Filtros

```
+---------------------------------------------------------------+
|  TIMELINE DO PACIENTE                                          |
|                                                                |
|  Filtros:                                                      |
|  [Tipo: Todos v]  [Papel: Todos v]  [Categoria: Todas v]     |
|  [Periodo: Hoje v]  [Relevancia: Todas v]                     |
|  [x] Mostrar inferidos  [x] Mostrar sistema  [ ] So criticos  |
|                                                                |
|  Busca: [____________________________] [Buscar]               |
+---------------------------------------------------------------+
```

**Filtros disponiveis:**

```typescript
interface TimelineFilters {
  event_types: string[];           // Filtro por tipo de evento
  roles: AuthoredRole[];           // Filtro por papel do autor
  categories: EventCategory[];     // Filtro por categoria
  period: {
    preset: 'last_1h' | 'last_4h' | 'last_8h' | 'last_12h'
          | 'today' | 'yesterday' | 'last_3d' | 'last_7d'
          | 'all' | 'custom';
    custom_start?: string;
    custom_end?: string;
  };
  clinical_relevance: ClinicalRelevance[];
  show_inferred: boolean;
  show_system: boolean;
  show_corrected: boolean;
  only_critical: boolean;
  search_text: string;
  source_system: SourceSystem[];
}
```

### 4.2 Evento na Timeline - Nivel 1 (Compacto)

```
+---------------------------------------------------------------+
|  14:35  [MED]  Amoxicilina 500mg administrada (VO)             |
|         Enf. Ana Paula | Atraso: 35 min | Confianca: 85%      |
|         [Expandir] [Proveniencia] [Auditoria]                  |
+---------------------------------------------------------------+
|  14:22  [VITAL] Sinais vitais coletados                        |
|         Tec. Roberto | NEWS: 3 (estavel) | FC:82 PA:130/85    |
|         [Expandir] [Proveniencia]                              |
+---------------------------------------------------------------+
|  13:58  [CALL] Chamado de dor atendido                         |
|         Paciente -> Enf. Ana Paula | Resposta: 4 min           |
|         [Expandir] [Ver chamado completo]                      |
+---------------------------------------------------------------+
|  13:45  [DOR]  Avaliacao de dor: 6/10 (piorando)              |
|  !!!    Enf. Ana Paula | Intervencao: Dipirona prescrita       |
|         [Expandir] [Reavaliacao pendente]                      |
+---------------------------------------------------------------+
|  13:30  [GAP]  Gap detectado: Reavaliacao de dor em atraso     |
|  ~~~    Sistema (regra: pain_reassessment_overdue)             |
|         Confianca: 92% | [Ver regra] [Resolver]               |
+---------------------------------------------------------------+
```

**Regras visuais por categoria:**

| Categoria | Icone | Cor da borda | Background |
|---|---|---|---|
| clinical | Cruz verde | Verde | Branco |
| operational | Engrenagem | Azul | Branco |
| administrative | Documento | Cinza | Branco |
| communication | Balao | Roxo | Branco |
| device | Monitor | Azul escuro | Branco |
| security | Cadeado | Cinza escuro | Cinza claro |
| system | Servidor | Cinza | Cinza claro |
| inferred | Lupa + onda | Laranja | Amarelo claro |
| corrected | Lapis | Amarelo | Amarelo claro |
| automated | Raio | Ciano | Branco |

**Indicadores especiais na linha do evento:**
- `!!!` = Relevancia critica (fundo vermelho claro)
- `!!` = Relevancia alta (fundo laranja claro)
- `~~~` = Evento inferido por regra/IA
- `[C]` = Evento que teve correcao posterior
- `[S]` = Evento superseded (riscado, com link para versao atual)
- `[LATE]` = Documentacao tardia (> 30 min entre occurred_at e recorded_at)

### 4.3 Evento na Timeline - Nivel 2 (Expandido)

Ao clicar em "Expandir", o evento abre um painel inline:

```
+---------------------------------------------------------------+
|  14:35  [MED]  Amoxicilina 500mg administrada (VO)             |
|  ---------------------------------------------------------------
|  |                                                             |
|  |  DETALHES DA ADMINISTRACAO                                  |
|  |                                                             |
|  |  Medicamento:    Amoxicilina 500mg                          |
|  |  Dose:           500 mg via oral                            |
|  |  Horario previsto: 14:00                                    |
|  |  Horario real:    14:35 (atraso: 35 min)                    |
|  |                                                             |
|  |  Prescrito por:  Dr. Carlos Mendes (CRM 12345)              |
|  |  Administrado por: Enf. Ana Paula (COREN 67890)             |
|  |  Dupla checagem: Nao realizada                              |
|  |                                                             |
|  |  Estado do paciente antes: Consciente, orientada,           |
|  |    sem queixas significativas                               |
|  |  Dor antes: 4/10                                            |
|  |                                                             |
|  |  Lote: LOT2026A | Validade: 30/06/2027                     |
|  |                                                             |
|  |  Contexto FHIR:                                             |
|  |    MedicationAdministration/ma-001                          |
|  |    MedicationRequest/mr-001                                 |
|  |    Provenance/prov-ma-001                                   |
|  |                                                             |
|  |  [Ver no FHIR] [Imprimir] [Exportar]                       |
|  |                                                             |
|  ---------------------------------------------------------------
+---------------------------------------------------------------+
```

### 4.4 Evento na Timeline - Nivel 3 (Proveniencia/Auditoria)

Abre na sidebar contextual:

```typescript
interface ProvenanceSidebarData {
  event_id: string;
  event_type: string;

  provenance: {
    fhir_provenance_id: string;
    recorded_at: string;
    agent: Array<{
      who: string;
      role: string;
      on_behalf_of?: string;
    }>;
    entity: Array<{
      what: string;
      role: 'source' | 'derivation' | 'revision' | 'quotation' | 'removal';
    }>;
    activity: string;
    reason: string;
    signature?: {
      type: string;
      when: string;
      who: string;
      data: string;
    };
  };

  audit_trail: Array<{
    action: string;
    by: string;
    at: string;
    details: string;
  }>;

  integrity: {
    hash: string;
    hash_verified: boolean;
    chain_valid: boolean;
  };

  corrections: Array<{
    corrected_at: string;
    corrected_by: string;
    reason: string;
    original_value: string;
    new_value: string;
  }>;
}
```

---

## 5. Timelines Especializadas

### 5.1 Timeline de Medicacao

```
+---------------------------------------------------------------+
|  TIMELINE DE MEDICACAO                                         |
|                                                                |
|  Filtro: [Todos v] [Hoje v] [Status: Todos v]                |
|                                                                |
|  AMOXICILINA 500mg - VO - 8/8h                                |
|  Prescrito: Dr. Mendes | Inicio: 05/04 | Status: Ativa        |
|  +---+---+---+---+---+---+---+---+---+---+---+---+---+       |
|  | 06| 08| 10| 12| 14| 16| 18| 20| 22| 00| 02| 04| 06|      |
|  | . | OK| . | . | !D| . | -- | . | OK| . | . | . | OK|      |
|  +---+---+---+---+---+---+---+---+---+---+---+---+---+       |
|  OK=dado  !D=atraso  !M=omitido  !R=recusado  --=futuro       |
|                                                                |
|  DIPIRONA 1g - IV - SOS (Dor)                                 |
|  Prescrito: Dr. Mendes | Inicio: 06/04 | Status: Ativa (PRN)  |
|  Ultimas administracoes: 08/04 13:55, 07/04 22:10, 07/04 08:30|
|  Frequencia PRN: 3x em 48h [OK - dentro do esperado]          |
|                                                                |
|  ENOXAPARINA 40mg - SC - 1x/dia                               |
|  Prescrito: Dr. Mendes | Inicio: 05/04 | Status: Ativa        |
|  +---+---+---+---+---+---+                                    |
|  |05/4|06/4|07/4|08/4|09/4|10/4|                               |
|  | OK | OK | OK | OK | -- | -- |                               |
|  +---+---+---+---+---+---+                                    |
|  Dupla checagem: Sim (todas)                                   |
|                                                                |
+---------------------------------------------------------------+
```

```typescript
interface MedicationTimelineItem {
  prescription_id: string;
  medication_name: string;
  dose: string;
  route: string;
  frequency: string;
  is_prn: boolean;
  prescribed_by: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'suspended' | 'completed' | 'cancelled';

  schedule_slots: Array<{
    scheduled_at: string;
    status: 'given' | 'delayed' | 'missed' | 'refused' | 'held'
          | 'substituted' | 'future' | 'not_applicable';
    actual_time?: string;
    delay_minutes?: number;
    performer?: string;
    double_check?: boolean;
    notes?: string;
  }>;

  anomalies: Array<{
    type: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;

  integrity_score: number;
}
```

### 5.2 Timeline de Chamados e Dor

```
+---------------------------------------------------------------+
|  CHAMADOS E DOR                                                |
|                                                                |
|  Grafico de Dor (24h):                                         |
|  10|                                                           |
|   8|                                                           |
|   6|         *                                                 |
|   4|   *           *     *                                     |
|   2| *                         *                               |
|   0+---+---+---+---+---+---+---+---+                          |
|    06  08  10  12  14  16  18  20  22                          |
|         |              |                                       |
|    Dipirona IV    Dipirona IV                                  |
|                                                                |
|  Chamados Hoje:                                                |
|  +-----+--------+----------+---------+----------+----------+  |
|  |Hora | Tipo   | Origem   | Resp.   | T.Resp.  | Status   |  |
|  +-----+--------+----------+---------+----------+----------+  |
|  |13:54| Dor    | Botao    | Ana P.  | 4 min    | Resolvido|  |
|  |11:20| Agua   | Tablet   | Roberto | 8 min    | Resolvido|  |
|  |09:15| Posic. | Botao    | Ana P.  | 2 min    | Resolvido|  |
|  +-----+--------+----------+---------+----------+----------+  |
|                                                                |
|  Media de resposta hoje: 4.7 min                               |
|  Chamados sem resposta: 0                                      |
|  Chamados recorrentes: Posicionamento (2x em 24h)              |
+---------------------------------------------------------------+
```

```typescript
interface CallsPainTimelineComponent {
  pain_chart: {
    data_points: Array<{
      time: string;
      score: number;
      assessed_by: string;
      intervention?: string;
    }>;
    interventions: Array<{
      time: string;
      description: string;
      effect?: 'improved' | 'no_change' | 'worsened';
    }>;
  };

  calls_today: Array<{
    time: string;
    category: string;
    source: string;
    responder: string | null;
    response_time_seconds: number | null;
    resolution_time_seconds: number | null;
    status: 'resolved' | 'open' | 'abandoned' | 'redirected';
    reopened: boolean;
  }>;

  analytics: {
    avg_response_time_today: number;
    calls_without_response: number;
    recurring_categories: Array<{ category: string; count: number }>;
    pain_trend_24h: 'improving' | 'stable' | 'worsening';
    gap_pain_call_action: number; // Chamados sem acao clinica correspondente
  };
}
```

### 5.3 Timeline de Handoff

```
+---------------------------------------------------------------+
|  CADEIA DE CUSTODIA (HANDOFFS)                                 |
|                                                                |
|  Diagrama de Custodia (ultimas 48h):                           |
|                                                                |
|  07/04                          08/04                          |
|  06:00    12:00    18:00    00:00    06:00    12:00    18:00   |
|  |--------|--------|--------|--------|--------|--------|       |
|  | Enf.M  | Enf.A  | Enf.R  | Enf.C  | Enf.M  | Enf.A  |    |
|  |  OK    |  OK    |  OK    | !3min  |  OK    |  OK    |      |
|  |--------|--------|--------|--------|--------|--------|       |
|                                                                |
|  Legenda: OK = Transicao sem gap                               |
|           !Xmin = Gap de X minutos sem responsavel             |
|           [RED] = Handoff pendente/nao aceito                  |
|                                                                |
|  Detalhes do ultimo handoff:                                   |
|  +----------------------------------------------------------+ |
|  | De: Enf. Roberto Silva (Turno Manha)                      | |
|  | Para: Enf. Ana Paula (Turno Tarde)                        | |
|  | Horario: 08/04 12:02 -> Aceito: 12:05 (3 min)            | |
|  | Formato: SBAR                                             | |
|  | Pendencias transferidas: 3                                | |
|  |   - Reavaliacao de dor (MEDIO, devida 12:30)              | |
|  |   - Amoxicilina 14:00 (ALTO)                              | |
|  |   - Resultado hemocultura (CRITICO, verificar lab)        | |
|  | [Ver detalhes completos]                                  | |
|  +----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

---

## 6. Sidebar Contextual

A sidebar direita muda de conteudo conforme o contexto de interacao.

### 6.1 Painel de Proveniencia

Ativado ao clicar em "Proveniencia" em qualquer evento.

```
+-----------------------------------+
|  PROVENIENCIA                      |
|  Evento: med-admin-001            |
|                                    |
|  Recurso FHIR:                     |
|  Provenance/prov-ma-001           |
|                                    |
|  Agentes:                          |
|  - Enf. Ana Paula (executor)      |
|  - Dr. Carlos Mendes (prescritor) |
|                                    |
|  Atividade:                        |
|  MedicationAdministration          |
|                                    |
|  Entidades:                        |
|  - MedicationRequest/mr-001       |
|    (source)                        |
|  - Patient/patient-001            |
|    (target)                        |
|                                    |
|  Registrado em:                    |
|  08/04/2026 14:37:22              |
|                                    |
|  Integridade:                      |
|  Hash: sha256:a1b2...             |
|  [OK] Verificado                   |
|  [OK] Cadeia valida                |
|                                    |
|  [Ver JSON FHIR]                   |
+-----------------------------------+
```

### 6.2 Painel de Auditoria

```
+-----------------------------------+
|  TRILHA DE AUDITORIA               |
|  Evento: med-admin-001            |
|                                    |
|  Acessos:                          |
|  14:37 Enf. Ana Paula (criacao)   |
|  14:45 Dr. Mendes (visualizacao)  |
|  15:10 Farmacia (verificacao)     |
|                                    |
|  Correcoes: Nenhuma                |
|                                    |
|  Exportacoes: Nenhuma              |
|                                    |
|  Status: Ativo (v1)               |
|  Superseded por: N/A              |
+-----------------------------------+
```

### 6.3 Painel de Correcoes

```
+-----------------------------------+
|  HISTORICO DE CORRECOES            |
|  Evento: vital-signs-003          |
|                                    |
|  Versao atual: 2                   |
|  Versao original: 1               |
|                                    |
|  Correcao em 08/04 15:20:         |
|  Por: Enf. Ana Paula              |
|  Motivo: Erro de digitacao PA     |
|                                    |
|  Alteracoes:                       |
|  - PA Sistolica: 180 -> 130       |
|  - PA Diastolica: 110 -> 85       |
|                                    |
|  Delay: 55 min apos original      |
|                                    |
|  [Ver versao original]             |
|  [Ver diff completo]               |
|  [Ver Provenance da correcao]     |
+-----------------------------------+
```

### 6.4 Painel de Analytics de Chamados

```
+-----------------------------------+
|  ANALYTICS DE CHAMADOS             |
|  Periodo: Ultima 24h              |
|                                    |
|  Total de chamados: 6             |
|  Tempo medio resposta: 4.7 min    |
|  Tempo medio resolucao: 12 min    |
|                                    |
|  Por categoria:                    |
|  Dor:           2 (33%)           |
|  Posicionamento: 2 (33%)          |
|  Agua/alimento: 1 (17%)           |
|  Higiene:        1 (17%)          |
|                                    |
|  Sem resposta: 0                   |
|  Reabertas:     0                  |
|                                    |
|  Padrao: Posicionamento            |
|  recorrente - considerar           |
|  avaliacao fisioterapia            |
|                                    |
|  [Ver historico completo]          |
|  [Comparar com unidade]           |
+-----------------------------------+
```

### 6.5 Painel de Eventos Criticos

```
+-----------------------------------+
|  EVENTOS CRITICOS                  |
|  Ultimas 24h                       |
|                                    |
|  [!!!] 13:45 - Dor 6/10           |
|  (piorando) sem reavaliacao        |
|  Responsavel: Enf. Ana Paula      |
|  [Ir para evento] [Resolver]      |
|                                    |
|  [!!!] 10:15 - Hemocultura        |
|  resultado pendente analise        |
|  Responsavel: Dr. Mendes          |
|  [Ir para evento] [Marcar visto]  |
|                                    |
|  [!!] 08:00 - Gap detectado:      |
|  Handoff sem registro formal      |
|  turno noite -> manha             |
|  [Ir para evento] [Corrigir]      |
|                                    |
+-----------------------------------+
```

---

## 7. Regras de Exibicao e Comportamento

### 7.1 Ordenacao

```typescript
interface TimelineOrdering {
  // Ordenacao padrao: mais recente primeiro
  default: 'occurred_at_desc';

  // Opcoes de ordenacao
  options: [
    'occurred_at_desc',    // Mais recente primeiro (padrao)
    'occurred_at_asc',     // Mais antigo primeiro
    'recorded_at_desc',    // Ultimo registrado primeiro
    'clinical_relevance',  // Critico primeiro, depois alto, etc.
    'pending_first',       // Pendencias primeiro
  ];

  // Regra de desempate
  tiebreaker: 'sequence_number';
}
```

### 7.2 Agrupamento Temporal

```typescript
interface TimelineGrouping {
  // Agrupar eventos por janela temporal
  grouping: 'none' | 'hour' | 'shift' | 'day';

  // Dentro de cada grupo, mostrar separadores visuais
  group_header: {
    label: string;          // "08/04/2026 - Tarde (12:00-18:00)"
    event_count: number;
    shift_responsible: string;
    confidence_score: number;
  };
}
```

### 7.3 Destaque de Discrepancias Temporais

```typescript
interface TimeDiscrepancyRules {
  // Quando occurred_at e recorded_at diferem significativamente
  thresholds: {
    warning: 30 * 60,    // 30 min - badge amarelo "[LATE 30m]"
    alert: 60 * 60,      // 1 hora - badge laranja "[LATE 1h]"
    critical: 4 * 60 * 60 // 4 horas - badge vermelho "[LATE 4h+]"
  };

  // Exibicao
  display: {
    show_both_times: true,      // Sempre mostrar ambos os horarios
    highlight_delay: true,       // Destacar o atraso visualmente
    tooltip_explanation: true,   // Tooltip explicando a diferenca
  };
}
```

### 7.4 Indicadores de Confianca na Timeline

```
  Confianca do segmento temporal:

  [GREEN ========] 90-100%  Dados completos, consistentes, verificados
  [YELLOW ======--] 70-89%  Dados parciais ou com pequenas inconsistencias
  [ORANGE ====----] 50-69%  Gaps detectados ou atraso de documentacao
  [RED   ==------] 30-49%  Gaps criticos ou dados conflitantes
  [GREY  --------]  0-29%  Dados insuficientes ou nao confiaveis
```

---

## 8. Performance e Carregamento

### 8.1 Estrategia de Carregamento

```typescript
interface TimelineLoadingStrategy {
  // Carregamento inicial: ultimas 8 horas
  initial_window: '8h';

  // Paginacao: carregar mais em blocos de 4h
  pagination_size: '4h';

  // Projecoes carregadas junto com a pagina (cache Redis)
  eager_load: [
    'executive_summary',
    'current_responsible',
    'alerts_and_pending',
    'quick_indicators',
  ];

  // Timelines especializadas: lazy load ao abrir tab
  lazy_load: [
    'medication_timeline',
    'calls_pain_timeline',
    'handoff_timeline',
  ];

  // Sidebar: carrega sob demanda ao clicar
  on_demand: [
    'provenance_panel',
    'audit_panel',
    'corrections_panel',
    'analytics_panel',
  ];

  // Real-time: WebSocket para atualizacoes
  realtime: {
    connection: 'websocket',
    subscribe: [
      'patient.journey.{patient_id}.>',
    ],
    update_strategy: 'prepend_and_refresh_indicators',
    debounce_ms: 1000,
  };
}
```

### 8.2 Cache

```typescript
interface TimelineCacheStrategy {
  // Projecoes cacheadas em Redis
  redis: {
    key_pattern: 'timeline:projection:{patient_id}:{projection_type}';
    ttl_seconds: 30; // 30 segundos - refresh frequente
    invalidation: 'event_driven'; // Invalida ao receber novo evento
  };

  // Client-side cache
  client: {
    stale_while_revalidate: true;
    max_age_seconds: 10;
    background_refresh: true;
  };
}
```

---

## 9. Acessibilidade

### 9.1 Requisitos

| Requisito | Implementacao |
|---|---|
| Navegacao por teclado | Tab entre eventos, Enter para expandir, Esc para fechar |
| Leitor de tela | ARIA labels em todos os indicadores visuais e graficos |
| Contraste | WCAG AA minimo em todos os indicadores de cor |
| Zoom | Layout responsivo ate 200% sem perda de funcionalidade |
| Reducao de movimento | Opcao para desabilitar animacoes e pulsos |
| Texto alternativo | Descricao textual para todos os graficos e diagramas |

### 9.2 Atalhos de Teclado

| Atalho | Acao |
|---|---|
| `J` / `K` | Navegar entre eventos (proximo / anterior) |
| `Enter` | Expandir evento selecionado |
| `Esc` | Fechar expansao / fechar sidebar |
| `P` | Abrir painel de proveniencia do evento selecionado |
| `A` | Abrir painel de auditoria |
| `F` | Abrir filtros |
| `1` / `2` / `3` | Alternar entre timelines (Principal / Medicacao / Chamados) |
| `R` | Refresh manual |
| `?` | Mostrar ajuda de atalhos |

---

## 10. Notificacoes em Tempo Real

### 10.1 Tipos de Notificacao na Pagina

```typescript
interface TimelineNotification {
  type: 'new_event' | 'alert' | 'gap_detected' | 'handoff_pending'
      | 'call_pending' | 'medication_due' | 'result_available';

  display: {
    // Toast no topo da pagina
    toast: {
      message: string;
      severity: 'info' | 'warning' | 'critical';
      duration_ms: number; // 0 = persistente
      action_label?: string;
      action_callback?: string;
    };

    // Badge nos indicadores rapidos
    badge_update: {
      indicator: string;
      new_value: number | string;
      flash: boolean;
    };

    // Insercao na timeline
    timeline_insert: {
      position: 'top';
      highlight_duration_ms: 3000;
      auto_scroll: boolean; // So se usuario estiver no topo
    };
  };
}
```

### 10.2 Regras de Notificacao

| Evento | Toast | Badge | Som | Persistente |
|---|---|---|---|---|
| Resultado critico | Sim (vermelho) | Sim | Sim | Sim |
| Chamado do paciente | Sim (roxo) | Sim | Sim | Ate resposta |
| Gap detectado (critico) | Sim (laranja) | Sim | Nao | Sim |
| Handoff pendente > 10min | Sim (laranja) | Sim | Nao | Sim |
| Novo evento clinico | Nao | Sim | Nao | Nao |
| Correcao de evento | Nao | Sim | Nao | Nao |
| Medicacao devida em 15min | Sim (azul) | Sim | Nao | Nao |

---

## 11. Exportacao e Impressao

### 11.1 Opcoes de Exportacao

```typescript
interface TimelineExportOptions {
  formats: ['pdf', 'csv', 'json', 'fhir_bundle'];

  scopes: [
    'current_view',        // Apenas o que esta filtrado/visivel
    'full_encounter',      // Todo o encontro
    'date_range',          // Periodo especifico
    'specific_categories', // Categorias selecionadas
  ];

  options: {
    include_provenance: boolean;
    include_audit_trail: boolean;
    include_corrections_history: boolean;
    include_confidence_scores: boolean;
    redact_sensitive: boolean;
    anonymize: boolean;
  };

  // Toda exportacao gera evento de auditoria
  audit: {
    event_type: 'record_exported';
    captures: ['who', 'when', 'what_scope', 'what_format', 'what_filters'];
  };
}
```

---

## 12. Responsividade

### 12.1 Breakpoints

| Breakpoint | Layout | Mudancas |
|---|---|---|
| Desktop (> 1440px) | Timeline + Sidebar lado a lado | Layout completo |
| Laptop (1024-1440px) | Timeline + Sidebar colapsavel | Sidebar abre sobre a timeline |
| Tablet (768-1024px) | Timeline tela cheia, sidebar em drawer | Header compactado |
| Mobile (< 768px) | Timeline simplificada, cards empilhados | Filtros em bottom sheet |

### 12.2 Mobile-specific

```
+----------------------------+
| MARIA SILVA | CM-412A      |
| 67a | Pneumonia | 3 dias   |
+----------------------------+
| [!] 3 alertas              |
| Dor: 4 | Confianca: 82%    |
+----------------------------+
| [Timeline] [Med] [Chamados]|
+----------------------------+
| 14:35 Amoxicilina 500mg    |
|   Enf. Ana Paula | +35min  |
|   [Detalhes >]             |
+----------------------------+
| 14:22 Sinais vitais        |
|   Tec. Roberto | NEWS:3    |
|   [Detalhes >]             |
+----------------------------+
| 13:58 Chamado dor          |
|   Resp: 4min | Resolvido   |
|   [Detalhes >]             |
+----------------------------+
```

---

## Referencias

- [Material Design 3 - Data Visualization](https://m3.material.io/)
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [Clinical Timeline UX Best Practices](https://www.nngroup.com/articles/healthcare-ux/)
- [Progressive Disclosure Pattern](https://www.nngroup.com/articles/progressive-disclosure/)
