import { Result, ok, err, DomainEvent, createDomainEvent } from '@velya/shared-kernel';

/**
 * Task priority levels.
 */
export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

/**
 * Task status lifecycle.
 */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'snoozed';

/**
 * Task category for routing to the correct role/team.
 */
export type TaskCategory =
  | 'clinical'
  | 'nursing'
  | 'pharmacy'
  | 'social-work'
  | 'care-management'
  | 'transport'
  | 'environmental'
  | 'administrative';

/**
 * How the task was created.
 */
export type TaskSource = 'manual' | 'ai-generated' | 'system-rule' | 'ehr-integration';

/**
 * Task entity representing an actionable item in the clinical inbox.
 */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: TaskCategory;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly source: TaskSource;

  /** Patient this task relates to, if any. */
  readonly patientId: string | null;

  /** User or team assigned to this task. */
  readonly assigneeId: string | null;

  /** User who created the task (null for system/AI-generated). */
  readonly createdBy: string | null;

  readonly createdAt: string;
  readonly updatedAt: string;

  /** ISO-8601 deadline, if any. */
  readonly dueAt: string | null;

  /** When a snoozed task should reappear. */
  readonly snoozeUntil: string | null;

  /** If AI-generated, the confidence score (0-1). */
  readonly aiConfidence: number | null;

  /** Free-form metadata for extensibility. */
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * Create a new Task.
 */
export function createTask(
  params: Pick<Task, 'id' | 'title' | 'description' | 'category' | 'priority' | 'source'> & {
    patientId?: string;
    assigneeId?: string;
    createdBy?: string;
    dueAt?: string;
    aiConfidence?: number;
    metadata?: Record<string, string>;
  },
): Result<Task, string> {
  if (!params.title.trim()) {
    return err('Task title is required');
  }

  if (params.aiConfidence !== undefined && (params.aiConfidence < 0 || params.aiConfidence > 1)) {
    return err('AI confidence must be between 0 and 1');
  }

  const now = new Date().toISOString();

  return ok({
    id: params.id,
    title: params.title,
    description: params.description,
    category: params.category,
    priority: params.priority,
    status: 'pending',
    source: params.source,
    patientId: params.patientId ?? null,
    assigneeId: params.assigneeId ?? null,
    createdBy: params.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
    dueAt: params.dueAt ?? null,
    snoozeUntil: null,
    aiConfidence: params.aiConfidence ?? null,
    metadata: params.metadata ?? {},
  });
}

/**
 * Assign a task to a user or team.
 */
export function assignTask(
  task: Task,
  assigneeId: string,
): Result<{ task: Task; event: DomainEvent }, string> {
  if (task.status === 'completed' || task.status === 'cancelled') {
    return err(`Cannot assign a task with status "${task.status}"`);
  }

  const updatedTask: Task = {
    ...task,
    assigneeId,
    status: task.status === 'pending' ? 'in-progress' : task.status,
    updatedAt: new Date().toISOString(),
  };

  const event = createDomainEvent({
    eventType: 'task.assigned',
    aggregateId: task.id,
    aggregateType: 'Task',
    payload: { assigneeId, previousAssignee: task.assigneeId },
  });

  return ok({ task: updatedTask, event });
}

/**
 * Complete a task.
 */
export function completeTask(
  task: Task,
  completedBy: string,
): Result<{ task: Task; event: DomainEvent }, string> {
  if (task.status === 'completed') {
    return err('Task is already completed');
  }
  if (task.status === 'cancelled') {
    return err('Cannot complete a cancelled task');
  }

  const now = new Date().toISOString();
  const updatedTask: Task = {
    ...task,
    status: 'completed',
    updatedAt: now,
  };

  const event = createDomainEvent({
    eventType: 'task.completed',
    aggregateId: task.id,
    aggregateType: 'Task',
    payload: {
      completedBy,
      completedAt: now,
      category: task.category,
      patientId: task.patientId,
    },
  });

  return ok({ task: updatedTask, event });
}

/**
 * Snooze a task until a future time.
 */
export function snoozeTask(
  task: Task,
  snoozeUntil: string,
): Result<{ task: Task; event: DomainEvent }, string> {
  if (task.status === 'completed' || task.status === 'cancelled') {
    return err(`Cannot snooze a task with status "${task.status}"`);
  }

  const snoozeDate = new Date(snoozeUntil);
  if (isNaN(snoozeDate.getTime())) {
    return err('Invalid snooze date');
  }
  if (snoozeDate.getTime() <= Date.now()) {
    return err('Snooze time must be in the future');
  }

  const updatedTask: Task = {
    ...task,
    status: 'snoozed',
    snoozeUntil,
    updatedAt: new Date().toISOString(),
  };

  const event = createDomainEvent({
    eventType: 'task.snoozed',
    aggregateId: task.id,
    aggregateType: 'Task',
    payload: { snoozeUntil },
  });

  return ok({ task: updatedTask, event });
}
