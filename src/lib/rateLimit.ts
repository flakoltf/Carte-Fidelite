type RateLimitStore = Record<string, { count: number; resetTime: number }>;

const store: RateLimitStore = {};

export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000 // 1 minute
): { success: boolean; remaining: number } {
  const now = Date.now();
  const record = store[key];

  if (!record || now >= record.resetTime) {
    store[key] = { count: 1, resetTime: now + windowMs };
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: limit - record.count };
}

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (now >= store[key].resetTime) {
      delete store[key];
    }
  }
}, 3600000);
