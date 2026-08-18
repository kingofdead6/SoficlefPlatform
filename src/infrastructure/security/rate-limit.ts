import 'server-only';

/**
 * Rate limiting for login, password reset and every mutating endpoint (CDC v0.1 §15).
 *
 * The in-memory implementation is correct for a single instance, which is what SOFICLEF
 * will run initially. The interface is what matters: a Redis-backed store (CDC v0.1 §14)
 * drops in behind it when the deployment becomes multi-instance, without touching a
 * single call site.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** When the current window ends. Sent as Retry-After on a rejection. */
  resetAt: Date;
}

export interface RateLimiter {
  /** Records one hit against the key and reports whether it is still under the limit. */
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  /** Reads the current window without recording a hit. */
  check(key: string, limit: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

interface Window {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, Window>();

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowSeconds * 1000;
      this.windows.set(key, { count: 1, resetAt });
      this.sweep(now);
      return { allowed: true, remaining: limit - 1, resetAt: new Date(resetAt) };
    }

    existing.count += 1;
    return {
      allowed: existing.count <= limit,
      remaining: Math.max(0, limit - existing.count),
      resetAt: new Date(existing.resetAt),
    };
  }

  async check(key: string, limit: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      return { allowed: true, remaining: limit, resetAt: new Date(now) };
    }
    return {
      allowed: existing.count <= limit,
      remaining: Math.max(0, limit - existing.count),
      resetAt: new Date(existing.resetAt),
    };
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }

  /** Expired windows are dropped opportunistically; there is no timer to leak. */
  private sweep(now: number): void {
    if (this.windows.size < 1_000) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

const globalForLimiter = globalThis as unknown as { rateLimiter?: RateLimiter };

export const rateLimiter: RateLimiter = (globalForLimiter.rateLimiter ??=
  new InMemoryRateLimiter());

/** Exported for tests, which need a limiter that does not share state with the app. */
export function createInMemoryRateLimiter(): RateLimiter {
  return new InMemoryRateLimiter();
}
