# Regras de Deteccao Automatica de Gaps na Jornada do Paciente

> Catalogo completo de regras que detectam desvios, omissoes e inconsistencias na jornada do paciente internado.

## 1. Visao Geral

O modulo de Gap Detection monitora continuamente o Work Event Ledger e o Digital Twin Operacional para identificar situacoes que representam risco assistencial, operacional ou de compliance. Cada regra e classificada por severidade, possui metodo de deteccao definido e dispara notificacoes especificas.

### 1.1 Principios

1. **Deteccao proativa**: gaps sao detectados antes de causarem dano, nao depois.
2. **Baseado em evidencia**: cada regra referencia protocolo clinico ou regulatorio.
3. **Contexto-aware**: regras consideram tipo de unidade, perfil do paciente e turno.
4. **Acionavel**: cada gap detectado gera uma acao clara para um responsavel identificado.
5. **Auditavel**: toda deteccao e registrada como evento no ledger.

### 1.2 Arquitetura

```
┌─────────────────────────────────────────┐
│          Work Event Ledger              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       Gap Detection Engine              │
│  ┌───────────────────────────────────┐  │
│  │  Rule Evaluator (CEP - Esper/     │  │
│  │  Flink)                           │  │
│  │  - Janelas temporais             │  │
│  │  - Correlacao de eventos          │  │
│  │  - Pattern matching               │  │
│  │  - Absence detection              │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Rule Repository                   │  │
│  │  - 40+ regras ativas              │  │
│  │  - Configuracao por unidade       │  │
│  │  - Versionamento de regras        │  │
│  └───────────────────────────────────┘  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       Notification Dispatcher           │
│  - Push notification                    │
│  - Dashboard alert                      │
│  - Escalation chain                     │
│  - AuditEvent generation                │
└─────────────────────────────────────────┘
```

---

## 2. Catalogo de Regras

### 2.1 Severidades

| Severidade | Cor | Tempo de Resposta Esperado | Escalacao |
|---|---|---|---|
| **CRITICAL** | Vermelho | Imediato (< 5 min) | Automatica apos 5 min sem acao |
| **HIGH** | Laranja | < 15 min | Automatica apos 15 min |
| **MEDIUM** | Amarelo | < 60 min | Automatica apos 60 min |
| **LOW** | Azul | < 4 horas | Consolidado em relatorio de turno |
| **INFO** | Cinza | Sem SLA | Somente registro para auditoria |

---

### GAP-001: Eventos Fora de Ordem

**Severidade**: HIGH

**Descricao**: Detecta eventos registrados em ordem cronologica inconsistente com a logica assistencial esperada. Exemplo: resultado de exame registrado antes da coleta, administracao de medicamento antes da prescricao.

**Metodo de Deteccao**:
```
PARA CADA par de eventos (A, B) onde B depende causalmente de A:
  SE B.timestamp < A.timestamp:
    GERAR gap(tipo='out_of_order', eventos=[A, B])
  SE B.timestamp == A.timestamp E B.sequenceNumber < A.sequenceNumber:
    GERAR gap(tipo='out_of_order_same_second', eventos=[A, B])
```

**Pares Causais Monitorados**:

| Evento A (deve vir antes) | Evento B (deve vir depois) |
|---|---|
| MedicationRequest | MedicationAdministration |
| ServiceRequest (lab) | Specimen (coleta) |
| Specimen (coleta) | DiagnosticReport (resultado) |
| ServiceRequest (procedimento) | Procedure |
| Consent | Procedure (que requer consentimento) |
| Encounter.admission | Qualquer evento clinico |
| Procedure.start | Procedure.end |

**Notificacao**:
- Notifica o autor do evento B.
- Notifica o coordenador da unidade.
- Gera flag no Digital Twin do paciente.

**Excecoes**:
- Registro retroativo explicito (com justificativa) ate 2 horas.
- Correcao de horario com autorizacao do coordenador.

---

### GAP-002: Ordem sem Execucao

**Severidade**: Variavel (por tipo e SLA)

**Descricao**: Ordem medica emitida que nao recebeu evento de execucao dentro do SLA esperado.

**SLAs por Tipo de Ordem**:

| Tipo de Ordem | Prioridade STAT | Prioridade Urgente | Prioridade Rotina |
|---|---|---|---|
| Medicamento | 15 min | 60 min | Proximo horario prescrito |
| Laboratorio | 30 min (coleta) | 2h (coleta) | 4h (coleta) |
| Imagem | 60 min | 4h | 24h |
| Interconsulta | 60 min | 4h | 24h |
| Procedimento simples | 30 min | 2h | Conforme agendamento |
| Dieta | 30 min | Proxima refeicao | Proxima refeicao |

**Metodo de Deteccao**:
```
PARA CADA ServiceRequest/MedicationRequest com status 'active':
  calcular tempoDesdeEmissao = agora - request.authoredOn
  obter slaAplicavel = SLA[request.type][request.priority]
  SE tempoDesdeEmissao > slaAplicavel:
    SE nao existe evento de execucao vinculado:
      GERAR gap(tipo='order_without_execution',
               severity=calcularSeveridade(request.priority, tempoDesdeEmissao/slaAplicavel))
```

**Severidade Dinamica**:
- 1x-1.5x SLA: MEDIUM
- 1.5x-2x SLA: HIGH
- > 2x SLA: CRITICAL

**Notificacao**:
- 1x SLA: Notifica responsavel pela execucao.
- 1.5x SLA: Notifica coordenador de enfermagem.
- 2x SLA: Notifica medico prescritor + coordenador da unidade.

---

### GAP-003: Execucao sem Ordem

**Severidade**: CRITICAL

**Descricao**: Evento de execucao (procedimento, administracao de medicamento, coleta) registrado sem ordem medica correspondente ativa.

**Metodo de Deteccao**:
```
PARA CADA evento de execucao (MedicationAdministration, Procedure, Specimen):
  buscar ServiceRequest/MedicationRequest vinculado
  SE nao encontrado OU request.status in ['cancelled', 'revoked', 'completed', 'expired']:
    GERAR gap(tipo='execution_without_order', severity='CRITICAL')
```

**Notificacao**:
- Notifica imediatamente o executor e o medico responsavel pelo paciente.
- Notifica o coordenador da unidade.
- Registra como evento de seguranca do paciente.
- Requer justificativa do executor em 30 minutos.

**Excecoes**:
- Protocolos de emergencia pre-aprovados (ex: PCR, anafilaxia) — registra mas nao escala.
- Ordem verbal em emergencia — requer confirmacao escrita em 1 hora.

---

### GAP-004: Dor sem Intervencao

**Severidade**: HIGH (dor >= 7) / MEDIUM (dor 4-6 sem reavaliacao)

**Descricao**: Registro de dor significativa sem intervencao farmacologica ou nao-farmacologica em tempo adequado.

**Metodo de Deteccao**:
```
PARA CADA Observation de dor (pain score):
  SE score >= 7:
    buscar MedicationAdministration(analgesico) OU
          Procedure(intervencao_nao_farmacologica) em janela [score.timestamp, score.timestamp + 30min]
    SE nao encontrado:
      GERAR gap(tipo='pain_without_intervention', severity='HIGH')
  SE score >= 4 E score < 7:
    buscar Observation de dor (reavaliacao) em janela [score.timestamp, score.timestamp + 60min]
    SE nao encontrado:
      GERAR gap(tipo='pain_without_reassessment', severity='MEDIUM')
```

**Regras Adicionais**:
- Dor >= 7 persistente por > 2 avaliacoes consecutivas: escala para CRITICAL.
- Paciente com protocolo de sedacao/analgesia em UTI: janelas diferenciadas (15 min).
- Neonatos e pediatricos: escalas especificas (NIPS, FLACC).

**Notificacao**:
- Dor >= 7: Notifica enfermeiro responsavel + medico.
- Dor 4-6 sem reavaliacao: Notifica enfermeiro responsavel.
- Dor persistente: Notifica equipe de dor (se disponivel).

---

### GAP-005: Chamada sem Resposta

**Severidade**: HIGH (emergencia) / MEDIUM (padrao)

**Descricao**: Chamada de paciente (nurse call) sem resposta dentro do tempo esperado.

**Metodo de Deteccao**:
```
PARA CADA evento nurse_call.triggered:
  tipo = call.type  // 'emergency' | 'standard' | 'comfort'
  sla = SLA_RESPOSTA[tipo]  // emergencia: 1min, padrao: 3min, conforto: 10min
  buscar evento nurse_call.responded em janela [call.timestamp, call.timestamp + sla]
  SE nao encontrado:
    GERAR gap(tipo='call_without_response', severity=SEVERIDADE[tipo])
```

**Escalacao**:
- 1x SLA: Redistribui para outro enfermeiro da unidade.
- 2x SLA: Notifica coordenador de enfermagem.
- 3x SLA: Notifica supervisao de enfermagem + registra como evento de seguranca.

**Metricas Derivadas**:
- Tempo medio de resposta por unidade/turno.
- Taxa de chamadas sem resposta no SLA.
- Correlacao com staffing ratio.

---

### GAP-006: Resultado Critico sem Follow-up

**Severidade**: CRITICAL

**Descricao**: Resultado laboratorial ou de imagem classificado como critico/panico sem evidencia de que o medico responsavel tomou conhecimento e agiu.

**Valores Criticos Monitorados (exemplos)**:

| Exame | Valor Critico |
|---|---|
| Potassio | < 2.5 ou > 6.5 mEq/L |
| Sodio | < 120 ou > 160 mEq/L |
| Glicose | < 40 ou > 500 mg/dL |
| Hemoglobina | < 7.0 g/dL |
| Plaquetas | < 20.000/mm3 |
| INR | > 5.0 |
| Troponina | > limite superior |
| Lactato | > 4.0 mmol/L |
| pH arterial | < 7.20 ou > 7.60 |
| pCO2 | < 20 ou > 70 mmHg |

**Metodo de Deteccao**:
```
PARA CADA DiagnosticReport com interpretation = 'critical' OU 'panic':
  buscar Communication(sobre=report) de laboratorio para medico
  SE Communication encontrada:
    buscar AuditEvent(leitura, report) pelo medico responsavel em 15 min
    SE nao encontrado:
      GERAR gap(tipo='critical_result_unread', severity='CRITICAL')
    buscar MedicationRequest OU ServiceRequest OU DocumentReference(progress_note)
      pelo medico em janela [report.timestamp, report.timestamp + 60min]
    SE nenhuma acao encontrada:
      GERAR gap(tipo='critical_result_no_action', severity='CRITICAL')
  SE Communication NAO encontrada (lab nao comunicou):
    GERAR gap(tipo='critical_result_not_communicated', severity='CRITICAL')
```

**Notificacao**:
- Imediata para medico responsavel (push + SMS + alerta em todas as telas).
- Se sem acao em 15 min: notifica plantonista da unidade.
- Se sem acao em 30 min: notifica coordenador medico.
- Se sem acao em 60 min: notifica diretoria clinica.

---

### GAP-007: Atrasos Anormais

**Severidade**: Variavel

**Descricao**: Deteccao de atrasos que excedem significativamente o padrao historico (baseline) para aquele tipo de evento na mesma unidade e turno.

**Metodo de Deteccao**:
```
PARA CADA par de eventos esperados (A -> B):
  calcular intervalo = B.timestamp - A.timestamp
  obter baseline = media_historica(tipo_A, tipo_B, unidade, turno, ultimos_90_dias)
  obter desvio_padrao = dp_historico(...)
  SE intervalo > baseline + 2 * desvio_padrao:
    GERAR gap(tipo='abnormal_delay', severity='MEDIUM')
  SE intervalo > baseline + 3 * desvio_padrao:
    GERAR gap(tipo='abnormal_delay', severity='HIGH')
```

**Pares Monitorados**:
- Prescricao -> Dispensacao
- Dispensacao -> Administracao
- Solicitacao de exame -> Coleta
- Coleta -> Resultado
- Solicitacao de interconsulta -> Atendimento
- Solicitacao de transporte -> Inicio do transporte
- Alta medica -> Saida efetiva do paciente
- Admissao -> Primeiro atendimento medico

**Notificacao**:
- 2 desvios: Notifica responsavel pelo processo.
- 3 desvios: Notifica coordenador + registra para analise de causa raiz.

---

### GAP-008: Handoff sem Aceite

**Severidade**: HIGH

**Descricao**: Transferencia de responsabilidade (handoff) solicitada sem aceite explicito do receptor dentro do timeout.

**Timeouts por Prioridade**:

| Prioridade | Timeout | Escalacao |
|---|---|---|
| Critico | 5 minutos | Coordenador da unidade receptora |
| Urgente | 15 minutos | Coordenador de enfermagem |
| Rotina | 60 minutos | Supervisao do turno |

**Metodo de Deteccao**:
```
PARA CADA Task com:
  code = 'handoff' E
  status = 'requested' E
  agora - Task.authoredOn > TIMEOUT[Task.priority]:
    GERAR gap(tipo='handoff_without_acceptance', severity='HIGH')
    iniciar_escalacao(Task)
```

**Detalhes de Escalacao**:
1. Timeout expirado: notifica receptor + supervisor do receptor.
2. Timeout + 50%: notifica coordenador da unidade receptora.
3. Timeout x 2: notifica supervisao geral + registra como risco operacional.
4. Timeout x 3: handoff e redirecionado para plantonista backup automaticamente.

---

### GAP-009: Movimento sem Novo Responsavel

**Severidade**: CRITICAL

**Descricao**: Paciente movimentado (transferencia de unidade, de leito entre alas, ida para centro cirurgico) sem atribuicao de novo responsavel na unidade destino.

**Metodo de Deteccao**:
```
PARA CADA evento encounter.location.changed:
  SE nova_unidade != unidade_anterior:
    buscar Task(handoff) OU CareTeam.update na nova_unidade
      em janela [movimento.timestamp, movimento.timestamp + 15min]
    SE nao encontrado:
      GERAR gap(tipo='movement_without_new_owner', severity='CRITICAL')
```

**Notificacao**:
- Imediata para coordenador da unidade destino.
- Copia para coordenador da unidade origem.
- Se sem resolucao em 15 min: supervisao geral.

**Risco**: Paciente sem responsavel definido e a causa raiz de muitos eventos adversos.

---

### GAP-010: Correcoes Tardias Repetidas

**Severidade**: MEDIUM (primeira ocorrencia) / HIGH (padrao repetitivo)

**Descricao**: Profissional que registra correcoes (amendments) tardias com frequencia acima do esperado, indicando possivel problema de fluxo de trabalho ou documentacao retroativa habitual.

**Metodo de Deteccao**:
```
PARA CADA Practitioner:
  contar amendments = DocumentReference com relatesTo.code = 'amends'
    onde amendment.timestamp - original.timestamp > 4 horas
  contar total_docs = total de DocumentReference pelo practitioner no periodo
  taxa = amendments / total_docs
  SE taxa > 0.15 (15%) no periodo de 30 dias:
    GERAR gap(tipo='frequent_late_corrections', severity='MEDIUM')
  SE taxa > 0.30 (30%):
    GERAR gap(tipo='frequent_late_corrections', severity='HIGH')
  SE mesmo profissional gerou gap nos ultimos 3 meses:
    escalar severity em 1 nivel
```

**Notificacao**:
- Primeira deteccao: Notifica o profissional + coordenador.
- Padrao repetitivo: Notifica diretoria clinica/de enfermagem.
- Inclui no relatorio mensal de qualidade documental.

---

### GAP-011: Documentacao Conflitante

**Severidade**: HIGH

**Descricao**: Informacoes contraditorias registradas em documentos diferentes do mesmo paciente no mesmo periodo.

**Conflitos Monitorados**:

| Campo | Exemplo de Conflito |
|---|---|
| Alergias | Evolucao diz "sem alergias", AllergyIntolerance registra penicilina |
| Dieta | Prescricao diz "dieta liquida", NutritionOrder diz "dieta livre" |
| Peso | Variacao > 5kg entre registros com < 24h de intervalo |
| Diagnostico | CID principal diverge entre evolucao e Condition ativa |
| Medicamento | Evolucao menciona medicamento nao presente na prescricao |
| Status funcional | Fisioterapia registra deambulacao, enfermagem registra acamado |

**Metodo de Deteccao**:
```
PARA CADA atualizacao de documento clinico:
  extrair entidades clinicas (NLP) do texto
  comparar com recursos estruturados FHIR vigentes
  PARA CADA divergencia encontrada:
    classificar como:
      - 'contradiction': informacoes mutuamente exclusivas
      - 'inconsistency': informacoes incompativeis mas nao exclusivas
      - 'outdated_reference': referencia a dado desatualizado
    GERAR gap(tipo='conflicting_documentation',
             severity=SEVERIDADE[classificacao],
             details={campo, valorDocA, valorDocB})
```

**Notificacao**:
- Notifica autores de ambos os documentos.
- Notifica coordenador medico se envolve campo critico (alergias, medicamentos).
- Requer reconciliacao em 4 horas.

---

### GAP-012: Autoria Faltante

**Severidade**: MEDIUM

**Descricao**: Documento clinico ou evento sem identificacao clara do autor, ou com autoria atribuida a usuario generico/sistema.

**Metodo de Deteccao**:
```
PARA CADA DocumentReference, Observation, Procedure, MedicationAdministration:
  verificar Provenance vinculado
  SE Provenance.agent nao existe OU agent.who e generico ('SYSTEM', 'BATCH', 'IMPORT'):
    GERAR gap(tipo='missing_authorship', severity='MEDIUM')
  SE Provenance.agent existe MAS nao tem CRM/COREN valido para o tipo de ato:
    GERAR gap(tipo='invalid_authorship', severity='HIGH')
```

**Notificacao**:
- Notifica administrador do sistema.
- Gera pendencia de regularizacao.
- Inclui no relatorio de compliance.

---

### GAP-013: Copy-Forward sem Lastro

**Severidade**: MEDIUM

**Descricao**: Evolucao clinica que reproduz conteudo de evolucao anterior sem evidencia de reavaliacao do paciente (exame fisico atualizado, novos sinais vitais, interacao documentada com paciente).

**Metodo de Deteccao**:
```
PARA CADA DocumentReference(tipo='progress_note'):
  buscar DocumentReference anterior do mesmo tipo para o mesmo paciente
  calcular similaridade_textual = cosine_similarity(atual.content, anterior.content)
  SE similaridade_textual > 0.90:
    buscar evidencia de reavaliacao em janela [anterior.timestamp, atual.timestamp]:
      - Observation de sinais vitais
      - Observation de exame fisico
      - Encounter.participant com periodo no intervalo
    SE nenhuma evidencia encontrada:
      GERAR gap(tipo='copy_forward_without_reassessment', severity='MEDIUM')
    SE similaridade > 0.98 E nenhuma evidencia:
      GERAR gap(tipo='copy_forward_without_reassessment', severity='HIGH')
```

**Notificacao**:
- Notifica o autor da evolucao.
- Notifica coordenador medico se HIGH.
- Registra para auditoria de qualidade documental.

---

## 3. Regras Adicionais por Contexto

### 3.1 Regras Especificas para UTI

| ID | Regra | Severidade |
|---|---|---|
| GAP-UTI-001 | Sinais vitais nao registrados a cada 1h (paciente instavel) ou 2h (estavel) | HIGH |
| GAP-UTI-002 | Balanco hidrico nao fechado a cada 6h | MEDIUM |
| GAP-UTI-003 | Sedacao sem avaliacao RASS/BPS a cada 4h | HIGH |
| GAP-UTI-004 | Ventilacao mecanica sem parametros registrados a cada 4h | HIGH |
| GAP-UTI-005 | Cateter venoso central sem checklist diario de necessidade | MEDIUM |
| GAP-UTI-006 | Tubo orotraqueal sem avaliacao de extubacao diaria | MEDIUM |
| GAP-UTI-007 | Profilaxia TVP nao prescrita sem justificativa | HIGH |
| GAP-UTI-008 | Elevacao de cabeceira nao registrada para paciente ventilado | MEDIUM |

### 3.2 Regras Especificas para Centro Cirurgico

| ID | Regra | Severidade |
|---|---|---|
| GAP-CC-001 | Checklist de seguranca cirurgica (OMS) incompleto antes do procedimento | CRITICAL |
| GAP-CC-002 | Consentimento cirurgico ausente 1h antes do procedimento | CRITICAL |
| GAP-CC-003 | Nota cirurgica nao registrada em 2h apos fim do procedimento | HIGH |
| GAP-CC-004 | Contagem de compressas nao registrada | CRITICAL |
| GAP-CC-005 | Antibiotico profilatico nao administrado em janela pre-operatoria | HIGH |

### 3.3 Regras Especificas para Emergencia

| ID | Regra | Severidade |
|---|---|---|
| GAP-ER-001 | Classificacao de risco nao realizada em 10 min da chegada | HIGH |
| GAP-ER-002 | Paciente vermelho/laranja sem atendimento medico em 15 min | CRITICAL |
| GAP-ER-003 | Reclassificacao nao realizada em pacientes em espera > 2h | MEDIUM |
| GAP-ER-004 | Paciente em observacao > 24h sem reavaliacao medica documentada | HIGH |

---

## 4. Configuracao e Tuning de Regras

### 4.1 Estrutura de Configuracao

```yaml
# gap-detection-rules-config.yaml
rules:
  GAP-001:
    enabled: true
    severity_override: null
    units:
      - all
    shifts:
      - all
    sla_multiplier: 1.0
    notification_channels:
      - push
      - dashboard
    escalation_enabled: true
    cooldown_minutes: 30  # Nao gerar mesmo gap para mesmo paciente em 30min
    
  GAP-002:
    enabled: true
    severity_override: null
    custom_sla:
      medication_stat: 15
      medication_urgent: 60
      lab_stat_collection: 30
    units:
      - all
    exclude_units:
      - ambulatorio  # Ambulatorio tem SLAs diferentes
    shifts:
      - all
    
  GAP-004:
    enabled: true
    pain_threshold_high: 7
    pain_threshold_moderate: 4
    intervention_window_minutes: 30
    reassessment_window_minutes: 60
    units:
      - all
    exclude_patient_profiles:
      - end_of_life_comfort  # Pacientes em cuidados paliativos tem regras proprias
```

### 4.2 Metricas de Performance das Regras

```promql
# Taxa de gaps detectados por regra
sum by (rule_id) (rate(velya_gap_detected_total[1h]))

# Falsos positivos confirmados
sum by (rule_id) (rate(velya_gap_false_positive_total[24h]))
  / sum by (rule_id) (rate(velya_gap_detected_total[24h]))

# Tempo medio ate resolucao do gap
histogram_quantile(0.50, rate(velya_gap_resolution_seconds_bucket[24h]))

# Gaps nao resolvidos alem do SLA
sum by (rule_id, unit) (velya_gap_unresolved_beyond_sla)
```

---

## 5. Fluxo de Lifecycle de um Gap

```
┌──────────┐    ┌────────────┐    ┌─────────────┐    ┌──────────┐
│ DETECTED │───>│ NOTIFIED   │───>│ ACKNOWLEDGED │───>│ RESOLVED │
└──────────┘    └────────────┘    └──────┬───────┘    └──────────┘
                      │                  │                  │
                      │                  ▼                  │
                      │           ┌─────────────┐          │
                      │           │  ESCALATED  │──────────┘
                      │           └─────────────┘
                      │
                      ▼
               ┌─────────────┐
               │FALSE_POSITIVE│
               └─────────────┘
```

### 5.1 Estados

| Estado | Descricao |
|---|---|
| **DETECTED** | Gap identificado pelo motor de regras |
| **NOTIFIED** | Notificacao enviada ao responsavel |
| **ACKNOWLEDGED** | Responsavel confirmou ciencia do gap |
| **RESOLVED** | Gap resolvido (acao corretiva registrada) |
| **ESCALATED** | Gap escalado por timeout de resolucao |
| **FALSE_POSITIVE** | Gap marcado como falso positivo com justificativa |

### 5.2 Transicoes

- `DETECTED -> NOTIFIED`: automatica, imediata.
- `NOTIFIED -> ACKNOWLEDGED`: acao do profissional (confirmar ciencia).
- `ACKNOWLEDGED -> RESOLVED`: registro da acao corretiva.
- `NOTIFIED -> ESCALATED`: timeout sem acknowledgement.
- `ACKNOWLEDGED -> ESCALATED`: timeout sem resolucao.
- Qualquer estado -> `FALSE_POSITIVE`: com justificativa + aprovacao do coordenador.

---

## 6. Integracao com Digital Twin

Cada gap detectado atualiza o Digital Twin do paciente:

1. Adiciona entrada em `pendingItems` (se acionavel).
2. Atualiza `operationalRisk.factors` (se relevante para risco).
3. Adiciona entrada em `delaySignals` (se tipo de atraso).
4. Atualiza `documentationCompleteness` (se gap documental).
5. Gera evento no Work Event Ledger (`gap.detected`, `gap.resolved`).

---

## 7. Relatorios de Gap Detection

### 7.1 Relatorio por Turno

Gerado automaticamente no fim de cada turno:
- Total de gaps detectados por severidade.
- Gaps resolvidos vs pendentes.
- Tempo medio de resolucao.
- Profissionais com mais gaps.
- Gaps recorrentes (mesmo tipo, mesmo paciente).

### 7.2 Relatorio Mensal de Qualidade

Consolidado mensal para diretoria clinica:
- Tendencia de gaps por tipo e unidade.
- Taxa de falsos positivos por regra (para tuning).
- Correlacao entre gaps e eventos adversos.
- Benchmark entre unidades.
- Recomendacoes de ajuste de regras.

### 7.3 Dashboard em Tempo Real

Ver `journey-audit-dashboards.md` — **Delay and Gap Board**.

---

## 8. Privacidade e Auditoria

- Registros de gap contem referencia ao paciente mas sao acessiveis apenas por profissionais com vinculo ao encontro ou com papel de auditoria/qualidade.
- Gaps resolvidos como falso positivo mantem a justificativa como registro permanente.
- Todo acesso a registros de gap gera `AuditEvent`.
- Dados de gap sao anonimizados para fins de pesquisa/benchmark.
- Retencao: gaps sao mantidos por 5 anos (regulatorio) em storage cold apos 1 ano.

---

## 9. Governanca de Regras

### 9.1 Ciclo de Vida de uma Regra

1. **Proposta**: Qualquer membro da equipe de qualidade pode propor nova regra.
2. **Analise**: Comite de seguranca do paciente avalia viabilidade, impacto e falsos positivos esperados.
3. **Implementacao**: Equipe tecnica implementa a regra no motor CEP.
4. **Piloto**: Regra roda em modo `INFO` (somente registro, sem notificacao) por 30 dias.
5. **Calibracao**: Ajuste de thresholds com base nos dados do piloto.
6. **Ativacao**: Regra promovida para severidade de producao.
7. **Revisao**: Revisao trimestral de performance (falsos positivos, efetividade).
8. **Desativacao**: Se taxa de falso positivo > 30% apos calibracao, regra e desativada para revisao.

### 9.2 Comite Responsavel

| Papel | Responsabilidade |
|---|---|
| Diretor Clinico | Aprovacao final de regras criticas |
| Coordenador de Qualidade | Gestao do catalogo de regras |
| Enfermeiro Lider | Validacao de regras de enfermagem |
| Engenheiro de Plataforma | Implementacao tecnica |
| Analista de Dados | Analise de performance e calibracao |
