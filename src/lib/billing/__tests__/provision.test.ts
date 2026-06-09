import { describe, it, expect, vi } from "vitest";
import { provisionMerchant } from "@/lib/billing/provision";

function makeDeps() {
  const merchantsByCustomer = new Map<string, { id: string }>();
  const deps = {
    // cast as union so the mock can be re-assigned to return { id: string } in idempotent test
    findUserByEmail: vi.fn(async () => null as { id: string } | null),
    createUser: vi.fn(async (_email: string) => ({ id: "user-1" })),
    // parameter typed as Record<string,unknown> to match ProvisionDeps (contravariance)
    upsertMerchant: vi.fn(async (row: Record<string, unknown>) => {
      const existing = merchantsByCustomer.get(row.stripe_customer_id as string);
      const m = existing ?? { id: "merch-1" };
      merchantsByCustomer.set(row.stripe_customer_id as string, m);
      return { id: m.id, shop_name: "Boutique" };
    }),
    generateInviteLink: vi.fn(async () => "https://link.example/invite"),
    sendInviteEmail: vi.fn(async () => {}),
  };
  return deps;
}

describe("provisionMerchant", () => {
  it("crée user + merchant + envoie l'email d'invitation", async () => {
    const deps = makeDeps();
    await provisionMerchant(
      { email: "m@shop.ch", plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" },
      deps,
    );
    expect(deps.createUser).toHaveBeenCalledWith("m@shop.ch");
    expect(deps.upsertMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro", card_limit: 1000, stripe_customer_id: "cus_1" }),
    );
    expect(deps.sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "m@shop.ch", actionLink: "https://link.example/invite" }),
    );
  });

  it("ne recrée pas l'utilisateur s'il existe déjà (idempotent)", async () => {
    const deps = makeDeps();
    deps.findUserByEmail = vi.fn(async () => ({ id: "user-existant" }));
    await provisionMerchant(
      { email: "m@shop.ch", plan: "starter", stripeCustomerId: "cus_2", stripeSubscriptionId: "sub_2" },
      deps,
    );
    expect(deps.createUser).not.toHaveBeenCalled();
    expect(deps.upsertMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "starter", card_limit: 250 }),
    );
  });

  it("rejette un plan inconnu", async () => {
    const deps = makeDeps();
    await expect(
      provisionMerchant(
        { email: "m@shop.ch", plan: "inconnu", stripeCustomerId: "c", stripeSubscriptionId: "s" },
        deps,
      ),
    ).rejects.toThrow();
  });
});
