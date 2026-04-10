# Triagem e Fluxo da Emergência

> **Escopo:** do momento em que o paciente atravessa a porta da ED (walk-in ou ambulância) até a disposition (alta, observação, internação, transferência, óbito).

---

## 1. Princípios

1. **Ninguém espera sem ser classificado.** Triagem em ≤ 5 minutos da chegada.
2. **Classificação determina prioridade, não ordem de atendimento rígida.** Reavaliação obrigatória.
3. **O tempo é parte do diagnóstico.** Atrasos mudam desfechos (AVC, IAM, sepse, trauma).
4. **Nenhum paciente fica invisível.** Heartbeat contínuo, reavaliação periódica.
5. **Fast-track para casos simples.** Libera a ED principal para os graves.

---

## 2. Protocolos de Triagem

### 2.1 Manchester Triage System (MTS)
Cinco níveis, cinco cores, cinco tempos máximos:

| Nível | Cor | Descrição | Tempo máximo |
|---|---|---|---|
| 1 | Vermelho | Emergente (risco iminente de vida) | 0 min |
| 2 | Laranja | Muito urgente | 10 min |
| 3 | Amarelo | Urgente | 60 min |
| 4 | Verde | Pouco urgente | 120 min |
| 5 | Azul | Não urgente | 240 min |

### 2.2 ESI (Emergency Severity Index)
Cinco níveis baseados em:
- Ameaça à vida imediata (nível 1)
- Risco alto ou dor severa (nível 2)
- Quantidade de recursos necessários (níveis 3, 4, 5)

### 2.3 No Velya
- Escolha configurável por hospital (MTS ou ESI).
- Formulário digital guiado.
- Discriminadores/apresentações clínicas mapeadas.
- Sinais vitais coletados automaticamente quando possível.
- Tempo de triagem cronometrado.

---

## 3. Estrutura da ED

### 3.1 Áreas funcionais
- **Recepção / admissão**
- **Sala de triagem** (triage desk)
- **Sala vermelha / reanimação** (red room) — parada, trauma grave
- **ED principal** (bays monitorizadas)
- **Fast-track** (casos simples, pediátricos leves)
- **Área de observação** (máx 24h)
- **Sala de isolamento** (respiratório, contato)
- **Sala de sutura / procedimentos**
- **Sala de ortopedia / gesso**
- **Sala de sedação**
- **Sala de psiquiatria** (ambiente protegido)
- **Psicossocial / serviço social**

### 3.2 Bays
Cada bay tem:
- `bay_id`, `status` (AVAILABLE, OCCUPIED, CLEANING, BLOCKED)
- `monitor_type` (cardíaco, respiratório, invasivo)
- `equipment_attached`
- `patient_id` (se ocupado)
- `primary_nurse_id`
- `assigned_physician_id`

---

## 4. Fluxo Detalhado

### 4.1 Chegada
- Walk-in: recepção → triagem.
- Ambulância: direto à bay ou red room (pré-notificação).

### 4.2 Triagem (≤ 5 min)
- Identificação rápida.
- Queixa principal.
- Sinais vitais.
- Discriminadores MTS/ESI.
- Nível e cor atribuídos.
- Alergias conhecidas.
- Histórico relevante (diabetes, HAS, anticoag, gestação).
- Fast-track ou ED principal?

### 4.3 Alocação
- **Vermelho:** direto à red room.
- **Laranja:** bay monitorizada + médico em ≤ 10 min.
- **Amarelo:** bay comum + médico em ≤ 60 min.
- **Verde:** sala de fast-track se disponível.
- **Azul:** fast-track ou orientação ambulatorial.

### 4.4 Espera
- Sala de espera com monitoramento visual e chamada digital.
- Sinais vitais reavaliados por enfermeiro conforme nível.
- Qualquer piora → reclassificação (upgrade).

### 4.5 Atendimento médico
- Anamnese, exame físico.
- Solicitação de exames (lab, imagem).
- Prescrição de medicamentos (analgesia, antiemético, antibiótico, etc.).
- Observação clínica.
- Reavaliações.

### 4.6 Diagnóstico
- Integração com lab (resultado em ≤ 60 min para urgente).
- Imagem (TC ≤ 30 min em urgente).
- Banco de sangue (reserva se necessário).

### 4.7 Decisão (disposition)
- Alta da ED (com receita e orientações).
- Observação (máx 24h, reavalia).
- Internação clínica (solicitação → central de leitos).
- Internação UTI (solicitação → leito UTI + transporte).
- Centro cirúrgico (direto da ED).
- Transferência inter-hospitalar (regulação).
- Óbito (protocolo de óbito + declaração).

---

## 5. Protocolos Tempo-Dependentes

### 5.1 Sepse
- **Bundle 1 hora:** lactato, hemocultura, antibiótico, fluido, vasopressor se necessário.
- **Dashboard dedicado** com cronômetro.

### 5.2 AVC isquêmico
- **Tempo porta-agulha ≤ 60 min.**
- NIHSS na triagem.
- TC crânio em ≤ 25 min.
- Trombólise IV (rtPA) na janela 4,5h.
- Trombectomia mecânica até 24h em casos selecionados.

### 5.3 IAM com supra
- **Tempo porta-balão ≤ 90 min.**
- ECG em ≤ 10 min.
- Ativação da hemodinâmica.
- AAS + antiagregante + heparina + estatina.

### 5.4 Trauma grave
- Equipe de trauma acionada.
- ATLS.
- FAST eco na red room.
- TC body.
- Reserva de hemoderivados.
- Centro cirúrgico em standby.

### 5.5 PCR
- Código azul.
- RCP imediata.
- Carro de parada.
- Desfibrilação.
- Medicamentos ACLS.
- Documentação cronometrada.

---

## 6. Fast-Track

### 6.1 Critérios
- Paciente verde/azul.
- Queixa simples (corte, dor menor, resfriado, baixa febre).
- Sem instabilidade.
- Recurso único (uma consulta + receita).

### 6.2 Tempos
- Porta → alta em ≤ 90 min no fast-track.
- Enfermeiro + médico de suporte + balcão de farmácia ambulatorial adjacente.

---

## 7. Reavaliação

### 7.1 Por nível
- **Vermelho:** contínuo.
- **Laranja:** a cada 10 min.
- **Amarelo:** a cada 30 min.
- **Verde:** a cada 60 min.
- **Azul:** a cada 120 min.

### 7.2 Dor
- Escala EVA 0–10.
- Reavaliação a cada 30 min para pacientes com dor ≥ 4.
- Dor ≥ 7 escala para amarelo.

### 7.3 Idosos, gestantes e crianças
- Escalas específicas (PEWS para pediatria).
- Reavaliação mais frequente.

---

## 8. Boarding

### 8.1 Definição
Paciente já admitido (decisão de internação) mas ainda fisicamente na ED aguardando leito.

### 8.2 Problema
Boarding degrada a ED inteira — menos capacidade para novos pacientes.

### 8.3 No Velya
- Métrica `boarding_count` e `boarding_time_p95`.
- Alerta quando boarding > X% da ED.
- Escala para central de leitos e direção.

---

## 9. Saída de Pacientes da ED

### 9.1 Alta da ED
- Reconciliação medicamentosa.
- Receita digital.
- Orientações (teach-back).
- Agendamento de retorno se aplicável.

### 9.2 Observação
- Prescrição de observação.
- Reavaliações q2h.
- Decisão final em ≤ 24h.

### 9.3 Internação
- Ordem de internação.
- Central de leitos.
- Transporte interno.
- Handoff para enfermaria/UTI.

### 9.4 Transferência externa
- Central de regulação.
- Aceite do hospital destino.
- Ambulância.
- Handoff ao transporte.

### 9.5 Saída à revelia
- Documentação formal.
- Termo assinado.
- Orientação clara sobre riscos.

### 9.6 Óbito
- Atestado de óbito.
- Comunicação à família.
- Protocolo de óbito (IML se indicado).

---

## 10. Métricas Principais

| Métrica | Meta |
|---|---|
| Door-to-triage | ≤ 5 min |
| Door-to-doctor (vermelho) | 0 min |
| Door-to-doctor (amarelo) | ≤ 60 min |
| Door-to-needle (AVC) | ≤ 60 min |
| Door-to-balloon (IAM) | ≤ 90 min |
| Sepse bundle 1h compliance | ≥ 85% |
| LWBS (left without being seen) | < 2% |
| LOS ED | ≤ 4h (mediana) |
| Boarding time | ≤ 2h |
| Fast-track LOS | ≤ 90 min |

---

## 11. Observabilidade

- Trace clínico por paciente na ED.
- Spans: arrival → triage → wait → exam → tests → decision → disposition.
- SLOs ativos.
- No-data detection: paciente com espera > SLA sem evento → alerta.
- Reclassificação automática proposta se dor piorou.
