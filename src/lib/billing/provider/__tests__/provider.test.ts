import { describe, expect, it } from "vitest";
import { createManualBillingProvider, type ManualBillingDeps } from "../manual";
import { createStripeBillingProvider } from "../stripe";
import { resolveBillingProviderKey } from "../index";

describe("resolveBillingProviderKey", () => {
  it("défaut 'manual', y compris pour toute valeur inconnue (fail-safe)", () => {
    expect(resolveBillingProviderKey(undefined)).toBe("manual");
    expect(resolveBillingProviderKey("")).toBe("manual");
    expect(resolveBillingProviderKey("paypal")).toBe("manual");
  });
  it("'stripe' sélectionne la couture Stripe", () => {
    expect(resolveBillingProviderKey("stripe")).toBe("stripe");
    expect(resolveBillingProviderKey(" Stripe ")).toBe("stripe");
  });
});

describe("ManualBillingProvider (lancement sans paiement)", () => {
  function deps(): { calls: unknown[]; deps: ManualBillingDeps } {
    const calls: unknown[] = [];
    return {
      calls,
      deps: {
        async applyPlan(input) {
          calls.push(input);
          return { error: null };
        },
      },
    };
  }

  it("startSubscription applique le plan et active immédiatement (pas de redirect)", async () => {
    const { calls, deps: d } = deps();
    const provider = createManualBillingProvider(d);
    const res = await provider.startSubscription({ merchantId: "m-1", plan: "croissance", cycle: "annual" });
    expect(res).toEqual({ ok: true, value: { kind: "activated" } });
    expect(calls).toEqual([{ merchantId: "m-1", plan: "croissance", cycle: "annual" }]);
  });

  it("changePlan suit le même chemin", async () => {
    const { calls, deps: d } = deps();
    const provider = createManualBillingProvider(d);
    await provider.changePlan({ merchantId: "m-2", plan: "premium", cycle: "monthly" });
    expect(calls).toHaveLength(1);
  });

  it("remonte les erreurs de persistance sans throw", async () => {
    const provider = createManualBillingProvider({
      async applyPlan() {
        return { error: "boom" };
      },
    });
    const res = await provider.startSubscription({ merchantId: "m", plan: "essentiel", cycle: "monthly" });
    expect(res).toEqual({ ok: false, error: "boom" });
  });

  it("pas de portail client ni de résiliation self-service, webhook 501", async () => {
    const provider = createManualBillingProvider({ async applyPlan() { return { error: null }; } });
    expect(await provider.customerPortalUrl("m")).toEqual({ ok: true, value: null });
    const cancel = await provider.cancelSubscription("m");
    expect(cancel.ok).toBe(false);
    const res = await provider.handleWebhook(new Request("https://x/api"));
    expect(res.status).toBe(501);
  });
});

describe("StripeBillingProvider (couture stubée, fail-closed)", () => {
  const provider = createStripeBillingProvider();
  const req = { merchantId: "m", plan: "essentiel", cycle: "monthly" } as const;

  it("toutes les opérations signalent clairement le non-implémenté", async () => {
    await expect(provider.startSubscription(req)).rejects.toThrow(/non implémenté/);
    await expect(provider.changePlan(req)).rejects.toThrow(/non implémenté/);
    await expect(provider.cancelSubscription("m")).rejects.toThrow(/non implémenté/);
    await expect(provider.customerPortalUrl("m")).rejects.toThrow(/non implémenté/);
  });

  it("le webhook refuse tout événement entrant (501, jamais de traitement non signé)", async () => {
    const res = await provider.handleWebhook(new Request("https://x/api/billing/webhook", { method: "POST" }));
    expect(res.status).toBe(501);
  });
});
