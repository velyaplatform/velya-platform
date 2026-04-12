/**
 * Hospital Task State Machine — enforces valid status transitions.
 *
 * Every transition must be declared in TRANSITIONS. The validateTransition
 * function also checks that required context (decline reason, block reason)
 * is provided for specific transitions.
 */

import type { TaskStatus, BlockReason, DeclineReason } from './hospital-task-types';

/** Map of from-status → allowed to-statuses */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['received', 'expired', 'escalated', 'reassigned', 'cancelled'],
  received: ['accepted', 'declined', 'escalated', 'reassigned', 'cancelled'],
  accepted: ['in_progress', 'declined', 'escalated', 'reassigned', 'cancelled'],
  in_progress: ['completed', 'blocked', 'escalated'],
  blocked: ['in_progress', 'escalated', 'cancelled'],
  completed: ['verified'],
  verified: [],
  declined: [],
  reassigned: [],
  cancelled: [],
  expired: ['reassigned', 'escalated'],
  escalated: ['open', 'reassigned', 'cancelled'],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAvailableTransitions(from: TaskStatus): TaskStatus[] {
  return TRANSITIONS[from] ?? [];
}

interface TransitionContext {
  declineReason?: DeclineReason;
  declineReasonText?: string;
  blockReason?: BlockReason;
  blockReasonText?: string;
}

interface TransitionResult {
  valid: boolean;
  reason?: string;
}

export function validateTransition(
  from: TaskStatus,
  to: TaskStatus,
  context?: TransitionContext,
): TransitionResult {
  if (!canTransition(from, to)) {
    return {
      valid: false,
      reason: `Transicao invalida: ${from} → ${to}`,
    };
  }

  if (to === 'declined') {
    if (!context?.declineReason) {
      return {
        valid: false,
        reason: 'Recusa exige motivo estruturado (declineReason)',
      };
    }
    if (context.declineReason === 'other' && !context.declineReasonText?.trim()) {
      return {
        valid: false,
        reason: 'Motivo "outro" exige texto descritivo (declineReasonText)',
      };
    }
  }

  if (to === 'blocked') {
    if (!context?.blockReason) {
      return {
        valid: false,
        reason: 'Bloqueio exige motivo estruturado (blockReason)',
      };
    }
    if (context.blockReason === 'other' && !context.blockReasonText?.trim()) {
      return {
        valid: false,
        reason: 'Motivo "outro" exige texto descritivo (blockReasonText)',
      };
    }
  }

  return { valid: true };
}
