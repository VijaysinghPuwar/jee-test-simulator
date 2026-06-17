interface Bucket {
  tokens: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { tokens: limit - 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (existing.tokens <= 0) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: existing.resetAt - now,
    };
  }
  existing.tokens -= 1;
  return {
    ok: true,
    remaining: existing.tokens,
    retryAfterMs: existing.resetAt - now,
  };
}

setInterval(
  () => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  },
  5 * 60 * 1000
).unref?.();
