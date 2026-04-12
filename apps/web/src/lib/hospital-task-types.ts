/**
 * Hospital Task Management — Type Definitions
 *
 * All types for the hospital task system. Follows the spec in
 * docs/product/task-management-module-spec.md sections 5, 13, 15.
 */

// ── Status ──────────────────────────────────────────────────────────

export type TaskStatus =
  | 'draft'
  | 'open'
  | 'received'
  | 'accepted'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'verified'
  | 'declined'
  | 'reassigned'
  | 'cancelled'
  | 'expired'
  | 'escalated';

// ── Priority ────────────────────────────────────────────────────────

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ── Category ────────────────────────────────────────────────────────

export type TaskCategory = 'assistencial' | 'apoio' | 'administrativo';

export type TaskSubcategory =
  | 'medicacao'
  | 'exames'
  | 'procedimentos'
  | 'avaliacao'
  | 'parecer'
  | 'alta'
  | 'limpeza'
  | 'transporte'
  | 'manutencao'
  | 'nutricao'
  | 'documentacao'
  | 'faturamento'
  | 'coordenacao';

// ── Evidence ────────────────────────────────────────────────────────

export type EvidenceType =
  | 'text'
  | 'checklist'
  | 'photo'
  | 'signature'
  | 'timestamp'
  | 'measurement'
  | 'document';

export interface Evidence {
  id: string;
  type: EvidenceType;
  value: string;
  attachedBy: ActorRef;
  attachedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: ActorRef;
  checkedAt?: string;
}

// ── Decline / Block reasons ─────────────────────────────────────────

export type DeclineReason =
  | 'not_my_scope'
  | 'not_my_shift'
  | 'patient_transferred'
  | 'already_done'
  | 'duplicate'
  | 'insufficient_info'
  | 'resource_unavailable'
  | 'clinical_contraindication'
  | 'other';

export type BlockReason =
  | 'waiting_lab'
  | 'waiting_pharmacy'
  | 'waiting_transport'
  | 'waiting_cleaning'
  | 'waiting_equipment'
  | 'waiting_physician'
  | 'waiting_family'
  | 'waiting_insurance'
  | 'patient_unstable'
  | 'other';

// ── Actor ───────────────────────────────────────────────────────────

export interface ActorRef {
  id: string;
  name: string;
  role: string;
  ward?: string;
}

// ── SLA ─────────────────────────────────────────────────────────────

export interface SLAState {
  receiveBy: string;
  acceptBy: string;
  startBy: string;
  completeBy: string;
  currentPhase: 'receive' | 'accept' | 'start' | 'complete';
  elapsedMs: number;
  pausedMs: number;
  breached: boolean;
  breachCount: number;
  breachedPhases: string[];
}

// ── History / Comments ──────────────────────────────────────────────

export type TaskAction =
  | 'created'
  | 'sent'
  | 'received'
  | 'accepted'
  | 'declined'
  | 'started'
  | 'blocked'
  | 'unblocked'
  | 'completed'
  | 'verified'
  | 'escalated'
  | 'reassigned'
  | 'cancelled'
  | 'commented'
  | 'evidence_attached'
  | 'sla_warning'
  | 'sla_breach';

export interface TaskHistoryEntry {
  id: string;
  action: TaskAction;
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  actor: ActorRef;
  timestamp: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskComment {
  id: string;
  author: ActorRef;
  text: string;
  createdAt: string;
}

// ── Task Source ──────────────────────────────────────────────────────

export type TaskSource = 'manual' | 'system' | 'workflow' | 'escalation';

// ── Main Entity ─────────────────────────────────────────────────────

export interface HospitalTask {
  id: string;
  shortCode: string;
  version: number;

  type: string;
  category: TaskCategory;
  subcategory: TaskSubcategory;
  priority: TaskPriority;

  status: TaskStatus;
  previousStatus?: TaskStatus;
  statusChangedAt: string;

  title: string;
  description?: string;
  instructions?: string;

  patientId?: string;
  patientMrn?: string;
  patientName?: string;
  ward: string;
  bed?: string;
  location?: string;

  createdBy: ActorRef;
  assignedTo: ActorRef;
  acceptedBy?: ActorRef;
  completedBy?: ActorRef;
  verifiedBy?: ActorRef;
  currentEscalationLevel: number;

  sla: SLAState;

  evidence: Evidence[];
  checklistItems?: ChecklistItem[];

  parentTaskId?: string;
  blockedBy?: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;

  blockReason?: BlockReason;
  blockReasonText?: string;
  blockedAt?: string;
  estimatedUnblockAt?: string;

  declineReason?: DeclineReason;
  declineReasonText?: string;

  history: TaskHistoryEntry[];
  comments: TaskComment[];

  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  verifiedAt?: string;
  cancelledAt?: string;

  source: TaskSource;
  tags?: string[];
  shift?: string;
}

// ── SLA Defaults ────────────────────────────────────────────────────

/** SLA durations in milliseconds per priority */
export const SLA_RECEIVE_MS: Record<TaskPriority, number> = {
  urgent: 5 * 60_000,
  high: 15 * 60_000,
  normal: 30 * 60_000,
  low: 2 * 3600_000,
};

export const SLA_ACCEPT_MS: Record<TaskPriority, number> = {
  urgent: 5 * 60_000,
  high: 15 * 60_000,
  normal: 60 * 60_000,
  low: 4 * 3600_000,
};

export const SLA_START_MS: Record<TaskPriority, number> = {
  urgent: 10 * 60_000,
  high: 30 * 60_000,
  normal: 2 * 3600_000,
  low: 8 * 3600_000,
};
