import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { vi } from 'vitest';

type StoreModule = typeof import('../hospital-task-store');

let store: StoreModule;
let storagePath: string;

async function freshStore(): Promise<StoreModule> {
  vi.resetModules();
  storagePath = join(tmpdir(), `velya-test-tasks-${randomBytes(6).toString('hex')}.json`);
  process.env.VELYA_TASK_PATH = storagePath;
  process.env.VELYA_AUDIT_PATH = join(tmpdir(), `velya-test-audit-${randomBytes(6).toString('hex')}`);
  return (await import('../hospital-task-store')) as StoreModule;
}

const NURSE: { id: string; name: string; role: string; ward: string } = {
  id: 'user-nurse-1',
  name: 'Ana Silva',
  role: 'nurse',
  ward: 'Ala 3B',
};

const DOCTOR: { id: string; name: string; role: string; ward: string } = {
  id: 'user-doc-1',
  name: 'Dr. Carlos',
  role: 'medical_staff_attending',
  ward: 'Ala 3B',
};

const COORDINATOR: { id: string; name: string; role: string; ward: string } = {
  id: 'user-coord-1',
  name: 'Maria Coord.',
  role: 'nurse',
  ward: 'Ala 3B',
};

function createTestTask(s: StoreModule) {
  return s.createTask({
    type: 'med-admin-iv',
    category: 'assistencial',
    subcategory: 'medicacao',
    priority: 'high',
    title: 'Administrar Dipirona 1g IV',
    ward: 'Ala 3B',
    bed: '302A',
    patientMrn: 'MRN-001',
    patientName: 'Eleanor Voss',
    createdBy: DOCTOR,
    assignedTo: NURSE,
  });
}

beforeEach(async () => {
  store = await freshStore();
});

afterEach(() => {
  if (storagePath && existsSync(storagePath)) {
    try { unlinkSync(storagePath); } catch { /* ignore */ }
  }
  delete process.env.VELYA_TASK_PATH;
  delete process.env.VELYA_AUDIT_PATH;
});

describe('hospital-task-store', () => {
  describe('createTask', () => {
    it('creates a task with correct fields', () => {
      const task = createTestTask(store);
      expect(task.id).toMatch(/^TASK-/);
      expect(task.shortCode).toBe('T-001');
      expect(task.status).toBe('open');
      expect(task.priority).toBe('high');
      expect(task.title).toBe('Administrar Dipirona 1g IV');
      expect(task.assignedTo.name).toBe('Ana Silva');
      expect(task.createdBy.name).toBe('Dr. Carlos');
      expect(task.history).toHaveLength(1);
      expect(task.history[0].action).toBe('created');
      expect(task.version).toBe(1);
    });

    it('increments short codes', () => {
      const t1 = createTestTask(store);
      const t2 = createTestTask(store);
      expect(t1.shortCode).toBe('T-001');
      expect(t2.shortCode).toBe('T-002');
    });

    it('builds SLA with correct deadlines', () => {
      const task = createTestTask(store);
      expect(task.sla.currentPhase).toBe('receive');
      expect(task.sla.breached).toBe(false);
      expect(new Date(task.sla.receiveBy).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('updateTaskStatus', () => {
    it('transitions open → received', () => {
      const task = createTestTask(store);
      const updated = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'received',
      });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('received');
      expect(updated!.receivedAt).toBeTruthy();
      expect(updated!.sla.currentPhase).toBe('accept');
      expect(updated!.version).toBe(2);
      expect(updated!.history).toHaveLength(2);
    });

    it('transitions received → declined with reason', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'received',
      });
      const declined = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'declined',
        declineReason: 'not_my_shift',
        note: 'Saio do turno em 5 min',
      });
      expect(declined).not.toBeNull();
      expect(declined!.status).toBe('declined');
      expect(declined!.declineReason).toBe('not_my_shift');
    });

    it('rejects invalid transition', () => {
      const task = createTestTask(store);
      const result = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'completed',
      });
      expect(result).toBeNull();
    });

    it('rejects decline without reason', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'received',
      });
      const result = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'declined',
      });
      expect(result).toBeNull();
    });

    it('handles full happy path: open → received → accepted → in_progress → completed → verified', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'accepted' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'in_progress' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'completed', note: 'Medicacao administrada' });
      const verified = store.updateTaskStatus({ taskId: task.id, actorId: DOCTOR.id, actorName: DOCTOR.name, actorRole: DOCTOR.role, toStatus: 'verified' });

      expect(verified).not.toBeNull();
      expect(verified!.status).toBe('verified');
      expect(verified!.history).toHaveLength(6);
      expect(verified!.version).toBe(6);
      expect(verified!.receivedAt).toBeTruthy();
      expect(verified!.acceptedAt).toBeTruthy();
      expect(verified!.startedAt).toBeTruthy();
      expect(verified!.completedAt).toBeTruthy();
      expect(verified!.verifiedAt).toBeTruthy();
    });

    it('handles block and unblock cycle', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'accepted' });
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'in_progress' });

      const blocked = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'blocked',
        blockReason: 'waiting_pharmacy',
        blockReasonText: 'Farmacia ainda nao dispensou',
      });
      expect(blocked!.status).toBe('blocked');
      expect(blocked!.blockReason).toBe('waiting_pharmacy');

      const unblocked = store.updateTaskStatus({
        taskId: task.id,
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'in_progress',
        note: 'Farmacia dispensou',
      });
      expect(unblocked!.status).toBe('in_progress');
      expect(unblocked!.blockReason).toBeUndefined();
    });

    it('returns null for non-existent task', () => {
      const result = store.updateTaskStatus({
        taskId: 'TASK-NONEXISTENT',
        actorId: NURSE.id,
        actorName: NURSE.name,
        actorRole: NURSE.role,
        toStatus: 'received',
      });
      expect(result).toBeNull();
    });

    it('increments escalation level', () => {
      const task = createTestTask(store);
      const escalated = store.updateTaskStatus({
        taskId: task.id,
        actorId: COORDINATOR.id,
        actorName: COORDINATOR.name,
        actorRole: COORDINATOR.role,
        toStatus: 'escalated',
        note: 'SLA breach — escalando para coordenacao',
      });
      expect(escalated!.currentEscalationLevel).toBe(1);
    });
  });

  describe('attachEvidence', () => {
    it('attaches evidence to a task', () => {
      const task = createTestTask(store);
      const updated = store.attachEvidence({
        taskId: task.id,
        actor: NURSE,
        type: 'text',
        value: 'Medicacao administrada sem intercorrencias',
      });
      expect(updated).not.toBeNull();
      expect(updated!.evidence).toHaveLength(1);
      expect(updated!.evidence[0].type).toBe('text');
      expect(updated!.evidence[0].id).toMatch(/^EV-/);
    });
  });

  describe('addComment', () => {
    it('adds a comment to a task', () => {
      const task = createTestTask(store);
      const updated = store.addComment({
        taskId: task.id,
        author: DOCTOR,
        text: 'Verificar alergia antes de administrar',
      });
      expect(updated).not.toBeNull();
      expect(updated!.comments).toHaveLength(1);
      expect(updated!.comments[0].text).toBe('Verificar alergia antes de administrar');
    });
  });

  describe('listTasks', () => {
    it('lists all tasks', () => {
      createTestTask(store);
      createTestTask(store);
      const tasks = store.listTasks();
      expect(tasks).toHaveLength(2);
    });

    it('filters by assignedToId', () => {
      createTestTask(store);
      const tasks = store.listTasks({ assignedToId: NURSE.id });
      expect(tasks).toHaveLength(1);
      const empty = store.listTasks({ assignedToId: 'nonexistent' });
      expect(empty).toHaveLength(0);
    });

    it('filters by status', () => {
      const task = createTestTask(store);
      store.updateTaskStatus({ taskId: task.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      createTestTask(store);
      const received = store.listTasks({ status: 'received' });
      expect(received).toHaveLength(1);
    });

    it('filters by multiple statuses', () => {
      const t1 = createTestTask(store);
      store.updateTaskStatus({ taskId: t1.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      createTestTask(store);
      const result = store.listTasks({ status: ['open', 'received'] });
      expect(result).toHaveLength(2);
    });

    it('searches by title', () => {
      createTestTask(store);
      const found = store.listTasks({ search: 'dipirona' });
      expect(found).toHaveLength(1);
      const notFound = store.listTasks({ search: 'inexistente' });
      expect(notFound).toHaveLength(0);
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) createTestTask(store);
      const limited = store.listTasks({ limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  describe('getTaskById', () => {
    it('finds by id', () => {
      const task = createTestTask(store);
      const found = store.getTaskById(task.id);
      expect(found).not.toBeNull();
      expect(found!.shortCode).toBe(task.shortCode);
    });

    it('finds by shortCode', () => {
      const task = createTestTask(store);
      const found = store.getTaskById(task.shortCode);
      expect(found).not.toBeNull();
    });

    it('returns null for missing', () => {
      expect(store.getTaskById('NOPE')).toBeNull();
    });
  });

  describe('countTasksByStatus', () => {
    it('counts correctly', () => {
      const t1 = createTestTask(store);
      createTestTask(store);
      store.updateTaskStatus({ taskId: t1.id, actorId: NURSE.id, actorName: NURSE.name, actorRole: NURSE.role, toStatus: 'received' });
      const counts = store.countTasksByStatus();
      expect(counts.open).toBe(1);
      expect(counts.received).toBe(1);
    });

    it('filters by ward', () => {
      createTestTask(store);
      const counts = store.countTasksByStatus('Ala 3B');
      expect(counts.open).toBe(1);
      const empty = store.countTasksByStatus('UTI');
      expect(empty.open ?? 0).toBe(0);
    });
  });
});
