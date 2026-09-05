// Logique PURE de l'onglet Messages : audiences (mêmes clés que le web),
// taille lue dans le résumé serveur, validation du formulaire et texte de
// confirmation — copie conforme des règles de `MessagesView.tsx` (web).

import {
  STAGE_KEYS,
  STAGE_LABELS,
  type SegmentSummary,
  type StageKey,
} from "@/features/clients/contracts";

export type AudienceKey = StageKey | "recompense_prete" | "all";

export const AUDIENCE_KEYS: readonly AudienceKey[] = [...STAGE_KEYS, "recompense_prete", "all"];

export function audienceLabel(a: AudienceKey): string {
  if (a === "all") return "Tous mes clients";
  if (a === "recompense_prete") return "Récompense prête";
  return STAGE_LABELS[a];
}

/** Taille d'une audience d'après le résumé serveur ; null tant qu'il n'est pas chargé. */
export function audienceSize(summary: SegmentSummary | null, a: AudienceKey): number | null {
  if (!summary) return null;
  if (a === "all") return summary.total;
  if (a === "recompense_prete") return summary.flags.recompense_prete;
  return summary.stages[a]?.count ?? 0;
}

export type MessageDraft = { title: string; body: string };
export type MessageErrors = Partial<Record<keyof MessageDraft, string>>;

export type ValidatedMessage =
  | { ok: true; value: MessageDraft }
  | { ok: false; errors: MessageErrors };

export function validateMessage(draft: MessageDraft): ValidatedMessage {
  const title = draft.title.trim();
  const body = draft.body.trim();
  const errors: MessageErrors = {};
  if (!title) errors.title = "Donnez un titre à votre message.";
  if (!body) errors.body = "Écrivez votre message.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, body } };
}

/** Réponse de POST /api/notifications/send. */
export type SendResult = { pushed: number; reachable: number };

export type ResultMessage = { tone: "success" | "warning"; text: string };

export function sendResultMessage(r: SendResult): ResultMessage {
  if (r.pushed === 0) {
    return {
      tone: "warning",
      text: "Aucun client ne peut encore recevoir de message : dès qu'ils ajoutent leur carte, ils le recevront.",
    };
  }
  const clients = `${r.pushed} client${r.pushed > 1 ? "s" : ""}`;
  const cards = r.reachable > 1
    ? `${r.reachable} ont la carte dans leur téléphone`
    : `${r.reachable} a la carte dans son téléphone`;
  return { tone: "success", text: `Message envoyé à ${clients}. (${cards}.)` };
}
