/**
 * In-memory rate limiting for login and mutating endpoints. Correct for a single
 * instance; swap for Redis behind this same interface if deployment grows multi-instance.
 */
class InMemoryRateLimiter {
  windows = new Map();

  async consume(key, limit, windowSeconds) {
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

  async check(key, limit) {
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

  async reset(key) {
    this.windows.delete(key);
  }

  sweep(now) {
    if (this.windows.size < 1000) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

const globalForLimiter = globalThis;

export const rateLimiter = (globalForLimiter.__rateLimiter ??= new InMemoryRateLimiter());

export function createInMemoryRateLimiter() {
  return new InMemoryRateLimiter();
}
