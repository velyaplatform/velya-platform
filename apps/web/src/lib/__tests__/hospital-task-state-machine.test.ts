import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getAvailableTransitions,
  validateTransition,
} from '../hospital-task-state-machine';

describe('hospital-task-state-machine', () => {
  describe('canTransition', () => {
    it('allows draft → open', () => {
      expect(canTransition('draft', 'open')).toBe(true);
    });

    it('allows open → received', () => {
      expect(canTransition('open', 'received')).toBe(true);
    });

    it('allows received → accepted', () => {
      expect(canTransition('received', 'accepted')).toBe(true);
    });

    it('allows received → declined', () => {
      expect(canTransition('received', 'declined')).toBe(true);
    });

    it('allows accepted → in_progress', () => {
      expect(canTransition('accepted', 'in_progress')).toBe(true);
    });

    it('allows in_progress → completed', () => {
      expect(canTransition('in_progress', 'completed')).toBe(true);
    });

    it('allows in_progress → blocked', () => {
      expect(canTransition('in_progress', 'blocked')).toBe(true);
    });

    it('allows blocked → in_progress', () => {
      expect(canTransition('blocked', 'in_progress')).toBe(true);
    });

    it('allows completed → verified', () => {
      expect(canTransition('completed', 'verified')).toBe(true);
    });

    it('rejects draft → completed (skip statuses)', () => {
      expect(canTransition('draft', 'completed')).toBe(false);
    });

    it('rejects completed → open (backwards)', () => {
      expect(canTransition('completed', 'open')).toBe(false);
    });

    it('rejects verified → anything', () => {
      expect(canTransition('verified', 'open')).toBe(false);
    });

    it('allows any active status → escalated', () => {
      expect(canTransition('open', 'escalated')).toBe(true);
      expect(canTransition('received', 'escalated')).toBe(true);
      expect(canTransition('in_progress', 'escalated')).toBe(true);
    });

    it('allows any active status → cancelled', () => {
      expect(canTransition('open', 'cancelled')).toBe(true);
      expect(canTransition('received', 'cancelled')).toBe(true);
      expect(canTransition('accepted', 'cancelled')).toBe(true);
    });

    it('rejects cancel after in_progress', () => {
      expect(canTransition('in_progress', 'cancelled')).toBe(false);
    });

    it('allows any pre-progress → reassigned', () => {
      expect(canTransition('open', 'reassigned')).toBe(true);
      expect(canTransition('received', 'reassigned')).toBe(true);
    });
  });

  describe('getAvailableTransitions', () => {
    it('returns correct transitions for open', () => {
      const transitions = getAvailableTransitions('open');
      expect(transitions).toContain('received');
      expect(transitions).toContain('expired');
      expect(transitions).toContain('escalated');
      expect(transitions).toContain('reassigned');
      expect(transitions).toContain('cancelled');
      expect(transitions).not.toContain('completed');
    });

    it('returns empty for verified (terminal)', () => {
      const transitions = getAvailableTransitions('verified');
      expect(transitions).toEqual([]);
    });

    it('returns empty for cancelled (terminal)', () => {
      const transitions = getAvailableTransitions('cancelled');
      expect(transitions).toEqual([]);
    });
  });

  describe('validateTransition', () => {
    it('returns ok for valid transition', () => {
      const result = validateTransition('open', 'received');
      expect(result.valid).toBe(true);
    });

    it('returns error for invalid transition', () => {
      const result = validateTransition('draft', 'completed');
      expect(result.valid).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it('requires decline reason for received → declined', () => {
      const result = validateTransition('received', 'declined', {});
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('motivo');
    });

    it('accepts declined with reason', () => {
      const result = validateTransition('received', 'declined', {
        declineReason: 'not_my_scope',
      });
      expect(result.valid).toBe(true);
    });

    it('requires block reason for in_progress → blocked', () => {
      const result = validateTransition('in_progress', 'blocked', {});
      expect(result.valid).toBe(false);
    });

    it('accepts blocked with reason', () => {
      const result = validateTransition('in_progress', 'blocked', {
        blockReason: 'waiting_lab',
      });
      expect(result.valid).toBe(true);
    });
  });
});
