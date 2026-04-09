# Timeline Confidence Model - Modelo de Confianca da Timeline

> Velya Platform - Documentacao Tecnica
> Ultima atualizacao: 2026-04-08
> Status: Especificacao Ativa

---

## 1. Visao Geral

O Timeline Confidence Model atribui um score de confianca (0-100) para cada
segmento da timeline do paciente, indicando o quao completa, consistente e
confiavel e a documentacao naquele periodo.

### Principio

> **Nem toda documentacao e igualmente confiavel. O profissional deve saber
> onde pode confiar e onde precisa investigar mais.**

```
+------------------------------------------------------------------+
|  TIMELINE CONFIDENCE                                              |
|                                                                   |
|  06:00    08:00    10:00    12:00    14:00    16:00    18:00      |
|  [=GREEN=][=GREEN=][YELLOW=][=GREEN=][ORANGE=][=GREEN=][=GREY=]  |
|    95%      92%      74%      91%      58%      89%      ??%     |
|                                                                   |
|  Composicao do Score:                                             |
|  - Origem dos dados (fonte confiavel?)                            |
|  - Completude (eventos esperados presentes?)                      |
|  - Consistencia (dados nao conflitam?)                            |
|  - Versao (correcoes/retracoes?)                                  |
|  - Proveniencia (cadeia rastreavel?)                              |
|  - Atraso de documentacao (registrado quando?)                    |
|  - Conflito entre fontes (fontes concordam?)                      |
+------------------------------------------------------------------+
```

---

## 2. Dimensoes do Score

### 2.1 Sete Dimensoes de Confianca

| Dimensao          | Peso | Descricao                               | Faixa |
| ----------------- | ---- | --------------------------------------- | ----- |
| **Origem**        | 20%  | Confiabilidade da fonte do dado         | 0-100 |
| **Completude**    | 25%  | Eventos esperados presentes vs ausentes | 0-100 |
| **Consistencia**  | 15%  | Dados internamente consistentes         | 0-100 |
| **Versao**        | 10%  | Estabilidade (sem correcoes = melhor)   | 0-100 |
| **Proveniencia**  | 10%  | Cadeia de proveniencia rastreavel       | 0-100 |
| **Temporalidade** | 10%  | Atraso entre ocorrencia e registro      | 0-100 |
| **Concordancia**  | 10%  | Fontes multiplas concordam              | 0-100 |

### 2.2 Diagrama de Composicao

```
  Score Final = SUM(Dimensao_i * Peso_i) para i = 1..7

  +-------------+
  | Origem (20%)|------+
  +-------------+      |
  +-------------+      |
  | Complet(25%)|------+
  +-------------+      |
  +-------------+      |     +------------------+
  | Consist(15%)|------+---->| SCORE COMPOSTO   |
  +-------------+      |     | (0-100)          |
  +-------------+      |     +------------------+
  | Versao (10%)|------+           |
  +-------------+      |           v
  +-------------+      |     +------------------+
  | Proven.(10%)|------+     | Indicador Visual |
  +-------------+      |     | GREEN/YELLOW/    |
  +-------------+      |     | ORANGE/RED/GREY  |
  | Tempor.(10%)|------+     +------------------+
  +-------------+      |
  +-------------+      |
  | Concord(10%)|------+
  +-------------+
```

---

## 3. Algoritmo de Calculo

### 3.1 Funcao de Score por Dimensao

```typescript
interface ConfidenceDimension {
  name: string;
  weight: number;
  calculate: (context: ScoreContext) => number;
}

interface ScoreContext {
  /** Eventos no segmento temporal sendo avaliado */
  events: PatientJourneyEvent[];

  /** Expectativas do completeness engine para este segmento */
  expectations: Expectation[];

  /** Gaps detectados neste segmento */
  gaps: GapEvent[];

  /** Projecoes atuais do paciente */
  projections: {
    clinical: ClinicalProjection;
    operational: OperationalProjection;
    medication: MedicationProjection;
  };

  /** Janela temporal do segmento */
  window: {
    start: string;
    end: string;
    shift: 'morning' | 'afternoon' | 'night';
  };

  /** Encounter */
  encounter_id: string;
  patient_id: string;
}

interface ConfidenceScore {
  /** Score composto final */
  overall: number;

  /** Scores por dimensao */
  dimensions: {
    origin: number;
    completeness: number;
    consistency: number;
    version: number;
    provenance: number;
    temporality: number;
    concordance: number;
  };

  /** Indicador visual */
  indicator: 'green' | 'yellow' | 'orange' | 'red' | 'grey';

  /** Fatores que mais impactaram negativamente */
  detractors: Array<{
    dimension: string;
    issue: string;
    impact: number;
    event_ids?: string[];
  }>;

  /** Janela temporal avaliada */
  window: { start: string; end: string };

  /** Metadados */
  calculated_at: string;
  event_count: number;
  gap_count: number;
}
```

### 3.2 Implementacao Completa

```typescript
/**
 * Calcula o score de confianca para um segmento temporal da timeline.
 */
function calculateTimelineConfidence(context: ScoreContext): ConfidenceScore {
  const dimensions: ConfidenceDimension[] = [
    {
      name: 'origin',
      weight: 0.2,
      calculate: calculateOriginScore,
    },
    {
      name: 'completeness',
      weight: 0.25,
      calculate: calculateCompletenessScore,
    },
    {
      name: 'consistency',
      weight: 0.15,
      calculate: calculateConsistencyScore,
    },
    {
      name: 'version',
      weight: 0.1,
      calculate: calculateVersionScore,
    },
    {
      name: 'provenance',
      weight: 0.1,
      calculate: calculateProvenanceScore,
    },
    {
      name: 'temporality',
      weight: 0.1,
      calculate: calculateTemporalityScore,
    },
    {
      name: 'concordance',
      weight: 0.1,
      calculate: calculateConcordanceScore,
    },
  ];

  const detractors: ConfidenceScore['detractors'] = [];
  const dimensionScores: Record<string, number> = {};
  let overall = 0;

  for (const dim of dimensions) {
    const score = dim.calculate(context);
    dimensionScores[dim.name] = score;
    overall += score * dim.weight;

    // Registrar detratores (score < 70)
    if (score < 70) {
      detractors.push({
        dimension: dim.name,
        issue: getDimensionIssueDescription(dim.name, score, context),
        impact: Math.round((100 - score) * dim.weight),
      });
    }
  }

  overall = Math.round(Math.max(0, Math.min(100, overall)));

  return {
    overall,
    dimensions: dimensionScores as ConfidenceScore['dimensions'],
    indicator: getIndicator(overall),
    detractors: detractors.sort((a, b) => b.impact - a.impact),
    window: context.window,
    calculated_at: new Date().toISOString(),
    event_count: context.events.length,
    gap_count: context.gaps.length,
  };
}

/**
 * DIMENSAO 1: Origem dos Dados
 * Avalia a confiabilidade das fontes dos eventos.
 */
function calculateOriginScore(context: ScoreContext): number {
  if (context.events.length === 0) return 0;

  const sourceScores: Record<string, number> = {
    'velya-ehr': 95,
    'velya-nursing': 95,
    'velya-pharmacy': 95,
    'velya-lab': 98,
    'velya-imaging': 98,
    'velya-devices': 90,
    'velya-bed-management': 90,
    'velya-call-system': 85,
    'velya-transport': 85,
    'velya-billing': 80,
    'velya-mobile': 85,
    'external-integration': 70,
    'velya-rules-engine': 80,
    'velya-ai-engine': 60,
  };

  const roleScores: Record<string, number> = {
    physician: 95,
    nurse: 95,
    nursing_technician: 90,
    pharmacist: 95,
    physiotherapist: 90,
    nutritionist: 90,
    psychologist: 90,
    social_worker: 85,
    administrative: 75,
    system: 70,
    device: 80,
    patient: 60,
    companion: 50,
  };

  let totalScore = 0;
  for (const event of context.events) {
    const sourceScore = sourceScores[event.source_system] || 50;
    const roleScore = roleScores[event.authored_role] || 50;
    totalScore += sourceScore * 0.6 + roleScore * 0.4;
  }

  return Math.round(totalScore / context.events.length);
}

/**
 * DIMENSAO 2: Completude
 * Verifica se eventos esperados estao presentes.
 */
function calculateCompletenessScore(context: ScoreContext): number {
  const totalExpectations = context.expectations.length;
  if (totalExpectations === 0) return 95; // Sem expectativas = bom

  const satisfied = context.expectations.filter(
    (e) => e.status === 'satisfied' || e.status === 'cancelled',
  ).length;

  const gaps = context.expectations.filter((e) => e.status === 'gap').length;

  const active = context.expectations.filter((e) => e.status === 'active').length;

  // Gaps criticos penalizam mais
  const criticalGaps = context.gaps.filter((g) => g.payload.severity === 'critical').length;

  let score = (satisfied / totalExpectations) * 100;

  // Penalidades adicionais
  score -= criticalGaps * 15;
  score -= gaps * 5;
  score -= active * 2; // Expectativas pendentes = incerteza

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * DIMENSAO 3: Consistencia
 * Verifica se os dados nao se contradizem.
 */
function calculateConsistencyScore(context: ScoreContext): number {
  let score = 100;
  const events = context.events;

  // Verificar timestamps inconsistentes
  for (const event of events) {
    const occurred = new Date(event.occurred_at).getTime();
    const recorded = new Date(event.recorded_at).getTime();

    // Evento registrado ANTES de acontecer = inconsistente
    if (recorded < occurred - 60000) {
      // 1 min de tolerancia
      score -= 20;
    }
  }

  // Verificar vital signs inconsistentes
  const vitalEvents = events.filter((e) => e.event_type === 'vital_signs');
  for (let i = 1; i < vitalEvents.length; i++) {
    const prev = vitalEvents[i - 1].payload as any;
    const curr = vitalEvents[i].payload as any;

    // Variacao muito brusca de FC (> 60 bpm em < 1h sem evento clinico)
    if (prev.heart_rate && curr.heart_rate) {
      const diff = Math.abs(curr.heart_rate - prev.heart_rate);
      if (diff > 60) score -= 10;
    }

    // PA sistolica com variacao > 80 mmHg
    if (prev.systolic_bp && curr.systolic_bp) {
      const diff = Math.abs(curr.systolic_bp - prev.systolic_bp);
      if (diff > 80) score -= 10;
    }
  }

  // Verificar medicacao: administracao referenciando prescricao cancelada
  const medAdmins = events.filter((e) => e.event_type.startsWith('medication_administration'));
  const cancelledRequests = events
    .filter((e) => e.event_type === 'medication_request.cancelled')
    .map((e) => (e.payload as any).fhir_medication_request_id);

  for (const admin of medAdmins) {
    const ref = (admin.payload as any).request_reference;
    if (cancelledRequests.includes(ref)) {
      score -= 25; // Grave inconsistencia
    }
  }

  // Verificar eventos duplicados (mesmo tipo, mesmo autor, < 2 min)
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (
        events[i].event_type === events[j].event_type &&
        events[i].authored_by === events[j].authored_by
      ) {
        const timeDiff = Math.abs(
          new Date(events[i].occurred_at).getTime() - new Date(events[j].occurred_at).getTime(),
        );
        if (timeDiff < 120000) {
          // < 2 min
          score -= 5;
        }
      }
    }
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * DIMENSAO 4: Versao/Estabilidade
 * Avalia a estabilidade dos dados (correcoes indicam menor confianca).
 */
function calculateVersionScore(context: ScoreContext): number {
  if (context.events.length === 0) return 0;

  let score = 100;

  const corrections = context.events.filter((e) => e.event_category === 'corrected');
  const superseded = context.events.filter((e) => e.status === 'superseded');
  const retracted = context.events.filter((e) => e.status === 'retracted');

  // Cada correcao reduz levemente
  score -= corrections.length * 3;

  // Eventos superseded (existem mas foram substituidos)
  score -= superseded.length * 5;

  // Retracoes sao mais graves
  score -= retracted.length * 10;

  // Correcoes tardias (> 4h) sao mais preocupantes
  const lateCorrections = corrections.filter((e) => {
    const delay = (e.payload as any).delay_from_original_seconds || 0;
    return delay > 4 * 3600;
  });
  score -= lateCorrections.length * 8;

  // Bonus: eventos com versao 1 (nunca corrigidos) em alta proporcao
  const v1Events = context.events.filter((e) => e.version === 1);
  const v1Ratio = v1Events.length / context.events.length;
  if (v1Ratio > 0.95) score = Math.min(score + 5, 100);

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * DIMENSAO 5: Proveniencia
 * Verifica se cada evento tem cadeia de proveniencia rastreavel.
 */
function calculateProvenanceScore(context: ScoreContext): number {
  if (context.events.length === 0) return 0;

  let withProvenance = 0;
  let withFullChain = 0;

  for (const event of context.events) {
    // Eventos de sistema e inferidos nao exigem provenance FHIR
    if (['system', 'inferred', 'automated'].includes(event.event_category)) {
      withProvenance++;
      withFullChain++;
      continue;
    }

    if (event.provenance_link) {
      withProvenance++;
    }

    // Verificar se tem hash valido
    if (event.hash && event.hash.startsWith('sha256:')) {
      withFullChain++;
    }
  }

  const clinicalEvents = context.events.filter(
    (e) => !['system', 'inferred', 'automated'].includes(e.event_category),
  );

  if (clinicalEvents.length === 0) return 95;

  const provenanceRatio = withProvenance / context.events.length;
  const chainRatio = withFullChain / context.events.length;

  return Math.round(provenanceRatio * 60 + chainRatio * 40);
}

/**
 * DIMENSAO 6: Temporalidade
 * Avalia atraso entre ocorrencia e registro.
 */
function calculateTemporalityScore(context: ScoreContext): number {
  if (context.events.length === 0) return 0;

  let totalScore = 0;

  for (const event of context.events) {
    const occurred = new Date(event.occurred_at).getTime();
    const recorded = new Date(event.recorded_at).getTime();
    const delayMinutes = (recorded - occurred) / 60000;

    let eventScore: number;
    if (delayMinutes <= 5) {
      eventScore = 100; // Excelente: ate 5 min
    } else if (delayMinutes <= 15) {
      eventScore = 90; // Bom: 5-15 min
    } else if (delayMinutes <= 30) {
      eventScore = 75; // Aceitavel: 15-30 min
    } else if (delayMinutes <= 60) {
      eventScore = 55; // Preocupante: 30-60 min
    } else if (delayMinutes <= 240) {
      eventScore = 30; // Ruim: 1-4 horas
    } else {
      eventScore = 10; // Critico: > 4 horas
    }

    // Eventos clinicos criticos com atraso sao mais graves
    if (event.clinical_relevance === 'critical' && delayMinutes > 15) {
      eventScore -= 20;
    }

    totalScore += Math.max(0, eventScore);
  }

  return Math.round(totalScore / context.events.length);
}

/**
 * DIMENSAO 7: Concordancia entre Fontes
 * Verifica se dados de fontes diferentes concordam.
 */
function calculateConcordanceScore(context: ScoreContext): number {
  if (context.events.length === 0) return 0;

  let score = 100;
  const events = context.events;

  // Verificar vital signs de fontes diferentes no mesmo periodo
  const vitalsByWindow = groupEventsByTimeWindow(
    events.filter((e) => e.event_type === 'vital_signs'),
    15, // Janela de 15 minutos
  );

  for (const [_window, windowEvents] of Object.entries(vitalsByWindow)) {
    if ((windowEvents as PatientJourneyEvent[]).length > 1) {
      const sources = new Set((windowEvents as PatientJourneyEvent[]).map((e) => e.source_system));
      if (sources.size > 1) {
        // Multiplas fontes no mesmo periodo - verificar concordancia
        const hrs = (windowEvents as PatientJourneyEvent[])
          .map((e) => (e.payload as any).heart_rate)
          .filter(Boolean);
        if (hrs.length > 1) {
          const maxDiff = Math.max(...hrs) - Math.min(...hrs);
          if (maxDiff > 20) score -= 15; // Discordancia significativa
        }
      }
    }
  }

  // Verificar medicacao: informacao da farmacia vs enfermagem
  const pharmacyEvents = events.filter((e) => e.source_system === 'velya-pharmacy');
  const nursingEvents = events.filter((e) => e.source_system === 'velya-nursing');

  // Se ha muitos eventos de enfermagem sem correspondente na farmacia
  if (pharmacyEvents.length > 0 && nursingEvents.length > 0) {
    const nursingMedEvents = nursingEvents.filter((e) => e.event_type.startsWith('medication'));
    const pharmacyMedEvents = pharmacyEvents.filter((e) => e.event_type.startsWith('medication'));
    if (nursingMedEvents.length > 0 && pharmacyMedEvents.length === 0) {
      score -= 10; // Medicacao registrada por enfermagem sem visibilidade da farmacia
    }
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

// --- Funcoes auxiliares ---

function getIndicator(score: number): ConfidenceScore['indicator'] {
  if (score >= 90) return 'green';
  if (score >= 70) return 'yellow';
  if (score >= 50) return 'orange';
  if (score >= 30) return 'red';
  return 'grey';
}

function getDimensionIssueDescription(
  dimension: string,
  score: number,
  context: ScoreContext,
): string {
  const issues: Record<string, string> = {
    origin: `Fontes de dados com confiabilidade reduzida (score: ${score})`,
    completeness: `${context.gaps.length} gaps detectados no periodo`,
    consistency: `Dados com inconsistencias internas (score: ${score})`,
    version: `Correcoes e retracoes indicam instabilidade dos dados`,
    provenance: `Cadeia de proveniencia incompleta para alguns eventos`,
    temporality: `Documentacao com atraso significativo em relacao a ocorrencia`,
    concordance: `Discordancia entre fontes diferentes`,
  };
  return issues[dimension] || `Score baixo na dimensao ${dimension}`;
}

function groupEventsByTimeWindow(
  events: PatientJourneyEvent[],
  windowMinutes: number,
): Record<string, PatientJourneyEvent[]> {
  const groups: Record<string, PatientJourneyEvent[]> = {};
  for (const event of events) {
    const timestamp = new Date(event.occurred_at).getTime();
    const windowKey = Math.floor(timestamp / (windowMinutes * 60000)).toString();
    if (!groups[windowKey]) groups[windowKey] = [];
    groups[windowKey].push(event);
  }
  return groups;
}
```

---

## 4. Agregacao

### 4.1 Agregacao por Encounter

```typescript
/**
 * Agrega scores de confianca de todos os segmentos de um encounter.
 */
function aggregateEncounterConfidence(segmentScores: ConfidenceScore[]): EncounterConfidenceReport {
  if (segmentScores.length === 0) {
    return {
      overall: 0,
      indicator: 'grey',
      segments_evaluated: 0,
      segments_green: 0,
      segments_yellow: 0,
      segments_orange: 0,
      segments_red: 0,
      segments_grey: 0,
      lowest_segment: null,
      top_detractors: [],
      trend: 'unknown',
    };
  }

  const overall = Math.round(
    segmentScores.reduce((sum, s) => sum + s.overall, 0) / segmentScores.length,
  );

  // Contar segmentos por indicador
  const counts = { green: 0, yellow: 0, orange: 0, red: 0, grey: 0 };
  for (const s of segmentScores) {
    counts[s.indicator]++;
  }

  // Encontrar segmento com menor score
  const lowest = segmentScores.reduce(
    (min, s) => (s.overall < min.overall ? s : min),
    segmentScores[0],
  );

  // Agregar detratores
  const allDetractors = segmentScores.flatMap((s) => s.detractors);
  const detractorMap = new Map<string, { dimension: string; count: number; totalImpact: number }>();
  for (const d of allDetractors) {
    const key = d.dimension;
    const existing = detractorMap.get(key) || { dimension: key, count: 0, totalImpact: 0 };
    existing.count++;
    existing.totalImpact += d.impact;
    detractorMap.set(key, existing);
  }
  const topDetractors = Array.from(detractorMap.values())
    .sort((a, b) => b.totalImpact - a.totalImpact)
    .slice(0, 5);

  // Calcular tendencia
  const recentScores = segmentScores.slice(-6); // Ultimos 6 segmentos
  const olderScores = segmentScores.slice(-12, -6);
  const recentAvg = recentScores.reduce((s, x) => s + x.overall, 0) / recentScores.length;
  const olderAvg =
    olderScores.length > 0
      ? olderScores.reduce((s, x) => s + x.overall, 0) / olderScores.length
      : recentAvg;

  let trend: 'improving' | 'stable' | 'worsening' | 'unknown';
  if (olderScores.length === 0) trend = 'unknown';
  else if (recentAvg - olderAvg > 5) trend = 'improving';
  else if (olderAvg - recentAvg > 5) trend = 'worsening';
  else trend = 'stable';

  return {
    overall,
    indicator: getIndicator(overall),
    segments_evaluated: segmentScores.length,
    segments_green: counts.green,
    segments_yellow: counts.yellow,
    segments_orange: counts.orange,
    segments_red: counts.red,
    segments_grey: counts.grey,
    lowest_segment: {
      window: lowest.window,
      score: lowest.overall,
      main_issue: lowest.detractors[0]?.issue || 'Nenhum',
    },
    top_detractors: topDetractors,
    trend,
  };
}

interface EncounterConfidenceReport {
  overall: number;
  indicator: 'green' | 'yellow' | 'orange' | 'red' | 'grey';
  segments_evaluated: number;
  segments_green: number;
  segments_yellow: number;
  segments_orange: number;
  segments_red: number;
  segments_grey: number;
  lowest_segment: {
    window: { start: string; end: string };
    score: number;
    main_issue: string;
  } | null;
  top_detractors: Array<{
    dimension: string;
    count: number;
    totalImpact: number;
  }>;
  trend: 'improving' | 'stable' | 'worsening' | 'unknown';
}
```

### 4.2 Agregacao por Janela Temporal

```typescript
interface TimeWindowAggregation {
  /** Configuracoes de janela */
  windows: {
    /** Segmentos de 4 horas (padrao para visualizacao) */
    segment_hours: 4;

    /** Overlap entre segmentos para suavizar transicoes */
    overlap_minutes: 30;

    /** Recalculo a cada X minutos */
    recalculation_interval: 5;
  };

  /** Calculo por turno */
  shift_aggregation: {
    morning: { start: '06:00'; end: '12:00' };
    afternoon: { start: '12:00'; end: '18:00' };
    night: { start: '18:00'; end: '06:00' };
  };
}
```

---

## 5. Indicadores Visuais

### 5.1 Cores e Significados

```
  +--------+--------+--------------------------------------------------+
  | Score  | Cor    | Significado                                       |
  +--------+--------+--------------------------------------------------+
  | 90-100 | GREEN  | Dados completos, consistentes, verificados.       |
  |        |        | Alta confianca na timeline.                       |
  +--------+--------+--------------------------------------------------+
  | 70-89  | YELLOW | Dados parciais ou com pequenas inconsistencias.   |
  |        |        | Confiavel para uso clinico, mas revisar detalhes. |
  +--------+--------+--------------------------------------------------+
  | 50-69  | ORANGE | Gaps detectados ou atraso de documentacao.        |
  |        |        | Requer atencao antes de decisoes criticas.        |
  +--------+--------+--------------------------------------------------+
  | 30-49  | RED    | Gaps criticos ou dados conflitantes.              |
  |        |        | Nao confiavel sem investigacao adicional.         |
  +--------+--------+--------------------------------------------------+
  | 0-29   | GREY   | Dados insuficientes ou nao confiaveis.            |
  |        |        | Periodo sem documentacao adequada.                |
  +--------+--------+--------------------------------------------------+
```

### 5.2 Visualizacao na Timeline

```
  Timeline do Paciente (08/04/2026):

  Turno Noite (00:00-06:00)     Turno Manha (06:00-12:00)
  [GREEN===] [GREEN===]         [GREEN===] [YELLOW==]
     95%        92%                91%        74%

  Turno Tarde (12:00-18:00)     Turno Noite (18:00-00:00)
  [ORANGE==] [GREEN===]         [GREY====]
     58%        89%                ??%

  Detalhamento do segmento ORANGE (12:00-16:00):
  +------------------------------------------+
  | Score: 58%                               |
  | Principal problema: Completude (35%)     |
  |   - 2 gaps detectados:                   |
  |     * Reavaliacao de dor em atraso        |
  |     * Medicacao atrasada 35 min           |
  | Temporalidade: 45%                       |
  |   - 3 registros com atraso > 30 min      |
  | Demais dimensoes: OK                     |
  +------------------------------------------+
```

### 5.3 Tooltip de Confianca

```typescript
interface ConfidenceTooltip {
  score: number;
  indicator: string;
  period: string;

  // Barra visual por dimensao
  bars: Array<{
    label: string;
    score: number;
    maxScore: 100;
    color: string;
  }>;

  // Resumo textual
  summary: string;

  // Acao sugerida
  suggested_action?: string;
}

// Exemplo de tooltip renderizado:
//
// Confianca: 58% [ORANGE]
// Periodo: 08/04 12:00 - 16:00
//
// Origem:      [==========-] 92%
// Completude:  [===--------] 35%  <-- Problema
// Consistencia:[========---] 78%
// Versao:      [==========] 100%
// Proveniencia:[==========-] 90%
// Temporalidade:[====-------] 45% <-- Problema
// Concordancia:[==========-] 88%
//
// 2 gaps detectados, 3 registros tardios.
// Recomendacao: Verificar pendencias de documentacao.
```

---

## 6. Pipeline de Calculo

### 6.1 Fluxo de Processamento

```
  Novo evento no Patient Journey Ledger
       |
       v
  NATS Consumer: timeline-confidence
       |
       v
  +-----------------------------+
  | Identificar segmento        |
  | temporal afetado            |
  +-----------------------------+
       |
       v
  +-----------------------------+
  | Carregar contexto:          |
  | - Eventos do segmento       |
  | - Expectativas              |
  | - Gaps                      |
  | - Projecoes                 |
  +-----------------------------+
       |
       v
  +-----------------------------+
  | Calcular score por dimensao |
  +-----------------------------+
       |
       v
  +-----------------------------+
  | Calcular score composto     |
  +-----------------------------+
       |
       v
  +-----------------------------+
  | Persistir resultado         |
  | (PostgreSQL + Redis)        |
  +-----------------------------+
       |
       v
  +-----------------------------+
  | Publicar metrica Prometheus |
  +-----------------------------+
       |
       v
  +-----------------------------+
  | Se score caiu significativa-|
  | mente: notificar            |
  +-----------------------------+
```

### 6.2 Temporal Workflow

```typescript
interface ConfidenceRecalculationWorkflow {
  workflowId: 'confidence-recalc-{encounter_id}';
  taskQueue: 'timeline-confidence';

  // Executa continuamente durante a internacao
  schedule: {
    interval: '5m';
    on_new_event: true; // Tambem recalcula ao receber novo evento
  };

  steps: [
    'identifyActiveSegments',
    'loadSegmentContexts',
    'calculateScores',
    'detectScoreChanges',
    'persistResults',
    'publishMetrics',
    'notifyIfSignificantChange',
    'updateEncounterAggregation',
  ];
}
```

---

## 7. Metricas Prometheus

```promql
# Score medio de confianca por unidade
avg by (ward) (timeline_confidence_score)

# Segmentos com confianca critica (<50)
count(timeline_confidence_score < 50)

# Distribuicao de indicadores
count by (indicator) (timeline_confidence_indicator)

# Dimensao com menor score medio
bottomk(3, avg by (dimension) (timeline_confidence_dimension_score))

# Tendencia de confianca (media movel 24h)
avg_over_time(timeline_confidence_score[24h])

# Segmentos GREY (sem dados)
count(timeline_confidence_indicator{indicator="grey"})

# Detratores mais frequentes
topk(5, sum by (dimension) (
  timeline_confidence_detractor_count
))
```

---

## 8. Armazenamento

### 8.1 PostgreSQL

```sql
CREATE TABLE timeline_confidence_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    encounter_id    UUID NOT NULL,
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    overall_score   INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    indicator       VARCHAR(10) NOT NULL,
    origin_score    INTEGER NOT NULL,
    completeness_score INTEGER NOT NULL,
    consistency_score  INTEGER NOT NULL,
    version_score      INTEGER NOT NULL,
    provenance_score   INTEGER NOT NULL,
    temporality_score  INTEGER NOT NULL,
    concordance_score  INTEGER NOT NULL,
    detractors     JSONB DEFAULT '[]',
    event_count    INTEGER NOT NULL,
    gap_count      INTEGER NOT NULL,
    calculated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_patient_window UNIQUE (patient_id, encounter_id, window_start, window_end)
);

CREATE INDEX idx_tcs_patient ON timeline_confidence_scores(patient_id, encounter_id);
CREATE INDEX idx_tcs_indicator ON timeline_confidence_scores(indicator);
CREATE INDEX idx_tcs_low_scores ON timeline_confidence_scores(overall_score) WHERE overall_score < 50;
```

### 8.2 Redis (Cache para UI)

```
Key: timeline:confidence:{patient_id}:{encounter_id}:current
TTL: 30s
Value: JSON com todos os segmentos ativos e scores

Key: timeline:confidence:{patient_id}:{encounter_id}:aggregate
TTL: 60s
Value: JSON com EncounterConfidenceReport
```

---

## 9. Alertas de Confianca

| Alerta                  | Condicao                             | Destinatario     | Canal        |
| ----------------------- | ------------------------------------ | ---------------- | ------------ |
| `ConfidenceDrop`        | Score caiu > 20 pontos em 1 segmento | Enf. Responsavel | Push         |
| `ConfidenceCritical`    | Score < 30 em segmento ativo         | Enf. Chefe       | Push         |
| `ConfidenceGrey`        | Segmento sem dados (GREY) > 2h       | Enf. Responsavel | Push         |
| `CompletenessLow`       | Dimensao completude < 40             | Enf. Chefe       | Push         |
| `LateDocumentation`     | Dimensao temporalidade < 40          | Enf. Responsavel | Push         |
| `InconsistencyDetected` | Dimensao consistencia < 50           | Enf. Chefe       | Push + Email |

---

## Referencias

- [Data Quality Dimensions (ISO 25012)](https://www.iso.org/standard/35736.html)
- [Clinical Data Confidence Scoring](https://www.ncbi.nlm.nih.gov/)
- [Event Sourcing - Projection Confidence](https://microservices.io/)
- [OpenTelemetry Metrics](https://opentelemetry.io/docs/specs/otel/metrics/)
