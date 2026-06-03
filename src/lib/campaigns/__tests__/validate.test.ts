import { describe, it, expect } from "vitest";
import { validateCampaignInput } from "../validate";

describe("validateCampaignInput", () => {
  const base = { audience: "inactif", title: "Coucou", body: "Revenez !" };

  it("accepte une campagne 'once' valide et normalise", () => {
    const r = validateCampaignInput({ ...base, mode: "once", runOn: "2026-06-14" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        audience: "inactif", title: "Coucou", body: "Revenez !",
        mode: "once", runOn: "2026-06-14", cooldownDays: 30,
      });
    }
  });

  it("accepte une campagne 'recurring' et applique le cooldown par défaut 30", () => {
    const r = validateCampaignInput({ ...base, mode: "recurring" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ mode: "recurring", runOn: null, cooldownDays: 30 });
  });

  it("respecte un cooldown explicite pour 'recurring'", () => {
    const r = validateCampaignInput({ ...base, mode: "recurring", cooldownDays: 7 });
    expect(r.ok && r.value.cooldownDays).toBe(7);
  });

  it("rejette une audience inconnue", () => {
    const r = validateCampaignInput({ ...base, mode: "once", runOn: "2026-06-14", audience: "vips" });
    expect(r).toEqual({ ok: false, error: "Audience invalide" });
  });

  it("rejette un message vide", () => {
    const r = validateCampaignInput({ ...base, body: "   ", mode: "recurring" });
    expect(r).toEqual({ ok: false, error: "Titre et message requis" });
  });

  it("rejette un mode inconnu", () => {
    const r = validateCampaignInput({ ...base, mode: "tous_les_lundis" });
    expect(r).toEqual({ ok: false, error: "Mode invalide" });
  });

  it("rejette 'once' sans date valide", () => {
    const r = validateCampaignInput({ ...base, mode: "once", runOn: "14/06/2026" });
    expect(r).toEqual({ ok: false, error: "Date d'envoi invalide" });
  });

  it("rejette un cooldown < 1 pour 'recurring'", () => {
    const r = validateCampaignInput({ ...base, mode: "recurring", cooldownDays: 0 });
    expect(r).toEqual({ ok: false, error: "Cooldown invalide" });
  });
});
