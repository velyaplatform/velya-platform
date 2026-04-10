/**
 * AI Tools Registry — typed callable surface for the agent orchestrator.
 *
 * Each tool wraps an EXISTING data source (entity-resolver, handoff-store,
 * semantic-search, etc.) and exposes:
 *   - A stable id (e.g. "search-patients")
 *   - A short PT-BR description used by the intent classifier
 *   - A Zod-style argument shape (we use plain TypeScript discriminated unions
 *     to avoid pulling Zod in just for this)
 *   - An execute() function returning a typed AiToolResult
 *
 * Tools are pure read/aggregation functions by default. The few mutating
 * tools (propose-handoff, update-record, run-cron-job) are flagged
 * `requiresApproval: true` so the orchestrator can present them as
 * confirmation cards instead of running them silently. This keeps the
 * agent inside the SHADOW-MODE envelope mandated by .claude/rules/agents.md
 * and ai-safety.md.
 *
 * Tool trust tiers (per docs/risk/mcp-and-tool-trust-model.md):
 *   - search-*, get-*, list-*  → tier 0 (read-only, safe)
 *   - semantic-search-modules → tier 0
 *   - propose-handoff         → tier 1 (writes draft, needs human send)
 *   - update-record           → tier 2 (writes data, needs approval)
 *   - run-cron-job            → tier 1 (admin-only, needs admin role)
 *
 * Naming follows .claude/rules/naming.md: kebab-case ids, camelCase exports,
 * descriptive verbs (no `manager`, `helper`, `data`).
 */

import { listLiveRecords } from './entity-resolver';
import { MODULES, getModuleById } from './module-manifest';
import { search as semanticSearch } from './semantic-search';
import { PATIENTS } from './fixtures/patients';
import { STAFF, getStaffOnDuty, ROLE_LABELS, type StaffMember } from './fixtures/staff';
import {
  listHandoffs,
  createHandoff,
  type ShiftHandoff,
  type CreateHandoffInput,
} from './handoff-store';
import { CRON_JOBS } from './cron-jobs';

// ---------------------------------------------------------------------------
// Result envelope
// ---------------------------------------------------------------------------

export type AiToolStatus = 'ok' | 'empty' | 'error' | 'requires-approval';

export interface AiToolResult<T = unknown> {
  status: AiToolStatus;
  /** Short PT-BR sentence summarizing the result for the user */
  summary: string;
  /** Structured payload — the orchestrator can format this into a card */
  data?: T;
  /** Source links (deep links the user can click) */
  sources?: { label: string; href: string }[];
  /** Set when status === 'requires-approval' — describes the action awaiting confirmation */
  pendingAction?: {
    /** Human-readable button label */
    label: string;
    /** Tool id to call when the user confirms */
    toolId: string;
    /** Args to pass on confirmation */
    args: Record<string, unknown>;
  };
  /** Filled when status === 'error' */
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Tool definition shape
// ---------------------------------------------------------------------------

export interface AiToolDef<TArgs = Record<string, unknown>, TData = unknown> {
  id: string;
  description: string;
  trustTier: 0 | 1 | 2 | 3 | 4;
  /** True when the tool mutates data and must surface a confirmation step */
  requiresApproval: boolean;
  /** Required role to execute. 'any' = any authenticated user. 'admin' = admin allowlist. */
  requiredRole: 'any' | 'admin' | 'clinical' | 'staff';
  execute(args: TArgs): Promise<AiToolResult<TData>> | AiToolResult<TData>;
}

// ---------------------------------------------------------------------------
// Helper: filter patients by free-form criteria
// ---------------------------------------------------------------------------

interface PatientCriteria {
  ward?: string;
  /** Substring match on diagnosis / problem list */
  diagnosis?: string;
  /** Substring match on active medication name */
  medication?: string;
  /** Discharge candidate flag — heuristic */
  candidatesForDischarge?: boolean;
  /** Restrict to a specific MRN */
  mrn?: string;
  /** Maximum number of records to return */
  limit?: number;
}

function patientMatches(p: Record<string, unknown>, c: PatientCriteria): boolean {
  if (c.mrn && String(p.mrn) !== c.mrn) return false;
  if (c.ward) {
    const w = String(p.ward ?? p.location ?? '').toLowerCase();
    if (!w.includes(c.ward.toLowerCase())) return false;
  }
  if (c.diagnosis) {
    const dx = JSON.stringify(
      p.diagnoses ?? p.problemList ?? p.primaryDiagnosis ?? '',
    ).toLowerCase();
    const needle = c.diagnosis.toLowerCase();
    if (!dx.includes(needle)) return false;
  }
  if (c.medication) {
    const meds = JSON.stringify(p.activeMedications ?? p.medications ?? '').toLowerCase();
    const needle = c.medication.toLowerCase();
    if (!meds.includes(needle)) return false;
  }
  if (c.candidatesForDischarge) {
    const status = String(p.dischargeStatus ?? p.status ?? '').toLowerCase();
    const ready =
      status.includes('alta') || status.includes('discharge') || p.expectedDischargeToday === true;
    if (!ready) return false;
  }
  return true;
}

// ===========================================================================
// TOOL: search-patients
// ===========================================================================
const searchPatientsTool: AiToolDef<
  PatientCriteria,
  Array<{ mrn: string; name: string; ward?: string }>
> = {
  id: 'search-patients',
  description:
    'Filtra pacientes por ala, diagnóstico, medicação ativa ou candidatos à alta. Combine campos para refinar (ex: ward="UTI" + medication="vancomicina" + candidatesForDischarge=true).',
  trustTier: 0,
  requiresApproval: false,
  requiredRole: 'staff',
  execute(args) {
    const limit = args.limit ?? 20;
    const matches: Array<{ mrn: string; name: string; ward?: string; reason: string }> = [];
    for (const p of PATIENTS as unknown as Record<string, unknown>[]) {
      if (!patientMatches(p, args)) continue;
      matches.push({
        mrn: String(p.mrn),
        name: String(p.name ?? p.fullName ?? 'Sem nome'),
        ward: p.ward ? String(p.ward) : undefined,
        reason: [
          args.ward && `ala=${args.ward}`,
          args.diagnosis && `dx=${args.diagnosis}`,
          args.medication && `med=${args.medication}`,
          args.candidatesForDischarge && 'candidato à alta',
        ]
          .filter(Boolean)
          .join(' · '),
      });
      if (matches.length >= limit) break;
    }
    if (matches.length === 0) {
      return {
        status: 'empty',
        summary: 'Nenhum paciente encontrado com esses critérios.',
        data: [],
      };
    }
    return {
      status: 'ok',
      summary: `${matches.length} paciente(s) encontrados.`,
      data: matches,
      sources: matches.slice(0, 5).map((m) => ({
        label: `${m.mrn} — ${m.name}`,
        href: `/edit/patients/${encodeURIComponent(m.mrn)}`,
      })),
    };
  },
};

// ===========================================================================
// TOOL: get-patient-cockpit
// ===========================================================================
interface CockpitArgs {
  mrn: string;
}

const getPatientCockpitTool: AiToolDef<CockpitArgs, Record<string, unknown>> = {
  id: 'get-patient-cockpit',
  description:
    'Carrega o cockpit completo de um paciente (dados básicos + medicações + exames + tarefas) por MRN.',
  trustTier: 0,
  requiresApproval: false,
  requiredRole: 'clinical',
  execute(args) {
    const patient = (PATIENTS as unknown as Record<string, unknown>[]).find(
      (p) => String(p.mrn) === args.mrn,
    );
    if (!patient) {
      return {
        status: 'empty',
        summary: `Paciente ${args.mrn} não encontrado.`,
      };
    }
    // Aggregate related records across modules
    const related: Record<string, unknown[]> = {};
    const relatedModules = ['prescriptions', 'lab-orders', 'imaging-orders', 'tasks', 'alerts'];
    for (const moduleId of relatedModules) {
      const records = listLiveRecords(moduleId).filter(
        (r) => String((r.data as Record<string, unknown>).patientMrn) === args.mrn,
      );
      if (records.length > 0) related[moduleId] = records.map((r) => r.data);
    }
    return {
      status: 'ok',
      summary: `Cockpit de ${String(patient.name ?? args.mrn)} carregado (${
        Object.keys(related).length
      } módulos relacionados).`,
      data: { patient, related },
      sources: [
        { label: `Cockpit completo`, href: `/patients/${encodeURIComponent(args.mrn)}` },
        ...Object.keys(related).map((m) => ({
          label: `${m} (${related[m].length})`,
          href: `/${m}?patientMrn=${encodeURIComponent(args.mrn)}`,
        })),
      ],
    };
  },
};

// ===========================================================================
// TOOL: search-staff
// ===========================================================================
interface StaffArgs {
  ward?: string;
  role?: string;
  onDutyOnly?: boolean;
  name?: string;
}

const searchStaffTool: AiToolDef<StaffArgs, StaffMember[]> = {
  id: 'search-staff',
  description:
    'Busca profissionais por ala, papel, presença atual ou nome. Útil para "quem está de plantão na UTI agora?".',
  trustTier: 0,
  requiresApproval: false,
  requiredRole: 'staff',
  execute(args) {
    let pool: StaffMember[] = STAFF;
    if (args.onDutyOnly) pool = getStaffOnDuty();
    if (args.ward)
      pool = pool.filter((s) => s.ward.toLowerCase().includes(args.ward!.toLowerCase()));
    if (args.role) {
      const roleNeedle = args.role.toLowerCase();
      pool = pool.filter((s) => {
        const label = (ROLE_LABELS[s.role] ?? s.role).toLowerCase();
        return s.role.includes(roleNeedle) || label.includes(roleNeedle);
      });
    }
    if (args.name) {
      const n = args.name.toLowerCase();
      pool = pool.filter((s) => s.name.toLowerCase().includes(n));
    }
    if (pool.length === 0) {
      return { status: 'empty', summary: 'Nenhum profissional encontrado.' };
    }
    return {
      status: 'ok',
      summary: `${pool.length} profissional(is) encontrados.`,
      data: pool.slice(0, 30),
      sources: pool.slice(0, 5).map((s) => ({
        label: `${s.name} — ${ROLE_LABELS[s.role] ?? s.role}`,
        href: `/employees/${encodeURIComponent(s.id)}`,
      })),
    };
  },
};

// ===========================================================================
// TOOL: search-medications (lookup over prescriptions module)
// ===========================================================================
interface MedSearchArgs {
  drug?: string;
  ward?: string;
  patientMrn?: string;
  status?: string;
}

const searchMedicationsTool: AiToolDef<MedSearchArgs, Record<string, unknown>[]> = {
  id: 'search-medications',
  description:
    'Lista prescrições filtradas por droga, paciente, ala ou status (ativa/suspensa). Ex: drug="vancomicina" ward="UTI".',
  trustTier: 0,
  requiresApproval: false,
  requiredRole: 'clinical',
  execute(args) {
    const records = listLiveRecords('prescriptions');
    const matches: Record<string, unknown>[] = [];
    for (const r of records) {
      const d = r.data as Record<string, unknown>;
      if (args.drug) {
        const drugStr = String(d.drug ?? d.medication ?? d.name ?? '').toLowerCase();
        if (!drugStr.includes(args.drug.toLowerCase())) continue;
      }
      if (args.patientMrn && String(d.patientMrn) !== args.patientMrn) continue;
      if (args.ward) {
        const w = String(d.ward ?? '').toLowerCase();
        if (!w.includes(args.ward.toLowerCase())) continue;
      }
      if (args.status) {
        const s = String(d.status ?? '').toLowerCase();
        if (!s.includes(args.status.toLowerCase())) continue;
      }
      matches.push(d);
      if (matches.length >= 30) break;
    }
    if (matches.length === 0) {
      return { status: 'empty', summary: 'Nenhuma prescrição encontrada.' };
    }
    return {
      status: 'ok',
      summary: `${matches.length} prescrição(ões) encontradas.`,
      data: matches,
      sources: matches.slice(0, 5).map((m) => ({
        label: `${String(m.id ?? '?')} — ${String(m.drug ?? m.medication ?? '?')}`,
        href: `/edit/prescriptions/${encodeURIComponent(String(m.id ?? ''))}`,
      })),
    };
  },
};

// ===========================================================================
// TOOL: semantic-search-modules — full BM25 + fuzzy across all live records
// ===========================================================================
interface SemanticArgs {
  query: string;
  moduleIds?: string[];
  limit?: number;
}

const semanticSearchModulesTool: AiToolDef<SemanticArgs, ReturnType<typeof semanticSearch>> = {
  id: 'semantic-search-modules',
  description:
    'Busca BM25 + tolerância a typo sobre TODOS os registros vivos. Use quando o usuário perguntar algo aberto que não cabe nos filtros estruturados.',
  trustTier: 0,
  requiresApproval: false,
  requiredRole: 'any',
  execute(args) {
    const hits = semanticSearch(args.query, {
      moduleIds: args.moduleIds,
      totalLimit: args.limit ?? 15,
    });
    if (hits.length === 0) {
      return { status: 'empty', summary: `Nenhum resultado para "${args.query}".` };
    }
    return {
      status: 'ok',
      summary: `${hits.length} resultado(s) para "${args.query}".`,
      data: hits,
      sources: hits.slice(0, 5).map((h) => ({ label: `${h.recordId} — ${h.label}`, href: h.href })),
    };
  },
};

// ===========================================================================
// TOOL: list-cron-findings — surfaces unresolved cron findings
// ===========================================================================
interface FindingsArgs {
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
  surface?: string;
  limit?: number;
}

const listCronFindingsTool: AiToolDef<FindingsArgs, unknown> = {
  id: 'list-cron-findings',
  description:
    'Lista findings recentes do agente de cron (saúde do sistema). Útil para "o que está quebrado agora?".',
  trustTier: 0,
  requiresApproval: false,
  requiredRole: 'any',
  async execute(args) {
    // Lazy import to avoid pulling cron-store into client bundles
    const { listFindings } = await import('./cron-store');
    const findings = listFindings({
      status: 'new',
      severity: args.severity,
      surface: args.surface as never,
      limit: args.limit ?? 20,
    });
    if (findings.length === 0) {
      return { status: 'ok', summary: 'Nenhum finding aberto. Sistema saudável.', data: [] };
    }
    return {
      status: 'ok',
      summary: `${findings.length} finding(s) abertos.`,
      data: findings,
      sources: [{ label: 'Abrir /cron', href: '/cron' }],
    };
  },
};

// ===========================================================================
// TOOL: list-handoffs
// ===========================================================================
interface HandoffArgs {
  status?: 'draft' | 'sent' | 'awaiting-readback' | 'completed' | 'cancelled';
  ward?: string;
  toUserName?: string;
  limit?: number;
}

const listHandoffsTool: AiToolDef<HandoffArgs, ShiftHandoff[]> = {
  id: 'list-handoffs',
  description:
    'Lista passagens de turno (handoffs I-PASS) com filtros por status, ala ou destinatário.',
  trustTier: 0,
  requiresApproval: false,
  requiredRole: 'staff',
  execute(args) {
    const all = listHandoffs({});
    let filtered = all;
    if (args.status) filtered = filtered.filter((h) => h.status === args.status);
    if (args.ward)
      filtered = filtered.filter((h) => h.ward?.toLowerCase().includes(args.ward!.toLowerCase()));
    if (args.toUserName)
      filtered = filtered.filter((h) =>
        h.toUserName?.toLowerCase().includes(args.toUserName!.toLowerCase()),
      );
    const limit = args.limit ?? 15;
    const slice = filtered.slice(0, limit);
    if (slice.length === 0) {
      return { status: 'empty', summary: 'Nenhum handoff encontrado.' };
    }
    return {
      status: 'ok',
      summary: `${slice.length} handoff(s) encontrados.`,
      data: slice,
      sources: slice.slice(0, 5).map((h) => ({
        label: `${h.id} — ${h.ward ?? '?'}`,
        href: `/handoffs/${encodeURIComponent(h.id)}`,
      })),
    };
  },
};

// ===========================================================================
// TOOL: propose-handoff — creates DRAFT (requires user to send manually)
// ===========================================================================
interface ProposeHandoffArgs {
  fromUserId: string;
  fromUserName: string;
  fromRole: string;
  toUserId: string;
  toUserName: string;
  toRole: string;
  ward: string;
  shiftLabel: string;
  /** ISO timestamp for the boundary between outgoing and incoming shift */
  shiftBoundaryAt: string;
  patients?: CreateHandoffInput['patients'];
  unitNotes?: string;
  /** When true, actually create the handoff. When false, just return the proposal preview. */
  confirm?: boolean;
}

const proposeHandoffTool: AiToolDef<
  ProposeHandoffArgs,
  ShiftHandoff | { preview: ProposeHandoffArgs }
> = {
  id: 'propose-handoff',
  description:
    'Cria uma passagem de turno I-PASS pré-preenchida. Sempre exige confirmação humana — passe confirm=true para gravar.',
  trustTier: 1,
  requiresApproval: true,
  requiredRole: 'clinical',
  execute(args) {
    if (!args.confirm) {
      return {
        status: 'requires-approval',
        summary: `Pronto para criar handoff de ${args.fromUserName} → ${args.toUserName} na ala ${args.ward}.`,
        data: { preview: args },
        pendingAction: {
          label: 'Criar handoff',
          toolId: 'propose-handoff',
          args: { ...args, confirm: true } as unknown as Record<string, unknown>,
        },
      };
    }
    const draft = createHandoff({
      fromUserId: args.fromUserId,
      fromUserName: args.fromUserName,
      fromRole: args.fromRole,
      toUserId: args.toUserId,
      toUserName: args.toUserName,
      toRole: args.toRole,
      ward: args.ward,
      shiftLabel: args.shiftLabel,
      shiftBoundaryAt: args.shiftBoundaryAt,
      patients: args.patients ?? [],
      unitNotes: args.unitNotes,
    });
    return {
      status: 'ok',
      summary: `Handoff ${draft.id} criado. Abra /handoffs/${draft.id} para revisar.`,
      data: draft,
      sources: [{ label: `Abrir handoff ${draft.id}`, href: `/handoffs/${draft.id}` }],
    };
  },
};

// ===========================================================================
// TOOL: list-modules — describes the full module catalogue (for AI introspection)
// ===========================================================================
const listModulesTool: AiToolDef<
  Record<string, never>,
  Array<{ id: string; title: string; route: string }>
> = {
  id: 'list-modules',
  description:
    'Lista todos os módulos disponíveis na plataforma (id, título, rota). Use quando o usuário pergunta "o que existe" ou "para onde ir".',
  trustTier: 0,
  requiresApproval: false,
  requiredRole: 'any',
  execute() {
    return {
      status: 'ok',
      summary: `${MODULES.length} módulos disponíveis.`,
      data: MODULES.map((m) => ({ id: m.id, title: m.title, route: m.route })),
      sources: MODULES.slice(0, 6).map((m) => ({ label: m.title, href: m.route })),
    };
  },
};

// ===========================================================================
// TOOL: list-cron-jobs — describes the agent loop catalogue
// ===========================================================================
const listCronJobsTool: AiToolDef<Record<string, never>, typeof CRON_JOBS> = {
  id: 'list-cron-jobs',
  description: 'Lista os cron jobs do agente autônomo (id, label, surface, cron, severidade).',
  trustTier: 0,
  requiresApproval: false,
  requiredRole: 'any',
  execute() {
    return {
      status: 'ok',
      summary: `${CRON_JOBS.length} jobs registrados.`,
      data: CRON_JOBS,
      sources: [{ label: 'Painel /cron', href: '/cron' }],
    };
  },
};

// ===========================================================================
// Registry
// ===========================================================================

export const AI_TOOLS: Record<string, AiToolDef> = {
  'search-patients': searchPatientsTool as unknown as AiToolDef,
  'get-patient-cockpit': getPatientCockpitTool as unknown as AiToolDef,
  'search-staff': searchStaffTool as unknown as AiToolDef,
  'search-medications': searchMedicationsTool as unknown as AiToolDef,
  'semantic-search-modules': semanticSearchModulesTool as unknown as AiToolDef,
  'list-cron-findings': listCronFindingsTool as unknown as AiToolDef,
  'list-handoffs': listHandoffsTool as unknown as AiToolDef,
  'propose-handoff': proposeHandoffTool as unknown as AiToolDef,
  'list-modules': listModulesTool as unknown as AiToolDef,
  'list-cron-jobs': listCronJobsTool as unknown as AiToolDef,
};

export function getTool(id: string): AiToolDef | undefined {
  return AI_TOOLS[id];
}

export function describeTools(): Array<{ id: string; description: string; trustTier: number }> {
  return Object.values(AI_TOOLS).map((t) => ({
    id: t.id,
    description: t.description,
    trustTier: t.trustTier,
  }));
}

// Re-export the module getter for convenience to orchestrator code
export { getModuleById };
