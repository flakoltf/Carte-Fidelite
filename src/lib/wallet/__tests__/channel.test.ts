import { describe, it, expect, afterEach } from "vitest";
import { getChannels, AppleChannel, GoogleChannel } from "@/lib/wallet/channel";

afterEach(() => { delete process.env.GOOGLE_PUSH_ENABLED; });

describe("getChannels", () => {
  it("Apple seul par défaut (Google démo)", () => {
    const ch = getChannels();
    expect(ch).toContain(AppleChannel);
    expect(ch).not.toContain(GoogleChannel);
  });
  it("inclut Google si flag activé", () => {
    process.env.GOOGLE_PUSH_ENABLED = "true";
    expect(getChannels()).toContain(GoogleChannel);
  });
});
