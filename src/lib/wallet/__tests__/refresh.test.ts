import { describe, expect, it, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  eq: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: h.eq }) }) },
}));
vi.mock("@/lib/wallet/channel", () => ({
  AppleChannel: { notify: h.notify },
}));

import { refreshMerchantPasses } from "../refresh";

beforeEach(() => {
  h.eq.mockReset();
  h.notify.mockReset();
});

describe("refreshMerchantPasses", () => {
  it("ne pousse rien si le marchand n'a aucune carte", async () => {
    h.eq.mockResolvedValue({ data: [] });
    const res = await refreshMerchantPasses("m1");
    expect(res).toEqual({ pushed: 0 });
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("délègue le rafraîchissement silencieux à AppleChannel pour toutes les cartes", async () => {
    h.eq.mockResolvedValue({ data: [{ id: "c1" }, { id: "c2" }] });
    h.notify.mockResolvedValue({ pushed: 2 });
    const res = await refreshMerchantPasses("m1");
    expect(h.notify).toHaveBeenCalledWith(["c1", "c2"]); // sans message = silencieux
    expect(res).toEqual({ pushed: 2 });
  });
});
