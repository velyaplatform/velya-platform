/**
 * In-memory sliding-window rate limiter for AI requests.
 *
 * Production should replace this with NATS JetStream KV or Redis. For now,
 * this gives us correct per-user enforcement within a single web pod, which
 * is enough for the current single-replica deployment.
 */

interface RateBucket {
  /** Timestamps of requests in the current 1-hour window */
  hits: number[];
}

const BUCKETS = new Map<string, RateBucket>();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  limit: number;
}

export function checkAiRateLimit(userId: string, hourlyLimit: number): RateLimitResult {
  const now = Date.now();
  let bucket = BUCKETS.get(userId);
  if (!bucket) {
    bucket = { hits: [] };
    BUCKETS.set(userId, bucket);
  }
  // Drop hits older than the window
  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);

  const used = bucket.hits.length;
  const remaining = Math.max(0, hourlyLimit - used);
  const allowed = used < hourlyLimit;
  const resetAtMs = bucket.hits.length > 0 ? bucket.hits[0] + WINDOW_MS : now + WINDOW_MS;

  if (allowed) {
    bucket.hits.push(now);
  }

  return { allowed, remaining: allowed ? remaining - 1 : remaining, resetAtMs, limit: hourlyLimit };
}

export function resetAiRateLimit(userId: string): void {
  BUCKETS.delete(userId);
}
