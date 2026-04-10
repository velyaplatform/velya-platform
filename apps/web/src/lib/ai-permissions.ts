/**
 * Role-based AI capability matrix.
 *
 * The platform's AI is gated by user role and email allowlist. Every AI call
 * goes through `/api/ai/*` which enforces this matrix server-side BEFORE
 * forwarding to `packages/ai-gateway/`. Frontend uses the same matrix to
 * hide buttons the user can't activate, but the gate is enforced by the API.
 *
 * The administrator allowlist (full access regardless of role) is read from
 * the AI_ADMIN_EMAILS environment variable in production. In dev/demo we
 * fall back to a hardcoded list so lucaslima4132@gmail.com always works.
 *
 * AI safety reference: docs/risk/mcp-and-tool-trust-model.md and
 * .claude/rules/ai-safety.md. No agent may take autonomous clinical action.
 */

export type AiCapability =
  // Read-only / advisory
  | 'ai.summarize-patient-record'
  | 'ai.suggest-differential-diagnosis'
  | 'ai.suggest-medication'
  | 'ai.suggest-icd10'
  | 'ai.suggest-tuss-code'
  | 'ai.generate-discharge-summary-draft'
  | 'ai.translate-medical-jargon'
  | 'ai.explain-lab-result'
  | 'ai.suggest-cleaning-checklist'
  | 'ai.suggest-supplier-evaluation'
  // Search / lookup
  | 'ai.search-knowledge-base'
  | 'ai.chat-clinical'
  | 'ai.chat-administrative'
  // Power-user / admin
  | 'ai.chat-unrestricted'
  | 'ai.execute-bulk-actions'
  | 'ai.modify-system-settings'
  | 'ai.access-audit-trail';

export interface AiRolePolicy {
  /** Display label for the policy (admin UI) */
  label: string;
  /** Full set of capabilities granted by this role */
  capabilities: AiCapability[];
  /** Maximum tokens per single request (input + output combined) */
  maxTokensPerRequest: number;
  /** Maximum requests per hour */
  maxRequestsPerHour: number;
  /** If true, every AI response in this role must include citations / evidence */
  requireCitations: boolean;
  /** If true, prompts and responses are logged with PHI redaction; if false, full audit */
  redactPhiInLogs: boolean;
}

/**
 * The full capability set — used when an email is on the admin allowlist.
 */
const ADMIN_CAPABILITIES: AiCapability[] = [
  'ai.summarize-patient-record',
  'ai.suggest-differential-diagnosis',
  'ai.suggest-medication',
  'ai.suggest-icd10',
  'ai.suggest-tuss-code',
  'ai.generate-discharge-summary-draft',
  'ai.translate-medical-jargon',
  'ai.explain-lab-result',
  'ai.suggest-cleaning-checklist',
  'ai.suggest-supplier-evaluation',
  'ai.search-knowledge-base',
  'ai.chat-clinical',
  'ai.chat-administrative',
  'ai.chat-unrestricted',
  'ai.execute-bulk-actions',
  'ai.modify-system-settings',
  'ai.access-audit-trail',
];

/**
 * Hardcoded admin allowlist. In production this is overlaid by AI_ADMIN_EMAILS.
 * lucaslima4132@gmail.com is the platform owner and always gets full access.
 */
const HARDCODED_ADMIN_EMAILS = new Set<string>(['lucaslima4132@gmail.com']);

export function isAiAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (HARDCODED_ADMIN_EMAILS.has(normalized)) return true;
  const envList = process.env.AI_ADMIN_EMAILS;
  if (!envList) return false;
  return envList
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

/**
 * Capability matrix per professional role. Maps to the role ids defined in
 * apps/web/src/lib/access-control.ts (ProfessionalRole). Each role gets the
 * minimum set of AI capabilities needed for their job — no blanket access.
 */
export const AI_ROLE_POLICIES: Record<string, AiRolePolicy> = {
  // ----- Clinical roles -----
  medical_staff_attending: {
    label: 'Médico(a) Assistente',
    capabilities: [
      'ai.summarize-patient-record',
      'ai.suggest-differential-diagnosis',
      'ai.suggest-medication',
      'ai.suggest-icd10',
      'ai.generate-discharge-summary-draft',
      'ai.translate-medical-jargon',
      'ai.explain-lab-result',
      'ai.search-knowledge-base',
      'ai.chat-clinical',
    ],
    maxTokensPerRequest: 8000,
    maxRequestsPerHour: 200,
    requireCitations: true,
    redactPhiInLogs: true,
  },
  medical_staff_on_call: {
    label: 'Médico(a) Plantonista',
    capabilities: [
      'ai.summarize-patient-record',
      'ai.suggest-differential-diagnosis',
      'ai.suggest-medication',
      'ai.translate-medical-jargon',
      'ai.explain-lab-result',
      'ai.search-knowledge-base',
      'ai.chat-clinical',
    ],
    maxTokensPerRequest: 6000,
    maxRequestsPerHour: 150,
    requireCitations: true,
    redactPhiInLogs: true,
  },

  nurse: {
    label: 'Enfermeiro(a)',
    capabilities: [
      'ai.summarize-patient-record',
      'ai.translate-medical-jargon',
      'ai.explain-lab-result',
      'ai.search-knowledge-base',
      'ai.chat-clinical',
    ],
    maxTokensPerRequest: 4000,
    maxRequestsPerHour: 120,
    requireCitations: true,
    redactPhiInLogs: true,
  },
  nursing_technician: {
    label: 'Técnico(a) de Enfermagem',
    capabilities: ['ai.translate-medical-jargon', 'ai.search-knowledge-base'],
    maxTokensPerRequest: 2000,
    maxRequestsPerHour: 60,
    requireCitations: true,
    redactPhiInLogs: true,
  },

  pharmacist_clinical: {
    label: 'Farmacêutico(a) Clínico',
    capabilities: [
      'ai.suggest-medication',
      'ai.translate-medical-jargon',
      'ai.search-knowledge-base',
      'ai.chat-clinical',
    ],
    maxTokensPerRequest: 4000,
    maxRequestsPerHour: 100,
    requireCitations: true,
    redactPhiInLogs: true,
  },

  // ----- Multi-professional -----
  physiotherapist: {
    label: 'Fisioterapeuta',
    capabilities: [
      'ai.summarize-patient-record',
      'ai.translate-medical-jargon',
      'ai.search-knowledge-base',
    ],
    maxTokensPerRequest: 3000,
    maxRequestsPerHour: 80,
    requireCitations: true,
    redactPhiInLogs: true,
  },
  nutritionist: {
    label: 'Nutricionista',
    capabilities: [
      'ai.summarize-patient-record',
      'ai.translate-medical-jargon',
      'ai.search-knowledge-base',
    ],
    maxTokensPerRequest: 3000,
    maxRequestsPerHour: 80,
    requireCitations: true,
    redactPhiInLogs: true,
  },
  social_worker: {
    label: 'Assistente Social',
    capabilities: ['ai.search-knowledge-base', 'ai.chat-administrative'],
    maxTokensPerRequest: 2000,
    maxRequestsPerHour: 60,
    requireCitations: false,
    redactPhiInLogs: true,
  },

  // ----- Administrative -----
  receptionist_registration: {
    label: 'Recepção / Cadastro',
    capabilities: ['ai.search-knowledge-base', 'ai.chat-administrative'],
    maxTokensPerRequest: 2000,
    maxRequestsPerHour: 60,
    requireCitations: false,
    redactPhiInLogs: true,
  },
  billing_authorization: {
    label: 'Faturamento e Autorização',
    capabilities: [
      'ai.suggest-tuss-code',
      'ai.suggest-icd10',
      'ai.search-knowledge-base',
      'ai.chat-administrative',
    ],
    maxTokensPerRequest: 4000,
    maxRequestsPerHour: 100,
    requireCitations: true,
    redactPhiInLogs: true,
  },

  // ----- Operations -----
  bed_management: {
    label: 'Gestão de Leitos',
    capabilities: ['ai.search-knowledge-base', 'ai.chat-administrative'],
    maxTokensPerRequest: 3000,
    maxRequestsPerHour: 80,
    requireCitations: false,
    redactPhiInLogs: true,
  },
  cleaning_hygiene: {
    label: 'Higienização',
    capabilities: ['ai.suggest-cleaning-checklist', 'ai.search-knowledge-base'],
    maxTokensPerRequest: 1500,
    maxRequestsPerHour: 40,
    requireCitations: true,
    redactPhiInLogs: true,
  },
  patient_transporter: {
    label: 'Transporte Interno',
    capabilities: ['ai.search-knowledge-base'],
    maxTokensPerRequest: 1000,
    maxRequestsPerHour: 30,
    requireCitations: false,
    redactPhiInLogs: true,
  },
  ambulance_driver: {
    label: 'Motorista de Ambulância',
    capabilities: ['ai.search-knowledge-base'],
    maxTokensPerRequest: 1000,
    maxRequestsPerHour: 30,
    requireCitations: false,
    redactPhiInLogs: true,
  },

  // ----- Governance / leadership -----
  case_manager: {
    label: 'Coordenador(a) de Caso',
    capabilities: [
      'ai.summarize-patient-record',
      'ai.generate-discharge-summary-draft',
      'ai.search-knowledge-base',
      'ai.chat-clinical',
      'ai.chat-administrative',
    ],
    maxTokensPerRequest: 6000,
    maxRequestsPerHour: 150,
    requireCitations: true,
    redactPhiInLogs: true,
  },
  compliance_auditor: {
    label: 'Auditoria e Compliance',
    capabilities: [
      'ai.access-audit-trail',
      'ai.summarize-patient-record',
      'ai.search-knowledge-base',
      'ai.chat-administrative',
    ],
    maxTokensPerRequest: 8000,
    maxRequestsPerHour: 100,
    requireCitations: true,
    redactPhiInLogs: false,
  },
  clinical_director: {
    label: 'Diretor(a) Clínico',
    capabilities: [
      'ai.summarize-patient-record',
      'ai.suggest-differential-diagnosis',
      'ai.suggest-medication',
      'ai.search-knowledge-base',
      'ai.chat-clinical',
      'ai.chat-administrative',
      'ai.access-audit-trail',
    ],
    maxTokensPerRequest: 8000,
    maxRequestsPerHour: 200,
    requireCitations: true,
    redactPhiInLogs: false,
  },
  hospital_owner_executive: {
    label: 'Executivo / Proprietário',
    capabilities: ADMIN_CAPABILITIES,
    maxTokensPerRequest: 16000,
    maxRequestsPerHour: 500,
    requireCitations: false,
    redactPhiInLogs: false,
  },
  admin_system: {
    label: 'Administrador do Sistema',
    capabilities: ADMIN_CAPABILITIES,
    maxTokensPerRequest: 16000,
    maxRequestsPerHour: 1000,
    requireCitations: false,
    redactPhiInLogs: false,
  },
};

const FALLBACK_POLICY: AiRolePolicy = {
  label: 'Acesso restrito',
  capabilities: [],
  maxTokensPerRequest: 0,
  maxRequestsPerHour: 0,
  requireCitations: true,
  redactPhiInLogs: true,
};

/**
 * Resolve the effective AI policy for a user, considering:
 * 1. Email allowlist (admin override → full access)
 * 2. Professional role mapping in AI_ROLE_POLICIES
 * 3. Fallback to zero-capability policy if neither matches
 */
export function resolveAiPolicy(opts: {
  email: string | null | undefined;
  professionalRole: string | null | undefined;
}): AiRolePolicy {
  if (isAiAdminEmail(opts.email)) {
    return {
      label: 'Administrador (allowlist)',
      capabilities: ADMIN_CAPABILITIES,
      maxTokensPerRequest: 16000,
      maxRequestsPerHour: 1000,
      requireCitations: false,
      redactPhiInLogs: false,
    };
  }
  if (opts.professionalRole && AI_ROLE_POLICIES[opts.professionalRole]) {
    return AI_ROLE_POLICIES[opts.professionalRole];
  }
  return FALLBACK_POLICY;
}

export function hasAiCapability(
  policy: AiRolePolicy,
  capability: AiCapability,
): boolean {
  return policy.capabilities.includes(capability);
}
