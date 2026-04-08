/**
 * Represents a successful operation result.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Represents a failed operation result.
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Discriminated union for domain operation outcomes.
 * Use instead of throwing exceptions for expected failure cases.
 */
export type Result<T, E = string> = Ok<T> | Err<E>;

/**
 * Create a successful Result.
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create a failed Result.
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Unwrap a Result, throwing if it is an Err.
 * Use sparingly -- prefer pattern matching with `if (result.ok)`.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error(`Unwrap called on Err: ${String(result.error)}`);
}

/**
 * Map the success value of a Result.
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * FlatMap (chain) a Result, allowing the mapper to return a new Result.
 */
export function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}
