// Envoi immédiat d'un message Wallet — POST /api/notifications/send (web :
// même route, même corps, même réponse). Le serveur borne l'audience au
// marchand du jeton et journalise l'envoi ; l'app ne fait que transmettre.
//
//   corps    : { title, body, audience }   audience ∈ AUDIENCE_KEYS ("all" par défaut)
//   réponse  : { pushed, reachable }
//   erreurs  : 400 (titre/message vides, audience inconnue), 401, 403 (essai
//              expiré : envois en pause), 429 (10 envois / heure par commerce)

import { api, type ApiClient } from "@/lib/api";

import type { AudienceKey, MessageDraft, SendResult } from "./model";

export async function sendMessage(
  payload: MessageDraft & { audience: AudienceKey },
  client: ApiClient = api(),
): Promise<SendResult> {
  const res = await client.post<Partial<SendResult> | null>("/api/notifications/send", payload);
  return { pushed: res?.pushed ?? 0, reachable: res?.reachable ?? 0 };
}
