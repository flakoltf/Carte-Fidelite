import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

const limiters = new Map<string, Ratelimit>();

function getLimiter(prefix: string, limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${prefix}:${limit}:${windowMs}`;
  const cached = limiters.get(cacheKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    prefix: `rl:${prefix}`,
    analytics: true,
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

export async function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000
): Promise<{ success: boolean; remaining: number }> {
  const [prefix] = key.split(":");
  const limiter = getLimiter(prefix || "default", limit, windowMs);
  const { success, remaining } = await limiter.limit(key);
  return { success, remaining };
}
