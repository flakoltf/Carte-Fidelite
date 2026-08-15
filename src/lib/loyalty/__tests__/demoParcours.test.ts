import { describe, expect, it } from "vitest";
import { buildPassJson, type PassJson } from "@/lib/wallet/passJson";
import { identityFromMerchant } from "@/lib/wallet/identityFromMerchant";
import { googleIdentityModules } from "@/lib/wallet/googleIdentity";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { applyScan, currentTier, programCanRedeem, initialStampsForEnroll } from "@/lib/loyalty/engine";
import { applyStamp, canRedeem } from "@/lib/loyalty/stamp";
import { revertSecondsLeft, revertStatusMessage, REVERT_WINDOW_SECONDS } from "@/lib/loyalty/revert";
import { shouldShowReview, reviewUrlFor, isValidPlaceId } from "@/lib/wallet/googleReview";

// ════════════════════════════════════════════════════════════════════════════
//  PARCOURS DE DÉMO GENÈVE — filet anti-régression
// ════════════════════════════════════════════════════════════════════════════
// Ce fichier se lit comme le SCRIPT qu'on déroule devant un commerçant. Il
// compose les fonctions PURES réelles (zéro réseau) de bout en bout, pour
// qu'aucune régression silencieuse ne casse la boucle qu'on montre.
//
// Couverture (état du code sur main) :
//   ✅ Scène 2  identité « carte vivante » (récompense + horaires + adresse + tél)
//   ✅ Scène 3  enrôlement → carte à 0
//   ✅ Scène 4  scans → déblocage de la récompense (3 mécaniques)
//   ✅ Scène 5  bords : cooldown, plafond, fenêtre d'annulation 5 min
//   ✅ Scène 6  lien « Avis Google » (F2/#18, mergé) — apparaît/disparaît
//   ✅ F3 tampon de bienvenue + récompense intermédiaire (#22, mergé)
//   ↪ Scène 1 (marchand concierge cohérent, #21) : couverte par le test de route
//     src/app/api/admin/merchants/__tests__/createMerchant.test.ts (logique de
//     handler, pas une fonction pure — pas dupliquée ici).

// Le marchand de démo : Café du Rhône, carte « 10 cafés = 1 offert ».
const CAFE_DU_RHONE = {
  reward_label: "Le 10e café offert",
  address: "Rue du Rhône 1, 1204 Genève",
  phone: "+41 22 555 00 00",
  latitude: 46.2044,
  longitude: 6.1432,
  business_hours: {
    mon: { open: "07:00", close: "19:00" },
    tue: { open: "07:00", close: "19:00" },
    wed: { open: "07:00", close: "19:00" },
    thu: { open: "07:00", close: "19:00" },
    fri: { open: "07:00", close: "19:00" },
    sat: { open: "08:00", close: "18:00" },
    sun: null,
  },
};
// Un lundi à 10:00 (Europe/Zurich) → la carte doit afficher « 07:00 – 19:00 ».
const LUNDI_10H = new Date("2026-06-15T08:00:00Z");

function backField(pass: PassJson, key: string) {
  return pass.storeCard.backFields.find((f) => f.key === key);
}

describe("Parcours démo Genève — Scène 2 : la carte vivante porte l'identité du commerce", () => {
  const identity = identityFromMerchant(CAFE_DU_RHONE, LUNDI_10H);

  it("identité dérivée de la ligne merchants : récompense, horaires du jour, adresse, tél, itinéraire", () => {
    expect(identity.rewardLabel).toBe("Le 10e café offert");
    expect(identity.todaysHours).toBe("07:00 – 19:00");
    expect(identity.address).toBe("Rue du Rhône 1, 1204 Genève");
    expect(identity.phone).toBe("+41 22 555 00 00");
    expect(identity.mapsUrl).toContain("46.2044,6.1432"); // coordonnées prioritaires
  });

  it("Apple : la récompense est en face, horaires/adresse/tél tappables au dos", () => {
    const pass = buildPassJson({
      cardId: "card-demo-1",
      customerName: "Nadia",
      stamps: 3,
      stampGoal: 10,
      orgName: "Café du Rhône",
      backgroundColor: "rgb(13, 107, 94)",
      passTypeIdentifier: "pass.test",
      teamIdentifier: "TEAM",
      barcodeMessage: "qr",
      identity,
    });
    expect(pass.storeCard.secondaryFields.find((f) => f.key === "reward")?.value).toBe("Le 10e café offert");
    expect(backField(pass, "hours")?.value).toBe("07:00 – 19:00");
    expect(backField(pass, "address")?.value).toBe("Rue du Rhône 1, 1204 Genève");
    expect(backField(pass, "phone")?.value).toBe("+41 22 555 00 00");
    expect(pass.storeCard.backFields.length).toBeLessThanOrEqual(10); // garde-fou Apple
  });

  it("Google : MÊME identité côté objet (textModules récompense/horaires + links itinéraire/appel)", () => {
    const mods = googleIdentityModules(identity);
    expect(mods.textModulesData).toEqual([
      { id: "reward", header: "Récompense", body: "Le 10e café offert" },
      { id: "hours", header: "Aujourd'hui", body: "07:00 – 19:00" },
    ]);
    const uris = mods.linksModuleData?.uris ?? [];
    expect(uris.find((u) => u.id === "phone")?.uri).toBe("tel:+41225550000"); // espaces retirés
    expect(uris.find((u) => u.id === "maps")?.uri).toContain("46.2044,6.1432");
  });
});

describe("Parcours démo Genève — Scènes 3→5 : tampons & récompense (carte à tampons)", () => {
  // Café du Rhône : programme par défaut, objectif 10.
  const program = resolveLoyaltyProgram({ loyalty_type: "stamp_card", loyalty_config: { goal: 10 }, stamp_goal: 10 });

  it("Scène 3 — enrôlement : la carte démarre à 0, rien de débloqué", () => {
    expect(canRedeem(0, 10)).toBe(false);
    expect(programCanRedeem(program, 0)).toBe(false);
  });

  it("Scène 4 — 9 premiers scans : on avance, jamais de récompense avant le palier", () => {
    let count = 0;
    for (let i = 1; i <= 9; i++) {
      const r = applyScan(program, count);
      expect(r.added).toBe(true);
      expect(r.rewardReady).toBe(false);
      expect(r.events).toEqual([]);
      count = r.newCount;
    }
    expect(count).toBe(9);
  });

  it("Scène 4 — le 10e scan débloque la récompense (event reward_ready)", () => {
    const r = applyScan(program, 9);
    expect(r.newCount).toBe(10);
    expect(r.added).toBe(true);
    expect(r.rewardReady).toBe(true);
    expect(r.events).toEqual([{ kind: "reward_ready" }]);
    expect(canRedeem(10, 10)).toBe(true);
    expect(programCanRedeem(program, 10)).toBe(true);
  });

  it("Scène 5 (bord) — carte PLEINE rescannée : récompense prête, AUCUN tampon ajouté", () => {
    const r = applyStamp(10, 10);
    expect(r.added).toBe(false);
    expect(r.rewardReady).toBe(true);
    expect(r.newStamps).toBe(10); // pas de 11e tampon
  });

  it("Scène 5 (bord) — annulation d'un tampon : fenêtre de 5 minutes, puis trop tard", () => {
    const scanAt = "2026-06-15T10:00:00Z";
    const within = new Date("2026-06-15T10:04:00Z"); // 4 min → encore annulable
    const after = new Date("2026-06-15T10:06:00Z"); // 6 min → expiré
    expect(REVERT_WINDOW_SECONDS).toBe(300);
    expect(revertSecondsLeft(scanAt, within)).toBe(60); // 1 min restante
    expect(revertSecondsLeft(scanAt, after)).toBe(0);
    expect(revertStatusMessage("reverted")).toContain("annulé");
    expect(revertStatusMessage("expired")).toContain("5 minutes");
  });
});

describe("Parcours démo Genève — les 3 mécaniques de fidélité", () => {
  it("stamp_card : récompense pile au palier, plafonnée ensuite", () => {
    const p = resolveLoyaltyProgram({ loyalty_type: "stamp_card", loyalty_config: { goal: 5 }, stamp_goal: 5 });
    expect(applyScan(p, 4).rewardReady).toBe(true);
    expect(applyScan(p, 4).events).toEqual([{ kind: "reward_ready" }]);
    expect(programCanRedeem(p, 5)).toBe(true);
  });

  it("visit_based : un palier intermédiaire est atteint exactement à chaque milestone", () => {
    const p = resolveLoyaltyProgram({
      loyalty_type: "visit_based",
      loyalty_config: { milestones: [5, 10] },
      stamp_goal: null,
    });
    // 4 → 5 : milestone atteint.
    const atFive = applyScan(p, 4);
    expect(atFive.rewardReady).toBe(true);
    expect(atFive.events).toEqual([{ kind: "milestone_reached", at: 5 }]);
    // 5 → 6 : entre deux paliers, on avance sans récompense.
    const atSix = applyScan(p, 5);
    expect(atSix.rewardReady).toBe(false);
    expect(atSix.events).toEqual([]);
    // visit_based ne « se rachète » pas comme une carte à tampons.
    expect(programCanRedeem(p, 10)).toBe(false);
  });

  it("tiered : on change de niveau au seuil, jamais de reward_ready", () => {
    const p = resolveLoyaltyProgram({
      loyalty_type: "tiered",
      loyalty_config: { tiers: [{ name: "Argent", at: 1 }, { name: "Or", at: 10 }] },
      stamp_goal: null,
    });
    expect(currentTier([{ name: "Argent", at: 1 }, { name: "Or", at: 10 }], 9)?.name).toBe("Argent");
    const promote = applyScan(p, 9); // 9 → 10 : passe Or
    expect(promote.events).toEqual([{ kind: "tier_changed", name: "Or" }]);
    expect(promote.rewardReady).toBe(false);
    const within = applyScan(p, 10); // 10 → 11 : reste Or, pas d'event
    expect(within.events).toEqual([]);
    expect(programCanRedeem(p, 99)).toBe(false); // pas de « rachat » en tiered
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Scène 6 — lien « Avis Google » au moment magique (F2/#18, mergé sur main)
// ────────────────────────────────────────────────────────────────────────────
describe("Parcours démo Genève — Scène 6 : lien « Avis Google » au déblocage", () => {
  // Place ID Google au format documenté (ChIJ…). Exemple, pas un lieu réel.
  const PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";
  const program = resolveLoyaltyProgram({ loyalty_type: "stamp_card", loyalty_config: { goal: 10 }, stamp_goal: 10 });

  it("apparaît quand la récompense est débloquée ET un place id est configuré", () => {
    const r = applyScan(program, 9); // 10e tampon → reward-ready
    expect(r.rewardReady).toBe(true);
    expect(shouldShowReview(r.rewardReady, PLACE_ID)).toBe(true);
    expect(reviewUrlFor(PLACE_ID)).toBe(
      `https://search.google.com/local/writereview?placeid=${PLACE_ID}`,
    );
  });

  it("disparaît au scan suivant (carte encaissée → repart à 0, plus reward-ready)", () => {
    const next = applyScan(program, 0); // 1er tampon de la nouvelle carte
    expect(next.rewardReady).toBe(false);
    expect(shouldShowReview(next.rewardReady, PLACE_ID)).toBe(false);
  });

  it("(bord) google_place_id absent ou invalide → aucun lien avis, même reward-ready", () => {
    expect(shouldShowReview(true, null)).toBe(false);
    expect(shouldShowReview(true, "")).toBe(false);
    expect(shouldShowReview(true, "pas-un-place-id")).toBe(false);
    expect(reviewUrlFor(null)).toBeNull();
    expect(isValidPlaceId(PLACE_ID)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// F3 — tampon de bienvenue + récompense intermédiaire (carte à tampons, #22)
// ────────────────────────────────────────────────────────────────────────────
describe("Parcours démo Genève — F3 : tampon de bienvenue + récompense intermédiaire", () => {
  it("tampon de bienvenue : la carte démarre à 1 si welcome_stamps=1, sinon 0", () => {
    const withWelcome = resolveLoyaltyProgram({ loyalty_type: "stamp_card", loyalty_config: { goal: 10, welcome_stamps: 1 }, stamp_goal: 10 });
    const without = resolveLoyaltyProgram({ loyalty_type: "stamp_card", loyalty_config: { goal: 10 }, stamp_goal: 10 });
    expect(initialStampsForEnroll(withWelcome)).toBe(1);
    expect(initialStampsForEnroll(without)).toBe(0);
  });

  it("récompense intermédiaire : event intermediate_reward_ready pile au palier, jamais avec reward_ready", () => {
    const p = resolveLoyaltyProgram({ loyalty_type: "stamp_card", loyalty_config: { goal: 10, intermediate_milestone: 5 }, stamp_goal: 10 });
    // 4 → 5 : palier intermédiaire atteint (5 < 10 → pas de reward_ready).
    const atMid = applyScan(p, 4);
    expect(atMid.rewardReady).toBe(false);
    expect(atMid.events).toEqual([{ kind: "intermediate_reward_ready" }]);
    // 5 → 6 : entre les paliers, aucun event.
    expect(applyScan(p, 5).events).toEqual([]);
    // 9 → 10 : récompense finale seule (pas d'intermédiaire en même temps).
    const atGoal = applyScan(p, 9);
    expect(atGoal.rewardReady).toBe(true);
    expect(atGoal.events).toEqual([{ kind: "reward_ready" }]);
  });
});
