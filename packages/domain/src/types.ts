/**
 * Common domain types shared across the Velya platform.
 *
 * These are foundational value types that avoid primitive obsession
 * and provide semantic meaning to identifiers and timestamps.
 */

/**
 * Branded type pattern for type-safe identifiers.
 * Prevents accidentally passing a patient ID where an encounter ID is expected.
 */
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** Type-safe patient identifier. */
export type PatientId = Brand<string, 'PatientId'>;

/** Type-safe encounter identifier. */
export type EncounterId = Brand<string, 'EncounterId'>;

/** Type-safe task identifier. */
export type TaskId = Brand<string, 'TaskId'>;

/** Type-safe user identifier. */
export type UserId = Brand<string, 'UserId'>;

/** Type-safe bed identifier. */
export type BedId = Brand<string, 'BedId'>;

/** Type-safe ward identifier. */
export type WardId = Brand<string, 'WardId'>;

/** ISO-8601 timestamp string. */
export type Timestamp = Brand<string, 'Timestamp'>;

/** Medical Record Number. */
export type MRN = Brand<string, 'MRN'>;

/**
 * Create a type-safe identifier. In production, these are validated;
 * the cast is the intentional boundary where raw strings become typed.
 */
export function createPatientId(value: string): PatientId {
  return value as PatientId;
}

export function createEncounterId(value: string): EncounterId {
  return value as EncounterId;
}

export function createTaskId(value: string): TaskId {
  return value as TaskId;
}

export function createUserId(value: string): UserId {
  return value as UserId;
}

export function createBedId(value: string): BedId {
  return value as BedId;
}

export function createWardId(value: string): WardId {
  return value as WardId;
}

export function createTimestamp(value?: string): Timestamp {
  return (value ?? new Date().toISOString()) as Timestamp;
}

export function createMRN(value: string): MRN {
  return value as MRN;
}

/**
 * Pagination parameters used across all list endpoints.
 */
export interface PaginationParams {
  readonly limit: number;
  readonly offset: number;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

/**
 * Sort direction for list queries.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort specification for list queries.
 */
export interface SortSpec {
  readonly field: string;
  readonly direction: SortDirection;
}

/**
 * Date range filter for queries.
 */
export interface DateRange {
  readonly from: Timestamp | null;
  readonly to: Timestamp | null;
}

/**
 * Standard error response shape across all services.
 */
export interface ErrorResponse {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string;
  readonly correlationId?: string;
}
