import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock service-role : la RPC transactionnelle est simulée, aucun réseau.
const rpcState: { result: { data: unknown; error: { code?: string; message?: string } | null }; calls: { fn: string; args: Record<string, unknown> }[] } = {
  result: { data: null, error: null },
  calls: [],
};

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcState.calls.push({ fn, args });
      return rpcState.result;
    },
  },
}));

import { ensureMerchantProvisioned, resolveTrialDays, DEFAULT_TRIAL_DAYS } from "../provision";

beforeEach(() => {
  rpcState.result = { data: null, error: null };
  rpcState.calls = [];
  delete process.env.SELF_SERVICE_TRIAL_DAYS;
});

describe("resolveTrialDays", () => {
  it("défaut 14 jours", () => {
    expect(resolveTrialDays(undefined)).toBe(DEFAULT_TRIAL_DAYS);
    expect(resolveTrialDays("")).toBe(DEFAULT_TRIAL_DAYS);
  });
  it("0 = compte directement actif (lancement gratuit sans essai)", () => {
    expect(resolveTrialDays("0")).toBe(0);
  });
  it("valeurs invalides ou hors bornes → défaut (fail-safe)", () => {
    expect(resolveTrialDays("abc")).toBe(DEFAULT_TRIAL_DAYS);
    expect(resolveTrialDays("-3")).toBe(DEFAULT_TRIAL_DAYS);
    expect(resolveTrialDays("9999")).toBe(DEFAULT_TRIAL_DAYS);
    expect(resolveTrialDays("14.5")).toBe(DEFAULT_TRIAL_DAYS);
  });
  it("valeur valide respectée", () => {
    expect(resolveTrialDays("14")).toBe(14);
  });
});

describe("ensureMerchantProvisioned (RPC atomique + idempotente)", () => {
  it("appelle la fonction SQL avec user, email et jours d'essai", async () => {
    rpcState.result = { data: "merchant-123", error: null };
    process.env.SELF_SERVICE_TRIAL_DAYS = "14";
    const res = await ensureMerchantProvisioned("user-1", "nadia@boulangerie.ch");
    expect(res).toEqual({ ok: true, merchantId: "merchant-123" });
    expect(rpcState.calls).toEqual([
      {
        fn: "provision_self_service_merchant",
        args: { p_user_id: "user-1", p_email: "nadia@boulangerie.ch", p_trial_days: 14 },
      },
    ]);
  });

  it("erreur RPC → échec propre, jamais de throw", async () => {
    rpcState.result = { data: null, error: { code: "42883", message: "function does not exist" } };
    const res = await ensureMerchantProvisioned("user-1", "a@b.ch");
    expect(res).toEqual({ ok: false, error: "provisioning_failed" });
  });

  it("data null sans erreur → échec propre (pas de tenant fantôme)", async () => {
    rpcState.result = { data: null, error: null };
    const res = await ensureMerchantProvisioned("user-1", "a@b.ch");
    expect(res.ok).toBe(false);
  });
});
