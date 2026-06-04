// Nettoyage des événements Sentry avant envoi (relie I2 monitoring + I3 RGPD).
// Retire les en-têtes/secrets et masque les données perso pour ne jamais les
// exfiltrer vers le monitoring. Branché dans `beforeSend` des configs Sentry.
import { redactPII } from "@/lib/log/mask";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-csrf-token",
]);

type EventLike = Record<string, unknown>;

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function scrubSentryEvent<T extends EventLike | null | undefined>(event: T): T {
  if (!event) return event;
  const out: Record<string, unknown> = { ...event };

  const request = asObject(out.request);
  if (request) {
    const req = { ...request };
    const headers = asObject(req.headers);
    if (headers) {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(headers)) {
        if (!SENSITIVE_HEADERS.has(k.toLowerCase())) clean[k] = v;
      }
      req.headers = clean;
    }
    delete req.cookies;
    out.request = req;
  }

  if (asObject(out.user)) out.user = redactPII(out.user);
  if (asObject(out.extra)) out.extra = redactPII(out.extra);
  if (asObject(out.contexts)) out.contexts = redactPII(out.contexts);

  return out as T;
}
