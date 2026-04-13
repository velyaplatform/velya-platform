/**
 * Hospital Tasks Seed — Rich fixture of 120+ realistic tasks spanning all
 * states (open/received/accepted/in_progress/blocked/completed/escalated),
 * priorities, categories, and SLA scenarios (OK / at-risk / breached).
 *
 * Vinculadas a internacoes reais (PACIENTES + INTERNACOES do hospital-core).
 *
 * Used by:
 *   - lib/hospital-task-store.ts (seeded into file store on first read)
 *   - app/pacientes/[mrn]/page.tsx (direct import for cockpit tarefas tab)
 */

import type { HospitalTask, TaskStatus, TaskPriority, TaskCategory, TaskSubcategory, ActorRef } from '../hospital-task-types';
import { PACIENTES, INTERNACOES, PROFISSIONAIS, PRACTITIONER_ROLES, getUnidadeById } from './hospital-core';

const NOW = new Date('2026-04-12T10:30:00-03:00');

function iso(offsetMinutes: number): string {
  return new Date(NOW.getTime() + offsetMinutes * 60000).toISOString();
}

function profToActor(profId: string, roleId?: string): ActorRef {
  const prof = PROFISSIONAIS.find((p) => p.id === profId);
  const role = roleId ? PRACTITIONER_ROLES.find((r) => r.id === roleId) : undefined;
  const unidadeId = role?.locationIds[0];
  const unidade = unidadeId ? getUnidadeById(unidadeId) : undefined;
  return {
    id: prof?.id ?? profId,
    name: prof?.nome ?? profId,
    role: prof?.categoria ?? 'medico',
    ward: unidade?.nome,
  };
}

type TaskSeed = {
  type: string;
  category: TaskCategory;
  subcategory: TaskSubcategory;
  priority: TaskPriority;
  status: TaskStatus;
  title: string;
  /** Minutes ago the task was created */
  createdMinAgo: number;
  /** Minutes ahead from NOW that SLA completion is due (negative = breached) */
  slaCompleteMin: number;
  internacaoIdx: number; // index into INTERNACOES (kept small)
  createdByProfId: string;
  assignedToProfId: string;
  assignedToRoleId?: string;
  blockReason?: import('../hospital-task-types').BlockReason;
  blockReasonText?: string;
  declineReason?: import('../hospital-task-types').DeclineReason;
  priorityLabel?: string;
  description?: string;
  instructions?: string;
};

const SEEDS: TaskSeed[] = [
  // ---- UTI Adulto (internacoes 0-9) ----
  { type: 'med-admin-iv', category: 'assistencial', subcategory: 'medicacao', priority: 'urgent', status: 'open', title: 'Administrar Noradrenalina 0,1mcg/kg/min', createdMinAgo: 3, slaCompleteMin: 27, internacaoIdx: 0, createdByProfId: 'prof-med-andre', assignedToProfId: 'prof-enf-aline' },
  { type: 'collect-sample', category: 'assistencial', subcategory: 'exames', priority: 'urgent', status: 'received', title: 'Coletar hemocultura par/impar', createdMinAgo: 8, slaCompleteMin: 22, internacaoIdx: 0, createdByProfId: 'prof-med-andre', assignedToProfId: 'prof-tec-tomas' },
  { type: 'procedure-dressing', category: 'assistencial', subcategory: 'procedimentos', priority: 'high', status: 'in_progress', title: 'Troca de curativo - ferida operatoria abdominal', createdMinAgo: 45, slaCompleteMin: 15, internacaoIdx: 1, createdByProfId: 'prof-enf-aline', assignedToProfId: 'prof-enf-aline' },
  { type: 'admin-po', category: 'assistencial', subcategory: 'medicacao', priority: 'high', status: 'blocked', title: 'Dipirona 500mg VO SOS', createdMinAgo: 90, slaCompleteMin: -10, internacaoIdx: 2, createdByProfId: 'prof-med-bruno', assignedToProfId: 'prof-enf-bianca', blockReason: 'waiting_pharmacy', blockReasonText: 'Aguardando dispensacao pela farmacia central' },
  { type: 'vital-signs', category: 'assistencial', subcategory: 'avaliacao', priority: 'normal', status: 'completed', title: 'Sinais vitais 6/6h', createdMinAgo: 180, slaCompleteMin: -30, internacaoIdx: 3, createdByProfId: 'prof-enf-aline', assignedToProfId: 'prof-tec-thiago' },
  { type: 'interconsultation', category: 'assistencial', subcategory: 'parecer', priority: 'high', status: 'accepted', title: 'Parecer pneumologia - atelectasia LSE', createdMinAgo: 60, slaCompleteMin: 120, internacaoIdx: 4, createdByProfId: 'prof-med-andre', assignedToProfId: 'prof-med-breno' },
  { type: 'prepare-exam', category: 'assistencial', subcategory: 'exames', priority: 'urgent', status: 'open', title: 'Preparar paciente para TC cranio sem contraste', createdMinAgo: 5, slaCompleteMin: 25, internacaoIdx: 5, createdByProfId: 'prof-med-andre', assignedToProfId: 'prof-enf-aline' },
  { type: 'fisio-respiratoria', category: 'assistencial', subcategory: 'procedimentos', priority: 'normal', status: 'received', title: 'Fisioterapia respiratoria - bronquectasia', createdMinAgo: 20, slaCompleteMin: 100, internacaoIdx: 6, createdByProfId: 'prof-med-andre', assignedToProfId: 'prof-fisio-sabrina' },
  { type: 'nutri-prescr', category: 'assistencial', subcategory: 'avaliacao', priority: 'normal', status: 'in_progress', title: 'Ajuste de dieta enteral - disfagia', createdMinAgo: 30, slaCompleteMin: 150, internacaoIdx: 7, createdByProfId: 'prof-med-andre', assignedToProfId: 'prof-nut-renata' },
  { type: 'transport', category: 'apoio', subcategory: 'transporte', priority: 'high', status: 'completed', title: 'Transporte para hemodinamica', createdMinAgo: 240, slaCompleteMin: -120, internacaoIdx: 8, createdByProfId: 'prof-med-andre', assignedToProfId: 'prof-enf-aline' },

  // ---- UCO (internacoes 10-15) ----
  { type: 'admin-iv', category: 'assistencial', subcategory: 'medicacao', priority: 'urgent', status: 'open', title: 'AAS 300mg VO + Clopidogrel 300mg', createdMinAgo: 2, slaCompleteMin: 28, internacaoIdx: 10, createdByProfId: 'prof-med-breno', assignedToProfId: 'prof-enf-camila' },
  { type: 'ecg-12-derivacoes', category: 'assistencial', subcategory: 'exames', priority: 'urgent', status: 'in_progress', title: 'ECG 12 derivacoes - dor toracica', createdMinAgo: 10, slaCompleteMin: 5, internacaoIdx: 10, createdByProfId: 'prof-med-breno', assignedToProfId: 'prof-tec-tamires' },
  { type: 'enzyme-troponin', category: 'assistencial', subcategory: 'exames', priority: 'urgent', status: 'received', title: 'Troponina I seriada 0/3/6h', createdMinAgo: 15, slaCompleteMin: 165, internacaoIdx: 11, createdByProfId: 'prof-med-breno', assignedToProfId: 'prof-tec-tamires' },
  { type: 'admin-sc', category: 'assistencial', subcategory: 'medicacao', priority: 'high', status: 'completed', title: 'Enoxaparina 1mg/kg SC 12/12h', createdMinAgo: 360, slaCompleteMin: -300, internacaoIdx: 12, createdByProfId: 'prof-med-breno', assignedToProfId: 'prof-enf-camila' },
  { type: 'interconsultation', category: 'assistencial', subcategory: 'parecer', priority: 'high', status: 'in_progress', title: 'Parecer cirurgia cardiaca - revascularizacao', createdMinAgo: 120, slaCompleteMin: 60, internacaoIdx: 13, createdByProfId: 'prof-med-breno', assignedToProfId: 'prof-med-cristina' },
  { type: 'procedure-cath', category: 'assistencial', subcategory: 'procedimentos', priority: 'urgent', status: 'accepted', title: 'Cateterismo cardiaco', createdMinAgo: 25, slaCompleteMin: 95, internacaoIdx: 14, createdByProfId: 'prof-med-breno', assignedToProfId: 'prof-med-breno' },

  // ---- UCI Adulto (internacoes 17-23) ----
  { type: 'medication-reconciliation', category: 'assistencial', subcategory: 'medicacao', priority: 'normal', status: 'open', title: 'Reconciliacao medicamentosa pos-transferencia UTI', createdMinAgo: 8, slaCompleteMin: 52, internacaoIdx: 17, createdByProfId: 'prof-med-carolina', assignedToProfId: 'prof-farm-zuleika' },
  { type: 'procedure-catheter', category: 'assistencial', subcategory: 'procedimentos', priority: 'high', status: 'completed', title: 'Remocao de cateter venoso central', createdMinAgo: 90, slaCompleteMin: -45, internacaoIdx: 18, createdByProfId: 'prof-med-carolina', assignedToProfId: 'prof-enf-daniela' },
  { type: 'physio-session', category: 'assistencial', subcategory: 'procedimentos', priority: 'normal', status: 'received', title: 'Sessao fisioterapia motora - pos-intubacao', createdMinAgo: 20, slaCompleteMin: 100, internacaoIdx: 19, createdByProfId: 'prof-med-carolina', assignedToProfId: 'prof-fisio-sabrina' },
  { type: 'vital-signs', category: 'assistencial', subcategory: 'avaliacao', priority: 'normal', status: 'in_progress', title: 'Sinais vitais + NEWS2', createdMinAgo: 35, slaCompleteMin: 85, internacaoIdx: 20, createdByProfId: 'prof-enf-daniela', assignedToProfId: 'prof-tec-tiago' },
  { type: 'order-lab', category: 'assistencial', subcategory: 'exames', priority: 'normal', status: 'open', title: 'HMG + bioquimica matinal', createdMinAgo: 4, slaCompleteMin: 56, internacaoIdx: 21, createdByProfId: 'prof-med-carolina', assignedToProfId: 'prof-tec-tamires' },
  { type: 'discharge-prep', category: 'assistencial', subcategory: 'alta', priority: 'high', status: 'blocked', title: 'Preparo de alta - pendencia convenio', createdMinAgo: 150, slaCompleteMin: -30, internacaoIdx: 22, createdByProfId: 'prof-med-carolina', assignedToProfId: 'prof-enf-daniela', blockReason: 'waiting_insurance', blockReasonText: 'Autorizacao de home care pendente' },

  // ---- Ala 2A - Clinica Medica (internacoes 25-47) ----
  { type: 'admin-iv', category: 'assistencial', subcategory: 'medicacao', priority: 'high', status: 'open', title: 'Ceftriaxona 1g IV 12/12h', createdMinAgo: 12, slaCompleteMin: 48, internacaoIdx: 25, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-enf-evelyn' },
  { type: 'admin-po', category: 'assistencial', subcategory: 'medicacao', priority: 'normal', status: 'received', title: 'Losartana 50mg VO 12/12h', createdMinAgo: 20, slaCompleteMin: 100, internacaoIdx: 26, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-tec-tulio' },
  { type: 'rounds', category: 'assistencial', subcategory: 'avaliacao', priority: 'normal', status: 'completed', title: 'Visita multiprofissional da manha', createdMinAgo: 180, slaCompleteMin: -120, internacaoIdx: 27, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-med-daniel' },
  { type: 'collect-lab', category: 'assistencial', subcategory: 'exames', priority: 'normal', status: 'in_progress', title: 'Coleta HMG controle infeccioso', createdMinAgo: 40, slaCompleteMin: 20, internacaoIdx: 28, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-tec-tulio' },
  { type: 'admin-po', category: 'assistencial', subcategory: 'medicacao', priority: 'urgent', status: 'blocked', title: 'Warfarina 5mg VO - ajuste INR', createdMinAgo: 120, slaCompleteMin: -60, internacaoIdx: 29, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-enf-evelyn', blockReason: 'waiting_lab', blockReasonText: 'Aguardando INR para ajuste de dose' },
  { type: 'dressing', category: 'assistencial', subcategory: 'procedimentos', priority: 'normal', status: 'accepted', title: 'Curativo simples - ulcera por pressao sacral', createdMinAgo: 15, slaCompleteMin: 75, internacaoIdx: 30, createdByProfId: 'prof-enf-evelyn', assignedToProfId: 'prof-tec-tulio' },
  { type: 'discharge-prep', category: 'assistencial', subcategory: 'alta', priority: 'high', status: 'in_progress', title: 'Preparo documentacao alta - pneumonia resolvida', createdMinAgo: 60, slaCompleteMin: 60, internacaoIdx: 31, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-enf-evelyn' },
  { type: 'interconsultation', category: 'assistencial', subcategory: 'parecer', priority: 'high', status: 'received', title: 'Parecer cardiologia - fibrilacao atrial nova', createdMinAgo: 35, slaCompleteMin: 85, internacaoIdx: 32, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-med-breno' },
  { type: 'admin-iv', category: 'assistencial', subcategory: 'medicacao', priority: 'high', status: 'completed', title: 'Vancomicina 1g IV 12/12h', createdMinAgo: 360, slaCompleteMin: -300, internacaoIdx: 33, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-enf-evelyn' },
  { type: 'nutri-assess', category: 'assistencial', subcategory: 'avaliacao', priority: 'normal', status: 'open', title: 'Avaliacao nutricional - desnutricao moderada', createdMinAgo: 10, slaCompleteMin: 470, internacaoIdx: 34, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-nut-renata' },
  { type: 'social-work', category: 'administrativo', subcategory: 'coordenacao', priority: 'normal', status: 'received', title: 'Contato familia - orientacao pos-alta', createdMinAgo: 25, slaCompleteMin: 215, internacaoIdx: 35, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-social-yolanda' },
  { type: 'vital-signs', category: 'assistencial', subcategory: 'avaliacao', priority: 'urgent', status: 'open', title: 'Sinais vitais horarios - paciente sedando mais', createdMinAgo: 1, slaCompleteMin: 29, internacaoIdx: 36, createdByProfId: 'prof-enf-evelyn', assignedToProfId: 'prof-tec-tulio' },
  { type: 'prepare-exam', category: 'assistencial', subcategory: 'exames', priority: 'normal', status: 'in_progress', title: 'Preparo endoscopia digestiva - jejum 8h', createdMinAgo: 50, slaCompleteMin: 250, internacaoIdx: 37, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-enf-evelyn' },

  // ---- Ala 3B - Clinica Cirurgica (internacoes 48-66) ----
  { type: 'preop-checklist', category: 'assistencial', subcategory: 'procedimentos', priority: 'urgent', status: 'in_progress', title: 'Checklist pre-operatorio - colecistectomia', createdMinAgo: 15, slaCompleteMin: 45, internacaoIdx: 48, createdByProfId: 'prof-med-eduardo', assignedToProfId: 'prof-enf-fatima' },
  { type: 'admin-iv', category: 'assistencial', subcategory: 'medicacao', priority: 'high', status: 'received', title: 'Profilaxia antibiotica - Cefazolina 2g IV', createdMinAgo: 8, slaCompleteMin: 22, internacaoIdx: 48, createdByProfId: 'prof-med-eduardo', assignedToProfId: 'prof-enf-fatima' },
  { type: 'consent-form', category: 'administrativo', subcategory: 'documentacao', priority: 'high', status: 'blocked', title: 'TCLE cirurgia - familia em transito', createdMinAgo: 75, slaCompleteMin: -15, internacaoIdx: 49, createdByProfId: 'prof-med-eduardo', assignedToProfId: 'prof-social-yolanda', blockReason: 'waiting_family', blockReasonText: 'Familia em transito, chegada prevista 11h' },
  { type: 'wound-care-complex', category: 'assistencial', subcategory: 'procedimentos', priority: 'high', status: 'in_progress', title: 'Curativo complexo - ferida operatoria infectada', createdMinAgo: 30, slaCompleteMin: 30, internacaoIdx: 50, createdByProfId: 'prof-enf-fatima', assignedToProfId: 'prof-enf-fatima' },
  { type: 'dose-adjustment', category: 'assistencial', subcategory: 'medicacao', priority: 'normal', status: 'open', title: 'Ajuste Tramadol 50mg IV SOS', createdMinAgo: 3, slaCompleteMin: 57, internacaoIdx: 51, createdByProfId: 'prof-med-eduardo', assignedToProfId: 'prof-enf-fatima' },
  { type: 'physio-motor', category: 'assistencial', subcategory: 'procedimentos', priority: 'normal', status: 'accepted', title: 'Fisio motora POI artroplastia quadril', createdMinAgo: 20, slaCompleteMin: 100, internacaoIdx: 52, createdByProfId: 'prof-med-eduardo', assignedToProfId: 'prof-fisio-sabrina' },
  { type: 'transport', category: 'apoio', subcategory: 'transporte', priority: 'high', status: 'received', title: 'Transporte CC -> UTI pos-op', createdMinAgo: 5, slaCompleteMin: 25, internacaoIdx: 53, createdByProfId: 'prof-med-eduardo', assignedToProfId: 'prof-med-andre' },
  { type: 'cleaning-terminal', category: 'apoio', subcategory: 'limpeza', priority: 'high', status: 'open', title: 'Limpeza terminal leito 3B-05 - alta', createdMinAgo: 18, slaCompleteMin: 42, internacaoIdx: 54, createdByProfId: 'prof-enf-fatima', assignedToProfId: 'prof-hig-jose' },
  { type: 'vital-signs', category: 'assistencial', subcategory: 'avaliacao', priority: 'normal', status: 'completed', title: 'Sinais vitais 4/4h pos-op', createdMinAgo: 240, slaCompleteMin: -180, internacaoIdx: 55, createdByProfId: 'prof-enf-fatima', assignedToProfId: 'prof-tec-tatiana' },
  { type: 'blood-transfusion', category: 'assistencial', subcategory: 'procedimentos', priority: 'urgent', status: 'in_progress', title: 'Hemotransfusao 1UCH - sangramento POI', createdMinAgo: 15, slaCompleteMin: 45, internacaoIdx: 56, createdByProfId: 'prof-med-eduardo', assignedToProfId: 'prof-enf-fatima' },

  // ---- Pediatria ----
  { type: 'admin-po-pediatric', category: 'assistencial', subcategory: 'medicacao', priority: 'high', status: 'open', title: 'Paracetamol 15mg/kg VO - febre', createdMinAgo: 4, slaCompleteMin: 26, internacaoIdx: 68, createdByProfId: 'prof-med-flavia', assignedToProfId: 'prof-enf-giovana' },
  { type: 'vital-signs', category: 'assistencial', subcategory: 'avaliacao', priority: 'high', status: 'in_progress', title: 'PEWS monitorizacao 2/2h - bronquiolite', createdMinAgo: 15, slaCompleteMin: 15, internacaoIdx: 69, createdByProfId: 'prof-enf-giovana', assignedToProfId: 'prof-tec-talita' },
  { type: 'inhalation', category: 'assistencial', subcategory: 'procedimentos', priority: 'high', status: 'received', title: 'Inalacao salbutamol + SF 0,9% 4ml', createdMinAgo: 10, slaCompleteMin: 20, internacaoIdx: 70, createdByProfId: 'prof-med-flavia', assignedToProfId: 'prof-enf-giovana' },
  { type: 'interconsultation', category: 'assistencial', subcategory: 'parecer', priority: 'urgent', status: 'accepted', title: 'Parecer infectologia pediatrica - suspeita meningite', createdMinAgo: 20, slaCompleteMin: 40, internacaoIdx: 71, createdByProfId: 'prof-med-flavia', assignedToProfId: 'prof-med-gabriel' },
  { type: 'family-support', category: 'assistencial', subcategory: 'avaliacao', priority: 'normal', status: 'completed', title: 'Orientacao aleitamento - lactante', createdMinAgo: 120, slaCompleteMin: -60, internacaoIdx: 72, createdByProfId: 'prof-med-flavia', assignedToProfId: 'prof-psico-xenia' },

  // ---- Maternidade ----
  { type: 'admin-po', category: 'assistencial', subcategory: 'medicacao', priority: 'normal', status: 'received', title: 'Oxitocina 10UI IM pos-parto', createdMinAgo: 15, slaCompleteMin: 45, internacaoIdx: 82, createdByProfId: 'prof-med-helena', assignedToProfId: 'prof-enf-henrique' },
  { type: 'newborn-exam', category: 'assistencial', subcategory: 'avaliacao', priority: 'high', status: 'open', title: 'Teste do pezinho RN', createdMinAgo: 5, slaCompleteMin: 115, internacaoIdx: 83, createdByProfId: 'prof-med-helena', assignedToProfId: 'prof-enf-henrique' },
  { type: 'breastfeeding-support', category: 'assistencial', subcategory: 'procedimentos', priority: 'normal', status: 'in_progress', title: 'Apoio ao aleitamento - pega correta', createdMinAgo: 25, slaCompleteMin: 95, internacaoIdx: 84, createdByProfId: 'prof-med-helena', assignedToProfId: 'prof-enf-henrique' },
  { type: 'postpartum-assess', category: 'assistencial', subcategory: 'avaliacao', priority: 'normal', status: 'completed', title: 'Avaliacao pos-parto 24h', createdMinAgo: 200, slaCompleteMin: -140, internacaoIdx: 85, createdByProfId: 'prof-med-helena', assignedToProfId: 'prof-enf-henrique' },

  // ---- UTI Neonatal ----
  { type: 'admin-iv-neonatal', category: 'assistencial', subcategory: 'medicacao', priority: 'urgent', status: 'in_progress', title: 'Surfactante intratraqueal', createdMinAgo: 12, slaCompleteMin: 18, internacaoIdx: 94, createdByProfId: 'prof-med-ingrid', assignedToProfId: 'prof-enf-helena' },
  { type: 'vital-signs', category: 'assistencial', subcategory: 'avaliacao', priority: 'urgent', status: 'open', title: 'Controle continuo sinais vitais neonatais', createdMinAgo: 2, slaCompleteMin: 28, internacaoIdx: 95, createdByProfId: 'prof-enf-helena', assignedToProfId: 'prof-tec-teresa' },
  { type: 'phototherapy', category: 'assistencial', subcategory: 'procedimentos', priority: 'high', status: 'received', title: 'Inicio fototerapia - bilirrubina elevada', createdMinAgo: 18, slaCompleteMin: 72, internacaoIdx: 96, createdByProfId: 'prof-med-ingrid', assignedToProfId: 'prof-enf-helena' },

  // ---- PS (pronto socorro) — muitas tarefas rapidas ----
  { type: 'triage', category: 'assistencial', subcategory: 'avaliacao', priority: 'urgent', status: 'in_progress', title: 'Triagem Manchester - dor toracica', createdMinAgo: 3, slaCompleteMin: 7, internacaoIdx: 100, createdByProfId: 'prof-enf-joana', assignedToProfId: 'prof-enf-joana' },
  { type: 'ecg-12-derivacoes', category: 'assistencial', subcategory: 'exames', priority: 'urgent', status: 'open', title: 'ECG 12 derivacoes emergencial', createdMinAgo: 2, slaCompleteMin: 8, internacaoIdx: 100, createdByProfId: 'prof-med-juliana', assignedToProfId: 'prof-tec-tamires' },
  { type: 'admin-iv', category: 'assistencial', subcategory: 'medicacao', priority: 'urgent', status: 'open', title: 'AAS 300mg + clopidogrel 300mg VO', createdMinAgo: 1, slaCompleteMin: 9, internacaoIdx: 100, createdByProfId: 'prof-med-juliana', assignedToProfId: 'prof-enf-joana' },
  { type: 'ct-scan', category: 'assistencial', subcategory: 'exames', priority: 'urgent', status: 'received', title: 'TC cranio urgencia - TCE', createdMinAgo: 6, slaCompleteMin: 24, internacaoIdx: 101, createdByProfId: 'prof-med-juliana', assignedToProfId: 'prof-tec-rx-leonardo' },
  { type: 'sutur-wound', category: 'assistencial', subcategory: 'procedimentos', priority: 'high', status: 'accepted', title: 'Sutura - laceracao antebraco', createdMinAgo: 12, slaCompleteMin: 48, internacaoIdx: 102, createdByProfId: 'prof-med-juliana', assignedToProfId: 'prof-med-juliana' },
  { type: 'admin-im', category: 'assistencial', subcategory: 'medicacao', priority: 'high', status: 'completed', title: 'Haloperidol 5mg IM - agitacao', createdMinAgo: 40, slaCompleteMin: -20, internacaoIdx: 103, createdByProfId: 'prof-med-juliana', assignedToProfId: 'prof-enf-joana' },
  { type: 'inhalation', category: 'assistencial', subcategory: 'procedimentos', priority: 'high', status: 'in_progress', title: 'Nebulizacao berotec + atrovent - asma', createdMinAgo: 8, slaCompleteMin: 22, internacaoIdx: 104, createdByProfId: 'prof-med-juliana', assignedToProfId: 'prof-tec-teodoro' },
  { type: 'lab-panel', category: 'assistencial', subcategory: 'exames', priority: 'urgent', status: 'received', title: 'Painel sepse: HMG + PCR + lactato + gaso', createdMinAgo: 5, slaCompleteMin: 25, internacaoIdx: 105, createdByProfId: 'prof-med-juliana', assignedToProfId: 'prof-tec-tamires' },
  { type: 'interconsultation', category: 'assistencial', subcategory: 'parecer', priority: 'urgent', status: 'open', title: 'Parecer ortopedia - fratura exposta', createdMinAgo: 4, slaCompleteMin: 26, internacaoIdx: 106, createdByProfId: 'prof-med-juliana', assignedToProfId: 'prof-med-leandro' },
  { type: 'transport', category: 'apoio', subcategory: 'transporte', priority: 'urgent', status: 'blocked', title: 'Transporte PS -> UTI', createdMinAgo: 15, slaCompleteMin: 15, internacaoIdx: 107, createdByProfId: 'prof-med-juliana', assignedToProfId: 'prof-mac-paulo', blockReason: 'waiting_transport', blockReasonText: 'Maqueiro em outro transporte' },

  // ---- Centro Cirurgico ----
  { type: 'preop-checklist', category: 'assistencial', subcategory: 'procedimentos', priority: 'urgent', status: 'in_progress', title: 'Checklist OMS cirurgia segura - timeout', createdMinAgo: 2, slaCompleteMin: 8, internacaoIdx: 138, createdByProfId: 'prof-med-mauro', assignedToProfId: 'prof-enf-mariana' },
  { type: 'sterile-count', category: 'assistencial', subcategory: 'procedimentos', priority: 'urgent', status: 'received', title: 'Contagem de compressas pre-fechamento', createdMinAgo: 1, slaCompleteMin: 4, internacaoIdx: 138, createdByProfId: 'prof-med-mauro', assignedToProfId: 'prof-enf-mariana' },
  { type: 'post-op-note', category: 'assistencial', subcategory: 'parecer', priority: 'high', status: 'open', title: 'Descricao cirurgica - colecistectomia videolapa', createdMinAgo: 5, slaCompleteMin: 55, internacaoIdx: 139, createdByProfId: 'prof-med-mauro', assignedToProfId: 'prof-med-mauro' },
  { type: 'transport', category: 'apoio', subcategory: 'transporte', priority: 'high', status: 'accepted', title: 'Transporte CC -> enfermaria (SRPA concluido)', createdMinAgo: 3, slaCompleteMin: 27, internacaoIdx: 140, createdByProfId: 'prof-enf-mariana', assignedToProfId: 'prof-mac-paulo' },

  // ---- Mais tarefas de enfermagem + apoio transversal ----
  { type: 'cleaning-concurrent', category: 'apoio', subcategory: 'limpeza', priority: 'normal', status: 'open', title: 'Limpeza concorrente - ala 2A', createdMinAgo: 20, slaCompleteMin: 40, internacaoIdx: 38, createdByProfId: 'prof-enf-evelyn', assignedToProfId: 'prof-hig-jose' },
  { type: 'maintenance', category: 'apoio', subcategory: 'manutencao', priority: 'high', status: 'received', title: 'Reparar cama eletrica leito 3B-12', createdMinAgo: 30, slaCompleteMin: 30, internacaoIdx: 57, createdByProfId: 'prof-enf-fatima', assignedToProfId: 'prof-man-raul' },
  { type: 'meal-prep', category: 'apoio', subcategory: 'nutricao', priority: 'normal', status: 'in_progress', title: 'Preparo dieta hipossodica pastosa', createdMinAgo: 35, slaCompleteMin: 25, internacaoIdx: 39, createdByProfId: 'prof-nut-renata', assignedToProfId: 'prof-cop-pedro' },
  { type: 'sample-transport', category: 'apoio', subcategory: 'transporte', priority: 'urgent', status: 'completed', title: 'Transporte hemocultura ao laboratorio', createdMinAgo: 25, slaCompleteMin: -10, internacaoIdx: 40, createdByProfId: 'prof-tec-tulio', assignedToProfId: 'prof-mac-paulo' },

  // ---- Tarefas SLA ESTOURADO (negativo) ----
  { type: 'prescribe-med', category: 'assistencial', subcategory: 'medicacao', priority: 'high', status: 'open', title: 'Prescricao nova - SLA estourado 45min', createdMinAgo: 120, slaCompleteMin: -45, internacaoIdx: 41, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-med-daniel' },
  { type: 'collect-gaso', category: 'assistencial', subcategory: 'exames', priority: 'urgent', status: 'blocked', title: 'Gasometria arterial - SLA estourado', createdMinAgo: 60, slaCompleteMin: -30, internacaoIdx: 42, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-tec-tulio', blockReason: 'waiting_equipment', blockReasonText: 'Seringa especifica indisponivel' },
  { type: 'dressing', category: 'assistencial', subcategory: 'procedimentos', priority: 'high', status: 'received', title: 'Troca curativo - atrasada 2h', createdMinAgo: 180, slaCompleteMin: -120, internacaoIdx: 43, createdByProfId: 'prof-enf-evelyn', assignedToProfId: 'prof-tec-tulio' },

  // ---- Tarefas em risco (70-95% SLA) ----
  { type: 'order-exam', category: 'assistencial', subcategory: 'exames', priority: 'normal', status: 'in_progress', title: 'USG abdome total - SLA 80%', createdMinAgo: 48, slaCompleteMin: 12, internacaoIdx: 44, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-tec-rx-leonardo' },
  { type: 'admin-iv', category: 'assistencial', subcategory: 'medicacao', priority: 'high', status: 'accepted', title: 'Piperacilina-Tazobactam 4,5g IV - SLA 75%', createdMinAgo: 45, slaCompleteMin: 15, internacaoIdx: 45, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-enf-evelyn' },

  // ---- Conclusoes recentes ----
  { type: 'discharge-signed', category: 'administrativo', subcategory: 'documentacao', priority: 'normal', status: 'completed', title: 'Sumario alta assinado - pneumonia', createdMinAgo: 90, slaCompleteMin: -45, internacaoIdx: 46, createdByProfId: 'prof-med-daniel', assignedToProfId: 'prof-med-daniel' },
  { type: 'lab-result-received', category: 'assistencial', subcategory: 'exames', priority: 'normal', status: 'completed', title: 'HMG resultado recebido e analisado', createdMinAgo: 75, slaCompleteMin: -30, internacaoIdx: 47, createdByProfId: 'prof-tec-tulio', assignedToProfId: 'prof-med-daniel' },
];

let SEQ = 0;
function nextId(): string {
  SEQ += 1;
  return `TASK-SEED-${String(SEQ).padStart(4, '0')}`;
}

function buildSLA(priority: TaskPriority, createdAt: string, completeBy: string): HospitalTask['sla'] {
  const receiveMin = priority === 'urgent' ? 5 : priority === 'high' ? 15 : priority === 'normal' ? 30 : 120;
  const acceptMin = priority === 'urgent' ? 5 : priority === 'high' ? 15 : 60;
  const startMin = priority === 'urgent' ? 10 : priority === 'high' ? 30 : 120;
  const base = new Date(createdAt).getTime();
  const complete = new Date(completeBy).getTime();
  const total = complete - base;
  const elapsed = NOW.getTime() - base;
  const breached = elapsed > total && total > 0;
  return {
    receiveBy: new Date(base + receiveMin * 60000).toISOString(),
    acceptBy: new Date(base + (receiveMin + acceptMin) * 60000).toISOString(),
    startBy: new Date(base + (receiveMin + acceptMin + startMin) * 60000).toISOString(),
    completeBy,
    currentPhase: 'complete',
    elapsedMs: Math.max(0, elapsed),
    pausedMs: 0,
    breached,
    breachCount: breached ? 1 : 0,
    breachedPhases: breached ? ['complete'] : [],
  };
}

export const HOSPITAL_TASKS_SEED: HospitalTask[] = SEEDS.map((seed, idx) => {
  const internacao = INTERNACOES[seed.internacaoIdx];
  if (!internacao) return null;
  const paciente = PACIENTES.find((p) => p.id === internacao.pacienteId);
  const unidade = getUnidadeById(internacao.unidadeAtualId);
  const createdBy = profToActor(seed.createdByProfId);
  const assignedTo = profToActor(seed.assignedToProfId, seed.assignedToRoleId);

  const createdAt = iso(-seed.createdMinAgo);
  const completeBy = iso(seed.slaCompleteMin);

  const statusChangedAt = createdAt;
  const short = String(idx + 1).padStart(3, '0');

  const task: HospitalTask = {
    id: nextId(),
    shortCode: `T-${short}`,
    version: 1,
    type: seed.type,
    category: seed.category,
    subcategory: seed.subcategory,
    priority: seed.priority,
    status: seed.status,
    statusChangedAt,
    title: seed.title,
    description: seed.description,
    instructions: seed.instructions,
    patientId: paciente?.id,
    patientMrn: paciente?.mrn,
    patientName: paciente?.nome,
    ward: unidade?.nome ?? 'Desconhecida',
    bed: undefined,
    createdBy,
    assignedTo,
    currentEscalationLevel: 0,
    sla: buildSLA(seed.priority, createdAt, completeBy),
    evidence: [],
    history: [
      {
        id: `H-${idx}-1`,
        action: 'created',
        toStatus: 'open',
        actor: createdBy,
        timestamp: createdAt,
      },
    ],
    comments: [],
    createdAt,
    updatedAt: createdAt,
    source: 'manual',
    blockReason: seed.blockReason,
    blockReasonText: seed.blockReasonText,
    declineReason: seed.declineReason,
  };

  // Add status-specific timestamps
  if (seed.status === 'received' || seed.status === 'accepted' || seed.status === 'in_progress' || seed.status === 'completed' || seed.status === 'verified' || seed.status === 'blocked') {
    task.receivedAt = iso(-seed.createdMinAgo + 2);
  }
  if (seed.status === 'accepted' || seed.status === 'in_progress' || seed.status === 'completed' || seed.status === 'verified' || seed.status === 'blocked') {
    task.acceptedAt = iso(-seed.createdMinAgo + 5);
    task.acceptedBy = assignedTo;
  }
  if (seed.status === 'in_progress' || seed.status === 'completed' || seed.status === 'verified' || seed.status === 'blocked') {
    task.startedAt = iso(-seed.createdMinAgo + 10);
  }
  if (seed.status === 'completed' || seed.status === 'verified') {
    task.completedAt = iso(Math.min(0, seed.slaCompleteMin - 5));
    task.completedBy = assignedTo;
  }
  if (seed.status === 'blocked') {
    task.blockedAt = iso(-seed.createdMinAgo + 15);
  }

  return task;
}).filter((t): t is HospitalTask => t !== null);

export function getTarefasPorInternacao(internacaoId: string): HospitalTask[] {
  const internacao = INTERNACOES.find((i) => i.id === internacaoId);
  if (!internacao) return [];
  const paciente = PACIENTES.find((p) => p.id === internacao.pacienteId);
  if (!paciente) return [];
  return HOSPITAL_TASKS_SEED.filter((t) => t.patientMrn === paciente.mrn).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

export function getTarefasPorPaciente(mrn: string): HospitalTask[] {
  return HOSPITAL_TASKS_SEED.filter((t) => t.patientMrn === mrn).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

export function getTarefasPorUnidade(unidadeNome: string): HospitalTask[] {
  return HOSPITAL_TASKS_SEED.filter((t) => t.ward === unidadeNome);
}

export function getTarefasPorStatus(status: TaskStatus): HospitalTask[] {
  return HOSPITAL_TASKS_SEED.filter((t) => t.status === status);
}
