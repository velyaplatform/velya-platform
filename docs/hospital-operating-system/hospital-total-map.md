# Mapa Total do Hospital — Hospital Operating System

> **Status:** Documento mestre — referência para todo o Hospital Operating System (HOS) do Velya.
> **Objetivo:** Descrever, em um único documento, **todas** as áreas, fluxos, recursos e interações de um hospital de grande porte (500+ leitos, centro cirúrgico de alta complexidade, emergência 24/7, UTI adulto/pediátrica/neonatal, oncologia, hematologia, maternidade, diagnóstico por imagem, laboratório próprio, banco de sangue).

---

## 1. Os 4 Eixos do Hospital

Um hospital não é "um sistema". É **quatro sistemas interligados** operando em paralelo, 24/7, em tempo real. O Velya modela cada eixo como um domínio independente com seus próprios estados, eventos e métricas, mas tudo amarrado por **um único trace por paciente**.

### 1.1 Eixo do Paciente (Patient Axis)
- **O que flui:** pessoas, corpos, riscos clínicos, dor, ansiedade, expectativas, familiares.
- **Unidade básica:** episódio de cuidado (encounter).
- **Estados críticos:** pré-admissão, triagem, espera, atendimento, internação, alta, óbito, transferência.
- **Métricas de saúde do eixo:** door-to-doctor, door-to-balloon, sepsis bundle compliance, mortalidade ajustada por risco, readmissão 30 dias, LOS (length of stay), PROMs (Patient-Reported Outcome Measures).

### 1.2 Eixo da Força de Trabalho (Workforce Axis)
- **O que flui:** médicos, enfermeiros, técnicos, residentes, fisioterapeutas, farmacêuticos, nutricionistas, maqueiros, higienização, manutenção, recepção, faturamento, gestores.
- **Unidade básica:** plantão (shift) + carga de trabalho (assignment).
- **Estados críticos:** disponível, em procedimento, em pausa, em handoff, sobrecarga, fora de escala.
- **Métricas de saúde do eixo:** carga por profissional, razão enfermeiro:paciente, overtime, fadiga cumulativa, incidentes de segurança do paciente por turno, taxa de absenteísmo.

### 1.3 Eixo dos Recursos (Resource Axis)
- **O que flui:** leitos, salas cirúrgicas, equipamentos (ventiladores, monitores, bombas de infusão, ecocardiógrafo, tomógrafo), medicamentos, materiais, hemocomponentes, instrumentais, roupa hospitalar, ambulâncias, cadeiras de rodas, macas.
- **Unidade básica:** asset com máquina de estado própria (ver `patient-journey-and-status-model.md`).
- **Estados críticos:** disponível, ocupado, sujo, em higienização, em manutenção, em esterilização, bloqueado, perdido.
- **Métricas de saúde do eixo:** taxa de ocupação, giro de leito, turnaround de sala cirúrgica, disponibilidade de equipamento crítico, stock-out de medicamento essencial, tempo médio de reprocessamento de instrumental.

### 1.4 Eixo Financeiro (Financial Axis)
- **O que flui:** autorizações, guias, glosas, recursos, pagamentos, custos diretos, custos indiretos, repasses médicos, insumos, convênios, SUS.
- **Unidade básica:** conta do paciente (patient account) + item faturável.
- **Estados críticos:** pré-autorização pendente, em atendimento, em faturamento, em glosa, em recurso, pago, perdido.
- **Métricas de saúde do eixo:** DSO (days sales outstanding), glosa primária, glosa líquida, margem por serviço, custo por paciente-dia, realizado x orçado.

---

## 2. Áreas do Hospital — Visão Total

### 2.1 Áreas Assistenciais (core)
| Área | Função | Ciclo típico | Criticidade |
|---|---|---|---|
| Emergência (PS) | Porta de entrada não eletiva, triagem, estabilização | Minutos a horas | Altíssima |
| UTI Adulto | Suporte avançado à vida — adulto | Dias a semanas | Altíssima |
| UTI Pediátrica | Suporte avançado à vida — pediátrico | Dias a semanas | Altíssima |
| UTI Neonatal | Recém-nascidos de alto risco | Dias a meses | Altíssima |
| Centro Cirúrgico | Cirurgias eletivas e de urgência | Horas | Altíssima |
| Recuperação Pós-Anestésica (RPA/PACU) | Pós-cirúrgico imediato | Horas | Alta |
| Unidade de Internação (enfermaria) | Cuidado hospitalar geral | Dias | Média-alta |
| Unidade Semi-intensiva | Cuidado intermediário | Dias | Alta |
| Centro Obstétrico | Parto, cesárea | Horas | Altíssima |
| Alojamento Conjunto | Mãe + RN pós-parto | Dias | Média |
| Oncologia / Quimioterapia | Tratamento ambulatorial e internação | Horas a meses | Alta |
| Hematologia | Transfusões, TMO | Horas a semanas | Alta |
| Hemodiálise | Terapia renal substitutiva | Horas, recorrente | Alta |
| Ambulatório de Especialidades | Consultas eletivas | Minutos a horas | Baixa-média |
| Hospital Dia | Procedimentos sem pernoite | Horas | Média |
| Cardiologia Intervencionista / Hemodinâmica | Cateterismo, angioplastia | Horas | Altíssima |
| Endoscopia | Diagnóstico e terapêutico | Horas | Média-alta |
| Reabilitação / Fisioterapia | Ambulatorial e hospitalar | Semanas a meses | Média |

### 2.2 Áreas Diagnósticas e Terapêuticas (apoio)
| Área | Função | SLA crítico |
|---|---|---|
| Laboratório Clínico | Análises clínicas | Rotina ≤ 4h, urgente ≤ 60min, crítico ≤ 30min |
| Laboratório de Anatomia Patológica | Biópsias, peças cirúrgicas | Dias a semanas |
| Radiologia / Imagem | RX, TC, RM, US | Urgente ≤ 30min, rotina ≤ 24h |
| Medicina Nuclear | PET-CT, cintilografia | Agendado |
| Banco de Sangue / Hemoterapia | Coleta, processamento, transfusão | Urgência ≤ 60min, O- imediato ≤ 15min |
| Farmácia Clínica / Central | Dispensação, prescrição, gases medicinais | Dose ≤ 30min |
| Central de Material Esterilizado (CME/SPD) | Reprocessamento de instrumentais | Cirurgia ≤ 4h (turnaround crítico) |
| Nutrição e Dietética | Prescrição dietética, preparo, distribuição | 3 refeições/dia + lanches + enterais |
| Fisioterapia Hospitalar | Respiratória, motora, UTI | Diária |
| Fonoaudiologia | Deglutição, voz, comunicação | Diária |
| Psicologia Hospitalar | Apoio paciente/família | Agendado |
| Serviço Social | Alta segura, benefícios, rede | Diária |

### 2.3 Áreas Operacionais (logística clínica)
| Área | Função |
|---|---|
| Central de Regulação de Leitos | Alocar, transferir, liberar leitos |
| Central de Transporte Interno (Maqueiros) | Mover pacientes entre áreas |
| Higienização / Limpeza Hospitalar | Terminal, concorrente, desinfecção |
| Lavanderia | Roupa limpa/suja, barreira biológica |
| Rouparia | Estoque e distribuição |
| Manutenção Predial | Corretiva + preventiva |
| Engenharia Clínica | Equipamentos médico-hospitalares |
| TI / Infraestrutura | Rede, servidores, EHR, integrações |
| Supply Chain / Almoxarifado | Compras, recebimento, distribuição |
| Central de Gases Medicinais | O₂, ar comprimido, vácuo, óxido nitroso |
| Gerador / Utilities | Energia, água, climatização |
| Segurança Patrimonial | Acessos, CFTV, controle de visitas |
| Portaria / Recepção | Cadastro, identificação, visitantes |
| Resíduos (RSS) | Coleta, segregação, destino final |

### 2.4 Áreas Administrativas e Financeiras
| Área | Função |
|---|---|
| Cadastro / Admissão | Abertura de conta, identificação |
| Autorização de Convênios | SADT, internação, OPME |
| Faturamento | Conta paciente, fechamento |
| Glosas e Recursos | Análise, contestação |
| Contas Médicas | Repasse, honorários |
| Controladoria / Custos | Custos por paciente/procedimento |
| Tesouraria / Financeiro | Pagamentos, recebimentos |
| Compras | Cotação, homologação, contrato |
| Recursos Humanos | Escala, folha, treinamento |
| Qualidade e Segurança do Paciente | Indicadores, auditoria, acreditação |
| Ouvidoria / SAC | Queixas, elogios, manifestações |
| Jurídico / Compliance | LGPD, contratos, ações |
| Governança Clínica | CCIH, CFT, CPRH, comitês |

---

## 3. Fluxos Macro (end-to-end)

Todo hospital, independente do porte, opera sobre **aproximadamente 12 fluxos principais**. O Velya modela cada um como um `flow` no domain layer, com eventos, estados e SLOs.

1. **Fluxo Ambulância → ED** (`ambulance-to-ed-flow.md`)
2. **Fluxo Triagem → Atendimento ED** (`triage-and-emergency-flow.md`)
3. **Fluxo Internação Clínica / Enfermaria**
4. **Fluxo UTI** (`inpatient-icu-surgery-oncology-flow.md`)
5. **Fluxo Centro Cirúrgico + SPD**
6. **Fluxo Oncologia / Quimioterapia + Banco de Sangue**
7. **Fluxo Materno-Infantil** (pré-parto, parto, puerpério, neonatal)
8. **Fluxo Diagnóstico** (lab + imagem + anatomia patológica)
9. **Fluxo Medicamentos e Materiais** (`medication-materials-and-assets-lifecycle.md`)
10. **Fluxo Operacional** (limpeza + transporte + manutenção) (`cleaning-maintenance-transport-supply-chain-flow.md`)
11. **Fluxo Revenue Cycle** (`revenue-cycle-and-administrative-flow.md`)
12. **Fluxo de Alta e Continuidade do Cuidado**

Cada fluxo é um **OpenTelemetry trace** no Velya. Um único paciente pode gerar dezenas de traces encadeados, todos amarrados ao mesmo `patient_id` e `encounter_id`.

---

## 4. Interações Críticas Inter-áreas

A maior parte dos erros hospitalares acontece **nas fronteiras entre áreas**, não dentro delas. O Velya modela cada fronteira como um **handoff explícito** com:
- `source_area`, `target_area`
- `source_actor`, `target_actor`
- `patient_id`, `encounter_id`
- `payload` (resumo clínico, pendências, alertas)
- `acknowledged_at` (confirmação ativa do receptor)
- `trace_id` (continuidade no observabilidade)

Exemplos de handoffs críticos:
- EMS → ED (Team-Based Reporting, ePCR)
- ED → UTI (transferência de paciente crítico)
- Bloco Cirúrgico → RPA → Enfermaria
- Plantão → Plantão (troca de turno)
- SPD → Centro Cirúrgico (instrumental estéril disponível)
- Banco de Sangue → Oncologia (bolsa liberada)
- Enfermaria → Alta (pendências + receita + agendamentos)

---

## 5. O Que Esse Documento NÃO Cobre

Este é um mapa. Para profundidade, consulte os outros 14 documentos desta pasta:
- Estados do paciente e recursos → `patient-journey-and-status-model.md`
- Controle de acesso multidimensional → `access-by-role-unit-specialty-task.md`
- Dashboards e command centers → `command-centers-and-dashboards.md`
- Auto-observação do sistema → `observability-and-autonomous-improvement.md`

---

## 6. Princípios de Design do HOS

1. **Um trace por episódio.** Do momento em que o paciente é identificado (ambulância, portaria, agendamento) até a alta administrativa e recebimento da conta, tudo é um trace distribuído.
2. **Handoffs são cidadãos de primeira classe.** Não são "eventos entre etapas" — são etapas.
3. **Status como máquina de estado.** Paciente, leito, sala, equipamento, conta — todos têm state machines explícitas e auditáveis.
4. **Acesso multidimensional.** Nunca apenas "profissão = médico". Sempre profissão + unidade + turno + vínculo com o paciente + tipo de tarefa + criticidade.
5. **Observabilidade clínica nativa.** O mesmo OpenTelemetry que monitora latência de API monitora tempo de triagem, turnaround de sala e porta-balão.
6. **Melhoria contínua por agentes.** O Velya detecta fluxos quebrados (sem dados, SLO estourado, handoff sem ack) e abre automaticamente um ciclo de melhoria.
7. **Core comum + overlays por especialidade.** 80% dos fluxos são iguais em todo hospital. Os 20% restantes são configurados como overlays por service line.
