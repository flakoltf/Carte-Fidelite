import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de GET /api/merchant/me — le maillon entre le dashboard et la
// résolution de tenant. Vérifie :
//  - sous impersonation (currentMerchantId = marchand cible), la réponse porte
//    bien le slug du marchand cible (le dashboard peut afficher le QR) ;
//  - non authentifié → 401 JSON (le client le distingue de « vide ») ;
//  - exception interne → 500 JSON stable, jamais de throw nu.

const state = {
  merchantId: null as string | null,
  row: null as Record<string, unknown> | null,
  throwOnSelect: false,
};

const calls = { selectedIds: [] as string[] };

vi.mock("@/lib/analytics/merchant", () => ({
  currentMerchantId: async () => state.merchantId,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => {
            calls.selectedIds.push(id);
            if (state.throwOnSelect) throw new Error("db down");
            return { data: state.row, error: null };
          },
        }),
      }),
    }),
  },
}));

import { GET } from "@/app/api/merchant/me/route";

beforeEach(() => {
  state.merchantId = null;
  state.row = null;
  state.throwOnSelect = false;
  calls.selectedIds = [];
});

describe("GET /api/merchant/me", () => {
  it("sous impersonation → 200 avec le slug du marchand cible", async () => {
    state.merchantId = "merchant-cible";
    state.row = { id: "merchant-cible", shop_name: "Boulangerie du Dimanche", slug: "boulangerie-du-dimanche" };

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.merchant.slug).toBe("boulangerie-du-dimanche");
    // La sélection a bien ciblé le marchand effectif (impersonation honorée).
    expect(calls.selectedIds).toEqual(["merchant-cible"]);
  });

  it("non authentifié (currentMerchantId null) → 401 JSON", async () => {
    state.merchantId = null;
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(body).not.toHaveProperty("merchant");
    expect(calls.selectedIds).toHaveLength(0);
  });

  it("exception interne → 500 JSON stable (jamais de throw nu)", async () => {
    state.merchantId = "merchant-cible";
    state.throwOnSelect = true;
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
