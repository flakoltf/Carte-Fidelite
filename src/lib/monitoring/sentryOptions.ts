// Options Sentry partagées (serveur, edge, client).
// Sûr par défaut : si aucun DSN n'est défini, `enabled:false` => Sentry est un
// no-op complet (rien n'est envoyé, aucun plantage en dev / build).
import { scrubSentryEvent } from "./scrub";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

/** Passe chaque événement par le nettoyeur PII avant envoi. Typé de façon générique
 *  pour s'adapter à la signature `beforeSend` du SDK. */
export function scrubBeforeSend<E>(event: E): E {
  return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as E;
}

export const baseSentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  tracesSampleRate: 0.1,
  beforeSend: scrubBeforeSend,
};
