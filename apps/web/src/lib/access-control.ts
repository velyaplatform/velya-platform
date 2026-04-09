/**
 * Velya Hospital Platform - Access Control Engine
 *
 * Implements RBAC + ABAC + ReBAC authorization for Brazilian hospital compliance.
 * Conservative deny-by-default approach aligned with LGPD and CFM/COFEN regulations.
 */

// === TYPES ===

export type ProfessionalRole =
  | 'medical_staff_attending'
  | 'medical_staff_on_call'
  | 'nurse'
  | 'nursing_technician'
  | 'nursing_assistant'
  | 'pharmacist_clinical'
  | 'physiotherapist'
  | 'nutritionist'
  | 'psychologist'
  | 'social_worker'
  | 'speech_therapist'
  | 'occupational_therapist'
  | 'lab_staff'
  | 'imaging_staff'
  | 'receptionist_registration'
  | 'billing_authorization'
  | 'ambulance_driver'
  | 'patient_transporter'
  | 'cleaning_hygiene'
  | 'maintenance'
  | 'security_guard'
  | 'bed_management'
  | 'case_manager'
  | 'compliance_auditor'
  | 'clinical_director'
  | 'hospital_owner_executive'
  | 'it_support_jit'
  | 'security_admin_jit'
  | 'admin_system';

export type DataClass = 'A' | 'B' | 'C' | 'D' | 'E';
// A = operational (bed, room, cleaning status)
// B = administrative (registration, insurance, billing)
// C = contextual clinical (vitals, nursing care, meds)
// D = sensitive clinical (diagnoses, history, prescriptions)
// E = highly restricted (psych, HIV, violence, judicial)

export type AccessAction =
  | 'view_demographics'
  | 'view_clinical_summary'
  | 'view_full_chart'
  | 'view_sensitive_records'
  | 'create_nursing_note'
  | 'create_medical_evolution'
  | 'prescribe_medication'
  | 'order_exam'
  | 'sign_document'
  | 'approve_discharge'
  | 'manage_transport'
  | 'manage_cleaning'
  | 'manage_billing'
  | 'export_data'
  | 'print_record'
  | 'break_glass'
  | 'view_audit_log'
  | 'manage_system'
  | 'view_observability'
  | 'manage_suggestions';

export type AccessLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface RoleDefinition {
  id: ProfessionalRole;
  displayName: string;
  professionalCouncil?: string;
  accessLevel: AccessLevel;
  allowedDataClasses: DataClass[];
  allowedActions: AccessAction[];
  breakGlassEligible: boolean;
  auditLevel: 'standard' | 'elevated' | 'maximum';
  /** UI navigation sections this role can see */
  allowedNavSections: string[];
}

// === NAV SECTION CONSTANTS ===

const NAV_ASSISTENCIAL = 'assistencial';
const NAV_GESTAO = 'gestao';
const NAV_ADMINISTRACAO = 'administracao';
const NAV_OBSERVABILIDADE = 'observabilidade';

export const NAV_SECTIONS = {
  ASSISTENCIAL: NAV_ASSISTENCIAL,
  GESTAO: NAV_GESTAO,
  ADMINISTRACAO: NAV_ADMINISTRACAO,
  OBSERVABILIDADE: NAV_OBSERVABILIDADE,
} as const;

// === ROLE DEFINITIONS ===

export const ROLE_DEFINITIONS: Record<ProfessionalRole, RoleDefinition> = {
  // --- Clinical roles ---

  medical_staff_attending: {
    id: 'medical_staff_attending',
    displayName: 'Medico(a) Assistente',
    professionalCouncil: 'CRM',
    accessLevel: 6,
    allowedDataClasses: ['A', 'B', 'C', 'D'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'create_medical_evolution',
      'prescribe_medication',
      'order_exam',
      'sign_document',
      'approve_discharge',
      'print_record',
      'break_glass',
    ],
    breakGlassEligible: true,
    auditLevel: 'elevated',
    allowedNavSections: [NAV_ASSISTENCIAL, NAV_GESTAO],
  },

  medical_staff_on_call: {
    id: 'medical_staff_on_call',
    displayName: 'Medico(a) Plantonista',
    professionalCouncil: 'CRM',
    accessLevel: 5,
    allowedDataClasses: ['A', 'B', 'C', 'D'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'create_medical_evolution',
      'prescribe_medication',
      'order_exam',
      'sign_document',
      'print_record',
      'break_glass',
    ],
    breakGlassEligible: true,
    auditLevel: 'elevated',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  nurse: {
    id: 'nurse',
    displayName: 'Enfermeiro(a)',
    professionalCouncil: 'COREN',
    accessLevel: 5,
    allowedDataClasses: ['A', 'B', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'create_nursing_note',
      'sign_document',
      'print_record',
      'break_glass',
      'manage_suggestions',
    ],
    breakGlassEligible: true,
    auditLevel: 'elevated',
    allowedNavSections: [NAV_ASSISTENCIAL, NAV_GESTAO],
  },

  nursing_technician: {
    id: 'nursing_technician',
    displayName: 'Tecnico(a) de Enfermagem',
    professionalCouncil: 'COREN',
    accessLevel: 3,
    allowedDataClasses: ['A', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'create_nursing_note',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  nursing_assistant: {
    id: 'nursing_assistant',
    displayName: 'Auxiliar de Enfermagem',
    professionalCouncil: 'COREN',
    accessLevel: 2,
    allowedDataClasses: ['A', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'create_nursing_note',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  pharmacist_clinical: {
    id: 'pharmacist_clinical',
    displayName: 'Farmaceutico(a) Clinico',
    professionalCouncil: 'CRF',
    accessLevel: 5,
    allowedDataClasses: ['A', 'B', 'C', 'D'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: true,
    auditLevel: 'elevated',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  physiotherapist: {
    id: 'physiotherapist',
    displayName: 'Fisioterapeuta',
    professionalCouncil: 'CREFITO',
    accessLevel: 4,
    allowedDataClasses: ['A', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'create_nursing_note',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  nutritionist: {
    id: 'nutritionist',
    displayName: 'Nutricionista',
    professionalCouncil: 'CRN',
    accessLevel: 4,
    allowedDataClasses: ['A', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'create_nursing_note',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  psychologist: {
    id: 'psychologist',
    displayName: 'Psicologo(a)',
    professionalCouncil: 'CRP',
    accessLevel: 5,
    allowedDataClasses: ['A', 'C', 'D', 'E'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'view_sensitive_records',
      'create_nursing_note',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: true,
    auditLevel: 'elevated',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  social_worker: {
    id: 'social_worker',
    displayName: 'Assistente Social',
    professionalCouncil: 'CRESS',
    accessLevel: 4,
    allowedDataClasses: ['A', 'B', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'create_nursing_note',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL, NAV_GESTAO],
  },

  speech_therapist: {
    id: 'speech_therapist',
    displayName: 'Fonoaudiologo(a)',
    professionalCouncil: 'CRFa',
    accessLevel: 4,
    allowedDataClasses: ['A', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'create_nursing_note',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  occupational_therapist: {
    id: 'occupational_therapist',
    displayName: 'Terapeuta Ocupacional',
    professionalCouncil: 'CREFITO',
    accessLevel: 4,
    allowedDataClasses: ['A', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'create_nursing_note',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  // --- Diagnostic roles ---

  lab_staff: {
    id: 'lab_staff',
    displayName: 'Equipe de Laboratorio',
    professionalCouncil: 'CRBM',
    accessLevel: 3,
    allowedDataClasses: ['A', 'B', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  imaging_staff: {
    id: 'imaging_staff',
    displayName: 'Equipe de Imagem',
    professionalCouncil: 'CRTR',
    accessLevel: 3,
    allowedDataClasses: ['A', 'B', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  // --- Administrative roles ---

  receptionist_registration: {
    id: 'receptionist_registration',
    displayName: 'Recepcionista',
    accessLevel: 2,
    allowedDataClasses: ['A', 'B'],
    allowedActions: [
      'view_demographics',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  billing_authorization: {
    id: 'billing_authorization',
    displayName: 'Faturamento e Autorizacao',
    accessLevel: 3,
    allowedDataClasses: ['A', 'B'],
    allowedActions: [
      'view_demographics',
      'manage_billing',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'elevated',
    allowedNavSections: [NAV_GESTAO],
  },

  // --- Operational roles ---

  ambulance_driver: {
    id: 'ambulance_driver',
    displayName: 'Motorista de Ambulancia',
    accessLevel: 1,
    allowedDataClasses: ['A'],
    allowedActions: [
      'view_demographics',
      'manage_transport',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  patient_transporter: {
    id: 'patient_transporter',
    displayName: 'Maqueiro(a)',
    accessLevel: 1,
    allowedDataClasses: ['A'],
    allowedActions: [
      'view_demographics',
      'manage_transport',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  cleaning_hygiene: {
    id: 'cleaning_hygiene',
    displayName: 'Higienizacao',
    accessLevel: 0,
    allowedDataClasses: ['A'],
    allowedActions: [
      'manage_cleaning',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  maintenance: {
    id: 'maintenance',
    displayName: 'Manutencao',
    accessLevel: 0,
    allowedDataClasses: ['A'],
    allowedActions: [],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  security_guard: {
    id: 'security_guard',
    displayName: 'Seguranca Patrimonial',
    accessLevel: 1,
    allowedDataClasses: ['A'],
    allowedActions: [
      'view_demographics',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL],
  },

  // --- Management roles ---

  bed_management: {
    id: 'bed_management',
    displayName: 'Gestao de Leitos',
    accessLevel: 3,
    allowedDataClasses: ['A', 'B'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'standard',
    allowedNavSections: [NAV_ASSISTENCIAL, NAV_GESTAO],
  },

  case_manager: {
    id: 'case_manager',
    displayName: 'Planejador(a) de Alta',
    accessLevel: 4,
    allowedDataClasses: ['A', 'B', 'C'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'approve_discharge',
      'sign_document',
      'print_record',
    ],
    breakGlassEligible: false,
    auditLevel: 'elevated',
    allowedNavSections: [NAV_ASSISTENCIAL, NAV_GESTAO],
  },

  compliance_auditor: {
    id: 'compliance_auditor',
    displayName: 'Auditor(a) de Conformidade',
    accessLevel: 6,
    allowedDataClasses: ['A', 'B', 'C', 'D'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'view_audit_log',
      'export_data',
      'print_record',
    ],
    breakGlassEligible: true,
    auditLevel: 'maximum',
    allowedNavSections: [NAV_ASSISTENCIAL, NAV_GESTAO, NAV_ADMINISTRACAO],
  },

  clinical_director: {
    id: 'clinical_director',
    displayName: 'Diretor(a) Clinico',
    professionalCouncil: 'CRM',
    accessLevel: 7,
    allowedDataClasses: ['A', 'B', 'C', 'D', 'E'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'view_sensitive_records',
      'create_medical_evolution',
      'prescribe_medication',
      'order_exam',
      'sign_document',
      'approve_discharge',
      'export_data',
      'print_record',
      'break_glass',
      'view_audit_log',
      'view_observability',
      'manage_suggestions',
    ],
    breakGlassEligible: true,
    auditLevel: 'maximum',
    allowedNavSections: [NAV_ASSISTENCIAL, NAV_GESTAO, NAV_ADMINISTRACAO, NAV_OBSERVABILIDADE],
  },

  hospital_owner_executive: {
    id: 'hospital_owner_executive',
    displayName: 'Executivo / Proprietario',
    accessLevel: 7,
    allowedDataClasses: ['A', 'B'],
    allowedActions: [
      'view_demographics',
      'view_audit_log',
      'export_data',
      'manage_billing',
      'view_observability',
      'manage_suggestions',
    ],
    breakGlassEligible: false,
    auditLevel: 'maximum',
    allowedNavSections: [NAV_GESTAO, NAV_ADMINISTRACAO, NAV_OBSERVABILIDADE],
  },

  // --- IT / System roles (JIT = Just-In-Time) ---

  it_support_jit: {
    id: 'it_support_jit',
    displayName: 'Suporte de TI (JIT)',
    accessLevel: 4,
    allowedDataClasses: ['A'],
    allowedActions: [
      'manage_system',
      'view_observability',
    ],
    breakGlassEligible: false,
    auditLevel: 'elevated',
    allowedNavSections: [NAV_ADMINISTRACAO, NAV_OBSERVABILIDADE],
  },

  security_admin_jit: {
    id: 'security_admin_jit',
    displayName: 'Administrador de Seguranca (JIT)',
    accessLevel: 6,
    allowedDataClasses: ['A'],
    allowedActions: [
      'view_audit_log',
      'manage_system',
      'view_observability',
      'export_data',
    ],
    breakGlassEligible: false,
    auditLevel: 'maximum',
    allowedNavSections: [NAV_ADMINISTRACAO, NAV_OBSERVABILIDADE],
  },

  admin_system: {
    id: 'admin_system',
    displayName: 'Administrador do Sistema',
    accessLevel: 7,
    allowedDataClasses: ['A', 'B', 'C', 'D', 'E'],
    allowedActions: [
      'view_demographics',
      'view_clinical_summary',
      'view_full_chart',
      'view_sensitive_records',
      'view_audit_log',
      'manage_system',
      'view_observability',
      'export_data',
      'print_record',
      'break_glass',
      'manage_suggestions',
    ],
    breakGlassEligible: true,
    auditLevel: 'maximum',
    allowedNavSections: [NAV_ASSISTENCIAL, NAV_GESTAO, NAV_ADMINISTRACAO, NAV_OBSERVABILIDADE],
  },
};

// === AUTHORIZATION ENGINE ===

export interface AuthContext {
  role: ProfessionalRole;
  unit?: string;
  shift?: string;
  patientRelationship?: 'attending' | 'on_call' | 'care_team' | 'assigned_task' | 'none';
  isBreakGlass?: boolean;
  workstationId?: string;
}

/**
 * Check if an action is allowed for a given auth context.
 * Deny by default. Break-glass overrides for eligible roles.
 */
export function isAllowed(context: AuthContext, action: AccessAction): boolean {
  const role = ROLE_DEFINITIONS[context.role];
  if (!role) return false;

  // Break glass overrides for eligible roles — logged at maximum audit level
  if (context.isBreakGlass && role.breakGlassEligible) {
    return true;
  }

  return role.allowedActions.includes(action);
}

/**
 * Check if a role can access a specific data classification level.
 */
export function canAccessDataClass(context: AuthContext, dataClass: DataClass): boolean {
  const role = ROLE_DEFINITIONS[context.role];
  if (!role) return false;

  // Break glass grants access to all data classes for eligible roles
  if (context.isBreakGlass && role.breakGlassEligible) {
    return true;
  }

  return role.allowedDataClasses.includes(dataClass);
}

/**
 * Get the navigation sections a role is authorized to see.
 */
export function getNavigationSections(role: ProfessionalRole): string[] {
  return ROLE_DEFINITIONS[role]?.allowedNavSections ?? [];
}

/**
 * Get the audit level required for a role's actions.
 */
export function getAuditLevel(role: ProfessionalRole): 'standard' | 'elevated' | 'maximum' {
  return ROLE_DEFINITIONS[role]?.auditLevel ?? 'maximum';
}

/**
 * Get the access level number for a role.
 */
export function getAccessLevel(role: ProfessionalRole): AccessLevel {
  return ROLE_DEFINITIONS[role]?.accessLevel ?? 0;
}

// === UI ROLE MAPPING ===
// Maps the simplified UI display names to professional roles.

export const UI_ROLE_MAP: Record<string, ProfessionalRole> = {
  'Coordenador de Ala': 'nurse',
  'Medico': 'medical_staff_attending',
  'Enfermeiro(a)': 'nurse',
  'Planejador de Alta': 'case_manager',
  'Administrador': 'admin_system',
  'Tecnico de Enfermagem': 'nursing_technician',
  'Farmaceutico': 'pharmacist_clinical',
  'Fisioterapeuta': 'physiotherapist',
  'Recepcao': 'receptionist_registration',
  'Motorista': 'ambulance_driver',
  'Higienizacao': 'cleaning_hygiene',
  'Faturamento': 'billing_authorization',
  'Diretor Clinico': 'clinical_director',
};

/**
 * Resolve a UI display role name to its ProfessionalRole.
 * Returns admin_system as a safe fallback (most restrictive audit).
 */
export function resolveUiRole(uiRole: string): ProfessionalRole {
  return UI_ROLE_MAP[uiRole] ?? 'admin_system';
}
