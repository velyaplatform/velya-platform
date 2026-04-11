/**
 * Result<T, E> — discriminated-union error envelope.
 *
 * Why: the Velya web codebase has 87 ad-hoc try/catch blocks, some of them
 * silently swallowing failures. A Result envelope forces every caller to
 * acknowledge both paths at the type level, so errors cannot silently
 * disappear. This is a thin, dependency-free version of Rust's Result.
 */

export interface Ok<T> {
  ok: true;
  value: T;
}

export interface Err<E> {
  ok: false;
  error: E;
}

export type Result<T, E = string> = Ok<T> | Err<E>;

/** Why: single constructor keeps the discriminator shape consistent everywhere. */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/** Why: mirror of `ok`, so callers never hand-build `{ ok: false, ... }`. */
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** Why: type guard so `r.value` narrows without casts. */
export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

/** Why: type guard so `r.error` narrows without casts. */
export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

/** Why: wrap legacy sync code that still throws, without a local try/catch. */
export function tryCatch<T>(fn: () => T): Result<T, string> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

/** Why: async variant so `await`-heavy handlers stop needing try/catch scaffolding. */
export async function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, string>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

/** Why: transform the success payload without unpacking the envelope manually. */
export function mapResult<T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

/** Why: lets callers downgrade a Result into a plain value with an explicit default. */
export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}
