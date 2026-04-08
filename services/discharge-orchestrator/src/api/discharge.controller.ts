import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import type {
  DischargeBlocker,
  BlockerCategory,
  BlockerPriority,
  BlockerStatus,
  BlockerSummary,
} from '../domain/discharge-blocker.js';

/**
 * Query parameters for filtering blocker lists.
 */
interface BlockerQueryParams {
  readonly encounterId?: string;
  readonly patientId?: string;
  readonly category?: BlockerCategory;
  readonly priority?: BlockerPriority;
  readonly status?: BlockerStatus;
  readonly assignedTo?: string;
  readonly assignedTeam?: string;
  readonly overdueOnly?: string;
  readonly limit?: string;
  readonly offset?: string;
}

/**
 * Response wrapper for paginated blocker lists.
 */
interface BlockerListResponse {
  readonly blockers: ReadonlyArray<DischargeBlocker>;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Request body for creating a new discharge blocker.
 */
interface CreateBlockerRequest {
  readonly encounterId: string;
  readonly patientId: string;
  readonly category: BlockerCategory;
  readonly description: string;
  readonly priority: BlockerPriority;
  readonly assignedTo: string;
  readonly assignedTeam: string;
  readonly slaMinutes?: number;
}

/**
 * Request body for updating a discharge blocker's status.
 */
interface UpdateBlockerStatusRequest {
  readonly status: BlockerStatus;
  readonly note?: string;
  readonly actor: string;
}

/**
 * Request body for reassigning a discharge blocker.
 */
interface ReassignBlockerRequest {
  readonly assignedTo: string;
  readonly assignedTeam: string;
  readonly note?: string;
  readonly actor: string;
}

/**
 * REST controller for discharge blocker management.
 *
 * Provides endpoints for creating, updating, and querying
 * discharge blockers as part of the discharge orchestration workflow.
 */
@Controller('blockers')
export class DischargeController {
  /**
   * List discharge blockers with optional filters and pagination.
   *
   * GET /api/v1/blockers?encounterId=enc-123&status=identified&overdueOnly=true
   */
  @Get()
  async listBlockers(
    @Query() query: BlockerQueryParams,
  ): Promise<BlockerListResponse> {
    const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 100);
    const offset = parseInt(query.offset ?? '0', 10) || 0;

    // TODO: Wire to blocker repository with filter application
    return {
      blockers: [],
      total: 0,
      limit,
      offset,
    };
  }

  /**
   * Get a single discharge blocker by ID.
   *
   * GET /api/v1/blockers/:id
   */
  @Get(':id')
  async getBlocker(
    @Param('id') id: string,
  ): Promise<DischargeBlocker | { error: string; statusCode: number }> {
    // TODO: Wire to blocker repository
    return {
      error: `Blocker ${id} not found`,
      statusCode: 404,
    };
  }

  /**
   * Get blocker summary statistics.
   *
   * GET /api/v1/blockers/summary?assignedTeam=social-work
   */
  @Get('summary')
  async getBlockerSummary(
    @Query('assignedTeam') assignedTeam?: string,
    @Query('encounterId') encounterId?: string,
  ): Promise<BlockerSummary> {
    // TODO: Wire to aggregation service
    return {
      totalActive: 0,
      totalOverdue: 0,
      totalEscalated: 0,
      byCategory: {
        'clinical-clearance': 0,
        'pending-labs': 0,
        'pending-imaging': 0,
        'authorization': 0,
        'social-work': 0,
        'pharmacy': 0,
        'equipment': 0,
        'transport': 0,
        'family-education': 0,
        'follow-up-appointment': 0,
        'insurance': 0,
        'other': 0,
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      averageResolutionMinutes: null,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a new discharge blocker.
   *
   * POST /api/v1/blockers
   */
  @Post()
  async createBlocker(
    @Body() body: CreateBlockerRequest,
  ): Promise<DischargeBlocker | { error: string; statusCode: number }> {
    // TODO: Wire to blocker creation service
    // - Validate encounter exists
    // - Compute SLA deadline from category defaults or explicit slaMinutes
    // - Emit DischargeBlockerCreated event
    return {
      error: 'Not implemented',
      statusCode: 501,
    };
  }

  /**
   * Update a blocker's status (resolve, escalate, cancel, etc.).
   *
   * PATCH /api/v1/blockers/:id/status
   */
  @Patch(':id/status')
  async updateBlockerStatus(
    @Param('id') id: string,
    @Body() body: UpdateBlockerStatusRequest,
  ): Promise<DischargeBlocker | { error: string; statusCode: number }> {
    // TODO: Wire to blocker status transition service
    // - Validate status transition is allowed
    // - Record audit trail entry
    // - Emit appropriate domain event (resolved, escalated, etc.)
    return {
      error: `Blocker ${id} not found`,
      statusCode: 404,
    };
  }

  /**
   * Reassign a blocker to a different person or team.
   *
   * PATCH /api/v1/blockers/:id/assignment
   */
  @Patch(':id/assignment')
  async reassignBlocker(
    @Param('id') id: string,
    @Body() body: ReassignBlockerRequest,
  ): Promise<DischargeBlocker | { error: string; statusCode: number }> {
    // TODO: Wire to blocker reassignment service
    // - Validate new assignee/team
    // - Record audit trail entry
    // - Notify new assignee
    return {
      error: `Blocker ${id} not found`,
      statusCode: 404,
    };
  }

  /**
   * Get all blockers for a specific encounter.
   *
   * GET /api/v1/blockers/by-encounter/:encounterId
   */
  @Get('by-encounter/:encounterId')
  async getBlockersByEncounter(
    @Param('encounterId') encounterId: string,
  ): Promise<ReadonlyArray<DischargeBlocker>> {
    // TODO: Wire to blocker repository
    return [];
  }
}
