# Acesso por Papel, Unidade, Especialidade e Tarefa

> **Escopo:** modelo formal de autorização contextual do Velya. Como determinar, em tempo real, se um profissional pode executar uma ação específica sobre um recurso específico.

---

## 1. Por que o RBAC tradicional não resolve

Modelos simples do tipo "médico pode ler prontuário" falham porque:
- Um médico **não** pode ler qualquer prontuário — apenas dos pacientes com quem tem vínculo.
- O vínculo varia por turno, unidade, especialidade e contexto.
- O mesmo profissional muda de papel várias vezes no dia.
- Situações de emergência exigem break-glass auditado.
- LGPD, HIPAA e acreditação exigem **minimum necessary**.

O Velya usa **ABAC + contexto clínico + relacionamentos explícitos**.

---

## 2. Dimensões do Acesso

### 2.1 Dimensões do sujeito
| Dimensão | Exemplo | Fonte |
|---|---|---|
| `profession` | médico, enfermeiro, farma, tec, admin | cadastro |
| `function` | assistente, plantonista, consultor, residente | escala + parecer |
| `employment_type` | CLT, PJ, cooperado, residente, terceirizado | RH |
| `specialty` | cardio, UTI, ped, oncologia | cadastro + certificação |
| `certifications` | ACLS, PALS, OncoNurse, ANS-SV | cadastro com validade |
| `shift_active` | 2026-04-09 07:00–19:00 | escala |
| `unit_assignment` | ED bay 5, UTI leito 8, BC sala 3 | alocação do turno |
| `supervisor` | R2 → staff X | formação |
| `clearance_level` | VIP, pediátrico, psiquiátrico | configuração |

### 2.2 Dimensões do recurso (objeto)
| Dimensão | Exemplo |
|---|---|
| `patient_id` | paciente alvo |
| `encounter_id` | episódio ativo |
| `unit` | UTI Adulto |
| `specialty` | oncologia |
| `sensitive_flags` | HIV, gestação adolescente, VIP, judicialização |
| `clinical_state` | crítico, estável, em procedimento |
| `confidentiality_level` | padrão, restrito, máximo |

### 2.3 Dimensões da ação
| Dimensão | Exemplo |
|---|---|
| `task_type` | read, prescribe, administer, sign, discharge, transfer, amend |
| `criticality` | rotineiro, urgente, emergente, vital |
| `reversibility` | reversível, irreversível |
| `data_scope` | meta, clinical, genetic, mental_health |

### 2.4 Dimensões do contexto
| Dimensão | Exemplo |
|---|---|
| `location_device` | dentro do hospital, dentro da unidade, dispositivo gerenciado |
| `time_of_day` | dentro do turno, fora do turno |
| `purpose_of_use` | treatment, payment, operations, research, committee |
| `emergency_flag` | false, true (break-glass) |

---

## 3. Função de Decisão

```
decision = allow | deny | allow_with_justification | allow_with_cosign

decision = policy_engine.evaluate(
  subject: {profession, function, unit_assignment, shift, certifications, ...},
  object: {patient, encounter, unit, sensitive_flags, ...},
  action: {task_type, criticality, ...},
  context: {time, location, purpose_of_use, emergency, ...}
)
```

### 3.1 Exemplo de política
```yaml
policy: physician_can_prescribe_chemo
effect: allow
when:
  subject.profession: physician
  subject.certifications: [oncology_certified]
  subject.function: [assistente, plantonista]
  object.specialty: oncology
  object.patient.in_care_team: true
  action.task_type: prescribe
  action.criticality: routine
require:
  - cosign_by_pharmacist_oncology
```

---

## 4. Relacionamento Paciente-Profissional

### 4.1 Tipos
- `ASSIGNED_ATTENDING` — médico assistente principal
- `ON_CALL_PHYSICIAN` — plantonista da unidade no turno
- `CONSULT_REQUESTED` — parecer solicitado
- `PRIMARY_NURSE` — enfermeiro responsável do turno
- `TEAM_MEMBER` — integrante da equipe multi
- `TRANSPORTER` — maqueiro durante transporte
- `HOUSEKEEPER` — higienização do leito
- `BILLING_AUDITOR` — retrospectivo
- `QUALITY_REVIEWER` — comitê

### 4.2 Criação do vínculo
- Automática: quando o profissional é escalado para a unidade do paciente no turno.
- Manual: solicitação de parecer, transferência.
- Por tarefa: maqueiro recebe vínculo temporário para executar transporte.

### 4.3 Expiração
- Fim do turno.
- Fim do parecer (72h padrão).
- Alta do paciente.
- Mudança de unidade.
- Fim da tarefa.

---

## 5. Matriz de Permissões — Exemplos

| Sujeito | Recurso | Ação | Resultado |
|---|---|---|---|
| Médico plantonista ED, turno ativo | Paciente fisicamente na ED | read, prescribe, admit | allow |
| Médico plantonista ED, turno ativo | Paciente da UTI (sem vínculo) | read | deny (sem break-glass) |
| Médico cardiologista, parecer solicitado | Paciente X, 72h | read + add_note | allow |
| Enfermeira UTI, alocada ao leito 3 | Paciente do leito 3 | read, administer, vitals, notes | allow |
| Enfermeira UTI, mesma UTI, outro leito | Paciente leito 5 | read | allow (mesma unidade) |
| Enfermeira UTI, mesma UTI, outro leito | Paciente leito 5 | administer medication | deny (sem vínculo direto) |
| Farmacêutico clínico | Paciente de unidade sob sua cobertura | read_prescriptions, suggest_change | allow |
| Farmacêutico clínico | Paciente de unidade sob sua cobertura | prescribe | deny |
| Maqueiro durante transporte | Paciente sendo transportado | read_minimal (nome, destino, precauções) | allow |
| Recepcionista | Paciente no check-in | read_demographics, update_demographics | allow |
| Faturista | Paciente de alta | read_billing, read_summary | allow |
| Auditor de glosa | Conta em disputa | read_full_encounter | allow (com trilha) |
| Residente R1 | Paciente sob supervisão | write_notes, propose_prescription | allow (cosign required) |
| Residente R1 | Paciente sob supervisão | final discharge | deny (staff only) |

---

## 6. Break-Glass (Quebra de Vidro)

### 6.1 Quando é permitido
- Emergência clínica imediata.
- Paciente inconsciente sem equipe identificada.
- Código azul em unidade não habitual.
- Transferência crítica durante handoff.

### 6.2 Como funciona
1. Usuário clica "Break Glass" na tela de acesso negado.
2. Sistema exige:
   - `reason_code`
   - `free_text_justification`
   - Segundo fator (biometria, PIN).
3. Acesso é concedido por tempo limitado (15–60 min).
4. Evento `break_glass.invoked` é logado com severidade alta.
5. Auditoria humana é disparada automaticamente em até 24h.
6. Notificação para chefe de turno + NSP + LGPD officer.

### 6.3 Abuso
- Múltiplos break-glass sem justificativa crível → suspensão temporária + investigação.

---

## 7. Propósito de Uso (Purpose of Use)

Cada acesso é marcado com um dos propósitos:
- `TREATMENT` — cuidado direto do paciente
- `PAYMENT` — faturamento e glosas
- `OPERATIONS` — gestão, qualidade, acreditação
- `RESEARCH` — pesquisa com aprovação ética
- `COMMITTEE_REVIEW` — comitê de óbito, ética, qualidade
- `LEGAL` — resposta a intimação
- `PATIENT_REQUEST` — paciente solicitando seus próprios dados

O purpose muda o que é visível (ex: `RESEARCH` nunca mostra identificadores diretos).

---

## 8. Dados Sensíveis e Restrições Adicionais

### 8.1 Flags
- `HIV_STATUS`
- `MENTAL_HEALTH`
- `SUBSTANCE_ABUSE`
- `REPRODUCTIVE_HEALTH`
- `GENETIC`
- `VIP_PATIENT`
- `CELEBRITY`
- `EMPLOYEE_AS_PATIENT`
- `LEGAL_CASE`

### 8.2 Regras
- Funcionário como paciente: acesso apenas pela equipe direta + medicina do trabalho.
- VIP/celebridade: acesso logado com alerta em tempo real.
- Saúde mental: lista explícita de profissionais.

---

## 9. Auditoria

Toda decisão (allow ou deny) é logada com:
- Subject attributes
- Object attributes
- Action
- Context
- Decision
- Policy version
- Trace ID

Logs são imutáveis (append-only), retidos por tempo regulatório (20 anos prontuário).

---

## 10. Revogação Imediata

Eventos que revogam tokens em ≤ 5 minutos:
- Desligamento.
- Suspensão disciplinar.
- Suspeita de incidente de segurança.
- Perda do dispositivo.
- Mudança de função crítica.

---

## 11. Certificações e Validade

Alguns acessos dependem de certificação ativa:
- ACLS para UTI/ED.
- PALS para pediatria.
- OncoNurse para quimio.
- Credencial ANS válida para médicos.
- Registro profissional (CRM/COREN/CRF) verificado.

Certificação expirada → acesso ao escopo correspondente é automaticamente bloqueado.

---

## 12. Onde o modelo vive

- **Policy Engine:** OPA (Open Policy Agent) + motor próprio de relacionamentos clínicos.
- **Attribute store:** PIP (Policy Information Point) agregando RH, escala, certificações, alocações.
- **Decision logs:** stream imutável + queryable.

Ver também `workforce-and-role-map.md` para as profissões e `observability-and-autonomous-improvement.md` para auditoria contínua.
