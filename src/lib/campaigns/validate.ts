import { isAudienceKey } from "@/lib/segments/audience";
import type { CampaignInput, ValidatedCampaign } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ValidateResult =
  | { ok: true; value: ValidatedCampaign }
  | { ok: false; error: string };

export function validateCampaignInput(input: CampaignInput): ValidateResult {
  const audience = input.audience;
  if (typeof audience !== "string" || !isAudienceKey(audience))
    return { ok: false, error: "Audience invalide" };

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!title || !body) return { ok: false, error: "Titre et message requis" };

  if (input.mode !== "once" && input.mode !== "recurring")
    return { ok: false, error: "Mode invalide" };

  if (input.mode === "once") {
    const runOn = input.runOn;
    if (typeof runOn !== "string" || !DATE_RE.test(runOn))
      return { ok: false, error: "Date d'envoi invalide" };
    return { ok: true, value: { audience, title, body, mode: "once", runOn, cooldownDays: 30 } };
  }

  const cd = input.cooldownDays;
  const cooldownDays = cd === undefined ? 30 : cd;
  if (typeof cooldownDays !== "number" || !Number.isInteger(cooldownDays) || cooldownDays < 1)
    return { ok: false, error: "Cooldown invalide" };
  return { ok: true, value: { audience, title, body, mode: "recurring", runOn: null, cooldownDays } };
}
