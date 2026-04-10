# Fluxos Clínicos Principais — Internação, UTI, Cirurgia, Oncologia

> **Escopo:** os quatro maiores fluxos clínicos de alta intensidade dentro do hospital.

---

## 1. Internação em Enfermaria / Unidade Clínica

### 1.1 Gatilho
- Decisão médica na ED.
- Transferência pós-op do centro cirúrgico.
- Transferência de UTI (step-down).
- Admissão eletiva para procedimento.

### 1.2 Etapas

#### 1.2.1 Solicitação de internação
- Médico emite ordem de internação com:
  - Diagnóstico principal (CID).
  - Comorbidades relevantes.
  - Tipo de leito (comum, semi, UTI, isolamento, maternidade).
  - Motivo (indicação).
  - Previsão de tempo de permanência.
  - Plano inicial.

#### 1.2.2 Autorização (convênio)
- Envio automatizado para o convênio (TISS).
- Resposta típica em minutos (automático) a horas (auditoria).
- Se SUS: reserva conforme AIH.

#### 1.2.3 Busca e reserva de leito
- Central de Regulação de Leitos.
- Critérios: especialidade, isolamento, gênero (quartos compartilhados), proximidade.
- Leito reservado e marcado como `RESERVED_FOR_ID`.

#### 1.2.4 Preparo do leito
- Se `DIRTY`, higienização terminal é disparada.
- SLA higienização ≤ 60 min.
- Leito passa a `AVAILABLE_CLEAN`.

#### 1.2.5 Transporte
- Maqueiro solicitado via central de transporte interno.
- Equipamentos durante transporte (O₂ portátil, monitor, bomba) se necessário.
- Pré-check: acompanhamento médico se instável.

#### 1.2.6 Handoff ED → Enfermaria
- SBAR oral + leitura do resumo digital.
- Enfermeiro receptor confere pulseira, alergias, medicações em curso.
- Acknowledgement digital.

#### 1.2.7 Admissão na unidade
- Reconciliação medicamentosa completa.
- Histórico familiar e social.
- Escalas de risco (queda, úlcera, TEV, dor).
- Plano de cuidados.
- Consentimentos.
- Orientação ao paciente e acompanhante.

### 1.3 Permanência
- Round multiprofissional diário.
- Evolução clínica.
- Controle de sintomas.
- Reavaliação diária do plano de alta.
- Metas diárias.

### 1.4 Alta
- Ver `patient-lifecycle-end-to-end.md`.

---

## 2. UTI — Fluxo SmartICU + BRIDGE

### 2.1 Estrutura
- Leitos individuais monitorizados 24/7.
- Razão enfermeiro:paciente 1:2 (crítico) ou 1:1 (muito crítico).
- Médico intensivista 24/7 na unidade.
- Equipe multi: fisio, farma clínico, nutri, psico, assistente social.

### 2.2 SmartICU — Predição e Alarmes

**Preditores em tempo real:**
- Deterioração hemodinâmica (NEWS2, MEWS, modelo ML próprio).
- Sepse precoce (qSOFA, SIRS, lactato, Δ FC).
- AKI iminente (Δ creatinina, balanço hídrico, diurese).
- Extubação falhada iminente (drivers).
- Delirium (CAM-ICU cada turno).

**Alarmes automatizados:**
- Priorização (alto, médio, baixo).
- Filtragem de ruído (alarmes clinicamente não-actionáveis).
- Escalação se não atendido.

**Dashboard SmartICU:**
- Painel por leito.
- Bundle compliance (VAP, CLABSI, CAUTI).
- Trajetória preditiva.

### 2.3 Fluxo de admissão UTI
1. Solicitação (ED, enfermaria, pós-op, inter-hospitalar).
2. Avaliação pelo intensivista.
3. Priorização (matriz de Sprung-SCCM).
4. Reserva de leito.
5. Preparo (ventilador, monitor, bombas, acesso).
6. Transporte seguro.
7. Handoff formal com equipe multi à beira-leito.
8. Admissão: SAPS 3, APACHE II, plano inicial.

### 2.4 Rotina diária UTI
- Pausa diária de sedação (se elegível).
- Teste de respiração espontânea.
- Mobilização precoce.
- Balanço hídrico.
- Controle glicêmico.
- Avaliação de extubação.
- Revisão de antibiótico (de-escalonamento).
- Prevenção de úlcera e TVP.
- Nutrição enteral precoce.

### 2.5 BRIDGE-ICU — Goals of Care

> **BRIDGE** (Best Recommendation Informed by Data and Goals Evaluation): workflow estruturado para conversas de cuidados alinhados com valores do paciente e família.

**Quando disparar:**
- Admissão de paciente com prognóstico reservado.
- Falha terapêutica após bundle completo.
- LOS UTI > 7 dias sem progressão.
- Pedido da família.
- Pedido do time.

**Estrutura:**
1. **Atualização clínica honesta** para família (prognóstico realista).
2. **Valores e preferências** do paciente (diretivas antecipadas, se houver).
3. **Opções** discutidas (continuar, limitar, paliativo exclusivo).
4. **Recomendação médica.**
5. **Decisão compartilhada** e registrada.
6. **Revisão periódica.**

**Documentação no Velya:**
- Campo estruturado `goals_of_care.status` (full, limited, comfort).
- Diretivas explícitas (RCP, IOT, diálise, transfusão, nutrição artificial).
- Assinatura de dois responsáveis.
- Alerta para toda a equipe.

### 2.6 Saída da UTI
- Estabilidade clínica.
- Desmame de suporte.
- Step-down para semi ou enfermaria.
- Handoff ao receptor.

---

## 3. Centro Cirúrgico

### 3.1 Tipos de procedimento
- **Eletivo** (agendado).
- **Urgência** (nas 24–48h).
- **Emergência** (imediato, vida em risco).
- **Ambulatorial** (sem pernoite).

### 3.2 Fluxo pré-operatório
1. Indicação cirúrgica.
2. Avaliação pré-anestésica.
3. Exames pré-op.
4. Consentimento informado.
5. Reserva de sala + equipe + anestesia + instrumental + hemoderivados + UTI pós (se indicado).
6. Preference card do cirurgião carregado (ReadySet-style).
7. CME prepara sets conforme preference card.
8. Jejum orientado.
9. Medicação pré-anestésica.

### 3.3 Chegada ao centro cirúrgico
- Checagem da identidade + procedimento + lado + consentimento.
- Marcação do sítio cirúrgico (se lateralidade).
- Pulseira conferida.
- Entrada na sala.

### 3.4 Checklist OMS
**Sign-in** (antes da anestesia):
- Identidade, procedimento, sítio, consentimento.
- Monitor, oximetria.
- Alergias.
- Via aérea difícil.
- Risco de perda sanguínea > 500 ml.

**Time-out** (antes da incisão):
- Apresentação da equipe.
- Confirmação verbal: paciente, procedimento, sítio.
- Antibiótico profilático nos últimos 60 min.
- Exames de imagem disponíveis.
- Preocupações críticas (cirurgião, anestesista, enfermagem).

**Sign-out** (antes de sair da sala):
- Procedimento realizado confirmado.
- Contagem de instrumentos, compressas e agulhas.
- Etiquetagem de peças.
- Problemas com equipamentos.
- Recomendações pós-op.

### 3.5 Intra-operatório
- Anestesia conduzida e monitorizada.
- Cirurgia executada.
- Registros de parâmetros a cada 5 min.
- Hemotransfusão se indicada (com double check).
- OPME rastreado.
- Medicamentos administrados registrados.

### 3.6 Pós-operatório
- RPA / PACU: monitorização até critérios de alta da RPA (Aldrete modificado).
- Handoff RPA → enfermaria ou UTI.
- Dor, náuseas, sangramento vigiados.

### 3.7 Integração com SPD (ReadySet-like)
- Preference cards sincronizados em tempo real.
- Alteração de um set no pós-op atualiza o próximo.
- Vendor reps acompanham remotamente.
- SPD vê o turnaround em tempo real.

### 3.8 Métricas do CC
- First case on-time start.
- Turnaround entre cirurgias.
- Taxa de cancelamento.
- Utilização de sala.
- Checklist OMS compliance (100%).
- Contagem correta (100%).

---

## 4. Oncologia / Quimioterapia

### 4.1 Estrutura
- Ambulatório de quimio (poltronas e leitos).
- Enfermagem especializada com certificação.
- Farmácia oncológica com CAC (Cabine de Fluxo Laminar Biológico).
- Integração com banco de sangue (PBM).
- Lab + imagem acoplados.

### 4.2 Fluxo
1. Consulta com oncologista.
2. Protocolo definido (nome + ciclo).
3. Cálculo de dose por BSA ou peso.
4. Exames pré-ciclo (hemograma, função renal, hepática).
5. Autorização do convênio.
6. Agendamento acoplado (farmácia + nursing + lab + transfusão se necessário).
7. Check-in: confirmação de dose + aprovação de ciclo.
8. Preparo da medicação (farmácia, rastreado, com dupla checagem).
9. Administração com double check à beira-leito.
10. Monitorização durante infusão.
11. Alta com orientações e sinais de alarme.

### 4.3 Patient Blood Management (PBM)

> **Princípio PBM:** reduzir transfusões evitáveis, otimizar produção endógena, minimizar perda e tratar anemia de forma não-transfusional quando possível.

**Pilares:**
1. **Otimizar massa eritrocitária** (ferro EV, eritropoetina se indicado).
2. **Minimizar sangramento** (técnica cirúrgica, antifibrinolíticos, cell saver).
3. **Tolerar anemia** (limiares restritivos de transfusão, 7 g/dL em geral).

**No Velya:**
- Pré-check de hemograma antes da cirurgia/quimio.
- Alerta se anemia não tratada.
- CDS para transfusão com critério evidence-based.

### 4.4 CPOE + CDS para transfusão
- Prescrição eletrônica obrigatória.
- Indicação selecionada de lista padrão.
- CDS avisa se Hb está acima do limiar recomendado.
- Registro obrigatório de indicação para transfusão liberal.
- Dupla checagem no beira-leito (bolsa + pulseira).
- Sinais vitais pré + durante + pós.
- Hemovigilância ativa.

### 4.5 Workflow changes
- **Sem pré-booking estrito:** agendamentos são provisórios até confirmação do hemograma.
- **Unidades dedicadas:** aumentam capacidade e reduzem erro.
- **Nursing + lab + farma coordenados**: o paciente fica parado no menor tempo possível.

### 4.6 Métricas
- Tempo de infusão vs planejado.
- Taxa de extravasamento (< 0,5%).
- Taxa de reação adversa transfusional.
- Stewardship de transfusão (% dentro da indicação).
- Atraso de ciclo (< 5%).

---

## 5. Integração entre os Quatro Fluxos

- **ED → UTI** (paciente crítico).
- **ED → Cirurgia** (urgência).
- **Cirurgia → UTI** (pós-op complexo).
- **Enfermaria → UTI** (deterioração).
- **Oncologia → Internação** (complicação, neutropenia febril).
- **Oncologia → Banco de sangue** (transfusão).
- **Qualquer fluxo → Cuidados paliativos** (BRIDGE).

Cada transição é um **handoff explícito**, com SBAR + ack + trace contínuo.
