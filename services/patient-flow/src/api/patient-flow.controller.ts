import { Controller, Get, Param, Query } from '@nestjs/common';
import type { Encounter, EncounterStatus, AcuityLevel } from '../domain/encounter.js';
import type { HospitalCensus, WardCensus } from '../domain/bed-management.js';

/**
 * Query parameters for filtering encounter lists.
 */
interface EncounterQueryParams {
  readonly status?: EncounterStatus;
  readonly department?: string;
  readonly acuityLevel?: AcuityLevel;
  readonly attendingPhysicianId?: string;
  readonly hasBlockers?: string;
  readonly overdueOnly?: string;
  readonly limit?: string;
  readonly offset?: string;
}

/**
 * Response wrapper for paginated encounter lists.
 */
interface EncounterListResponse {
  readonly encounters: ReadonlyArray<Encounter>;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Census response for a specific department.
 */
interface DepartmentCensusResponse {
  readonly department: string;
  readonly census: WardCensus;
}

/**
 * Command center dashboard payload aggregating hospital-wide metrics.
 */
interface CommandCenterResponse {
  readonly hospitalCensus: HospitalCensus;
  readonly activeEncounters: number;
  readonly dischargesExpectedToday: number;
  readonly totalPendingItems: number;
  readonly totalActiveBlockers: number;
  readonly encountersByAcuity: Readonly<Record<AcuityLevel, number>>;
  readonly averageLengthOfStay: number;
  readonly overdueDischarges: number;
  readonly computedAt: string;
}

/**
 * REST controller for patient flow operations.
 *
 * Provides endpoints for encounter management, census reporting,
 * and the command center dashboard view.
 */
@Controller('encounters')
export class PatientFlowController {
  /**
   * List encounters with optional filters and pagination.
   *
   * GET /api/v1/encounters?status=in-progress&department=ICU&limit=20&offset=0
   */
  @Get()
  async listEncounters(@Query() query: EncounterQueryParams): Promise<EncounterListResponse> {
    const limit = Math.min(parseInt(query.limit ?? '20', 10) || 20, 100);
    const offset = parseInt(query.offset ?? '0', 10) || 0;

    // TODO: Wire to encounter repository with filter application
    return {
      encounters: [],
      total: 0,
      limit,
      offset,
    };
  }

  /**
   * Get a single encounter by ID.
   *
   * GET /api/v1/encounters/:id
   */
  @Get(':id')
  async getEncounter(
    @Param('id') id: string,
  ): Promise<Encounter | { error: string; statusCode: number }> {
    // TODO: Wire to encounter repository
    return {
      error: `Encounter ${id} not found`,
      statusCode: 404,
    };
  }

  /**
   * Get current census by department.
   *
   * GET /api/v1/encounters/census?department=ICU
   */
  @Get('census')
  async getCensus(
    @Query('department') department?: string,
  ): Promise<ReadonlyArray<DepartmentCensusResponse> | DepartmentCensusResponse> {
    // TODO: Wire to bed management service
    if (department) {
      return {
        department,
        census: {
          wardId: '',
          wardName: '',
          department,
          totalBeds: 0,
          occupiedBeds: 0,
          availableBeds: 0,
          pendingBeds: 0,
          blockedBeds: 0,
          occupancyRate: 0,
          expectedDischargesToday: 0,
          pendingAdmissions: 0,
          computedAt: new Date().toISOString(),
        },
      };
    }

    return [];
  }

  /**
   * Get command center dashboard data aggregating hospital-wide metrics.
   *
   * GET /api/v1/encounters/command-center
   */
  @Get('command-center')
  async getCommandCenter(): Promise<CommandCenterResponse> {
    // TODO: Wire to aggregation service that computes real-time metrics
    return {
      hospitalCensus: {
        totalBeds: 0,
        occupiedBeds: 0,
        availableBeds: 0,
        occupancyRate: 0,
        wardCensuses: [],
        expectedDischargesToday: 0,
        pendingAdmissions: 0,
        computedAt: new Date().toISOString(),
      },
      activeEncounters: 0,
      dischargesExpectedToday: 0,
      totalPendingItems: 0,
      totalActiveBlockers: 0,
      encountersByAcuity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      averageLengthOfStay: 0,
      overdueDischarges: 0,
      computedAt: new Date().toISOString(),
    };
  }
}
