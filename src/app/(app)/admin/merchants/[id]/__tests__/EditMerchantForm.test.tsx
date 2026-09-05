// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EditMerchantForm from "../EditMerchantForm";

// Fiche admin — programme de fidélité (bugs n°1 et n°2 de l'audit PR #78) :
//  - les 5 mécaniques du moteur sont dans le select (« points » manquait :
//    sauvegarder la fiche d'un marchand points envoyait { goal } → 400) ;
//  - un panneau de règles par type, validé par le moteur (validateProgramRules
//    → validateLoyaltyProgram), et qui ROUND-TRIPPE toutes les clés de
//    loyalty_config : une sauvegarde admin ne perd plus welcome_stamps,
//    intermediate_milestone, maxPointsPerScan, statusTiers, expiration.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const BASE = {
  id: "22222222-2222-4222-8222-222222222222",
  shopName: "Café du Rhône",
  primaryColor: "#0D6B5E",
  logoUrl: null,
  stampGoal: 10,
  scanCooldownSeconds: 0,
  businessType: "cafe",
  thresholds: { activeDays: 30, atRiskDays: 90, vipVisits: 10, newTenureDays: 30 },
  address: null,
};

function renderForm(loyaltyType: string, loyaltyConfig: Record<string, unknown> | null) {
  render(<EditMerchantForm merchant={{ ...BASE, loyaltyType: loyaltyType as never, loyaltyConfig }} />);
}

async function save(): Promise<Record<string, unknown>> {
  fireEvent.click(screen.getByRole("button", { name: /^enregistrer$/i }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body);
}

const typeSelect = () => screen.getByRole("combobox", { name: /type de programme/i }) as HTMLSelectElement;

describe("EditMerchantForm — select des mécaniques (bug n°2)", () => {
  it("propose les 5 mécaniques du moteur, « points » compris", () => {
    renderForm("stamp_card", { goal: 10 });
    const values = Array.from(typeSelect().options).map((o) => o.value).sort();
    expect(values).toEqual(["amount_points", "points", "stamp_card", "tiered", "visit_based"]);
  });

  it("marchand « points » : la fiche se charge sur points et la sauvegarde envoie la config points (jamais { goal })", async () => {
    renderForm("points", {
      pointsPerScan: 10,
      tiers: [{ threshold: 100, reward: "Un café" }],
      expiration: { type: "rolling", months: 12 },
      statusTiers: [{ threshold: 0, label: "Bronze" }, { threshold: 500, label: "Or", benefit: "-10 %" }],
    });
    expect(typeSelect().value).toBe("points");
    const body = await save();
    expect(body.loyaltyType).toBe("points");
    expect(body.loyaltyConfig).toEqual({
      pointsPerScan: 10,
      tiers: [{ threshold: 100, reward: "Un café" }],
      expiration: { type: "rolling", months: 12 },
      statusTiers: [{ threshold: 0, label: "Bronze" }, { threshold: 500, label: "Or", benefit: "-10 %" }],
    });
    expect(body.loyaltyConfig).not.toHaveProperty("goal");
  });
});

describe("EditMerchantForm — round-trip des options (bug n°1, côté fiche)", () => {
  it("stamp_card : welcome_stamps et intermediate_milestone sont affichés ET renvoyés tels quels", async () => {
    renderForm("stamp_card", { goal: 10, welcome_stamps: 1, intermediate_milestone: 5 });
    expect((screen.getByRole("checkbox", { name: /tampon de bienvenue/i }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("combobox", { name: /récompense intermédiaire/i }) as HTMLSelectElement).value).toBe("5");
    const body = await save();
    expect(body.loyaltyConfig).toEqual({ goal: 10, welcome_stamps: 1, intermediate_milestone: 5 });
  });

  it("stamp_card : l'admin peut poser ces options (case + palier) — elles partent dans la sauvegarde", async () => {
    renderForm("stamp_card", { goal: 10 });
    fireEvent.click(screen.getByRole("checkbox", { name: /tampon de bienvenue/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /récompense intermédiaire/i }), { target: { value: "4" } });
    const body = await save();
    expect(body.loyaltyConfig).toEqual({ goal: 10, welcome_stamps: 1, intermediate_milestone: 4 });
  });

  it("amount_points : maxPointsPerScan est affiché et renvoyé", async () => {
    renderForm("amount_points", { type: "amount_points", pointsPerChf: 2, rewardThreshold: 150, rewardLabel: "Un dessert", maxPointsPerScan: 300 });
    expect((screen.getByRole("spinbutton", { name: /plafond de points/i }) as HTMLInputElement).value).toBe("300");
    const body = await save();
    expect(body.loyaltyType).toBe("amount_points");
    expect(body.loyaltyConfig).toMatchObject({ pointsPerChf: 2, rewardThreshold: 150, rewardLabel: "Un dessert", maxPointsPerScan: 300 });
  });

  it("visit_based et tiered : paliers / niveaux existants renvoyés tels quels", async () => {
    renderForm("visit_based", { milestones: [5, 20, 50] });
    expect((await save()).loyaltyConfig).toEqual({ milestones: [5, 20, 50] });
    cleanup();
    fetchMock.mockClear();
    renderForm("tiered", { tiers: [{ name: "Argent", at: 5 }, { name: "Or", at: 20 }] });
    expect((await save()).loyaltyConfig).toEqual({ tiers: [{ name: "Argent", at: 5 }, { name: "Or", at: 20 }] });
  });
});

describe("EditMerchantForm — objectif et récompense intermédiaire", () => {
  it("l'objectif affiché est celui du moteur (loyalty_config.goal), pas la colonne stamp_goal qui peut avoir dérivé", async () => {
    // stamp_goal = 10 (BASE) mais loyalty_config.goal = 4 : le moteur applique 4.
    renderForm("stamp_card", { goal: 4 });
    const goal = screen.getByRole("spinbutton", { name: /objectif carte/i }) as HTMLInputElement;
    expect(goal.value).toBe("4");
    // Palier strictement entre 1 et l'objectif → 2 et 3 seulement (+ « Aucune »).
    const options = Array.from(
      (screen.getByRole("combobox", { name: /récompense intermédiaire/i }) as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toEqual(["", "2", "3"]);
  });

  it("baisser l'objectif sous un palier existant affiche l'erreur du moteur (aucune sauvegarde)", async () => {
    renderForm("stamp_card", { goal: 10, intermediate_milestone: 8 });
    fireEvent.change(screen.getByRole("spinbutton", { name: /objectif carte/i }), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: /^enregistrer$/i }));
    expect((await screen.findAllByText(/récompense intermédiaire/i)).length).toBeGreaterThanOrEqual(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("l'objectif modifié part dans la sauvegarde", async () => {
    renderForm("stamp_card", { goal: 10, welcome_stamps: 1 });
    fireEvent.change(screen.getByRole("spinbutton", { name: /objectif carte/i }), { target: { value: "12" } });
    const body = await save();
    expect(body.loyaltyConfig).toEqual({ goal: 12, welcome_stamps: 1 });
    expect(body.stampGoal).toBe(12);
  });
});

describe("EditMerchantForm — validation par le moteur (aucune règle dupliquée)", () => {
  it("niveaux non croissants → message du moteur affiché, aucune requête", async () => {
    renderForm("tiered", { tiers: [{ name: "Argent", at: 5 }, { name: "Or", at: 20 }] });
    fireEvent.change(screen.getByRole("spinbutton", { name: /seuil du niveau 2/i }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /^enregistrer$/i }));
    // Message du moteur, en direct sous le panneau ET dans le bandeau d'erreur.
    expect((await screen.findAllByText(/strictement croissants/i)).length).toBeGreaterThanOrEqual(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("changer de mécanique charge les règles par défaut du moteur, revenir au type d'origine restaure la config du marchand", async () => {
    renderForm("stamp_card", { goal: 10, welcome_stamps: 1, intermediate_milestone: 5 });
    fireEvent.change(typeSelect(), { target: { value: "visit_based" } });
    expect(screen.getByRole("spinbutton", { name: /palier 1/i })).toBeTruthy();
    fireEvent.change(typeSelect(), { target: { value: "stamp_card" } });
    expect((screen.getByRole("checkbox", { name: /tampon de bienvenue/i }) as HTMLInputElement).checked).toBe(true);
    const body = await save();
    expect(body.loyaltyConfig).toEqual({ goal: 10, welcome_stamps: 1, intermediate_milestone: 5 });
  });
});
