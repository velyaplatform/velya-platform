/**
 * Hospital Task Fixtures — 20 realistic tasks spanning all categories.
 *
 * Centralized mock data. Uses consistent MRNs from existing fixtures
 * (patients-list.ts) to prevent duplication.
 */

import type { HospitalTask } from '../hospital-task-types';

const NOW = '2026-04-12T08:00:00.000Z';

function actor(id: string, name: string, role: string, ward = 'Ala 3B') {
  return { id, name, role, ward };
}

const NURSE_ANA = actor('user-nurse-1', 'Ana Silva', 'nurse');
const NURSE_BEA = actor('user-nurse-2', 'Beatriz Santos', 'nurse');
const TECH_CARLOS = actor('user-tech-1', 'Carlos Mendes', 'nursing_technician');
const DOC_MARCOS = actor('user-doc-1', 'Dr. Marcos Lima', 'medical_staff_attending');
const DOC_JULIA = actor('user-doc-2', 'Dra. Julia Ramos', 'medical_staff_attending');
const PHARM_LUCIA = actor('user-pharm-1', 'Lucia Ferreira', 'pharmacist_clinical', 'Farmacia');
const CLEANER_JOSE = actor('user-clean-1', 'Jose Oliveira', 'cleaning_hygiene', 'Limpeza');
const TRANSPORT_PEDRO = actor('user-trans-1', 'Pedro Souza', 'patient_transporter', 'Transporte');
const MAINT_RICARDO = actor('user-maint-1', 'Ricardo Alves', 'maintenance', 'Manutencao');
const COORD_MARIA = actor('user-coord-1', 'Maria Coord.', 'nurse', 'Ala 3B');

function sla(phase: 'receive' | 'accept' | 'start' | 'complete', breached = false): HospitalTask['sla'] {
  const base = new Date(NOW).getTime();
  return {
    receiveBy: new Date(base + 15 * 60_000).toISOString(),
    acceptBy: new Date(base + 30 * 60_000).toISOString(),
    startBy: new Date(base + 60 * 60_000).toISOString(),
    completeBy: new Date(base + 4 * 3600_000).toISOString(),
    currentPhase: phase,
    elapsedMs: 0,
    pausedMs: 0,
    breached,
    breachCount: breached ? 1 : 0,
    breachedPhases: breached ? ['receive'] : [],
  };
}

function hist(action: string, actor: HospitalTask['createdBy'], note?: string): HospitalTask['history'][0] {
  return { id: `H-${Math.random().toString(36).slice(2, 8)}`, action: action as HospitalTask['history'][0]['action'], actor, timestamp: NOW, note };
}

export const MOCK_HOSPITAL_TASKS: HospitalTask[] = [
  // ── ASSISTENCIAL / MEDICACAO ────────────────────────────────────
  {
    id: 'TASK-001', shortCode: 'T-001', version: 1,
    type: 'med-admin-iv', category: 'assistencial', subcategory: 'medicacao',
    priority: 'urgent', status: 'open', statusChangedAt: NOW,
    title: 'Administrar Dipirona 1g IV',
    description: 'Paciente com febre 38.9C, prescricao de Dipirona 1g IV 6/6h',
    ward: 'Ala 3B', bed: '302A', patientMrn: 'MRN-001', patientName: 'Eleanor Voss',
    createdBy: DOC_MARCOS, assignedTo: NURSE_ANA, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [], history: [hist('created', DOC_MARCOS, 'Tarefa criada')],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },
  {
    id: 'TASK-002', shortCode: 'T-002', version: 2,
    type: 'med-admin-oral', category: 'assistencial', subcategory: 'medicacao',
    priority: 'normal', status: 'received', statusChangedAt: NOW,
    title: 'Administrar Losartana 50mg VO',
    ward: 'Ala 3B', bed: '305B', patientMrn: 'MRN-003', patientName: 'Marcus Bell',
    createdBy: DOC_JULIA, assignedTo: TECH_CARLOS, currentEscalationLevel: 0,
    sla: sla('accept'), evidence: [], receivedAt: NOW,
    history: [hist('created', DOC_JULIA), hist('received', TECH_CARLOS)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ASSISTENCIAL / EXAMES ───────────────────────────────────────
  {
    id: 'TASK-003', shortCode: 'T-003', version: 3,
    type: 'collect-lab-sample', category: 'assistencial', subcategory: 'exames',
    priority: 'high', status: 'in_progress', statusChangedAt: NOW,
    title: 'Coletar HMG + PCR',
    description: 'Coleta para controle de infeccao pos-operatoria',
    ward: 'Ala 3B', bed: '308C', patientMrn: 'MRN-005', patientName: 'Diana Reyes',
    createdBy: DOC_MARCOS, assignedTo: TECH_CARLOS, currentEscalationLevel: 0,
    sla: sla('complete'), evidence: [], receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', DOC_MARCOS), hist('received', TECH_CARLOS), hist('started', TECH_CARLOS)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },
  {
    id: 'TASK-004', shortCode: 'T-004', version: 3,
    type: 'prepare-patient-exam', category: 'assistencial', subcategory: 'exames',
    priority: 'normal', status: 'blocked', statusChangedAt: NOW,
    title: 'Preparar paciente para TC abdome',
    description: 'Jejum 6h, contraste oral 2h antes',
    ward: 'Ala 3B', bed: '310A', patientMrn: 'MRN-007', patientName: 'James Chen',
    createdBy: DOC_JULIA, assignedTo: NURSE_BEA, currentEscalationLevel: 0,
    sla: sla('complete'), evidence: [],
    blockReason: 'waiting_transport', blockReasonText: 'Maqueiro indisponivel para levar ao exame',
    blockedAt: NOW, receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', DOC_JULIA), hist('received', NURSE_BEA), hist('started', NURSE_BEA), hist('blocked', NURSE_BEA, 'Aguardando transporte')],
    comments: [{ id: 'CM-001', author: NURSE_BEA, text: 'Solicitei maqueiro, aguardando', createdAt: NOW }],
    createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ASSISTENCIAL / PROCEDIMENTOS ────────────────────────────────
  {
    id: 'TASK-005', shortCode: 'T-005', version: 1,
    type: 'wound-care-complex', category: 'assistencial', subcategory: 'procedimentos',
    priority: 'high', status: 'open', statusChangedAt: NOW,
    title: 'Curativo complexo — ferida operatoria',
    instructions: 'Lavar com SF 0.9%, aplicar colagenase, cobrir com gaze esteril',
    ward: 'Ala 3B', bed: '301B', patientMrn: 'MRN-002', patientName: 'Robert Hayes',
    createdBy: DOC_MARCOS, assignedTo: NURSE_ANA, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [], history: [hist('created', DOC_MARCOS)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },
  {
    id: 'TASK-006', shortCode: 'T-006', version: 4,
    type: 'vital-signs', category: 'assistencial', subcategory: 'avaliacao',
    priority: 'normal', status: 'completed', statusChangedAt: NOW,
    title: 'Sinais vitais 6/6h',
    ward: 'Ala 3B', bed: '303A', patientMrn: 'MRN-004', patientName: 'Sarah Johnson',
    createdBy: NURSE_ANA, assignedTo: TECH_CARLOS, currentEscalationLevel: 0,
    sla: sla('complete'), completedAt: NOW, completedBy: TECH_CARLOS,
    evidence: [{ id: 'EV-001', type: 'measurement', value: 'PA 130/80, FC 78, T 36.5, SpO2 97%', attachedBy: TECH_CARLOS, attachedAt: NOW }],
    receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', NURSE_ANA), hist('received', TECH_CARLOS), hist('started', TECH_CARLOS), hist('completed', TECH_CARLOS)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ASSISTENCIAL / PARECER ──────────────────────────────────────
  {
    id: 'TASK-007', shortCode: 'T-007', version: 1,
    type: 'interconsultation', category: 'assistencial', subcategory: 'parecer',
    priority: 'normal', status: 'open', statusChangedAt: NOW,
    title: 'Parecer cardiologia — arritmia sinusal',
    description: 'ECG com arritmia sinusal, solicitar avaliacao cardiologia',
    ward: 'Ala 3B', bed: '312B', patientMrn: 'MRN-009', patientName: 'Patricia Almeida',
    createdBy: DOC_MARCOS, assignedTo: actor('user-doc-cardio', 'Dr. Fernandes', 'medical_staff_attending', 'Cardiologia'),
    currentEscalationLevel: 0, sla: sla('receive'), evidence: [],
    history: [hist('created', DOC_MARCOS)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ASSISTENCIAL / ALTA ─────────────────────────────────────────
  {
    id: 'TASK-008', shortCode: 'T-008', version: 2,
    type: 'discharge-prep', category: 'assistencial', subcategory: 'alta',
    priority: 'high', status: 'accepted', statusChangedAt: NOW,
    title: 'Preparar documentacao de alta',
    description: 'Paciente com alta prevista para hoje 14h',
    ward: 'Ala 3B', bed: '304A', patientMrn: 'MRN-006', patientName: 'Linda Park',
    createdBy: DOC_JULIA, assignedTo: NURSE_ANA, currentEscalationLevel: 0,
    sla: sla('start'), evidence: [], receivedAt: NOW, acceptedAt: NOW,
    history: [hist('created', DOC_JULIA), hist('received', NURSE_ANA), hist('accepted', NURSE_ANA)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── APOIO / LIMPEZA ─────────────────────────────────────────────
  {
    id: 'TASK-009', shortCode: 'T-009', version: 1,
    type: 'cleaning-terminal', category: 'apoio', subcategory: 'limpeza',
    priority: 'urgent', status: 'open', statusChangedAt: NOW,
    title: 'Limpeza terminal — Leito 306A',
    description: 'Paciente teve alta, leito precisa de limpeza terminal para proxima admissao',
    ward: 'Ala 3B', bed: '306A',
    createdBy: COORD_MARIA, assignedTo: CLEANER_JOSE, currentEscalationLevel: 0,
    sla: sla('receive'),
    checklistItems: [
      { id: 'CK-1', label: 'Remover roupas de cama', checked: false },
      { id: 'CK-2', label: 'Limpar superficies', checked: false },
      { id: 'CK-3', label: 'Desinfetar banheiro', checked: false },
      { id: 'CK-4', label: 'Trocar cortinas', checked: false },
      { id: 'CK-5', label: 'Repor materiais', checked: false },
    ],
    evidence: [], history: [hist('created', COORD_MARIA)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'system',
  },
  {
    id: 'TASK-010', shortCode: 'T-010', version: 3,
    type: 'cleaning-concurrent', category: 'apoio', subcategory: 'limpeza',
    priority: 'normal', status: 'in_progress', statusChangedAt: NOW,
    title: 'Limpeza concorrente — Leito 309B',
    ward: 'Ala 3B', bed: '309B',
    createdBy: COORD_MARIA, assignedTo: CLEANER_JOSE, currentEscalationLevel: 0,
    sla: sla('complete'), evidence: [], receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', COORD_MARIA), hist('received', CLEANER_JOSE), hist('started', CLEANER_JOSE)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'system',
  },

  // ── APOIO / TRANSPORTE ──────────────────────────────────────────
  {
    id: 'TASK-011', shortCode: 'T-011', version: 1,
    type: 'transport-patient', category: 'apoio', subcategory: 'transporte',
    priority: 'high', status: 'open', statusChangedAt: NOW,
    title: 'Transportar paciente ao raio-X',
    description: 'RX torax PA e perfil, paciente deambula com auxilio',
    ward: 'Ala 3B', bed: '307A', patientMrn: 'MRN-008', patientName: 'Thomas Wright',
    createdBy: NURSE_BEA, assignedTo: TRANSPORT_PEDRO, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [],
    history: [hist('created', NURSE_BEA)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── APOIO / MANUTENCAO ──────────────────────────────────────────
  {
    id: 'TASK-012', shortCode: 'T-012', version: 1,
    type: 'maintenance-corrective', category: 'apoio', subcategory: 'manutencao',
    priority: 'normal', status: 'open', statusChangedAt: NOW,
    title: 'Consertar campainha do leito 311A',
    description: 'Campainha de chamada do paciente nao funciona desde ontem',
    ward: 'Ala 3B', bed: '311A',
    createdBy: NURSE_ANA, assignedTo: MAINT_RICARDO, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [],
    history: [hist('created', NURSE_ANA)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── APOIO / NUTRICAO ────────────────────────────────────────────
  {
    id: 'TASK-013', shortCode: 'T-013', version: 2,
    type: 'special-diet-prep', category: 'apoio', subcategory: 'nutricao',
    priority: 'normal', status: 'received', statusChangedAt: NOW,
    title: 'Preparar dieta hipossodica pastosa',
    description: 'Paciente disfagico, dieta hipossodica consistencia pastosa',
    ward: 'Ala 3B', bed: '303A', patientMrn: 'MRN-004', patientName: 'Sarah Johnson',
    createdBy: actor('user-nutri-1', 'Camila Nutri', 'nutritionist', 'Nutricao'),
    assignedTo: actor('user-cook-1', 'Eq. Cozinha', 'cleaning_hygiene', 'Nutricao'),
    currentEscalationLevel: 0, sla: sla('accept'), evidence: [], receivedAt: NOW,
    history: [hist('created', actor('user-nutri-1', 'Camila Nutri', 'nutritionist')), hist('received', actor('user-cook-1', 'Eq. Cozinha', 'cleaning_hygiene'))],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ADMINISTRATIVO / DOCUMENTACAO ───────────────────────────────
  {
    id: 'TASK-014', shortCode: 'T-014', version: 1,
    type: 'insurance-authorization', category: 'administrativo', subcategory: 'documentacao',
    priority: 'high', status: 'open', statusChangedAt: NOW,
    title: 'Solicitar autorizacao TC abdome — Unimed',
    description: 'TC com contraste, codigo TUSS 41010120, senha pendente',
    ward: 'Ala 3B', bed: '310A', patientMrn: 'MRN-007', patientName: 'James Chen',
    createdBy: NURSE_BEA,
    assignedTo: actor('user-billing-1', 'Fernanda Fatura', 'billing_authorization', 'Faturamento'),
    currentEscalationLevel: 0, sla: sla('receive'), evidence: [],
    history: [hist('created', NURSE_BEA)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ADMINISTRATIVO / COORDENACAO ────────────────────────────────
  {
    id: 'TASK-015', shortCode: 'T-015', version: 1,
    type: 'family-contact', category: 'administrativo', subcategory: 'coordenacao',
    priority: 'normal', status: 'open', statusChangedAt: NOW,
    title: 'Contatar familia — orientacao de alta',
    description: 'Familia precisa ser orientada sobre cuidados domiciliares pos-alta',
    ward: 'Ala 3B', bed: '304A', patientMrn: 'MRN-006', patientName: 'Linda Park',
    createdBy: DOC_JULIA,
    assignedTo: actor('user-social-1', 'Roberta AS', 'social_worker', 'Servico Social'),
    currentEscalationLevel: 0, sla: sla('receive'), evidence: [],
    history: [hist('created', DOC_JULIA)], comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── FARMACIA ────────────────────────────────────────────────────
  {
    id: 'TASK-016', shortCode: 'T-016', version: 2,
    type: 'validate-prescription', category: 'assistencial', subcategory: 'medicacao',
    priority: 'high', status: 'in_progress', statusChangedAt: NOW,
    title: 'Validar prescricao — interacao medicamentosa',
    description: 'Verificar interacao entre Varfarina e AAS prescrito hoje',
    ward: 'Farmacia', patientMrn: 'MRN-002', patientName: 'Robert Hayes',
    createdBy: actor('system', 'Sistema', 'system'),
    assignedTo: PHARM_LUCIA, currentEscalationLevel: 0,
    sla: sla('complete'), evidence: [], receivedAt: NOW, acceptedAt: NOW, startedAt: NOW,
    history: [hist('created', actor('system', 'Sistema', 'system')), hist('received', PHARM_LUCIA), hist('started', PHARM_LUCIA)],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'system',
  },

  // ── DECLINED ────────────────────────────────────────────────────
  {
    id: 'TASK-017', shortCode: 'T-017', version: 3,
    type: 'maintenance-corrective', category: 'apoio', subcategory: 'manutencao',
    priority: 'low', status: 'declined', statusChangedAt: NOW,
    title: 'Trocar lampada fluorescente — corredor Ala 3B',
    ward: 'Ala 3B',
    createdBy: COORD_MARIA, assignedTo: MAINT_RICARDO, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [],
    declineReason: 'resource_unavailable', declineReasonText: 'Lampada em falta no estoque, pedido de compra #OC-456',
    history: [hist('created', COORD_MARIA), hist('received', MAINT_RICARDO), hist('declined', MAINT_RICARDO, 'Lampada em falta')],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── ESCALATED ───────────────────────────────────────────────────
  {
    id: 'TASK-018', shortCode: 'T-018', version: 2,
    type: 'cleaning-terminal', category: 'apoio', subcategory: 'limpeza',
    priority: 'urgent', status: 'escalated', statusChangedAt: NOW,
    title: 'Limpeza terminal — Leito 315A (SLA estourado)',
    description: 'Leito necessario para admissao de urgencia, limpeza atrasada 45 min',
    ward: 'Ala 3B', bed: '315A',
    createdBy: COORD_MARIA, assignedTo: CLEANER_JOSE, currentEscalationLevel: 1,
    sla: sla('receive', true), evidence: [],
    history: [hist('created', COORD_MARIA), hist('sla_breach', actor('system', 'Motor SLA', 'system'), 'SLA de recebimento estourado')],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'system',
  },

  // ── VERIFIED (completed and verified) ───────────────────────────
  {
    id: 'TASK-019', shortCode: 'T-019', version: 6,
    type: 'med-admin-iv', category: 'assistencial', subcategory: 'medicacao',
    priority: 'high', status: 'verified', statusChangedAt: NOW,
    title: 'Administrar Ceftriaxona 1g IV',
    ward: 'Ala 3B', bed: '302A', patientMrn: 'MRN-001', patientName: 'Eleanor Voss',
    createdBy: DOC_MARCOS, assignedTo: NURSE_ANA, currentEscalationLevel: 0,
    sla: sla('complete'), completedBy: NURSE_ANA, verifiedBy: DOC_MARCOS,
    evidence: [
      { id: 'EV-002', type: 'timestamp', value: '2026-04-12T07:32:00.000Z', attachedBy: NURSE_ANA, attachedAt: NOW },
      { id: 'EV-003', type: 'text', value: 'Administrada sem intercorrencias, acesso periferico MSD', attachedBy: NURSE_ANA, attachedAt: NOW },
    ],
    receivedAt: NOW, acceptedAt: NOW, startedAt: NOW, completedAt: NOW, verifiedAt: NOW,
    history: [
      hist('created', DOC_MARCOS), hist('received', NURSE_ANA), hist('accepted', NURSE_ANA),
      hist('started', NURSE_ANA), hist('completed', NURSE_ANA, 'Medicacao administrada'),
      hist('verified', DOC_MARCOS),
    ],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },

  // ── CANCELLED ───────────────────────────────────────────────────
  {
    id: 'TASK-020', shortCode: 'T-020', version: 2,
    type: 'transport-patient', category: 'apoio', subcategory: 'transporte',
    priority: 'normal', status: 'cancelled', statusChangedAt: NOW,
    title: 'Transportar paciente ao RX (cancelado)',
    description: 'Exame cancelado pelo medico',
    ward: 'Ala 3B', bed: '312B', patientMrn: 'MRN-009', patientName: 'Patricia Almeida',
    createdBy: NURSE_BEA, assignedTo: TRANSPORT_PEDRO, currentEscalationLevel: 0,
    sla: sla('receive'), evidence: [], cancelledAt: NOW,
    history: [hist('created', NURSE_BEA), hist('cancelled', NURSE_BEA, 'Exame cancelado pelo medico')],
    comments: [], createdAt: NOW, updatedAt: NOW, source: 'manual',
  },
];
