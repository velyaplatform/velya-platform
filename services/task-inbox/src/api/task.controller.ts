import { Controller, Get, Post, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskSource,
  TaskInboxSummary,
} from '../domain/task.js';

/**
 * Query parameters for filtering task lists.
 */
interface TaskQueryParams {
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly assignedTo?: string;
  readonly assignedTeam?: string;
  readonly category?: string;
  readonly patientId?: string;
  readonly encounterId?: string;
  readonly source?: TaskSource;
  readonly overdueOnly?: string;
  readonly parentTaskId?: string;
  readonly limit?: string;
  readonly offset?: string;
}

/**
 * Response wrapper for paginated task lists.
 */
interface TaskListResponse {
  readonly tasks: ReadonlyArray<Task>;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Request body for creating a new task.
 */
interface CreateTaskRequest {
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly category: string;
  readonly source: TaskSource;
  readonly assignedTo: string;
  readonly assignedTeam: string;
  readonly createdBy: string;
  readonly patientId?: string;
  readonly encounterId?: string;
  readonly dueDate?: string;
  readonly slaMinutes?: number;
  readonly parentTaskId?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Request body for updating a task.
 */
interface UpdateTaskRequest {
  readonly title?: string;
  readonly description?: string;
  readonly priority?: TaskPriority;
  readonly category?: string;
  readonly dueDate?: string | null;
  readonly slaMinutes?: number | null;
  readonly metadata?: Record<string, unknown>;
  readonly actor: string;
}

/**
 * Request body for changing task status.
 */
interface UpdateTaskStatusRequest {
  readonly status: TaskStatus;
  readonly note?: string;
  readonly actor: string;
}

/**
 * Request body for assigning/reassigning a task.
 */
interface AssignTaskRequest {
  readonly assignedTo: string;
  readonly assignedTeam: string;
  readonly note?: string;
  readonly actor: string;
}

/**
 * Request body for bulk task operations.
 */
interface BulkTaskOperationRequest {
  readonly taskIds: ReadonlyArray<string>;
  readonly operation: BulkOperation;
  readonly actor: string;
  readonly assignedTo?: string;
  readonly assignedTeam?: string;
  readonly priority?: TaskPriority;
  readonly note?: string;
}

type BulkOperation = 'assign' | 'complete' | 'cancel' | 'escalate' | 'reprioritize';

/**
 * Response for bulk operations.
 */
interface BulkOperationResponse {
  readonly succeeded: ReadonlyArray<string>;
  readonly failed: ReadonlyArray<{ taskId: string; reason: string }>;
  readonly totalProcessed: number;
}

/**
 * REST controller for task inbox management.
 *
 * Provides full CRUD, assignment, status transitions, and bulk operations
 * for clinical and operational tasks.
 */
@Controller('tasks')
export class TaskController {
  /**
   * List tasks with optional filters and pagination.
   *
   * GET /api/v1/tasks?status=pending&assignedTo=user-123&overdueOnly=true
   */
  @Get()
  async listTasks(
    @Query() query: TaskQueryParams,
  ): Promise<TaskListResponse> {
    const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 100);
    const offset = parseInt(query.offset ?? '0', 10) || 0;

    // TODO: Wire to task repository with filter application
    return {
      tasks: [],
      total: 0,
      limit,
      offset,
    };
  }

  /**
   * Get a single task by ID.
   *
   * GET /api/v1/tasks/:id
   */
  @Get(':id')
  async getTask(
    @Param('id') id: string,
  ): Promise<Task | { error: string; statusCode: number }> {
    // TODO: Wire to task repository
    return {
      error: `Task ${id} not found`,
      statusCode: 404,
    };
  }

  /**
   * Get task inbox summary for a user or team.
   *
   * GET /api/v1/tasks/summary?assignedTo=user-123
   */
  @Get('summary')
  async getInboxSummary(
    @Query('assignedTo') assignedTo?: string,
    @Query('assignedTeam') assignedTeam?: string,
  ): Promise<TaskInboxSummary> {
    // TODO: Wire to aggregation service
    return {
      totalTasks: 0,
      pendingCount: 0,
      inProgressCount: 0,
      overdueCount: 0,
      escalatedCount: 0,
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
      },
      byCategory: {},
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a new task.
   *
   * POST /api/v1/tasks
   */
  @Post()
  async createTask(
    @Body() body: CreateTaskRequest,
  ): Promise<Task | { error: string; statusCode: number }> {
    // TODO: Wire to task creation service
    // - Validate required fields
    // - Compute SLA deadline if slaMinutes provided
    // - Emit TaskCreated event
    return {
      error: 'Not implemented',
      statusCode: 501,
    };
  }

  /**
   * Update task fields (non-status, non-assignment changes).
   *
   * PATCH /api/v1/tasks/:id
   */
  @Patch(':id')
  async updateTask(
    @Param('id') id: string,
    @Body() body: UpdateTaskRequest,
  ): Promise<Task | { error: string; statusCode: number }> {
    // TODO: Wire to task update service
    return {
      error: `Task ${id} not found`,
      statusCode: 404,
    };
  }

  /**
   * Update a task's status (complete, cancel, escalate).
   *
   * PATCH /api/v1/tasks/:id/status
   */
  @Patch(':id/status')
  async updateTaskStatus(
    @Param('id') id: string,
    @Body() body: UpdateTaskStatusRequest,
  ): Promise<Task | { error: string; statusCode: number }> {
    // TODO: Wire to task status transition service
    // - Validate status transition
    // - Record audit trail entry
    // - Emit appropriate domain event
    return {
      error: `Task ${id} not found`,
      statusCode: 404,
    };
  }

  /**
   * Assign or reassign a task.
   *
   * PATCH /api/v1/tasks/:id/assignment
   */
  @Patch(':id/assignment')
  async assignTask(
    @Param('id') id: string,
    @Body() body: AssignTaskRequest,
  ): Promise<Task | { error: string; statusCode: number }> {
    // TODO: Wire to task assignment service
    // - Validate assignee exists
    // - Record audit trail entry
    // - Notify new assignee
    return {
      error: `Task ${id} not found`,
      statusCode: 404,
    };
  }

  /**
   * Delete a task (soft delete - marks as cancelled).
   *
   * DELETE /api/v1/tasks/:id
   */
  @Delete(':id')
  async deleteTask(
    @Param('id') id: string,
    @Query('actor') actor: string,
  ): Promise<{ success: boolean } | { error: string; statusCode: number }> {
    // TODO: Wire to task cancellation service
    // Tasks are soft-deleted (status -> cancelled) for audit trail preservation
    return {
      error: `Task ${id} not found`,
      statusCode: 404,
    };
  }

  /**
   * Perform a bulk operation on multiple tasks.
   *
   * POST /api/v1/tasks/bulk
   */
  @Post('bulk')
  async bulkOperation(
    @Body() body: BulkTaskOperationRequest,
  ): Promise<BulkOperationResponse> {
    // TODO: Wire to bulk task operation service
    // - Process each task independently
    // - Collect successes and failures
    // - Emit events for each successful operation
    return {
      succeeded: [],
      failed: body.taskIds.map((taskId) => ({
        taskId,
        reason: 'Not implemented',
      })),
      totalProcessed: body.taskIds.length,
    };
  }

  /**
   * Get all subtasks for a parent task.
   *
   * GET /api/v1/tasks/:id/subtasks
   */
  @Get(':id/subtasks')
  async getSubtasks(
    @Param('id') id: string,
  ): Promise<ReadonlyArray<Task>> {
    // TODO: Wire to task repository filtered by parentTaskId
    return [];
  }
}
