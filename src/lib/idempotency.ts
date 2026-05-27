import { redis } from "./redis";

const TTL_SECONDS = 86400; // 24h

export async function checkIdempotency(key: string): Promise<unknown | null> {
  const value = await redis.get(`idem:${key}`);
  return value ?? null;
}

export async function setIdempotency(key: string, response: unknown): Promise<void> {
  await redis.set(`idem:${key}`, response, { ex: TTL_SECONDS });
}
