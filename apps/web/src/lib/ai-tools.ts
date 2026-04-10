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
import { patchEntityRecord } from './entity-store';
import { resolveRecord } from './entity-resolver';

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
// TOOL: propose-handoff — pre-fills patients from the target user's ward
// ===========================================================================
//
// Real pre-fill flow (as the founder asked: "preencha o handoff do Dr. X"):
//   1. Lookup `toUserName` in STAFF — fuzzy match on name
//   2. If found, derive ward + role from the StaffMember
//   3. Pull patients in that ward via PATIENTS
//   4. Build PatientHandoffEntry[] with sensible I-PASS defaults pulled from
//      the patient cockpit (illness severity inferred from `risk`, summary
//      from `diagnosis`, action items left empty for the human to confirm)
//   5. Return as `requires-approval` with the pre-filled preview
//
// The tool NEVER creates the handoff without confirm=true. Even with confirm,
// it goes through the same audit/scorecard chain because it is `requiresApproval`.

interface ProposeHandoffArgs {
  /** Free-text name of the target user — orchestrator can pass "Dr. X" directly */
  toUserName: string;
  /** Optional ward override — if absent, derived from the matched staff member */
  ward?: string;
  /** Outgoing user (current operator) — orchestrator fills from session */
  fromUserId?: string;
  fromUserName?: string;
  fromRole?: string;
  /** Optional explicit role/ward overrides */
  toUserId?: string;
  toRole?: string;
  shiftLabel?: string;
  /** ISO timestamp for the boundary; defaults to "now + 6h" */
  shiftBoundaryAt?: string;
  unitNotes?: string;
  /** When true, actually create the handoff. */
  confirm?: boolean;
}

function inferIllnessSeverity(risk: string | undefined): 'stable' | 'watcher' | 'unstable' {
  if (risk === 'critical' || risk === 'high') return 'unstable';
  if (risk === 'medium') return 'watcher';
  return 'stable';
}

const proposeHandoffTool: AiToolDef<
  ProposeHandoffArgs,
  ShiftHandoff | { preview: Record<string, unknown> }
> = {
  id: 'propose-handoff',
  description:
    'Pré-preenche uma passagem de turno I-PASS para o usuário alvo. Busca o staff member pelo nome (fuzzy), pega a ala dele e os pacientes da ala, e devolve preview com pacientes carregados. Sempre exige confirmação humana.',
  trustTier: 1,
  requiresApproval: true,
  requiredRole: 'clinical',
  execute(args) {
    // 1. Resolve the target staff member
    const needle = (args.toUserName || '').toLowerCase().trim();
    if (!needle) {
      return {
        status: 'error',
        summary: 'É preciso informar o nome do destinatário (toUserName).',
      };
    }
    const staffHit = STAFF.find((s) => s.name.toLowerCase().includes(needle));
    if (!staffHit) {
      return {
        status: 'empty',
        summary: `Não encontrei nenhum profissional cujo nome contenha "${args.toUserName}". Cheque a grafia.`,
      };
    }

    // 2. Derive ward + role from the matched staff member
    const ward = args.ward ?? staffHit.ward;
    const toRole = args.toRole ?? ROLE_LABELS[staffHit.role] ?? staffHit.role;

    // 3. Pull patients in that ward
    const wardPatients = (PATIENTS as unknown as Record<string, unknown>[]).filter(
      (p) => String(p.ward ?? '').toLowerCase() === ward.toLowerCase(),
    );

    // 4. Build I-PASS PatientHandoffEntry[] from cockpit data
    const patientEntries: CreateHandoffInput['patients'] = wardPatients.map((p) => ({
      patientMrn: String(p.mrn),
      patientName: String(p.name ?? 'Paciente'),
      ward,
      bed: typeof p.bed === 'string' ? p.bed : undefined,
      illnessSeverity: inferIllnessSeverity(typeof p.risk === 'string' ? p.risk : undefined),
      patientSummary: String(p.diagnosis ?? 'Resumo a ser confirmado'),
      actionItems: [],
      situationAwareness: '',
      activeIssues: Array.isArray(p.blockers) ? (p.blockers as string[]) : [],
    }));

    // 5. Build the resolved input
    const shiftBoundaryAt =
      args.shiftBoundaryAt ?? new Date(Date.now() + 6 * 3600 * 1000).toISOString();
    const resolved: CreateHandoffInput = {
      fromUserId: args.fromUserId ?? 'orchestrator',
      fromUserName: args.fromUserName ?? 'Sistema (orchestrator)',
      fromRole: args.fromRole ?? 'system',
      toUserId: args.toUserId ?? staffHit.id,
      toUserName: staffHit.name,
      toRole,
      ward,
      shiftLabel: args.shiftLabel ?? `Plantão para ${staffHit.name}`,
      shiftBoundaryAt,
      patients: patientEntries,
      unitNotes: args.unitNotes,
    };

    if (!args.confirm) {
      return {
        status: 'requires-approval',
        summary: `Handoff pré-preenchido para ${staffHit.name} (${toRole}) na ${ward} com ${patientEntries.length} paciente(s). Revise antes de criar.`,
        data: { preview: resolved as unknown as Record<string, unknown> },
        pendingAction: {
          label: `Criar handoff (${patientEntries.length} pacientes)`,
          toolId: 'propose-handoff',
          args: { ...args, confirm: true } as unknown as Record<string, unknown>,
        },
        sources: patientEntries.slice(0, 5).map((p) => ({
          label: `${p.patientMrn} — ${p.patientName}`,
          href: `/edit/patients/${encodeURIComponent(p.patientMrn)}`,
        })),
      };
    }

    const draft = createHandoff(resolved);
    return {
      status: 'ok',
      summary: `Handoff ${draft.id} criado para ${staffHit.name} com ${patientEntries.length} paciente(s). Abra /handoffs/${draft.id} para revisar e enviar.`,
      data: draft,
      sources: [{ label: `Abrir handoff ${draft.id}`, href: `/handoffs/${draft.id}` }],
    };
  },
};

// ===========================================================================
// TOOL: update-record — patch a single record (review-class, gated)
// ===========================================================================
//
// Honors the founder's request: "tal paciente precisa atualizar a medicação
// ou exames dele". The flow is intentionally cautious:
//
//   1. Resolve the current record via entity-resolver (must exist)
//   2. Compute a diff between current data and the proposed patch
//   3. Refuse modules with dataClass='A' (PHI máximo) — those are critical
//      and never go through this tool, even with confirm=true
//   4. Refuse field deletions on patient identity fields
//   5. When confirm=false → return preview with diff for human review
//   6. When confirm=true → call patchEntityRecord (which audits + writes
//      to the entity-store with full history)
//
// This is a `requiresApproval: true` tool. The orchestrator surfaces the
// preview as a confirmation card; only the human "Confirmar" click sends
// confirm=true. Even then, the API route gate refuses non-clinical roles.

interface UpdateRecordArgs {
  moduleId: string;
  recordId: string;
  patch: Record<string, unknown>;
  /** Free-text justification for audit log */
  rationale?: string;
  confirm?: boolean;
}

const REFUSED_FIELDS = new Set(['mrn', 'patientMrn', 'id', 'cpf', 'rg']);

const updateRecordTool: AiToolDef<
  UpdateRecordArgs,
  {
    moduleId: string;
    recordId: string;
    diff: Array<{ field: string; from: unknown; to: unknown }>;
  }
> = {
  id: 'update-record',
  description:
    'Atualiza um registro existente (prescrição, exame, tarefa, etc.) com um patch parcial. NUNCA executa direto — sempre devolve preview para confirmação humana. Recusa módulos clínicos classe A e campos de identidade.',
  trustTier: 2,
  requiresApproval: true,
  requiredRole: 'clinical',
  execute(args) {
    if (!args.moduleId || !args.recordId) {
      return { status: 'error', summary: 'moduleId e recordId são obrigatórios' };
    }
    const module = getModuleById(args.moduleId);
    if (!module) {
      return { status: 'error', summary: `Módulo ${args.moduleId} não existe` };
    }

    // Refuse PHI máximo unless human passes a critical override flag (which
    // we deliberately do NOT expose — those records go through the regular
    // /edit/[moduleId]/[recordId] form with full RBAC.
    if (module.dataClass === 'A') {
      return {
        status: 'error',
        summary: `Módulo ${module.id} é dataClass A (PHI máximo). Use o formulário /edit/${module.id}/${args.recordId} com sua sessão clínica.`,
      };
    }

    const current = resolveRecord(args.moduleId, args.recordId);
    if (!current) {
      return {
        status: 'empty',
        summary: `Registro ${args.recordId} não encontrado em ${args.moduleId}`,
      };
    }

    // Strip refused fields from the patch and compute the effective diff
    const cleanPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args.patch ?? {})) {
      if (REFUSED_FIELDS.has(k)) continue;
      cleanPatch[k] = v;
    }
    const diff: Array<{ field: string; from: unknown; to: unknown }> = [];
    for (const [field, to] of Object.entries(cleanPatch)) {
      const from = current.data[field];
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        diff.push({ field, from, to });
      }
    }

    if (diff.length === 0) {
      return {
        status: 'empty',
        summary: `Patch não muda nada em ${args.moduleId}/${args.recordId} (após filtro de campos protegidos).`,
      };
    }

    if (!args.confirm) {
      return {
        status: 'requires-approval',
        summary: `Pronto para atualizar ${diff.length} campo(s) em ${args.moduleId}/${args.recordId}. Revise o diff abaixo.`,
        data: { moduleId: args.moduleId, recordId: args.recordId, diff },
        pendingAction: {
          label: `Confirmar update (${diff.length} campo(s))`,
          toolId: 'update-record',
          args: { ...args, patch: cleanPatch, confirm: true } as unknown as Record<string, unknown>,
        },
        sources: [
          {
            label: `Abrir ${args.moduleId}/${args.recordId}`,
            href: `/edit/${args.moduleId}/${encodeURIComponent(args.recordId)}`,
          },
        ],
      };
    }

    // Confirm path — write through patchEntityRecord (audited)
    const result = patchEntityRecord({
      moduleId: args.moduleId,
      recordId: args.recordId,
      baseRecord: current.data,
      patch: cleanPatch,
      actorId: 'ai-agent',
      actorName: 'AI Agent (orchestrator)',
      note: args.rationale ?? 'Atualização via /api/ai/agent (confirmada por humano)',
    });

    return {
      status: 'ok',
      summary: `Registro ${args.recordId} atualizado: ${result.fieldChanges.length} campo(s) alterados.`,
      data: { moduleId: args.moduleId, recordId: args.recordId, diff: result.fieldChanges },
      sources: [
        {
          label: `Ver ${args.moduleId}/${args.recordId}`,
          href: `/edit/${args.moduleId}/${encodeURIComponent(args.recordId)}`,
        },
      ],
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
  'update-record': updateRecordTool as unknown as AiToolDef,
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
