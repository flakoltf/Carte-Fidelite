import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { getChannels, AppleChannel, GoogleChannel } from "@/lib/wallet/channel";
import { pushGoogleObjectUpdates } from "@/lib/wallet/googleObject";

vi.mock("@/lib/wallet/googleObject", () => ({
  pushGoogleObjectUpdates: vi.fn(async () => ({ pushed: 2 })),
}));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { delete process.env.GOOGLE_PUSH_ENABLED; vi.restoreAllMocks(); });

describe("getChannels", () => {
  it("Apple seul par défaut (GOOGLE_PUSH_ENABLED non posé)", () => {
    const ch = getChannels();
    expect(ch).toContain(AppleChannel);
    expect(ch).not.toContain(GoogleChannel);
  });
  it("inclut Google si flag activé", () => {
    process.env.GOOGLE_PUSH_ENABLED = "true";
    expect(getChannels()).toContain(GoogleChannel);
  });
});

describe("GoogleChannel.notify", () => {
  it("délègue le batch (cardIds + message) à pushGoogleObjectUpdates", async () => {
    const message = { title: "Bravo", body: "Café offert !" };
    const res = await GoogleChannel.notify(["c1", "c2"], message);
    expect(res).toEqual({ pushed: 2 });
    expect(pushGoogleObjectUpdates).toHaveBeenCalledWith(["c1", "c2"], message);
  });
  it("liste vide : no-op sans toucher à l'API", async () => {
    expect(await GoogleChannel.notify([])).toEqual({ pushed: 0 });
    expect(pushGoogleObjectUpdates).not.toHaveBeenCalled();
  });
  it("best-effort : un échec Google ne remonte jamais (le scan survit)", async () => {
    vi.mocked(pushGoogleObjectUpdates).mockRejectedValueOnce(new Error("auth KO"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await GoogleChannel.notify(["c1"])).toEqual({ pushed: 0 });
  });
});
