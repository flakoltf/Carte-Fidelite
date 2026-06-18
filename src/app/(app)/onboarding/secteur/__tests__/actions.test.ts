import { beforeEach, describe, expect, it, vi } from "vitest";

// Action serveur de l'étape 0. On ne touche pas Postgres : on mocke
// currentMerchantId + supabaseAdmin + cookies + redirect + audit, et on prouve
// (1) la tenancy (`.eq("id", merchantId)`), (2) la pose du cookie HTTP-only,
// (3) l'erreur typée sur secteur inconnu / session expirée, (4) la redirection.
// redirect() lève (comme le vrai Next) → on l'attrape pour inspecter les effets.

const state = {
  merchantId: "merchant-1" as string | null,
  updateError: null as { code?: string; message: string } | null,
};
const calls = {
  update: [] as { table: string; patch: Record<string, unknown> }[],
  eq: [] as { col: string; val: unknown }[],
  cookieSet: [] as { name: string; value: string; opts: Record<string, unknown> }[],
  cookieDelete: [] as string[],
  audit: [] as Record<string, unknown>[],
  redirect: [] as string[],
};

vi.mock("@/lib/auth/currentMerchant", () => ({
  currentMerchantId: async () => state.merchantId,
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => {
        calls.update.push({ table, patch });
        return {
          eq: async (col: string, val: unknown) => {
            calls.eq.push({ col, val });
            return { error: state.updateError };
          },
        };
      },
    }),
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, opts: Record<string, unknown>) =>
      calls.cookieSet.push({ name, value, opts }),
    delete: (name: string) => calls.cookieDelete.push(name),
    get: () => undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    calls.redirect.push(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Record<string, unknown>) => {
    calls.audit.push(e);
  },
}));

import { selectSector, skipSector } from "../actions";
import { SECTOR_DRAFT_COOKIE, parseSectorDraft } from "@/lib/onboarding/sectorSelection";

beforeEach(() => {
  state.merchantId = "merchant-1";
  state.updateError = null;
  calls.update.length = 0;
  calls.eq.length = 0;
  calls.cookieSet.length = 0;
  calls.cookieDelete.length = 0;
  calls.audit.length = 0;
  calls.redirect.length = 0;
});

describe("selectSector — succès", () => {
  it("persiste la mécanique, pose le cookie, audite et redirige vers /onboarding", async () => {
    await expect(selectSector("cafe")).rejects.toThrow("NEXT_REDIRECT:/onboarding");

    // Persistance mécanique sur merchants.
    expect(calls.update).toHaveLength(1);
    expect(calls.update[0].table).toBe("merchants");
    expect(calls.update[0].patch.loyalty_type).toBe("stamp_card");
    expect(calls.update[0].patch.stamp_goal).toBe(10);

    // Tenancy (invariant n°3) : borné au tenant courant.
    expect(calls.eq).toEqual([{ col: "id", val: "merchant-1" }]);

    // Cookie HTTP-only avec un brouillon relisible.
    expect(calls.cookieSet).toHaveLength(1);
    const cookie = calls.cookieSet[0];
    expect(cookie.name).toBe(SECTOR_DRAFT_COOKIE);
    expect(cookie.opts.httpOnly).toBe(true);
    expect(cookie.opts.sameSite).toBe("lax");
    expect(cookie.opts.path).toBe("/onboarding");
    expect(parseSectorDraft(cookie.value)?.sector).toBe("cafe");

    // Audit via l'action canonique (pas de nouvelle AuditAction).
    expect(calls.audit).toHaveLength(1);
    expect(calls.audit[0].action).toBe("MERCHANT_UPDATED");
    expect(calls.audit[0].merchant_id).toBe("merchant-1");
  });

  it("retail (tiered) : pas de stamp_goal écrit", async () => {
    await expect(selectSector("retail")).rejects.toThrow("NEXT_REDIRECT:/onboarding");
    expect(calls.update[0].patch.loyalty_type).toBe("tiered");
    expect(calls.update[0].patch.stamp_goal).toBeUndefined();
  });
});

describe("selectSector — erreurs typées (aucune écriture)", () => {
  it("secteur inconnu → { error }, ni write ni cookie ni redirect", async () => {
    const res = await selectSector("boutique");
    expect(res).toEqual({ error: expect.stringMatching(/inconnu/i) });
    expect(calls.update).toHaveLength(0);
    expect(calls.cookieSet).toHaveLength(0);
    expect(calls.redirect).toHaveLength(0);
  });

  it("session sans tenant → { error }, aucune écriture", async () => {
    state.merchantId = null;
    const res = await selectSector("cafe");
    expect(res).toEqual({ error: expect.stringMatching(/session/i) });
    expect(calls.update).toHaveLength(0);
    expect(calls.cookieSet).toHaveLength(0);
  });

  it("échec DB → { error }, pas de cookie ni d'audit", async () => {
    state.updateError = { code: "23514", message: "violation" };
    const res = await selectSector("cafe");
    expect(res).toEqual({ error: expect.any(String) });
    expect(calls.eq).toEqual([{ col: "id", val: "merchant-1" }]); // tentative bornée au tenant
    expect(calls.cookieSet).toHaveLength(0);
    expect(calls.audit).toHaveLength(0);
  });
});

describe("skipSector", () => {
  it("efface le brouillon et redirige vers /onboarding (flow vierge)", async () => {
    await expect(skipSector()).rejects.toThrow("NEXT_REDIRECT:/onboarding");
    expect(calls.cookieDelete).toEqual([SECTOR_DRAFT_COOKIE]);
    expect(calls.update).toHaveLength(0);
  });
});
