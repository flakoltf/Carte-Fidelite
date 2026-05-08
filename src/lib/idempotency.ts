type IdempotencyRecord = {
  timestamp: number;
  response: any;
};

const store: Record<string, IdempotencyRecord> = {};
const TTL = 86400000; // 24 heures

export function checkIdempotency(key: string): any | null {
  const record = store[key];
  if (!record || Date.now() - record.timestamp > TTL) {
    return null;
  }
  return record.response;
}

export function setIdempotency(key: string, response: any) {
  store[key] = { response, timestamp: Date.now() };
}

// Cleanup old entries every 6 hours
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (now - store[key].timestamp > TTL) {
      delete store[key];
    }
  }
}, 21600000);
