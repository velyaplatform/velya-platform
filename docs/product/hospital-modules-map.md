# Mapa Hospitalar Centralizado — Velya

Este documento é a **fonte única de verdade** para o mapeamento entre os
módulos funcionais do hospital (enfermagem, médico, farmácia, laboratório,
UTI, centro cirúrgico, etc.) e os componentes que a plataforma Velya
implementa: rotas web, recursos FHIR, classes de dado, papéis com
autorização, e gates de compliance que bloqueiam o pipeline.

Toda funcionalidade nova do hospital entra aqui primeiro. Se não está
mapeada neste documento, ela não é buildável — porque um item só passa na
esteira depois de:

1. Ter um **recurso FHIR R4** canônico (ou justificar `resourceType`
   customizado via ADR em `docs/architecture/decisions/`).
2. Ter uma **classe de dado** (A a E) atribuída para controle de acesso.
3. Ter uma **rota web** (`/...`) que centraliza o gerenciamento daquele
   dado — a esteira quebra se o dado aparece em uma página sem rota de
   gestão correspondente.
4. Ter **papéis autorizados** explicitamente listados em
   `apps/web/src/lib/access-control.ts` (`ROLE_DEFINITIONS`).
5. Passar os gates de compliance já definidos em
   `.github/workflows/ui-quality.yaml`:
   - `contrast-gate` (WCAG 2.2 AA com `VELYA_MAX_CONTRAST_NODES=0`)
   - `duplication-gate` (URLs externas, MRNs, títulos)
   - `visual-and-accessibility` (axe-core + Playwright)
   - `lighthouse` (orçamentos de performance)
6. Respeitar as **regras não-negociáveis** de `CLAUDE.md`:
   - Sem secrets em código
   - Sem URLs externas — tudo centralizado em rota interna `/api/system/health/<id>`
   - Sem dados duplicados em mocks — fixture única em
     `apps/web/src/lib/fixtures/`
   - FHIR-first, eventos em NATS, workflows em Temporal
   - ADR obrigatório para decisões arquiteturais

## Contexto regulatório brasileiro

A plataforma precisa atender, no mínimo, as seguintes regulações
levantadas em pesquisa (abril de 2026):

| Norma | Exigência | Onde endereçamos |
|---|---|---|
| **CFM Resolução 1821/2007** | Requisitos para prontuário eletrônico com assinatura digital ICP-Brasil | `docs/architecture/decisions/` + integração futura com `packages/icp-brasil-signing` |
| **CFM/SBIS Manual de Certificação S-RES** | Nível NGS2: imutabilidade de registros, versionamento, certificação eletrônica de usuário | `lib/audit-logger.ts` (hash chain SHA-256) + `lib/auth-session.ts` + `lib/event-store.ts` |
| **LGPD (Lei 13.709/2018)** | Minimização, consentimento, direitos do titular, relato de incidentes | Minimização já no AI gateway (`docs/risk/data-minimization-model.md`) + classe de dado A-E |
| **COFEN Resolução 736/2024** | Sistematização da assistência de enfermagem (SAE) em prontuário | Módulo Enfermagem (seção 4.2 deste doc) |
| **ANVISA RDC 63/2011 + RDC 36/2013** | Boas práticas de funcionamento para serviços de saúde + segurança do paciente | Módulos Higienização, Farmácia, Centro Cirúrgico com checklists de liberação |

**Referência FHIR R4** para pacientes, leitos, fluxo e presença de
equipe: usamos o recurso `Encounter` como entidade central, com
`Encounter.location[]` para rastrear movimentação (planned / active /
reserved / completed), `Encounter.participant[]` para equipe atribuída,
e `Encounter.class` para distinguir inpatient / outpatient / emergency.
Contagem de leitos em uso = "Location mais recente do Encounter mais
recente de cada paciente em in-progress no período". Essa definição vem
direto da especificação FHIR R4 Encounter e do padrão SANER de medidas
situacionais.

## Classes de dado

Definidas em `apps/web/src/lib/access-control.ts`:

- **A — Operacional**: leito, sala, status de limpeza, escala (não PHI)
- **B — Administrativo**: cadastro, convênio, autorização, faturamento
- **C — Clínico contextual**: sinais vitais, evolução de enfermagem, medicação administrada
- **D — Clínico sensível**: diagnósticos, histórico, prescrições, exames
- **E — Altamente restrito**: psiquiátrico, HIV, violência, judicial

## Mapa de módulos

Cada linha abaixo é um módulo do `mapa_hospitalar_centralizado.md`
original. A coluna **Rota** é o contrato com o `duplication-gate`: se um
campo visível não tem rota de gestão listada aqui, o gate reporta.

### 1. Camada de dados mestre

| Item | Classe | Recurso FHIR | Rota de gestão | Status | Fixture |
|---|---|---|---|---|---|
| Identificação do paciente | B | `Patient` | `/patients/[id]`, `/patients/new` | ✅ existe | `lib/fixtures/patients.ts` |
| Histórico / alergias / comorbidades | D | `AllergyIntolerance`, `Condition`, `FamilyMemberHistory` | `/patients/[id]` (aba Histórico) | ✅ existe (mock) | `lib/fixtures/patients.ts` |
| Sinais vitais / evolução / diagnósticos | C/D | `Observation`, `ClinicalImpression`, `Condition` | `/patients/[id]/register-event`, aba Sinais Vitais | ✅ existe (mock) | — |
| Convênio / autorização / internação | B | `Coverage`, `Account`, `Encounter` | `/patients/[id]` (aba Financeiro — **a criar**) | 🟡 scaffold | — |
| Localização do atendimento | A | `Encounter.location[]`, `Location` | `/beds`, `/staff-on-duty`, `/patients/[id]` | ✅ existe | `lib/fixtures/patients.ts` (campo ward/bed) |

### 2. Funções hospitalares

#### 2.1 Recepção / Atendimento

| Item | Classe | FHIR | Rota | Status | Papéis autorizados |
|---|---|---|---|---|---|
| Cadastro do paciente | B | `Patient` + `RelatedPerson` | `/patients/new` | ✅ existe | `receptionist_registration`, `admin_system` |
| Convênio e autorização | B | `Coverage`, `Claim`, `CoverageEligibilityRequest` | `/insurance` **a criar** | 🔴 falta | `receptionist_registration`, `billing_authorization` |
| Histórico de atendimentos | D | `Encounter?patient=...` | `/patients/[id]` aba Histórico | ✅ existe (mock) | `medical_staff_attending`, `nurse`, `case_manager` |

#### 2.2 Enfermagem (SAE — COFEN 736/2024)

| Item | Classe | FHIR | Rota | Status | Papéis |
|---|---|---|---|---|---|
| Sinais vitais | C | `Observation` (vital-signs) | `/patients/[id]/register-event?category=vitals` | ✅ existe (mock) | `nurse`, `nursing_technician`, `nursing_assistant` |
| Administração de medicamentos | D | `MedicationAdministration` | `/patients/[id]/meds` **a criar** | 🔴 falta | `nurse`, `nursing_technician`, `pharmacist_clinical` |
| Evolução de enfermagem | C | `ClinicalImpression` + `Observation` | `/patients/[id]/register-event?category=nursing-note` | ✅ existe (mock) | `nurse` |
| Checklist de segurança (SAE) | C | `QuestionnaireResponse` | `/patients/[id]/sae-checklist` **a criar** | 🔴 falta | `nurse` |

#### 2.3 Médico

| Item | Classe | FHIR | Rota | Status | Papéis |
|---|---|---|---|---|---|
| Diagnóstico | D | `Condition` (encounter-diagnosis) | `/patients/[id]/register-event?category=diagnosis` | ✅ existe (mock) | `medical_staff_attending`, `medical_staff_on_call` |
| Prescrição | D | `MedicationRequest` | `/prescriptions/new?patient=...` **a criar** | 🔴 falta | `medical_staff_attending` |
| Solicitação de exames | D | `ServiceRequest` | `/orders/new?patient=...` **a criar** | 🔴 falta | `medical_staff_attending`, `medical_staff_on_call` |
| Evolução clínica | D | `ClinicalImpression` | `/patients/[id]/register-event?category=evolution` | ✅ existe (mock) | `medical_staff_attending` |

#### 2.4 Farmácia

| Item | Classe | FHIR | Rota | Status | Papéis |
|---|---|---|---|---|---|
| Prescrição médica (lista de validação) | D | `MedicationRequest` (status=active) | `/pharmacy` | ✅ existe | `pharmacist_clinical` |
| Estoque de medicamentos | A | `Medication` + `SupplyDelivery` | `/pharmacy/stock` **a criar** | 🔴 falta | `pharmacist_clinical`, `admin_system` |
| Dispensação | C | `MedicationDispense` | `/pharmacy/dispense` **a criar** | 🔴 falta | `pharmacist_clinical` |

#### 2.5 Laboratório

| Item | Classe | FHIR | Rota | Status | Papéis |
|---|---|---|---|---|---|
| Solicitação de exames | D | `ServiceRequest.category=laboratory` | `/lab/orders` **a criar** | 🔴 falta | `lab_staff`, `medical_staff_attending` |
| Coleta | C | `Specimen` | `/lab/collection` **a criar** | 🔴 falta | `lab_staff`, `nurse` |
| Resultado | D | `DiagnosticReport` + `Observation` (laboratory) | `/lab/results` **a criar** | 🔴 falta | `lab_staff`, `medical_staff_attending` |

#### 2.6 Radiologia / Imagem

| Item | Classe | FHIR | Rota | Status | Papéis |
|---|---|---|---|---|---|
| Solicitação de exame | D | `ServiceRequest.category=imaging` | `/imaging/orders` **a criar** | 🔴 falta | `imaging_staff`, `medical_staff_attending` |
| Protocolo de exame | C | `ImagingStudy` | `/imaging/studies` **a criar** | 🔴 falta | `imaging_staff` |
| Laudo | D | `DiagnosticReport` (imaging) | `/imaging/results` **a criar** | 🔴 falta | `imaging_staff`, `medical_staff_attending` |

#### 2.7 Centro Cirúrgico

| Item | Classe | FHIR | Rota | Status | Papéis |
|---|---|---|---|---|---|
| Agendamento cirúrgico | B | `Appointment` + `Procedure` (status=preparation) | `/surgery` | ✅ existe (mock) | `medical_staff_attending`, `case_manager` |
| Checklists (ANVISA RDC 36/2013) | C | `QuestionnaireResponse` | `/surgery/[id]/checklist` **a criar** | 🔴 falta | `medical_staff_attending`, `nurse` |
| Procedimentos realizados | D | `Procedure` | `/surgery/[id]/procedure` **a criar** | 🔴 falta | `medical_staff_attending` |

#### 2.8 UTI

| Item | Classe | FHIR | Rota | Status | Papéis |
|---|---|---|---|---|---|
| Monitoramento contínuo (NEWS2, sinais) | C | `Observation` (vital-signs) + `DeviceUseStatement` | `/icu` + `/patients/[id]` | ✅ existe | `medical_staff_attending`, `nurse` |
| Ventilação mecânica | D | `Device` + `Observation` (respiratory-support) | `/icu/[bedId]/ventilator` **a criar** | 🔴 falta | `medical_staff_attending`, `nurse`, `physiotherapist` |
| Protocolos críticos (sepse, PCR) | D | `CarePlan` + `Protocol` | `/icu/[bedId]/protocol` **a criar** | 🔴 falta | `medical_staff_attending`, `nurse` |

#### 2.9 Limpeza / Higienização (ANVISA RDC 63/2011)

| Item | Classe | FHIR | Rota | Status | Papéis |
|---|---|---|---|---|---|
| Tipo de área | A | `Location.physicalType` | `/beds` filter por status | ✅ existe | `cleaning_hygiene`, `bed_management` |
| Frequência e risco | A | `Schedule` + `PractitionerRole` | `/cleaning/schedule` **a criar** | 🔴 falta | `cleaning_hygiene` |
| Checklist de liberação | A | `QuestionnaireResponse` | `/beds/[bed]/cleaning-checklist` **a criar** | 🔴 falta | `cleaning_hygiene` |

#### 2.10 Transporte / Ambulância

| Item | Classe | FHIR | Rota | Status | Papéis |
|---|---|---|---|---|---|
| Origem e destino | B | `Task` (transport) + `Location` (from/to) | `/ems` | ✅ existe (mock) | `ambulance_driver`, `patient_transporter` |
| Prioridade | A/B | `Task.priority` | `/ems` | ✅ existe | mesmo |
| Condição do paciente | C | `Observation` (triagem) | `/ems/[id]/triage` **a criar** | 🔴 falta | `ambulance_driver`, `medical_staff_on_call` |
| Status da remoção | A | `Task.status` | `/ems` | ✅ existe | mesmo |

### 3. Especialidades médicas e exames

Cada especialidade vira um **filtro** sobre `ServiceRequest.category` e
`DiagnosticReport.category`. Não viram rotas separadas — elas viram
valores em `code`/`category` e filtros sobre as rotas genéricas
`/lab/orders`, `/imaging/orders`, `/lab/results`, `/imaging/results`.
Isso atende ao princípio de **não criar rotas redundantes** do
`duplication-gate`.

| Especialidade | Exames (FHIR code system LOINC / SNOMED CT) |
|---|---|
| Cardiologia | ECG (LOINC 11524-6), Ecocardiograma (LOINC 18745-0), Teste ergométrico (LOINC 28583-1), Cateterismo (SNOMED 41976001) |
| Neurologia | TC (LOINC 30799-1), RM (LOINC 24727-0), EEG (LOINC 11523-8), Punção lombar (SNOMED 277762005) |
| Ortopedia | Raio-X (LOINC 36554-4), TC, RM |
| Pneumologia | Espirometria (LOINC 19868-9), Gasometria (LOINC 2744-1), Rx tórax (LOINC 30746-2) |
| Gastroenterologia | Endoscopia (SNOMED 71880005), Colonoscopia (SNOMED 73761001) |
| Nefrologia | Creatinina (LOINC 2160-0), Ureia (LOINC 3094-0), Urina tipo 1 (LOINC 24357-6) |
| Infectologia | Hemocultura (LOINC 600-7), Sorologias (LOINC 5199-7, 5193-6, etc.) |

### 4. Módulos do sistema

| Módulo | Rota | Status atual | Gate que cobre |
|---|---|---|---|
| Cadastro de pacientes | `/patients`, `/patients/new`, `/patients/[id]` | ✅ | contrast + duplication + visual |
| Prontuário eletrônico | `/patients/[id]` (abas) | ✅ parcial | contrast + visual |
| Prescrição médica | `/prescriptions/new` | 🔴 | — |
| Gestão de exames | `/lab/*`, `/imaging/*` | 🔴 | — |
| Gestão de leitos | `/beds` | ✅ | contrast + visual |
| Controle de infecção (CCIH) | `/infection-control` | 🔴 | — |
| Auditoria e logs | `/audit`, `/activity` | ✅ | contrast + visual |
| Painel operacional em tempo real | `/`, `/staff-on-duty`, `/alerts` | ✅ | contrast + visual |
| Cadastro de funcionários | `/employees` | ✅ (scaffold — detalhe 🔴) | contrast + visual |
| Fornecedores e terceiros | `/suppliers` | ✅ (scaffold — detalhe 🔴) | contrast + visual |
| Configurações do sistema | `/system`, `/system/services/[id]` | ✅ | contrast + visual |

### 5. Fluxo hospitalar (FHIR `Encounter` lifecycle)

```
1. Entrada          → Encounter (status=planned, class=emergency|inpatient|outpatient)
2. Triagem          → Observation (triage-score) + Encounter (status=arrived)
3. Atendimento      → Encounter (status=in-progress) + ClinicalImpression
4. Exames           → ServiceRequest + DiagnosticReport
5. Diagnóstico      → Condition (encounter-diagnosis)
6. Tratamento       → MedicationRequest + Procedure + CarePlan
7. Alta / internação → Encounter (status=finished) ou Encounter filho (inpatient)
```

Cada transição acima emite um evento em NATS no subject
`clinical.encounter.<event>` (ver `docs/architecture/decisions/0001-use-nats-for-event-backbone.md`),
e altas que bloqueiam viram `Task` em `/discharge`.

### 6. Requisitos importantes (já cobertos)

| Requisito do mapa | Como está sendo atendido |
|---|---|
| Dados centralizados | `apps/web/src/lib/fixtures/{patients,staff,suppliers}.ts` hoje; Medplum FHIR em produção |
| Atualização em tempo real | NATS JetStream (subjects `clinical.*`), FHIR Subscriptions via Medplum Bots |
| Controle de acesso por perfil | `lib/access-control.ts` RBAC + ABAC + ReBAC (29 roles, 5 classes de dado) |
| Auditoria completa | `lib/audit-logger.ts` hash-chain SHA-256, rota `/audit`, PVC `/data/velya-audit` |
| Integração entre setores | Eventos NATS por subject `{domain}.{entity}.{event}` + Temporal para fluxos longos |
| UI acessível | `contrast-gate` com `VELYA_MAX_CONTRAST_NODES=0`, `visual-and-accessibility` com axe-core WCAG 2.2 AA |
| Sem duplicações | `duplication-gate`: URLs externas, MRNs, títulos de página |
| Compliance brasileiro | Seção "Contexto regulatório" acima + ADRs pendentes em `docs/architecture/decisions/` |

## Backlog priorizado pelos gates

A ordem abaixo segue: **(1) completar as rotas que já têm dado visível
sem rota de gestão** (o `duplication-gate` começa a flagá-las assim que
migrarmos a página que hoje mostra o dado para importar da fixture
central). Só depois vamos para módulos novos.

### P0 — consolida o que já existe (destrava `duplication-gate`)

1. Migrar `/patients`, `/tasks`, `/discharge`, `/` para importar de
   `lib/fixtures/patients.ts` (eliminar as 44 duplicações MRN-* que o
   `check-ui-duplications.ts` reporta hoje).
2. Migrar `/beds`, `/surgery`, `/icu`, `/pharmacy`, `/ems` para
   importar dos fixtures centralizados (mesmo motivo).
3. Criar `/employees/[id]`, `/employees/[id]/edit`, `/employees/new`
   (hoje os botões "Editar" apontam para 404).
4. Criar `/suppliers/[id]`, `/suppliers/[id]/edit`, `/suppliers/new`.

### P1 — fecha módulos críticos do mapa (seção 2)

5. `/prescriptions/new` (MedicationRequest) — prescrição médica.
6. `/lab/orders`, `/lab/collection`, `/lab/results` — laboratório completo.
7. `/imaging/orders`, `/imaging/studies`, `/imaging/results` — radiologia.
8. `/pharmacy/stock` e `/pharmacy/dispense` — ciclo de medicamentos.
9. `/beds/[bed]/cleaning-checklist` — RDC 63/2011.
10. `/surgery/[id]/checklist` — RDC 36/2013.

### P2 — compliance brasileiro (precisa de ADR + integração)

11. ADR: assinatura digital ICP-Brasil em prescrições e laudos.
12. ADR: certificação SBIS NGS2 (imutabilidade já existe via hash chain,
    falta versionamento explícito de schema).
13. ADR: fluxo de consentimento LGPD no cadastro.
14. `/consent` — registro de consentimento do titular.
15. `/infection-control` (CCIH) — indicadores ANVISA.

### P3 — observabilidade interna (sem URLs externas)

16. `/observability/metrics` — dashboard embarcado lendo Prometheus
    internamente (sem redirect para Grafana).
17. `/observability/deploys` — lista de rollouts ArgoCD via API interna.
18. `/api/system/health/[id]` — endpoints internos de proxy dos health
    checks dos serviços (remove o `http://*.nip.io` das páginas).

## Expansão com o blueprint ultra completo

O `blueprint_hospitalar_ultra_completo.md` (versão abril 2026) lista 31
macrodomínios do hospital. A tabela a seguir mapeia cada macrodomínio
para o estado atual da plataforma e o `module-manifest.ts` em
`apps/web/src/lib/module-manifest.ts` que é a expressão runtime deste
mapa (todo módulo tem rota, fixture, coluna, filtro, papéis, FHIR e
regulação vinculada no manifest).

| # | Macrodomínio | Rotas atuais | Fixture | FHIR | Classe | Status |
|---|---|---|---|---|---|---|
| 1 | CRM e pré-hospitalar | `/` (comando), `/patients` | `patients.ts` | `Patient`, `Appointment` | B | ✅ básico · 🔴 tele/homecare falta |
| 2 | Acesso / check-in / admissão | `/patients/new`, `/patients/[id]` | `patient-cockpits.ts` | `Encounter.status=arrived` | B/C | ✅ |
| 3 | Emergência e classificação de risco | `/ems`, `/alerts` | `ems.ts`, `alerts.ts` | `Encounter.class=EMER` + triage `Observation` | C | ✅ básico |
| 4 | Ambulatório e consultas | `/patients`, `/tasks` | `patients-list.ts`, `tasks.ts` | `Appointment`, `Encounter` | B/C | ✅ básico |
| 5 | Internação / leitos | `/beds`, `/discharge` | `beds.ts`, `discharge.ts` | `Encounter.location[]` | A/B | ✅ |
| 6 | UTI e áreas críticas | `/icu` | `icu.ts` | `Encounter.class=IMP` + `Device` | C/D | ✅ |
| 7 | Centro cirúrgico | `/surgery` | `surgeries.ts` | `Appointment`, `Procedure` | C/D | ✅ básico · 🔴 checklist falta |
| 8 | Enfermagem multiprofissional | `/tasks`, `/staff-on-duty` | `tasks.ts`, `staff.ts` | `CarePlan`, `Task` | C | ✅ básico |
| 9 | **Diagnóstico — laboratório** | `/lab/orders`, `/lab/results` | `lab-orders.ts`, `lab-results.ts` | `ServiceRequest`, `DiagnosticReport`, `Observation` | D | ✅ **novo** |
| 9 | **Diagnóstico — imagem** | `/imaging/orders`, `/imaging/results` | `imaging-orders.ts`, `imaging-results.ts` | `ServiceRequest`, `ImagingStudy`, `DiagnosticReport` | D | ✅ **novo** |
| 10 | **Farmácia clínica e logística** | `/pharmacy`, `/pharmacy/stock`, `/prescriptions` | `pharmacy.ts`, `pharmacy-stock.ts`, `prescriptions.ts` | `MedicationRequest`, `Medication`, `SupplyDelivery` | A/D | ✅ **novo** |
| 11 | Banco de sangue e hemoterapia | — | — | `BiologicallyDerivedProduct` | C/D | 🔴 falta (P2) |
| 12 | **Nutrição clínica** | `/meals/orders` | `meal-orders.ts` | `NutritionOrder` | C | ✅ **novo** |
| 13 | **Higienização e hotelaria** | `/cleaning/tasks` | `cleaning-tasks.ts` | `Task (housekeeping)` | A | ✅ **novo** |
| 14 | **Transporte interno / externo** | `/transport/orders`, `/ems` | `transport-orders.ts`, `ems.ts` | `Task (transport)` | B | ✅ **novo** |
| 15 | **Resíduos e biossegurança (RSS)** | `/waste/manifests` | `waste-manifests.ts` | `Task (waste-management)` | A | ✅ **novo** (ANVISA RDC 222/2018) |
| 16 | **Engenharia clínica e ativos** | `/assets`, `/facility/work-orders` | `assets.ts`, `work-orders.ts` | `Device`, `Task (maintenance)` | A | ✅ **novo** |
| 17 | Infraestrutura predial / utilidades | `/facility/work-orders` | `work-orders.ts` | `Task (maintenance)` | A | ✅ básico |
| 18 | **Compras / almoxarifado / supply chain** | `/supply/items`, `/supply/purchase-orders` | `supply-items.ts`, `purchase-orders.ts` | `SupplyRequest`, `Medication`, `Device` | A/B | ✅ **novo** |
| 19 | Contratos / fornecedores / terceiros | `/suppliers` (CRUD), `/suppliers/[id]` | `suppliers.ts` | vendor contract domain | B | ✅ |
| 20 | **Financeiro / faturamento / glosas** | `/billing/charges`, `/billing/claims`, `/billing/denials` | `charges.ts`, `claims.ts`, `denials.ts` | `ChargeItem`, `Claim`, `ClaimResponse` | B | ✅ **novo** (TISS ANS 305/2012) |
| 21 | **Qualidade / segurança do paciente** | `/quality/incidents` | `incidents.ts` | `AdverseEvent` | D | ✅ **novo** |
| 22 | RH / escalas / credenciais | `/employees`, `/employees/[id]`, `/governance/credentials` | `staff.ts`, `credentials.ts` | `Practitioner`, `PractitionerRole`, `Qualification` | B | ✅ |
| 23 | TI / integrações / seg. informação | `/system`, `/activity` | `agent-activity.ts` | system domain | A/B | ✅ básico |
| 24 | Pesquisa / ensino / comitês | — | — | `ResearchStudy` | C/D | 🔴 falta (P3) |
| 25 | Alta e desospitalização | `/discharge` | `discharge.ts` | `Encounter.status=finished`, `CarePlan` | B/C | ✅ básico |
| — | **Trilha de auditoria imutável** | `/audit`, `/governance/audit-events` | `audit-events.ts` | `AuditEvent` | B | ✅ **novo** (LGPD Art. 37 + SBIS NGS2) |
| — | **Consentimentos LGPD** | `/governance/consent-forms` | `consent-forms.ts` | `Consent` | B | ✅ **novo** |

**Legenda**: ✅ = existe na plataforma · 🟡 = scaffold · 🔴 = não existe ainda.

Total de módulos no `module-manifest.ts`: **21**. Adicionar um módulo
novo é um único append no manifest + um `page.tsx` de 6 linhas que
chama `<ModuleListView moduleId="..." data={FIXTURE} />`.

### Como adicionar um módulo novo

1. Criar `apps/web/src/lib/fixtures/<nome>.ts` (dados + types).
2. Adicionar entry em `MODULES` de `apps/web/src/lib/module-manifest.ts`
   com `id`, `route`, `title`, `fhirResource`, `dataClass`,
   `allowedRoles`, `fixturePath`, `fixtureExport`, `columns`, `filters`,
   `regulatoryBasis`.
3. Criar `apps/web/src/app/<route>/page.tsx`:
   ```ts
   'use client';
   import { ModuleListView } from '../components/module-list-view';
   import { FIXTURE } from '../../lib/fixtures/<nome>';
   export default function Page() {
     return <ModuleListView moduleId="<id>" data={FIXTURE} />;
   }
   ```
4. Adicionar item em `navigation.tsx` → `NAV_ITEMS`.
5. Rodar `npx tsc --noEmit` + `npx tsx scripts/check-ui-duplications.ts`
   + `npx tsx scripts/audit-contrast-all-pages.ts`. Todos os gates
   devem continuar verdes.

## Regras de mudança neste documento

- Adicionar linha nova aqui é obrigatório **antes** de abrir PR com a
  rota correspondente — o `duplication-gate` e o `contrast-gate` não
  impedem uma rota de nascer, mas code review deve rejeitar PRs que
  criam rotas não listadas aqui.
- Mudar a classe de dado de um item (por exemplo A → C) exige aprovação
  do Red Team Office e um ADR em `docs/architecture/decisions/`.
- Mudar o recurso FHIR canônico exige ADR e atualização de
  `docs/architecture/decisions/`.

## Fontes externas consultadas (abril 2026)

- [CFM/SBIS — Cartilha sobre Prontuário Eletrônico (NGS2, ICP-Brasil)](http://www.sbis.org.br/certificacao/Cartilha_SBIS_CFM_Prontuario_Eletronico_fev_2012.pdf)
- [CFM Resolução 2056/2013 — fiscalização dos serviços médicos](https://www.legisweb.com.br/legislacao/?id=261676)
- [Ministério da Saúde — Manual Técnico do Sistema de Informação Hospitalar do SUS](https://bvsms.saude.gov.br/bvs/publicacoes/manual_tecnico_sistema_informacao_hospitalar_sus.pdf)
- [ANVISA — exigências para serviços de saúde (RDC 63/2011, RDC 36/2013)](https://www.supporthealth.com.br/artigos/dicas-para-legalizar-sua-clinica-na-anvisa/)
- [EBSERH — Leis que regulam acesso ao prontuário e defesa da privacidade](https://www.gov.br/ebserh/pt-br/hospitais-universitarios/regiao-sul/hu-ufsc/comunicacao/noticias/leis-regulam-acesso-ao-prontuario-e-defendem-privacidade-do-paciente)
- [HL7 FHIR R4 — Encounter resource (location array, participant, class)](https://hl7.org/fhir/R4/encounter.html)
- [HL7 SANER — Bed Availability Group (contagem de leitos via Encounter + Location)](https://build.fhir.org/ig/HL7/fhir-saner/measure_group_beds.html)
