import { describe, expect, it } from "vitest";
import { captchaConfigured, verifyCaptcha } from "../captcha";

const env = (secret?: string) => ({ TURNSTILE_SECRET_KEY: secret } as unknown as NodeJS.ProcessEnv);

describe("captcha optionnel (Turnstile)", () => {
  it("non configuré → laisse passer sans appel réseau", async () => {
    expect(captchaConfigured(env())).toBe(false);
    const verifier = () => {
      throw new Error("ne doit pas être appelé");
    };
    await expect(verifyCaptcha(null, "1.2.3.4", env(), verifier)).resolves.toBe(true);
  });

  it("configuré + jeton absent → rejet (jamais contourné)", async () => {
    await expect(verifyCaptcha(null, "1.2.3.4", env("secret"))).resolves.toBe(false);
    await expect(verifyCaptcha("", "1.2.3.4", env("secret"))).resolves.toBe(false);
    await expect(verifyCaptcha(42, "1.2.3.4", env("secret"))).resolves.toBe(false);
    await expect(verifyCaptcha("x".repeat(5000), "1.2.3.4", env("secret"))).resolves.toBe(false);
  });

  it("configuré → suit le verdict du vérificateur", async () => {
    await expect(verifyCaptcha("tok", "ip", env("secret"), async () => true)).resolves.toBe(true);
    await expect(verifyCaptcha("tok", "ip", env("secret"), async () => false)).resolves.toBe(false);
  });

  it("le vérificateur reçoit jeton, secret et IP", async () => {
    const seen: string[] = [];
    await verifyCaptcha("tok-1", "9.9.9.9", env("sec-1"), async (t, s, ip) => {
      seen.push(t, s, ip);
      return true;
    });
    expect(seen).toEqual(["tok-1", "sec-1", "9.9.9.9"]);
  });
});
