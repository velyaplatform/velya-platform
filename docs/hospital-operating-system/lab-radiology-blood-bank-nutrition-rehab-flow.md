# Áreas Diagnósticas e Terapêuticas — Lab, Imagem, Banco de Sangue, Nutrição, Reabilitação

> **Escopo:** serviços de apoio que sustentam todo o cuidado clínico. Cada um com ciclo próprio, SLAs, integrações e métricas.

---

## 1. Laboratório Clínico

### 1.1 Tipos de exame
- **Rotina:** bioquímica, hematologia, urinálise, coagulograma.
- **Urgência:** eletrólitos, gasometria, troponina, D-dímero, lactato.
- **Crítico:** em tempo real, com resultado panic value.
- **Especial:** hormônios, marcadores tumorais, sorologia, autoimunidade.
- **Microbiologia:** hemocultura, cultura de secreções, antibiograma.
- **Biologia molecular:** PCR viral, NAT, genômica.

### 1.2 Fluxo
```
[solicitação médica] → [cadastro no LIS] → [etiqueta com barcode] →
[coleta] → [transporte à central] → [triagem pré-analítica] →
[processamento/automação] → [validação técnica] →
[validação clínica] → [liberação no PEP] → [ação clínica]
```

### 1.3 Etapas detalhadas

**Solicitação (CPOE):**
- Prescrição eletrônica.
- Motivo clínico.
- Prioridade (rotina, urgente, crítico).
- Identificação automática do requisitante.

**Coleta:**
- Coletador + paciente confirmados por barcode.
- Tubos corretos (ordem de coleta).
- Jejum se necessário.
- Registro de timestamp e condições.

**Transporte:**
- Caixas térmicas para amostras sensíveis.
- Tubo pneumático para urgências em alguns hospitais.
- Rastreamento da amostra em cada etapa.

**Pré-analítica:**
- Recebimento central.
- Conferência: identificação, integridade, quantidade, hemólise.
- Triagem automática.

**Analítica:**
- Automação (linhas de esteira, analisadores integrados).
- Controles de qualidade internos por lote.

**Pós-analítica:**
- Validação técnica (biomédico).
- Validação clínica (patologista clínico).
- **Resultado crítico (panic value):** alerta ativo.

### 1.4 Resultado crítico
- Valor fora da faixa predefinida (ex: K⁺ > 6,5).
- Notificação síncrona ao médico (app + pager + ligação).
- Timer de 30 min para ack.
- Registro nominal: quem foi notificado, quando, por qual meio.
- Escalação automática se não reconhecido.

### 1.5 SLAs
| Tipo | Meta |
|---|---|
| Urgente coleta → resultado | ≤ 60 min |
| Crítico coleta → alerta | ≤ 30 min |
| Rotina coleta → resultado | ≤ 4 h |
| Sorologia | ≤ 24 h |
| Cultura (final) | 3–5 dias |

### 1.6 Integração
- LIS ↔ EHR via HL7/FHIR.
- Analisadores ↔ LIS via HL7/ASTM.
- POCT (point of care) com validação cruzada.

---

## 2. Radiologia e Diagnóstico por Imagem

### 2.1 Modalidades
- Raio-X convencional.
- Tomografia computadorizada (TC).
- Ressonância magnética (RM).
- Ultrassom (US, Doppler).
- Mamografia.
- Fluoroscopia.
- Densitometria.
- Medicina nuclear (gamma, PET-CT, PET-RM).
- Angiografia e hemodinâmica (intervencionistas).

### 2.2 Fluxo
```
[solicitação] → [justificativa clínica] → [triagem] →
[preparo do paciente] → [agendamento] → [transporte] →
[exame] → [upload de imagens ao PACS] →
[laudo pelo radiologista] → [liberação] → [ação clínica]
```

### 2.3 Urgências de imagem
- TC crânio urgente: ≤ 30 min na ED.
- TC angio coronária: ≤ 45 min (SCA).
- US FAST na ED: ≤ 5 min (trauma).
- Laudo urgente: ≤ 60 min após exame.

### 2.4 Integração
- RIS (Radiology Information System) + PACS + EHR.
- DICOM padrão.
- Teleradiologia para cobertura 24/7.
- IA como apoio (triagem de achados críticos).

### 2.5 Proteção radiológica
- Dose rastreada por paciente (DLP, mSv).
- ALARA (As Low As Reasonably Achievable).
- Gestantes: protocolo específico.
- Pediatria: doses ajustadas.

### 2.6 Métricas
- Tempo solicitação → exame (urgente ≤ 30 min).
- Tempo exame → laudo (urgente ≤ 60 min).
- Taxa de repetição.
- Taxa de achados incidentais.
- Dose média por tipo de exame.

---

## 3. Banco de Sangue / Hemoterapia

### 3.1 Áreas funcionais
- **Captação de doadores** (campanhas, banco próprio, externa).
- **Coleta** (seleção, triagem clínica, sorológica).
- **Processamento** (separação em componentes).
- **Controle de qualidade** (NAT, sorologia, tipagem).
- **Estoque** (câmara específica por componente).
- **Liberação** (pré-transfusional + cross-match).
- **Distribuição** (entrega às unidades).
- **Hemovigilância** (reações).

### 3.2 Componentes
- Concentrado de hemácias.
- Plasma fresco congelado.
- Concentrado de plaquetas.
- Crioprecipitado.

### 3.3 Fluxo de transfusão
1. Indicação clínica com CDS.
2. Tipagem + prova cruzada.
3. Liberação com dupla checagem (bolsa + paciente).
4. Sinais vitais pré-transfusão.
5. Instalação lenta nos primeiros 15 min.
6. Monitorização contínua.
7. Sinais vitais pós-transfusão.
8. Registro completo.
9. Hemovigilância (reações).

### 3.4 Patient Blood Management (PBM)
- Redução de transfusões evitáveis.
- Ferro EV para anemia ferropriva.
- Eritropoetina em renais crônicos.
- Limiar restritivo (Hb 7 g/dL em geral).
- Cell saver intraoperatório.

### 3.5 Urgência máxima
- Trauma grave / hemorragia maciça: O negativo imediato.
- Protocolo de transfusão maciça (MTP): 1:1:1 (hemácia:plasma:plaqueta).
- Cooler portátil para centro cirúrgico.

### 3.6 SLAs
- Rotina: ≤ 4h.
- Urgência: ≤ 60 min.
- Emergência: ≤ 15 min (O-).

---

## 4. Nutrição e Dietética

### 4.1 Atividades
- Avaliação nutricional na admissão (SGA, MUST, NRS-2002).
- Prescrição dietética.
- Produção (cozinha hospitalar).
- Distribuição por leito.
- Reavaliação periódica.
- Nutrição enteral e parenteral.
- Orientação de alta.

### 4.2 Fluxo diário
```
[prescrição médica] → [avaliação do nutricionista] →
[cardápio ajustado] → [preparo na cozinha] →
[distribuição] → [administração] → [aceitação] →
[reavaliação]
```

### 4.3 Dietas especiais
- Enteral por sonda (cálculo calórico/proteico).
- Parenteral total (TPN) — preparo em farmácia.
- Diabéticos, renais, hepáticos.
- Consistências (pastosa, branda, líquida).
- Alergias e intolerâncias.
- Prescrição pediátrica.

### 4.4 Segurança alimentar
- Cadeia de frio.
- POPs de higiene.
- Cultura periódica.
- Identificação com pulseira + foto ao distribuir.

### 4.5 Métricas
- Avaliação nutricional em ≤ 48h da admissão (100%).
- Aceitação da dieta.
- Desnutrição hospitalar.
- Tempo de enteral precoce.

---

## 5. Reabilitação

### 5.1 Áreas
- Fisioterapia motora (ambulatorial e hospitalar).
- Fisioterapia respiratória.
- Fisioterapia UTI (mobilização precoce, desmame).
- Terapia ocupacional.
- Fonoaudiologia (deglutição, voz).
- Psicologia (apoio ao processo).

### 5.2 Fluxo
- Solicitação médica.
- Avaliação inicial.
- Plano individualizado.
- Sessões diárias / semanais.
- Reavaliação periódica.
- Relatório de alta.

### 5.3 UTI mobilização precoce
- Protocolo validado (ex: ICU Mobility Scale).
- Iniciar em 24–72h se estável.
- Reduz LOS, previne fraqueza.

### 5.4 Deglutição
- Avaliação fono antes de reintroduzir dieta oral pós-extubação, AVC, cirurgia.
- Protocolo de segurança.

### 5.5 Métricas
- Cobertura em UTI (≥ 90% dos elegíveis).
- Dias de VM.
- Retirada de traqueostomia.
- Independência funcional na alta.

---

## 6. Anatomia Patológica

### 6.1 Materiais
- Biópsias (endoscópicas, cirúrgicas, percutâneas).
- Peças cirúrgicas.
- Citologia.
- Necrópsias.

### 6.2 Fluxo
- Etiquetagem e envio ao laboratório.
- Macroscopia.
- Processamento (parafina).
- Corte + coloração.
- Leitura microscópica.
- Imuno-histoquímica se indicado.
- Laudo.
- Correlação clínico-patológica.

### 6.3 SLA
- Biópsia: 7–10 dias úteis.
- Peça cirúrgica: 10–15 dias úteis.
- Congelação intra-op: minutos.

### 6.4 Casos oncológicos
- Discussão em tumor board.
- Integração com oncologia, cirurgia, radioterapia.

---

## 7. Farmácia Clínica

### 7.1 Atividades
- Validação de prescrição.
- Reconciliação medicamentosa.
- Acompanhamento de pacientes críticos.
- Stewardship de antibióticos.
- Farmacovigilância.
- Orientação de alta.
- Manipulação de quimio e NPT.

### 7.2 Fluxo
- Revisão diária das prescrições da unidade sob cobertura.
- Intervenções registradas.
- Comunicação com prescritor.
- Educação continuada.

### 7.3 Métricas
- Intervenções aceitas (%).
- Reconciliação feita em < 24h (100%).
- Taxa de erro de medicação (< meta).
- Stewardship antibiótico (de-escalonamento).

---

## 8. Integração Global

Todos os serviços diagnósticos e terapêuticos compartilham:
- Um único `patient_id` e `encounter_id`.
- Eventos publicados no mesmo stream.
- Trace clínico contínuo.
- Dashboards acoplados.
- SLAs auditáveis.

Quebras de fluxo (resultado não liberado, laudo atrasado, transfusão sem indicação, dieta não entregue) são detectadas por `observability-and-autonomous-improvement.md`.
