import { describe, expect, it } from "vitest";
import { rotateDemoPassword } from "../rotate";
import { DemoGuardError } from "../identity";
import { DEMO_EMAIL, DEMO_SLUG } from "../constants";
import type { DemoDb } from "../db";

// Mock supabase-like minimal : seul .from("merchants").select(...).eq(...).maybeSingle()
// est exercé par rotateDemoPassword. Renvoie une ligne configurable.
function makeDb(merchant: Record<string, unknown> | null) {
  const builder: Record<string, unknown> = {
    select() { return builder; },
    eq() { return builder; },
    maybeSingle() { return Promise.resolve({ data: merchant, error: null }); },
  };
  return { from: () => builder } as unknown as DemoDb;
}

function makeAuth(opts: { error?: boolean } = {}) {
  const calls: { id: string; password: string }[] = [];
  return {
    calls,
    updateUserById: async (id: string, attrs: { password: string }) => {
      calls.push({ id, password: attrs.password });
      return { error: opts.error ? { message: "boom" } : null };
    },
  };
}

const demoRow = (over: Record<string, unknown> = {}) => ({
  id: "m-demo",
  slug: DEMO_SLUG,
  email: DEMO_EMAIL,
  role: "merchant",
  user_id: "user-demo",
  ...over,
});

describe("rotateDemoPassword — nominal", () => {
  it("résout la démo, génère un mdp et le réécrit sur le bon user Auth", async () => {
    const auth = makeAuth();
    const res = await rotateDemoPassword(makeDb(demoRow()), auth);

    expect(res.merchantId).toBe("m-demo");
    expect(res.userId).toBe("user-demo");
    expect(typeof res.tempPassword).toBe("string");
    expect(res.tempPassword.length).toBeGreaterThan(10);
    // Le mdp réécrit est exactement celui renvoyé, sur le user démo.
    expect(auth.calls).toHaveLength(1);
    expect(auth.calls[0]).toEqual({ id: "user-demo", password: res.tempPassword });
  });
});

describe("rotateDemoPassword — triple garde", () => {
  it("aucune démo → DemoGuardError(not_found), pas d'écriture Auth", async () => {
    const auth = makeAuth();
    await expect(rotateDemoPassword(makeDb(null), auth)).rejects.toBeInstanceOf(DemoGuardError);
    expect(auth.calls).toHaveLength(0);
  });

  it("email squatté (non @example.com) → mismatch, pas d'écriture Auth", async () => {
    const auth = makeAuth();
    await expect(
      rotateDemoPassword(makeDb(demoRow({ email: "vrai@boulangerie.ch" })), auth)
    ).rejects.toBeInstanceOf(DemoGuardError);
    expect(auth.calls).toHaveLength(0);
  });

  it("rôle non-marchand → mismatch, pas d'écriture Auth", async () => {
    const auth = makeAuth();
    await expect(
      rotateDemoPassword(makeDb(demoRow({ role: "admin" })), auth)
    ).rejects.toBeInstanceOf(DemoGuardError);
    expect(auth.calls).toHaveLength(0);
  });

  it("démo sans user_id → not_found, pas d'écriture Auth", async () => {
    const auth = makeAuth();
    await expect(
      rotateDemoPassword(makeDb(demoRow({ user_id: null })), auth)
    ).rejects.toBeInstanceOf(DemoGuardError);
    expect(auth.calls).toHaveLength(0);
  });
});

describe("rotateDemoPassword — échec Auth", () => {
  it("updateUserById renvoie une erreur → throw", async () => {
    const auth = makeAuth({ error: true });
    await expect(rotateDemoPassword(makeDb(demoRow()), auth)).rejects.toThrow();
  });
});
