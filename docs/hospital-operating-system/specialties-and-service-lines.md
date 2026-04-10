# Especialidades e Service Lines — Core + Overlays

> **Princípio:** 80% do hospital é igual em toda parte. Os 20% específicos são **overlays** aplicados por especialidade/service line ao core comum.

---

## 1. O que é Core e o que é Overlay

### 1.1 Core (comum a tudo)
- Identificação do paciente (2 identificadores ativos).
- Prescrição eletrônica (CPOE).
- Administração de medicamentos com barcode.
- Prontuário eletrônico unificado.
- Sinais vitais e scores (MEWS/NEWS2, PEWS, qSOFA).
- Reconciliação medicamentosa.
- Reavaliação de risco (queda, úlcera, TEV, delirium).
- Alta segura.
- Handoff de turno.
- Registro de alergias.
- Resultado crítico (alerta + ack).
- Consentimento informado.
- Rastreabilidade de materiais e medicamentos.
- Revenue cycle.
- Observabilidade clínica.

### 1.2 Overlay (por especialidade)
Cada service line herda o core e adiciona:
- **Protocolos clínicos específicos.**
- **Formulários e coleta de dados.**
- **Métricas e SLOs próprios.**
- **Fluxos específicos.**
- **Recursos e equipamentos dedicados.**
- **Equipes e competências.**
- **Integrações externas específicas.**
- **Regras de faturamento próprias (OPME, honorários).**

---

## 2. Service Lines Principais

## 2.1 Emergência / Pronto Socorro

**Core adicional:**
- Triagem MTS/ESI.
- Fast-track.
- Sala vermelha.
- Observação (máx 24h).
- Porta-balão, porta-agulha, bundle sepsis, AVC agudo.

**Protocolos ativos:**
- Código AVC (tempo porta-agulha ≤ 60 min).
- Código IAM (porta-balão ≤ 90 min).
- Código sepse (bundle 1h).
- Código trauma azul (trauma grave).
- Código azul (PCR).
- Código amarelo (criança grave).

**Métricas:**
- Door-to-doctor
- Door-to-disposition
- LWBS (left without being seen) < 2%
- LOS ED < 4h
- Boarding time (paciente admitido ainda na ED)

## 2.2 UTI Adulto

**Core adicional:**
- Monitorização hemodinâmica invasiva.
- Ventilação mecânica (prescrição de parâmetros).
- Bundle VAP, bundle CLABSI, bundle CAUTI.
- Sedação (RASS), analgesia (BPS/CPOT).
- Delirium (CAM-ICU).
- Goals of care (BRIDGE-ICU).
- Mobilização precoce.

**SmartICU:**
- Preditores de complicações (deterioração, sepse, AKI).
- Alarmes automatizados.
- Painel de bundle compliance.

**Métricas:**
- Taxa de VAP, CLABSI, CAUTI por 1000 dias-dispositivo.
- Mortalidade ajustada (SAPS 3, APACHE).
- Tempo de VM.
- LOS UTI.
- Reinternação UTI < 48h.

## 2.3 UTI Pediátrica e Neonatal

**Core adicional:**
- Dosagem por peso (mg/kg) com checagem dupla.
- PEWS (Pediatric Early Warning Score).
- Escalas de dor pediátricas (FLACC, NIPS).
- Incubadora + termorregulação (neonatal).
- Método canguru.
- Fototerapia.
- NPT pediátrica.

**Métricas:**
- Peso ao nascer, tempo de ventilação, dias de vida.
- Retinopatia da prematuridade (ROP) screening.
- Aleitamento materno exclusivo na alta.

## 2.4 Centro Cirúrgico

**Core adicional:**
- Checklist cirúrgico OMS (3 pausas: sign-in, time-out, sign-out).
- Reserva de sala + equipe + equipamentos.
- Preference cards (preferência de cada cirurgião).
- Instrumentais rastreados (CME/SPD).
- Pausa cirúrgica (time-out) gravada.
- Contagem de compressas e instrumentos.
- Integração com banco de sangue (reserva de hemoderivados).

**Fluxo (ver `inpatient-icu-surgery-oncology-flow.md`):**
- Pré-op → preparo → sala → intra-op → RPA → enfermaria / UTI.

**Métricas:**
- First case on-time start.
- Turnaround time entre cirurgias.
- Taxa de cancelamento.
- Utilização de sala.
- Eventos de segurança cirúrgica.

## 2.5 Oncologia / Hematologia

**Core adicional:**
- Protocolos de quimioterapia (regimes padrão, ciclos).
- Cálculo de dose por superfície corporal (BSA) ou peso.
- Duplo check obrigatório para quimio.
- Agendamento acoplado (nutrição, lab, farmácia, enfermagem).
- Toxicidade (CTCAE grau 1-5).
- Infusão segura (bomba + checagem).
- Extravasamento (protocolo de emergência).
- Port-a-cath / PICC management.

**Patient Blood Management (PBM):**
- Avaliação de anemia pré-transfusão.
- CPOE com CDS para transfusão (critérios baseados em evidência).
- Economizadores de sangue cell-saver.
- Hemovigilância ativa.

**Métricas:**
- Tempo infusão-coleta.
- Taxa de atraso de ciclo.
- Incidência de extravasamento.
- Taxa de transfusão por paciente.

## 2.6 Cardiologia

**Core adicional:**
- ECG integrado ao prontuário.
- Telemetria contínua em unidades coronarianas.
- Hemodinâmica (cateterismo, angioplastia primária).
- Pacemakers e dispositivos (DAI, TRC).
- Teste ergométrico.

**Protocolos:**
- Dor torácica (HEART score).
- SCA (síndrome coronariana aguda).
- Insuficiência cardíaca descompensada.

## 2.7 Neurologia / Neurocirurgia

**Core adicional:**
- Escala de Glasgow (GCS), NIHSS (AVC).
- Trombólise (rtPA) com janela terapêutica.
- Trombectomia mecânica.
- Monitorização de PIC.
- EEG contínuo.

## 2.8 Ortopedia / Trauma

**Core adicional:**
- Protocolo de fratura de fêmur em idoso (cirurgia ≤ 48h).
- OPME (materiais implantáveis).
- Fast-track ortopédico.
- Trauma grave (protocolo ATLS).

## 2.9 Pediatria Geral

**Core adicional:**
- Dosagem por peso.
- Vacinação.
- Aleitamento.
- Proteção contra maus-tratos (detecção + notificação).
- Acompanhante 24h garantido.

## 2.10 Materno-Infantil

**Core adicional:**
- Pré-natal consolidado.
- Parto humanizado.
- Partograma digital.
- Cardiotocografia integrada.
- Hemorragia pós-parto (bundle).
- Pré-eclâmpsia (bundle).
- Contato pele a pele imediato.
- Alojamento conjunto.
- Triagem neonatal (pezinho, ouvinho, olhinho, coraçãozinho, linguinha).

## 2.11 Hemodiálise

**Core adicional:**
- Máquinas rastreadas.
- Água ultrapura.
- Cronograma do paciente dialítico.
- Acesso vascular (fístula, cateter).
- Ajuste de medicamento por clearance.

## 2.12 Hospital Dia

**Core adicional:**
- Procedimentos sem pernoite.
- Critérios de alta no mesmo dia.
- Follow-up 24h.

## 2.13 Ambulatório

**Core adicional:**
- Agendamento.
- Telemedicina.
- Receitas ambulatoriais.
- Encaminhamentos.

---

## 3. Overlays Especializados Menores

- **Transplante:** lista única, compatibilidade, imunossupressão, CCIH rigorosa.
- **Queimados:** protocolos de fluidos (Parkland), curativos, nutrição hipercalórica.
- **Psiquiatria:** contenção, medicação involuntária, liberdade vigiada, alta assistida.
- **Geriatria:** avaliação ampla do idoso, polifarmácia, risco de queda alto.
- **Cuidados paliativos:** controle de sintomas, planejamento avançado, aconselhamento de família.
- **Endoscopia:** sedação consciente, diagnóstico e terapêutico.
- **Radioterapia:** planejamento, simulação, entrega.
- **Transplante de medula óssea:** isolamento reverso, CMV, EBV, GVHD.

---

## 4. Como o Velya Configura um Overlay

Cada service line é definida por um arquivo `overlay.yaml`:

```yaml
overlay:
  id: oncology_adult
  inherits: core
  forms:
    - chemo_protocol_v2
    - ctcae_assessment
  scores:
    - ecog
    - karnofsky
  alerts:
    - extravasation_emergency
    - neutropenic_fever
  dashboards:
    - oncology_command_center
  slos:
    infusion_delay_p95: 30min
    double_check_coverage: 100%
  integrations:
    - blood_bank_pbm
    - pharmacy_chemo_prep
  access_rules:
    - chemo_prescription_requires_certified_oncologist
    - chemo_admin_requires_certified_oncology_nurse
```

O core não muda. O overlay aplica tudo em cima automaticamente.

---

## 5. Relação Específica Entre Áreas

Algumas áreas são **profundamente acopladas**:
- **Centro cirúrgico + CME/SPD + banco de sangue + farmácia + anestesia.**
- **Oncologia + farmácia oncológica + laboratório + banco de sangue + nutrição.**
- **UTI + fisio respiratória + farmácia clínica + lab crítico + imagem.**
- **Maternidade + neonatal + laboratório + banco de sangue + pediatria.**
- **ED + lab urgente + imagem 24h + banco de sangue + UTI.**

Cada acoplamento tem SLAs mútuos e dashboards cruzados.

---

## 6. Evolução de Overlays

Um overlay é **versionado**. Atualizações de protocolo (ex: nova diretriz de sepse, novo regime de quimio) criam uma nova versão que:
1. Entra em modo shadow (executa em paralelo, não substitui).
2. Após validação clínica, vira default.
3. A versão antiga permanece disponível para casos em curso.
